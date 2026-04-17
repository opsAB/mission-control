import { seedIfEmpty } from './seed';

let initialized = false;

export function ensureInit() {
  if (initialized) return;
  initialized = true;
  seedIfEmpty();
}
