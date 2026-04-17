'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Alert } from '@/lib/alerts';
import { agentDisplayName } from '@/lib/format';

const severityStyles: Record<string, string> = {
  info: 'bg-blue-500/5 border-blue-500/20 text-blue-400',
  watch: 'bg-amber-500/5 border-amber-500/20 text-amber-400',
  alert: 'bg-red-500/5 border-red-500/20 text-red-400',
};

// SQLite returns "YYYY-MM-DD HH:MM:SS" in UTC without a Z suffix; browsers parse
// that bare string as local time, which skews diffs by the local offset. Normalize.
function parseSqliteUtc(s: string): number {
  if (!s) return Date.now();
  if (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s).getTime();
  return new Date(s.replace(' ', 'T') + 'Z').getTime();
}

function timeAgo(dateStr: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - parseSqliteUtc(dateStr)) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AlertRow({ alert }: { alert: Alert }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const sev = severityStyles[alert.severity] ?? severityStyles.info;
  const unread = !alert.read_at;

  // Tick every 30s so relative time stays fresh without relying on a server re-render.
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(i);
  }, []);

  async function dismiss() {
    setLeaving(true);
    await fetch(`/api/alerts/${alert.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss' }),
    });
    setTimeout(() => router.refresh(), 180);
  }

  return (
    <div className={`border rounded-lg p-4 transition-all duration-200 ${sev} ${leaving ? 'opacity-0 -translate-x-2' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase">{alert.severity}</span>
            {alert.agent_id && <span className="text-xs text-[var(--color-text-muted)]">{agentDisplayName(alert.agent_id)}</span>}
            {alert.telegram_sent_at && <span className="text-xs text-[var(--color-text-muted)]">📱 sent</span>}
            {unread && <span className="text-xs text-[var(--color-accent)] font-semibold">● NEW</span>}
          </div>
          <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{alert.title}</div>
          {alert.body && <div className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">{alert.body}</div>}
        </div>
        <div className="flex flex-col gap-2 shrink-0 items-end">
          <span className="text-xs text-[var(--color-text-muted)]" title={alert.created_at}>{timeAgo(alert.created_at, now)}</span>
          <button
            onClick={dismiss}
            disabled={leaving}
            className="px-2 py-1 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded hover:border-[var(--color-border-light)] disabled:opacity-50"
            title="Dismiss and remove from board"
          >
            Dismiss ✕
          </button>
        </div>
      </div>
    </div>
  );
}
