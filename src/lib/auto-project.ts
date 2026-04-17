import { getDb } from './db';
import { ensureInit } from './init';

// Auto-assign an OpenClaw task to an MC project based on the agent that ran it.
// Mapping: james→Five Fifteen, milo→Health Dashboard, main/Alfred→Personal Ops default,
// lewis→Research, contractor→Personal Ops. Only fills in missing assignments.
const AGENT_TO_PROJECT_NAME: Record<string, string> = {
  james: 'Five Fifteen',
  milo: 'Health Dashboard',
  lewis: 'Research',
  main: 'Personal Ops',
  contractor: 'Personal Ops',
};

export function autoTagTaskProject(taskId: string, agentId: string | null): void {
  if (!agentId) return;
  ensureInit();
  const db = getDb();
  const existing = db.prepare('SELECT project_id FROM task_overlay WHERE task_id = ?').get(taskId) as { project_id: number | null } | undefined;
  if (existing?.project_id != null) return;
  const projectName = AGENT_TO_PROJECT_NAME[agentId];
  if (!projectName) return;
  const proj = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName) as { id: number } | undefined;
  if (!proj) return;
  db.prepare(`
    INSERT INTO task_overlay (task_id, project_id) VALUES (?, ?)
    ON CONFLICT(task_id) DO UPDATE SET project_id = COALESCE(task_overlay.project_id, excluded.project_id)
  `).run(taskId, proj.id);
}

// Bulk: tag all current unassigned tasks. Called on demand from a route.
export function autoTagAllUnassigned(tasks: Array<{ task_id: string; agent_id: string | null }>): number {
  let count = 0;
  for (const t of tasks) {
    const before = getDb().prepare('SELECT project_id FROM task_overlay WHERE task_id = ?').get(t.task_id) as { project_id: number | null } | undefined;
    autoTagTaskProject(t.task_id, t.agent_id);
    const after = getDb().prepare('SELECT project_id FROM task_overlay WHERE task_id = ?').get(t.task_id) as { project_id: number | null } | undefined;
    if (before?.project_id == null && after?.project_id != null) count++;
  }
  return count;
}
