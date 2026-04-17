'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Connects to /api/stream and refreshes the server-rendered route when meaningful events arrive.
// Debounced to avoid refresh storms.
export default function LiveUpdater() {
  const router = useRouter();
  useEffect(() => {
    let debounce: NodeJS.Timeout | null = null;
    const es = new EventSource('/api/stream');
    const trigger = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), 300);
    };
    const relevantTypes = [
      'task_updated', 'flow_updated', 'alert_new', 'alert_updated',
      'artifact_new', 'note_new', 'activity_new',
      'dispatch_new', 'dispatch_updated', 'digest_new',
    ];
    for (const t of relevantTypes) {
      es.addEventListener(t, trigger);
    }
    es.onerror = () => { /* EventSource will auto-reconnect */ };
    return () => {
      if (debounce) clearTimeout(debounce);
      es.close();
    };
  }, [router]);
  return null;
}
