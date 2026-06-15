/**
 * Lógica de sincronización compartida entre scripts/cron.ts y app/api/cron/route.ts.
 * Fuente de datos: football-data.org v4.
 */
import { getDb } from "./db/schema";
import { fetchWCTeams, fetchWCMatches, mapGroupCode, mapStatus, mapStage } from "./api/football-data";
import { predictMatch, type TeamStats } from "./model/poisson";

type Sql = ReturnType<typeof getDb>;

// ── Sync principal ─────────────────────────────────────────────────────────

export async function syncFromFootballData(): Promise<{
  teams: number;
  fixtures: number;
  predictions: number;
}> {
  const sql = getDb();

  const teamsCount = await syncTeams(sql);
  const fixturesCount = await syncFixtures(sql);
  await purgeSeedData(sql);
  const predictionsCount = await recalcAllPredictions(sql);

  return { teams: teamsCount, fixtures: fixturesCount, predictions: predictionsCount };
}

// ── Sincronizar equipos ────────────────────────────────────────────────────

async function syncTeams(sql: Sql): Promise<number> {
  const data = await fetchWCTeams();

  const rows = data.teams.map((t) => ({
    id:         t.id,
    name:       t.name,
    short_name: t.tla,
    logo:       t.crest,
    country:    t.name,
    group_code: t.group ? mapGroupCode(t.group) : null,
  }));

  for (const r of rows) {
    await sql`
      INSERT INTO teams (id, name, short_name, logo, country, group_code)
      VALUES (${r.id}, ${r.name}, ${r.short_name}, ${r.logo}, ${r.country}, ${r.group_code})
      ON CONFLICT (id) DO UPDATE SET
        name       = EXCLUDED.name,
        short_name = EXCLUDED.short_name,
        logo       = EXCLUDED.logo,
        group_code = COALESCE(EXCLUDED.group_code, teams.group_code)
    `;
  }

  return rows.length;
}

// ── Sincronizar fixtures ───────────────────────────────────────────────────

async function syncFixtures(sql: Sql): Promise<number> {
  const data = await fetchWCMatches();

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
      home_team_id: m.homeTeam.id,
      away_team_id: m.awayTeam.id,
    };
  });

  for (const r of rows) {
    await sql`
      INSERT INTO fixtures (id, home_id, away_id, kickoff_utc, stage, group_code, status, home_score, away_score)
      VALUES (${r.id}, ${r.home_id}, ${r.away_id}, ${r.kickoff_utc}, ${r.stage}, ${r.group_code}, ${r.status}, ${r.home_score}, ${r.away_score})
      ON CONFLICT (id) DO UPDATE SET
        stage      = EXCLUDED.stage,
        group_code = EXCLUDED.group_code,
        status     = EXCLUDED.status,
        home_score = CASE WHEN EXCLUDED.home_score IS NOT NULL THEN EXCLUDED.home_score ELSE fixtures.home_score END,
        away_score = CASE WHEN EXCLUDED.away_score IS NOT NULL THEN EXCLUDED.away_score ELSE fixtures.away_score END
    `;
    if (r.group_code) {
      await sql`UPDATE teams SET group_code = ${r.group_code} WHERE id = ${r.home_team_id} AND group_code IS NULL`;
      await sql`UPDATE teams SET group_code = ${r.group_code} WHERE id = ${r.away_team_id} AND group_code IS NULL`;
    }
  }

  return rows.length;
}

// ── Purgar seed data ───────────────────────────────────────────────────────

async function purgeSeedData(sql: Sql): Promise<void> {
  const hasRealTeams = (await sql`SELECT 1 FROM teams WHERE id > 1000 LIMIT 1`).length > 0;
  if (!hasRealTeams) return;

  await sql`DELETE FROM predictions WHERE fixture_id IN (SELECT id FROM fixtures WHERE id BETWEEN 1000 AND 1999)`;
  await sql`DELETE FROM fixtures WHERE id BETWEEN 1000 AND 1999`;
  await sql`DELETE FROM teams WHERE id BETWEEN 1 AND 99`;
}

// ── Recalcular predicciones ────────────────────────────────────────────────

export async function recalcAllPredictions(sql: Sql): Promise<number> {
  const futures = await sql`
    SELECT id, home_id, away_id FROM fixtures WHERE status = 'NS'
  ` as Array<{ id: number; home_id: number; away_id: number }>;

  if (futures.length === 0) return 0;

  const now = new Date().toISOString();
  const cache = new Map<number, TeamStats>();

  async function statFor(teamId: number): Promise<TeamStats> {
    if (cache.has(teamId)) return cache.get(teamId)!;

    const played = await sql`
      SELECT home_id, away_id, home_score, away_score
      FROM fixtures
      WHERE (home_id = ${teamId} OR away_id = ${teamId})
        AND status = 'FT' AND home_score IS NOT NULL
      ORDER BY kickoff_utc DESC LIMIT 5
    ` as Array<{ home_id: number; away_id: number; home_score: number; away_score: number }>;

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
      goalsFor:       Math.max(0.3, gf / n),
      goalsAgainst:   Math.max(0.3, ga / n),
      cornersFor:     5,
      cornersAgainst: 5,
      yellowCards:    2,
    };
    cache.set(teamId, stats);
    return stats;
  }

  for (const f of futures) {
    const homeStats = await statFor(f.home_id);
    const awayStats = await statFor(f.away_id);
    const pred = predictMatch(homeStats, awayStats);

    await sql`
      INSERT INTO predictions (
        fixture_id, generated_at,
        home_win_pct, draw_pct, away_win_pct,
        home_goals_ev, away_goals_ev,
        over25_pct, btts_pct, exact_scores,
        corners_ev, home_corners_ev, away_corners_ev, yellow_cards_ev
      ) VALUES (
        ${f.id}, ${now},
        ${pred.homeWinPct}, ${pred.drawPct}, ${pred.awayWinPct},
        ${pred.homeGoalsEv}, ${pred.awayGoalsEv},
        ${pred.over25Pct}, ${pred.bttsPct}, ${JSON.stringify(pred.exactScores)},
        ${pred.cornersEv}, ${pred.homeCornersEv}, ${pred.awayCornersEv}, ${pred.yellowCardsEv}
      )
    `;
  }

  return futures.length;
}
