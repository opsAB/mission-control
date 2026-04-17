import { sendTelegram } from '@/lib/telegram';

export async function POST() {
  const ok = await sendTelegram('🛰️ *Mission Control test*\n\nTelegram bridge is working.');
  return Response.json({ ok });
}
