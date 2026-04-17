import { getAllTasks, getAllProjects } from '@/lib/queries';
import { timeAgo } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import StalenessIndicator from '@/components/StalenessIndicator';

export const dynamic = 'force-dynamic';

const columns = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'active', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
] as const;

export default function TasksPage() {
  const tasks = getAllTasks();
  const projects = getAllProjects();
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const blocked = tasks.filter(t => t.status === 'blocked');
  const waiting = tasks.filter(t => t.status === 'waiting');

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Tasks</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{tasks.length} total tasks</p>
      </div>

      {/* Blocked + waiting alerts */}
      {(blocked.length > 0 || waiting.length > 0) && (
        <div className="flex gap-3 mb-6">
          {blocked.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded px-3 py-1.5 text-xs text-red-400 font-medium">
              {blocked.length} blocked
            </div>
          )}
          {waiting.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded px-3 py-1.5 text-xs text-amber-400 font-medium">
              {waiting.length} waiting
            </div>
          )}
        </div>
      )}

      {/* Kanban board */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {columns.map(col => {
          const colTasks = tasks.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
              <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{col.label}</h2>
                <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] rounded-full px-2 py-0.5">{colTasks.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[200px]">
                {colTasks.map(t => {
                  const project = t.project_id ? projectMap.get(t.project_id) : null;
                  return (
                    <div key={t.id} className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md p-3 hover:border-[var(--color-border-light)] transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm font-medium leading-tight">{t.title}</span>
                        <StatusBadge status={t.priority} />
                      </div>
                      {project && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                          <span className="text-xs text-[var(--color-text-secondary)]">{project.name}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--color-text-muted)]">{t.executor}</span>
                        <div className="flex items-center gap-2">
                          <StalenessIndicator status={t.status} lastUpdate={t.updated_at} />
                          <span className="text-xs text-[var(--color-text-muted)]">{timeAgo(t.updated_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Blocked + waiting sections below the board */}
      {blocked.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">Blocked</h2>
          <div className="space-y-2">
            {blocked.map(t => (
              <div key={t.id} className="bg-red-500/5 border border-red-500/20 rounded-md p-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">{t.title}</span>
                  <span className="text-xs text-[var(--color-text-secondary)] ml-2">{t.executor}</span>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">{timeAgo(t.updated_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {waiting.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3">Waiting</h2>
          <div className="space-y-2">
            {waiting.map(t => (
              <div key={t.id} className="bg-amber-500/5 border border-amber-500/20 rounded-md p-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">{t.title}</span>
                  <span className="text-xs text-[var(--color-text-secondary)] ml-2">{t.executor}</span>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">{timeAgo(t.updated_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
