'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AutoTagButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [tagged, setTagged] = useState<number | null>(null);

  async function go() {
    setBusy(true);
    const res = await fetch('/api/projects/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'auto' }),
    });
    const data = await res.json();
    setTagged(data.tagged ?? 0);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {tagged !== null && <span className="text-xs text-emerald-400">Tagged {tagged} tasks</span>}
      <button
        onClick={go}
        disabled={busy}
        className="px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
      >
        {busy ? 'Tagging…' : 'Auto-tag by agent'}
      </button>
    </div>
  );
}
