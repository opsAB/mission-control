import { getRecentAlerts } from '@/lib/alerts';
import { timeAgo } from '@/lib/types';
import AlertRow from './AlertRow';
import ClearAll from './MarkAllRead';

export const dynamic = 'force-dynamic';

export default function AlertsPage() {
  const alerts = getRecentAlerts(100);
  const unread = alerts.filter(a => !a.read_at).length;

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Alerts</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {unread > 0 ? `${unread} unread · ${alerts.length} total` : `${alerts.length} alerts`}
          </p>
        </div>
        {alerts.length > 0 && <ClearAll />}
      </div>

      {alerts.length === 0 ? (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-12 text-center">
          <div className="text-3xl mb-3 text-emerald-400">✓</div>
          <p className="text-sm text-[var(--color-text-secondary)]">No alerts. All quiet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(a => <AlertRow key={a.id} alert={a} timeAgoStr={timeAgo(a.created_at)} />)}
        </div>
      )}
    </div>
  );
}
