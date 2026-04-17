import { getDb } from './db';
import { ensureInit } from './init';
import type { Task, Workflow, Artifact, Project, Agent, CodingRun, ActivityLog } from './types';

function db() {
  ensureInit();
  return getDb();
}

// Tasks
export function getAllTasks(): Task[] {
  return db().prepare('SELECT * FROM tasks ORDER BY updated_at DESC').all() as Task[];
}

export function getTasksByStatus(status: string): Task[] {
  return db().prepare('SELECT * FROM tasks WHERE status = ? ORDER BY updated_at DESC').all(status) as Task[];
}

export function getTasksByProject(projectId: number): Task[] {
  return db().prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY updated_at DESC').all(projectId) as Task[];
}

export function getTask(id: number): Task | undefined {
  return db().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
}

export function updateTaskStatus(id: number, status: string) {
  db().prepare('UPDATE tasks SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, id);
  db().prepare('INSERT INTO activity_log (entity_type, entity_id, action, summary, timestamp) VALUES (?, ?, ?, ?, datetime(\'now\'))').run('task', id, 'status_change', `Task status changed to ${status}`);
}

// Workflows
export function getAllWorkflows(): Workflow[] {
  return db().prepare('SELECT * FROM workflows ORDER BY last_update DESC').all() as Workflow[];
}

export function getRecurringWorkflows(): Workflow[] {
  return db().prepare('SELECT * FROM workflows WHERE is_recurring = 1 ORDER BY last_run DESC').all() as Workflow[];
}

export function getWorkflowsByProject(projectId: number): Workflow[] {
  return db().prepare('SELECT * FROM workflows WHERE project_id = ? ORDER BY last_update DESC').all(projectId) as Workflow[];
}

// Artifacts
export function getAllArtifacts(): Artifact[] {
  return db().prepare('SELECT * FROM artifacts ORDER BY created_at DESC').all() as Artifact[];
}

export function getArtifactsByProject(projectId: number): Artifact[] {
  return db().prepare('SELECT * FROM artifacts WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as Artifact[];
}

export function getPendingReviewArtifacts(): Artifact[] {
  return db().prepare('SELECT * FROM artifacts WHERE review_status = \'pending\' ORDER BY created_at DESC').all() as Artifact[];
}

export function updateArtifactReview(id: number, status: string) {
  db().prepare('UPDATE artifacts SET review_status = ? WHERE id = ?').run(status, id);
  db().prepare('INSERT INTO activity_log (entity_type, entity_id, action, summary, timestamp) VALUES (?, ?, ?, ?, datetime(\'now\'))').run('artifact', id, 'review_update', `Artifact review status changed to ${status}`);
}

// Projects
export function getAllProjects(): Project[] {
  return db().prepare('SELECT * FROM projects ORDER BY name').all() as Project[];
}

export function getProject(id: number): Project | undefined {
  return db().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
}

// Agents
export function getAllAgents(): Agent[] {
  return db().prepare('SELECT * FROM agents ORDER BY id').all() as Agent[];
}

// Coding Runs
export function getAllCodingRuns(): CodingRun[] {
  return db().prepare('SELECT * FROM coding_runs ORDER BY started_at DESC').all() as CodingRun[];
}

export function getCodingRunsByProject(projectId: number): CodingRun[] {
  return db().prepare('SELECT * FROM coding_runs WHERE project_id = ? ORDER BY started_at DESC').all(projectId) as CodingRun[];
}

// Activity Log
export function getRecentActivity(limit: number = 20): ActivityLog[] {
  return db().prepare('SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT ?').all(limit) as ActivityLog[];
}

// Overview stats
export function getOverviewStats() {
  const d = db();
  const activeTasks = d.prepare('SELECT COUNT(*) as c FROM tasks WHERE status = \'active\'').get() as { c: number };
  const blockedTasks = d.prepare('SELECT COUNT(*) as c FROM tasks WHERE status = \'blocked\'').get() as { c: number };
  const reviewTasks = d.prepare('SELECT COUNT(*) as c FROM tasks WHERE status = \'review\'').get() as { c: number };
  const pendingArtifacts = d.prepare('SELECT COUNT(*) as c FROM artifacts WHERE review_status = \'pending\'').get() as { c: number };
  const doneTasks = d.prepare('SELECT COUNT(*) as c FROM tasks WHERE status = \'done\' AND updated_at > datetime(\'now\', \'-1 day\')').get() as { c: number };
  const activeAgents = d.prepare('SELECT COUNT(*) as c FROM agents WHERE status = \'active\'').get() as { c: number };
  const runningCodingRuns = d.prepare('SELECT COUNT(*) as c FROM coding_runs WHERE status = \'running\'').get() as { c: number };

  return {
    activeTasks: activeTasks.c,
    blockedTasks: blockedTasks.c,
    reviewTasks: reviewTasks.c,
    pendingReviews: reviewTasks.c + pendingArtifacts.c,
    recentlyCompleted: doneTasks.c,
    activeAgents: activeAgents.c,
    runningCodingRuns: runningCodingRuns.c,
  };
}

// Review queue: tasks in review + artifacts pending review
export function getReviewQueue(): Array<{ type: 'task' | 'artifact'; id: number; title: string; summary: string; executor: string; artifactType?: string; created_at: string; serve_url?: string }> {
  const d = db();
  const tasks = d.prepare('SELECT id, title, summary, executor, created_at FROM tasks WHERE status = \'review\' ORDER BY updated_at DESC').all() as Task[];
  const artifacts = d.prepare('SELECT id, title, type, owner, created_at, serve_url FROM artifacts WHERE review_status = \'pending\' ORDER BY created_at DESC').all() as Artifact[];

  const items: Array<{ type: 'task' | 'artifact'; id: number; title: string; summary: string; executor: string; artifactType?: string; created_at: string; serve_url?: string }> = [];

  for (const t of tasks) {
    items.push({ type: 'task', id: t.id, title: t.title, summary: t.summary, executor: t.executor, created_at: t.created_at });
  }
  for (const a of artifacts) {
    items.push({ type: 'artifact', id: a.id, title: a.title, summary: '', executor: a.owner, artifactType: a.type, created_at: a.created_at, serve_url: a.serve_url });
  }

  return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
