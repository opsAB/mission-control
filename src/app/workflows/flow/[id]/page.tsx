import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMcFlowById } from '@/lib/queries';
import { agentDisplayName, formatEstTimestamp } from '@/lib/format';
import { timeAgo } from '@/lib/types';
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

export default async function FlowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getMcFlowById(id);
  if (!data) notFound();
  const { flow, steps } = data;

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
        <Field label="Steps" value={`${steps.length} task${steps.length === 1 ? '' : 's'}`} />
        <Field label="Started" value={formatEstTimestamp(flow.created_at)} />
        <Field label="Ended" value={flow.ended_at ? formatEstTimestamp(flow.ended_at) : '—'} />
        <Field label="Duration" value={fmtDuration(totalMs)} />
        <Field label="Revision" value={String(flow.revision)} />
        {flow.blocked_summary && <Field label="Blocked reason" value={flow.blocked_summary} span2 />}
      </div>

      <section>
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Steps</h2>
        {steps.length === 0 ? (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">This flow has no recorded child tasks. It ran entirely inside the orchestrator without spawning a sub-agent.</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s.task_id} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-[var(--color-text-muted)] font-mono w-6 shrink-0">{i + 1}</span>
                    <span className="text-sm font-medium truncate">{s.preview}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={s.status} />
                  </div>
                </div>
                <div className="flex items-center flex-wrap gap-3 text-xs text-[var(--color-text-muted)] pl-9">
                  <span>{s.agent_emoji} {agentDisplayName(s.agent_id, s.agent_name)}</span>
                  <span>·</span>
                  <span>{fmtDuration(s.duration_ms)}</span>
                  <span>·</span>
                  <span>started {s.started_at ? timeAgo(s.started_at) : '—'}</span>
                  {s.ended_at && <><span>·</span><span>ended {timeAgo(s.ended_at)}</span></>}
                </div>
                {s.error && (
                  <div className="mt-2 pl-9 text-xs text-red-400">{s.error}</div>
                )}
                {(s.terminal_summary || s.progress_summary) && (
                  <details className="mt-2 pl-9">
                    <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]">Details</summary>
                    <pre className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap break-words mt-2 bg-[var(--color-bg-tertiary)] rounded p-3 font-mono">{s.terminal_summary ?? s.progress_summary}</pre>
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
