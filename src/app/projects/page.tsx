import { getAllProjects, getMcTasksByProject, getMcFlowsByProject, getArtifactsByProject, getAllMcTasks } from '@/lib/queries';
import AutoTagButton from './AutoTagButton';
import Link from 'next/link';

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
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {projects.length} projects · {untagged} tasks untagged · Click a card to see its work
          </p>
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
          const done = tasks.filter(t => t.status === 'done').length;

          return (
            <Link
              key={p.id}
              href={`/tasks?project=${p.id}`}
              className="block bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-5 hover:border-[var(--color-border-light)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                <h2 className="text-base font-semibold">{p.name}</h2>
                <span className="ml-auto text-xs text-[var(--color-text-muted)]">{tasks.length} tasks →</span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mb-4">{p.description}</p>

              <div className="grid grid-cols-4 gap-2 mb-3">
                <Metric label="Active" value={active} color="text-emerald-400" />
                <Metric label="Blocked" value={blocked} color={blocked > 0 ? 'text-red-400' : 'text-gray-500'} highlight={blocked > 0} />
                <Metric label="Review" value={pendingReview} color="text-blue-400" />
                <Metric label="Done" value={done} color="text-gray-400" />
              </div>

              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                <span>{flows.length} flows</span>
                <span>·</span>
                <span>{artifacts.length} artifacts</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div className={`bg-[var(--color-bg-tertiary)] rounded px-2 py-1.5 ${highlight ? 'border border-red-500/30' : ''}`}>
      <div className={`text-base font-bold ${color}`}>{value}</div>
      <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}
