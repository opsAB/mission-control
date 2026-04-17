import { NextRequest } from 'next/server';
import { ensureInit } from '@/lib/init';
import { getDb } from '@/lib/db';
import { broadcast } from '@/lib/events';

// GET /api/agent/dispatch?agent_id=main
// Agent polls this on heartbeat. Returns any queued tasks assigned to that agent.
// POST /api/agent/dispatch
// Agent marks a dispatched task as picked_up (same as status endpoint but specific).
export async function GET(req: NextRequest) {
  ensureInit();
  const agent_id = new URL(req.url).searchParams.get('agent_id');
  if (!agent_id) return Response.json({ error: 'agent_id required' }, { status: 400 });

  const rows = getDb().prepare(`
    SELECT id, title, description, assignee_agent_id, priority, project_id, status, created_at
    FROM mc_dispatched_tasks
    WHERE assignee_agent_id = ? AND status = 'queued'
    ORDER BY
      CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      created_at ASC
  `).all(agent_id);

  return Response.json({ tasks: rows });
}

export async function POST(req: NextRequest) {
  ensureInit();
  const { dispatch_id, agent_id, openclaw_task_id } = await req.json();
  if (!dispatch_id || !agent_id) {
    return Response.json({ error: 'dispatch_id and agent_id required' }, { status: 400 });
  }
  getDb().prepare(`
    UPDATE mc_dispatched_tasks
    SET status = 'picked_up', picked_up_at = datetime('now'),
        openclaw_task_id = COALESCE(?, openclaw_task_id), updated_at = datetime('now')
    WHERE id = ? AND assignee_agent_id = ? AND status = 'queued'
  `).run(openclaw_task_id ?? null, dispatch_id, agent_id);
  broadcast('dispatch_updated', { id: dispatch_id, status: 'picked_up' });
  return Response.json({ ok: true });
}
