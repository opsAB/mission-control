import { getRecentActivity } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20), 1), 100);
  return Response.json({ activity: getRecentActivity(limit) });
}
