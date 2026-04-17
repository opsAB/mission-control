import { getAllCodingRuns, getAllAgents, getAllProjects } from '@/lib/queries';
import { timeAgo } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default function CodingRunsPage() {
  const runs = getAllCodingRuns();
  const agents = getAllAgents();
  const projects = getAllProjects();
  const agentMap = new Map(agents.map(a => [a.id, a]));
  const projectMap = new Map(projects.map(p => [p.id, p]));

  const active = runs.filter(r => r.status === 'running' || r.status === 'queued');
  const completed = runs.filter(r => r.status !== 'running' && r.status !== 'queued');

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Coding Runs</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{runs.length} total ({active.length} active)</p>
      </div>

      {/* Active runs */}
      {active.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Active</h2>
          <div className="space-y-3">
            {active.map(r => {
              const agent = r.agent_id ? agentMap.get(r.agent_id) : null;
              const project = r.project_id ? projectMap.get(r.project_id) : null;
              return (
                <div key={r.id} className="bg-[var(--color-bg-secondary)] border border-emerald-500/20 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium">{r.title}</h3>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mb-2">{r.summary}</p>
                      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                        {agent && <span>Agent: {agent.name}</span>}
                        {project && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                            {project.name}
                          </span>
                        )}
                        <span>Started: {timeAgo(r.started_at)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">Context</div>
                      <div className="text-sm font-mono text-[var(--color-text-secondary)]">{(r.context_length / 1000).toFixed(0)}k</div>
                      {r.last_checkpoint && (
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">Checkpoint: {timeAgo(r.last_checkpoint)}</div>
                      )}
                    </div>
                  </div>
                  {/* Context length bar */}
                  <div className="mt-3 bg-[var(--color-bg-tertiary)] rounded-full h-1.5">
                    <div
                      className="bg-emerald-400 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min((r.context_length / 200000) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-[var(--color-text-muted)]">
                    <span>{(r.context_length / 1000).toFixed(0)}k tokens</span>
                    <span>200k limit</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Completed runs */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">History</h2>
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Run</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Agent</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Context</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Started</th>
                </tr>
              </thead>
              <tbody>
                {completed.map(r => {
                  const agent = r.agent_id ? agentMap.get(r.agent_id) : null;
                  return (
                    <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-hover)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{r.title}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{r.summary}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{agent?.name ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-xs font-mono text-[var(--color-text-secondary)]">{(r.context_length / 1000).toFixed(0)}k</td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{timeAgo(r.started_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
