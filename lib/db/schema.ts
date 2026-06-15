import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "mundial.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const { mkdirSync } = require("fs");
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      short_name TEXT,
      logo       TEXT,
      group_code TEXT,
      country    TEXT
    );

    CREATE TABLE IF NOT EXISTS players (
      id      INTEGER PRIMARY KEY,
      team_id INTEGER REFERENCES teams(id),
      name    TEXT NOT NULL,
      position TEXT,
      number  INTEGER
    );

    CREATE TABLE IF NOT EXISTS fixtures (
      id          INTEGER PRIMARY KEY,
      home_id     INTEGER REFERENCES teams(id),
      away_id     INTEGER REFERENCES teams(id),
      kickoff_utc TEXT,
      stage       TEXT,  -- 'group' | 'r16' | 'qf' | 'sf' | 'final'
      group_code  TEXT,
      venue       TEXT,
      status      TEXT DEFAULT 'NS', -- NS | 1H | HT | 2H | FT
      home_score  INTEGER,
      away_score  INTEGER
    );

    CREATE TABLE IF NOT EXISTS match_stats (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_id INTEGER REFERENCES fixtures(id),
      team_id    INTEGER REFERENCES teams(id),
      shots      INTEGER,
      shots_on_target INTEGER,
      possession INTEGER,
      corners    INTEGER,
      fouls      INTEGER,
      yellow_cards INTEGER,
      red_cards  INTEGER
    );

    CREATE TABLE IF NOT EXISTS match_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_id INTEGER REFERENCES fixtures(id),
      team_id    INTEGER REFERENCES teams(id),
      player_id  INTEGER REFERENCES players(id),
      type       TEXT,  -- 'goal' | 'yellow' | 'red' | 'subst'
      minute     INTEGER
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_id       INTEGER REFERENCES fixtures(id),
      generated_at     TEXT NOT NULL,
      home_win_pct     REAL,
      draw_pct         REAL,
      away_win_pct     REAL,
      home_goals_ev    REAL,
      away_goals_ev    REAL,
      over25_pct       REAL,
      btts_pct         REAL,
      exact_scores     TEXT, -- JSON: [{score: "2-1", pct: 0.12}, ...]
      top_scorers      TEXT, -- JSON: [{player_id, name, goals_ev}, ...]
      corners_ev       REAL,
      yellow_cards_ev  REAL,
      home_corners_ev  REAL,
      away_corners_ev  REAL
    );
  `);
}
