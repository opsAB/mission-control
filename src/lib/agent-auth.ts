// Shared-secret auth for /api/agent/* endpoints.
//
// The secret is read from, in priority order:
//   1. process.env.MC_AGENT_TOKEN            (preferred — not in a config file)
//   2. ~/.openclaw/mc_auth_token             (plain file, one line, mode 0600)
//
// NOTE: we used to read `mc_auth_token` from ~/.openclaw/openclaw.json, but
// OpenClaw 2026.4.15 enforces a strict root schema and rejects unknown keys —
// stashing the token there broke `openclaw` and the gateway. The token now
// lives in a sibling file that OpenClaw doesn't touch.
//
// Agents (via mc.sh) send the token in an `Authorization: Bearer <token>` header.
// If no token is configured anywhere, auth is SKIPPED with a one-time warning
// (so a fresh install isn't broken). In that mode MC trusts the LAN.

import fs from 'fs';
import path from 'path';
import os from 'os';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw');

let warned = false;
let cachedToken: string | null | undefined = undefined;  // undefined = not yet resolved

function resolveToken(): string | null {
  if (cachedToken !== undefined) return cachedToken;

  const envTok = process.env.MC_AGENT_TOKEN;
  if (envTok && envTok.length > 0) {
    cachedToken = envTok;
    return cachedToken;
  }

  try {
    const fileTok = fs.readFileSync(path.join(OPENCLAW_HOME, 'mc_auth_token'), 'utf8').trim();
    if (fileTok.length > 0) {
      cachedToken = fileTok;
      return cachedToken;
    }
  } catch {
    // mc_auth_token file missing — fall through to "no token configured".
  }

  cachedToken = null;
  return null;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Check the request's Authorization header against the configured token.
 * Returns null on success, or a Response (401) that the caller should return.
 *
 * If no token is configured anywhere, returns null (auth disabled) and logs
 * a one-time warning so operators know their API is open.
 */
export function requireAgentAuth(req: Request): Response | null {
  const token = resolveToken();
  if (token === null) {
    if (!warned) {
      warned = true;
      console.warn(
        '[mc-auth] No MC_AGENT_TOKEN env var or ~/.openclaw/mc_auth_token file. ' +
        'Agent endpoints are OPEN to any LAN caller. Set one to enforce auth.'
      );
    }
    return null;
  }

  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) {
    return Response.json(
      { error: 'auth_required', message: 'Missing Authorization header. Expected: Bearer <token>' },
      { status: 401 }
    );
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return Response.json(
      { error: 'auth_invalid', message: 'Authorization header must be "Bearer <token>"' },
      { status: 401 }
    );
  }

  if (!constantTimeEqual(match[1].trim(), token)) {
    return Response.json({ error: 'auth_rejected', message: 'Invalid token' }, { status: 401 });
  }

  return null;
}
