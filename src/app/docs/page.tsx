import Link from 'next/link';
import { getAllArtifacts, getAllProjects } from '@/lib/queries';
import { timeAgo } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default function DocsPage() {
  const artifacts = getAllArtifacts();
  const projects = getAllProjects();
  const projectMap = new Map(projects.map(p => [p.id, p]));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Docs & Deliverables</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{artifacts.length} artifacts</p>
      </div>

      {artifacts.length === 0 ? (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-12 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">No artifacts yet. Artifacts appear here when agents produce browser-openable deliverables.</p>
        </div>
      ) : (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Project</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Owner</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Review</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Created</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {artifacts.map(a => {
                const project = a.project_id ? projectMap.get(a.project_id) : null;
                return (
                  <tr key={a.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-hover)] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">
                      <Link href={`/docs/${a.id}`} className="hover:text-[var(--color-accent)]">{a.title}</Link>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={a.type} /></td>
                    <td className="px-4 py-3">
                      {project && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                          <span className="text-xs text-[var(--color-text-secondary)]">{project.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{a.owner}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.review_status} /></td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{timeAgo(a.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/docs/${a.id}`}
                        className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
