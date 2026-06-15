import Link from "next/link";
import { getDb } from "@/lib/db/schema";
import { buildRecommendation, confidenceColor, pct } from "@/lib/analysis";

export const dynamic = "force-dynamic";

interface FixtureRow {
  id: number;
  kickoff_utc: string;
  stage: string;
  group_code: string | null;
  home_name: string;
  away_name: string;
  home_win_pct: number;
  draw_pct: number;
  away_win_pct: number;
  home_goals_ev: number;
  away_goals_ev: number;
  over25_pct: number;
  btts_pct: number;
  exact_scores: string;
  corners_ev: number;
  home_corners_ev: number;
  away_corners_ev: number;
  yellow_cards_ev: number;
}

interface PageProps {
  searchParams: Promise<{ g?: string }>;
}

function getFixtures(grupo?: string): FixtureRow[] {
  const db = getDb();
  const where = grupo
    ? `f.group_code = '${grupo.toUpperCase()}'`
    : `f.status = 'NS'`;

  return db.prepare(`
    SELECT
      f.id, f.kickoff_utc, f.stage, f.group_code,
      th.name AS home_name, ta.name AS away_name,
      p.home_win_pct, p.draw_pct, p.away_win_pct,
      p.home_goals_ev, p.away_goals_ev,
      p.over25_pct, p.btts_pct, p.exact_scores,
      p.corners_ev, p.home_corners_ev, p.away_corners_ev,
      p.yellow_cards_ev
    FROM fixtures f
    JOIN teams th ON th.id = f.home_id
    JOIN teams ta ON ta.id = f.away_id
    INNER JOIN (
      SELECT * FROM predictions
      WHERE id IN (SELECT MAX(id) FROM predictions GROUP BY fixture_id)
    ) p ON p.fixture_id = f.id
    WHERE ${where}
    ORDER BY f.kickoff_utc ASC
  `).all() as FixtureRow[];
}

function getAllGroupCodes(): string[] {
  const db = getDb();
  return (db.prepare(
    `SELECT DISTINCT group_code FROM fixtures WHERE group_code IS NOT NULL ORDER BY group_code`
  ).all() as { group_code: string }[]).map((r) => r.group_code);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// ── Barra de probabilidad horizontal ───────────────────────────────────────
function ProbBar({ val, max = 1, accent = false }: { val: number; max?: number; accent?: boolean }) {
  const w = Math.min(100, (val / max) * 100);
  return (
    <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden w-full">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${w}%`,
          background: accent ? "var(--accent)" : "var(--muted-foreground)",
          opacity: accent ? 0.9 : 0.5,
        }}
      />
    </div>
  );
}

// ── Card de análisis completo ───────────────────────────────────────────────
function MatchCard({ f }: { f: FixtureRow }) {
  const scores: { score: string; pct: number }[] = JSON.parse(f.exact_scores ?? "[]");
  const rec = buildRecommendation(
    f.home_name, f.away_name,
    f.home_win_pct, f.draw_pct, f.away_win_pct,
    f.over25_pct, scores, f.home_goals_ev, f.away_goals_ev
  );
  const ccol = confidenceColor(rec.confidence);
  const goalsEv = f.home_goals_ev + f.away_goals_ev;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-[var(--accent)] text-xs font-bold tracking-widest uppercase">
            {f.stage}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[var(--muted-foreground)] text-xs">{formatDate(f.kickoff_utc)}</span>
          <Link
            href={`/partido/${f.id}`}
            className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors"
          >
            Ver partido →
          </Link>
        </div>
      </div>

      {/* Equipos */}
      <div className="grid grid-cols-3 items-center px-5 py-4 border-b border-[var(--border)]">
        <div>
          <div className="text-lg font-bold">{f.home_name}</div>
          <div className="text-[var(--accent)] text-2xl font-bold mt-0.5">{pct(f.home_win_pct)}</div>
          <div className="text-[var(--muted-foreground)] text-xs">{f.home_goals_ev.toFixed(2)} xG</div>
        </div>
        <div className="text-center">
          <div className="text-[var(--muted-foreground)] text-xs tracking-widest">EMPATE</div>
          <div className="text-xl font-bold text-[var(--muted-foreground)] my-0.5">{pct(f.draw_pct)}</div>
          <div className="text-[var(--muted-foreground)] text-xs">{goalsEv.toFixed(1)} xG tot.</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">{f.away_name}</div>
          <div className="text-[var(--accent)] text-2xl font-bold mt-0.5 opacity-70">{pct(f.away_win_pct)}</div>
          <div className="text-[var(--muted-foreground)] text-xs">{f.away_goals_ev.toFixed(2)} xG</div>
        </div>
      </div>

      {/* Barra 1X2 */}
      <div className="px-5 py-2 border-b border-[var(--border)]">
        <div className="flex h-2 rounded-full overflow-hidden gap-px">
          <div className="bg-[var(--accent)] opacity-90 rounded-l-full" style={{ width: pct(f.home_win_pct) }} />
          <div className="bg-[var(--muted-foreground)] opacity-40" style={{ width: pct(f.draw_pct) }} />
          <div className="bg-[var(--accent)] opacity-40 rounded-r-full" style={{ width: pct(f.away_win_pct) }} />
        </div>
      </div>

      {/* Grid análisis: 3 columnas */}
      <div className="grid grid-cols-3 divide-x divide-[var(--border)] border-b border-[var(--border)]">

        {/* Col 1: Marcadores más probables */}
        <div className="px-4 py-3 space-y-2">
          <div className="text-[10px] tracking-widest text-[var(--muted-foreground)] uppercase mb-2">
            Top Marcadores
          </div>
          {scores.slice(0, 3).map((s, i) => (
            <div key={s.score} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-mono font-bold ${i === 0 ? "text-[var(--accent)]" : ""}`}>
                  {s.score}
                </span>
                <span className="text-[var(--muted-foreground)]">{pct(s.pct)}</span>
              </div>
              <ProbBar val={s.pct} max={scores[0]?.pct ?? 0.25} accent={i === 0} />
            </div>
          ))}
        </div>

        {/* Col 2: Over/Under + BTTS */}
        <div className="px-4 py-3 space-y-2">
          <div className="text-[10px] tracking-widest text-[var(--muted-foreground)] uppercase mb-2">
            Mercado Goles
          </div>
          {[
            { label: "Over 2.5",  val: f.over25_pct,       accent: f.over25_pct >= 0.5 },
            { label: "Under 2.5", val: 1 - f.over25_pct,   accent: f.over25_pct < 0.5 },
            { label: "BTTS Sí",   val: f.btts_pct,         accent: f.btts_pct >= 0.5 },
            { label: "BTTS No",   val: 1 - f.btts_pct,     accent: f.btts_pct < 0.5 },
          ].map((row) => (
            <div key={row.label} className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <span className={row.accent ? "text-[var(--foreground)] font-medium" : "text-[var(--muted-foreground)]"}>
                  {row.label}
                </span>
                <span className={row.accent ? "text-[var(--accent)] font-bold" : "text-[var(--muted-foreground)]"}>
                  {pct(row.val)}
                </span>
              </div>
              <ProbBar val={row.val} max={1} accent={row.accent} />
            </div>
          ))}
        </div>

        {/* Col 3: Corners + Amarillas */}
        <div className="px-4 py-3 space-y-3">
          <div className="text-[10px] tracking-widest text-[var(--muted-foreground)] uppercase mb-2">
            Estadísticas
          </div>
          <div>
            <div className="text-[var(--muted-foreground)] text-xs mb-0.5">Corners totales</div>
            <div className="text-2xl font-bold text-[var(--accent)]">{f.corners_ev.toFixed(1)}</div>
            <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
              {f.home_name.split(" ")[0]} {f.home_corners_ev.toFixed(1)} · {f.away_name.split(" ")[0]} {f.away_corners_ev.toFixed(1)}
            </div>
          </div>
          <div className="border-t border-[var(--border)] pt-3">
            <div className="text-[var(--muted-foreground)] text-xs mb-0.5">Amarillas esperadas</div>
            <div className="text-2xl font-bold text-yellow-400">{f.yellow_cards_ev.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Recomendación */}
      <div
        className="px-5 py-4"
        style={{ borderLeft: `3px solid ${ccol}` }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] tracking-widest text-[var(--muted-foreground)] uppercase">
                Recomendación polla
              </span>
              <span
                className="text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded"
                style={{ color: ccol, border: `1px solid ${ccol}`, opacity: 0.9 }}
              >
                {rec.confidence}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-base font-bold" style={{ color: ccol }}>
                {rec.pick} — {rec.pickName.toUpperCase()}
              </span>
              <span className="text-[var(--muted-foreground)] text-xs">·</span>
              <span className="text-sm font-medium">{rec.overUnder}</span>
              <span className="text-[var(--muted-foreground)] text-xs">·</span>
              <span className="text-sm text-[var(--muted-foreground)]">
                Marcador: <span className="font-mono font-bold text-[var(--foreground)]">{rec.topScore}</span>
              </span>
            </div>
          </div>
        </div>
        <p className="text-[var(--muted-foreground)] text-xs mt-2 leading-relaxed">
          {rec.reasoning}
        </p>
      </div>

    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────
export default async function AnalisisPage({ searchParams }: PageProps) {
  const { g } = await searchParams;
  const groupCodes = getAllGroupCodes();
  const fixtures = getFixtures(g);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div>
        <p className="text-[var(--muted-foreground)] text-xs tracking-[0.3em] uppercase mb-1">
          Probabilidades · Modelo Poisson
        </p>
        <h1 className="text-3xl font-bold">
          ANÁLISIS <span className="text-[var(--accent)]">POLLA</span>
        </h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          {g ? `Grupo ${g} · ` : ""}{fixtures.length} partidos con predicción
        </p>
      </div>

      {/* Filtro por grupo */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/analisis"
          className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
            !g
              ? "border-[var(--accent)] text-[var(--accent)] bg-[rgba(0,212,255,0.08)]"
              : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          }`}
        >
          Todos
        </Link>
        {groupCodes.map((code) => (
          <Link
            key={code}
            href={`/analisis?g=${code}`}
            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
              g === code
                ? "border-[var(--accent)] text-[var(--accent)] bg-[rgba(0,212,255,0.08)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            }`}
          >
            {code}
          </Link>
        ))}
      </div>

      {/* Cards */}
      {fixtures.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center">
          <p className="text-[var(--muted-foreground)] text-sm">
            {g
              ? `No hay partidos pendientes en el Grupo ${g}.`
              : "No hay partidos con predicción disponible."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {fixtures.map((f) => (
            <MatchCard key={f.id} f={f} />
          ))}
        </div>
      )}

      <footer className="border-t border-[var(--border)] pt-6 text-center">
        <p className="text-[var(--muted-foreground)] text-xs">
          Análisis estadístico de entretenimiento · Modelo Poisson bivariado · No es asesoría de apuestas
        </p>
      </footer>
    </div>
  );
}
