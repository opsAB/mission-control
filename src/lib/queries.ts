import { getDb } from './db';
import { ensureInit } from './init';
import * as oc from './openclaw';
import { getSystemCronJobs } from './system-cron';
import type { Project, Artifact } from './types';

function db() {
  ensureInit();
  return getDb();
}

// ----- Types exposed to UI -----

export interface McTask {
  task_id: string;              // OpenClaw UUID
  title: string;
  summary: string;
  full_task: string;
  status: string;               // mapped: active/done/blocked/backlog
  oc_status: string;            // raw OpenClaw status
  delivery_status: string;
  agent_id: string | null;
  agent_name: string;
  agent_emoji: string;
  source: string;
  created_at: string;           // ISO
  updated_at: string;           // ISO (last_event_at or ended_at or started_at)
  ended_at: string | null;
  duration_ms: number | null;
  parent_flow_id: string | null;
  error: string | null;
  progress_summary: string | null;
  terminal_summary: string | null;
  project_id: number | null;
  project_name: string | null;
  project_color: string | null;
  review_status: string;
  starred: boolean;
}

export interface McFlow {
  flow_id: string;
  name: string;
  status: string;
  oc_status: string;
  goal: string;
  agent_id: string | null;
  agent_name: string;
  agent_emoji: string;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
  revision: number;
  blocked_summary: string | null;
  project_id: number | null;
  project_name: string | null;
  project_color: string | null;
  review_status: string;
}

export interface McAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  workspace: string | null;
  status: string;                 // derived from recent task activity
  current_task_title: string | null;
  current_task_id: string | null;
  active_count: number;
}

export interface McCronJob {
  id: string;
  name: string;
  agent_id: string;
  enabled: boolean;
  schedule_human: string;
  schedule_cron: string | null;
  next_run: string | null;
  last_run: string | null;
  command: string | null;
  description: string | null;
  sources: string[];
}

// ----- Helpers -----

function titleFromTask(preview: string): string {
  // Strip known prefixes like timestamps in brackets
  return preview.replace(/^\[[^\]]+\]\s*/, '').trim() || preview;
}

function summarize(task: oc.OCTask): string {
  if (task.terminal_summary) return tryExtractSummary(task.terminal_summary);
  if (task.progress_summary) return tryExtractSummary(task.progress_summary);
  return '';
}

function tryExtractSummary(raw: string): string {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && typeof obj.summary === 'string') return obj.summary;
  } catch {
    // not JSON, use as is
  }
  return raw.length > 200 ? raw.slice(0, 200) + '…' : raw;
}

// ----- Agents -----

export function getAllMcAgents(): McAgent[] {
  const ocAgents = oc.getOpenClawAgents();
  const tasks = oc.getOpenClawTasks(200);

  const roleMap: Record<string, string> = {
    main: 'Orchestrator',
    james: 'Five Fifteen specialist',
    lewis: 'Test / unused',
    milo: 'Health & wellness',
    contractor: 'General specialist (inactive)',
  };

  // Dispatches that are actively being worked on — counts as "active" regardless of
  // whether OpenClaw's task_runs attributes the work to the specialist (sub-agent
  // spawns currently attribute to Alfred, not the specialist being handed off to).
  const activeDispatches = db().prepare(`
    SELECT assignee_agent_id, title, id
    FROM mc_dispatched_tasks
    WHERE status IN ('picked_up', 'in_progress')
    ORDER BY priority = 'critical' DESC, priority = 'high' DESC, created_at ASC
  `).all() as Array<{ assignee_agent_id: string; title: string; id: number }>;

  const activeDispatchByAgent = new Map<string, { title: string; id: number }>();
  for (const d of activeDispatches) {
    if (!activeDispatchByAgent.has(d.assignee_agent_id)) {
      activeDispatchByAgent.set(d.assignee_agent_id, { title: d.title, id: d.id });
    }
  }

  return ocAgents.map(a => {
    const myTasks = tasks.filter(t => t.agent_id === a.id);
    const running = myTasks.filter(t => t.status === 'running');
    const dispatchWork = activeDispatchByAgent.get(a.id);
    const isActive = running.length > 0 || !!dispatchWork;
    const current = dispatchWork
      ? { title: dispatchWork.title, id: `dispatch-${dispatchWork.id}` }
      : running[0]
        ? { title: titleFromTask(running[0].task_preview), id: running[0].task_id }
        : null;

    return {
      id: a.id,
      name: a.name,
      emoji: a.emoji,
      role: roleMap[a.id] ?? 'Agent',
      workspace: a.workspace ?? null,
      status: isActive ? 'active' : (myTasks.length > 0 ? 'idle' : 'offline'),
      current_task_title: current?.title ?? null,
      current_task_id: current?.id ?? null,
      active_count: running.length + (dispatchWork ? 1 : 0),
    };
  });
}

// SQLite's datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC with no timezone suffix.
// JS parses that as local time and shifts it by the offset. Force UTC parse.
export function parseSqliteTs(ts: string): number {
  if (!ts) return 0;
  // Already ISO-with-timezone
  if (/[TZ]/.test(ts) || /[+-]\d\d:?\d\d$/.test(ts)) return new Date(ts).getTime();
  return new Date(ts.replace(' ', 'T') + 'Z').getTime();
}

// ----- Office view (richer agent status) -----

export interface OfficeAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: 'working' | 'idle' | 'sleeping';
  current_task: { title: string; source: 'task' | 'dispatch'; ref: string } | null;
  last_activity_at: string | null;      // ISO
  last_activity_summary: string | null;
  last_activity_action: string | null;  // e.g. 'started', 'progress', 'note', 'artifact'
  pending_dispatches: number;
  active_count: number;
}

export function getOfficeAgents(): OfficeAgent[] {
  const ocAgents = oc.getOpenClawAgents();
  const tasks = oc.getOpenClawTasks(200);

  const roleMap: Record<string, string> = {
    main: 'Orchestrator',
    james: 'Five Fifteen specialist',
    lewis: 'Test / unused',
    milo: 'Health & wellness',
    contractor: 'General specialist (inactive)',
  };

  const activeDispatches = db().prepare(`
    SELECT assignee_agent_id, title, id, status, updated_at
    FROM mc_dispatched_tasks
    WHERE status IN ('picked_up', 'in_progress')
    ORDER BY priority = 'critical' DESC, priority = 'high' DESC, created_at ASC
  `).all() as Array<{ assignee_agent_id: string; title: string; id: number; status: string; updated_at: string }>;

  const activeDispatchByAgent = new Map<string, { title: string; id: number; updated_at: string }>();
  for (const d of activeDispatches) {
    if (!activeDispatchByAgent.has(d.assignee_agent_id)) {
      activeDispatchByAgent.set(d.assignee_agent_id, { title: d.title, id: d.id, updated_at: d.updated_at });
    }
  }

  const queuedRows = db().prepare(`
    SELECT assignee_agent_id, COUNT(*) as n
    FROM mc_dispatched_tasks
    WHERE status = 'queued'
    GROUP BY assignee_agent_id
  `).all() as Array<{ assignee_agent_id: string; n: number }>;
  const queuedByAgent = new Map(queuedRows.map(r => [r.assignee_agent_id, r.n]));

  // Latest mc_activity row per agent (we don't store agent_id on every row, so we also
  // fall back to the most recent task_run event time for that agent).
  const activityRows = db().prepare(`
    SELECT agent_id, action, summary, timestamp
    FROM mc_activity
    WHERE agent_id IS NOT NULL
    ORDER BY timestamp DESC
    LIMIT 200
  `).all() as Array<{ agent_id: string; action: string; summary: string; timestamp: string }>;
  const lastActivityByAgent = new Map<string, { action: string; summary: string; timestamp: string }>();
  for (const r of activityRows) {
    if (!lastActivityByAgent.has(r.agent_id)) lastActivityByAgent.set(r.agent_id, r);
  }

  const now = Date.now();
  const IDLE_MS = 30 * 60 * 1000;

  return ocAgents.map(a => {
    const myTasks = tasks.filter(t => t.agent_id === a.id);
    const running = myTasks.filter(t => t.status === 'running');
    const dispatchWork = activeDispatchByAgent.get(a.id);
    const isWorking = running.length > 0 || !!dispatchWork;

    const current = dispatchWork
      ? { title: dispatchWork.title, source: 'dispatch' as const, ref: `dispatch-${dispatchWork.id}` }
      : running[0]
        ? { title: titleFromTask(running[0].task_preview), source: 'task' as const, ref: running[0].task_id }
        : null;

    // Most recent signal: latest task_run event OR latest mc_activity row
    const taskLastMs = myTasks.length ? Math.max(...myTasks.map(t => t.last_event_at ?? t.ended_at ?? t.started_at ?? t.created_at)) : 0;
    const activity = lastActivityByAgent.get(a.id);
    const activityMs = activity ? parseSqliteTs(activity.timestamp) : 0;
    const lastMs = Math.max(taskLastMs, activityMs);

    // Derive activity summary preferring mc_activity, else latest task status
    let lastAction: string | null = null;
    let lastSummary: string | null = null;
    if (activityMs >= taskLastMs && activity) {
      lastAction = activity.action;
      lastSummary = activity.summary;
    } else if (myTasks.length) {
      const newest = myTasks.reduce((acc, t) => {
        const ts = t.last_event_at ?? t.ended_at ?? t.started_at ?? t.created_at;
        return ts > (acc.last_event_at ?? acc.ended_at ?? acc.started_at ?? acc.created_at) ? t : acc;
      }, myTasks[0]);
      lastAction = newest.status;
      lastSummary = titleFromTask(newest.task_preview);
    }

    let status: 'working' | 'idle' | 'sleeping';
    if (isWorking) status = 'working';
    else if (lastMs > 0 && now - lastMs < IDLE_MS) status = 'idle';
    else status = 'sleeping';

    return {
      id: a.id,
      name: a.name,
      emoji: a.emoji,
      role: roleMap[a.id] ?? 'Agent',
      status,
      current_task: current,
      last_activity_at: lastMs > 0 ? new Date(lastMs).toISOString() : null,
      last_activity_summary: lastSummary,
      last_activity_action: lastAction,
      pending_dispatches: queuedByAgent.get(a.id) ?? 0,
      active_count: running.length + (dispatchWork ? 1 : 0),
    };
  });
}

// ----- Projects -----

export function getAllProjects(): Project[] {
  return db().prepare('SELECT * FROM projects ORDER BY name').all() as Project[];
}

export function getProject(id: number): Project | undefined {
  return db().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
}

// ----- Tasks (OpenClaw as source of truth, overlaid with MC data) -----

function enrichTask(t: oc.OCTask, agentMap: Map<string, oc.OCAgent>, overlays: Map<string, { project_id: number | null; review_status: string; starred: number }>, projects: Map<number, Project>): McTask {
  const agent = t.agent_id ? agentMap.get(t.agent_id) : undefined;
  const overlay = overlays.get(t.task_id);
  const project = overlay?.project_id != null ? projects.get(overlay.project_id) : undefined;

  const lastTs = t.last_event_at ?? t.ended_at ?? t.started_at ?? t.created_at;
  const startTs = t.started_at ?? t.created_at;
  const endTs = t.ended_at ?? null;

  return {
    task_id: t.task_id,
    title: titleFromTask(t.task_preview),
    summary: summarize(t),
    full_task: t.task_full,
    status: oc.ocTaskToMcStatus(t.status),
    oc_status: t.status,
    delivery_status: t.delivery_status,
    agent_id: t.agent_id,
    agent_name: agent?.name ?? t.agent_id ?? 'unknown',
    agent_emoji: agent?.emoji ?? '',
    source: t.source,
    created_at: new Date(t.created_at).toISOString(),
    updated_at: new Date(lastTs).toISOString(),
    ended_at: endTs ? new Date(endTs).toISOString() : null,
    duration_ms: endTs ? endTs - startTs : null,
    parent_flow_id: t.parent_flow_id,
    error: t.error,
    progress_summary: t.progress_summary,
    terminal_summary: t.terminal_summary,
    project_id: overlay?.project_id ?? null,
    project_name: project?.name ?? null,
    project_color: project?.color ?? null,
    review_status: overlay?.review_status ?? 'none',
    starred: (overlay?.starred ?? 0) === 1,
  };
}

function loadContext() {
  const ocAgents = oc.getOpenClawAgents();
  const agentMap = new Map(ocAgents.map(a => [a.id, a]));
  const overlayRows = db().prepare('SELECT task_id, project_id, review_status, starred FROM task_overlay').all() as Array<{ task_id: string; project_id: number | null; review_status: string; starred: number }>;
  const overlays = new Map(overlayRows.map(r => [r.task_id, r]));
  const projects = new Map(getAllProjects().map(p => [p.id, p]));
  return { agentMap, overlays, projects };
}

export function getAllMcTasks(opts: { excludeSubagents?: boolean; limit?: number } = {}): McTask[] {
  const { agentMap, overlays, projects } = loadContext();
  const tasks = oc.getOpenClawTasks(opts.limit ?? 500);
  const filtered = opts.excludeSubagents ? tasks.filter(t => t.source !== 'subagent') : tasks;
  return filtered.map(t => enrichTask(t, agentMap, overlays, projects));
}

export function getMcTask(taskId: string): McTask | undefined {
  const all = getAllMcTasks({ limit: 1000 });
  return all.find(t => t.task_id === taskId);
}

export function getMcTasksByStatus(status: string): McTask[] {
  return getAllMcTasks({ excludeSubagents: true }).filter(t => t.status === status);
}

export function getMcTasksByProject(projectId: number): McTask[] {
  return getAllMcTasks({ excludeSubagents: true }).filter(t => t.project_id === projectId);
}

export function setTaskProject(taskId: string, projectId: number | null) {
  db().prepare(`
    INSERT INTO task_overlay (task_id, project_id) VALUES (?, ?)
    ON CONFLICT(task_id) DO UPDATE SET project_id = excluded.project_id, updated_at = datetime('now')
  `).run(taskId, projectId);
}

export function setTaskReview(taskId: string, status: string, note?: string) {
  db().prepare(`
    INSERT INTO task_overlay (task_id, review_status, review_note) VALUES (?, ?, ?)
    ON CONFLICT(task_id) DO UPDATE SET review_status = excluded.review_status, review_note = excluded.review_note, updated_at = datetime('now')
  `).run(taskId, status, note ?? null);
  db().prepare(`INSERT INTO mc_activity (entity_type, entity_id, action, summary, timestamp) VALUES (?, ?, ?, ?, datetime('now'))`).run('task', taskId, 'review', `Review status set to ${status}`);
}

// ----- Flows -----

export function getAllMcFlows(): McFlow[] {
  const { agentMap, projects } = loadContext();
  const overlayRows = db().prepare('SELECT flow_id, project_id, review_status FROM flow_overlay').all() as Array<{ flow_id: string; project_id: number | null; review_status: string }>;
  const overlays = new Map(overlayRows.map(r => [r.flow_id, r]));

  const flows = oc.getOpenClawFlows();
  return flows.map(f => {
    const ownerParsed = f.owner_key.split(':');
    const agent_id = ownerParsed[1] ?? null;
    const agent = agent_id ? agentMap.get(agent_id) : undefined;
    const overlay = overlays.get(f.flow_id);
    const project = overlay?.project_id != null ? projects.get(overlay.project_id) : undefined;

    return {
      flow_id: f.flow_id,
      name: f.goal,
      status: oc.ocFlowToMcStatus(f.status),
      oc_status: f.status,
      goal: f.goal,
      agent_id,
      agent_name: agent?.name ?? agent_id ?? 'unknown',
      agent_emoji: agent?.emoji ?? '',
      created_at: new Date(f.created_at).toISOString(),
      updated_at: new Date(f.updated_at).toISOString(),
      ended_at: f.ended_at ? new Date(f.ended_at).toISOString() : null,
      revision: f.revision,
      blocked_summary: f.blocked_summary,
      project_id: overlay?.project_id ?? null,
      project_name: project?.name ?? null,
      project_color: project?.color ?? null,
      review_status: overlay?.review_status ?? 'none',
    };
  });
}

export function getMcFlowsByProject(projectId: number): McFlow[] {
  return getAllMcFlows().filter(f => f.project_id === projectId);
}

// ----- Cron / Recurring -----

export function getAllCronJobs(): McCronJob[] {
  const merged = [...oc.getOpenClawCronJobs(), ...getSystemCronJobs()];
  return merged.map(j => {
    const cron = j.schedule && typeof j.schedule === 'object' && 'cron' in j.schedule
      ? String((j.schedule as { cron?: unknown }).cron ?? '')
      : '';
    return {
      id: j.id,
      name: j.name,
      agent_id: j.agentId,
      enabled: j.enabled,
      schedule_human: describeSchedule(j.schedule),
      schedule_cron: cron || null,
      next_run: j.nextRunAtMs ? new Date(j.nextRunAtMs).toISOString() : null,
      last_run: j.lastRunAtMs ? new Date(j.lastRunAtMs).toISOString() : null,
      command: j.command ?? null,
      description: j.description ?? null,
      sources: j.sources ?? [],
    };
  });
}

export function getCronJobById(id: string): McCronJob | null {
  return getAllCronJobs().find(j => j.id === id) ?? null;
}

function describeSchedule(s: unknown): string {
  if (!s || typeof s !== 'object') return '—';
  const sched = s as { kind?: string; at?: string; cron?: string; every?: string };
  if (sched.kind === 'cron' && sched.cron) return sched.cron;
  if (sched.kind === 'at' && sched.at) return `once at ${new Date(sched.at).toLocaleString()}`;
  if (sched.kind === 'every' && sched.every) return `every ${sched.every}`;
  return sched.kind ?? '—';
}

// ----- Artifacts (MC-owned) -----

export function getAllArtifacts(): Artifact[] {
  return db().prepare('SELECT * FROM artifacts ORDER BY created_at DESC').all() as Artifact[];
}

export function getArtifactsByProject(projectId: number): Artifact[] {
  return db().prepare('SELECT * FROM artifacts WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as Artifact[];
}

export function getPendingReviewArtifacts(): Artifact[] {
  return db().prepare(`SELECT * FROM artifacts WHERE review_status = 'pending' ORDER BY created_at DESC`).all() as Artifact[];
}

export function updateArtifactReview(id: number, status: string, note?: string | null) {
  db().prepare(`
    UPDATE artifacts
    SET review_status = ?, review_note = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `).run(status, note ?? null, id);
  db().prepare(`
    INSERT INTO mc_activity (entity_type, entity_id, action, summary, agent_id)
    VALUES ('artifact', ?, 'review', ?, 'mission-control')
  `).run(String(id), `Review: ${status}${note ? ` — ${note.slice(0, 200)}` : ''}`);
}

export function getArtifactById(id: number): Artifact | null {
  const row = db().prepare('SELECT * FROM artifacts WHERE id = ?').get(id) as Artifact | undefined;
  return row ?? null;
}

export function getArtifactsForDispatch(dispatchId: number): Artifact[] {
  return db().prepare('SELECT * FROM artifacts WHERE dispatch_id = ? ORDER BY created_at DESC').all(dispatchId) as Artifact[];
}

// ----- Review queue -----

export interface ReviewItem {
  type: 'task' | 'flow' | 'artifact';
  id: string;
  title: string;
  summary: string;
  agent: string;
  agent_emoji: string;
  created_at: string;
  url?: string;
  project_name?: string | null;
}

export function getReviewQueue(): ReviewItem[] {
  const items: ReviewItem[] = [];
  const tasks = getAllMcTasks({ excludeSubagents: true });
  for (const t of tasks) {
    if (t.review_status === 'pending' || (t.status === 'done' && t.delivery_status === 'delivered' && t.review_status === 'none')) {
      items.push({
        type: 'task',
        id: t.task_id,
        title: t.title,
        summary: t.summary,
        agent: t.agent_name,
        agent_emoji: t.agent_emoji,
        created_at: t.created_at,
        project_name: t.project_name,
      });
    }
  }

  const artifacts = getPendingReviewArtifacts();
  for (const a of artifacts) {
    items.push({
      type: 'artifact',
      id: String(a.id),
      title: a.title,
      summary: '',
      agent: a.owner,
      agent_emoji: '',
      created_at: new Date(parseSqliteTs(a.created_at)).toISOString(),
      url: a.serve_url,
    });
  }

  return items.sort((a, b) => parseSqliteTs(b.created_at) - parseSqliteTs(a.created_at));
}

// ----- Recent activity -----

export interface ActivityEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  summary: string;
  timestamp: string;
  agent_emoji?: string;
  agent_id?: string | null;
  agent_name?: string | null;
  // Pre-formatted, natural-language sentence for display. Format as:
  //   "<Agent> <verb> <thing>[: <summary>]"
  display?: string;
  icon?: string; // single-char status glyph to render at row start
}

export function getRecentActivity(limit: number = 20): ActivityEntry[] {
  const tasks = getAllMcTasks({ limit: 200 });
  const entries: ActivityEntry[] = [];

  // Build a map of dispatch_id -> title so mc_activity rows referencing a
  // dispatch can be rendered with the human name instead of the numeric id.
  const dispatchRows = db().prepare('SELECT id, title, assignee_agent_id FROM mc_dispatched_tasks').all() as Array<{ id: number; title: string; assignee_agent_id: string }>;
  const dispatchById = new Map(dispatchRows.map(d => [String(d.id), d]));

  // Agent roster for display names.
  const agentMap = new Map(oc.getOpenClawAgents().map(a => [a.id, a]));

  for (const t of tasks.slice(0, 50)) {
    const action = t.status === 'active' ? 'started' : t.status === 'done' ? 'completed' : t.status;
    const entry: ActivityEntry = {
      id: `t-${t.task_id}`,
      entity_type: 'task',
      entity_id: t.task_id,
      action,
      summary: `${t.title}${t.summary ? ` — ${t.summary.slice(0, 80)}` : ''}`,
      timestamp: t.updated_at,
      agent_emoji: t.agent_emoji,
      agent_id: t.agent_id,
      agent_name: t.agent_name,
    };
    formatActivityDisplay(entry, { dispatchById, agentMap });
    entries.push(entry);
  }

  const mcRows = db().prepare('SELECT * FROM mc_activity ORDER BY timestamp DESC LIMIT ?').all(limit * 2) as Array<{ id: number; entity_type: string; entity_id: string; action: string; summary: string; agent_id: string | null; timestamp: string }>;
  for (const r of mcRows) {
    const agent = r.agent_id ? agentMap.get(r.agent_id) : undefined;
    const entry: ActivityEntry = {
      id: `mc-${r.id}`,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      action: r.action,
      summary: r.summary,
      timestamp: new Date(parseSqliteTs(r.timestamp)).toISOString(),
      agent_id: r.agent_id,
      agent_name: agent?.name ?? null,
      agent_emoji: agent?.emoji,
    };
    formatActivityDisplay(entry, { dispatchById, agentMap });
    entries.push(entry);
  }

  return entries
    .sort((a, b) => parseSqliteTs(b.timestamp) - parseSqliteTs(a.timestamp))
    .slice(0, limit);
}

// Turn a raw activity entry into a natural-language sentence for the feed.
// Assigns `display` and `icon` on the entry directly.
function formatActivityDisplay(
  e: ActivityEntry,
  ctx: { dispatchById: Map<string, { id: number; title: string; assignee_agent_id: string }>; agentMap: Map<string, { id: string; name: string }> }
) {
  // agent_id 'mission-control' and 'mc' are system events; show as "Mission Control"
  const rawAgent = e.agent_id ?? '';
  let agent = e.agent_name ?? null;
  if (!agent) {
    if (rawAgent === 'mission-control' || rawAgent === 'mc' || rawAgent === 'system') agent = 'Mission Control';
    else if (rawAgent === 'main') agent = 'Alfred';
    else if (rawAgent) agent = rawAgent.charAt(0).toUpperCase() + rawAgent.slice(1);
  }

  // Resolve a referenced dispatch into its human title where possible.
  let entityLabel = '';
  if (e.entity_type === 'dispatch') {
    const d = ctx.dispatchById.get(e.entity_id);
    entityLabel = d?.title ? `"${d.title}"` : `dispatch #${e.entity_id}`;
  } else if (e.entity_type === 'task') {
    // For native task rows the summary already carries the title.
    entityLabel = '';
  } else if (e.entity_type === 'artifact') {
    entityLabel = `artifact #${e.entity_id}`;
  } else if (e.entity_type === 'trigger') {
    entityLabel = '';
  }

  const suffix = (s: string | null | undefined) => {
    if (!s) return '';
    const trimmed = s.trim();
    if (!trimmed) return '';
    return `: ${trimmed.length > 110 ? trimmed.slice(0, 110) + '…' : trimmed}`;
  };

  const actorPrefix = agent ? `${agent}` : 'An agent';

  switch (e.action) {
    case 'queued':
      e.icon = '·';
      e.display = `${actorPrefix} queued ${entityLabel}${suffix(e.summary)}`.trim();
      break;
    case 'picked_up':
      e.icon = '→';
      e.display = `${actorPrefix} picked up ${entityLabel}${suffix(e.summary)}`.trim();
      break;
    case 'in_progress':
    case 'started':
      e.icon = '●';
      e.display = `${actorPrefix} started working on ${entityLabel}${suffix(e.summary)}`.trim();
      break;
    case 'done':
    case 'completed':
      e.icon = '✓';
      e.display = `${actorPrefix} finished ${entityLabel}${suffix(e.summary)}`.trim();
      break;
    case 'failed':
      e.icon = '✕';
      e.display = `${actorPrefix} couldn't finish ${entityLabel}${suffix(e.summary)}`.trim();
      break;
    case 'review':
      e.icon = '⚑';
      // summary already reads "Review: approved" or similar — make it natural
      if (e.summary.startsWith('Review: approved')) {
        e.display = `Alex approved ${entityLabel}`;
      } else if (e.summary.startsWith('Review: revision_requested')) {
        const note = e.summary.replace(/^Review: revision_requested\s*—?\s*/, '');
        e.display = `Alex requested a revision on ${entityLabel}${note ? ': ' + note.slice(0, 110) : ''}`;
      } else if (e.summary.startsWith('Review status set to')) {
        e.display = `Alex updated review on ${entityLabel} (${e.summary.replace('Review status set to ', '')})`;
      } else {
        e.display = `${actorPrefix} reviewed ${entityLabel}${suffix(e.summary)}`;
      }
      break;
    case 'triggered':
      e.icon = '↻';
      e.display = e.summary || `${actorPrefix} was triggered`;
      break;
    case 'note':
      e.icon = '✎';
      e.display = `${actorPrefix} left a note${suffix(e.summary)}`;
      break;
    default:
      e.icon = '·';
      e.display = `${actorPrefix} · ${e.action}${suffix(e.summary)}`;
  }
}

// ----- Overview stats -----

export function getOverviewStats() {
  const tasks = getAllMcTasks({ excludeSubagents: true });
  const flows = getAllMcFlows();
  const agents = getAllMcAgents();

  const activeTasks = tasks.filter(t => t.status === 'active').length;
  const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
  const reviewItems = getReviewQueue().length;
  const oneDayAgo = Date.now() - 24 * 3600 * 1000;
  const recentlyCompleted = tasks.filter(t => t.status === 'done' && new Date(t.updated_at).getTime() > oneDayAgo).length;
  const activeAgents = agents.filter(a => a.status === 'active').length;
  const activeFlows = flows.filter(f => f.status === 'active').length;

  return {
    activeTasks,
    blockedTasks,
    pendingReviews: reviewItems,
    recentlyCompleted,
    activeAgents,
    runningCodingRuns: activeFlows,
    totalAgents: agents.length,
    totalTasks: tasks.length,
  };
}

export function isOpenClawConnected(): boolean {
  return oc.isOpenClawAvailable();
}
