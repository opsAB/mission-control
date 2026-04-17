import { NextRequest } from 'next/server';
import { setTaskProject, getAllMcTasks } from '@/lib/queries';
import { autoTagAllUnassigned } from '@/lib/auto-project';
import { broadcast } from '@/lib/events';

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.mode === 'auto') {
    const tasks = getAllMcTasks({ limit: 1000 }).map(t => ({ task_id: t.task_id, agent_id: t.agent_id }));
    const tagged = autoTagAllUnassigned(tasks);
    broadcast('task_updated', { autoTagged: tagged });
    return Response.json({ ok: true, tagged });
  }
  const { task_id, project_id } = body;
  if (!task_id) return Response.json({ error: 'task_id required' }, { status: 400 });
  setTaskProject(task_id, project_id ?? null);
  broadcast('task_updated', { task_id });
  return Response.json({ ok: true });
}
