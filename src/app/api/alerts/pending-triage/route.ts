import { NextRequest } from 'next/server';
import { ensureInit } from '@/lib/init';
import { getPendingTriageAlerts } from '@/lib/alerts';
import { requireAgentAuth } from '@/lib/agent-auth';

export const dynamic = 'force-dynamic';

// GET /api/alerts/pending-triage
// Returns specialist-raised alerts waiting for Alfred to decide whether to
// escalate to Alex or ack-and-forget. Called by Alfred when he wakes up.
export async function GET(req: NextRequest) {
  const authFail = requireAgentAuth(req);
  if (authFail) return authFail;
  ensureInit();
  const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get('limit') ?? 50)));
  const alerts = getPendingTriageAlerts(limit);
  return Response.json({
    pending: alerts.map(a => ({
      id: a.id,
      severity: a.severity,
      agent_id: a.agent_id,
      title: a.title,
      body: a.body,
      entity_type: a.entity_type,
      entity_id: a.entity_id,
      created_at: a.created_at,
    })),
    count: alerts.length,
  });
}
