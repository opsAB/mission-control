import { getAllMcFlows, getAllCronJobs, getAllProjects } from '@/lib/queries';
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Workflows</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{flows.length} flows · {cron.length} cron jobs</p>
      </div>

      {cron.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Recurring Jobs</h2>
          <div className="space-y-3">
            {cron.map(j => (
              <div key={j.id} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium">{j.name}</h3>
                      <StatusBadge status={j.enabled ? 'active' : 'idle'} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                      <span>Schedule: {j.schedule_human}</span>
                      <span>Agent: {j.agent_id}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-[var(--color-text-muted)] space-y-1">
                    {j.last_run && <div>Last: {timeAgo(j.last_run)}</div>}
                    {j.next_run && <div>Next: {new Date(j.next_run).toLocaleString()}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Flow Runs</h2>
        {flows.length === 0 ? (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-12 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">No flow runs yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {flows.map(f => {
              const project = f.project_id != null ? projectMap.get(f.project_id) : null;
              return (
                <div key={f.flow_id} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium">{f.name}</h3>
                        <StatusBadge status={f.status} />
                        <StalenessIndicator status={f.status} lastUpdate={f.updated_at} />
                      </div>
                      {f.blocked_summary && <p className="text-xs text-red-400 mb-1">Blocked: {f.blocked_summary}</p>}
                      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                        <span>{f.agent_emoji} {f.agent_name}</span>
                        <span>Revision {f.revision}</span>
                        {project && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                            {project.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-[var(--color-text-muted)]">
                      <div>Updated {timeAgo(f.updated_at)}</div>
                      {f.ended_at && <div>Ended {timeAgo(f.ended_at)}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
