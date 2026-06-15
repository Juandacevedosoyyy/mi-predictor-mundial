const APISPORTS_KEY = process.env.APISPORTS_KEY ?? "";
const BASE_URL = "https://v3.football.api-sports.io";
const FALLBACK_BASE = "https://api.football-data.org/v4";
const FALLBACK_KEY = process.env.FOOTBALL_DATA_KEY ?? "";

const WORLD_CUP_2026_ID = 1; // actualizar cuando API-Football publique el ID oficial

async function apiFetch(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: {
          "x-apisports-key": APISPORTS_KEY,
        },
        next: { revalidate: 3600 },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
}

export async function fetchFixtures(season = 2026) {
  return apiFetch("/fixtures", {
    league: String(WORLD_CUP_2026_ID),
    season: String(season),
  });
}

export async function fetchTeams(season = 2026) {
  return apiFetch("/teams", {
    league: String(WORLD_CUP_2026_ID),
    season: String(season),
  });
}

export async function fetchPlayers(teamId: number, season = 2026) {
  return apiFetch("/players", {
    team: String(teamId),
    season: String(season),
  });
}

export async function fetchFixtureStats(fixtureId: number) {
  return apiFetch("/fixtures/statistics", { fixture: String(fixtureId) });
}

export async function fetchFixtureEvents(fixtureId: number) {
  return apiFetch("/fixtures/events", { fixture: String(fixtureId) });
}

/** Fallback: football-data.org (no RapidAPI rate limits) */
export async function fetchFallbackStandings() {
  const res = await fetch(`${FALLBACK_BASE}/competitions/WC/standings`, {
    headers: { "X-Auth-Token": FALLBACK_KEY },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Fallback HTTP ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}
