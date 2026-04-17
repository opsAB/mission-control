import { NextRequest } from 'next/server';
import { markAlertRead, acknowledgeAlert } from '@/lib/alerts';
import { broadcast } from '@/lib/events';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action } = await req.json();
  const n = Number(id);
  if (!Number.isFinite(n)) return Response.json({ error: 'bad id' }, { status: 400 });
  if (action === 'read') markAlertRead(n);
  else if (action === 'ack') acknowledgeAlert(n);
  else return Response.json({ error: 'unknown action' }, { status: 400 });
  broadcast('alert_updated', { id: n, action });
  return Response.json({ ok: true });
}
