// Simple in-process scheduler that fires the daily digest at settings.digest_time.
// Starts on module import; persists across hot-reloads via globalThis.

import { getSettings } from './settings';
import { runDigest } from './digest';

declare global {
  // eslint-disable-next-line no-var
  var __mc_scheduler_started: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mc_last_digest_date: string | undefined;
}

export function startScheduler() {
  if (globalThis.__mc_scheduler_started) return;
  globalThis.__mc_scheduler_started = true;

  const tick = async () => {
    try {
      const s = getSettings();
      if (!s.digest_enabled) return;
      const now = new Date();
      const [h, m] = (s.digest_time || '06:00').split(':').map(Number);
      const todayStr = now.toISOString().slice(0, 10);
      if (now.getHours() === h && now.getMinutes() === m) {
        if (globalThis.__mc_last_digest_date !== todayStr) {
          globalThis.__mc_last_digest_date = todayStr;
          await runDigest(todayStr);
        }
      }
    } catch (e) {
      console.error('[scheduler] tick error:', e);
    }
  };

  setInterval(tick, 60 * 1000);
  // Initial check after 10s so we don't fire on startup for the same-minute case
  setTimeout(tick, 10000);
}
