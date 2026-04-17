import { getAllAgents } from '@/lib/queries';
import StatusBadge from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default function AgentsPage() {
  const agents = getAllAgents();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Agents</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{agents.length} agents configured</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map(a => (
          <div
            key={a.id}
            className={`bg-[var(--color-bg-secondary)] border rounded-lg p-5 ${
              a.name === 'Alfred' ? 'border-[var(--color-accent)]/30' : 'border-[var(--color-border)]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                  a.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                  a.status === 'idle' ? 'bg-gray-500/15 text-gray-400' :
                  'bg-red-500/15 text-red-400'
                }`}>
                  {a.name[0]}
                </div>
                <div>
                  <h2 className="text-sm font-semibold">{a.name}</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">{a.role}</p>
                </div>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mb-3">{a.description}</p>
            {a.current_task && (
              <div className="bg-[var(--color-bg-tertiary)] rounded px-3 py-2">
                <span className="text-xs text-[var(--color-text-muted)]">Current: </span>
                <span className="text-xs text-[var(--color-text-primary)]">{a.current_task}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
