import Link from "next/link";
import { getDb } from "@/lib/db/schema";
import { computeGroupStandings, getAllGroupCodes, type Standing } from "@/lib/db/standings";

interface Fixture {
  id: number;
  home_name: string;
  away_name: string;
  kickoff_utc: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  group_code: string | null;
  home_win_pct: number | null;
  draw_pct: number | null;
  away_win_pct: number | null;
  home_goals_ev: number | null;
  away_goals_ev: number | null;
}

interface GroupData {
  code: string;
  standings: Standing[];
  fixtures: Fixture[];
}

const GRUPOS_DEMO: GroupData[] = "ABCDEFGH".split("").map((code) => ({
  code,
  standings: [],
  fixtures: [],
}));

function pct(n: number | null) {
  if (n == null) return "–";
  return `${(n * 100).toFixed(0)}%`;
}

async function getGroupsData(): Promise<GroupData[]> {
  try {
    const db = getDb();
    const groupCodes = getAllGroupCodes();
    if (groupCodes.length === 0) return GRUPOS_DEMO;

    const fixtures = db.prepare(`
      SELECT f.id, f.kickoff_utc, f.status, f.home_score, f.away_score, f.group_code,
        th.name as home_name, ta.name as away_name,
        p.home_win_pct, p.draw_pct, p.away_win_pct,
        p.home_goals_ev, p.away_goals_ev
      FROM fixtures f
      JOIN teams th ON th.id = f.home_id
      JOIN teams ta ON ta.id = f.away_id
      LEFT JOIN (
        SELECT fixture_id, home_win_pct, draw_pct, away_win_pct, home_goals_ev, away_goals_ev
        FROM predictions
        WHERE id IN (SELECT MAX(id) FROM predictions GROUP BY fixture_id)
      ) p ON p.fixture_id = f.id
      WHERE f.group_code IS NOT NULL
      ORDER BY f.group_code, f.kickoff_utc
    `).all() as Fixture[];

    const fixturesByGroup = new Map<string, Fixture[]>();
    for (const f of fixtures) {
      const code = f.group_code ?? "?";
      if (!fixturesByGroup.has(code)) fixturesByGroup.set(code, []);
      fixturesByGroup.get(code)!.push(f);
    }

    return groupCodes.map((code) => ({
      code,
      standings: computeGroupStandings(code),
      fixtures: fixturesByGroup.get(code) ?? [],
    }));
  } catch {
    return GRUPOS_DEMO;
  }
}

export default async function GruposPage() {
  const groups = await getGroupsData();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-[var(--muted-foreground)] text-xs tracking-[0.3em] uppercase mb-1">
          Fase de Grupos
        </p>
        <h1 className="text-3xl font-bold">
          TABLA <span className="text-[var(--accent)]">PROYECTADA</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.map((group) => (
          <div
            key={group.code}
            className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="text-[var(--accent)] font-bold tracking-widest">
                GRUPO {group.code}
              </span>
              <span className="text-[var(--muted-foreground)] text-xs">
                {group.fixtures.length} partidos
              </span>
            </div>

            {/* Tabla de posiciones real */}
            {group.standings.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--muted-foreground)] border-b border-[var(--border)]">
                    <th className="text-left px-4 py-2 font-normal">EQUIPO</th>
                    <th className="px-2 py-2 font-normal">PJ</th>
                    <th className="px-2 py-2 font-normal">G</th>
                    <th className="px-2 py-2 font-normal">E</th>
                    <th className="px-2 py-2 font-normal">P</th>
                    <th className="px-2 py-2 font-normal">DG</th>
                    <th className="px-2 py-2 font-normal text-[var(--accent)]">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {group.standings.map((s, i) => (
                    <tr
                      key={s.teamId}
                      className={`border-b border-[var(--border)] last:border-0 ${
                        i < 2 ? "bg-[rgba(0,212,255,0.03)]" : ""
                      }`}
                    >
                      <td className="px-4 py-2 flex items-center gap-2">
                        {i < 2 && (
                          <span className="w-1 h-3 rounded-sm bg-[var(--accent)] inline-block" />
                        )}
                        <span className={i < 2 ? "font-medium" : "text-[var(--muted-foreground)]"}>
                          {s.name}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">{s.pld}</td>
                      <td className="px-2 py-2 text-center">{s.w}</td>
                      <td className="px-2 py-2 text-center">{s.d}</td>
                      <td className="px-2 py-2 text-center">{s.l}</td>
                      <td className="px-2 py-2 text-center text-[var(--muted-foreground)]">
                        {s.gd >= 0 ? "+" : ""}{s.gd}
                      </td>
                      <td className="px-2 py-2 text-center text-[var(--accent)] font-bold">
                        {s.pts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-4 py-3 text-[var(--muted-foreground)] text-xs italic">
                Sin resultados registrados
              </div>
            )}

            {/* Fixtures del grupo */}
            {group.fixtures.length > 0 && (
              <div className="border-t border-[var(--border)]">
                {group.fixtures.map((f) => {
                  const hw = f.home_win_pct;
                  const dr = f.draw_pct;
                  const aw = f.away_win_pct;
                  const hasPred = hw != null && dr != null && aw != null;
                  const isPlayed = f.status === "FT";

                  return (
                    <Link key={f.id} href={`/partido/${f.id}`}>
                      <div className="px-4 py-2.5 hover:bg-[var(--muted)] transition-colors border-b border-[var(--border)] last:border-0 cursor-pointer space-y-1.5">

                        {/* Fila equipos */}
                        <div className="flex items-center gap-2">
                          {/* Local */}
                          <span className={`flex-1 text-xs truncate ${isPlayed && f.home_score! > f.away_score! ? "font-bold" : "text-[var(--muted-foreground)]"}`}>
                            {f.home_name}
                          </span>

                          {/* Centro: marcador o xG */}
                          <div className="text-center shrink-0 min-w-[72px]">
                            {isPlayed ? (
                              <span className="text-sm font-bold tabular-nums">
                                {f.home_score} – {f.away_score}
                              </span>
                            ) : hasPred ? (
                              <span className="text-[10px] text-[var(--muted-foreground)] tabular-nums">
                                {f.home_goals_ev!.toFixed(1)} xG · {f.away_goals_ev!.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[var(--muted-foreground)]">vs</span>
                            )}
                          </div>

                          {/* Visitante */}
                          <span className={`flex-1 text-xs truncate text-right ${isPlayed && f.away_score! > f.home_score! ? "font-bold" : "text-[var(--muted-foreground)]"}`}>
                            {f.away_name}
                          </span>
                        </div>

                        {/* Barra 1X2 + probabilidades (solo partidos sin resultado) */}
                        {!isPlayed && hasPred && (
                          <div className="space-y-1">
                            {/* Números */}
                            <div className="flex justify-between text-[10px] tabular-nums">
                              <span className="text-[var(--accent)] font-medium">{pct(hw)}</span>
                              <span className="text-[var(--muted-foreground)]">X {pct(dr)}</span>
                              <span className="text-[var(--accent)] font-medium opacity-70">{pct(aw)}</span>
                            </div>
                            {/* Barra */}
                            <div className="flex h-1 rounded-full overflow-hidden gap-px">
                              <div className="bg-[var(--accent)] rounded-l-full" style={{ width: pct(hw) }} />
                              <div className="bg-[var(--muted-foreground)] opacity-40" style={{ width: pct(dr) }} />
                              <div className="bg-[var(--accent)] opacity-40 rounded-r-full" style={{ width: pct(aw) }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
