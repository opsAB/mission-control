import { getOverviewStats, getTasksByStatus, getRecurringWorkflows, getRecentActivity, getAllWorkflows, getPendingReviewArtifacts } from '@/lib/queries';
import { timeAgo, getStaleness } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import StalenessIndicator from '@/components/StalenessIndicator';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function OverviewPage() {
  const stats = getOverviewStats();
  const blockedTasks = getTasksByStatus('blocked');
  const activeTasks = getTasksByStatus('active');
  const reviewTasks = getTasksByStatus('review');
  const pendingArtifacts = getPendingReviewArtifacts();
  const doneTasks = getTasksByStatus('done');
  const recurring = getRecurringWorkflows();
  const activity = getRecentActivity(10);
  const allWorkflows = getAllWorkflows();

  const staleItems = [...activeTasks, ...allWorkflows.filter(w => w.status === 'active' || w.status === 'waiting')]
    .filter(item => {
      const update = 'updated_at' in item ? item.updated_at : item.last_meaningful_update;
      return getStaleness(item.status, update) !== 'ok';
    });

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Overview</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Operational status at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        <StatCard label="Active" value={stats.activeTasks} color="text-emerald-400" />
        <StatCard label="Blocked" value={stats.blockedTasks} color="text-red-400" alert={stats.blockedTasks > 0} />
        <StatCard label="Needs Review" value={stats.pendingReviews} color="text-blue-400" alert={stats.pendingReviews > 0} />
        <StatCard label="Done (24h)" value={stats.recentlyCompleted} color="text-gray-400" />
        <StatCard label="Agents Active" value={stats.activeAgents} color="text-emerald-400" />
        <StatCard label="Coding Runs" value={stats.runningCodingRuns} color="text-purple-400" />
        <StatCard label="Stale" value={staleItems.length} color="text-amber-400" alert={staleItems.length > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blocked — always visible */}
        {blockedTasks.length > 0 && (
          <section className="lg:col-span-2 bg-red-500/5 border border-red-500/20 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">Blocked — Needs Attention</h2>
            <div className="space-y-2">
              {blockedTasks.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-[var(--color-bg-secondary)] rounded px-3 py-2">
                  <div>
                    <span className="text-sm font-medium">{t.title}</span>
                    <span className="text-xs text-[var(--color-text-secondary)] ml-2">{t.executor}</span>
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)]">{timeAgo(t.updated_at)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Review queue */}
        <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Needs Review</h2>
            <Link href="/review" className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">View all →</Link>
          </div>
          {reviewTasks.length === 0 && pendingArtifacts.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">All clear.</p>
          ) : (
            <div className="space-y-2">
              {reviewTasks.map(t => (
                <div key={`t-${t.id}`} className="flex items-center justify-between bg-[var(--color-bg-tertiary)] rounded px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-400 font-mono">TASK</span>
                    <span className="text-sm">{t.title}</span>
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)]">{t.executor}</span>
                </div>
              ))}
              {pendingArtifacts.map(a => (
                <div key={`a-${a.id}`} className="flex items-center justify-between bg-[var(--color-bg-tertiary)] rounded px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-purple-400 font-mono">DOC</span>
                    <span className="text-sm">{a.title}</span>
                  </div>
                  <StatusBadge status={a.type} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active now */}
        <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Active Now</h2>
          <div className="space-y-2">
            {activeTasks.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-[var(--color-bg-tertiary)] rounded px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{t.title}</span>
                  <StalenessIndicator status={t.status} lastUpdate={t.updated_at} />
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">{t.executor} · {timeAgo(t.updated_at)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Recurring workflows */}
        <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Recurring Workflows</h2>
            <Link href="/workflows" className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">View all →</Link>
          </div>
          <div className="space-y-2">
            {recurring.map(w => (
              <div key={w.id} className="flex items-center justify-between bg-[var(--color-bg-tertiary)] rounded px-3 py-2">
                <div>
                  <span className="text-sm">{w.name}</span>
                  <span className="text-xs text-[var(--color-text-secondary)] ml-2">{w.cron_schedule}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={w.status} />
                  {w.last_run && <span className="text-xs text-[var(--color-text-secondary)]">{timeAgo(w.last_run)}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recently completed */}
        <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Recently Completed</h2>
          {doneTasks.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Nothing completed recently.</p>
          ) : (
            <div className="space-y-2">
              {doneTasks.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-[var(--color-bg-tertiary)] rounded px-3 py-2">
                  <span className="text-sm">{t.title}</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">{timeAgo(t.updated_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Stale alerts */}
        {staleItems.length > 0 && (
          <section className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3">Stale / Aging</h2>
            <div className="space-y-2">
              {staleItems.map((item, i) => {
                const update = 'updated_at' in item ? item.updated_at : item.last_meaningful_update;
                const name = 'title' in item ? item.title : item.name;
                return (
                  <div key={i} className="flex items-center justify-between bg-[var(--color-bg-secondary)] rounded px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{name}</span>
                      <StalenessIndicator status={item.status} lastUpdate={update} />
                    </div>
                    <span className="text-xs text-[var(--color-text-secondary)]">{timeAgo(update)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Recent activity */}
        <section className="lg:col-span-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Recent Activity</h2>
          <div className="space-y-1">
            {activity.map(a => (
              <div key={a.id} className="flex items-center justify-between px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-text-muted)] font-mono w-16">{a.entity_type}</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{a.summary}</span>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">{timeAgo(a.timestamp)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, alert }: { label: string; value: number; color: string; alert?: boolean }) {
  return (
    <div className={`bg-[var(--color-bg-secondary)] border rounded-lg p-3 ${alert ? 'border-red-500/30' : 'border-[var(--color-border)]'}`}>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-[var(--color-text-secondary)] mt-1">{label}</div>
    </div>
  );
}
