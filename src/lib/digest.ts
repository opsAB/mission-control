import { getDb } from './db';
import { ensureInit } from './init';
import { getAllMcTasks, getAllMcFlows, getAllMcAgents, getReviewQueue, parseSqliteTs } from './queries';
import { getRecentAlerts } from './alerts';
import { getSettings } from './settings';
import { sendTelegramDetailed } from './telegram';
import { broadcast } from './events';

function escapeMarkdown(s: string): string {
  // Telegram MarkdownV1: escape just enough so the digest doesn't blow up.
  // Strip backticks and stray asterisks/underscores from dynamic content only.
  return s.replace(/[*_`[\]()]/g, '');
}

export async function buildDigest(dateStr: string = new Date().toISOString().slice(0, 10)): Promise<string> {
  ensureInit();
  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;
  const tasks = getAllMcTasks({ excludeSubagents: true, limit: 300 });
  const flows = getAllMcFlows();
  const agents = getAllMcAgents();

  const completedToday = tasks.filter(t => t.status === 'done' && now - new Date(t.updated_at).getTime() < dayMs);
  const stillActive = tasks.filter(t => t.status === 'active');
  const blocked = tasks.filter(t => t.status === 'blocked');
  const needsReview = getReviewQueue().slice(0, 10);
  const recentAlerts = getRecentAlerts(20).filter(a => now - parseSqliteTs(a.created_at) < dayMs);

  const lines: string[] = [];
  lines.push(`🛰️ *Morning Digest — ${dateStr}*`);
  lines.push('');

  const settings = getSettings();
  if (settings.mission_statement) {
    lines.push(`_${escapeMarkdown(settings.mission_statement)}_`);
    lines.push('');
  }

  lines.push(`*Overnight summary*`);
  lines.push(`✅ Completed: ${completedToday.length}`);
  lines.push(`⚙️ Active: ${stillActive.length}`);
  lines.push(`🚫 Blocked: ${blocked.length}`);
  lines.push(`📝 Needs review: ${needsReview.length}`);
  lines.push(`🔔 Alerts 24h: ${recentAlerts.length}`);
  lines.push('');

  if (blocked.length > 0) {
    lines.push(`*Blocked — needs your eyes*`);
    for (const t of blocked.slice(0, 5)) lines.push(`• ${t.agent_emoji} ${escapeMarkdown(t.title)}`);
    lines.push('');
  }

  if (needsReview.length > 0) {
    lines.push(`*Ready to review*`);
    for (const r of needsReview.slice(0, 5)) lines.push(`• ${r.agent_emoji} ${escapeMarkdown(r.title)}`);
    lines.push('');
  }

  lines.push(`*Agent activity*`);
  let anyActivity = false;
  for (const a of agents) {
    const mine = tasks.filter(t => t.agent_id === a.id);
    const done = mine.filter(t => t.status === 'done' && now - new Date(t.updated_at).getTime() < dayMs).length;
    const active = mine.filter(t => t.status === 'active').length;
    if (done === 0 && active === 0) continue;
    anyActivity = true;
    lines.push(`${a.emoji} ${a.name}: ${done} done · ${active} active`);
  }
  if (!anyActivity) lines.push('_No agent activity overnight_');
  lines.push('');

  const activeFlows = flows.filter(f => f.status === 'active');
  if (activeFlows.length > 0) {
    lines.push(`*Active flows*`);
    for (const f of activeFlows.slice(0, 5)) {
      lines.push(`• ${escapeMarkdown(f.name)} (${f.agent_name})`);
    }
    lines.push('');
  }

  lines.push(`http://192.168.12.53:3001`);
  return lines.join('\n');
}

// Strip Telegram Markdown so the plain-text fallback body is readable when
// Telegram rejects parse_mode=Markdown. We don't try to render the markdown,
// just remove the delimiters the formatter added.
function stripMarkdown(s: string): string {
  return s
    .replace(/\*([^*\n]+)\*/g, '$1')  // *bold*
    .replace(/_([^_\n]+)_/g, '$1')    // _italic_
    .replace(/`([^`\n]+)`/g, '$1');   // `code`
}

export async function runDigest(forceDate?: string): Promise<{ ok: boolean; sent: boolean; error?: string; fallback_used?: boolean; body: string; id: number }> {
  const markdownBody = await buildDigest(forceDate);
  const dateStr = forceDate ?? new Date().toISOString().slice(0, 10);

  const settings = getSettings();
  let sent = false;
  let delivered_via: string | null = null;
  let error: string | undefined;
  let fallback_used: boolean | undefined;
  if (settings.digest_enabled && settings.telegram_enabled) {
    const result = await sendTelegramDetailed(markdownBody);
    sent = result.ok;
    if (!result.ok) error = result.error;
    fallback_used = result.fallback_used;
    if (sent) delivered_via = fallback_used ? 'telegram_plain' : 'telegram';
  }

  // Persist whichever body was actually delivered. If we fell back to plain
  // text, store the de-markdownized version so the historical record matches
  // what Alex saw on his phone.
  const persistedBody = fallback_used ? stripMarkdown(markdownBody) : markdownBody;

  const result = getDb().prepare(`
    INSERT INTO digests (digest_date, body_markdown, delivered_via, delivered_at)
    VALUES (?, ?, ?, ?)
  `).run(dateStr, persistedBody, delivered_via, delivered_via ? new Date().toISOString() : null);
  const id = Number(result.lastInsertRowid);
  broadcast('digest_new', { id, dateStr, sent });

  return { ok: true, sent, error, fallback_used, body: persistedBody, id };
}
