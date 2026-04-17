import { getAllMcFlows } from '@/lib/queries';
import { timeAgo } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default function CodingRunsPage() {
  const flows = getAllMcFlows();
  const active = flows.filter(f => f.status === 'active' || f.status === 'waiting');
  const completed = flows.filter(f => f.status !== 'active' && f.status !== 'waiting');

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Flow Runs</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{flows.length} total ({active.length} active) · Coding-run architecture — ready for Alfred&apos;s bounded worker pattern</p>
      </div>

      {active.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Active</h2>
          <div className="space-y-3">
            {active.map(f => (
              <div key={f.flow_id} className="bg-[var(--color-bg-secondary)] border border-emerald-500/20 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium">{f.name}</h3>
                      <StatusBadge status={f.status} />
                    </div>
                    {f.blocked_summary && <p className="text-xs text-red-400 mb-2">Blocked: {f.blocked_summary}</p>}
                    <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                      <span>{f.agent_emoji} {f.agent_name}</span>
                      <span>Revision {f.revision}</span>
                      <span>Started {timeAgo(f.created_at)}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-[var(--color-text-muted)]">
                    Updated {timeAgo(f.updated_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">History</h2>
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Goal</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Agent</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Revision</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Ended</th>
                </tr>
              </thead>
              <tbody>
                {completed.map(f => (
                  <tr key={f.flow_id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-hover)] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">{f.name}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{f.agent_emoji} {f.agent_name}</td>
                    <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                    <td className="px-4 py-3 text-xs font-mono text-[var(--color-text-secondary)]">{f.revision}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{f.ended_at ? timeAgo(f.ended_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {flows.length === 0 && (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-12 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">No flow runs yet.</p>
        </div>
      )}
    </div>
  );
}
