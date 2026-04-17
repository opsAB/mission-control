'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ProcessQueueButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fired, setFired] = useState(false);

  async function go() {
    setBusy(true);
    const res = await fetch('/api/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'process_queue' }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.started) {
      setFired(true);
      setTimeout(() => setFired(false), 4000);
      setTimeout(() => router.refresh(), 8000);
    } else {
      alert(`Failed to trigger: ${data.error ?? 'unknown'}`);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {fired && <span className="text-xs text-emerald-400">Alfred triggered — check dispatches in ~10–60s</span>}
      <button
        onClick={go}
        disabled={busy}
        className="px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
      >
        {busy ? 'Triggering…' : 'Poll queue now'}
      </button>
    </div>
  );
}
