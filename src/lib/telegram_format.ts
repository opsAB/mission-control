// Format alerts for Telegram.
// Telegram's legacy "Markdown" parse mode supports *bold*, _italic_, `mono`, and
// blank lines for spacing. We use a compact, scannable layout: headline, one
// blank line, meta, one blank line, body, one blank line, action hint.
//
// Rules applied:
// - Lead with an emoji + bold headline ("what happened").
// - Second line names the source (Alfred / specialist / Mission Control).
// - Body uses short paragraphs separated by blank lines, not a wall of text.
// - Close with a one-line "what to do" hint pointing to MC.
// - Titles of entities (dispatches, tasks) appear in italics so Alex can see
//   the human-readable label, not just a number.

export type AlertKind = 'silent_done_blocked' | 'dispatch_failed' | 'attention';

export interface TelegramAlertPayload {
  severity: 'info' | 'watch' | 'alert';
  kind?: AlertKind;
  headline: string; // short — e.g. "Silent-done blocked" or "Task failed"
  agent_id: string | null;
  subject_title?: string | null; // the dispatch/task title, human-readable
  sections?: Array<{ label?: string; text: string }>;
  action_hint?: string; // one-line "what to do next"
}

const AGENT_LABELS: Record<string, string> = {
  main: 'Alfred',
  mc: 'Mission Control',
  james: 'James',
  milo: 'Milo',
  lewis: 'Lewis',
  contractor: 'Contractor',
};

function agentLabel(agentId: string | null): string {
  if (!agentId) return 'system';
  return AGENT_LABELS[agentId] || agentId;
}

function severityIcon(severity: string): string {
  if (severity === 'alert') return '🚨';
  if (severity === 'watch') return '⚠️';
  return 'ℹ️';
}

// Escape the minimum needed for legacy Markdown parse mode. Telegram's legacy
// Markdown is lenient, but backticks and asterisks inside user content can
// break parsing. We escape those and underscores in free text only.
function escapeMd(s: string): string {
  return s.replace(/([*_`\[\]])/g, '\\$1');
}

export function formatTelegramAlert(p: TelegramAlertPayload): string {
  const lines: string[] = [];
  lines.push(`${severityIcon(p.severity)} *${escapeMd(p.headline)}*`);

  if (p.subject_title) {
    lines.push(`_${escapeMd(p.subject_title)}_`);
  }

  lines.push(`from ${escapeMd(agentLabel(p.agent_id))}`);

  if (p.sections && p.sections.length) {
    for (const section of p.sections) {
      lines.push(''); // blank line between blocks
      if (section.label) lines.push(`*${escapeMd(section.label)}*`);
      lines.push(section.text); // body text: let user content pass through raw
    }
  }

  if (p.action_hint) {
    lines.push('');
    lines.push(`_${escapeMd(p.action_hint)}_`);
  }

  return lines.join('\n');
}
