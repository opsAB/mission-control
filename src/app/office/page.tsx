import { getAllMcAgents, getMcTasksByStatus } from '@/lib/queries';
import OfficeView from './OfficeView';

export const dynamic = 'force-dynamic';

export default function OfficePage() {
  const agents = getAllMcAgents();
  const activeTasks = getMcTasksByStatus('active');

  const agentTasks = new Map<string, string>();
  for (const t of activeTasks) {
    if (t.agent_id && !agentTasks.has(t.agent_id)) agentTasks.set(t.agent_id, t.title);
  }

  const view = agents.map(a => ({
    id: a.id,
    name: a.name,
    emoji: a.emoji,
    role: a.role,
    status: a.status,
    current_task: agentTasks.get(a.id) ?? null,
  }));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Office</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Agent status visualizer · pixel-art edition</p>
      </div>
      <OfficeView agents={view} />
    </div>
  );
}
