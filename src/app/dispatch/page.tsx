import { getDb } from '@/lib/db';
import { ensureInit } from '@/lib/init';
import { getAllMcAgents, getAllProjects } from '@/lib/queries';
import { timeAgo } from '@/lib/types';
import DispatchForm from './DispatchForm';
import StatusBadge from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

interface DispatchRow {
  id: number;
  title: string;
  description: string;
  assignee_agent_id: string;
  priority: string;
  project_id: number | null;
  status: string;
  picked_up_at: string | null;
  completed_at: string | null;
  openclaw_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function DispatchPage() {
  ensureInit();
  const agents = getAllMcAgents();
  const projects = getAllProjects();
  const rows = getDb().prepare(`SELECT * FROM mc_dispatched_tasks ORDER BY created_at DESC LIMIT 100`).all() as DispatchRow[];
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const agentMap = new Map(agents.map(a => [a.id, a]));

  const queued = rows.filter(r => r.status === 'queued');
  const inProgress = rows.filter(r => r.status === 'picked_up' || r.status === 'in_progress');
  const done = rows.filter(r => r.status === 'done' || r.status === 'failed');

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Dispatch</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Send tasks to agents. Alfred and specialists poll this queue on heartbeat.</p>
      </div>

      <DispatchForm agents={agents} projects={projects} />

      <div className="mt-8 space-y-6">
        <Section title={`Queued (${queued.length})`} color="text-amber-400">
          {queued.length === 0 ? <Empty text="No tasks queued." /> : (
            <div className="space-y-2">{queued.map(r => <DispatchCard key={r.id} row={r} agent={agentMap.get(r.assignee_agent_id)} project={r.project_id != null ? projectMap.get(r.project_id) : undefined} />)}</div>
          )}
        </Section>
        <Section title={`In progress (${inProgress.length})`} color="text-emerald-400">
          {inProgress.length === 0 ? <Empty text="Nothing in progress." /> : (
            <div className="space-y-2">{inProgress.map(r => <DispatchCard key={r.id} row={r} agent={agentMap.get(r.assignee_agent_id)} project={r.project_id != null ? projectMap.get(r.project_id) : undefined} />)}</div>
          )}
        </Section>
        <Section title={`History (${done.length})`} color="text-gray-400">
          {done.length === 0 ? <Empty text="No history yet." /> : (
            <div className="space-y-2">{done.slice(0, 20).map(r => <DispatchCard key={r.id} row={r} agent={agentMap.get(r.assignee_agent_id)} project={r.project_id != null ? projectMap.get(r.project_id) : undefined} />)}</div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${color}`}>{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-sm text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">{text}</div>;
}

function DispatchCard({ row, agent, project }: { row: DispatchRow; agent?: { name: string; emoji: string }; project?: { name: string; color: string } }) {
  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{row.title}</span>
            <StatusBadge status={row.status} />
            <StatusBadge status={row.priority} />
          </div>
          {row.description && <p className="text-xs text-[var(--color-text-secondary)] mb-2 line-clamp-2">{row.description}</p>}
          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            <span>{agent?.emoji ?? ''} {agent?.name ?? row.assignee_agent_id}</span>
            {project && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />{project.name}</span>}
            <span>Created {timeAgo(row.created_at)}</span>
            {row.picked_up_at && <span>· Picked up {timeAgo(row.picked_up_at)}</span>}
            {row.completed_at && <span>· Completed {timeAgo(row.completed_at)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
