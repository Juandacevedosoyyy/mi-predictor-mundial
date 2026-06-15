"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/schema";
import { predictMatch, type TeamStats } from "@/lib/model/poisson";

export async function saveResult(fixtureId: number, homeScore: number, awayScore: number) {
  const db = getDb();

  db.prepare(`
    UPDATE fixtures SET home_score = ?, away_score = ?, status = 'FT' WHERE id = ?
  `).run(homeScore, awayScore, fixtureId);

  recalcPredictions(db);

  revalidatePath("/admin");
  revalidatePath("/grupos");
  revalidatePath("/");
  revalidatePath(`/partido/${fixtureId}`);
}

export async function clearResult(fixtureId: number) {
  const db = getDb();

  db.prepare(`
    UPDATE fixtures SET home_score = NULL, away_score = NULL, status = 'NS' WHERE id = ?
  `).run(fixtureId);

  recalcPredictions(db);

  revalidatePath("/admin");
  revalidatePath("/grupos");
  revalidatePath("/");
  revalidatePath(`/partido/${fixtureId}`);
}

function getTeamStats(db: ReturnType<typeof getDb>, teamId: number): TeamStats {
  const played = db.prepare(`
    SELECT home_id, away_id, home_score, away_score
    FROM fixtures
    WHERE (home_id = ? OR away_id = ?) AND status = 'FT' AND home_score IS NOT NULL
    ORDER BY kickoff_utc DESC
    LIMIT 5
  `).all(teamId, teamId) as Array<{ home_id: number; away_id: number; home_score: number; away_score: number }>;

  if (played.length === 0) {
    return { goalsFor: 1.35, goalsAgainst: 1.35, cornersFor: 5, cornersAgainst: 5, yellowCards: 2 };
  }

  let gf = 0, ga = 0;
  for (const f of played) {
    if (f.home_id === teamId) { gf += f.home_score; ga += f.away_score; }
    else { gf += f.away_score; ga += f.home_score; }
  }

  const n = played.length;
  return {
    goalsFor: Math.max(0.3, gf / n),
    goalsAgainst: Math.max(0.3, ga / n),
    cornersFor: 5,
    cornersAgainst: 5,
    yellowCards: 2,
  };
}

function recalcPredictions(db: ReturnType<typeof getDb>) {
  const futures = db.prepare(`
    SELECT id, home_id, away_id FROM fixtures WHERE status = 'NS'
  `).all() as Array<{ id: number; home_id: number; away_id: number }>;

  if (futures.length === 0) return;

  const insert = db.prepare(`
    INSERT INTO predictions (
      fixture_id, generated_at, home_win_pct, draw_pct, away_win_pct,
      home_goals_ev, away_goals_ev, over25_pct, btts_pct, exact_scores,
      corners_ev, home_corners_ev, away_corners_ev, yellow_cards_ev
    ) VALUES (
      @fixture_id, @generated_at, @home_win_pct, @draw_pct, @away_win_pct,
      @home_goals_ev, @away_goals_ev, @over25_pct, @btts_pct, @exact_scores,
      @corners_ev, @home_corners_ev, @away_corners_ev, @yellow_cards_ev
    )
  `);

  const now = new Date().toISOString();
  const cache = new Map<number, TeamStats>();
  const stat = (id: number) => {
    if (!cache.has(id)) cache.set(id, getTeamStats(db, id));
    return cache.get(id)!;
  };

  db.transaction(() => {
    for (const f of futures) {
      const pred = predictMatch(stat(f.home_id), stat(f.away_id));
      insert.run({
        fixture_id: f.id, generated_at: now,
        home_win_pct: pred.homeWinPct, draw_pct: pred.drawPct, away_win_pct: pred.awayWinPct,
        home_goals_ev: pred.homeGoalsEv, away_goals_ev: pred.awayGoalsEv,
        over25_pct: pred.over25Pct, btts_pct: pred.bttsPct,
        exact_scores: JSON.stringify(pred.exactScores),
        corners_ev: pred.cornersEv, home_corners_ev: pred.homeCornersEv,
        away_corners_ev: pred.awayCornersEv, yellow_cards_ev: pred.yellowCardsEv,
      });
    }
  })();
}
