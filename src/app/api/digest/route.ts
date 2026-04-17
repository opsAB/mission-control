import { runDigest, buildDigest } from '@/lib/digest';
import { getDb } from '@/lib/db';
import { ensureInit } from '@/lib/init';

export async function GET() {
  ensureInit();
  const body = await buildDigest();
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export async function POST() {
  const result = await runDigest();
  return Response.json(result);
}

export async function PUT() {
  ensureInit();
  const rows = getDb().prepare('SELECT id, digest_date, delivered_via, delivered_at, created_at FROM digests ORDER BY created_at DESC LIMIT 30').all();
  return Response.json({ digests: rows });
}
