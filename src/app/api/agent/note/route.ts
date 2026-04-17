import { NextRequest } from 'next/server';
import { ensureInit } from '@/lib/init';
import { getDb } from '@/lib/db';
import { broadcast } from '@/lib/events';

// POST /api/agent/note
// Body: { agent_id, entity_type, entity_id, note }
// Agents attach a note to a task or flow. Appears in the task detail view and activity feed.
export async function POST(req: NextRequest) {
  ensureInit();
  const { agent_id, entity_type, entity_id, note } = await req.json();
  if (!agent_id || !entity_type || !entity_id || !note) {
    return Response.json({ error: 'agent_id, entity_type, entity_id, note required' }, { status: 400 });
  }
  const result = getDb().prepare(`
    INSERT INTO agent_notes (agent_id, entity_type, entity_id, note) VALUES (?, ?, ?, ?)
  `).run(agent_id, entity_type, entity_id, note);
  const id = Number(result.lastInsertRowid);
  getDb().prepare(`
    INSERT INTO mc_activity (entity_type, entity_id, action, summary, agent_id) VALUES (?, ?, 'note', ?, ?)
  `).run(entity_type, entity_id, note.slice(0, 140), agent_id);
  broadcast('note_new', { id, agent_id, entity_type, entity_id });
  broadcast('activity_new', { agent_id, note });
  return Response.json({ ok: true, id });
}
