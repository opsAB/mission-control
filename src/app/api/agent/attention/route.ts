import { NextRequest } from 'next/server';
import { ensureInit } from '@/lib/init';
import { getDb } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { broadcast } from '@/lib/events';
import { sendTelegram } from '@/lib/telegram';
import { formatTelegramAlert } from '@/lib/telegram_format';
import { requireAgentAuth } from '@/lib/agent-auth';

// POST /api/agent/attention
// Body: { agent_id, severity?, title, body?, entity_type?, entity_id? }
//
// When only_main_pings=true and caller is not Alfred (agent_id !== 'main'),
// the alert is queued for Alfred to triage — it's NOT sent to Telegram here.
// Alfred later calls GET /api/alerts/pending-triage on wake and decides per
// alert whether to POST /api/alerts/:id/triage with decision='escalated'
// (→ Telegram) or decision='acked' (→ close without bothering Alex).
// A scheduler-side fallback auto-escalates anything left pending for >24h
// so nothing is truly lost.
export async function POST(req: NextRequest) {
  const authFail = requireAgentAuth(req);
  if (authFail) return authFail;
  ensureInit();
  const { agent_id, severity = 'info', title, body = '', entity_type, entity_id } = await req.json();
  if (!agent_id || !title) {
    return Response.json({ error: 'agent_id and title required' }, { status: 400 });
  }

  const settings = getSettings();
  const isMain = agent_id === 'main';
  const queuedForTriage = !isMain && settings.only_main_pings;

  const result = getDb().prepare(`
    INSERT INTO alerts (severity, title, body, agent_id, entity_type, entity_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(severity, title, body, agent_id, entity_type ?? null, entity_id ?? null);

  const id = Number(result.lastInsertRowid);
  broadcast('alert_new', { id, severity, title, agent_id, queued_for_triage: queuedForTriage });

  // Telegram: only if NOT queued-for-triage AND telegram enabled AND severity meets threshold
  let telegramSent = false;
  if (!queuedForTriage && settings.telegram_enabled) {
    const thresholdOk = matchesAttentionThreshold(severity, settings.attention_threshold);
    if (thresholdOk) {
      const sent = await sendTelegram(
        formatTelegramAlert({
          severity,
          agent_id,
          headline: title,
          sections: body ? [{ text: body }] : [],
        })
      );
      if (sent) {
        telegramSent = true;
        getDb().prepare(`UPDATE alerts SET telegram_sent_at = datetime('now') WHERE id = ?`).run(id);
      }
    }
  }

  return Response.json({
    ok: true,
    id,
    queued_for_triage: queuedForTriage,
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

