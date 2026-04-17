import { getOverviewStats, getMcTasksByStatus, getAllCronJobs, getRecentActivity, getAllMcFlows, getReviewQueue, isOpenClawConnected } from '@/lib/queries';
import { timeAgo, getStaleness } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import StalenessIndicator from '@/components/StalenessIndicator';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function OverviewPage() {
  const connected = isOpenClawConnected();
  const stats = getOverviewStats();
  const blocked = getMcTasksByStatus('blocked');
  const active = getMcTasksByStatus('active');
  const reviewQueue = getReviewQueue().slice(0, 8);
  const doneTasks = getMcTasksByStatus('done').slice(0, 6);
  const cronJobs = getAllCronJobs();
  const activity = getRecentActivity(12);
  const allFlows = getAllMcFlows();

  const staleItems = [
    ...active.filter(t => getStaleness(t.status, t.updated_at) !== 'ok'),
    ...allFlows.filter(f => (f.status === 'active' || f.status === 'waiting') && getStaleness(f.status, f.updated_at) !== 'ok').map(f => ({ title: f.name, status: f.status, updated_at: f.updated_at } as { title: string; status: string; updated_at: string })),
  ];

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Overview</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Operational status at a glance</p>
        </div>
        <div className={`text-xs px-2.5 py-1 rounded border flex items-center gap-2 ${connected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {connected ? 'OpenClaw connected' : 'OpenClaw not detected'}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        <StatCard label="Active" value={stats.activeTasks} color="text-emerald-400" />
        <StatCard label="Blocked" value={stats.blockedTasks} color="text-red-400" alert={stats.blockedTasks > 0} />
        <StatCard label="Needs Review" value={stats.pendingReviews} color="text-blue-400" alert={stats.pendingReviews > 0} />
        <StatCard label="Done (24h)" value={stats.recentlyCompleted} color="text-gray-400" />
        <StatCard label="Agents Active" value={stats.activeAgents} color="text-emerald-400" />
        <StatCard label="Flows Active" value={stats.runningCodingRuns} color="text-purple-400" />
        <StatCard label="Stale" value={staleItems.length} color="text-amber-400" alert={staleItems.length > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {blocked.length > 0 && (
          <section className="lg:col-span-2 bg-red-500/5 border border-red-500/20 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">Blocked — Needs Attention</h2>
            <div className="space-y-2">
              {blocked.map(t => (
                <div key={t.task_id} className="flex items-center justify-between bg-[var(--color-bg-secondary)] rounded px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t.title}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{t.agent_emoji} {t.agent_name}</span>
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)]">{timeAgo(t.updated_at)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Needs Review</h2>
            <Link href="/review" className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">View all →</Link>
          </div>
          {reviewQueue.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">All clear.</p>
          ) : (
            <div className="space-y-2">
              {reviewQueue.map(item => (
                <div key={`${item.type}-${item.id}`} className="flex items-center justify-between bg-[var(--color-bg-tertiary)] rounded px-3 py-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-mono shrink-0 ${item.type === 'task' ? 'text-blue-400' : item.type === 'flow' ? 'text-purple-400' : 'text-pink-400'}`}>
                      {item.type.toUpperCase()}
                    </span>
                    <span className="text-sm truncate">{item.title}</span>
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)] shrink-0">{item.agent_emoji} {item.agent}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Active Now</h2>
          {active.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Nothing running.</p>
          ) : (
            <div className="space-y-2">
              {active.slice(0, 8).map(t => (
                <div key={t.task_id} className="running-shimmer flex items-center justify-between bg-[var(--color-bg-tertiary)] rounded px-3 py-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="running-dot" aria-hidden="true" />
                    <span className="text-sm truncate">{t.title}</span>
                    <StalenessIndicator status={t.status} lastUpdate={t.updated_at} />
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)] shrink-0">{t.agent_emoji} · {timeAgo(t.updated_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Recurring Jobs</h2>
            <Link href="/workflows" className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">View all →</Link>
          </div>
          {cronJobs.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No cron jobs configured.</p>
          ) : (
            <div className="space-y-2">
              {cronJobs.map(j => (
                <div key={j.id} className="flex items-center justify-between bg-[var(--color-bg-tertiary)] rounded px-3 py-2 gap-2">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{j.name}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{j.schedule_human}</div>
                  </div>
                  <StatusBadge status={j.enabled ? 'active' : 'idle'} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Recently Completed</h2>
          {doneTasks.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Nothing completed recently.</p>
          ) : (
            <div className="space-y-2">
              {doneTasks.map(t => (
                <div key={t.task_id} className="flex items-center justify-between bg-[var(--color-bg-tertiary)] rounded px-3 py-2 gap-2">
                  <span className="text-sm truncate">{t.title}</span>
                  <span className="text-xs text-[var(--color-text-secondary)] shrink-0">{t.agent_emoji} · {timeAgo(t.updated_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {staleItems.length > 0 && (
          <section className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3">Stale / Aging</h2>
            <div className="space-y-2">
              {staleItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-[var(--color-bg-secondary)] rounded px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{item.title}</span>
                    <StalenessIndicator status={item.status} lastUpdate={item.updated_at} />
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)]">{timeAgo(item.updated_at)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="lg:col-span-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Recent Activity</h2>
          <div className="space-y-1">
            {activity.map(a => (
              <div key={a.id} className="slide-in-row flex items-center justify-between px-2 py-1.5 rounded">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-[var(--color-text-muted)] font-mono w-14 shrink-0">{a.entity_type}</span>
                  <span className="text-xs text-[var(--color-text-muted)] w-16 shrink-0">{a.action}</span>
                  <span className="text-sm text-[var(--color-text-secondary)] truncate">{a.agent_emoji ? `${a.agent_emoji} ` : ''}{a.summary}</span>
                </div>
                <span className="text-xs text-[var(--color-text-muted)] shrink-0 ml-2">{timeAgo(a.timestamp)}</span>
              </div>
            ))}
            {activity.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">No activity yet — dispatches and agent status updates will stream in here.</p>
            )}
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
