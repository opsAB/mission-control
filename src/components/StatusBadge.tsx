interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  running: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  idle: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  offline: 'bg-gray-500/15 text-gray-500 border-gray-500/30',
  backlog: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  waiting: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  blocked: 'bg-red-500/15 text-red-400 border-red-500/30',
  review: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  pending: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  done: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  completed: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  revision_requested: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  revision: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  delivered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  not_started: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  none: 'bg-gray-500/15 text-gray-500 border-gray-500/30',
  queued: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  paused: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  handed_off: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  medium: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  low: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const colors = statusColors[status] || 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';
  const label = status.replace(/_/g, ' ');

  return (
    <span className={`inline-flex items-center rounded border font-medium capitalize ${colors} ${sizeClass}`}>
      {label}
    </span>
  );
}
