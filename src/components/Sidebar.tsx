import Link from 'next/link';
import SidebarNav from './SidebarNav';
import { getUnreadAlertCount } from '@/lib/alerts';
import { getSettings } from '@/lib/settings';

export default function Sidebar() {
  const unread = getUnreadAlertCount();
  const settings = getSettings();

  return (
    <aside className="w-56 h-screen fixed left-0 top-0 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col z-50">
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <h1 className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">Mission Control</h1>
        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Operational Command</p>
      </div>
      <SidebarNav unreadAlerts={unread} />
      <div className="px-4 py-3 border-t border-[var(--color-border)]">
        {settings.mission_statement ? (
          <div>
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Mission</div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-4">{settings.mission_statement}</p>
          </div>
        ) : (
          <Link href="/settings" className="block text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)]">
            Set a mission statement →
          </Link>
        )}
      </div>
      <div className="px-5 py-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
        PC2 · LAN Only
      </div>
    </aside>
  );
}
