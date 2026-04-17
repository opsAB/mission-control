import { NextRequest } from 'next/server';
import { ensureInit } from '@/lib/init';
import { getDb } from '@/lib/db';
import { broadcast } from '@/lib/events';

export async function POST(req: NextRequest) {
  ensureInit();
  const { title, description = '', assignee_agent_id, priority = 'medium', project_id = null } = await req.json();
  if (!title || !assignee_agent_id) {
    return Response.json({ error: 'title and assignee_agent_id required' }, { status: 400 });
  }
  const result = getDb().prepare(`
    INSERT INTO mc_dispatched_tasks (title, description, assignee_agent_id, priority, project_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, description, assignee_agent_id, priority, project_id);
  const id = Number(result.lastInsertRowid);
  broadcast('dispatch_new', { id, assignee_agent_id });
  return Response.json({ ok: true, id });
}
