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
  created_at: string;
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
