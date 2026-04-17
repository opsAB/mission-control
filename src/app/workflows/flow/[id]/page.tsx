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

  const failedStep = data.steps.find(s => s.status === 'blocked' || s.oc_status === 'failed');
  const flowFailed = flow.status === 'blocked' || flow.oc_status === 'failed';

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

      {(flowFailed || failedStep) && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-400 text-lg leading-none mt-0.5" aria-hidden="true">✕</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-red-400 mb-1">
                {flowFailed ? 'Flow failed' : `Step failed (${agentDisplayName(failedStep?.agent_id ?? null)})`}
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {flow.blocked_summary ||
                  failedStep?.error ||
                  failedStep?.terminal_summary ||
                  'No error detail captured. Check the failed step below for terminal summary.'}
              </p>
              {failedStep && (
                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                  Failure point: <span className="text-[var(--color-text-secondary)]">{failedStep.preview}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 mb-6 grid grid-cols-2 gap-4">
        <Field label="Orchestrator" value={`${flow.agent_emoji ? flow.agent_emoji + ' ' : ''}${agentDisplayName(flow.agent_id, flow.agent_name)}`} />
        <Field label="Events" value={`${timeline.length}`} />
        <Field label="Started" value={formatEstTimestamp(flow.created_at)} />
        <Field label="Ended" value={flow.ended_at ? formatEstTimestamp(flow.ended_at) : '—'} />
        <Field label="Duration" value={fmtDuration(totalMs)} span2 />
        {flow.blocked_summary && <Field label="Blocked reason" value={flow.blocked_summary} span2 />}
      </div>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Timeline</h2>
          <span className="text-xs text-[var(--color-text-muted)]">{timeline.length} events</span>
        </div>
        <details className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-xs text-[var(--color-text-secondary)] leading-relaxed mb-3">
          <summary className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">What &quot;delegated&quot; means</summary>
          <p className="mt-2">
            Agents are identities — Alfred, James, Milo, Lewis. When Alfred &quot;delegates&quot; to James, he opens a <em>sub-agent session</em> that runs under James&apos;s identity (his memory, role, workspace). That session is one step in the flow. James can spawn further sub-agent sessions of his own if he needs them. The word &quot;sub-agent&quot; describes the mode of invocation, not a class of agent.
          </p>
        </details>
        {timeline.length === 0 ? (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">No recorded events.</p>
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
