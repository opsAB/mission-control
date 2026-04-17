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

// Friendly names + descriptions for Alex's known recurring jobs. First pattern
// that matches wins. To rename a job you can also add `# Human name` on the
// line immediately above the cron entry, and MC will use that.
export interface CronJobInfo {
  match: RegExp;
  name: string;
  description?: string;
  sources?: string[];
}
const COMMAND_INFO: CronJobInfo[] = [
  {
    match: /openclaw\s+update/,
    name: 'OpenClaw Firmware Update Check',
    description: 'Pulls the latest OpenClaw release and restarts the agent gateway so every agent picks up new code. Log: /tmp/openclaw-update.log.',
  },
  {
    match: /morning-report-wrapper\.py/,
    name: 'Morning Brief',
    description: 'Generates Alex\'s morning brief and pushes it to Telegram. Runs via the morning-report wrapper at ~/workspace/scripts. Log: /tmp/morning-briefing.log.',
    sources: ['OpenClaw task_runs', 'Mission Control state', 'Telegram'],
  },
  {
    match: /ftl-intel-watchdog\.py/,
    name: 'FTL Intel Watchdog',
    description: 'Health check on the FTL Intel pipeline: confirms the daily snapshot is landing on schedule and re-runs it if missed.',
  },
  {
    match: /ftl-intel-wrapper\.py/,
    name: 'FTL Intel',
    description: 'Fort Lauderdale market intelligence snapshot — restaurant openings, hospitality moves, nightlife signals relevant to Five Fifteen.',
    sources: ['Local news scrapes', 'Social listening', 'Competitor websites'],
  },
  {
    match: /whoop_sync\.py/,
    name: 'Whoop Sync',
    description: 'Pulls the latest recovery, strain, and sleep metrics from the Whoop API into the local health dataset.',
    sources: ['Whoop API'],
  },
];

export function findCronJobInfo(command: string): CronJobInfo | null {
  for (const entry of COMMAND_INFO) if (entry.match.test(command)) return entry;
  return null;
}

// Extract a human-friendly name from the command. Precedence:
//   1. Known-job mapping above
//   2. Script filename stripped of extension, prettified
//   3. First token
function nameFromCommand(cmd: string): string {
  const noRedir = cleanCommand(cmd);
  const info = findCronJobInfo(noRedir);
  if (info) return info.name;

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

function cleanCommand(cmd: string): string {
  return cmd.replace(/\s*>[>&]?\s*\S+.*$/g, '').replace(/\s*2>[>&]?\s*\S+.*$/g, '').trim();
}

// Turn a 5-field cron expression into plain English for the detail page.
export function humanizeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [m, h, dom, mon, dow] = parts.slice(0, 5);

  const time = (hh: string, mm: string): string => {
    const H = Number(hh); const M = Number(mm);
    if (isNaN(H) || isNaN(M)) return `${hh}:${mm}`;
    const ampm = H < 12 ? 'AM' : 'PM';
    const h12 = H === 0 ? 12 : H > 12 ? H - 12 : H;
    return `${h12}:${M.toString().padStart(2, '0')} ${ampm}`;
  };

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dowName = (d: string): string | null => {
    const n = Number(d);
    return !isNaN(n) && n >= 0 && n <= 6 ? DAYS[n] : null;
  };

  const everyHourStep = h.match(/^\*\/(\d+)$/);
  if (everyHourStep && m === '0' && dom === '*' && mon === '*' && dow === '*') {
    return `Every ${everyHourStep[1]} hours, on the hour`;
  }

  if (dom === '*' && mon === '*' && dow === '*' && !m.includes('*') && !h.includes('*')) {
    return `Daily at ${time(h, m)}`;
  }

  if (dom === '*' && mon === '*' && dow !== '*' && !m.includes('*') && !h.includes('*')) {
    if (dow === '1-5') return `Weekdays at ${time(h, m)}`;
    if (dow === '0,6' || dow === '6,0') return `Weekends at ${time(h, m)}`;
    const name = dowName(dow);
    if (name) return `Weekly on ${name}s at ${time(h, m)}`;
  }

  if (dom !== '*' && mon === '*' && dow === '*' && !m.includes('*') && !h.includes('*')) {
    return `Monthly on day ${dom} at ${time(h, m)}`;
  }

  return expr;
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

    const info = findCronJobInfo(cleanCommand(cmd));
    jobs.push({
      id: `sys-${idx++}`,
      agentId: 'system',
      name: pendingComment ?? info?.name ?? nameFromCommand(cmd),
      enabled: true,
      schedule: { kind: 'cron', cron: expr },
      nextRunAtMs: nextCronRun(expr),
      lastRunAtMs: undefined,
      command: cmd,
      description: info?.description,
      sources: info?.sources,
    });
    pendingComment = null;
  }

  return jobs;
}
