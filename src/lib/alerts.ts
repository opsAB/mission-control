import { getDb } from './db';
import { ensureInit } from './init';

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
  telegram_sent_at: string | null;
  created_at: string;
}

export function getRecentAlerts(limit: number = 50): Alert[] {
  ensureInit();
  return getDb().prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?').all(limit) as Alert[];
}

export function getUnreadAlertCount(): number {
  ensureInit();
  const row = getDb().prepare('SELECT COUNT(*) as c FROM alerts WHERE read_at IS NULL').get() as { c: number };
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

export function markAllRead() {
  ensureInit();
  getDb().prepare(`UPDATE alerts SET read_at = datetime('now') WHERE read_at IS NULL`).run();
}
