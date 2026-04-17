import { getAllProjects, getTasksByProject, getWorkflowsByProject, getArtifactsByProject } from '@/lib/queries';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function ProjectsPage() {
  const projects = getAllProjects();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Projects</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{projects.length} projects</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map(p => {
          const tasks = getTasksByProject(p.id);
          const workflows = getWorkflowsByProject(p.id);
          const artifacts = getArtifactsByProject(p.id);

          const activeTasks = tasks.filter(t => t.status === 'active').length;
          const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
          const reviewTasks = tasks.filter(t => t.status === 'review').length;
          const activeWorkflows = workflows.filter(w => w.status === 'active').length;

          return (
            <div key={p.id} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-5 hover:border-[var(--color-border-light)] transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                <h2 className="text-base font-semibold">{p.name}</h2>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mb-4">{p.description}</p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[var(--color-bg-tertiary)] rounded px-3 py-2">
                  <div className="text-lg font-bold text-emerald-400">{activeTasks}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Active tasks</div>
                </div>
                <div className={`bg-[var(--color-bg-tertiary)] rounded px-3 py-2 ${blockedTasks > 0 ? 'border border-red-500/20' : ''}`}>
                  <div className={`text-lg font-bold ${blockedTasks > 0 ? 'text-red-400' : 'text-gray-400'}`}>{blockedTasks}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Blocked</div>
                </div>
                <div className="bg-[var(--color-bg-tertiary)] rounded px-3 py-2">
                  <div className="text-lg font-bold text-blue-400">{reviewTasks}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Review</div>
                </div>
                <div className="bg-[var(--color-bg-tertiary)] rounded px-3 py-2">
                  <div className="text-lg font-bold text-purple-400">{artifacts.length}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Artifacts</div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <span>{tasks.length} tasks</span>
                <span>·</span>
                <span>{activeWorkflows} active workflows</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
