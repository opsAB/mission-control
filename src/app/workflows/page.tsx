import { getAllWorkflows, getAllProjects } from '@/lib/queries';
import { timeAgo } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import StalenessIndicator from '@/components/StalenessIndicator';

export const dynamic = 'force-dynamic';

export default function WorkflowsPage() {
  const workflows = getAllWorkflows();
  const projects = getAllProjects();
  const projectMap = new Map(projects.map(p => [p.id, p]));

  const recurring = workflows.filter(w => w.is_recurring);
  const oneOff = workflows.filter(w => !w.is_recurring);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Workflows</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{workflows.length} workflows ({recurring.length} recurring)</p>
      </div>

      {/* Recurring workflows */}
      {recurring.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Recurring</h2>
          <div className="space-y-3">
            {recurring.map(w => {
              const project = w.project_id ? projectMap.get(w.project_id) : null;
              return (
                <div key={w.id} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium">{w.name}</h3>
                        <StatusBadge status={w.status} />
                        <StalenessIndicator status={w.status} lastUpdate={w.last_meaningful_update} />
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mb-2">{w.summary}</p>
                      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                        <span>Schedule: {w.cron_schedule}</span>
                        <span>Executor: {w.executor}</span>
                        {project && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                            {project.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-[var(--color-text-muted)] space-y-1">
                      {w.last_run && <div>Last run: {timeAgo(w.last_run)}</div>}
                      {w.next_run && <div>Next: {w.next_run.slice(11, 16)}</div>}
                      <div className="flex gap-2 mt-2">
                        <StatusBadge status={w.delivery_status} />
                        {w.review_status !== 'none' && <StatusBadge status={w.review_status} />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* One-off workflows */}
      {oneOff.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Active Workflows</h2>
          <div className="space-y-3">
            {oneOff.map(w => {
              const project = w.project_id ? projectMap.get(w.project_id) : null;
              return (
                <div key={w.id} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium">{w.name}</h3>
                        <StatusBadge status={w.status} />
                        <StalenessIndicator status={w.status} lastUpdate={w.last_meaningful_update} />
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mb-2">{w.summary}</p>
                      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                        <span>Executor: {w.executor}</span>
                        {project && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                            {project.name}
                          </span>
                        )}
                        <span>Updated: {timeAgo(w.last_meaningful_update)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <StatusBadge status={w.delivery_status} />
                      {w.review_status !== 'none' && <StatusBadge status={w.review_status} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
