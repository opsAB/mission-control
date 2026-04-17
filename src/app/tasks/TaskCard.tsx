'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface Props {
  taskId: string;
  title: string;
  projectName?: string | null;
  projectColor?: string | null;
  agentEmoji: string;
  agentName: string;
  status: string;
  updatedAt: string;
  noteCount: number;
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

export default function TaskCard(props: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();

  function open() {
    const p = new URLSearchParams(params.toString());
    p.set('task', props.taskId);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  }

  return (
    <button
      onClick={open}
      className="w-full text-left bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md p-3 hover:border-[var(--color-border-light)] transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-medium leading-tight line-clamp-2">{props.title}</span>
        {props.noteCount > 0 && (
          <span className="text-xs text-[var(--color-accent)] font-medium shrink-0" title={`${props.noteCount} note${props.noteCount === 1 ? '' : 's'}`}>✎{props.noteCount}</span>
        )}
      </div>
      {props.projectName && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: props.projectColor ?? '#666' }} />
          <span className="text-xs text-[var(--color-text-secondary)]">{props.projectName}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-muted)]">{props.agentEmoji} {props.agentName}</span>
        <span className="text-xs text-[var(--color-text-muted)]">{ago(props.updatedAt)}</span>
      </div>
    </button>
  );
}
