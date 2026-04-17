'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  id: number;
  currentStatus: string;
}

export default function ArtifactReview({ id, currentStatus }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'revise'>('idle');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(review_status: 'approved' | 'revision_requested') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'artifact', id, review_status, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Request failed (${res.status})`);
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

  if (mode === 'revise') {
    return (
      <div className="w-80 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-3 space-y-2">
        <div className="text-xs font-semibold text-amber-400">Requested changes</div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="What should the agent change? Be specific — this goes back to them as a new dispatch."
          className="w-full h-32 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs leading-relaxed resize-none focus:outline-none focus:border-[var(--color-accent)]"
          autoFocus
        />
        {error && <div className="text-xs text-red-400">{error}</div>}
        <div className="flex gap-2">
          <button
            onClick={() => submit('revision_requested')}
            disabled={busy || !note.trim()}
            className="flex-1 px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded hover:bg-amber-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Sending…' : 'Send revision'}
          </button>
          <button
            onClick={() => { setMode('idle'); setNote(''); setError(null); }}
            disabled={busy}
            className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-40">
      <button
        onClick={() => submit('approved')}
        disabled={busy || currentStatus === 'approved'}
        className="px-3 py-1.5 text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {currentStatus === 'approved' ? 'Approved' : busy ? '…' : 'Approve'}
      </button>
      <button
        onClick={() => setMode('revise')}
        className="px-3 py-1.5 text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/25 transition-colors"
      >
        Request revision
      </button>
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}
