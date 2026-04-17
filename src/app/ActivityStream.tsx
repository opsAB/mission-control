'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { timeAgo } from '@/lib/types';
import type { ActivityEntry } from '@/lib/queries';

const ROW_HEIGHT = 32;        // px — matches the row's py-1.5 + text metrics
const VISIBLE_ROWS = 12;

interface Props {
  initial: ActivityEntry[];
}

// Streaming-style activity feed. Rows are absolutely positioned and their
// `top` transitions smoothly whenever the list reorders — so when a new event
// arrives up top, the existing rows glide downward instead of jumping.
// Freshly arrived rows also flash with a brief highlight.
export default function ActivityStream({ initial }: Props) {
  const [rows, setRows] = useState<ActivityEntry[]>(initial);
  const [justArrived, setJustArrived] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string>>(new Set(initial.map(r => r.id)));

  useEffect(() => {
    // Initial hydration: seed knownIds from server-rendered list.
    knownIds.current = new Set(initial.map(r => r.id));
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    async function refetch() {
      try {
        const res = await fetch('/api/activity?limit=20', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { activity: ActivityEntry[] };
        if (cancelled) return;
        const arrivals = new Set<string>();
        for (const r of data.activity) {
          if (!knownIds.current.has(r.id)) arrivals.add(r.id);
        }
        knownIds.current = new Set(data.activity.map(r => r.id));
        setRows(data.activity);
        if (arrivals.size > 0) {
          setJustArrived(prev => {
            const next = new Set(prev);
            for (const id of arrivals) next.add(id);
            return next;
          });
          // Clear the highlight after the flash completes.
          window.setTimeout(() => {
            setJustArrived(prev => {
              const next = new Set(prev);
              for (const id of arrivals) next.delete(id);
              return next;
            });
          }, 1500);
        }
      } catch { /* transient; next SSE event will retry */ }
    }

    // Subscribe to the same SSE stream the sidebar uses. The server emits
    // named events (event: activity_new, etc.) so we register per-type.
    const es = new EventSource('/api/stream');
    const relevant = ['activity_new', 'dispatch_new', 'dispatch_updated', 'artifact_new', 'artifact_review', 'task_review', 'alert_new'];
    const handler = () => { refetch(); };
    for (const t of relevant) es.addEventListener(t, handler);
    // Safety-net poll in case SSE drops silently.
    const poll = window.setInterval(refetch, 15000);
    return () => {
      cancelled = true;
      for (const t of relevant) es.removeEventListener(t, handler);
      es.close();
      window.clearInterval(poll);
    };
  }, []);

  const visible = useMemo(() => rows.slice(0, VISIBLE_ROWS), [rows]);
  const containerHeight = visible.length * ROW_HEIGHT;

  if (rows.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">No activity yet — dispatches and status updates will stream in here.</p>;
  }

  return (
    <div className="relative" style={{ height: containerHeight, minHeight: ROW_HEIGHT * 4 }}>
      {visible.map((a, idx) => {
        const flash = justArrived.has(a.id);
        return (
          <div
            key={a.id}
            className={`absolute left-0 right-0 flex items-center justify-between px-2 rounded transition-all duration-500 ease-out ${flash ? 'bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]/40' : ''}`}
            style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT - 2, opacity: flash ? 1 : Math.max(0.4, 1 - idx * 0.05) }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-[var(--color-text-muted)] font-mono w-14 shrink-0">{a.entity_type}</span>
              <span className="text-xs text-[var(--color-text-muted)] w-16 shrink-0">{a.action}</span>
              <span className="text-sm text-[var(--color-text-secondary)] truncate">
                {a.agent_emoji ? `${a.agent_emoji} ` : ''}{a.summary || '—'}
              </span>
            </div>
            <span className="text-xs text-[var(--color-text-muted)] shrink-0 ml-2">{timeAgo(a.timestamp)}</span>
          </div>
        );
      })}
    </div>
  );
}
