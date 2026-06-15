/** Distribución de Poisson: P(X = k | lambda) */
export function poissonPmf(lambda: number, k: number): number {
  if (lambda <= 0 || k < 0) return 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

/** CDF acumulada hasta maxGoals */
function goalMatrix(lambdaHome: number, lambdaAway: number, maxGoals = 8) {
  const matrix: number[][] = [];
  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = [];
    for (let a = 0; a <= maxGoals; a++) {
      matrix[h][a] = poissonPmf(lambdaHome, h) * poissonPmf(lambdaAway, a);
    }
  }
  return matrix;
}

export interface MatchPrediction {
  homeGoalsEv: number;
  awayGoalsEv: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  over25Pct: number;
  bttsPct: number;
  exactScores: { score: string; pct: number }[];
  cornersEv: number;
  homeCornersEv: number;
  awayCornersEv: number;
  yellowCardsEv: number;
}

export interface TeamStats {
  /** Goles marcados por partido (últimos N partidos) */
  goalsFor: number;
  /** Goles recibidos por partido */
  goalsAgainst: number;
  /** Corners a favor por partido */
  cornersFor: number;
  /** Córners en contra por partido */
  cornersAgainst: number;
  /** Tarjetas amarillas por partido */
  yellowCards: number;
  /** Factor de ventaja de local (1.0 = neutro) */
  homeAdvantage?: number;
}

/**
 * Calcula las predicciones para un partido dado los stats históricos.
 * leagueAvgGoals: promedio de goles por equipo en el torneo (default 1.35 para WC).
 */
export function predictMatch(
  home: TeamStats,
  away: TeamStats,
  leagueAvgGoals = 1.35
): MatchPrediction {
  const homeAdv = home.homeAdvantage ?? 1.12;

  // Expected goals via Dixon-Coles-style strength
  const homeAttack = home.goalsFor / leagueAvgGoals;
  const homeDefense = home.goalsAgainst / leagueAvgGoals;
  const awayAttack = away.goalsFor / leagueAvgGoals;
  const awayDefense = away.goalsAgainst / leagueAvgGoals;

  const lambdaHome = Math.max(0.1, homeAttack * awayDefense * leagueAvgGoals * homeAdv);
  const lambdaAway = Math.max(0.1, awayAttack * homeDefense * leagueAvgGoals);

  const matrix = goalMatrix(lambdaHome, lambdaAway);

  let homeWin = 0, draw = 0, awayWin = 0, over25 = 0, btts = 0;
  const exactScores: { score: string; pct: number }[] = [];

  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      const p = matrix[h][a];
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
      if (h + a > 2.5) over25 += p;
      if (h > 0 && a > 0) btts += p;
      if (p > 0.005) exactScores.push({ score: `${h}-${a}`, pct: p });
    }
  }

  exactScores.sort((a, b) => b.pct - a.pct);

  // Corners: Poisson independiente
  const cornersHome = (home.cornersFor + away.cornersAgainst) / 2;
  const cornersAway = (away.cornersFor + home.cornersAgainst) / 2;

  return {
    homeGoalsEv: lambdaHome,
    awayGoalsEv: lambdaAway,
    homeWinPct: homeWin,
    drawPct: draw,
    awayWinPct: awayWin,
    over25Pct: over25,
    bttsPct: btts,
    exactScores: exactScores.slice(0, 10),
    cornersEv: cornersHome + cornersAway,
    homeCornersEv: cornersHome,
    awayCornersEv: cornersAway,
    yellowCardsEv: home.yellowCards + away.yellowCards,
  };
}

/** Simulación de torneo: corre N simulaciones, devuelve probabilidades de campeón por equipo */
export function simulateTournament(
  teams: { id: number; name: string; stats: TeamStats }[],
  fixtures: { homeId: number; awayId: number; stage: string }[],
  simulations = 10_000
): { id: number; name: string; championPct: number }[] {
  const wins: Record<number, number> = {};
  teams.forEach((t) => (wins[t.id] = 0));

  const statsMap = new Map(teams.map((t) => [t.id, t.stats]));

  for (let s = 0; s < simulations; s++) {
    // Simplified: random winner weighted by homeWinPct
    const groupWinners = simulateGroups(teams, fixtures, statsMap);
    const champion = simulateKnockout(groupWinners, statsMap);
    if (champion) wins[champion] = (wins[champion] ?? 0) + 1;
  }

  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    championPct: (wins[t.id] ?? 0) / simulations,
  })).sort((a, b) => b.championPct - a.championPct);
}

function simulateGroups(
  teams: { id: number; stats: TeamStats }[],
  fixtures: { homeId: number; awayId: number; stage: string }[],
  statsMap: Map<number, TeamStats>
): number[] {
  // Devuelve los 16 clasificados (top 2 por grupo + mejores terceros, simplificado)
  // Para MVP: devuelve todos los equipos ordenados aleatoriamente ponderado
  return teams.map((t) => t.id);
}

function simulateKnockout(
  teams: number[],
  statsMap: Map<number, TeamStats>
): number | null {
  let remaining = [...teams];
  while (remaining.length > 1) {
    const next: number[] = [];
    for (let i = 0; i < remaining.length; i += 2) {
      const home = remaining[i];
      const away = remaining[i + 1] ?? remaining[i];
      const hStats = statsMap.get(home);
      const aStats = statsMap.get(away);
      if (!hStats || !aStats) { next.push(home); continue; }
      const pred = predictMatch(hStats, aStats);
      const r = Math.random();
      if (r < pred.homeWinPct) next.push(home);
      else if (r < pred.homeWinPct + pred.drawPct) {
        next.push(Math.random() < 0.5 ? home : away);
      } else next.push(away);
    }
    remaining = next;
  }
  return remaining[0] ?? null;
}
