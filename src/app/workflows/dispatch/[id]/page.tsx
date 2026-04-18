import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDispatchById, getDispatchTimeline } from '@/lib/queries';
import { agentDisplayName, formatEstTimestamp } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

function fmtClock(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(d);
}

function fmtDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return '—';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60); const rm = m % 60;
  return `${h}h ${rm}m`;
}

export default async function DispatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dispatchId = Number(id);
  if (!Number.isFinite(dispatchId)) notFound();
  const dispatch = getDispatchById(dispatchId);
  if (!dispatch) notFound();
  const timeline = getDispatchTimeline(dispatchId);

  const failed = dispatch.status === 'failed';
  const lastActivity = timeline[timeline.length - 1];
  const failureReason = failed
    ? timeline.reverse().find(e => e.icon === '✕')?.details
      ?? timeline.find(e => e.icon === '✕')?.text
      ?? 'No failure reason captured.'
    : null;

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-4">
        <Link href="/workflows" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">← Workflows</Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-semibold">{dispatch.title}</h1>
          <StatusBadge status={dispatch.status} />
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">Dispatch #{dispatch.id}</p>
      </div>

      {failed && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-400 text-lg leading-none mt-0.5" aria-hidden="true">✕</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-red-400 mb-1">Dispatch failed</div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">{failureReason}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-3">
                No flow was opened for this dispatch because {agentDisplayName(dispatch.assignee_agent_id)} recognized the task as un-executable before spawning a sub-agent session — that&apos;s the correct behavior (don&apos;t burn compute on impossible work).
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 mb-6 grid grid-cols-2 gap-4">
        <Field label="Assignee" value={agentDisplayName(dispatch.assignee_agent_id)} />
        <Field label="Priority" value={dispatch.priority} />
        <Field label="Dispatched" value={formatEstTimestamp(dispatch.created_at)} />
        <Field label="Completed" value={dispatch.completed_at ? formatEstTimestamp(dispatch.completed_at) : '—'} />
        <Field label="Picked up" value={dispatch.picked_up_at ? formatEstTimestamp(dispatch.picked_up_at) : '—'} />
        <Field label="Duration" value={fmtDuration(dispatch.created_at, dispatch.completed_at)} />
      </div>

      {dispatch.description && (
        <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 mb-6">
          <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Original brief</div>
          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">{dispatch.description}</p>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Timeline</h2>
          <span className="text-xs text-[var(--color-text-muted)]">{timeline.length} events</span>
        </div>
        {timeline.length === 0 ? (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">No recorded events for this dispatch.</p>
          </div>
        ) : (
          <ol className="relative border-l border-[var(--color-border)] ml-3 space-y-4">
            {timeline.map((e, i) => {
              const isError = e.iconColor.includes('red');
              return (
                <li key={i} className={`relative pl-6 ${isError ? '-mx-2 px-2 py-1 rounded bg-red-500/5 border border-red-500/20' : ''}`}>
                  <span
                    className={`absolute -left-3 top-0.5 w-6 h-6 rounded-full bg-[var(--color-bg-secondary)] border ${isError ? 'border-red-500/40' : 'border-[var(--color-border)]'} flex items-center justify-center text-xs ${e.iconColor}`}
                    aria-hidden="true"
                  >
                    {e.icon}
                  </span>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className={`text-sm ${isError ? 'text-red-400 font-medium' : 'text-[var(--color-text-primary)]'}`}>{e.text}</div>
                    <div className="text-xs text-[var(--color-text-muted)] font-mono shrink-0">{fmtClock(e.ts)}</div>
                  </div>
                  {e.link && (
                    <Link href={e.link.href} className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">{e.link.label} →</Link>
                  )}
                  {e.details && (
                    <details className="mt-1" open={isError}>
                      <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]">Details</summary>
                      <pre className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap break-words mt-2 bg-[var(--color-bg-tertiary)] rounded p-3 font-mono">{e.details}</pre>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {!failed && !lastActivity && (
          <p className="text-xs text-[var(--color-text-muted)] mt-3">Dispatch queued but no agent activity yet.</p>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}
