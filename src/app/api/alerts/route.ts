import { NextRequest } from 'next/server';
import { markAllRead } from '@/lib/alerts';
import { broadcast } from '@/lib/events';

export async function PATCH(req: NextRequest) {
  const { action } = await req.json();
  if (action === 'read_all') {
    markAllRead();
    broadcast('alert_updated', { all_read: true });
    return Response.json({ ok: true });
  }
  return Response.json({ error: 'unknown action' }, { status: 400 });
}
