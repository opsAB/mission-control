import { NextRequest } from 'next/server';
import { ensureInit } from '@/lib/init';
import { triageAlert } from '@/lib/alerts';
import { requireAgentAuth } from '@/lib/agent-auth';

// POST /api/alerts/:id/triage
// Body: { decision: 'escalated' | 'acked', triaged_by: string, note?: string }
//
// Alfred (or another agent) decides whether to escalate a specialist's alert
// to Alex (via Telegram) or to acknowledge and close it without bothering him.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authFail = requireAgentAuth(req);
  if (authFail) return authFail;
  ensureInit();
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    return Response.json({ error: 'invalid_id' }, { status: 400 });
  }
  const { decision, triaged_by, note } = await req.json();
  if (decision !== 'escalated' && decision !== 'acked') {
    return Response.json({ error: 'decision must be "escalated" or "acked"' }, { status: 400 });
  }
  if (!triaged_by || typeof triaged_by !== 'string') {
    return Response.json({ error: 'triaged_by required' }, { status: 400 });
  }
  const result = await triageAlert(id, decision, triaged_by, note);
  if (!result.ok) {
    return Response.json(result, { status: result.error === 'alert_not_found' ? 404 : 409 });
  }
  return Response.json(result);
}
