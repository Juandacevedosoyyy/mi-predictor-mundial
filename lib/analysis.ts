export interface Recommendation {
  pick: "1" | "X" | "2";
  pickName: string;
  confidence: "ALTA" | "MEDIA" | "BAJA";
  overUnder: "Over 2.5" | "Under 2.5";
  overPct: number;
  topScore: string;
  topScorePct: number;
  reasoning: string;
}

export function buildRecommendation(
  homeName: string,
  awayName: string,
  homeWin: number,
  draw: number,
  awayWin: number,
  over25: number,
  exactScores: { score: string; pct: number }[],
  homeGoals: number,
  awayGoals: number
): Recommendation {
  const options = [
    { key: "1" as const, val: homeWin, name: homeName },
    { key: "X" as const, val: draw,    name: "Empate"   },
    { key: "2" as const, val: awayWin, name: awayName  },
  ].sort((a, b) => b.val - a.val);

  const top    = options[0];
  const second = options[1];
  const margin = top.val - second.val;

  const confidence: Recommendation["confidence"] =
    margin > 0.22 ? "ALTA" :
    margin > 0.10 ? "MEDIA" : "BAJA";

  const overUnder  = over25 >= 0.5 ? "Over 2.5" : "Under 2.5";
  const overPct    = over25 >= 0.5 ? over25 : 1 - over25;
  const topScore   = exactScores[0]?.score ?? "1-0";
  const topScorePct = exactScores[0]?.pct ?? 0;
  const goalsEv    = homeGoals + awayGoals;

  let reasoning = "";
  if (top.key === "1")
    reasoning = `${homeName} es favorito con ${pct(homeWin)} de probabilidad. `;
  else if (top.key === "2")
    reasoning = `${awayName} llega con ventaja estadística (${pct(awayWin)}). `;
  else
    reasoning = `Partido muy igualado — el empate (${pct(draw)}) es la opción más frecuente en la distribución. `;

  reasoning += `Se esperan ${goalsEv.toFixed(1)} goles en total, lo que apunta a ${overUnder} (${pct(overPct)}). `;
  reasoning += `Marcador más probable: ${topScore} (${pct(topScorePct)}).`;

  return {
    pick: top.key,
    pickName: top.name,
    confidence,
    overUnder,
    overPct,
    topScore,
    topScorePct,
    reasoning,
  };
}

export function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

export function confidenceColor(c: Recommendation["confidence"]) {
  if (c === "ALTA")  return "#00d4ff";
  if (c === "MEDIA") return "#f59e0b";
  return "#f97316";
}
