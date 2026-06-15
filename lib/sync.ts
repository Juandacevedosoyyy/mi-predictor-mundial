/**
 * Lógica de sincronización compartida entre scripts/cron.ts y app/api/cron/route.ts.
 * Fuente de datos: football-data.org v4.
 */
import { getDb } from "./db/schema";
import { fetchWCTeams, fetchWCMatches, mapGroupCode, mapStatus, mapStage } from "./api/football-data";
import { predictMatch, type TeamStats } from "./model/poisson";

type DB = ReturnType<typeof getDb>;

// ── Sync principal ─────────────────────────────────────────────────────────

export async function syncFromFootballData(): Promise<{
  teams: number;
  fixtures: number;
  predictions: number;
}> {
  const db = getDb();

  // Secuencial: los fixtures referencian equipos por FK
  const teamsCount = await syncTeams(db);
  const fixturesCount = await syncFixtures(db);

  // Limpia datos del seed local si ya tenemos datos reales de la API.
  // Los IDs del seed son 1-48 (teams) y 1000-1071 (fixtures).
  // Los IDs de football-data.org son mucho más grandes (> 1000 para teams, > 400000 para fixtures).
  purgeSeedData(db);

  const predictionsCount = recalcAllPredictions(db);

  return { teams: teamsCount, fixtures: fixturesCount, predictions: predictionsCount };
}

// ── Sincronizar equipos ────────────────────────────────────────────────────

async function syncTeams(db: DB): Promise<number> {
  const data = await fetchWCTeams();

  const upsert = db.prepare(`
    INSERT INTO teams (id, name, short_name, logo, country, group_code)
    VALUES (@id, @name, @short_name, @logo, @country, @group_code)
    ON CONFLICT(id) DO UPDATE SET
      name       = excluded.name,
      short_name = excluded.short_name,
      logo       = excluded.logo,
      group_code = COALESCE(excluded.group_code, teams.group_code)
  `);

  const rows = data.teams.map((t) => ({
    id:         t.id,
    name:       t.name,
    short_name: t.tla,
    logo:       t.crest,
    country:    t.name,
    group_code: t.group ? mapGroupCode(t.group) : null,
  }));

  db.transaction(() => { for (const r of rows) upsert.run(r); })();
  return rows.length;
}

// ── Sincronizar fixtures ───────────────────────────────────────────────────

async function syncFixtures(db: DB): Promise<number> {
  const data = await fetchWCMatches();

  // Upsert fixtures — respeta resultados ingresados manualmente si la API
  // aún no tiene el score (solo actualiza status/score cuando la API los trae).
  const upsert = db.prepare(`
    INSERT INTO fixtures (id, home_id, away_id, kickoff_utc, stage, group_code, status, home_score, away_score)
    VALUES (@id, @home_id, @away_id, @kickoff_utc, @stage, @group_code, @status, @home_score, @away_score)
    ON CONFLICT(id) DO UPDATE SET
      stage      = excluded.stage,
      group_code = excluded.group_code,
      status     = excluded.status,
      home_score = CASE WHEN excluded.home_score IS NOT NULL THEN excluded.home_score ELSE fixtures.home_score END,
      away_score = CASE WHEN excluded.away_score IS NOT NULL THEN excluded.away_score ELSE fixtures.away_score END
  `);

  // Actualizar group_code de equipos a partir de los partidos (la API de teams
  // no siempre incluye el campo group en la respuesta).
  const updateTeamGroup = db.prepare(`
    UPDATE teams SET group_code = ? WHERE id = ? AND group_code IS NULL
  `);

  const rows = data.matches.map((m) => {
    const groupCode = mapGroupCode(m.group);
    return {
      id:          m.id,
      home_id:     m.homeTeam.id,
      away_id:     m.awayTeam.id,
      kickoff_utc: m.utcDate,
      stage:       mapStage(m.stage, m.group),
      group_code:  groupCode,
      status:      mapStatus(m.status),
      home_score:  m.score.fullTime.home ?? null,
      away_score:  m.score.fullTime.away ?? null,
    };
  });

  db.transaction(() => {
    for (const r of rows) {
      upsert.run(r);
      // Propagar group_code a los equipos si faltaba
      if (r.group_code) {
        const m = data.matches.find((x) => x.id === r.id)!;
        updateTeamGroup.run(r.group_code, m.homeTeam.id);
        updateTeamGroup.run(r.group_code, m.awayTeam.id);
      }
    }
  })();

  return rows.length;
}

// ── Purgar seed data ───────────────────────────────────────────────────────

function purgeSeedData(db: DB) {
  // Solo purga si hay al menos un equipo real (id > 1000) en la DB
  const hasRealTeams = (db.prepare("SELECT 1 FROM teams WHERE id > 1000 LIMIT 1").get()) != null;
  if (!hasRealTeams) return;

  // Eliminar fixtures del seed (IDs 1000-1999) y sus predicciones
  db.prepare("DELETE FROM predictions WHERE fixture_id IN (SELECT id FROM fixtures WHERE id BETWEEN 1000 AND 1999)").run();
  db.prepare("DELETE FROM fixtures WHERE id BETWEEN 1000 AND 1999").run();

  // Eliminar equipos del seed (IDs 1-99)
  db.prepare("DELETE FROM teams WHERE id BETWEEN 1 AND 99").run();
}

// ── Recalcular predicciones ────────────────────────────────────────────────

export function recalcAllPredictions(db: DB): number {
  const futures = db.prepare(`
    SELECT id, home_id, away_id FROM fixtures WHERE status = 'NS'
  `).all() as Array<{ id: number; home_id: number; away_id: number }>;

  if (futures.length === 0) return 0;

  const insert = db.prepare(`
    INSERT INTO predictions (
      fixture_id, generated_at,
      home_win_pct, draw_pct, away_win_pct,
      home_goals_ev, away_goals_ev,
      over25_pct, btts_pct, exact_scores,
      corners_ev, home_corners_ev, away_corners_ev, yellow_cards_ev
    ) VALUES (
      @fixture_id, @generated_at,
      @home_win_pct, @draw_pct, @away_win_pct,
      @home_goals_ev, @away_goals_ev,
      @over25_pct, @btts_pct, @exact_scores,
      @corners_ev, @home_corners_ev, @away_corners_ev, @yellow_cards_ev
    )
  `);

  const now = new Date().toISOString();
  const cache = new Map<number, TeamStats>();

  function statFor(teamId: number): TeamStats {
    if (cache.has(teamId)) return cache.get(teamId)!;
    const played = db.prepare(`
      SELECT home_id, away_id, home_score, away_score
      FROM fixtures
      WHERE (home_id = ? OR away_id = ?) AND status = 'FT' AND home_score IS NOT NULL
      ORDER BY kickoff_utc DESC LIMIT 5
    `).all(teamId, teamId) as Array<{ home_id: number; away_id: number; home_score: number; away_score: number }>;

    if (played.length === 0) {
      const def: TeamStats = { goalsFor: 1.35, goalsAgainst: 1.35, cornersFor: 5, cornersAgainst: 5, yellowCards: 2 };
      cache.set(teamId, def);
      return def;
    }

    let gf = 0, ga = 0;
    for (const f of played) {
      if (f.home_id === teamId) { gf += f.home_score; ga += f.away_score; }
      else                       { gf += f.away_score; ga += f.home_score; }
    }
    const n = played.length;
    const stats: TeamStats = {
      goalsFor:      Math.max(0.3, gf / n),
      goalsAgainst:  Math.max(0.3, ga / n),
      cornersFor:    5,
      cornersAgainst:5,
      yellowCards:   2,
    };
    cache.set(teamId, stats);
    return stats;
  }

  db.transaction(() => {
    for (const f of futures) {
      const pred = predictMatch(statFor(f.home_id), statFor(f.away_id));
      insert.run({
        fixture_id:      f.id,
        generated_at:    now,
        home_win_pct:    pred.homeWinPct,
        draw_pct:        pred.drawPct,
        away_win_pct:    pred.awayWinPct,
        home_goals_ev:   pred.homeGoalsEv,
        away_goals_ev:   pred.awayGoalsEv,
        over25_pct:      pred.over25Pct,
        btts_pct:        pred.bttsPct,
        exact_scores:    JSON.stringify(pred.exactScores),
        corners_ev:      pred.cornersEv,
        home_corners_ev: pred.homeCornersEv,
        away_corners_ev: pred.awayCornersEv,
        yellow_cards_ev: pred.yellowCardsEv,
      });
    }
  })();

  return futures.length;
}
