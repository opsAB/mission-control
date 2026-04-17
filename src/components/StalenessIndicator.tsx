import { getStaleness, type StalenessLevel } from '@/lib/types';

interface StalenessIndicatorProps {
  status: string;
  lastUpdate: string;
}

const levelStyles: Record<StalenessLevel, string> = {
  ok: '',
  watch: 'text-amber-400',
  alert: 'text-red-400',
};

const levelDots: Record<StalenessLevel, string> = {
  ok: '',
  watch: 'bg-amber-400',
  alert: 'bg-red-400 animate-pulse',
};

export default function StalenessIndicator({ status, lastUpdate }: StalenessIndicatorProps) {
  const level = getStaleness(status, lastUpdate);
  if (level === 'ok') return null;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${levelStyles[level]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${levelDots[level]}`} />
      {level === 'watch' ? 'Stale' : 'Alert'}
    </span>
  );
}
