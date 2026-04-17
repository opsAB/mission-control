import { getMcTask } from '@/lib/queries';
import { getNotesForTask } from '@/lib/notes';
import { ensureInit } from '@/lib/init';
import { getDb } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const task = getMcTask(taskId);
  if (!task) return Response.json({ error: 'not found' }, { status: 404 });
  ensureInit();
  const notes = getNotesForTask(taskId);
  const artifacts = getDb().prepare('SELECT id, title, type, serve_url, created_at FROM artifacts WHERE task_id = ? ORDER BY created_at DESC').all(taskId);
  return Response.json({ task, notes, artifacts });
}
