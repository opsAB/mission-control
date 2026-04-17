// Trigger an OpenClaw agent turn from MC.
// Uses the `openclaw agent` CLI command to wake an agent immediately rather
// than waiting for its heartbeat.

import { exec } from 'child_process';

export interface TriggerResult {
  ok: boolean;
  started: boolean;
  error?: string;
}

export function triggerAgent(agentId: string, message: string): TriggerResult {
  // Basic safety: agent_id must be alphanumeric-ish; message gets single-quoted.
  if (!/^[a-zA-Z0-9_-]+$/.test(agentId)) {
    return { ok: false, started: false, error: 'Invalid agent_id' };
  }
  // Escape single quotes for shell single-quoted string: ' -> '\''
  const escaped = message.replace(/'/g, "'\\''");
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
- If assigned to you (main), handle it yourself.
- If assigned to a specialist, spawn/delegate to them using your existing sub-agent pattern.
- As you work or delegate, send status updates via \`mc.sh status <agent_id> in_progress "<summary>" --dispatch-id <id>\`.
- When a deliverable file is produced, register it via \`mc.sh artifact <specialist_id> "<title>" <type> <filepath> --summary "<summary>"\` BEFORE marking the dispatch done.
- Mark each dispatch done via \`mc.sh status <agent_id> done "<one-line summary>" --dispatch-id <id>\`.

Follow the rules in ~/mission-control/AGENTS.md exactly. Do this now, don't wait for heartbeat.`;
