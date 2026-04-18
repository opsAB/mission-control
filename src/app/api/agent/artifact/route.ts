import { NextRequest } from 'next/server';
import { ensureInit } from '@/lib/init';
import { getDb } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { requireAgentAuth } from '@/lib/agent-auth';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = path.join(process.cwd(), 'data', 'artifacts');

// POST /api/agent/artifact
// Body: {
//   agent_id,
//   title,
//   type?,                     // report | brief | research | document | page | code | other
//   task_id?, flow_id?,
//   project_id?,
//   summary?,
//   file_path?,                // absolute path on PC2; if provided we just reference it
//   content?, filename?,       // if provided we write content to data/artifacts/<filename>
//   content_base64?,           // for binary
//   serve_url?                 // optional override; otherwise constructed from filename
// }
export async function POST(req: NextRequest) {
  const authFail = requireAgentAuth(req);
  if (authFail) return authFail;
  ensureInit();
  const body = await req.json();
  const { agent_id, title, type = 'document', task_id, flow_id, project_id, summary, content, filename, content_base64, dispatch_id } = body;
  let { file_path, serve_url } = body;

  if (!agent_id || !title) {
    return Response.json({ error: 'agent_id and title required' }, { status: 400 });
  }

  // If inline content was posted, write it to disk
  if ((content || content_base64) && filename) {
    // Explicitly reject path separators and traversal fragments. The sanitizer
    // below would map these to underscores, but a noisy reject surfaces bad
    // client code faster than a silent rename.
    if (typeof filename !== 'string' || filename.includes('/') || filename.includes('\\') || filename.includes('..') || filename.startsWith('.')) {
      return Response.json({ error: 'invalid_filename', message: 'filename must be a plain basename (no slashes, no "..", no leading dot)' }, { status: 400 });
    }
    if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const resolvedDir = path.resolve(ARTIFACT_DIR);
    const fullPath = path.resolve(resolvedDir, safeName);
    // Belt-and-braces: even after sanitizing, verify the resolved path is still inside ARTIFACT_DIR.
    if (!fullPath.startsWith(resolvedDir + path.sep)) {
      return Response.json({ error: 'invalid_filename', message: 'resolved path escapes artifact dir' }, { status: 400 });
    }
    if (content_base64) {
      fs.writeFileSync(fullPath, Buffer.from(content_base64, 'base64'));
    } else {
      fs.writeFileSync(fullPath, content ?? '', 'utf8');
    }
    file_path = fullPath;
    if (!serve_url) serve_url = `/api/artifacts/serve/${safeName}`;
  }

  const result = getDb().prepare(`
    INSERT INTO artifacts (title, type, task_id, flow_id, file_path, serve_url, review_status, owner, project_id, agent_id, summary, dispatch_id)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
  `).run(
    title, type,
    task_id ?? null, flow_id ?? null,
    file_path ?? '', serve_url ?? '',
    agent_id, project_id ?? null, agent_id, summary ?? null,
    dispatch_id ?? null
  );

  const id = Number(result.lastInsertRowid);
  broadcast('artifact_new', { id, title, agent_id, type });

  return Response.json({ ok: true, id, serve_url: serve_url ?? '' });
}
