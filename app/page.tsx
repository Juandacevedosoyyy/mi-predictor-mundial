import Link from "next/link";
import { getDb } from "@/lib/db/schema";
import { predictMatch } from "@/lib/model/poisson";
import { simulateTournament } from "@/lib/model/poisson";

interface Team {
  id: number;
  name: string;
  short_name: string | null;
  logo: string | null;
}

interface ChampionOdds {
  id: number;
  name: string;
  championPct: number;
}

async function getHomeData(): Promise<{
  champions: ChampionOdds[];
  nextFixtures: Array<{
    id: number;
    home: Team;
    away: Team;
    kickoff_utc: string;
    stage: string;
    homeWinPct: number;
    drawPct: number;
    awayWinPct: number;
    homeGoalsEv: number;
    awayGoalsEv: number;
  }>;
}> {
  try {
    const db = getDb();

    const teams = db.prepare("SELECT * FROM teams").all() as Team[];
    const defaultStats = {
      goalsFor: 1.35,
      goalsAgainst: 1.35,
      cornersFor: 5,
      cornersAgainst: 5,
      yellowCards: 2,
    };

    const teamsWithStats = teams.slice(0, 32).map((t) => ({
      id: t.id,
      name: t.name,
      stats: defaultStats,
    }));

    const champions =
      teamsWithStats.length > 0
        ? simulateTournament(teamsWithStats, [], 5000)
        : DEMO_CHAMPIONS;

    const fixtures = db
      .prepare(
        `SELECT f.*,
          th.id as h_id, th.name as h_name, th.short_name as h_short, th.logo as h_logo,
          ta.id as a_id, ta.name as a_name, ta.short_name as a_short, ta.logo as a_logo
         FROM fixtures f
         JOIN teams th ON th.id = f.home_id
         JOIN teams ta ON ta.id = f.away_id
         WHERE f.status = 'NS'
         ORDER BY f.kickoff_utc ASC LIMIT 6`
      )
      .all() as Array<Record<string, unknown>>;

    const nextFixtures = fixtures.map((f) => {
      const pred = predictMatch(defaultStats, defaultStats);
      return {
        id: f.id as number,
        home: { id: f.h_id as number, name: f.h_name as string, short_name: f.h_short as string | null, logo: f.h_logo as string | null },
        away: { id: f.a_id as number, name: f.a_name as string, short_name: f.a_short as string | null, logo: f.a_logo as string | null },
        kickoff_utc: f.kickoff_utc as string,
        stage: f.stage as string,
        homeWinPct: pred.homeWinPct,
        drawPct: pred.drawPct,
        awayWinPct: pred.awayWinPct,
        homeGoalsEv: pred.homeGoalsEv,
        awayGoalsEv: pred.awayGoalsEv,
      };
    });

    return {
      champions: champions.slice(0, 8),
      nextFixtures: nextFixtures.length > 0 ? nextFixtures : DEMO_FIXTURES,
    };
  } catch {
    return { champions: DEMO_CHAMPIONS, nextFixtures: DEMO_FIXTURES };
  }
}

// Datos de demo para cuando aún no hay DB poblada
const DEMO_CHAMPIONS: ChampionOdds[] = [
  { id: 1, name: "Francia", championPct: 0.158 },
  { id: 2, name: "Brasil", championPct: 0.142 },
  { id: 3, name: "España", championPct: 0.131 },
  { id: 4, name: "Argentina", championPct: 0.118 },
  { id: 5, name: "Inglaterra", championPct: 0.097 },
  { id: 6, name: "Alemania", championPct: 0.089 },
  { id: 7, name: "Portugal", championPct: 0.074 },
  { id: 8, name: "Países Bajos", championPct: 0.061 },
];

const DEMO_FIXTURES = [
  {
    id: 1001,
    home: { id: 1, name: "México", short_name: "MEX", logo: null },
    away: { id: 2, name: "Polonia", short_name: "POL", logo: null },
    kickoff_utc: "2026-06-11T18:00:00Z",
    stage: "Group Stage",
    homeWinPct: 0.42,
    drawPct: 0.28,
    awayWinPct: 0.30,
    homeGoalsEv: 1.51,
    awayGoalsEv: 1.19,
  },
];

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function Home() {
  const { champions, nextFixtures } = await getHomeData();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      {/* Hero */}
      <section className="text-center space-y-2 py-6">
        <p className="text-[var(--muted-foreground)] text-xs tracking-[0.3em] uppercase">
          Modelo Poisson · Actualización diaria
        </p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          <span className="text-[var(--accent)]">PROYECCIÓN</span>
          <br />
          MUNDIAL 2026
        </h1>
        <p className="text-[var(--muted-foreground)] text-sm max-w-md mx-auto">
          Análisis estadístico de entretenimiento basado en distribución de
          Poisson y datos históricos
        </p>
      </section>

      {/* Proyección Campeón */}
      <section>
        <h2 className="text-xs tracking-[0.25em] text-[var(--muted-foreground)] uppercase mb-4">
          PROYECCIÓN CAMPEÓN
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {champions.map((team, i) => (
            <div
              key={team.id}
              className="relative bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 overflow-hidden"
            >
              {i === 0 && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--accent)]" />
              )}
              <div className="flex items-start justify-between mb-2">
                <span className="text-[var(--muted-foreground)] text-xs">
                  #{i + 1}
                </span>
                {i === 0 && (
                  <span className="text-[8px] tracking-widest text-[var(--accent)] uppercase">
                    FAVORITO
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-[var(--accent)]">
                {pct(team.championPct)}
              </div>
              <div className="text-sm font-medium mt-1">{team.name}</div>
              {/* Barra de probabilidad */}
              <div className="mt-3 h-1 bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full"
                  style={{
                    width: `${(team.championPct / champions[0].championPct) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Próximos Partidos */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs tracking-[0.25em] text-[var(--muted-foreground)] uppercase">
            PRÓXIMOS PARTIDOS
          </h2>
          <Link
            href="/grupos"
            className="text-[var(--accent)] text-xs hover:underline"
          >
            Ver todos →
          </Link>
        </div>
        <div className="grid gap-3">
          {nextFixtures.map((f) => (
            <Link key={f.id} href={`/partido/${f.id}`}>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--accent)] transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  {/* Equipo local */}
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{f.home.name}</div>
                    <div className="text-[var(--accent)] text-lg font-bold">
                      {pct(f.homeWinPct)}
                    </div>
                    <div className="text-[var(--muted-foreground)] text-xs">
                      {f.homeGoalsEv.toFixed(2)} goles xG
                    </div>
                  </div>

                  {/* Centro */}
                  <div className="text-center px-4">
                    <div className="text-[var(--muted-foreground)] text-xs tracking-wider uppercase mb-1">
                      {f.stage.replace("Group Stage - ", "Grupo ")}
                    </div>
                    <div className="text-xl font-bold text-[var(--muted-foreground)]">
                      VS
                    </div>
                    <div className="text-[var(--muted-foreground)] text-xs mt-1">
                      X: {pct(f.drawPct)}
                    </div>
                  </div>

                  {/* Equipo visitante */}
                  <div className="flex-1 text-right">
                    <div className="font-semibold text-sm">{f.away.name}</div>
                    <div className="text-[var(--accent)] text-lg font-bold">
                      {pct(f.awayWinPct)}
                    </div>
                    <div className="text-[var(--muted-foreground)] text-xs">
                      {f.awayGoalsEv.toFixed(2)} goles xG
                    </div>
                  </div>
                </div>

                {/* Barra 1X2 */}
                <div className="mt-4 flex h-2 rounded-full overflow-hidden gap-px">
                  <div
                    className="bg-[var(--accent)] opacity-90"
                    style={{ width: pct(f.homeWinPct) }}
                  />
                  <div
                    className="bg-[var(--muted)]"
                    style={{ width: pct(f.drawPct) }}
                  />
                  <div
                    className="bg-[var(--accent)] opacity-50"
                    style={{ width: pct(f.awayWinPct) }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <footer className="border-t border-[var(--border)] pt-6 text-center">
        <p className="text-[var(--muted-foreground)] text-xs max-w-lg mx-auto">
          Análisis estadístico de entretenimiento. No es asesoría de apuestas.
          Las probabilidades se basan en modelos matemáticos y datos históricos,
          no garantizan resultados futuros.
        </p>
      </footer>
    </div>
  );
}
