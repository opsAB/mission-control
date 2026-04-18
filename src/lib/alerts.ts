import { getDb } from './db';
import { ensureInit } from './init';
import { getSettings } from './settings';
import { broadcast } from './events';
import { sendTelegram } from './telegram';

export interface Alert {
  id: number;
  severity: 'info' | 'watch' | 'alert';
  title: string;
  body: string;
  agent_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  acknowledged_at: string | null;
  dismissed_at: string | null;
  telegram_sent_at: string | null;
  triaged_at: string | null;
  triaged_by: string | null;
  triage_decision: 'escalated' | 'acked' | null;
  triage_note: string | null;
  created_at: string;
}

// Alerts waiting for Alfred's triage — specialist-raised alerts that the
// only_main_pings filter silenced. Oldest first so FIFO behavior.
export function getPendingTriageAlerts(limit: number = 50): Alert[] {
  ensureInit();
  return getDb().prepare(`
    SELECT * FROM alerts
    WHERE triaged_at IS NULL
      AND agent_id IS NOT NULL AND agent_id != 'main' AND agent_id != 'mc'
      AND telegram_sent_at IS NULL
      AND dismissed_at IS NULL
    ORDER BY created_at ASC
    LIMIT ?
  `).all(limit) as Alert[];
}

export async function triageAlert(
  id: number,
  decision: 'escalated' | 'acked',
  triagedBy: string,
  note?: string
): Promise<{ ok: boolean; telegram_sent?: boolean; error?: string }> {
  ensureInit();
  const alert = getDb().prepare('SELECT * FROM alerts WHERE id = ?').get(id) as Alert | undefined;
  if (!alert) return { ok: false, error: 'alert_not_found' };
  if (alert.triaged_at) return { ok: false, error: 'already_triaged' };

  getDb().prepare(`
    UPDATE alerts
    SET triaged_at = datetime('now'), triaged_by = ?, triage_decision = ?, triage_note = ?
    WHERE id = ?
  `).run(triagedBy, decision, note ?? null, id);
  broadcast('alert_updated', { id, triage_decision: decision });

  let telegramSent = false;
  if (decision === 'escalated') {
    const settings = getSettings();
    if (settings.telegram_enabled) {
      const { formatTelegramAlert } = await import('./telegram_format');
      const sent = await sendTelegram(formatTelegramAlert({
        severity: alert.severity,
        agent_id: alert.agent_id,
        kind: 'attention',
        headline: `Escalated by Alfred: ${alert.title}`,
        sections: [
          ...(alert.body ? [{ text: alert.body }] : []),
          ...(note ? [{ label: "Alfred's note", text: note }] : []),
        ],
        action_hint: 'Open MC → Alerts to respond.',
      }));
      if (sent) {
        telegramSent = true;
        getDb().prepare(`UPDATE alerts SET telegram_sent_at = datetime('now') WHERE id = ?`).run(id);
      }
    }
  }

  return { ok: true, telegram_sent: telegramSent };
}

export function getRecentAlerts(limit: number = 50, opts: { includeDismissed?: boolean } = {}): Alert[] {
  ensureInit();
  const where = opts.includeDismissed ? '' : 'WHERE dismissed_at IS NULL';
  return getDb().prepare(`SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT ?`).all(limit) as Alert[];
}

export function getUnreadAlertCount(): number {
  ensureInit();
  const row = getDb().prepare('SELECT COUNT(*) as c FROM alerts WHERE read_at IS NULL AND dismissed_at IS NULL').get() as { c: number };
  return row.c;
}

export function markAlertRead(id: number) {
  ensureInit();
  getDb().prepare(`UPDATE alerts SET read_at = datetime('now') WHERE id = ?`).run(id);
}

export function acknowledgeAlert(id: number) {
  ensureInit();
  getDb().prepare(`UPDATE alerts SET acknowledged_at = datetime('now'), read_at = COALESCE(read_at, datetime('now')) WHERE id = ?`).run(id);
}

export function dismissAlert(id: number) {
  ensureInit();
  getDb().prepare(`UPDATE alerts SET dismissed_at = datetime('now'), read_at = COALESCE(read_at, datetime('now')) WHERE id = ?`).run(id);
}

export function dismissAll() {
  ensureInit();
  getDb().prepare(`UPDATE alerts SET dismissed_at = datetime('now'), read_at = COALESCE(read_at, datetime('now')) WHERE dismissed_at IS NULL`).run();
}

export function markAllRead() {
  ensureInit();
  getDb().prepare(`UPDATE alerts SET read_at = datetime('now') WHERE read_at IS NULL`).run();
}

import { formatTelegramAlert, type TelegramAlertPayload } from './telegram_format';

// Create an alert, persist it, broadcast it, and route an opinionated Telegram
// message through the shared formatter. Use `telegram_payload` to drive the
// structured Telegram layout (sections, action hints, subject title); the DB
// alert row stores the plain `title` + `body` for the MC UI.
export async function createAlert(params: {
  severity: 'info' | 'watch' | 'alert';
  title: string;
  body?: string;
  agent_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  telegram_payload?: Omit<TelegramAlertPayload, 'severity' | 'agent_id'>;
}): Promise<{ id: number; telegram_sent: boolean }> {
  ensureInit();
  const { severity, title, body = '', agent_id = null, entity_type = null, entity_id = null, telegram_payload } = params;
  const result = getDb().prepare(`
    INSERT INTO alerts (severity, title, body, agent_id, entity_type, entity_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(severity, title, body, agent_id, entity_type, entity_id);
  const id = Number(result.lastInsertRowid);
  broadcast('alert_new', { id, severity, title, agent_id });

  const settings = getSettings();
  let telegramSent = false;
  if (settings.telegram_enabled && thresholdAllows(severity, settings.attention_threshold)) {
    const payload: TelegramAlertPayload = telegram_payload
      ? { severity, agent_id, ...telegram_payload }
      : {
          severity,
          agent_id,
          headline: title,
          sections: body ? [{ text: body }] : [],
        };
    const sent = await sendTelegram(formatTelegramAlert(payload));
    if (sent) {
      telegramSent = true;
      getDb().prepare(`UPDATE alerts SET telegram_sent_at = datetime('now') WHERE id = ?`).run(id);
    }
  }
  return { id, telegram_sent: telegramSent };
}

function thresholdAllows(severity: string, threshold: string): boolean {
  if (threshold === 'plus_curiosity') return true;
  if (threshold === 'plus_thinking') return severity === 'alert' || severity === 'watch';
  return severity === 'alert';
}
