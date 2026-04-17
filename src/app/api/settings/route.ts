import { NextRequest } from 'next/server';
import { getSettings, updateSettings } from '@/lib/settings';
import { broadcast } from '@/lib/events';

export async function GET() {
  return Response.json(getSettings());
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  updateSettings(body);
  broadcast('settings_changed', {});
  return Response.json({ ok: true });
}
