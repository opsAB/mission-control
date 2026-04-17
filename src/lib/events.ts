// Simple in-process pub/sub event bus for real-time push to connected browser clients.
// Each SSE connection becomes a subscriber; events are broadcast to all.

export type McEventType =
  | 'task_updated'
  | 'flow_updated'
  | 'alert_new'
  | 'alert_updated'
  | 'artifact_new'
  | 'note_new'
  | 'activity_new'
  | 'dispatch_new'
  | 'dispatch_updated'
  | 'settings_changed'
  | 'digest_new'
  | 'heartbeat';

export interface McEvent {
  type: McEventType;
  ts: number;
  payload?: unknown;
}

type Subscriber = (event: McEvent) => void;

declare global {
  // eslint-disable-next-line no-var
  var __mc_subs: Set<Subscriber> | undefined;
  // eslint-disable-next-line no-var
  var __mc_heartbeat: NodeJS.Timeout | undefined;
}

function subs(): Set<Subscriber> {
  if (!globalThis.__mc_subs) globalThis.__mc_subs = new Set();
  return globalThis.__mc_subs;
}

function ensureHeartbeat() {
  if (globalThis.__mc_heartbeat) return;
  globalThis.__mc_heartbeat = setInterval(() => {
    publish({ type: 'heartbeat', ts: Date.now() });
  }, 30000);
}

export function subscribe(fn: Subscriber): () => void {
  ensureHeartbeat();
  subs().add(fn);
  return () => subs().delete(fn);
}

export function publish(event: McEvent) {
  for (const fn of subs()) {
    try { fn(event); } catch { /* swallow */ }
  }
}

export function broadcast(type: McEventType, payload?: unknown) {
  publish({ type, ts: Date.now(), payload });
}

export function subCount(): number {
  return subs().size;
}
