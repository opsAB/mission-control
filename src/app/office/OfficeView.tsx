'use client';

import { useEffect, useState } from 'react';

interface OfficeAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: string;
  current_task: string | null;
}

interface Pose {
  x: number;
  y: number;
}

// Fixed "desk" positions on a 12x8 grid, with wandering animation between them and a "water cooler"
const DESKS: Record<string, Pose> = {
  main:       { x: 2,  y: 2 },
  james:      { x: 7,  y: 2 },
  milo:       { x: 2,  y: 5 },
  lewis:      { x: 7,  y: 5 },
  contractor: { x: 10, y: 3 },
};
const COOLER: Pose = { x: 5, y: 4 };

export default function OfficeView({ agents }: { agents: OfficeAgent[] }) {
  const [poses, setPoses] = useState<Record<string, Pose>>(() => {
    const init: Record<string, Pose> = {};
    for (const a of agents) init[a.id] = DESKS[a.id] ?? { x: 1, y: 1 };
    return init;
  });
  const [selected, setSelected] = useState<OfficeAgent | null>(null);

  useEffect(() => {
    const tick = () => {
      setPoses(prev => {
        const next = { ...prev };
        for (const a of agents) {
          const atDesk = DESKS[a.id] ?? { x: 1, y: 1 };
          const shouldBeWorking = a.status === 'active' && !!a.current_task;
          // Idle agents roam occasionally, active agents stay at desk (with small jitter)
          if (shouldBeWorking) {
            next[a.id] = { x: atDesk.x + (Math.random() < 0.1 ? 0.3 : 0), y: atDesk.y };
          } else if (Math.random() < 0.3) {
            // go to cooler or back to desk
            const roll = Math.random();
            next[a.id] = roll < 0.4 ? COOLER : atDesk;
          }
        }
        return next;
      });
    };
    const iv = setInterval(tick, 3000);
    return () => clearInterval(iv);
  }, [agents]);

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-6">
      <div className="relative aspect-[3/2] bg-gradient-to-br from-[var(--color-bg-primary)] to-[var(--color-bg-tertiary)] rounded-md border border-[var(--color-border)] overflow-hidden">
        {/* Desks */}
        {agents.map(a => {
          const d = DESKS[a.id] ?? { x: 1, y: 1 };
          return (
            <div
              key={`desk-${a.id}`}
              className="absolute w-16 h-10 border border-[var(--color-border-light)] bg-[var(--color-bg-tertiary)]/60 rounded-sm flex items-end justify-center"
              style={{ left: `${(d.x / 12) * 100}%`, top: `${(d.y / 8) * 100}%`, transform: 'translate(-50%, -10%)' }}
            >
              <span className="text-[10px] text-[var(--color-text-muted)] mb-0.5 font-mono">{a.name}</span>
            </div>
          );
        })}

        {/* Water cooler */}
        <div
          className="absolute w-8 h-10 border border-[var(--color-border-light)] bg-blue-500/10 rounded-t-full flex items-center justify-center"
          style={{ left: `${(COOLER.x / 12) * 100}%`, top: `${(COOLER.y / 8) * 100}%`, transform: 'translate(-50%, -50%)' }}
        >
          <span className="text-xs">💧</span>
        </div>

        {/* Agent sprites */}
        {agents.map(a => {
          const pos = poses[a.id] ?? DESKS[a.id] ?? { x: 1, y: 1 };
          const glow = a.status === 'active' ? 'shadow-lg shadow-emerald-500/50 ring-2 ring-emerald-500/50' : '';
          return (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className={`absolute w-10 h-10 rounded-full bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-light)] flex items-center justify-center text-xl transition-all duration-[2800ms] ease-in-out cursor-pointer hover:scale-110 ${glow}`}
              style={{ left: `${(pos.x / 12) * 100}%`, top: `${(pos.y / 8) * 100}%`, transform: 'translate(-50%, -50%)' }}
              title={`${a.name} · ${a.status}`}
            >
              {a.emoji || a.name[0]}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {agents.map(a => (
          <button
            key={`card-${a.id}`}
            onClick={() => setSelected(a)}
            className={`text-left bg-[var(--color-bg-tertiary)] border rounded-md p-3 transition-colors ${
              selected?.id === a.id ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-light)]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{a.emoji}</span>
              <span className="text-sm font-medium">{a.name}</span>
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mb-1">{a.role}</div>
            <div className={`text-xs font-medium ${a.status === 'active' ? 'text-emerald-400' : a.status === 'idle' ? 'text-gray-400' : 'text-red-400'}`}>
              {a.status}
            </div>
            {a.current_task && <div className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">{a.current_task}</div>}
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-accent)]/30 rounded-md p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{selected.emoji}</span>
            <h3 className="text-sm font-semibold">{selected.name}</h3>
            <span className="text-xs text-[var(--color-text-muted)] font-mono">{selected.id}</span>
          </div>
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">{selected.role}</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {selected.current_task ? <>Working on: <span className="text-[var(--color-text-primary)]">{selected.current_task}</span></> : 'Idle'}
          </div>
        </div>
      )}
    </div>
  );
}
