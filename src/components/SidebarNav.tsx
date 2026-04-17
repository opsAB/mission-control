'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { href: '/', label: 'Overview', icon: '◉' },
  { href: '/alerts', label: 'Alerts', icon: '◎', badgeKey: 'alerts' as const },
  { href: '/tasks', label: 'Tasks', icon: '☰' },
  { href: '/dispatch', label: 'Dispatch', icon: '→' },
  { href: '/review', label: 'Review', icon: '✓' },
  { href: '/docs', label: 'Docs', icon: '◧' },
  { href: '/workflows', label: 'Workflows', icon: '⟳' },
  { href: '/memory', label: 'Memory', icon: '◈' },
  { href: '/projects', label: 'Projects', icon: '▦' },
  { href: '/agents', label: 'Agents', icon: '⬡' },
  { href: '/office', label: 'Office', icon: '⌂' },
  { href: '/coding-runs', label: 'Flow Runs', icon: '⟨⟩' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export default function SidebarNav({ unreadAlerts }: { unreadAlerts: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
      {nav.map(item => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        const badge = item.badgeKey === 'alerts' ? unreadAlerts : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              isActive
                ? 'bg-[var(--color-accent)] text-white font-medium'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
            }`}
          >
            <span className="text-base w-5 text-center">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {badge > 0 && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center ${isActive ? 'bg-white/25 text-white' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
