import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMcFlowById, getFlowTimeline } from '@/lib/queries';
import { agentDisplayName, formatEstTimestamp } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

function fmtDuration(ms: number | null): string {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60); const rm = m % 60;
  return `${h}h ${rm}m`;
}

function fmtClock(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(d);
}

export default async function FlowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getMcFlowById(id);
  if (!data) notFound();
  const { flow } = data;
  const timeline = getFlowTimeline(id);

  const totalMs = flow.ended_at
    ? new Date(flow.ended_at).getTime() - new Date(flow.created_at).getTime()
    : Date.now() - new Date(flow.created_at).getTime();

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-4">
        <Link href="/workflows" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">← Workflows</Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-semibold">{flow.name}</h1>
          <StatusBadge status={flow.status} />
        </div>
        <p className="text-xs text-[var(--color-text-muted)] font-mono">{flow.flow_id}</p>
      </div>

      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 mb-6 grid grid-cols-2 gap-4">
        <Field label="Orchestrator" value={`${flow.agent_emoji ? flow.agent_emoji + ' ' : ''}${agentDisplayName(flow.agent_id, flow.agent_name)}`} />
        <Field label="Events" value={`${timeline.length}`} />
        <Field label="Started" value={formatEstTimestamp(flow.created_at)} />
        <Field label="Ended" value={flow.ended_at ? formatEstTimestamp(flow.ended_at) : '—'} />
        <Field label="Duration" value={fmtDuration(totalMs)} span2 />
        {flow.blocked_summary && <Field label="Blocked reason" value={flow.blocked_summary} span2 />}
      </div>

      <section>
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Timeline</h2>
        {timeline.length === 0 ? (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">No recorded events.</p>
          </div>
        ) : (
          <ol className="relative border-l border-[var(--color-border)] ml-3 space-y-4">
            {timeline.map((e, i) => (
              <li key={i} className="relative pl-6">
                <span
                  className={`absolute -left-3 top-0.5 w-6 h-6 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] flex items-center justify-center text-xs ${e.iconColor}`}
                  aria-hidden="true"
                >
                  {e.icon}
                </span>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-sm text-[var(--color-text-primary)]">{e.text}</div>
                  <div className="text-xs text-[var(--color-text-muted)] font-mono shrink-0">{fmtClock(e.ts)}</div>
                </div>
                {e.link && (
                  <Link href={e.link.href} className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">{e.link.label} →</Link>
                )}
                {e.details && (
                  <details className="mt-1">
                    <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]">Details</summary>
                    <pre className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap break-words mt-2 bg-[var(--color-bg-tertiary)] rounded p-3 font-mono">{e.details}</pre>
                  </details>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, span2 = false }: { label: string; value: string; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}
