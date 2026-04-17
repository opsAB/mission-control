import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'mission-control.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#6366f1'
    );

    -- MC overlay on OpenClaw tasks: project assignment, review state, notes
    CREATE TABLE IF NOT EXISTS task_overlay (
      task_id TEXT PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      review_status TEXT NOT NULL DEFAULT 'none',
      review_note TEXT,
      hidden INTEGER NOT NULL DEFAULT 0,
      starred INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- MC overlay on OpenClaw flows
    CREATE TABLE IF NOT EXISTS flow_overlay (
      flow_id TEXT PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      review_status TEXT NOT NULL DEFAULT 'none',
      review_note TEXT,
      hidden INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'document',
      task_id TEXT,
      flow_id TEXT,
      file_path TEXT NOT NULL DEFAULT '',
      serve_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      review_status TEXT NOT NULL DEFAULT 'none',
      owner TEXT NOT NULL DEFAULT '',
      project_id INTEGER REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS mc_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
