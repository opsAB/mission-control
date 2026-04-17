import { listMemory, memoryAvailable, readMemoryFile } from '@/lib/memory';
import { timeAgo } from '@/lib/types';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MemoryPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p = '' } = await searchParams;
  const available = memoryAvailable();

  if (!available) {
    return (
      <div className="p-6 max-w-4xl">
        <h1 className="text-xl font-semibold mb-2">Memory</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Not available — OpenClaw memory directory not found at ~/.openclaw/memory.</p>
      </div>
    );
  }

  const selectedFile = p ? readMemoryFile(p) : null;
  // If p points to a directory, readMemoryFile returns null; list contents of that dir.
  // Otherwise, list the parent directory so the sidebar shows siblings.
  const listPath = selectedFile ? (p.includes('/') ? p.split('/').slice(0, -1).join('/') : '') : p;
  const entries = listMemory(listPath);

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Memory</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Agent memories from ~/.openclaw/memory</p>
        <Breadcrumb path={p} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <aside className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg overflow-hidden max-h-[75vh] overflow-y-auto">
          {entries.length === 0 ? (
            <div className="p-4 text-sm text-[var(--color-text-muted)]">Empty directory.</div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {entries.map(e => (
                <li key={e.relpath}>
                  <Link
                    href={`/memory?p=${encodeURIComponent(e.relpath)}`}
                    className={`block px-3 py-2 hover:bg-[var(--color-bg-hover)] transition-colors ${p === e.relpath ? 'bg-[var(--color-bg-hover)]' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{e.is_dir ? '📁' : '📄'}</span>
                      <span className="text-sm truncate flex-1">{e.name}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{timeAgo(e.mtime)}{!e.is_dir && ` · ${formatSize(e.size)}`}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-5">
          {selectedFile ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold font-mono text-[var(--color-text-primary)]">{selectedFile.relpath}</h2>
                <span className="text-xs text-[var(--color-text-muted)]">{formatSize(selectedFile.size)} · {timeAgo(selectedFile.mtime)}</span>
              </div>
              <pre className="text-xs font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap bg-[var(--color-bg-tertiary)] rounded p-4 max-h-[70vh] overflow-y-auto">{selectedFile.content}</pre>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">Select a file to preview.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Breadcrumb({ path }: { path: string }) {
  const parts = path ? path.split(/[/\\]/).filter(Boolean) : [];
  return (
    <nav className="text-xs text-[var(--color-text-muted)] mt-2 flex items-center gap-1">
      <Link href="/memory" className="hover:text-[var(--color-accent)]">memory</Link>
      {parts.map((p, i) => {
        const sub = parts.slice(0, i + 1).join('/');
        return (
          <span key={i} className="flex items-center gap-1">
            <span>/</span>
            <Link href={`/memory?p=${encodeURIComponent(sub)}`} className="hover:text-[var(--color-accent)]">{p}</Link>
          </span>
        );
      })}
    </nav>
  );
}

function formatSize(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n/1024).toFixed(1)}KB`;
  return `${(n/(1024*1024)).toFixed(1)}MB`;
}
