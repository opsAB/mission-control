import { getDb } from './db';

export function seedIfEmpty() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number };
  if (count.c > 0) return;

  // Real projects only — no fake tasks/workflows, those come from OpenClaw
  db.prepare(`INSERT INTO projects (name, description, color) VALUES (?, ?, ?)`).run('Mission Control', 'AI agent command center', '#6366f1');
  db.prepare(`INSERT INTO projects (name, description, color) VALUES (?, ?, ?)`).run('Five Fifteen', 'Fort Lauderdale/Miami private members club', '#f59e0b');
  db.prepare(`INSERT INTO projects (name, description, color) VALUES (?, ?, ?)`).run('Personal Ops', 'Personal operations and automation', '#10b981');
  db.prepare(`INSERT INTO projects (name, description, color) VALUES (?, ?, ?)`).run('Health Dashboard', 'Personal health tracking app', '#ef4444');
  db.prepare(`INSERT INTO projects (name, description, color) VALUES (?, ?, ?)`).run('Research', 'General research and exploration', '#8b5cf6');
}
