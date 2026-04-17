import { getDb } from './db';

export function seedIfEmpty() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number };
  if (count.c > 0) return;

  // Projects
  db.prepare(`INSERT INTO projects (name, description, color) VALUES (?, ?, ?)`).run('Mission Control', 'AI agent command center', '#6366f1');
  db.prepare(`INSERT INTO projects (name, description, color) VALUES (?, ?, ?)`).run('Five Fifteen', 'Five Fifteen project', '#f59e0b');
  db.prepare(`INSERT INTO projects (name, description, color) VALUES (?, ?, ?)`).run('Personal Ops', 'Personal operations and automation', '#10b981');
  db.prepare(`INSERT INTO projects (name, description, color) VALUES (?, ?, ?)`).run('Health Dashboard', 'Personal health tracking app', '#ef4444');

  // Agents
  db.prepare(`INSERT INTO agents (name, role, description, status, current_task) VALUES (?, ?, ?, ?, ?)`).run('Alfred', 'Orchestrator', 'Front door and orchestration layer. Owns supervision, routing, summaries, and continuity.', 'active', 'Monitoring active workflows');
  db.prepare(`INSERT INTO agents (name, role, description, status, current_task) VALUES (?, ?, ?, ?, ?)`).run('Research Agent', 'Research Specialist', 'Handles research tasks, competitive analysis, and information gathering.', 'active', 'FTL Intel daily scan');
  db.prepare(`INSERT INTO agents (name, role, description, status, current_task) VALUES (?, ?, ?, ?, ?)`).run('Writer Agent', 'Content Specialist', 'Produces reports, briefs, and written deliverables.', 'idle', null);
  db.prepare(`INSERT INTO agents (name, role, description, status, current_task) VALUES (?, ?, ?, ?, ?)`).run('Code Agent', 'Coding Specialist', 'Handles coding tasks, debugging, and implementation.', 'active', 'Mission Control MVP build');

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString().replace('T', ' ').slice(0, 19);
  const daysAgo = (d: number) => hoursAgo(d * 24);

  // Tasks
  const tasks = [
    ['Build Mission Control MVP', 'Full operational command center for AI workforce supervision', 'active', 'high', 1, 'Alex', 'Code Agent', daysAgo(2), hoursAgo(1), null],
    ['Set up artifact serving', 'Make deliverables browser-openable from Mission Control', 'backlog', 'medium', 1, 'Alex', 'Code Agent', daysAgo(1), daysAgo(1), null],
    ['Daily brief generation', 'Generate morning operational brief', 'done', 'medium', 3, 'Alex', 'Alfred', daysAgo(1), hoursAgo(6), '/api/artifacts/serve/daily-brief-apr16.html'],
    ['FTL Intel report', 'Competitive intelligence daily scan and report', 'review', 'high', 2, 'Alex', 'Research Agent', daysAgo(1), hoursAgo(2), '/api/artifacts/serve/ftl-intel-apr16.html'],
    ['Health dashboard Tailscale setup', 'Configure Tailscale for phone/laptop access to health dashboard', 'waiting', 'low', 4, 'Alex', 'Alfred', daysAgo(5), daysAgo(3), null],
    ['Refine recipe feature', 'Iterate on health dashboard recipe database UX', 'backlog', 'low', 4, 'Alex', 'Code Agent', daysAgo(7), daysAgo(7), null],
    ['Five Fifteen weekly summary', 'Compile weekly progress summary for Five Fifteen', 'active', 'medium', 2, 'Alex', 'Writer Agent', hoursAgo(10), hoursAgo(10), null],
    ['Agent monitoring integration', 'Wire OpenClaw agent state into Mission Control', 'blocked', 'critical', 1, 'Alex', 'Code Agent', daysAgo(1), hoursAgo(3), null],
    ['Research: AI agent frameworks', 'Survey current agent framework landscape for architecture decisions', 'done', 'medium', 3, 'Alex', 'Research Agent', daysAgo(4), daysAgo(2), '/api/artifacts/serve/agent-frameworks-research.html'],
    ['Telegram bot improvements', 'Improve Alfred Telegram interface reliability', 'active', 'medium', 3, 'Alex', 'Alfred', daysAgo(3), hoursAgo(5), null],
  ];

  const insertTask = db.prepare(`INSERT INTO tasks (title, summary, status, priority, project_id, owner, executor, created_at, updated_at, artifact_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const t of tasks) insertTask.run(...t);

  // Workflows
  const workflows = [
    ['Daily Brief', 'Morning operational summary covering agent status, task progress, and alerts', 'completed', 'Alex', 'Alfred', hoursAgo(6), hoursAgo(6), 'delivered', 'approved', 1, '0 7 * * *', hoursAgo(6), hoursAgo(0).replace(hoursAgo(0).slice(11), '07:00:00'), 3],
    ['FTL Intel Daily', 'Daily competitive intelligence scan and report generation', 'active', 'Alex', 'Research Agent', hoursAgo(2), hoursAgo(2), 'in_progress', 'pending', 1, '0 9 * * *', hoursAgo(2), hoursAgo(0).replace(hoursAgo(0).slice(11), '09:00:00'), 2],
    ['Mission Control Build', 'Full MVP build of the Mission Control application', 'active', 'Alex', 'Code Agent', hoursAgo(1), hoursAgo(1), 'in_progress', 'none', 0, null, null, null, 1],
    ['Weekly Five Fifteen Summary', 'Weekly project summary compilation', 'waiting', 'Alex', 'Writer Agent', hoursAgo(10), hoursAgo(10), 'not_started', 'none', 1, '0 16 * * 5', daysAgo(3), daysAgo(0).replace(daysAgo(0).slice(11), '16:00:00'), 2],
    ['Health Dashboard Maintenance', 'Ongoing maintenance and feature iteration', 'waiting', 'Alex', 'Code Agent', daysAgo(3), daysAgo(3), 'not_started', 'none', 0, null, null, null, 4],
  ];

  const insertWorkflow = db.prepare(`INSERT INTO workflows (name, summary, status, owner, executor, last_update, last_meaningful_update, delivery_status, review_status, is_recurring, cron_schedule, last_run, next_run, project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const w of workflows) insertWorkflow.run(...w);

  // Artifacts
  const artifacts = [
    ['Daily Brief — Apr 16', 'brief', 3, 1, '/data/artifacts/daily-brief-apr16.html', '/api/artifacts/serve/daily-brief-apr16.html', hoursAgo(6), 'approved', 'Alfred', 3],
    ['FTL Intel Report — Apr 16', 'report', 4, 2, '/data/artifacts/ftl-intel-apr16.html', '/api/artifacts/serve/ftl-intel-apr16.html', hoursAgo(2), 'pending', 'Research Agent', 2],
    ['Agent Frameworks Research', 'research', 9, null, '/data/artifacts/agent-frameworks-research.html', '/api/artifacts/serve/agent-frameworks-research.html', daysAgo(2), 'approved', 'Research Agent', 3],
    ['MC Architecture Doc', 'document', 1, 3, '/data/artifacts/mc-architecture.html', '/api/artifacts/serve/mc-architecture.html', daysAgo(1), 'none', 'Code Agent', 1],
    ['Weekly Summary — Apr 11', 'report', null, 4, '/data/artifacts/weekly-summary-apr11.html', '/api/artifacts/serve/weekly-summary-apr11.html', daysAgo(6), 'approved', 'Writer Agent', 2],
  ];

  const insertArtifact = db.prepare(`INSERT INTO artifacts (title, type, task_id, workflow_id, file_path, serve_url, created_at, review_status, owner, project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const a of artifacts) insertArtifact.run(...a);

  // Coding runs
  const runs = [
    ['MC scaffold + data model', 4, 'completed', daysAgo(2), daysAgo(1), daysAgo(1), 45000, null, 'Initial project setup, schema, seed data', 1],
    ['MC core pages build', 4, 'running', hoursAgo(4), null, hoursAgo(1), 82000, 1, 'Building all 8 core pages', 1],
    ['Health dashboard bug fix', 4, 'completed', daysAgo(5), daysAgo(5), daysAgo(5), 12000, null, 'Fixed path resolution on Windows', 4],
  ];

  const insertRun = db.prepare(`INSERT INTO coding_runs (title, agent_id, status, started_at, completed_at, last_checkpoint, context_length, parent_run_id, summary, project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const r of runs) insertRun.run(...r);

  // Activity log
  const activities = [
    ['task', 1, 'status_change', 'Mission Control MVP build moved to active', hoursAgo(1)],
    ['workflow', 1, 'completed', 'Daily Brief completed successfully', hoursAgo(6)],
    ['artifact', 1, 'created', 'Daily Brief — Apr 16 generated', hoursAgo(6)],
    ['task', 4, 'status_change', 'FTL Intel report moved to review', hoursAgo(2)],
    ['artifact', 2, 'created', 'FTL Intel Report — Apr 16 generated', hoursAgo(2)],
    ['workflow', 2, 'update', 'FTL Intel Daily scan in progress', hoursAgo(2)],
    ['task', 8, 'status_change', 'Agent monitoring integration blocked — needs SSH access', hoursAgo(3)],
    ['coding_run', 2, 'checkpoint', 'MC core pages build — checkpoint at 82k tokens', hoursAgo(1)],
    ['task', 7, 'status_change', 'Five Fifteen weekly summary started', hoursAgo(10)],
    ['workflow', 3, 'update', 'Mission Control Build — core pages in progress', hoursAgo(1)],
  ];

  const insertActivity = db.prepare(`INSERT INTO activity_log (entity_type, entity_id, action, summary, timestamp) VALUES (?, ?, ?, ?, ?)`);
  for (const a of activities) insertActivity.run(...a);
}
