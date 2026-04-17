import { getAllMcTasks, getAllProjects, getAllMcAgents } from '@/lib/queries';
import { getNoteCountByTaskIds } from '@/lib/notes';
import TaskCard from './TaskCard';
import TaskDrawer from './TaskDrawer';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const columns = [
  { key: 'backlog', label: 'Backlog', color: 'text-gray-400', accent: 'border-gray-500/30' },
  { key: 'active', label: 'In Progress', color: 'text-emerald-400', accent: 'border-emerald-500/30' },
  { key: 'done', label: 'Done', color: 'text-gray-400', accent: 'border-gray-500/20' },
  { key: 'blocked', label: 'Blocked / Failed', color: 'text-red-400', accent: 'border-red-500/30' },
] as const;

const DONE_DEFAULT_LIMIT = 15;

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ project?: string; agent?: string; status?: string; view?: string; showAll?: string }> }) {
  const { project, agent, status, view, showAll } = await searchParams;
  const projectId = project ? Number(project) : null;
  const agentId = agent ?? null;
  const statusFilter = status ?? null;
  const boardView = view === 'board' || !!statusFilter;
  const showAllDone = showAll === 'done';

  const projects = getAllProjects();
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const selectedProject = projectId != null ? projectMap.get(projectId) : null;
  const allAgents = getAllMcAgents();
  const agentMap = new Map(allAgents.map(a => [a.id, a]));
  const selectedAgent = agentId ? agentMap.get(agentId) : null;

  let tasks = getAllMcTasks({ excludeSubagents: true });
  if (projectId != null) tasks = tasks.filter(t => t.project_id === projectId);
  if (agentId) tasks = tasks.filter(t => t.agent_id === agentId);
  const filteredForDisplay = statusFilter ? tasks.filter(t => t.status === statusFilter) : tasks;

  const noteCounts = getNoteCountByTaskIds(filteredForDisplay.map(t => t.task_id));

  function buildUrl(extra: Record<string, string | null>): string {
    const params = new URLSearchParams();
    if (projectId != null) params.set('project', String(projectId));
    if (agentId) params.set('agent', agentId);
    if (statusFilter) params.set('status', statusFilter);
    if (boardView) params.set('view', 'board');
    for (const [k, v] of Object.entries(extra)) {
      if (v == null) params.delete(k); else params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/tasks?${qs}` : '/tasks';
  }

  // Status counts for the overview (based on project/agent filter, before status filter)
  const statusCounts = columns.map(c => ({
    ...c,
    count: tasks.filter(t => t.status === c.key).length,
  }));
  const waitingCount = tasks.filter(t => t.status === 'waiting').length;
  const reviewCount = tasks.filter(t => t.status === 'review').length;

  const title = selectedProject ? selectedProject.name : selectedAgent ? selectedAgent.name : 'Tasks';

  return (
    <div className="p-6">
      {/* Header + view toggle */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-3 flex-wrap">
            {title}
            {selectedProject && (
              <span className="text-sm font-normal flex items-center gap-2 text-[var(--color-text-secondary)]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedProject.color }} />
              </span>
            )}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {tasks.length} tasks (subagents hidden)
            {statusFilter && <> · filtered to <span className="text-[var(--color-text-primary)]">{statusFilter}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={buildUrl({ view: null, status: null, showAll: null })}
            className={`px-3 py-1.5 text-xs rounded border transition-colors ${
              !boardView ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-light)]'
            }`}
          >
            Overview
          </Link>
          <Link
            href={buildUrl({ view: 'board', status: null })}
            className={`px-3 py-1.5 text-xs rounded border transition-colors ${
              boardView && !statusFilter ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-light)]'
            }`}
          >
            Board
          </Link>
          {(projectId != null || agentId || statusFilter) && (
            <Link href="/tasks" className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] ml-2">
              Clear filters →
            </Link>
          )}
        </div>
      </div>

      {/* Project chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href={buildUrl({ project: null })} className={`px-2.5 py-1 text-xs rounded-full border ${projectId == null ? 'bg-[var(--color-bg-hover)] border-[var(--color-border-light)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-light)]'}`}>
          All projects
        </Link>
        {projects.map(p => (
          <Link key={p.id} href={buildUrl({ project: String(p.id) })} className={`px-2.5 py-1 text-xs rounded-full border flex items-center gap-1.5 ${projectId === p.id ? 'bg-[var(--color-bg-hover)] border-[var(--color-border-light)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-light)]'}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}
          </Link>
        ))}
      </div>

      {!boardView ? (
        <OverviewLayout statusCounts={statusCounts} buildUrl={buildUrl} waitingCount={waitingCount} reviewCount={reviewCount} />
      ) : (
        <BoardLayout
          tasks={filteredForDisplay}
          projectMap={projectMap}
          noteCounts={noteCounts}
          showAllDone={showAllDone}
          statusFilter={statusFilter}
          buildUrl={buildUrl}
        />
      )}

      <TaskDrawer />
    </div>
  );
}

function OverviewLayout({ statusCounts, buildUrl, waitingCount, reviewCount }: {
  statusCounts: Array<{ key: string; label: string; color: string; accent: string; count: number }>;
  buildUrl: (extra: Record<string, string | null>) => string;
  waitingCount: number;
  reviewCount: number;
}) {
  return (
    <div className="space-y-6">
      {/* Primary 4 status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statusCounts.map(s => (
          <Link
            key={s.key}
            href={buildUrl({ view: 'board', status: s.key })}
            className={`bg-[var(--color-bg-secondary)] border ${s.count > 0 ? s.accent : 'border-[var(--color-border)]'} rounded-lg p-5 hover:border-[var(--color-border-light)] transition-colors`}
          >
            <div className={`text-3xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-sm text-[var(--color-text-secondary)] mt-1">{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Secondary: waiting and review if non-zero */}
      {(waitingCount > 0 || reviewCount > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {waitingCount > 0 && (
            <Link href={buildUrl({ view: 'board', status: 'waiting' })} className="bg-[var(--color-bg-secondary)] border border-amber-500/30 rounded-lg p-4 hover:border-[var(--color-border-light)] transition-colors">
              <div className="text-2xl font-bold text-amber-400">{waitingCount}</div>
              <div className="text-xs text-[var(--color-text-secondary)] mt-1">Waiting</div>
            </Link>
          )}
          {reviewCount > 0 && (
            <Link href={buildUrl({ view: 'board', status: 'review' })} className="bg-[var(--color-bg-secondary)] border border-blue-500/30 rounded-lg p-4 hover:border-[var(--color-border-light)] transition-colors">
              <div className="text-2xl font-bold text-blue-400">{reviewCount}</div>
              <div className="text-xs text-[var(--color-text-secondary)] mt-1">Review</div>
            </Link>
          )}
        </div>
      )}

      <p className="text-xs text-[var(--color-text-muted)] text-center">
        Click a card to see that column, or use <span className="text-[var(--color-text-secondary)] font-medium">Board</span> above for the full kanban.
      </p>
    </div>
  );
}

function BoardLayout({ tasks, projectMap, noteCounts, showAllDone, statusFilter, buildUrl }: {
  tasks: ReturnType<typeof getAllMcTasks>;
  projectMap: Map<number, { id: number; name: string; description: string; color: string }>;
  noteCounts: Map<string, number>;
  showAllDone: boolean;
  statusFilter: string | null;
  buildUrl: (extra: Record<string, string | null>) => string;
}) {
  const visibleColumns = statusFilter ? columns.filter(c => c.key === statusFilter) : columns;
  const gridCols = visibleColumns.length === 1 ? 'lg:grid-cols-1 max-w-3xl' : 'lg:grid-cols-4';

  return (
    <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
      {visibleColumns.map(col => {
        const colTasks = tasks.filter(t => t.status === col.key);
        const isDoneCol = col.key === 'done';
        const visibleTasks = isDoneCol && !showAllDone ? colTasks.slice(0, DONE_DEFAULT_LIMIT) : colTasks;
        const hasMore = isDoneCol && !showAllDone && colTasks.length > DONE_DEFAULT_LIMIT;
        return (
          <div key={col.key} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className={`text-sm font-semibold uppercase tracking-wider ${col.color}`}>{col.label}</h2>
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
  );
}
