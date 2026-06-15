import { getDb } from "@/lib/db/schema";
import { computeGroupStandings, getAllGroupCodes } from "@/lib/db/standings";
import ResultForm from "./ResultForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface FixtureRow {
  id: number;
  home_id: number;
  away_id: number;
  home_name: string;
  away_name: string;
  kickoff_utc: string;
  stage: string;
  group_code: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
}

async function getAdminData() {
  try {
    const sql = getDb();

    const fixtures = await sql`
      SELECT f.id, f.home_id, f.away_id, f.kickoff_utc, f.stage, f.group_code,
             f.status, f.home_score, f.away_score,
             th.name as home_name, ta.name as away_name
      FROM fixtures f
      JOIN teams th ON th.id = f.home_id
      JOIN teams ta ON ta.id = f.away_id
      ORDER BY f.group_code NULLS LAST, f.kickoff_utc ASC
    ` as FixtureRow[];

    const groupCodes = await getAllGroupCodes();

    return { fixtures, groupCodes, empty: fixtures.length === 0 };
  } catch {
    return { fixtures: [], groupCodes: [], empty: true };
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "FT") {
    return (
      <span className="text-[10px] tracking-widest px-1.5 py-0.5 rounded bg-[rgba(0,212,255,0.1)] text-[var(--accent)] border border-[var(--accent)] border-opacity-30">
        FT
      </span>
    );
  }
  if (status === "1H" || status === "2H" || status === "HT") {
    return (
      <span className="text-[10px] tracking-widest px-1.5 py-0.5 rounded bg-[rgba(255,68,68,0.1)] text-[var(--destructive)] border border-[var(--destructive)] border-opacity-30">
        EN VIVO
      </span>
    );
  }
  return (
    <span className="text-[10px] tracking-widest px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
      NS
    </span>
  );
}

async function StandingsTable({ groupCode }: { groupCode: string }) {
  const standings = await computeGroupStandings(groupCode);
  if (standings.length === 0) return null;

  return (
    <table className="w-full text-xs mb-1">
      <thead>
        <tr className="text-[var(--muted-foreground)]">
          <th className="text-left py-1 font-normal pl-2 w-6">#</th>
          <th className="text-left py-1 font-normal">EQUIPO</th>
          <th className="py-1 font-normal w-8 text-center">PJ</th>
          <th className="py-1 font-normal w-8 text-center">G</th>
          <th className="py-1 font-normal w-8 text-center">E</th>
          <th className="py-1 font-normal w-8 text-center">P</th>
          <th className="py-1 font-normal w-10 text-center">GF</th>
          <th className="py-1 font-normal w-10 text-center">GA</th>
          <th className="py-1 font-normal w-10 text-center">DG</th>
          <th className="py-1 font-normal w-10 text-center text-[var(--accent)]">PTS</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s, i) => (
          <tr
            key={s.teamId}
            className={`border-t border-[var(--border)] ${i < 2 ? "bg-[rgba(0,212,255,0.03)]" : ""}`}
          >
            <td className="py-1.5 pl-2 text-[var(--muted-foreground)]">{i + 1}</td>
            <td className="py-1.5 flex items-center gap-1.5">
              {i < 2 && <span className="w-1 h-3 rounded-sm bg-[var(--accent)] inline-block shrink-0" />}
              <span className={i < 2 ? "font-medium" : "text-[var(--muted-foreground)]"}>{s.name}</span>
            </td>
            <td className="py-1.5 text-center">{s.pld}</td>
            <td className="py-1.5 text-center">{s.w}</td>
            <td className="py-1.5 text-center">{s.d}</td>
            <td className="py-1.5 text-center">{s.l}</td>
            <td className="py-1.5 text-center">{s.gf}</td>
            <td className="py-1.5 text-center">{s.ga}</td>
            <td className="py-1.5 text-center text-[var(--muted-foreground)]">
              {s.gd >= 0 ? "+" : ""}{s.gd}
            </td>
            <td className="py-1.5 text-center text-[var(--accent)] font-bold">{s.pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function AdminPage() {
  const { fixtures, groupCodes, empty } = await getAdminData();

  const byGroup = new Map<string, FixtureRow[]>();
  const knockout: FixtureRow[] = [];

  for (const f of fixtures) {
    if (f.group_code) {
      if (!byGroup.has(f.group_code)) byGroup.set(f.group_code, []);
      byGroup.get(f.group_code)!.push(f);
    } else {
      knockout.push(f);
    }
  }

  const played = fixtures.filter((f) => f.status === "FT").length;
  const total = fixtures.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[var(--muted-foreground)] text-xs tracking-[0.3em] uppercase mb-1">
            Panel de control
          </p>
          <h1 className="text-3xl font-bold">
            ADMIN <span className="text-[var(--accent)]">RESULTADOS</span>
          </h1>
          {total > 0 && (
            <p className="text-[var(--muted-foreground)] text-sm mt-1">
              {played} / {total} partidos registrados
            </p>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <Link
            href="/"
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            ← Volver al dashboard
          </Link>
          <a
            href="/api/cron"
            className="px-4 py-2 rounded border border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            Sync desde API
          </a>
        </div>
      </div>

      {/* Empty state */}
      {empty && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center space-y-3">
          <p className="text-[var(--muted-foreground)] text-sm">
            No hay fixtures en la base de datos.
          </p>
          <p className="text-[var(--muted-foreground)] text-xs">
            Configura <code className="text-[var(--accent)]">FOOTBALL_DATA_KEY</code> y usa el botón{" "}
            <strong>Sync desde API</strong> para poblar los datos.
          </p>
        </div>
      )}

      {/* Progreso visual */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
            <span>Progreso del torneo</span>
            <span>{Math.round((played / total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
              style={{ width: `${(played / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Grupos */}
      {Array.from(byGroup.entries()).map(([code, groupFixtures]) => (
        <section key={code}>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-[var(--accent)] font-bold tracking-widest text-sm">
              GRUPO {code}
            </h2>
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-[var(--muted-foreground)] text-xs">
              {groupFixtures.filter((f) => f.status === "FT").length}/{groupFixtures.length} jugados
            </span>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
            {/* Standings */}
            <div className="px-4 pt-3 pb-2 border-b border-[var(--border)]">
              <StandingsTable groupCode={code} />
            </div>

            {/* Fixtures */}
            <div className="divide-y divide-[var(--border)]">
              {groupFixtures.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted)] transition-colors"
                >
                  <span className="text-[var(--muted-foreground)] text-[11px] w-24 shrink-0">
                    {formatDate(f.kickoff_utc)}
                  </span>

                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      className={`text-sm text-right flex-1 truncate ${
                        f.status === "FT" && f.home_score !== null && f.away_score !== null && f.home_score > f.away_score
                          ? "font-bold text-[var(--foreground)]"
                          : "text-[var(--muted-foreground)]"
                      }`}
                    >
                      {f.home_name}
                    </span>

                    <ResultForm
                      fixtureId={f.id}
                      currentHome={f.home_score}
                      currentAway={f.away_score}
                      status={f.status}
                    />

                    <span
                      className={`text-sm text-left flex-1 truncate ${
                        f.status === "FT" && f.home_score !== null && f.away_score !== null && f.away_score > f.home_score
                          ? "font-bold text-[var(--foreground)]"
                          : "text-[var(--muted-foreground)]"
                      }`}
                    >
                      {f.away_name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={f.status} />
                    <Link
                      href={`/partido/${f.id}`}
                      className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors"
                      title="Ver predicción"
                    >
                      →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Eliminatorias */}
      {knockout.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-[var(--accent)] font-bold tracking-widest text-sm">
              FASE ELIMINATORIA
            </h2>
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-[var(--muted-foreground)] text-xs">
              {knockout.filter((f) => f.status === "FT").length}/{knockout.length} jugados
            </span>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)]">
            {knockout.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted)] transition-colors"
              >
                <span className="text-[var(--muted-foreground)] text-[11px] w-24 shrink-0">
                  {formatDate(f.kickoff_utc)}
                </span>
                <span className="text-[var(--muted-foreground)] text-[10px] w-20 shrink-0 truncate">
                  {f.stage}
                </span>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm text-right flex-1 truncate text-[var(--muted-foreground)]">
                    {f.home_name}
                  </span>
                  <ResultForm
                    fixtureId={f.id}
                    currentHome={f.home_score}
                    currentAway={f.away_score}
                    status={f.status}
                  />
                  <span className="text-sm text-left flex-1 truncate text-[var(--muted-foreground)]">
                    {f.away_name}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={f.status} />
                  <Link
                    href={`/partido/${f.id}`}
                    className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors"
                  >
                    →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
