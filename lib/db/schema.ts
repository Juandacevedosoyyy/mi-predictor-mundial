import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
}

export async function initSchema(): Promise<void> {
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      short_name TEXT,
      logo       TEXT,
      group_code TEXT,
      country    TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS players (
      id       SERIAL PRIMARY KEY,
      team_id  INTEGER REFERENCES teams(id),
      name     TEXT NOT NULL,
      position TEXT,
      number   INTEGER
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS fixtures (
      id          INTEGER PRIMARY KEY,
      home_id     INTEGER REFERENCES teams(id),
      away_id     INTEGER REFERENCES teams(id),
      kickoff_utc TEXT,
      stage       TEXT,
      group_code  TEXT,
      venue       TEXT,
      status      TEXT DEFAULT 'NS',
      home_score  INTEGER,
      away_score  INTEGER
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS match_stats (
      id              SERIAL PRIMARY KEY,
      fixture_id      INTEGER REFERENCES fixtures(id),
      team_id         INTEGER REFERENCES teams(id),
      shots           INTEGER,
      shots_on_target INTEGER,
      possession      INTEGER,
      corners         INTEGER,
      fouls           INTEGER,
      yellow_cards    INTEGER,
      red_cards       INTEGER
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS match_events (
      id         SERIAL PRIMARY KEY,
      fixture_id INTEGER REFERENCES fixtures(id),
      team_id    INTEGER REFERENCES teams(id),
      player_id  INTEGER REFERENCES players(id),
      type       TEXT,
      minute     INTEGER
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS predictions (
      id               SERIAL PRIMARY KEY,
      fixture_id       INTEGER REFERENCES fixtures(id),
      generated_at     TEXT NOT NULL,
      home_win_pct     REAL,
      draw_pct         REAL,
      away_win_pct     REAL,
      home_goals_ev    REAL,
      away_goals_ev    REAL,
      over25_pct       REAL,
      btts_pct         REAL,
      exact_scores     TEXT,
      top_scorers      TEXT,
      corners_ev       REAL,
      yellow_cards_ev  REAL,
      home_corners_ev  REAL,
      away_corners_ev  REAL
    )
  `;
}
