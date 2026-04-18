// In-process scheduler for MC background tasks:
//   1. Daily digest at settings.digest_time
//   2. Stuck-dispatch auto-fail (picked_up/in_progress > STUCK_DISPATCH_HOURS)
// Persists across hot-reloads via globalThis.

import { getSettings } from './settings';
import { runDigest } from './digest';
import { getDb } from './db';
import { broadcast } from './events';
import { createAlert, triageAlert } from './alerts';

declare global {
  // eslint-disable-next-line no-var
  var __mc_scheduler_started: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mc_last_digest_date: string | undefined;
  // eslint-disable-next-line no-var
  var __mc_last_stuck_check_ms: number | undefined;
  // eslint-disable-next-line no-var
  var __mc_last_triage_check_ms: number | undefined;
}

// Pending triage alerts older than this auto-escalate so nothing is ever truly lost.
const TRIAGE_FALLBACK_HOURS = 24;

// Dispatch stuck past this many hours gets auto-failed. Screenshot feedback
// suggested 12; keeping conservative. Adjustable without schema change.
const STUCK_DISPATCH_HOURS = 12;

async function digestTick() {
  const s = getSettings();
  if (!s.digest_enabled) return;
  const now = new Date();
  const [h, m] = (s.digest_time || '06:00').split(':').map(Number);
  const todayStr = now.toISOString().slice(0, 10);

  // "Past digest time today and haven't fired yet" — survives restarts that
  // missed the exact-minute window. The once-per-day guard is the date string.
  const pastDigestTime = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
  if (pastDigestTime && globalThis.__mc_last_digest_date !== todayStr) {
    globalThis.__mc_last_digest_date = todayStr;
    await runDigest(todayStr);
  }
}

async function stuckDispatchTick() {
  // Run at most once every 10 minutes to avoid DB churn.
  const now = Date.now();
  if (globalThis.__mc_last_stuck_check_ms && now - globalThis.__mc_last_stuck_check_ms < 10 * 60 * 1000) return;
  globalThis.__mc_last_stuck_check_ms = now;

  const rows = getDb().prepare(`
    SELECT id, title, assignee_agent_id, status, updated_at
    FROM mc_dispatched_tasks
    WHERE status IN ('picked_up', 'in_progress')
      AND (julianday('now') - julianday(updated_at)) * 24 > ?
  `).all(STUCK_DISPATCH_HOURS) as Array<{ id: number; title: string; assignee_agent_id: string; status: string; updated_at: string }>;

  for (const d of rows) {
    getDb().prepare(`
      UPDATE mc_dispatched_tasks
      SET status = 'failed',
          completed_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ? AND status IN ('picked_up', 'in_progress')
    `).run(d.id);

    getDb().prepare(`
      INSERT INTO mc_activity (entity_type, entity_id, action, summary, agent_id)
      VALUES ('dispatch', ?, 'failed', ?, 'mission-control')
    `).run(String(d.id), `Auto-failed after ${STUCK_DISPATCH_HOURS}h in '${d.status}' with no further progress.`);

    await createAlert({
      severity: 'alert',
      title: `Dispatch #${d.id} auto-failed (stuck)`,
      body:
        `Dispatch #${d.id} ("${d.title}") assigned to "${d.assignee_agent_id}" had been stuck in '${d.status}' ` +
        `for >${STUCK_DISPATCH_HOURS}h with no status update. Mission Control auto-failed it so it stops ` +
        `blocking the Office board. Check the agent's last output and decide whether to re-dispatch, retry, or handle manually.`,
      agent_id: 'mc',
      entity_type: 'dispatch',
      entity_id: String(d.id),
    });

    broadcast('dispatch_updated', { id: d.id, status: 'failed', assignee_agent_id: d.assignee_agent_id });
  }
}

async function triageFallbackTick() {
  // Every 15min: auto-escalate anything in the triage queue older than TRIAGE_FALLBACK_HOURS
  // so Alfred's judgment failures (or downtime) don't hide real alerts forever.
  const now = Date.now();
  if (globalThis.__mc_last_triage_check_ms && now - globalThis.__mc_last_triage_check_ms < 15 * 60 * 1000) return;
  globalThis.__mc_last_triage_check_ms = now;

  const rows = getDb().prepare(`
    SELECT id FROM alerts
    WHERE triaged_at IS NULL
      AND agent_id IS NOT NULL AND agent_id != 'main' AND agent_id != 'mc'
      AND telegram_sent_at IS NULL
      AND dismissed_at IS NULL
      AND (julianday('now') - julianday(created_at)) * 24 > ?
  `).all(TRIAGE_FALLBACK_HOURS) as Array<{ id: number }>;

  for (const r of rows) {
    const note = `Auto-escalated after ${TRIAGE_FALLBACK_HOURS}h with no decision from Alfred.`;
    await triageAlert(r.id, 'escalated', 'mc-scheduler', note);
  }
}

export function startScheduler() {
  if (globalThis.__mc_scheduler_started) return;
  globalThis.__mc_scheduler_started = true;

  const tick = async () => {
    try { await digestTick(); } catch (e) { console.error('[scheduler] digest tick error:', e); }
    try { await stuckDispatchTick(); } catch (e) { console.error('[scheduler] stuck-dispatch tick error:', e); }
    try { await triageFallbackTick(); } catch (e) { console.error('[scheduler] triage fallback tick error:', e); }
  };

  setInterval(tick, 60 * 1000);
  // Initial check after 10s so we don't fire on startup for the same-minute case
  setTimeout(tick, 10000);
}
