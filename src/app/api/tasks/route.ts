import { NextRequest } from 'next/server';
import { updateTaskStatus, getAllTasks } from '@/lib/queries';

export async function GET() {
  const tasks = getAllTasks();
  return Response.json(tasks);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, status } = body;
  if (!id || !status) {
    return Response.json({ error: 'Missing id or status' }, { status: 400 });
  }
  updateTaskStatus(id, status);
  return Response.json({ ok: true });
}
