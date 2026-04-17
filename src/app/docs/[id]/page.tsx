import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getArtifactById, getAllProjects } from '@/lib/queries';
import { renderArtifact } from '@/lib/render';
import { timeAgo } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import ArtifactReview from './ArtifactReview';

export const dynamic = 'force-dynamic';

export default async function ArtifactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const artifact = getArtifactById(Number(id));
  if (!artifact) notFound();

  const projects = getAllProjects();
  const project = artifact.project_id ? projects.find(p => p.id === artifact.project_id) : null;
  const rendered = renderArtifact(artifact.file_path);

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-4">
        <Link href="/docs" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">← Docs</Link>
      </div>

      <div className="flex items-start justify-between gap-6 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold mb-2">{artifact.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)]">
            <StatusBadge status={artifact.type} />
            <StatusBadge status={artifact.review_status} />
            {project && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                {project.name}
              </span>
            )}
            <span>{artifact.agent_id ?? artifact.owner}</span>
            <span>{timeAgo(artifact.created_at)}</span>
            {rendered.size != null && <span>{formatSize(rendered.size)}</span>}
          </div>
          {artifact.summary && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-3 leading-relaxed">{artifact.summary}</p>
          )}
          {artifact.review_note && (
            <div className="mt-3 p-3 border border-amber-500/30 bg-amber-500/10 rounded text-xs">
              <div className="font-semibold text-amber-400 mb-1">Revision note</div>
              <div className="text-[var(--color-text-secondary)] whitespace-pre-wrap">{artifact.review_note}</div>
            </div>
          )}
        </div>
        <div className="shrink-0">
          <ArtifactReview id={artifact.id} currentStatus={artifact.review_status} />
        </div>
      </div>

      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
          <span className="font-mono">{rendered.filename ?? 'file'}</span>
          {artifact.serve_url && (
            <a href={artifact.serve_url} download className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">
              Download raw →
            </a>
          )}
        </div>
        <div className="p-6">
          {rendered.kind === 'missing' && (
            <p className="text-sm text-[var(--color-text-muted)]">File not found on disk. It may have been produced by the agent but not written to the artifact directory.</p>
          )}
          {rendered.kind === 'markdown' && (
            <div className="prose-mc" dangerouslySetInnerHTML={{ __html: rendered.html ?? '' }} />
          )}
          {rendered.kind === 'html' && (
            <iframe srcDoc={rendered.html ?? ''} className="w-full min-h-[60vh] bg-white rounded" />
          )}
          {(rendered.kind === 'text' || rendered.kind === 'json') && (
            <pre className="text-xs whitespace-pre-wrap break-words text-[var(--color-text-primary)] font-mono leading-relaxed">{rendered.text}</pre>
          )}
          {rendered.kind === 'pdf' && artifact.serve_url && (
            <iframe src={artifact.serve_url} className="w-full min-h-[70vh] bg-white rounded" />
          )}
          {rendered.kind === 'image' && artifact.serve_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artifact.serve_url} alt={artifact.title} className="max-w-full rounded" />
          )}
          {rendered.kind === 'binary' && (
            <p className="text-sm text-[var(--color-text-muted)]">Binary file — use Download raw to inspect locally.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
