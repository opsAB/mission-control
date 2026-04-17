import { getDb } from './db';

export function seedIfEmpty() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number };
  if (count.c === 0) {
    // Fresh install — seed the three core categories. Agents self-categorize
    // on each artifact; unknown names auto-create new category rows.
    db.prepare(`INSERT INTO projects (name, description, color) VALUES (?, ?, ?)`).run('Personal', 'Personal life, admin, relationships', '#10b981');
    db.prepare(`INSERT INTO projects (name, description, color) VALUES (?, ?, ?)`).run('Health', 'Health tracking, diet, fitness, medical', '#ef4444');
    db.prepare(`INSERT INTO projects (name, description, color) VALUES (?, ?, ?)`).run('Five Fifteen', 'Fort Lauderdale/Miami private members club', '#f59e0b');
    return;
  }

  // Existing installs: rename legacy categories in place so the three core
  // labels (Personal, Health, Five Fifteen) are what Alex sees, without
  // losing tagged tasks/artifacts that reference the old rows.
  const renames: Array<[string, string]> = [
    ['Personal Ops', 'Personal'],
    ['Health Dashboard', 'Health'],
  ];
  for (const [from, to] of renames) {
    db.prepare('UPDATE projects SET name = ? WHERE name = ?').run(to, from);
  }
}

// Find or create a category by name. Used when agents self-categorize
// an artifact via the `category` field.
export function resolveCategoryId(name: string | null | undefined): number | null {
  if (!name || !name.trim()) return null;
  const db = getDb();
  const trimmed = name.trim();
  const existing = db.prepare('SELECT id FROM projects WHERE lower(name) = lower(?)').get(trimmed) as { id: number } | undefined;
  if (existing) return existing.id;

  // Rotate through a palette for auto-created categories so they're
  // visually distinguishable on the list.
  const palette = ['#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#84cc16', '#6366f1'];
  const color = palette[Math.floor(Math.random() * palette.length)];
  const result = db.prepare('INSERT INTO projects (name, description, color) VALUES (?, ?, ?)')
    .run(trimmed, 'Auto-created from agent artifact', color);
  return Number(result.lastInsertRowid);
}
