import { NextRequest } from 'next/server';
import { ensureInit } from '@/lib/init';
import { getDb } from '@/lib/db';
import { broadcast } from '@/lib/events';

// POST /api/agent/status
// Body: { agent_id, task_id?, dispatch_id?, status, summary? }
// Agents report progress on tasks. If task_id references an MC-dispatched task, we update its status.
// We also append an activity entry so the feed shows what's happening.
export async function POST(req: NextRequest) {
  ensureInit();
  const { agent_id, task_id, dispatch_id, status, summary = '' } = await req.json();
  if (!agent_id || !status) {
    return Response.json({ error: 'agent_id and status required' }, { status: 400 });
  }

  if (dispatch_id) {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    getDb().prepare(`
      UPDATE mc_dispatched_tasks
      SET status = ?, updated_at = datetime('now'),
          picked_up_at = CASE WHEN picked_up_at IS NULL AND ? IN ('picked_up','in_progress') THEN datetime('now') ELSE picked_up_at END,
          completed_at = CASE WHEN ? IN ('done','failed') THEN datetime('now') ELSE completed_at END,
          openclaw_task_id = COALESCE(?, openclaw_task_id)
      WHERE id = ?
    `).run(status, status, status, task_id ?? null, dispatch_id);
    broadcast('dispatch_updated', { id: dispatch_id, status });
    void now;
  }

  getDb().prepare(`
    INSERT INTO mc_activity (entity_type, entity_id, action, summary, agent_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(dispatch_id ? 'dispatch' : 'task', String(dispatch_id ?? task_id ?? ''), status, summary, agent_id);

  broadcast('activity_new', { agent_id, status, summary });
  return Response.json({ ok: true });
}
