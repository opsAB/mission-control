import { getMcTask, getAllProjects } from '@/lib/queries';
import { getNotesForTask } from '@/lib/notes';
import { getDb } from '@/lib/db';
import { ensureInit } from '@/lib/init';
import { timeAgo } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';
import type { Artifact } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const task = getMcTask(taskId);
  if (!task) {
    return (
      <div className="p-6 max-w-3xl">
        <Link href="/tasks" className="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">← Back to tasks</Link>
        <h1 className="text-xl font-semibold mt-4">Task not found</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">No task with id <code className="font-mono">{taskId}</code>.</p>
      </div>
    );
  }

  ensureInit();
  const notes = getNotesForTask(taskId);
  const artifacts = getDb().prepare('SELECT * FROM artifacts WHERE task_id = ? ORDER BY created_at DESC').all(taskId) as Artifact[];
  const projects = getAllProjects();
  const project = task.project_id != null ? projects.find(p => p.id === task.project_id) : null;

  return (
    <div className="p-6 max-w-4xl">
      <Link href="/tasks" className="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">← Back to tasks</Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-semibold leading-snug">{task.title}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <StatusBadge status={task.status} />
            {task.oc_status !== task.status && <span className="text-xs text-[var(--color-text-muted)]">OpenClaw: {task.oc_status}</span>}
            {task.delivery_status !== 'not_applicable' && <StatusBadge status={task.delivery_status} />}
            <span className="text-xs text-[var(--color-text-muted)]">{task.agent_emoji} {task.agent_name}</span>
            {project && (
              <span className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                {project.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-text-muted)]">
            <span>Created {timeAgo(task.created_at)}</span>
            <span>·</span>
            <span>Updated {timeAgo(task.updated_at)}</span>
            {task.ended_at && <><span>·</span><span>Ended {timeAgo(task.ended_at)}</span></>}
            {task.duration_ms && <><span>·</span><span>{Math.round(task.duration_ms / 1000)}s runtime</span></>}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] font-mono mt-2">{task.task_id}</div>
        </div>
      </div>

      {(task.progress_summary || task.terminal_summary) && (
        <section className="mt-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h2 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Summary</h2>
          {task.summary && <p className="text-sm text-[var(--color-text-primary)] mb-2">{task.summary}</p>}
          {task.terminal_summary && task.terminal_summary !== task.summary && (
            <pre className="text-xs font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap bg-[var(--color-bg-tertiary)] rounded p-2">{task.terminal_summary}</pre>
          )}
          {task.progress_summary && task.progress_summary !== task.summary && task.progress_summary !== task.terminal_summary && (
            <pre className="text-xs font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap bg-[var(--color-bg-tertiary)] rounded p-2 mt-2">{task.progress_summary}</pre>
          )}
        </section>
      )}

      {task.error && (
        <section className="mt-4 bg-red-500/5 border border-red-500/20 rounded-lg p-4">
          <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Error</h2>
          <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap">{task.error}</pre>
        </section>
      )}

      {notes.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Notes ({notes.length})</h2>
          <div className="space-y-2">
            {notes.map(n => (
              <div key={n.id} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--color-text-muted)]">{n.agent_id === 'main' ? 'Alfred' : n.agent_id}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{timeAgo(n.created_at)}</span>
                </div>
                <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{n.note}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {artifacts.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Artifacts ({artifacts.length})</h2>
          <div className="space-y-2">
            {artifacts.map(a => (
              <div key={a.id} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{a.type} · {timeAgo(a.created_at)}</div>
                </div>
                {a.serve_url && (
                  <a href={a.serve_url} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)]">Open</a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Full prompt</h2>
        <pre className="text-xs font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 max-h-[50vh] overflow-y-auto">{task.full_task}</pre>
      </section>
    </div>
  );
}
