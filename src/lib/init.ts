import { seedIfEmpty } from './seed';
import { startScheduler } from './scheduler';

let initialized = false;

export function ensureInit() {
  if (initialized) return;
  initialized = true;
  seedIfEmpty();
  startScheduler();
}
