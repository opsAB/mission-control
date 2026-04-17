'use client';

import { useEffect, useRef, useState } from 'react';

interface OfficeAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: 'working' | 'idle' | 'sleeping';
  current_task: { title: string; source: 'task' | 'dispatch'; ref: string } | null;
  last_activity_at: string | null;
  last_activity_summary: string | null;
  last_activity_action: string | null;
  pending_dispatches: number;
  active_count: number;
}

interface Pose { x: number; y: number }

// Fixed "desks" on a 12x8 grid
const DESKS: Record<string, Pose> = {
  main:       { x: 2,  y: 2 },
  james:      { x: 7,  y: 2 },
  milo:       { x: 2,  y: 5 },
  lewis:      { x: 7,  y: 5 },
  contractor: { x: 10, y: 3 },
};
const COOLER: Pose = { x: 5, y: 4 };
const OUTBOX: Pose = { x: 10, y: 6 };  // where artifacts get "delivered"

type AnimKind = 'walk_to' | 'visit' | 'alerted';

interface AnimStep {
  kind: AnimKind;
  target?: Pose;         // for walk_to / visit
  bubble?: string;       // emoji or label overlay
  holdMs: number;
  label?: string;        // human-readable current-action label
}

interface AgentAnim {
  queue: AnimStep[];
  currentUntil: number;  // epoch ms when current step ends
  currentPose: Pose;
  bubble: string | null;
  label: string | null;  // e.g. "walking to James' desk"
}

function deskOf(id: string): Pose {
  return DESKS[id] ?? { x: 1, y: 1 };
}

function relTime(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function statusColor(s: OfficeAgent['status']): string {
  if (s === 'working') return 'text-emerald-400';
  if (s === 'idle') return 'text-amber-400';
  return 'text-gray-500';
}

function statusDot(s: OfficeAgent['status']): string {
  if (s === 'working') return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]';
  if (s === 'idle') return 'bg-amber-500';
  return 'bg-gray-600';
}

function restingPose(agent: OfficeAgent): Pose {
  return deskOf(agent.id);
}

function poseEq(a: Pose, b: Pose) {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
}

export default function OfficeView({ agents }: { agents: OfficeAgent[] }) {
  const [selected, setSelected] = useState<OfficeAgent | null>(null);
  const [anims, setAnims] = useState<Record<string, AgentAnim>>(() => {
    const init: Record<string, AgentAnim> = {};
    for (const a of agents) {
      init[a.id] = { queue: [], currentUntil: 0, currentPose: restingPose(a), bubble: null, label: null };
    }
    return init;
  });

  // Track last-seen ids so we can initialise new agents
  const animsRef = useRef(anims);
  animsRef.current = anims;

  // Trigger tick: advances queue, returns each agent to resting pose when queue empty
  useEffect(() => {
    const iv = setInterval(() => {
      setAnims(prev => {
        const next = { ...prev };
        const now = Date.now();
        for (const a of agents) {
          const cur = next[a.id] ?? { queue: [], currentUntil: 0, currentPose: restingPose(a), bubble: null, label: null };
          if (now >= cur.currentUntil) {
            if (cur.queue.length > 0) {
              const [step, ...rest] = cur.queue;
              const target = step.target ?? restingPose(a);
              next[a.id] = {
                queue: rest,
                currentUntil: now + step.holdMs,
                currentPose: target,
                bubble: step.bubble ?? null,
                label: step.label ?? null,
              };
            } else {
              // resting — snap to desk, clear bubble/label
              const rest = restingPose(a);
              if (!poseEq(cur.currentPose, rest) || cur.bubble || cur.label) {
                next[a.id] = { queue: [], currentUntil: 0, currentPose: rest, bubble: null, label: null };
              }
            }
          }
        }
        return next;
      });
    }, 500);
    return () => clearInterval(iv);
  }, [agents]);

  // Helper to enqueue an animation for an agent
  const enqueue = (agentId: string, steps: AnimStep[]) => {
    setAnims(prev => {
      const cur = prev[agentId];
      if (!cur) return prev;
      return { ...prev, [agentId]: { ...cur, queue: [...cur.queue, ...steps] } };
    });
  };

  // Subscribe to SSE for event-driven animations
  useEffect(() => {
    const es = new EventSource('/api/stream');

    const unwrap = <T,>(data: string): T => {
      const evt = JSON.parse(data) as { payload?: T };
      return (evt.payload ?? {}) as T;
    };

    const onDispatchNew = (e: MessageEvent) => {
      try {
        const p = unwrap<{ assignee_agent_id?: string; from_agent_id?: string }>(e.data);
        const assignee = p.assignee_agent_id;
        if (!assignee) return;
        // Alfred walks to specialist's desk, then back — delegation handshake
        const alfred = 'main';
        if (assignee !== alfred && DESKS[assignee]) {
          enqueue(alfred, [
            { kind: 'walk_to', target: deskOf(assignee), holdMs: 2800, bubble: '📋', label: `delegating to ${assignee}` },
            { kind: 'walk_to', target: deskOf(alfred), holdMs: 2200, label: 'returning to desk' },
          ]);
          // Specialist wakes up briefly
          enqueue(assignee, [
            { kind: 'visit', target: deskOf(assignee), holdMs: 3000, bubble: '👀', label: 'new dispatch' },
          ]);
        }
      } catch { /* ignore */ }
    };

    const onDispatchUpdated = (e: MessageEvent) => {
      try {
        const p = unwrap<{ assignee_agent_id?: string; status?: string }>(e.data);
        if (!p.assignee_agent_id || !DESKS[p.assignee_agent_id]) return;
        if (p.status === 'picked_up') {
          enqueue(p.assignee_agent_id, [
            { kind: 'visit', target: deskOf(p.assignee_agent_id), holdMs: 2500, bubble: '✋', label: 'picked up dispatch' },
          ]);
        }
      } catch { /* ignore */ }
    };

    const onArtifactNew = (e: MessageEvent) => {
      try {
        const p = unwrap<{ agent_id?: string; owner?: string }>(e.data);
        const agent = p.agent_id ?? p.owner;
        if (!agent || !DESKS[agent]) return;
        enqueue(agent, [
          { kind: 'walk_to', target: OUTBOX, holdMs: 3200, bubble: '📦', label: 'delivering artifact' },
          { kind: 'walk_to', target: deskOf(agent), holdMs: 2200, label: 'returning to desk' },
        ]);
      } catch { /* ignore */ }
    };

    const onAlertNew = (e: MessageEvent) => {
      try {
        const p = unwrap<{ agent_id?: string }>(e.data);
        if (!p.agent_id || !DESKS[p.agent_id]) return;
        enqueue(p.agent_id, [
          { kind: 'alerted', target: deskOf(p.agent_id), holdMs: 5000, bubble: '❗', label: 'alert raised' },
        ]);
      } catch { /* ignore */ }
    };

    const onNoteNew = (e: MessageEvent) => {
      try {
        const p = unwrap<{ agent_id?: string }>(e.data);
        if (!p.agent_id || !DESKS[p.agent_id]) return;
        enqueue(p.agent_id, [
          { kind: 'visit', target: deskOf(p.agent_id), holdMs: 1800, bubble: '📝', label: 'wrote note' },
        ]);
      } catch { /* ignore */ }
    };

    es.addEventListener('dispatch_new', onDispatchNew);
    es.addEventListener('dispatch_updated', onDispatchUpdated);
    es.addEventListener('artifact_new', onArtifactNew);
    es.addEventListener('alert_new', onAlertNew);
    es.addEventListener('note_new', onNoteNew);
    es.onerror = () => { /* auto-reconnect */ };

    return () => { es.close(); };
  }, []);

  // Break animation: idle agents occasionally walk to cooler (once per ~20 min per agent, deterministic)
  useEffect(() => {
    const iv = setInterval(() => {
      for (const a of agents) {
        if (a.status !== 'idle') continue;
        const last = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
        // Use agent id hash to stagger breaks across the 20-min window
        const hash = a.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
        const windowMs = 20 * 60 * 1000;
        const offset = (hash * 97) % windowMs;
        const phase = (Date.now() + offset) % windowMs;
        // Fire once when phase is within a 2s window (tick is every 30s so this hits ~once per 20 min)
        if (phase < 2000 && Date.now() - last > 5 * 60 * 1000) {
          const cur = animsRef.current[a.id];
          if (cur && cur.queue.length === 0 && Date.now() >= cur.currentUntil) {
            enqueue(a.id, [
              { kind: 'walk_to', target: COOLER, holdMs: 5000, bubble: '💧', label: 'taking a break' },
              { kind: 'walk_to', target: deskOf(a.id), holdMs: 2200, label: 'back to desk' },
            ]);
          }
        }
      }
    }, 30000);
    return () => clearInterval(iv);
  }, [agents]);

  // Force re-render every 20s so relative times stay fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 20000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="space-y-6">
      {/* Pixel-art office */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-6">
        <div className="relative aspect-[3/2] bg-gradient-to-br from-[var(--color-bg-primary)] to-[var(--color-bg-tertiary)] rounded-md border border-[var(--color-border)] overflow-hidden">
          {/* Desks */}
          {agents.map(a => {
            const d = deskOf(a.id);
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
            title="Water cooler"
          >
            <span className="text-xs">💧</span>
          </div>

          {/* Outbox tray */}
          <div
            className="absolute w-10 h-8 border border-[var(--color-border-light)] bg-amber-500/10 rounded-sm flex items-center justify-center"
            style={{ left: `${(OUTBOX.x / 12) * 100}%`, top: `${(OUTBOX.y / 8) * 100}%`, transform: 'translate(-50%, -50%)' }}
            title="Outbox (artifacts)"
          >
            <span className="text-xs">📤</span>
          </div>

          {/* Agent sprites */}
          {agents.map(a => {
            const anim = anims[a.id];
            const pos = anim?.currentPose ?? deskOf(a.id);
            const glow = a.status === 'working'
              ? 'shadow-lg shadow-emerald-500/50 ring-2 ring-emerald-500/60'
              : a.status === 'idle'
                ? 'ring-1 ring-amber-500/40'
                : 'opacity-60';
            const bob = a.status === 'working' ? 'animate-pulse' : '';
            return (
              <button
                key={a.id}
                onClick={() => setSelected(a)}
                className={`absolute w-10 h-10 rounded-full bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-light)] flex items-center justify-center text-xl transition-all duration-[1200ms] ease-in-out cursor-pointer hover:scale-110 ${glow} ${bob}`}
                style={{ left: `${(pos.x / 12) * 100}%`, top: `${(pos.y / 8) * 100}%`, transform: 'translate(-50%, -50%)' }}
                title={`${a.name} · ${a.status}${anim?.label ? ` · ${anim.label}` : ''}`}
              >
                {a.status === 'sleeping' ? '💤' : (a.emoji || a.name[0])}
                {anim?.bubble && (
                  <span className="absolute -top-3 -right-3 text-sm bg-[var(--color-bg-primary)] rounded-full border border-[var(--color-border-light)] w-6 h-6 flex items-center justify-center">
                    {anim.bubble}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--color-text-muted)]">
          <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />working</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />idle (active in last 30m)</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-gray-600 mr-1" />sleeping</span>
          <span>📋 delegating · 📦 delivering · 💧 break · ❗ alert · 📝 note · 👀 new dispatch</span>
        </div>
      </div>

      {/* Status board */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Status board</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {agents.map(a => {
            const anim = anims[a.id];
            const live = anim?.label;
            return (
              <button
                key={`card-${a.id}`}
                onClick={() => setSelected(a)}
                className={`text-left bg-[var(--color-bg-tertiary)] border rounded-md p-3 transition-colors ${
                  selected?.id === a.id ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-light)]'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${statusDot(a.status)}`} />
                  <span className="text-lg">{a.emoji}</span>
                  <span className="text-sm font-medium">{a.name}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono ml-1">{a.id}</span>
                  <span className={`text-[11px] font-medium ml-auto ${statusColor(a.status)}`}>{a.status}</span>
                </div>

                <div className="text-xs text-[var(--color-text-muted)] mb-2">{a.role}</div>

                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-[var(--color-text-muted)]">Task: </span>
                    {a.current_task ? (
                      <span className="text-[var(--color-text-primary)]">
                        {a.current_task.title}
                        <span className="text-[10px] text-[var(--color-text-muted)] font-mono ml-1">
                          ({a.current_task.source === 'dispatch' ? `dispatch #${a.current_task.ref.replace('dispatch-', '')}` : `task ${a.current_task.ref.slice(0, 8)}`})
                        </span>
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Last activity: </span>
                    <span className="text-[var(--color-text-primary)]">{relTime(a.last_activity_at)}</span>
                    {a.last_activity_action && (
                      <span className="text-[10px] text-[var(--color-text-muted)] ml-1">· {a.last_activity_action}</span>
                    )}
                  </div>
                  {a.last_activity_summary && (
                    <div className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2">
                      {a.last_activity_summary}
                    </div>
                  )}
                  <div className="flex gap-3 pt-1 text-[11px]">
                    <span>
                      <span className="text-[var(--color-text-muted)]">queue: </span>
                      <span className={a.pending_dispatches > 0 ? 'text-amber-400' : 'text-[var(--color-text-muted)]'}>{a.pending_dispatches}</span>
                    </span>
                    <span>
                      <span className="text-[var(--color-text-muted)]">active: </span>
                      <span className={a.active_count > 0 ? 'text-emerald-400' : 'text-[var(--color-text-muted)]'}>{a.active_count}</span>
                    </span>
                    {live && <span className="text-[var(--color-accent)] ml-auto">· {live}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
