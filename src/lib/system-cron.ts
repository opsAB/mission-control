// Reads the user's Unix crontab and returns it in the OCCronJob shape so the
// cron / recurring-jobs surface in Mission Control can show real system jobs
// alongside OpenClaw-managed ones.

import { execSync } from 'child_process';
import type { OCCronJob } from './openclaw';

// Crude next-run estimator for the standard 5-field cron expression
// (minute hour day month weekday). Good enough for a dashboard — we look at
// the next 366 days at minute granularity and return the first match.
function nextCronRun(expr: string, from: Date = new Date()): number | undefined {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return undefined;
  const [m, h, dom, mon, dow] = parts.slice(0, 5);

  const matches = (val: number, field: string, min: number, max: number): boolean => {
    if (field === '*') return true;
    for (const piece of field.split(',')) {
      const stepMatch = piece.match(/^(\*|\d+(?:-\d+)?)\/(\d+)$/);
      if (stepMatch) {
        const step = Number(stepMatch[2]);
        if (step <= 0) continue;
        const base = stepMatch[1];
        const [lo, hi] = base === '*' ? [min, max] : base.includes('-')
          ? base.split('-').map(Number) as [number, number]
          : [Number(base), max];
        if (val < lo || val > hi) continue;
        if ((val - lo) % step === 0) return true;
        continue;
      }
      if (piece.includes('-')) {
        const [lo, hi] = piece.split('-').map(Number);
        if (val >= lo && val <= hi) return true;
        continue;
      }
      if (Number(piece) === val) return true;
    }
    return false;
  };

  const start = new Date(from.getTime() + 60_000);
  start.setSeconds(0, 0);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    const t = new Date(start.getTime() + i * 60_000);
    if (
      matches(t.getMinutes(), m, 0, 59) &&
      matches(t.getHours(), h, 0, 23) &&
      matches(t.getDate(), dom, 1, 31) &&
      matches(t.getMonth() + 1, mon, 1, 12) &&
      matches(t.getDay(), dow, 0, 6)
    ) {
      return t.getTime();
    }
  }
  return undefined;
}

// Friendly names for Alex's known recurring jobs, matched against the command
// text. First pattern that matches wins. To rename a job, either edit this
// mapping or add a `# Human name` comment line above the job in crontab.
const COMMAND_NAME_MAP: Array<{ match: RegExp; name: string }> = [
  { match: /morning-report-wrapper\.py/, name: 'Morning brief' },
  { match: /ftl-intel-watchdog\.py/, name: 'FTL Intel watchdog' },
  { match: /ftl-intel-wrapper\.py/, name: 'FTL Intel — daily snapshot' },
  { match: /whoop_sync\.py/, name: 'Whoop health sync' },
  { match: /openclaw\s+update/, name: 'OpenClaw daily update' },
];

// Extract a human-friendly name from the command. Precedence:
//   1. Known-job mapping above
//   2. Script filename stripped of extension, prettified
//   3. First token
function nameFromCommand(cmd: string): string {
  const noRedir = cmd.replace(/\s*>[>&]?\s*\S+.*$/g, '').replace(/\s*2>[>&]?\s*\S+.*$/g, '').trim();

  for (const entry of COMMAND_NAME_MAP) {
    if (entry.match.test(noRedir)) return entry.name;
  }

  const scriptMatch = noRedir.match(/([\w.-]+)\.(?:py|sh|js|ts|rb)(?=\s|$)/);
  if (scriptMatch) {
    const base = scriptMatch[1]
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
  const firstWord = noRedir.split(/\s+/)[0];
  return (firstWord ?? cmd).slice(0, 80);
}

export function getSystemCronJobs(): OCCronJob[] {
  let raw: string;
  try {
    raw = execSync('crontab -l', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).toString();
  } catch {
    return [];
  }

  const jobs: OCCronJob[] = [];
  let pendingComment: string | null = null;
  let idx = 0;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) { pendingComment = null; continue; }
    if (trimmed.startsWith('#')) {
      pendingComment = trimmed.replace(/^#+\s*/, '').trim() || null;
      continue;
    }
    // Skip env assignments (e.g. PATH=...)
    if (/^[A-Z_][A-Z0-9_]*=/.test(trimmed)) { pendingComment = null; continue; }

    const fields = trimmed.split(/\s+/);
    if (fields.length < 6) { pendingComment = null; continue; }
    const expr = fields.slice(0, 5).join(' ');
    const cmd = fields.slice(5).join(' ');

    jobs.push({
      id: `sys-${idx++}`,
      agentId: 'system',
      name: pendingComment ?? nameFromCommand(cmd),
      enabled: true,
      schedule: { kind: 'cron', cron: expr },
      nextRunAtMs: nextCronRun(expr),
      lastRunAtMs: undefined,
    });
    pendingComment = null;
  }

  return jobs;
}
