import fs from 'fs';
import path from 'path';
import os from 'os';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw');
const MEMORY_DIR = path.join(OPENCLAW_HOME, 'memory');

export interface MemoryEntry {
  name: string;
  relpath: string;
  size: number;
  mtime: string;
  is_dir: boolean;
}

export interface MemoryFile {
  relpath: string;
  content: string;
  mtime: string;
  size: number;
}

export function listMemory(subpath: string = ''): MemoryEntry[] {
  const target = path.resolve(MEMORY_DIR, subpath);
  // Prevent escaping
  if (!target.startsWith(MEMORY_DIR)) return [];
  if (!fs.existsSync(target)) return [];
  const entries = fs.readdirSync(target, { withFileTypes: true });
  const out: MemoryEntry[] = [];
  for (const e of entries) {
    const full = path.join(target, e.name);
    const rel = path.relative(MEMORY_DIR, full);
    try {
      const stat = fs.statSync(full);
      out.push({
        name: e.name,
        relpath: rel,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
        is_dir: e.isDirectory(),
      });
    } catch { /* skip */ }
  }
  out.sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return b.mtime.localeCompare(a.mtime);
  });
  return out;
}

export function readMemoryFile(relpath: string): MemoryFile | null {
  const target = path.resolve(MEMORY_DIR, relpath);
  if (!target.startsWith(MEMORY_DIR)) return null;
  if (!fs.existsSync(target)) return null;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) return null;
  // safety: only text-ish files under 2MB
  if (stat.size > 2 * 1024 * 1024) return { relpath, content: '[file too large to preview]', mtime: stat.mtime.toISOString(), size: stat.size };
  const content = fs.readFileSync(target, 'utf8');
  return { relpath, content, mtime: stat.mtime.toISOString(), size: stat.size };
}

export function memoryAvailable(): boolean {
  return fs.existsSync(MEMORY_DIR);
}
