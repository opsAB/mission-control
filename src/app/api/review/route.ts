import { NextRequest } from 'next/server';
import { setTaskReview, updateArtifactReview, getArtifactById } from '@/lib/queries';
import { getDb } from '@/lib/db';
import { ensureInit } from '@/lib/init';
import { broadcast } from '@/lib/events';
import { triggerAgent } from '@/lib/trigger';

export async function PATCH(request: NextRequest) {
  ensureInit();
  const body = await request.json();
  const { type, id, review_status, note } = body;
  if (!type || !id || !review_status) {
    return Response.json({ error: 'Missing type, id, or review_status' }, { status: 400 });
  }

  if (review_status === 'revision_requested' && !note?.trim()) {
    return Response.json({ error: 'A note describing the requested revision is required.' }, { status: 400 });
  }

  if (type === 'task') {
    setTaskReview(id, review_status, note);
    broadcast('task_review', { id, review_status });
  } else if (type === 'artifact') {
    const artifact = getArtifactById(Number(id));
    if (!artifact) {
      return Response.json({ error: 'artifact not found' }, { status: 404 });
    }
    updateArtifactReview(Number(id), review_status, note);
    broadcast('artifact_review', { id, review_status });

    // On revision requested, dispatch a follow-up task back to the owning agent
    // so it shows up in their queue on next heartbeat, and wake Alfred so it happens now.
    if (review_status === 'revision_requested' && artifact.agent_id) {
      const dispatchTitle = `Revise: ${artifact.title}`;
      const dispatchDesc = [
        `Alex requested a revision to artifact #${artifact.id} ("${artifact.title}").`,
        ``,
        `Requested changes:`,
        note,
        ``,
        `Original artifact: ${artifact.serve_url || artifact.file_path}`,
        artifact.summary ? `\nPrior summary: ${artifact.summary}` : '',
        ``,
        `When done, register the revised file as a NEW artifact (include dispatch_id for this revision) and mark this dispatch done.`,
      ].join('\n');
      const result = getDb().prepare(`
        INSERT INTO mc_dispatched_tasks (title, description, assignee_agent_id, priority, project_id)
        VALUES (?, ?, ?, 'high', ?)
      `).run(dispatchTitle, dispatchDesc, artifact.agent_id, artifact.project_id ?? null);
      const dispatchId = Number(result.lastInsertRowid);
      broadcast('dispatch_new', { id: dispatchId, assignee_agent_id: artifact.agent_id });

      // Wake Alfred to route the revision to the specialist right away.
      const wakePrompt = `Alex requested a revision on Mission Control artifact #${artifact.id} ("${artifact.title}"). A new dispatch (#${dispatchId}) has been queued for ${artifact.agent_id}. Run \`mc.sh poll ${artifact.agent_id}\` (or delegate to them), have them produce the revised deliverable, register it as a new artifact with dispatch_id ${dispatchId}, and mark the dispatch done. Revision notes from Alex: "${note.replace(/"/g, '\\"')}"`;
      triggerAgent('main', wakePrompt);
    }
  } else {
    return Response.json({ error: `Unsupported type: ${type}` }, { status: 400 });
  }

  return Response.json({ ok: true });
}
