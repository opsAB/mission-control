import path from 'path';

const EXT_LABEL: Record<string, string> = {
  '.md': 'Markdown',
  '.markdown': 'Markdown',
  '.pdf': 'PDF',
  '.docx': 'DOCX',
  '.doc': 'DOC',
  '.xlsx': 'XLSX',
  '.xls': 'XLS',
  '.pptx': 'PPTX',
  '.csv': 'CSV',
  '.tsv': 'TSV',
  '.txt': 'Text',
  '.log': 'Log',
  '.json': 'JSON',
  '.html': 'HTML',
  '.htm': 'HTML',
  '.png': 'PNG',
  '.jpg': 'JPEG',
  '.jpeg': 'JPEG',
  '.gif': 'GIF',
  '.svg': 'SVG',
  '.webp': 'WEBP',
  '.js': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TSX',
  '.jsx': 'JSX',
  '.py': 'Python',
  '.sh': 'Shell',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.zip': 'ZIP',
};

export function fileTypeLabel(filePath: string | null | undefined): string {
  if (!filePath) return '—';
  const ext = path.extname(filePath).toLowerCase();
  if (!ext) return '—';
  return EXT_LABEL[ext] ?? ext.replace(/^\./, '').toUpperCase();
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
