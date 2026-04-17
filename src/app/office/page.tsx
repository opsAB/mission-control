import { getOfficeAgents } from '@/lib/queries';
import OfficeView from './OfficeView';

export const dynamic = 'force-dynamic';

export default function OfficePage() {
  const agents = getOfficeAgents();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Office</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Agent status visualizer · driven by real events</p>
      </div>
      <OfficeView agents={agents} />
    </div>
  );
}
