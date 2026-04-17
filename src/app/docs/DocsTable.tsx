'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { agentDisplayName, fileTypeLabel, formatEstTimestamp } from '@/lib/format';
import type { Artifact, Project } from '@/lib/types';

interface DocsTableProps {
  artifacts: Artifact[];
  projects: Project[];
}

export default function DocsTable({ artifacts, projects }: DocsTableProps) {
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  // Derive option lists from the data we actually have.
  const agentOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const a of artifacts) {
      if (a.agent_id) ids.add(a.agent_id);
      else if (a.owner) ids.add(a.owner);
    }
    return Array.from(ids).sort().map(id => ({ id, label: agentDisplayName(id) }));
  }, [artifacts]);

  const extOptions = useMemo(() => {
    const exts = new Set<string>();
    for (const a of artifacts) exts.add(fileTypeLabel(a.file_path));
    return Array.from(exts).sort();
  }, [artifacts]);

  const projectOptions = useMemo(() => {
    const ids = new Set<number>();
    for (const a of artifacts) if (a.project_id != null) ids.add(a.project_id);
    return Array.from(ids)
      .map(id => projectMap.get(id))
      .filter((p): p is Project => !!p)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [artifacts, projectMap]);

  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [extFilter, setExtFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return artifacts.filter(a => {
      if (projectFilter !== 'all') {
        if (projectFilter === 'none') { if (a.project_id != null) return false; }
        else if (String(a.project_id) !== projectFilter) return false;
      }
      if (agentFilter !== 'all') {
        const id = a.agent_id ?? a.owner;
        if (id !== agentFilter) return false;
      }
      if (extFilter !== 'all' && fileTypeLabel(a.file_path) !== extFilter) return false;
      return true;
    });
  }, [artifacts, projectFilter, agentFilter, extFilter]);

  function mailtoHref(a: Artifact): string {
    if (typeof window === 'undefined') return '#';
    const origin = window.location.origin;
    const viewUrl = `${origin}/docs/${a.id}`;
    const rawUrl = a.serve_url ? `${origin}${a.serve_url}` : '';
    const subject = encodeURIComponent(a.title);
    const bodyLines = [
      a.summary ?? '',
      a.summary ? '' : '',
      `View in Mission Control: ${viewUrl}`,
      rawUrl ? `Raw file: ${rawUrl}` : '',
      '',
      '(The file was downloaded to this PC — attach it from your downloads folder before sending.)',
    ].filter(Boolean);
    const body = encodeURIComponent(bodyLines.join('\n'));
    return `mailto:?subject=${subject}&body=${body}`;
  }

  function handleEmail(a: Artifact) {
    // Trigger download first so Alex has the file in Downloads, then open the mail client.
    if (a.serve_url) {
      const link = document.createElement('a');
      link.href = a.serve_url;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setTimeout(() => { window.location.href = mailtoHref(a); }, 150);
  }

  const selectCls = 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]';

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="text-xs text-[var(--color-text-muted)]">Filter</label>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className={selectCls}>
          <option value="all">All projects</option>
          <option value="none">— No project</option>
          {projectOptions.map(p => (
            <option key={p.id} value={String(p.id)}>{p.name}</option>
          ))}
        </select>
        <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)} className={selectCls}>
          <option value="all">All agents</option>
          {agentOptions.map(a => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
        <select value={extFilter} onChange={e => setExtFilter(e.target.value)} className={selectCls}>
          <option value="all">All file types</option>
          {extOptions.map(ext => (
            <option key={ext} value={ext}>{ext}</option>
          ))}
        </select>
        {(projectFilter !== 'all' || agentFilter !== 'all' || extFilter !== 'all') && (
          <button
            onClick={() => { setProjectFilter('all'); setAgentFilter('all'); setExtFilter('all'); }}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-[var(--color-text-muted)]">
          {filtered.length} of {artifacts.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-12 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">No artifacts match these filters.</p>
        </div>
      ) : (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">File</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Project</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Agent</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Review</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Created</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const project = a.project_id != null ? projectMap.get(a.project_id) : null;
                return (
                  <tr key={a.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-hover)] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">
                      <Link href={`/docs/${a.id}`} className="hover:text-[var(--color-accent)]">{a.title}</Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-primary)] font-mono">{fileTypeLabel(a.file_path)}</td>
                    <td className="px-4 py-3">
                      {project && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                          <span className="text-xs text-[var(--color-text-secondary)]">{project.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{agentDisplayName(a.agent_id, a.owner)}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.review_status} /></td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] whitespace-nowrap">{formatEstTimestamp(a.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/docs/${a.id}`}
                          title="Open in Mission Control"
                          className="px-2 py-1 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                        >
                          Open
                        </Link>
                        {a.serve_url && (
                          <a
                            href={a.serve_url}
                            download
                            title="Download file to this PC"
                            className="px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] rounded"
                          >
                            Download
                          </a>
                        )}
                        {a.serve_url && (
                          <button
                            onClick={() => handleEmail(a)}
                            title="Download, then open your email client to attach"
                            className="px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] rounded"
                          >
                            Email
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
