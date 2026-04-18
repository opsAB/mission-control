import { NextRequest } from 'next/server';
import { ensureInit } from '@/lib/init';
import { getDb } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { createAlert } from '@/lib/alerts';
import { requireAgentAuth } from '@/lib/agent-auth';

// POST /api/agent/status
// Body: { agent_id, task_id?, dispatch_id?, status, summary?, allow_no_artifact?, no_artifact_reason? }
//
// Enforcement: when status='done' on a dispatch, at least one artifact MUST be
// linked to that dispatch_id. On violation we return HTTP 409 and raise an
// alert-severity alert to Alex so silent completions are surfaced loudly.
// `failed` always raises an alert so Alex learns when work couldn't be done.
export async function POST(req: NextRequest) {
  const authFail = requireAgentAuth(req);
  if (authFail) return authFail;
  ensureInit();
  const body = await req.json();
  const {
    agent_id,
    task_id,
    dispatch_id,
    status,
    summary = '',
    allow_no_artifact = false,
    no_artifact_reason = '',
  } = body;
  if (!agent_id || !status) {
    return Response.json({ error: 'agent_id and status required' }, { status: 400 });
  }

  const db = getDb();

  if (dispatch_id && status === 'done') {
    const { n } = db.prepare('SELECT COUNT(*) as n FROM artifacts WHERE dispatch_id = ?').get(dispatch_id) as { n: number };

    if (n === 0 && !allow_no_artifact) {
      const dispatch = db.prepare('SELECT id, title FROM mc_dispatched_tasks WHERE id = ?').get(dispatch_id) as
        | { id: number; title: string } | undefined;
      const subjectTitle = dispatch?.title ?? `dispatch #${dispatch_id}`;
      await createAlert({
        severity: 'alert',
        title: `Silent-done blocked: ${subjectTitle}`,
        body:
          `Agent "${agent_id}" tried to mark this done with no deliverable. ` +
          `Summary given: "${summary || '(none)'}". The dispatch was NOT marked done.`,
        agent_id: 'mc',
        entity_type: 'dispatch',
        entity_id: String(dispatch_id),
        telegram_payload: {
          kind: 'silent_done_blocked',
          headline: 'Silent-done blocked',
          sections: [
            {
              text:
                `${agent_id === 'main' ? 'Alfred' : agent_id} tried to mark *${subjectTitle}* done with nothing delivered. ` +
                `It's still open — not marked done.`,
            },
            ...(summary
              ? [{ label: 'What the agent said', text: `"${summary}"` }]
              : []),
          ],
          action_hint: 'Open MC → Dispatch to decide: retry, reassign, or handle yourself.',
        },
      });
      return Response.json(
        {
          error: 'artifact_required',
          message: `Cannot mark dispatch ${dispatch_id} done without an artifact. Register the deliverable via /api/agent/artifact first (include dispatch_id: ${dispatch_id}), or resend with allow_no_artifact: true and a non-empty no_artifact_reason, or use status=failed if the work couldn't be completed.`,
        },
        { status: 409 }
      );
    }

    if (n === 0 && allow_no_artifact) {
      if (!no_artifact_reason || !no_artifact_reason.trim()) {
        return Response.json(
          { error: 'no_artifact_reason_required', message: 'allow_no_artifact=true requires a non-empty no_artifact_reason.' },
          { status: 400 }
        );
      }
      db.prepare(`
        INSERT INTO agent_notes (agent_id, entity_type, entity_id, note)
        VALUES (?, 'dispatch', ?, ?)
      `).run(agent_id, String(dispatch_id), `[no artifact] ${no_artifact_reason}`);
    }
  }

  if (dispatch_id) {
    db.prepare(`
      UPDATE mc_dispatched_tasks
      SET status = ?, updated_at = datetime('now'),
          picked_up_at = CASE WHEN picked_up_at IS NULL AND ? IN ('picked_up','in_progress') THEN datetime('now') ELSE picked_up_at END,
          completed_at = CASE WHEN ? IN ('done','failed') THEN datetime('now') ELSE completed_at END,
          openclaw_task_id = COALESCE(?, openclaw_task_id)
      WHERE id = ?
    `).run(status, status, status, task_id ?? null, dispatch_id);
    broadcast('dispatch_updated', { id: dispatch_id, status, assignee_agent_id: agent_id });

    if (status === 'failed') {
      const dispatch = db.prepare('SELECT id, title FROM mc_dispatched_tasks WHERE id = ?').get(dispatch_id) as
        | { id: number; title: string } | undefined;
      const subjectTitle = dispatch?.title ?? `dispatch #${dispatch_id}`;
      const prettyAgent = agent_id === 'main' ? 'Alfred' : agent_id;
      await createAlert({
        severity: 'alert',
        title: `Task failed: ${subjectTitle}`,
        body: `${prettyAgent} could not complete this. Reason: "${summary || '(no reason given)'}".`,
        agent_id,
        entity_type: 'dispatch',
        entity_id: String(dispatch_id),
        telegram_payload: {
          kind: 'dispatch_failed',
          headline: 'Task failed',
          sections: [
            { text: `${prettyAgent} couldn't complete *${subjectTitle}*.` },
            { label: 'Reason', text: summary || '(no reason given)' },
          ],
          action_hint: 'Open MC → Dispatch to retry, reassign, or handle yourself.',
        },
      });
    }
  }

  db.prepare(`
    INSERT INTO mc_activity (entity_type, entity_id, action, summary, agent_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(dispatch_id ? 'dispatch' : 'task', String(dispatch_id ?? task_id ?? ''), status, summary, agent_id);

  broadcast('activity_new', { agent_id, status, summary });
  return Response.json({ ok: true });
}
