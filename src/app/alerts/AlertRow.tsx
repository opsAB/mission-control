'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Alert } from '@/lib/alerts';
import { agentDisplayName } from '@/lib/format';

const severityStyles: Record<string, string> = {
  info: 'bg-blue-500/5 border-blue-500/20 text-blue-400',
  watch: 'bg-amber-500/5 border-amber-500/20 text-amber-400',
  alert: 'bg-red-500/5 border-red-500/20 text-red-400',
};

export default function AlertRow({ alert, timeAgoStr }: { alert: Alert; timeAgoStr: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const sev = severityStyles[alert.severity] ?? severityStyles.info;
  const unread = !alert.read_at;

  async function dismiss() {
    setLeaving(true);
    await fetch(`/api/alerts/${alert.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss' }),
    });
    // brief fade-out before router refresh pulls it from the list
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
          <span className="text-xs text-[var(--color-text-muted)]">{timeAgoStr}</span>
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
