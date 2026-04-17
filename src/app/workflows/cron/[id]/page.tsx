import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCronJobById } from '@/lib/queries';
import { humanizeCron } from '@/lib/system-cron';
import { formatEstTimestamp, agentDisplayName } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CronJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getCronJobById(id);
  if (!job) notFound();

  const humanSchedule = job.schedule_cron ? humanizeCron(job.schedule_cron) : job.schedule_human;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-4">
        <Link href="/" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">← Overview</Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-semibold">{job.name}</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{humanSchedule}</p>
      </div>

      {job.description && (
        <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 mb-4">
          <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">What it does</div>
          <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{job.description}</p>
        </section>
      )}

      {job.sources && job.sources.length > 0 && (
        <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 mb-4">
          <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Sources</div>
          <ul className="text-sm space-y-1">
            {job.sources.map((s, i) => (
              <li key={i} className="text-[var(--color-text-primary)]">• {s}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 mb-4 grid grid-cols-2 gap-4">
        <Field label="Schedule" value={humanSchedule} />
        <Field label="Owner" value={agentDisplayName(job.agent_id)} />
        <Field label="Next run" value={job.next_run ? formatEstTimestamp(job.next_run) : '—'} />
        <Field label="Last run" value={job.last_run ? formatEstTimestamp(job.last_run) : '—'} />
        <Field label="Status" value={job.enabled ? 'Active' : 'Disabled'} />
        {job.schedule_cron && <Field label="Cron expression" value={job.schedule_cron} mono />}
      </section>

      {job.command && (
        <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Command</div>
          <pre className="text-xs font-mono text-[var(--color-text-primary)] whitespace-pre-wrap break-all bg-[var(--color-bg-tertiary)] rounded p-3">{job.command}</pre>
        </section>
      )}
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-sm text-[var(--color-text-primary)] ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
