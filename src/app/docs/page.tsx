import { getAllArtifacts, getAllProjects } from '@/lib/queries';
import DocsTable from './DocsTable';

export const dynamic = 'force-dynamic';

export default function DocsPage() {
  const artifacts = getAllArtifacts();
  const projects = getAllProjects();

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
        <DocsTable artifacts={artifacts} projects={projects} />
      )}
    </div>
  );
}
