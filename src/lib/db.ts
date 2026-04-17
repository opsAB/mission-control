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

    CREATE TABLE IF NOT EXISTS task_overlay (
      task_id TEXT PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      review_status TEXT NOT NULL DEFAULT 'none',
      review_note TEXT,
      hidden INTEGER NOT NULL DEFAULT 0,
      starred INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
      project_id INTEGER REFERENCES projects(id),
      agent_id TEXT,
      summary TEXT
    );

    CREATE TABLE IF NOT EXISTS mc_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      agent_id TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Key-value settings store
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Alerts / attention pings from agents to Alex
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      severity TEXT NOT NULL DEFAULT 'info',  -- info | watch | alert
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      agent_id TEXT,
      entity_type TEXT,
      entity_id TEXT,
      read_at TEXT,
      acknowledged_at TEXT,
      telegram_sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Agent notes attached to tasks/flows
    CREATE TABLE IF NOT EXISTS agent_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Tasks that Alex creates in MC and dispatches to agents
    CREATE TABLE IF NOT EXISTS mc_dispatched_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assignee_agent_id TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      project_id INTEGER REFERENCES projects(id),
      status TEXT NOT NULL DEFAULT 'queued',  -- queued | picked_up | in_progress | done | failed
      picked_up_at TEXT,
      completed_at TEXT,
      openclaw_task_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Daily digest history
    CREATE TABLE IF NOT EXISTS digests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      digest_date TEXT NOT NULL,
      body_markdown TEXT NOT NULL,
      delivered_via TEXT,  -- telegram | email | none
      delivered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add missing columns if DB already existed
  const tableInfo = db.prepare("PRAGMA table_info(artifacts)").all() as Array<{ name: string }>;
  const cols = new Set(tableInfo.map(c => c.name));
  if (!cols.has('agent_id')) {
    try { db.exec('ALTER TABLE artifacts ADD COLUMN agent_id TEXT'); } catch {}
  }
  if (!cols.has('summary')) {
    try { db.exec('ALTER TABLE artifacts ADD COLUMN summary TEXT'); } catch {}
  }
  if (!cols.has('review_note')) {
    try { db.exec('ALTER TABLE artifacts ADD COLUMN review_note TEXT'); } catch {}
  }
  if (!cols.has('reviewed_at')) {
    try { db.exec('ALTER TABLE artifacts ADD COLUMN reviewed_at TEXT'); } catch {}
  }
  if (!cols.has('dispatch_id')) {
    try { db.exec('ALTER TABLE artifacts ADD COLUMN dispatch_id INTEGER'); } catch {}
  }
  const actInfo = db.prepare("PRAGMA table_info(mc_activity)").all() as Array<{ name: string }>;
  if (!actInfo.some(c => c.name === 'agent_id')) {
    try { db.exec('ALTER TABLE mc_activity ADD COLUMN agent_id TEXT'); } catch {}
  }

  // Seed default settings
  const defaults: Record<string, string> = {
    mission_statement: '',
    attention_threshold: 'blocked_review_only',  // 'blocked_review_only' | 'plus_thinking' | 'plus_curiosity'
    telegram_enabled: 'true',
    telegram_chat_id: '416658381',
    digest_time: '06:00',
    digest_enabled: 'true',
    only_main_pings: 'true',
  };
  const existing = db.prepare('SELECT key FROM settings').all() as Array<{ key: string }>;
  const have = new Set(existing.map(r => r.key));
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) if (!have.has(k)) ins.run(k, v);
}
