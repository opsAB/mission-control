import Link from 'next/link';
import { getAllMcFlows, getAllCronJobs, getAllProjects } from '@/lib/queries';
import { getOpenClawFlowTasks } from '@/lib/openclaw';
import { humanizeCron } from '@/lib/system-cron';
import { formatEstTimestamp, agentDisplayName } from '@/lib/format';
import { timeAgo } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import StalenessIndicator from '@/components/StalenessIndicator';

export const dynamic = 'force-dynamic';

export default function WorkflowsPage() {
  const flows = getAllMcFlows();
  const cron = getAllCronJobs();
  const projects = getAllProjects();
  const projectMap = new Map(projects.map(p => [p.id, p]));

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Workflows</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Recurring jobs and multi-step flow runs</p>
      </div>

      {cron.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Recurring Jobs</h2>
          <div className="space-y-2">
            {cron.map(j => {
              const humanSchedule = j.schedule_cron ? humanizeCron(j.schedule_cron) : j.schedule_human;
              return (
                <Link
                  key={j.id}
                  href={`/workflows/cron/${encodeURIComponent(j.id)}`}
                  className="block bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-border-light)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium">{j.name}</h3>
                        <StatusBadge status={j.enabled ? 'active' : 'idle'} />
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)]">{humanSchedule}</div>
                      {j.description && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-1.5 line-clamp-2">{j.description}</p>
                      )}
                    </div>
                    <div className="text-right text-xs text-[var(--color-text-muted)] shrink-0 space-y-0.5">
                      {j.next_run && <div>Next: {formatEstTimestamp(j.next_run)}</div>}
                      {j.last_run && <div>Last: {timeAgo(j.last_run)}</div>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Flow Runs</h2>
          <span className="text-xs text-[var(--color-text-muted)]">{flows.length} total</span>
        </div>
        <div className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-xs text-[var(--color-text-secondary)] leading-relaxed mb-3">
          A flow run is OpenClaw&apos;s record of a multi-step workflow — an orchestrated sequence with branching, goals, and revisions, as opposed to a single one-shot task. Most work you dispatch to Alfred runs as tasks, not flows; flows show up when an agent uses OpenClaw&apos;s flow API (currently used by the morning-report pipeline and some agent-internal planning).
        </div>
        {flows.length === 0 ? (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-8 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">No flow runs recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...flows]
              .sort((a, b) => {
                const af = a.status === 'blocked' || a.oc_status === 'failed' ? 0 : 1;
                const bf = b.status === 'blocked' || b.oc_status === 'failed' ? 0 : 1;
                if (af !== bf) return af - bf;
                return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
              })
              .map(f => {
              const project = f.project_id != null ? projectMap.get(f.project_id) : null;
              const stepCount = getOpenClawFlowTasks(f.flow_id).length;
              const failed = f.status === 'blocked' || f.oc_status === 'failed';
              const durationMs = f.ended_at
                ? new Date(f.ended_at).getTime() - new Date(f.created_at).getTime()
                : null;
              const durationLabel = durationMs == null
                ? 'running'
                : durationMs < 60_000
                  ? `${Math.round(durationMs / 1000)}s`
                  : `${Math.round(durationMs / 60_000)}m`;
              return (
                <Link
                  key={f.flow_id}
                  href={`/workflows/flow/${encodeURIComponent(f.flow_id)}`}
                  className={`block bg-[var(--color-bg-secondary)] border rounded-lg p-4 hover:border-[var(--color-border-light)] transition-colors ${failed ? 'border-red-500/40 bg-red-500/5 hover:border-red-500/60' : 'border-[var(--color-border)]'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium truncate">{f.name}</h3>
                        <StatusBadge status={f.status} />
                        <StalenessIndicator status={f.status} lastUpdate={f.updated_at} />
                      </div>
                      {f.blocked_summary && <p className="text-xs text-red-400 mb-1">Blocked: {f.blocked_summary}</p>}
                      <div className="flex items-center flex-wrap gap-3 text-xs text-[var(--color-text-muted)]">
                        <span>Orchestrator: {f.agent_emoji} {agentDisplayName(f.agent_id, f.agent_name)}</span>
                        <span>·</span>
                        <span>{stepCount} step{stepCount === 1 ? '' : 's'}</span>
                        <span>·</span>
                        <span>{durationLabel}</span>
                        {project && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                              {project.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-[var(--color-text-muted)] shrink-0">
                      <div>{f.ended_at ? `Ended ${timeAgo(f.ended_at)}` : `Updated ${timeAgo(f.updated_at)}`}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
