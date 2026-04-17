'use client';

import { useRouter } from 'next/navigation';

interface ReviewActionsProps {
  type: 'task' | 'artifact';
  id: number;
  serveUrl?: string;
}

export default function ReviewActions({ type, id, serveUrl }: ReviewActionsProps) {
  const router = useRouter();

  async function handleAction(action: 'approve' | 'revision') {
    const endpoint = type === 'task' ? '/api/tasks' : '/api/review';
    const body = type === 'task'
      ? { id, status: action === 'approve' ? 'done' : 'active' }
      : { id, review_status: action === 'approve' ? 'approved' : 'revision_requested' };

    await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {serveUrl && (
        <a
          href={serveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)] transition-colors text-center"
        >
          Open
        </a>
      )}
      <button
        onClick={() => handleAction('approve')}
        className="px-3 py-1.5 text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/25 transition-colors"
      >
        Approve
      </button>
      <button
        onClick={() => handleAction('revision')}
        className="px-3 py-1.5 text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/25 transition-colors"
      >
        Revise
      </button>
    </div>
  );
}
