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
  const body = await req.json();
  const { agent_id, task_id, dispatch_id, status, summary = '', allow_no_artifact = false, no_artifact_reason = '' } = body;
  if (!agent_id || !status) {
    return Response.json({ error: 'agent_id and status required' }, { status: 400 });
  }

  if (dispatch_id) {
    // Enforce artifact contract: `done` is rejected unless a deliverable is linked.
    // Agents can send { allow_no_artifact: true, no_artifact_reason: '...' } if the
    // task genuinely has no file output.
    if (status === 'done') {
      const { n } = getDb().prepare(
        'SELECT COUNT(*) as n FROM artifacts WHERE dispatch_id = ?'
      ).get(dispatch_id) as { n: number };
      if (n === 0 && !allow_no_artifact) {
        return Response.json({
          error: 'artifact_required',
          message: `Cannot mark dispatch ${dispatch_id} done without an artifact. Register the deliverable via /api/agent/artifact first (include dispatch_id: ${dispatch_id}), or resend with allow_no_artifact: true and no_artifact_reason explaining why there is no file to deliver.`,
        }, { status: 409 });
      }
      if (n === 0 && allow_no_artifact) {
        getDb().prepare(`
          INSERT INTO agent_notes (agent_id, entity_type, entity_id, note)
          VALUES (?, 'dispatch', ?, ?)
        `).run(agent_id, String(dispatch_id), `[no artifact] ${no_artifact_reason || 'no reason provided'}`);
      }
    }
    getDb().prepare(`
      UPDATE mc_dispatched_tasks
      SET status = ?, updated_at = datetime('now'),
          picked_up_at = CASE WHEN picked_up_at IS NULL AND ? IN ('picked_up','in_progress') THEN datetime('now') ELSE picked_up_at END,
          completed_at = CASE WHEN ? IN ('done','failed') THEN datetime('now') ELSE completed_at END,
          openclaw_task_id = COALESCE(?, openclaw_task_id)
      WHERE id = ?
    `).run(status, status, status, task_id ?? null, dispatch_id);
    broadcast('dispatch_updated', { id: dispatch_id, status });
  }

  getDb().prepare(`
    INSERT INTO mc_activity (entity_type, entity_id, action, summary, agent_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(dispatch_id ? 'dispatch' : 'task', String(dispatch_id ?? task_id ?? ''), status, summary, agent_id);

  broadcast('activity_new', { agent_id, status, summary });
  return Response.json({ ok: true });
}
