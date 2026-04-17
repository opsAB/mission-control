import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ensureInit } from '@/lib/init';
import { getDb } from '@/lib/db';
import { broadcast } from '@/lib/events';

// DELETE /api/artifacts/:id
// Removes an artifact row and deletes its on-disk file (if the file lives
// inside data/artifacts — we refuse to touch paths outside that dir).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureInit();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return Response.json({ error: 'invalid id' }, { status: 400 });
  }

  const db = getDb();
  const row = db.prepare('SELECT id, file_path FROM artifacts WHERE id = ?').get(id) as
    | { id: number; file_path: string } | undefined;
  if (!row) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  const artifactDir = path.join(process.cwd(), 'data', 'artifacts');
  if (row.file_path) {
    const resolved = path.resolve(row.file_path);
    if (resolved.startsWith(artifactDir + path.sep) || resolved === artifactDir) {
      try { fs.unlinkSync(resolved); } catch { /* ignore: file may already be gone */ }
    }
  }

  db.prepare('DELETE FROM artifacts WHERE id = ?').run(id);
  broadcast('artifact_deleted', { id });
  return Response.json({ ok: true });
}
