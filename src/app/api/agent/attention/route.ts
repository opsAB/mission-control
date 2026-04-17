import { NextRequest } from 'next/server';
import { ensureInit } from '@/lib/init';
import { getDb } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { broadcast } from '@/lib/events';
import { sendTelegram } from '@/lib/telegram';

// POST /api/agent/attention
// Body: { agent_id, severity?, title, body?, entity_type?, entity_id? }
// Agents call this to request Alex's attention.
// If only_main_pings is on and caller is not 'main' (Alfred), the alert is routed
// to Alfred's triage queue (stored, but not pushed to Telegram).
export async function POST(req: NextRequest) {
  ensureInit();
  const { agent_id, severity = 'info', title, body = '', entity_type, entity_id } = await req.json();
  if (!agent_id || !title) {
    return Response.json({ error: 'agent_id and title required' }, { status: 400 });
  }

  const settings = getSettings();
  const isMain = agent_id === 'main';
  const shouldNotify = !settings.only_main_pings || isMain;

  const result = getDb().prepare(`
    INSERT INTO alerts (severity, title, body, agent_id, entity_type, entity_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(severity, title, body, agent_id, entity_type ?? null, entity_id ?? null);

  const id = Number(result.lastInsertRowid);
  broadcast('alert_new', { id, severity, title, agent_id });

  // Telegram: only if shouldNotify + telegram enabled + severity >= attention_threshold
  let telegramSent = false;
  if (shouldNotify && settings.telegram_enabled) {
    const thresholdOk = matchesAttentionThreshold(severity, settings.attention_threshold);
    if (thresholdOk) {
      const sent = await sendTelegram(formatAlertForTelegram(agent_id, severity, title, body));
      if (sent) {
        telegramSent = true;
        getDb().prepare(`UPDATE alerts SET telegram_sent_at = datetime('now') WHERE id = ?`).run(id);
      }
    }
  }

  return Response.json({
    ok: true,
    id,
    routed_to_main: !isMain && settings.only_main_pings,
    telegram_sent: telegramSent,
  });
}

function matchesAttentionThreshold(severity: string, threshold: string): boolean {
  // blocked_review_only: alert severity only
  // plus_thinking: alert or watch
  // plus_curiosity: any
  if (threshold === 'plus_curiosity') return true;
  if (threshold === 'plus_thinking') return severity === 'alert' || severity === 'watch';
  return severity === 'alert';
}

function formatAlertForTelegram(agentId: string, severity: string, title: string, body: string): string {
  const icon = severity === 'alert' ? '🚨' : severity === 'watch' ? '⚠️' : 'ℹ️';
  const agentLabel = agentId === 'main' ? 'Alfred' : agentId;
  const parts = [`${icon} *${title}*`, `_from ${agentLabel}_`];
  if (body) parts.push('', body);
  return parts.join('\n');
}
