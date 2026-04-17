import { getDb } from './db';
import { ensureInit } from './init';

export interface Note {
  id: number;
  agent_id: string;
  entity_type: string;
  entity_id: string;
  note: string;
  created_at: string;
}

export function getNotesForTask(taskId: string): Note[] {
  ensureInit();
  return getDb().prepare(`
    SELECT * FROM agent_notes WHERE entity_type = 'task' AND entity_id = ? ORDER BY created_at DESC
  `).all(taskId) as Note[];
}

export function getNotesByEntity(entityType: string, entityId: string): Note[] {
  ensureInit();
  return getDb().prepare(`
    SELECT * FROM agent_notes WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC
  `).all(entityType, entityId) as Note[];
}

export function getRecentNotes(limit: number = 20): Note[] {
  ensureInit();
  return getDb().prepare('SELECT * FROM agent_notes ORDER BY created_at DESC LIMIT ?').all(limit) as Note[];
}

export function getNoteCountByTaskIds(taskIds: string[]): Map<string, number> {
  ensureInit();
  if (taskIds.length === 0) return new Map();
  const placeholders = taskIds.map(() => '?').join(',');
  const rows = getDb().prepare(`
    SELECT entity_id, COUNT(*) as c FROM agent_notes
    WHERE entity_type = 'task' AND entity_id IN (${placeholders})
    GROUP BY entity_id
  `).all(...taskIds) as Array<{ entity_id: string; c: number }>;
  return new Map(rows.map(r => [r.entity_id, r.c]));
}
