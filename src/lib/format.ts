import path from 'path';

// Display-name overrides for agent_ids that don't match their persona name.
// OpenClaw stores the orchestrator as id "main" with no name — we render that as "Alfred".
const AGENT_NAME_OVERRIDES: Record<string, string> = {
  main: 'Alfred',
};

export function agentDisplayName(agentId: string | null | undefined, fallbackName?: string | null): string {
  if (!agentId) return fallbackName ?? '—';
  const override = AGENT_NAME_OVERRIDES[agentId];
  if (override) return override;
  if (fallbackName && fallbackName !== agentId) return fallbackName;
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

export function fileTypeLabel(filePath: string | null | undefined): string {
  if (!filePath) return '—';
  const ext = path.extname(filePath).toLowerCase();
  if (!ext) return '—';
  return ext;
}

// SQLite datetime('now') stores UTC as 'YYYY-MM-DD HH:MM:SS' with no TZ suffix.
// Parse as UTC and render in America/New_York for Alex.
const EST_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZoneName: 'short',
});

export function formatEstTimestamp(raw: string | null | undefined): string {
  if (!raw) return '—';
  // Accept 'YYYY-MM-DD HH:MM:SS' (UTC, no tz) or ISO strings
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return raw;
  return EST_FORMATTER.format(d);
}
