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

    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'idle',
      current_task TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'medium',
      project_id INTEGER REFERENCES projects(id),
      owner TEXT NOT NULL DEFAULT 'Alex',
      executor TEXT NOT NULL DEFAULT 'Alfred',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      artifact_url TEXT
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      owner TEXT NOT NULL DEFAULT 'Alex',
      executor TEXT NOT NULL DEFAULT 'Alfred',
      last_update TEXT NOT NULL DEFAULT (datetime('now')),
      last_meaningful_update TEXT NOT NULL DEFAULT (datetime('now')),
      delivery_status TEXT NOT NULL DEFAULT 'not_started',
      review_status TEXT NOT NULL DEFAULT 'none',
      is_recurring INTEGER NOT NULL DEFAULT 0,
      cron_schedule TEXT,
      last_run TEXT,
      next_run TEXT,
      project_id INTEGER REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'document',
      task_id INTEGER REFERENCES tasks(id),
      workflow_id INTEGER REFERENCES workflows(id),
      file_path TEXT NOT NULL DEFAULT '',
      serve_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      review_status TEXT NOT NULL DEFAULT 'none',
      owner TEXT NOT NULL DEFAULT 'Alfred',
      project_id INTEGER REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS coding_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      agent_id INTEGER REFERENCES agents(id),
      status TEXT NOT NULL DEFAULT 'queued',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      last_checkpoint TEXT,
      context_length INTEGER NOT NULL DEFAULT 0,
      parent_run_id INTEGER REFERENCES coding_runs(id),
      summary TEXT NOT NULL DEFAULT '',
      project_id INTEGER REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
