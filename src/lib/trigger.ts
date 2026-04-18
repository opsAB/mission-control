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

export const PROCESS_QUEUE_PROMPT = `Check Mission Control's dispatch queue and process all waiting tasks immediately. Run \`mc.sh poll main\`, then \`mc.sh poll james\`, \`mc.sh poll milo\`, \`mc.sh poll lewis\`, \`mc.sh poll contractor\`. For each returned task:

1. Claim it: \`mc.sh pickup <dispatch_id> <agent_id>\`
2. If assigned to you (main), handle it yourself. If assigned to a specialist, spawn/delegate via your sub-agent pattern.
3. In-progress update: \`mc.sh status <agent_id> in_progress "<summary>" --dispatch-id <id>\`
4. Actually do the work and produce a real deliverable file.
5. Register the artifact BEFORE marking done: \`mc.sh artifact <agent_id> "<title>" <type> <filepath> --dispatch-id <id> --summary "<summary>"\`. The \`--dispatch-id\` flag is REQUIRED — without it the next step is rejected.
6. Mark done: \`mc.sh status <agent_id> done "<summary>" --dispatch-id <id>\`

**Rules — enforced server-side. Violating them breaks trust with Alex.**

- **Never silent-complete.** MC REJECTS \`status done\` (HTTP 409 \`artifact_required\`) on any dispatch with no artifact linked to its dispatch_id. If you hit that error, you either forgot the artifact or shouldn't be marking it done.
- **If you cannot do the work, mark it FAILED — not done.** Use \`mc.sh status <agent_id> failed "<why>" --dispatch-id <id>\`. This automatically raises a loud alert to Alex on Telegram so he knows to take over. Mark failed when: you lack credentials, you need a GUI browser / desktop app, the task needs tools you don't have, the target system is unreachable, or you reviewed it and genuinely can't execute safely.
- **Known capability gaps — do NOT attempt, mark FAILED with a clear reason:**
  - Logging into web apps that need interactive credentials (E-Trade, banks, brokerages, anything behind SSO/MFA).
  - Anything requiring a GUI browser or desktop app not scriptable headlessly.
  - Trading, moving money, or sending payments from Alex's accounts.
  - Sending outbound messages as Alex (email, DMs) unless the dispatch explicitly authorizes it.
- **Genuinely-no-file exceptions** (confirmation checks, read-only status lookups): \`mc.sh status <agent_id> done "<summary>" --dispatch-id <id> --allow-no-artifact --no-artifact-reason "<why>"\`. Don't abuse this — if you produced any written output, it belongs in an artifact.
- **Delegating to a specialist:** use the specialist's agent_id on BOTH the artifact and the status call (not \`main\`).

Follow the rules in ~/mission-control/AGENTS.md exactly. Do this now, don't wait for heartbeat.`;
