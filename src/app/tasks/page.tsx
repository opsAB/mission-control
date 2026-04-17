import { getAllMcTasks, getAllProjects } from '@/lib/queries';
import { getNoteCountByTaskIds } from '@/lib/notes';
import TaskCard from './TaskCard';
import TaskDrawer from './TaskDrawer';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const columns = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'active', label: 'In Progress' },
  { key: 'done', label: 'Done' },
  { key: 'blocked', label: 'Blocked / Failed' },
] as const;

const DONE_DEFAULT_LIMIT = 15;

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ project?: string; agent?: string; showAll?: string }> }) {
  const { project, agent, showAll } = await searchParams;
  const projectId = project ? Number(project) : null;
  const agentId = agent ?? null;
  const showAllDone = showAll === 'done';

  const projects = getAllProjects();
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const selectedProject = projectId != null ? projectMap.get(projectId) : null;

  let tasks = getAllMcTasks({ excludeSubagents: true });
  if (projectId != null) tasks = tasks.filter(t => t.project_id === projectId);
  if (agentId) tasks = tasks.filter(t => t.agent_id === agentId);

  const noteCounts = getNoteCountByTaskIds(tasks.map(t => t.task_id));

  function buildUrl(extra: Record<string, string | null>): string {
    const params = new URLSearchParams();
    if (projectId != null) params.set('project', String(projectId));
    if (agentId) params.set('agent', agentId);
    for (const [k, v] of Object.entries(extra)) {
      if (v == null) params.delete(k); else params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/tasks?${qs}` : '/tasks';
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-3">
            Tasks
            {selectedProject && (
              <span className="text-sm font-normal flex items-center gap-2 text-[var(--color-text-secondary)]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedProject.color }} />
                {selectedProject.name}
              </span>
            )}
            {agentId && <span className="text-sm font-normal text-[var(--color-text-secondary)]">/ {agentId}</span>}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{tasks.length} tasks (subagents hidden) · click a card for detail</p>
        </div>
        {(projectId != null || agentId) && (
          <Link href="/tasks" className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">
            Clear filter →
          </Link>
        )}
      </div>

      {/* Project chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/tasks" className={`px-2.5 py-1 text-xs rounded-full border ${projectId == null && !agentId ? 'bg-[var(--color-bg-hover)] border-[var(--color-border-light)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-light)]'}`}>
          All
        </Link>
        {projects.map(p => (
          <Link key={p.id} href={`/tasks?project=${p.id}`} className={`px-2.5 py-1 text-xs rounded-full border flex items-center gap-1.5 ${projectId === p.id ? 'bg-[var(--color-bg-hover)] border-[var(--color-border-light)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-light)]'}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {columns.map(col => {
          const colTasks = tasks.filter(t => t.status === col.key);
          const isDoneCol = col.key === 'done';
          const visibleTasks = isDoneCol && !showAllDone ? colTasks.slice(0, DONE_DEFAULT_LIMIT) : colTasks;
          const hasMore = isDoneCol && !showAllDone && colTasks.length > DONE_DEFAULT_LIMIT;
          return (
            <div key={col.key} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg flex flex-col">
              <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{col.label}</h2>
                <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] rounded-full px-2 py-0.5">{colTasks.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[200px] max-h-[72vh] overflow-y-auto">
                {visibleTasks.map(t => {
                  const proj = t.project_id != null ? projectMap.get(t.project_id) : null;
                  return (
                    <TaskCard
                      key={t.task_id}
                      taskId={t.task_id}
                      title={t.title}
                      projectName={proj?.name ?? null}
                      projectColor={proj?.color ?? null}
                      agentEmoji={t.agent_emoji}
                      agentName={t.agent_name}
                      status={t.status}
                      updatedAt={t.updated_at}
                      noteCount={noteCounts.get(t.task_id) ?? 0}
                    />
                  );
                })}
                {hasMore && (
                  <Link href={buildUrl({ showAll: 'done' })} className="block text-center text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] py-2">
                    Show all {colTasks.length}
                  </Link>
                )}
                {isDoneCol && showAllDone && colTasks.length > DONE_DEFAULT_LIMIT && (
                  <Link href={buildUrl({ showAll: null })} className="block text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] py-2">
                    Show less
                  </Link>
                )}
                {colTasks.length === 0 && (
                  <div className="text-xs text-[var(--color-text-muted)] text-center py-4">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDrawer />
    </div>
  );
}
