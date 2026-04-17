import { getAllMcTasks, getAllProjects } from '@/lib/queries';
import { timeAgo } from '@/lib/types';
import StalenessIndicator from '@/components/StalenessIndicator';

export const dynamic = 'force-dynamic';

const columns = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'active', label: 'In Progress' },
  { key: 'done', label: 'Done' },
  { key: 'blocked', label: 'Blocked / Failed' },
] as const;

export default function TasksPage() {
  const tasks = getAllMcTasks({ excludeSubagents: true });
  const projects = getAllProjects();
  const projectMap = new Map(projects.map(p => [p.id, p]));

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tasks</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{tasks.length} tasks (subagents hidden)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {columns.map(col => {
          const colTasks = tasks.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg flex flex-col">
              <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{col.label}</h2>
                <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] rounded-full px-2 py-0.5">{colTasks.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[200px] max-h-[70vh] overflow-y-auto">
                {colTasks.slice(0, 50).map(t => {
                  const project = t.project_id != null ? projectMap.get(t.project_id) : null;
                  return (
                    <div key={t.task_id} className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md p-3 hover:border-[var(--color-border-light)] transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm font-medium leading-tight line-clamp-2">{t.title}</span>
                      </div>
                      {project && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                          <span className="text-xs text-[var(--color-text-secondary)]">{project.name}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--color-text-muted)]">{t.agent_emoji} {t.agent_name}</span>
                        <div className="flex items-center gap-2">
                          <StalenessIndicator status={t.status} lastUpdate={t.updated_at} />
                          <span className="text-xs text-[var(--color-text-muted)]">{timeAgo(t.updated_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {colTasks.length > 50 && (
                  <div className="text-xs text-[var(--color-text-muted)] text-center py-2">+ {colTasks.length - 50} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
