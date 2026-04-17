'use client';

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
  const sev = severityStyles[alert.severity] ?? severityStyles.info;
  const unread = !alert.read_at;

  async function act(action: 'ack' | 'read') {
    await fetch(`/api/alerts/${alert.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    router.refresh();
  }

  return (
    <div className={`border rounded-lg p-4 ${sev} ${unread ? '' : 'opacity-60'}`}>
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
          <div className="flex gap-1">
            {unread && (
              <button onClick={() => act('read')} className="px-2 py-1 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded hover:border-[var(--color-border-light)]">Mark read</button>
            )}
            {!alert.acknowledged_at && (
              <button onClick={() => act('ack')} className="px-2 py-1 text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/25">Ack</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
