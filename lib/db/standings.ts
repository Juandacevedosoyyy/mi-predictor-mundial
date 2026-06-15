import { getDb } from "./schema";

export interface Standing {
  teamId: number;
  name: string;
  pld: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

export function computeGroupStandings(groupCode: string): Standing[] {
  const db = getDb();

  const teams = db.prepare(`
    SELECT DISTINCT t.id, t.name
    FROM fixtures f
    JOIN teams t ON t.id = f.home_id OR t.id = f.away_id
    WHERE f.group_code = ?
    ORDER BY t.name
  `).all(groupCode) as { id: number; name: string }[];

  const map = new Map<number, Standing>();
  for (const t of teams) {
    map.set(t.id, { teamId: t.id, name: t.name, pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 });
  }

  const played = db.prepare(`
    SELECT home_id, away_id, home_score, away_score
    FROM fixtures
    WHERE group_code = ? AND status = 'FT' AND home_score IS NOT NULL
  `).all(groupCode) as Array<{ home_id: number; away_id: number; home_score: number; away_score: number }>;

  for (const f of played) {
    const home = map.get(f.home_id);
    const away = map.get(f.away_id);
    if (!home || !away) continue;

    home.pld++; away.pld++;
    home.gf += f.home_score; home.ga += f.away_score;
    away.gf += f.away_score; away.ga += f.home_score;

    if (f.home_score > f.away_score) {
      home.w++; home.pts += 3; away.l++;
    } else if (f.home_score < f.away_score) {
      away.w++; away.pts += 3; home.l++;
    } else {
      home.d++; home.pts++; away.d++; away.pts++;
    }
  }

  return Array.from(map.values())
    .map((s) => ({ ...s, gd: s.gf - s.ga }))
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name);
    });
}

export function getAllGroupCodes(): string[] {
  try {
    const db = getDb();
    return (db.prepare(`
      SELECT DISTINCT group_code FROM fixtures
      WHERE group_code IS NOT NULL
      ORDER BY group_code
    `).all() as { group_code: string }[]).map((r) => r.group_code);
  } catch {
    return [];
  }
}
