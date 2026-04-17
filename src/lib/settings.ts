import { getDb } from './db';
import { ensureInit } from './init';

export type AttentionThreshold = 'blocked_review_only' | 'plus_thinking' | 'plus_curiosity';

export interface Settings {
  mission_statement: string;
  attention_threshold: AttentionThreshold;
  telegram_enabled: boolean;
  telegram_chat_id: string;
  digest_time: string;         // HH:MM local
  digest_enabled: boolean;
  only_main_pings: boolean;
}

export function getSettings(): Settings {
  ensureInit();
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const map = new Map(rows.map(r => [r.key, r.value]));
  return {
    mission_statement: map.get('mission_statement') ?? '',
    attention_threshold: (map.get('attention_threshold') ?? 'blocked_review_only') as AttentionThreshold,
    telegram_enabled: (map.get('telegram_enabled') ?? 'true') === 'true',
    telegram_chat_id: map.get('telegram_chat_id') ?? '416658381',
    digest_time: map.get('digest_time') ?? '06:00',
    digest_enabled: (map.get('digest_enabled') ?? 'true') === 'true',
    only_main_pings: (map.get('only_main_pings') ?? 'true') === 'true',
  };
}

export function updateSettings(partial: Partial<Settings>) {
  ensureInit();
  const stmt = getDb().prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) continue;
    const strVal = typeof v === 'boolean' ? String(v) : String(v);
    stmt.run(k, strVal);
  }
}
