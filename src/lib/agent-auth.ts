// Shared-secret auth for /api/agent/* endpoints.
//
// The secret is read from, in priority order:
//   1. process.env.MC_AGENT_TOKEN            (preferred — not in a config file)
//   2. ~/.openclaw/openclaw.json.mc_auth_token (fallback — shared with mc.sh)
//
// Agents (via mc.sh) send the token in an `Authorization: Bearer <token>` header.
// If no token is configured anywhere, auth is SKIPPED with a one-time warning
// (so a fresh install isn't broken). In that mode MC trusts the LAN.
//
// To enable enforcement: set MC_AGENT_TOKEN in the systemd unit or add
// `mc_auth_token: "sk_..."` to openclaw.json, then update agents to send it.

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
    const raw = fs.readFileSync(path.join(OPENCLAW_HOME, 'openclaw.json'), 'utf8');
    const data = JSON.parse(raw) as { mc_auth_token?: unknown };
    if (typeof data.mc_auth_token === 'string' && data.mc_auth_token.length > 0) {
      cachedToken = data.mc_auth_token;
      return cachedToken;
    }
  } catch {
    // openclaw.json missing or malformed — openclaw.ts already logs this.
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
        '[mc-auth] No MC_AGENT_TOKEN env var or mc_auth_token in openclaw.json. ' +
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
