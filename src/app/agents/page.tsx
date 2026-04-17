import { getAllMcAgents } from '@/lib/queries';
import StatusBadge from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default function AgentsPage() {
  const agents = getAllMcAgents();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Agents</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{agents.length} agents configured in OpenClaw</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map(a => (
          <div
            key={a.id}
            className={`bg-[var(--color-bg-secondary)] border rounded-lg p-5 ${
              a.id === 'main' ? 'border-[var(--color-accent)]/40' : 'border-[var(--color-border)]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                  a.status === 'active' ? 'bg-emerald-500/15' :
                  a.status === 'idle' ? 'bg-gray-500/15' :
                  'bg-red-500/15'
                }`}>
                  {a.emoji || a.name[0]}
                </div>
                <div>
                  <h2 className="text-sm font-semibold">{a.name}</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">{a.role}</p>
                </div>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mb-3 font-mono">
              {a.id}
            </div>
            {a.workspace && (
              <div className="text-xs text-[var(--color-text-muted)] mb-3 font-mono truncate">{a.workspace}</div>
            )}
            {a.current_task_title ? (
              <div className="bg-[var(--color-bg-tertiary)] rounded px-3 py-2">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Current task · {a.active_count} running</div>
                <div className="text-xs text-[var(--color-text-primary)] line-clamp-2">{a.current_task_title}</div>
              </div>
            ) : a.status === 'idle' ? (
              <div className="text-xs text-[var(--color-text-muted)]">Idle — no current task</div>
            ) : (
              <div className="text-xs text-[var(--color-text-muted)]">No recent activity</div>
            )}
          </div>
        ))}
        {agents.length === 0 && (
          <div className="md:col-span-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-8 text-center text-sm text-[var(--color-text-muted)]">
            No agents detected. Check that <code className="font-mono">~/.openclaw/openclaw.json</code> exists.
          </div>
        )}
      </div>
    </div>
  );
}
