import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { agentDisplayName } from './format';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw');

export function isOpenClawAvailable(): boolean {
  return fs.existsSync(path.join(OPENCLAW_HOME, 'openclaw.json'));
}

export interface OCAgent {
  id: string;
  name: string;
  emoji: string;
  workspace?: string;
}

export interface OCTask {
  task_id: string;
  owner_key: string;
  agent_id: string | null;
  source: 'telegram' | 'subagent' | 'main' | 'cli' | 'other';
  source_ref: string | null;
  status: string;
  delivery_status: string;
  task_preview: string;
  task_full: string;
  progress_summary: string | null;
  terminal_summary: string | null;
  created_at: number;
  started_at: number | null;
  ended_at: number | null;
  last_event_at: number | null;
  parent_task_id: string | null;
  parent_flow_id: string | null;
  error: string | null;
}

export interface OCFlow {
  flow_id: string;
  owner_key: string;
  goal: string;
  status: string;
  revision: number;
  current_step: string | null;
  blocked_task_id: string | null;
  blocked_summary: string | null;
  created_at: number;
  updated_at: number;
  ended_at: number | null;
}

export interface OCCronJob {
  id: string;
  agentId: string;
  name: string;
  enabled: boolean;
  schedule: unknown;
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  command?: string;
  description?: string;
  sources?: string[];
}

function openDb(relativePath: string): Database.Database | null {
  const p = path.join(OPENCLAW_HOME, relativePath);
  if (!fs.existsSync(p)) return null;
  try {
    return new Database(p, { readonly: true, fileMustExist: true });
  } catch (e) {
    console.error(`Failed to open OpenClaw db ${relativePath}:`, e);
    return null;
  }
}

function parseOwnerKey(key: string): { agent_id: string | null; source: OCTask['source']; source_ref: string | null } {
  // Examples:
  //   agent:main:main
  //   agent:main:telegram:direct:416658381
  //   agent:main:subagent:UUID
  //   agent:contractor:telegram:direct:416658381
  const parts = key.split(':');
  if (parts[0] !== 'agent') return { agent_id: null, source: 'other', source_ref: key };
  const agent_id = parts[1] ?? null;
  const rest = parts.slice(2);
  if (rest[0] === 'telegram') return { agent_id, source: 'telegram', source_ref: rest.slice(1).join(':') };
  if (rest[0] === 'subagent') return { agent_id, source: 'subagent', source_ref: rest.slice(1).join(':') };
  if (rest[0] === 'main') return { agent_id, source: 'main', source_ref: null };
  return { agent_id, source: 'other', source_ref: rest.join(':') || null };
}

export function getOpenClawAgents(): OCAgent[] {
  if (!isOpenClawAvailable()) return [];
  try {
    const raw = fs.readFileSync(path.join(OPENCLAW_HOME, 'openclaw.json'), 'utf8');
    const data = JSON.parse(raw);
    const list = data?.agents?.list ?? [];
    return list.map((a: {
      id: string;
      name?: string;
      workspace?: string;
      identity?: { name?: string; emoji?: string };
    }) => {
      const rawName = a.identity?.name ?? a.name ?? a.id;
      // Apply MC-level persona names for ids that don't carry one from OpenClaw.
      const name = agentDisplayName(a.id, rawName);
      return {
        id: a.id,
        name,
        emoji: a.identity?.emoji ?? '',
        workspace: a.workspace,
      };
    });
  } catch (e) {
    // Don't swallow silently — a broken openclaw.json showing as "no agents" is a
    // nightmare to debug. Log and return empty so the app still boots.
    console.error('[openclaw] failed to read/parse openclaw.json:', e instanceof Error ? e.message : e);
    return [];
  }
}

export function getOpenClawTasks(limit: number = 500): OCTask[] {
  const db = openDb('tasks/runs.sqlite');
  if (!db) return [];
  try {
    const rows = db.prepare(`
      SELECT task_id, owner_key, status, delivery_status, task, progress_summary, terminal_summary,
             created_at, started_at, ended_at, last_event_at, parent_task_id, parent_flow_id, error
      FROM task_runs
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as Array<{
      task_id: string;
      owner_key: string;
      status: string;
      delivery_status: string;
      task: string;
      progress_summary: string | null;
      terminal_summary: string | null;
      created_at: number;
      started_at: number | null;
      ended_at: number | null;
      last_event_at: number | null;
      parent_task_id: string | null;
      parent_flow_id: string | null;
      error: string | null;
    }>;

    return rows.map(r => {
      const owner = parseOwnerKey(r.owner_key);
      return {
        task_id: r.task_id,
        owner_key: r.owner_key,
        agent_id: owner.agent_id,
        source: owner.source,
        source_ref: owner.source_ref,
        status: r.status,
        delivery_status: r.delivery_status,
        task_preview: firstLine(r.task).slice(0, 140),
        task_full: r.task,
        progress_summary: r.progress_summary,
        terminal_summary: r.terminal_summary,
        created_at: r.created_at,
        started_at: r.started_at,
        ended_at: r.ended_at,
        last_event_at: r.last_event_at,
        parent_task_id: r.parent_task_id,
        parent_flow_id: r.parent_flow_id,
        error: r.error,
      };
    });
  } finally {
    db.close();
  }
}

export function getOpenClawFlows(): OCFlow[] {
  const db = openDb('flows/registry.sqlite');
  if (!db) return [];
  try {
    const rows = db.prepare(`
      SELECT flow_id, owner_key, goal, status, revision, current_step,
             blocked_task_id, blocked_summary, created_at, updated_at, ended_at
      FROM flow_runs
      ORDER BY created_at DESC
    `).all() as OCFlow[];
    return rows;
  } finally {
    db.close();
  }
}

// All child tasks (steps) belonging to a flow, earliest first.
export function getOpenClawFlowTasks(flowId: string): OCTask[] {
  const db = openDb('tasks/runs.sqlite');
  if (!db) return [];
  try {
    const rows = db.prepare(`
      SELECT task_id, owner_key, status, delivery_status, task, label, progress_summary, terminal_summary,
             created_at, started_at, ended_at, last_event_at, parent_task_id, parent_flow_id, error
      FROM task_runs
      WHERE parent_flow_id = ?
      ORDER BY created_at ASC
    `).all(flowId) as Array<{
      task_id: string;
      owner_key: string;
      status: string;
      delivery_status: string;
      task: string;
      label: string | null;
      progress_summary: string | null;
      terminal_summary: string | null;
      created_at: number;
      started_at: number | null;
      ended_at: number | null;
      last_event_at: number | null;
      parent_task_id: string | null;
      parent_flow_id: string | null;
      error: string | null;
    }>;
    return rows.map(r => {
      const owner = parseOwnerKey(r.owner_key);
      return {
        task_id: r.task_id,
        owner_key: r.owner_key,
        agent_id: owner.agent_id,
        source: owner.source,
        source_ref: owner.source_ref,
        status: r.status,
        delivery_status: r.delivery_status,
        task_preview: firstLine(r.task).slice(0, 180),
        task_full: r.task,
        progress_summary: r.progress_summary,
        terminal_summary: r.terminal_summary,
        created_at: r.created_at,
        started_at: r.started_at,
        ended_at: r.ended_at,
        last_event_at: r.last_event_at,
        parent_task_id: r.parent_task_id,
        parent_flow_id: r.parent_flow_id,
        error: r.error,
      };
    });
  } finally {
    db.close();
  }
}

export function getOpenClawCronJobs(): OCCronJob[] {
  if (!isOpenClawAvailable()) return [];
  try {
    const p = path.join(OPENCLAW_HOME, 'cron', 'jobs.json');
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    const jobs = data?.jobs ?? [];
    return jobs.map((j: {
      id: string;
      agentId: string;
      name: string;
      enabled: boolean;
      schedule: unknown;
      state?: { nextRunAtMs?: number; runningAtMs?: number };
    }) => ({
      id: j.id,
      agentId: j.agentId,
      name: j.name,
      enabled: j.enabled,
      schedule: j.schedule,
      nextRunAtMs: j.state?.nextRunAtMs,
      lastRunAtMs: j.state?.runningAtMs,
    }));
  } catch {
    return [];
  }
}

function firstLine(s: string): string {
  const nl = s.indexOf('\n');
  return nl === -1 ? s : s.slice(0, nl);
}

// ----- Status mapping -----

export function ocTaskToMcStatus(ocStatus: string): string {
  switch (ocStatus) {
    case 'running': return 'active';
    case 'succeeded': return 'done';
    case 'failed': return 'blocked';
    case 'queued': return 'backlog';
    case 'cancelled': return 'done';
    default: return ocStatus;
  }
}

export function ocFlowToMcStatus(ocStatus: string): string {
  switch (ocStatus) {
    case 'running': return 'active';
    case 'succeeded': return 'completed';
    case 'failed': return 'failed';
    case 'blocked': return 'blocked';
    case 'waiting': return 'waiting';
    default: return ocStatus;
  }
}

export function msToIso(ms: number | null): string | null {
  if (ms == null) return null;
  return new Date(ms).toISOString();
}

// Is there an OpenClaw task_run for this agent with activity in the last
// `withinMs` window? Used to verify a specialist actually ran when Alfred
// claims a dispatch on their behalf. Returns true if a task_runs row exists
// whose owner_key starts with `agent:<agentId>:` and whose last_event_at (or
// started_at/created_at) is recent enough.
export function hasRecentOpenClawTaskForAgent(agentId: string, withinMs: number = 15 * 60 * 1000): boolean {
  const db = openDb('tasks/runs.sqlite');
  if (!db) return false;
  try {
    const cutoff = Date.now() - withinMs;
    const row = db.prepare(`
      SELECT task_id FROM task_runs
      WHERE owner_key LIKE ?
        AND COALESCE(last_event_at, ended_at, started_at, created_at) >= ?
      LIMIT 1
    `).get(`agent:${agentId}:%`, cutoff) as { task_id?: string } | undefined;
    return !!row?.task_id;
  } catch {
    return false;
  } finally {
    db.close();
  }
}
