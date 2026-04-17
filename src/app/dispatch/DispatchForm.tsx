'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Agent { id: string; name: string; emoji: string }
interface Project { id: number; name: string; color: string }

export default function DispatchForm({ agents, projects }: { agents: Agent[]; projects: Project[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('main');
  const [priority, setPriority] = useState('medium');
  const [projectId, setProjectId] = useState<string>('');
  const [triggerNow, setTriggerNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    await fetch('/api/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        assignee_agent_id: assignee,
        priority,
        project_id: projectId ? Number(projectId) : null,
      }),
    });

    const shouldAutoTrigger = triggerNow || priority === 'critical';
    if (shouldAutoTrigger) {
      await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'process_queue' }),
      });
    }

    setTitle(''); setDescription(''); setProjectId('');
    setSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-5 space-y-3">
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="New task — what needs doing?"
        className="w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Details (optional)"
        rows={2}
        className="w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select value={assignee} onChange={e => setAssignee(e.target.value)} className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm">
          {agents.map(a => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)} className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm">
          <option value="low">Low priority</option>
          <option value="medium">Medium priority</option>
          <option value="high">High priority</option>
          <option value="critical">Critical (always triggers now)</option>
        </select>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm">
          <option value="">No project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={triggerNow || priority === 'critical'}
            disabled={priority === 'critical'}
            onChange={e => setTriggerNow(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          Trigger Alfred immediately (otherwise waits for next heartbeat)
        </label>
        <button type="submit" disabled={submitting || !title.trim()} className="px-4 py-2 text-sm font-medium bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)] disabled:opacity-50">
          {submitting ? 'Dispatching…' : 'Dispatch task'}
        </button>
      </div>
    </form>
  );
}
