// Simple in-process pub/sub event bus for real-time push to connected browser clients.
// Each SSE connection becomes a subscriber; events are broadcast to all.

export type McEventType =
  | 'task_updated'
  | 'flow_updated'
  | 'alert_new'
  | 'alert_updated'
  | 'artifact_new'
  | 'artifact_deleted'
  | 'artifact_review'
  | 'task_review'
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
  // eslint-disable-next-line no-var
  var __mc_shutdown_installed: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mc_closers: Set<() => void> | undefined;
}

function subs(): Set<Subscriber> {
  if (!globalThis.__mc_subs) globalThis.__mc_subs = new Set();
  return globalThis.__mc_subs;
}

function closers(): Set<() => void> {
  if (!globalThis.__mc_closers) globalThis.__mc_closers = new Set();
  return globalThis.__mc_closers;
}

// Register a cleanup fn (e.g. close an SSE controller) to be invoked on SIGTERM.
// Without this, systemd's stop-sigterm times out at 90s and SIGKILLs the process,
// because SSE connections hold the event loop open indefinitely.
export function registerShutdownHandler(close: () => void): () => void {
  closers().add(close);
  return () => closers().delete(close);
}

function installShutdownOnce() {
  if (globalThis.__mc_shutdown_installed) return;
  globalThis.__mc_shutdown_installed = true;
  const shutdown = (signal: string) => {
    console.log(`[mc] received ${signal}, closing ${closers().size} SSE streams`);
    for (const close of closers()) {
      try { close(); } catch { /* ignore */ }
    }
    closers().clear();
    subs().clear();
    if (globalThis.__mc_heartbeat) {
      clearInterval(globalThis.__mc_heartbeat);
      globalThis.__mc_heartbeat = undefined;
    }
    // Let Next's own handlers finish flushing, then exit.
    setTimeout(() => process.exit(0), 100);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

function ensureHeartbeat() {
  installShutdownOnce();
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
