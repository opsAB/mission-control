import { getAllProjects, getMcTasksByProject, getMcFlowsByProject, getArtifactsByProject, getAllMcTasks } from '@/lib/queries';
import AutoTagButton from './AutoTagButton';

export const dynamic = 'force-dynamic';

export default function ProjectsPage() {
  const projects = getAllProjects();
  const allTasks = getAllMcTasks({ excludeSubagents: true, limit: 1000 });
  const untagged = allTasks.filter(t => t.project_id == null).length;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{projects.length} projects · {untagged} tasks untagged</p>
        </div>
        {untagged > 0 && <AutoTagButton />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map(p => {
          const tasks = getMcTasksByProject(p.id);
          const flows = getMcFlowsByProject(p.id);
          const artifacts = getArtifactsByProject(p.id);

          const active = tasks.filter(t => t.status === 'active').length;
          const blocked = tasks.filter(t => t.status === 'blocked').length;
          const pendingReview = tasks.filter(t => t.review_status === 'pending').length;

          return (
            <div key={p.id} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-5 hover:border-[var(--color-border-light)] transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                <h2 className="text-base font-semibold">{p.name}</h2>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mb-4">{p.description}</p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[var(--color-bg-tertiary)] rounded px-3 py-2">
                  <div className="text-lg font-bold text-emerald-400">{active}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Active</div>
                </div>
                <div className={`bg-[var(--color-bg-tertiary)] rounded px-3 py-2 ${blocked > 0 ? 'border border-red-500/20' : ''}`}>
                  <div className={`text-lg font-bold ${blocked > 0 ? 'text-red-400' : 'text-gray-400'}`}>{blocked}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Blocked</div>
                </div>
                <div className="bg-[var(--color-bg-tertiary)] rounded px-3 py-2">
                  <div className="text-lg font-bold text-blue-400">{pendingReview}</div>
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
                <span>{flows.length} flows</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
