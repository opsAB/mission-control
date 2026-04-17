'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ReviewActionsProps {
  type: 'task' | 'flow' | 'artifact';
  id: string;
  serveUrl?: string;
}

export default function ReviewActions({ type, id, serveUrl }: ReviewActionsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'revise'>('idle');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: 'approve' | 'revision') {
    const review_status = action === 'approve' ? 'approved' : 'revision_requested';
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, review_status, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status})`);
        setBusy(false);
        return;
      }
      setMode('idle');
      setNote('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  const viewHref = type === 'artifact' ? `/docs/${id}` : serveUrl;

  if (mode === 'revise') {
    return (
      <div className="w-72 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded p-3 space-y-2 shrink-0">
        <div className="text-xs font-semibold text-amber-400">Requested changes</div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Describe the revision. This is sent back to the agent as a new dispatch."
          className="w-full h-28 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs resize-none focus:outline-none focus:border-[var(--color-accent)]"
          autoFocus
        />
        {error && <div className="text-xs text-red-400">{error}</div>}
        <div className="flex gap-2">
          <button
            onClick={() => submit('revision')}
            disabled={busy || !note.trim()}
            className="flex-1 px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Sending…' : 'Send'}
          </button>
          <button onClick={() => { setMode('idle'); setNote(''); setError(null); }} className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 shrink-0">
      {viewHref && (
        <a
          href={viewHref}
          {...(type !== 'artifact' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)] transition-colors text-center"
        >
          Open
        </a>
      )}
      <button
        onClick={() => submit('approve')}
        disabled={busy}
        className="px-3 py-1.5 text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/25 disabled:opacity-40"
      >
        Approve
      </button>
      <button
        onClick={() => setMode('revise')}
        className="px-3 py-1.5 text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/25"
      >
        Revise
      </button>
      {error && <div className="text-xs text-red-400 max-w-[12rem]">{error}</div>}
    </div>
  );
}
