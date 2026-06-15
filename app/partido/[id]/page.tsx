import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/schema";
import { predictMatch } from "@/lib/model/poisson";
import { buildRecommendation, confidenceColor, pct as fmtPct } from "@/lib/analysis";
import MatchCharts from "./MatchCharts";

interface Params {
  params: Promise<{ id: string }>;
}

interface FixtureRow {
  id: number;
  home_id: number;
  away_id: number;
  home_name: string;
  away_name: string;
  kickoff_utc: string;
  stage: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_win_pct: number | null;
  draw_pct: number | null;
  away_win_pct: number | null;
  home_goals_ev: number | null;
  away_goals_ev: number | null;
  over25_pct: number | null;
  btts_pct: number | null;
  exact_scores: string | null;
  corners_ev: number | null;
  home_corners_ev: number | null;
  away_corners_ev: number | null;
  yellow_cards_ev: number | null;
  generated_at: string | null;
}

const DEFAULT_STATS = {
  goalsFor: 1.35, goalsAgainst: 1.35,
  cornersFor: 5, cornersAgainst: 5, yellowCards: 2,
};

async function getFixture(id: number): Promise<FixtureRow | null> {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT f.*,
        th.name as home_name, ta.name as away_name,
        p.home_win_pct, p.draw_pct, p.away_win_pct,
        p.home_goals_ev, p.away_goals_ev, p.over25_pct, p.btts_pct,
        p.exact_scores, p.corners_ev, p.home_corners_ev, p.away_corners_ev,
        p.yellow_cards_ev, p.generated_at
      FROM fixtures f
      JOIN teams th ON th.id = f.home_id
      JOIN teams ta ON ta.id = f.away_id
      LEFT JOIN (
        SELECT * FROM predictions
        WHERE id IN (SELECT MAX(id) FROM predictions GROUP BY fixture_id)
      ) p ON p.fixture_id = f.id
      WHERE f.id = ?
    `).get(id) as FixtureRow | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

function StatBar({
  label,
  value,
  max,
  highlight = false,
}: {
  label: string;
  value: number;
  max: number;
  highlight?: boolean;
}) {
  const w = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--muted-foreground)]">{label}</span>
        <span className={highlight ? "text-[var(--accent)] font-bold" : "font-medium"}>
          {value.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${highlight ? "bg-[var(--accent)]" : "bg-[var(--muted-foreground)]"}`}
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
}

function ProbBar({
  homeWin,
  draw,
  awayWin,
}: {
  homeWin: number;
  draw: number;
  awayWin: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
        <span>LOCAL {(homeWin * 100).toFixed(1)}%</span>
        <span>EMPATE {(draw * 100).toFixed(1)}%</span>
        <span>VISITANTE {(awayWin * 100).toFixed(1)}%</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        <div
          className="bg-[var(--accent)]"
          style={{ width: `${homeWin * 100}%` }}
        />
        <div
          className="bg-[var(--muted-foreground)] opacity-60"
          style={{ width: `${draw * 100}%` }}
        />
        <div
          className="bg-[var(--accent)] opacity-40"
          style={{ width: `${awayWin * 100}%` }}
        />
      </div>
    </div>
  );
}

export default async function PartidoPage({ params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) notFound();

  let fixture = await getFixture(numId);

  // Si no existe en DB, usar demo
  if (!fixture) {
    const pred = predictMatch(DEFAULT_STATS, DEFAULT_STATS);
    const exactScoresDemo = pred.exactScores.slice(0, 8);
    fixture = {
      id: numId,
      home_id: 1,
      away_id: 2,
      home_name: "Local",
      away_name: "Visitante",
      kickoff_utc: new Date().toISOString(),
      stage: "Group Stage",
      status: "NS",
      home_score: null,
      away_score: null,
      home_win_pct: pred.homeWinPct,
      draw_pct: pred.drawPct,
      away_win_pct: pred.awayWinPct,
      home_goals_ev: pred.homeGoalsEv,
      away_goals_ev: pred.awayGoalsEv,
      over25_pct: pred.over25Pct,
      btts_pct: pred.bttsPct,
      exact_scores: JSON.stringify(exactScoresDemo),
      corners_ev: pred.cornersEv,
      home_corners_ev: pred.homeCornersEv,
      away_corners_ev: pred.awayCornersEv,
      yellow_cards_ev: pred.yellowCardsEv,
      generated_at: new Date().toISOString(),
    };
  }

  const homeWin = fixture.home_win_pct ?? 0.38;
  const draw = fixture.draw_pct ?? 0.28;
  const awayWin = fixture.away_win_pct ?? 0.34;
  const homeGoals = fixture.home_goals_ev ?? 1.35;
  const awayGoals = fixture.away_goals_ev ?? 1.35;
  const over25 = fixture.over25_pct ?? 0.52;
  const btts = fixture.btts_pct ?? 0.48;
  const cornersEv = fixture.corners_ev ?? 10;
  const homeCornersEv = fixture.home_corners_ev ?? 5;
  const awayCornersEv = fixture.away_corners_ev ?? 5;
  const yellowsEv = fixture.yellow_cards_ev ?? 4;

  let exactScores: { score: string; pct: number }[] = [];
  try {
    exactScores = JSON.parse(fixture.exact_scores ?? "[]");
  } catch {}

  const kickoff = new Date(fixture.kickoff_utc);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header del partido */}
      <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <div className="text-center mb-2">
          <span className="text-[var(--muted-foreground)] text-xs tracking-[0.25em] uppercase">
            {fixture.stage} ·{" "}
            {kickoff.toLocaleDateString("es-CO", {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Equipos */}
        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="flex-1 text-center">
            <div className="text-2xl md:text-4xl font-bold">
              {fixture.home_name}
            </div>
            <div className="text-[var(--accent)] text-3xl md:text-5xl font-bold mt-2">
              {(homeWin * 100).toFixed(1)}%
            </div>
            <div className="text-[var(--muted-foreground)] text-xs mt-1">
              prob. victoria
            </div>
          </div>

          <div className="text-center shrink-0">
            {fixture.status === "FT" ? (
              <div className="text-4xl font-bold">
                {fixture.home_score} – {fixture.away_score}
              </div>
            ) : (
              <>
                <div className="text-[var(--muted-foreground)] text-lg font-bold">
                  VS
                </div>
                <div className="text-sm text-[var(--muted-foreground)] mt-1">
                  X: {(draw * 100).toFixed(1)}%
                </div>
              </>
            )}
          </div>

          <div className="flex-1 text-center">
            <div className="text-2xl md:text-4xl font-bold">
              {fixture.away_name}
            </div>
            <div className="text-[var(--accent)] text-3xl md:text-5xl font-bold mt-2">
              {(awayWin * 100).toFixed(1)}%
            </div>
            <div className="text-[var(--muted-foreground)] text-xs mt-1">
              prob. victoria
            </div>
          </div>
        </div>

        {/* Barra 1X2 */}
        <div className="mt-6">
          <ProbBar homeWin={homeWin} draw={draw} awayWin={awayWin} />
        </div>
      </section>

      {/* Grid de mercados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Goles esperados */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-4">
          <h3 className="text-[var(--muted-foreground)] text-xs tracking-[0.25em] uppercase">
            GOLES ESPERADOS (xG)
          </h3>
          <div className="flex justify-between items-end">
            <div className="text-center">
              <div className="text-4xl font-bold text-[var(--accent)]">
                {homeGoals.toFixed(2)}
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">
                {fixture.home_name}
              </div>
            </div>
            <div className="text-[var(--muted-foreground)] text-xl">+</div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[var(--accent)]">
                {awayGoals.toFixed(2)}
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">
                {fixture.away_name}
              </div>
            </div>
            <div className="text-[var(--muted-foreground)] text-xl">=</div>
            <div className="text-center">
              <div className="text-4xl font-bold">
                {(homeGoals + awayGoals).toFixed(2)}
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">
                TOTAL
              </div>
            </div>
          </div>
        </div>

        {/* Over/Under y BTTS */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-4">
          <h3 className="text-[var(--muted-foreground)] text-xs tracking-[0.25em] uppercase">
            MERCADOS DE GOLES
          </h3>
          <div className="space-y-3">
            <StatBar label="Over 2.5" value={over25 * 100} max={100} highlight />
            <StatBar label="Under 2.5" value={(1 - over25) * 100} max={100} />
            <StatBar label="Ambos marcan (BTTS)" value={btts * 100} max={100} highlight />
            <StatBar label="No BTTS" value={(1 - btts) * 100} max={100} />
          </div>
        </div>

        {/* Marcador exacto */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-4">
          <h3 className="text-[var(--muted-foreground)] text-xs tracking-[0.25em] uppercase">
            MARCADORES MÁS PROBABLES
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {exactScores.slice(0, 6).map((es, i) => (
              <div
                key={es.score}
                className={`flex items-center justify-between p-2 rounded-lg border ${
                  i === 0
                    ? "border-[var(--accent)] bg-[rgba(0,212,255,0.05)]"
                    : "border-[var(--border)]"
                }`}
              >
                <span
                  className={`font-bold text-sm ${
                    i === 0 ? "text-[var(--accent)]" : ""
                  }`}
                >
                  {es.score}
                </span>
                <span className="text-[var(--muted-foreground)] text-xs">
                  {(es.pct * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Corners y tarjetas */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-4">
          <h3 className="text-[var(--muted-foreground)] text-xs tracking-[0.25em] uppercase">
            CORNERS Y TARJETAS
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-xs text-[var(--muted-foreground)]">
                  CORNERS TOTAL
                </span>
                <span className="text-[var(--accent)] font-bold text-lg">
                  {cornersEv.toFixed(1)}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-[var(--muted-foreground)]">
                <span>
                  {fixture.home_name}: {homeCornersEv.toFixed(1)}
                </span>
                <span>
                  {fixture.away_name}: {awayCornersEv.toFixed(1)}
                </span>
              </div>
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <div className="flex justify-between">
                <span className="text-xs text-[var(--muted-foreground)]">
                  TARJETAS AMARILLAS
                </span>
                <span className="text-yellow-400 font-bold text-lg">
                  {yellowsEv.toFixed(1)}
                </span>
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">
                Promedio esperado en el partido
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico interactivo de distribución */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-[var(--muted-foreground)] text-xs tracking-[0.25em] uppercase mb-4">
          DISTRIBUCIÓN DE GOLES (Poisson)
        </h3>
        <MatchCharts
          homeGoalsEv={homeGoals}
          awayGoalsEv={awayGoals}
          homeName={fixture.home_name}
          awayName={fixture.away_name}
        />
      </div>

      {/* ── Panel de análisis polla ── */}
      {fixture.status !== "FT" && (
        (() => {
          const rec = buildRecommendation(
            fixture.home_name, fixture.away_name,
            homeWin, draw, awayWin,
            over25, exactScores, homeGoals, awayGoals,
          );
          const ccol = confidenceColor(rec.confidence);
          return (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden"
                 style={{ borderLeftWidth: "3px", borderLeftColor: ccol }}>
              {/* Título */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)]">
                <span className="text-xs tracking-[0.25em] text-[var(--muted-foreground)] uppercase">
                  MI RECOMENDACIÓN — ANÁLISIS POLLA
                </span>
                <span
                  className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border"
                  style={{ color: ccol, borderColor: ccol }}
                >
                  CONFIANZA {rec.confidence}
                </span>
              </div>

              {/* Recomendación 1X2 destacada */}
              <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
                <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Resultado sugerido</div>
                <div className="flex gap-3">
                  {[
                    { key: "1", label: fixture.home_name, val: homeWin },
                    { key: "X", label: "Empate",           val: draw    },
                    { key: "2", label: fixture.away_name,  val: awayWin },
                  ].map(({ key, label, val }) => {
                    const isRec = key === rec.pick;
                    return (
                      <div
                        key={key}
                        className="flex-1 rounded-lg border p-3 text-center transition-colors"
                        style={isRec ? { borderColor: ccol, background: `${ccol}12` } : {}}
                      >
                        <div className="text-xs text-[var(--muted-foreground)] mb-1 truncate">{label}</div>
                        <div className="text-2xl font-bold" style={isRec ? { color: ccol } : {}}>
                          {key}
                        </div>
                        <div className="text-sm font-medium mt-1" style={isRec ? { color: ccol } : {}}>
                          {fmtPct(val)}
                        </div>
                        {isRec && (
                          <div className="text-[9px] tracking-widest mt-1" style={{ color: ccol }}>
                            ★ ELEGIR
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid: marcadores + mercados */}
              <div className="grid grid-cols-2 divide-x divide-[var(--border)] border-b border-[var(--border)]">
                {/* Top 3 marcadores */}
                <div className="px-5 py-4 space-y-3">
                  <div className="text-[10px] tracking-[0.2em] text-[var(--muted-foreground)] uppercase">Top 3 marcadores</div>
                  {exactScores.slice(0, 3).map((s, i) => (
                    <div key={s.score} className="flex items-center gap-3">
                      <span className={`font-mono text-sm font-bold w-10 ${i === 0 ? "" : "text-[var(--muted-foreground)]"}`}
                            style={i === 0 ? { color: ccol } : {}}>
                        {s.score}
                      </span>
                      <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(s.pct / (exactScores[0]?.pct ?? 0.25)) * 100}%`,
                            background: i === 0 ? ccol : "var(--muted-foreground)",
                            opacity: i === 0 ? 0.9 : 0.4,
                          }}
                        />
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)] w-10 text-right">
                        {fmtPct(s.pct)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Mercados clave */}
                <div className="px-5 py-4 space-y-2">
                  <div className="text-[10px] tracking-[0.2em] text-[var(--muted-foreground)] uppercase">Mercados clave</div>
                  {[
                    { label: "Over 2.5",  val: over25,       highlight: over25 >= 0.5 },
                    { label: "Under 2.5", val: 1 - over25,   highlight: over25 < 0.5  },
                    { label: "BTTS Sí",   val: btts,         highlight: btts >= 0.5   },
                  ].map(({ label, val, highlight }) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className={highlight ? "font-medium" : "text-[var(--muted-foreground)]"}>{label}</span>
                      <span className="font-bold tabular-nums" style={highlight ? { color: ccol } : { color: "var(--muted-foreground)" }}>
                        {fmtPct(val)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-[var(--border)] pt-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--muted-foreground)]">Corners esp.</span>
                      <span className="font-bold tabular-nums" style={{ color: ccol }}>{cornersEv.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--muted-foreground)]">Amarillas esp.</span>
                      <span className="font-bold tabular-nums text-yellow-400">{yellowsEv.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Razonamiento */}
              <div className="px-5 py-4">
                <p className="text-sm text-[var(--foreground)] leading-relaxed">
                  {rec.reasoning}
                </p>
              </div>
            </div>
          );
        })()
      )}

      {/* Metadata */}
      {fixture.generated_at && (
        <p className="text-center text-[var(--muted-foreground)] text-xs">
          Predicción generada:{" "}
          {new Date(fixture.generated_at).toLocaleString("es-CO")} · Modelo
          Poisson bivariado
        </p>
      )}

      {/* Disclaimer */}
      <div className="text-center border-t border-[var(--border)] pt-4">
        <p className="text-[var(--muted-foreground)] text-xs">
          Análisis estadístico de entretenimiento. No es asesoría de apuestas.
        </p>
      </div>
    </div>
  );
}
