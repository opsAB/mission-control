import { getReviewQueue } from '@/lib/queries';
import { timeAgo } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import ReviewActions from './ReviewActions';

export const dynamic = 'force-dynamic';

export default function ReviewPage() {
  const queue = getReviewQueue();

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Review Queue</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {queue.length === 0 ? 'All clear — nothing needs review.' : `${queue.length} items awaiting review`}
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-12 text-center">
          <div className="text-3xl mb-3 text-emerald-400">✓</div>
          <p className="text-sm text-[var(--color-text-secondary)]">Review queue is empty. All caught up.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map(item => (
            <div key={`${item.type}-${item.id}`} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-mono ${item.type === 'task' ? 'text-blue-400' : 'text-purple-400'}`}>
                      {item.type === 'task' ? 'TASK' : 'ARTIFACT'}
                    </span>
                    {item.artifactType && <StatusBadge status={item.artifactType} />}
                  </div>
                  <h3 className="text-sm font-medium mb-1">{item.title}</h3>
                  {item.summary && <p className="text-xs text-[var(--color-text-secondary)] mb-2">{item.summary}</p>}
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span>{item.executor}</span>
                    <span>{timeAgo(item.created_at)}</span>
                  </div>
                </div>
                <ReviewActions type={item.type} id={item.id} serveUrl={item.serve_url} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
