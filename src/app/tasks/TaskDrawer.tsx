'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface TaskDetailData {
  task: {
    task_id: string;
    title: string;
    status: string;
    oc_status: string;
    delivery_status: string;
    agent_name: string;
    agent_emoji: string;
    project_name: string | null;
    project_color: string | null;
    created_at: string;
    updated_at: string;
    ended_at: string | null;
    duration_ms: number | null;
    summary: string;
    progress_summary: string | null;
    terminal_summary: string | null;
    error: string | null;
    full_task: string;
  };
  notes: Array<{ id: number; agent_id: string; note: string; created_at: string }>;
  artifacts: Array<{ id: number; title: string; type: string; serve_url: string; created_at: string }>;
}

function ago(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours/24)}d ago`;
}

export default function TaskDrawer() {
  const router = useRouter();
  const params = useSearchParams();
  const taskId = params.get('task');
  const [data, setData] = useState<TaskDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) { setData(null); return; }
    setLoading(true);
    fetch(`/api/task/${taskId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  function close() {
    const p = new URLSearchParams(params.toString());
    p.delete('task');
    const qs = p.toString();
    router.push(qs ? `?${qs}` : '/tasks', { scroll: false });
  }

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
      <aside className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-[var(--color-bg-secondary)] border-l border-[var(--color-border)] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-5 py-3 flex items-center justify-between z-10">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Task Detail</h2>
          <button onClick={close} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-xl leading-none">✕</button>
        </div>
        <div className="p-5">
          {loading && <div className="text-sm text-[var(--color-text-muted)]">Loading…</div>}
          {data && <TaskDetail data={data} />}
          {!loading && !data && <div className="text-sm text-[var(--color-text-muted)]">Task not found.</div>}
        </div>
      </aside>
    </div>
  );
}

function TaskDetail({ data }: { data: TaskDetailData }) {
  const { task, notes, artifacts } = data;
  return (
    <div>
      <h1 className="text-lg font-semibold leading-snug mb-3">{task.title}</h1>
      <div className="flex items-center gap-2 mb-2 flex-wrap text-xs">
        <Badge text={task.status} />
        {task.oc_status !== task.status && <span className="text-[var(--color-text-muted)]">OpenClaw: {task.oc_status}</span>}
        {task.delivery_status !== 'not_applicable' && <Badge text={task.delivery_status} />}
        <span className="text-[var(--color-text-muted)]">· {task.agent_emoji} {task.agent_name}</span>
        {task.project_name && (
          <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            · <span className="w-2 h-2 rounded-full" style={{ backgroundColor: task.project_color ?? '#666' }} />{task.project_name}
          </span>
        )}
      </div>
      <div className="text-xs text-[var(--color-text-muted)] mb-3">
        Created {ago(task.created_at)} · Updated {ago(task.updated_at)}
        {task.ended_at && ` · Ended ${ago(task.ended_at)}`}
        {task.duration_ms && ` · ${Math.round(task.duration_ms/1000)}s runtime`}
      </div>
      <div className="text-xs text-[var(--color-text-muted)] font-mono mb-5 break-all">{task.task_id}</div>

      {(task.summary || task.terminal_summary || task.progress_summary) && (
        <Section title="Summary">
          {task.summary && <p className="text-sm mb-2">{task.summary}</p>}
          {task.terminal_summary && task.terminal_summary !== task.summary && (
            <pre className="text-xs font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap bg-[var(--color-bg-tertiary)] rounded p-3">{task.terminal_summary}</pre>
          )}
          {task.progress_summary && task.progress_summary !== task.summary && task.progress_summary !== task.terminal_summary && (
            <pre className="text-xs font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap bg-[var(--color-bg-tertiary)] rounded p-3 mt-2">{task.progress_summary}</pre>
          )}
        </Section>
      )}

      {task.error && (
        <Section title="Error" color="text-red-400">
          <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap bg-red-500/5 border border-red-500/20 rounded p-3">{task.error}</pre>
        </Section>
      )}

      {notes.length > 0 && (
        <Section title={`Notes (${notes.length})`}>
          <div className="space-y-2">
            {notes.map(n => (
              <div key={n.id} className="bg-[var(--color-bg-tertiary)] rounded p-3">
                <div className="flex items-center justify-between mb-1 text-xs text-[var(--color-text-muted)]">
                  <span>{n.agent_id === 'main' ? 'Alfred' : n.agent_id}</span>
                  <span>{ago(n.created_at)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.note}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {artifacts.length > 0 && (
        <Section title={`Artifacts (${artifacts.length})`}>
          <div className="space-y-2">
            {artifacts.map(a => (
              <div key={a.id} className="bg-[var(--color-bg-tertiary)] rounded p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{a.title}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{a.type} · {ago(a.created_at)}</div>
                </div>
                {a.serve_url && <a href={a.serve_url} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)]">Open</a>}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Full prompt">
        <pre className="text-xs font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap bg-[var(--color-bg-tertiary)] rounded p-3 max-h-[400px] overflow-y-auto">{task.full_task}</pre>
      </Section>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${color ?? 'text-[var(--color-text-secondary)]'}`}>{title}</h3>
      {children}
    </section>
  );
}

function Badge({ text }: { text: string }) {
  return <span className="inline-block px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] capitalize">{text.replace(/_/g, ' ')}</span>;
}
