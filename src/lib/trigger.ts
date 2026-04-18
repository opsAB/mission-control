// Trigger an OpenClaw agent turn from MC.
// Uses the `openclaw agent` CLI command to wake an agent immediately rather
// than waiting for its heartbeat.

import { exec } from 'child_process';
import { getPendingTriageAlerts } from './alerts';

export interface TriggerResult {
  ok: boolean;
  started: boolean;
  error?: string;
}

// When waking Alfred specifically, prepend any pending specialist alerts
// so he can triage them as part of his run. The alerts API is still the
// authoritative source — this just surfaces them early so he doesn't need
// to remember to poll for them.
function augmentPromptForMain(message: string): string {
  try {
    const pending = getPendingTriageAlerts(10);
    if (pending.length === 0) return message;
    const lines = ['', '', '— Pending triage (specialist pings waiting for your call) —'];
    for (const a of pending) {
      lines.push(`  #${a.id} [${a.severity}] from ${a.agent_id}: ${a.title}` + (a.body ? ` — ${a.body.slice(0, 140)}` : ''));
    }
    lines.push('');
    lines.push('For each: decide whether to escalate to Alex or ack without bothering him.');
    lines.push('  Escalate (sends Telegram):  POST /api/alerts/<id>/triage { "decision": "escalated", "triaged_by": "main", "note": "<why>" }');
    lines.push('  Ack (close silently):       POST /api/alerts/<id>/triage { "decision": "acked",      "triaged_by": "main", "note": "<why>" }');
    lines.push('Use the same Authorization: Bearer $MC_AGENT_TOKEN header as other /api/agent/* calls.');
    return message + lines.join('\n');
  } catch {
    return message;
  }
}

export function triggerAgent(agentId: string, message: string): TriggerResult {
  // Basic safety: agent_id must be alphanumeric-ish; message gets single-quoted.
  if (!/^[a-zA-Z0-9_-]+$/.test(agentId)) {
    return { ok: false, started: false, error: 'Invalid agent_id' };
  }
  const effectiveMessage = agentId === 'main' ? augmentPromptForMain(message) : message;
  // Escape single quotes for shell single-quoted string: ' -> '\''
  const escaped = effectiveMessage.replace(/'/g, "'\\''");
  const cmd = `openclaw agent --agent ${agentId} --message '${escaped}' --json`;

  // Fire and forget — don't block the HTTP response while Alfred runs.
  const child = exec(cmd, { timeout: 600000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error('[trigger] openclaw agent failed:', err.message, stderr.slice(0, 500));
    } else {
      console.log('[trigger] openclaw agent completed for', agentId, '- stdout length:', stdout.length);
    }
  });
  child.unref();

  return { ok: true, started: true };
}

export const PROCESS_QUEUE_PROMPT = `Check Mission Control's dispatch queue and process all waiting tasks immediately. Run \`mc.sh poll main\`, then \`mc.sh poll james\`, \`mc.sh poll milo\`, \`mc.sh poll lewis\`, \`mc.sh poll contractor\`. For each returned task, run this sequence — and do NOT split it across turns.

1. **Claim:** \`mc.sh pickup <dispatch_id> <agent_id>\`
2. **Do the actual work and produce the deliverable file.** This is the whole job. No status pings, no narration, no "I will now write X" messages. Just do it.
3. **Register the artifact:** \`mc.sh artifact <agent_id> "<title>" <type> <filepath> --dispatch-id <id> --summary "<summary>"\`. The \`--dispatch-id\` flag is REQUIRED.
4. **Mark done:** \`mc.sh status <agent_id> done "<summary>" --dispatch-id <id>\`

**Hard rule — DO NOT send \`status in_progress\` and then stop.** Historically you've done this: claimed a task, sent an "in_progress: Writing X" ping, then ended your turn without ever writing anything. That leaves the dispatch stranded until Mission Control auto-fails it 12 hours later. If you send \`in_progress\`, you MUST follow with an artifact + done (or a failed) in the same turn. Better: skip in_progress entirely for tasks short enough to finish in one turn. Only use in_progress if the task genuinely needs multiple turns (rare).

**Rules — enforced server-side. Violating them breaks trust with Alex.**

- **Never silent-complete.** MC REJECTS \`status done\` (HTTP 409 \`artifact_required\`) on any dispatch with no artifact linked to its dispatch_id. If you hit that error, you either forgot the artifact or shouldn't be marking it done.
- **Specialists must actually run.** If a dispatch is assigned to james/milo/lewis/contractor, you (main) MUST spawn the specialist sub-agent before the claim+work+artifact sequence. Don't claim on their behalf from your own session — that's a lie to the system. The specialist's OpenClaw task_run must exist for MC to trust the status updates.
- **If you cannot do the work, mark it FAILED — not done.** Use \`mc.sh status <agent_id> failed "<why>" --dispatch-id <id>\`. This automatically raises a loud alert to Alex on Telegram so he knows to take over. Mark failed when: you lack credentials, you need a GUI browser / desktop app, the task needs tools you don't have, the target system is unreachable, or you reviewed it and genuinely can't execute safely.
- **Known capability gaps — do NOT attempt, mark FAILED with a clear reason:**
  - Logging into web apps that need interactive credentials (E-Trade, banks, brokerages, anything behind SSO/MFA).
  - Anything requiring a GUI browser or desktop app not scriptable headlessly.
  - Trading, moving money, or sending payments from Alex's accounts.
  - Sending outbound messages as Alex (email, DMs) unless the dispatch explicitly authorizes it.
- **Genuinely-no-file exceptions** (confirmation checks, read-only status lookups): \`mc.sh status <agent_id> done "<summary>" --dispatch-id <id> --allow-no-artifact --no-artifact-reason "<why>"\`. Don't abuse this — if you produced any written output, it belongs in an artifact.
- **Delegating to a specialist:** use the specialist's agent_id on BOTH the artifact and the status call (not \`main\`).

Follow the rules in ~/mission-control/AGENTS.md exactly. Do this now, don't wait for heartbeat.`;
