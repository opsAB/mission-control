import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw');
const MEMORY_DIR = path.join(OPENCLAW_HOME, 'memory');

export interface MemoryAgent {
  agent_id: string;
  name: string;
  file_count: number;
  chunk_count: number;
}

export interface MemoryFile {
  path: string;
  size: number;
  mtime: number; // ms
}

export interface MemoryFileContent {
  path: string;
  text: string;
  chunk_count: number;
  mtime: number;
}

// Map OpenClaw agent_id to display name (mirrors openclaw.ts mapping).
const AGENT_DISPLAY: Record<string, string> = {
  main: 'Alfred',
  james: 'James',
  milo: 'Milo',
  lewis: 'Lewis',
  contractor: 'contractor',
};

export function memoryAvailable(): boolean {
  return fs.existsSync(MEMORY_DIR);
}

function dbPathFor(agentId: string): string {
  return path.join(MEMORY_DIR, `${agentId}.sqlite`);
}

export function listMemoryAgents(): MemoryAgent[] {
  if (!memoryAvailable()) return [];
  const files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.sqlite'));
  const out: MemoryAgent[] = [];
  for (const f of files) {
    const agentId = f.replace(/\.sqlite$/, '');
    try {
      const db = new Database(path.join(MEMORY_DIR, f), { readonly: true });
      const fcount = (db.prepare('SELECT COUNT(*) as c FROM files').get() as { c: number }).c;
      const ccount = (db.prepare('SELECT COUNT(*) as c FROM chunks').get() as { c: number }).c;
      db.close();
      out.push({
        agent_id: agentId,
        name: AGENT_DISPLAY[agentId] ?? agentId,
        file_count: fcount,
        chunk_count: ccount,
      });
    } catch {
      // skip unreadable
    }
  }
  out.sort((a, b) => b.chunk_count - a.chunk_count);
  return out;
}

export function listMemoryFiles(agentId: string): MemoryFile[] {
  const p = dbPathFor(agentId);
  if (!fs.existsSync(p)) return [];
  try {
    const db = new Database(p, { readonly: true });
    const rows = db.prepare('SELECT path, size, mtime FROM files ORDER BY mtime DESC').all() as Array<{ path: string; size: number; mtime: number }>;
    db.close();
    return rows;
  } catch {
    return [];
  }
}

export function readMemoryFileContent(agentId: string, filePath: string): MemoryFileContent | null {
  const p = dbPathFor(agentId);
  if (!fs.existsSync(p)) return null;
  try {
    const db = new Database(p, { readonly: true });
    const fileRow = db.prepare('SELECT path, size, mtime FROM files WHERE path = ?').get(filePath) as { path: string; size: number; mtime: number } | undefined;
    if (!fileRow) { db.close(); return null; }
    const chunks = db.prepare('SELECT text, start_line, end_line FROM chunks WHERE path = ? ORDER BY start_line').all(filePath) as Array<{ text: string; start_line: number; end_line: number }>;
    db.close();
    // Dedupe and concat: some chunks may overlap. Keep order, prefer unique lines.
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const c of chunks) {
      const sig = `${c.start_line}-${c.end_line}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      parts.push(c.text);
    }
    return {
      path: fileRow.path,
      text: parts.join('\n\n---\n\n'),
      chunk_count: chunks.length,
      mtime: fileRow.mtime,
    };
  } catch (e) {
    console.error('readMemoryFileContent error:', e);
    return null;
  }
}

export function searchMemory(agentId: string, query: string, limit: number = 20): Array<{ path: string; text: string; start_line: number }> {
  if (!query.trim()) return [];
  const p = dbPathFor(agentId);
  if (!fs.existsSync(p)) return [];
  try {
    const db = new Database(p, { readonly: true });
    // FTS5 query with safe quoting
    const safe = query.replace(/"/g, '""');
    const rows = db.prepare(`
      SELECT path, start_line, SUBSTR(text, 1, 400) as text
      FROM chunks_fts
      WHERE chunks_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(`"${safe}"`, limit) as Array<{ path: string; start_line: number; text: string }>;
    db.close();
    return rows;
  } catch {
    return [];
  }
}
