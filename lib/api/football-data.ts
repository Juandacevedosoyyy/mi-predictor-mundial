const BASE = "https://api.football-data.org/v4";

function key() {
  return process.env.FOOTBALL_DATA_KEY ?? "";
}

async function fdFetch<T>(path: string): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { "X-Auth-Token": key() },
        // Sin cache en Node — queremos datos frescos en el cron
        cache: "no-store",
      });
      if (res.status === 429) {
        // Rate limit: espera más
        await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }
      if (!res.ok) throw new Error(`football-data.org ${res.status} ${res.statusText} — ${path}`);
      return res.json() as Promise<T>;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw new Error("unreachable");
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface FDTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export type FDMatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "LIVE"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "CANCELLED"
  | "POSTPONED"
  | "SUSPENDED";

export interface FDMatch {
  id: number;
  utcDate: string;
  status: FDMatchStatus;
  matchday: number | null;
  stage: string;
  group: string | null; // "GROUP_A", "GROUP_B", … | null en eliminatorias
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: string;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
}

export interface FDTeamsResponse {
  count: number;
  teams: (FDTeam & { group?: string })[];
}

export interface FDMatchesResponse {
  count: number;
  matches: FDMatch[];
}

// ── Endpoints ──────────────────────────────────────────────────────────────

export function fetchWCTeams(): Promise<FDTeamsResponse> {
  return fdFetch<FDTeamsResponse>("/competitions/WC/teams");
}

export function fetchWCMatches(): Promise<FDMatchesResponse> {
  return fdFetch<FDMatchesResponse>("/competitions/WC/matches");
}

// ── Helpers de mapeo ───────────────────────────────────────────────────────

/** "GROUP_A" → "A"  |  null → null */
export function mapGroupCode(group: string | null): string | null {
  if (!group) return null;
  return group.replace(/^GROUP_/, "");
}

/** Estados de football-data.org → nuestro schema */
export function mapStatus(status: FDMatchStatus): string {
  switch (status) {
    case "FINISHED":  return "FT";
    case "IN_PLAY":
    case "LIVE":      return "1H";
    case "PAUSED":    return "HT";
    default:          return "NS"; // SCHEDULED, TIMED, CANCELLED, POSTPONED, SUSPENDED
  }
}

/** Stages de football-data.org → etiqueta legible */
export function mapStage(stage: string, group: string | null): string {
  const g = mapGroupCode(group);
  if (stage === "GROUP_STAGE" && g) return `Group ${g}`;
  const labels: Record<string, string> = {
    LAST_32:        "Round of 32",
    LAST_16:        "Round of 16",
    ROUND_OF_16:    "Round of 16",
    QUARTER_FINALS: "Quarter-finals",
    SEMI_FINALS:    "Semi-finals",
    THIRD_PLACE:    "Third Place",
    FINAL:          "Final",
  };
  return labels[stage] ?? stage;
}
