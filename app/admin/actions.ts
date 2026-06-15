"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/schema";
import { predictMatch, type TeamStats } from "@/lib/model/poisson";
import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

export async function saveResult(fixtureId: number, homeScore: number, awayScore: number) {
  const sql = getDb();

  await sql`
    UPDATE fixtures SET home_score = ${homeScore}, away_score = ${awayScore}, status = 'FT'
    WHERE id = ${fixtureId}
  `;

  await recalcPredictions(sql);

  revalidatePath("/admin");
  revalidatePath("/grupos");
  revalidatePath("/");
  revalidatePath(`/partido/${fixtureId}`);
}

export async function clearResult(fixtureId: number) {
  const sql = getDb();

  await sql`
    UPDATE fixtures SET home_score = NULL, away_score = NULL, status = 'NS'
    WHERE id = ${fixtureId}
  `;

  await recalcPredictions(sql);

  revalidatePath("/admin");
  revalidatePath("/grupos");
  revalidatePath("/");
  revalidatePath(`/partido/${fixtureId}`);
}

async function getTeamStats(sql: Sql, teamId: number): Promise<TeamStats> {
  const played = await sql`
    SELECT home_id, away_id, home_score, away_score
    FROM fixtures
    WHERE (home_id = ${teamId} OR away_id = ${teamId})
      AND status = 'FT' AND home_score IS NOT NULL
    ORDER BY kickoff_utc DESC
    LIMIT 5
  ` as Array<{ home_id: number; away_id: number; home_score: number; away_score: number }>;

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
    goalsFor:       Math.max(0.3, gf / n),
    goalsAgainst:   Math.max(0.3, ga / n),
    cornersFor:     5,
    cornersAgainst: 5,
    yellowCards:    2,
  };
}

async function recalcPredictions(sql: Sql) {
  const futures = await sql`
    SELECT id, home_id, away_id FROM fixtures WHERE status = 'NS'
  ` as Array<{ id: number; home_id: number; away_id: number }>;

  if (futures.length === 0) return;

  const now = new Date().toISOString();
  const cache = new Map<number, TeamStats>();
  const stat = async (id: number) => {
    if (!cache.has(id)) cache.set(id, await getTeamStats(sql, id));
    return cache.get(id)!;
  };

  for (const f of futures) {
    const pred = predictMatch(await stat(f.home_id), await stat(f.away_id));
    await sql`
      INSERT INTO predictions (
        fixture_id, generated_at, home_win_pct, draw_pct, away_win_pct,
        home_goals_ev, away_goals_ev, over25_pct, btts_pct, exact_scores,
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
}
