'use client';

import { useRouter } from 'next/navigation';

export default function MarkAllRead() {
  const router = useRouter();
  async function go() {
    await fetch('/api/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read_all' }) });
    router.refresh();
  }
  return (
    <button onClick={go} className="px-3 py-1.5 text-xs font-medium bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded hover:border-[var(--color-border-light)]">
      Mark all read
    </button>
  );
}
