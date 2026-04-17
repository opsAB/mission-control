import { listMemoryAgents, listMemoryFiles, readMemoryFileContent, memoryAvailable, searchMemory } from '@/lib/memory';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function ago(mtimeMs: number): string {
  const seconds = Math.floor((Date.now() - mtimeMs) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatSize(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n/1024).toFixed(1)}KB`;
  return `${(n/(1024*1024)).toFixed(1)}MB`;
}

export default async function MemoryPage({ searchParams }: { searchParams: Promise<{ a?: string; f?: string; q?: string }> }) {
  const { a, f, q } = await searchParams;

  if (!memoryAvailable()) {
    return (
      <div className="p-6 max-w-4xl">
        <h1 className="text-xl font-semibold mb-2">Memory</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Not available — ~/.openclaw/memory/ not found.</p>
      </div>
    );
  }

  const agents = listMemoryAgents();
  const agentId = a ?? (agents[0]?.agent_id ?? '');
  const files = agentId ? listMemoryFiles(agentId) : [];
  const selected = agentId && f ? readMemoryFileContent(agentId, f) : null;
  const searchResults = agentId && q ? searchMemory(agentId, q, 25) : [];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Memory</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Agent memory indexes from ~/.openclaw/memory/*.sqlite — searchable and browsable</p>
      </div>

      {/* Agent tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-[var(--color-border)]">
        {agents.map(ag => (
          <Link
            key={ag.agent_id}
            href={`/memory?a=${ag.agent_id}`}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              agentId === ag.agent_id
                ? 'border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {ag.name}
            <span className="ml-2 text-xs text-[var(--color-text-muted)]">{ag.file_count} files · {ag.chunk_count} chunks</span>
          </Link>
        ))}
      </div>

      {/* Search */}
      <form method="GET" action="/memory" className="mb-4">
        <input type="hidden" name="a" value={agentId} />
        <input
          type="text"
          name="q"
          defaultValue={q ?? ''}
          placeholder={`Search ${agents.find(ag => ag.agent_id === agentId)?.name ?? ''}'s memory…`}
          className="w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm"
        />
      </form>

      {q && searchResults.length > 0 && (
        <section className="mb-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Search results ({searchResults.length})</h2>
          <div className="space-y-3">
            {searchResults.map((r, i) => (
              <Link key={i} href={`/memory?a=${agentId}&f=${encodeURIComponent(r.path)}`} className="block bg-[var(--color-bg-tertiary)] rounded p-3 hover:border-[var(--color-border-light)] border border-[var(--color-border)]">
                <div className="text-xs text-[var(--color-accent)] font-mono mb-1">{r.path} (line {r.start_line})</div>
                <div className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">{r.text}…</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <aside className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg overflow-hidden max-h-[75vh] overflow-y-auto">
          {files.length === 0 ? (
            <div className="p-4 text-sm text-[var(--color-text-muted)]">No memory files for this agent.</div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {files.map(file => (
                <li key={file.path}>
                  <Link
                    href={`/memory?a=${agentId}&f=${encodeURIComponent(file.path)}`}
                    className={`block px-3 py-2 hover:bg-[var(--color-bg-hover)] transition-colors ${f === file.path ? 'bg-[var(--color-bg-hover)] border-l-2 border-[var(--color-accent)]' : ''}`}
                  >
                    <div className="text-sm truncate">{file.path.replace(/^memory\//, '')}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{ago(file.mtime)} · {formatSize(file.size)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-5 max-h-[75vh] overflow-y-auto">
          {selected ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold font-mono">{selected.path}</h2>
                <span className="text-xs text-[var(--color-text-muted)]">{selected.chunk_count} chunks · {ago(selected.mtime)}</span>
              </div>
              <pre className="text-xs font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap">{selected.text}</pre>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">Select a memory file to read its contents. Or use the search box above to search across all of {agents.find(ag => ag.agent_id === agentId)?.name ?? ''}&apos;s memory.</p>
          )}
        </div>
      </div>
    </div>
  );
}
