'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { href: '/', label: 'Overview', icon: '◉' },
  { href: '/tasks', label: 'Tasks', icon: '☰' },
  { href: '/review', label: 'Review', icon: '✓' },
  { href: '/docs', label: 'Docs', icon: '◧' },
  { href: '/workflows', label: 'Workflows', icon: '⟳' },
  { href: '/projects', label: 'Projects', icon: '▦' },
  { href: '/agents', label: 'Agents', icon: '⬡' },
  { href: '/coding-runs', label: 'Coding Runs', icon: '⟨⟩' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 h-screen fixed left-0 top-0 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col z-50">
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <h1 className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
          Mission Control
        </h1>
        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Operational Command</p>
      </div>
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
        PC2 · LAN Only
      </div>
    </aside>
  );
}
