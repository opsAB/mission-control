export type TaskStatus = 'backlog' | 'active' | 'waiting' | 'blocked' | 'review' | 'done';
export type DeliveryStatus = 'not_started' | 'in_progress' | 'delivered' | 'revision';
export type ReviewStatus = 'none' | 'pending' | 'approved' | 'revision_requested';
export type AgentStatus = 'active' | 'idle' | 'offline';
export type ArtifactType = 'report' | 'brief' | 'research' | 'document' | 'page' | 'code' | 'other';
export type CodingRunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'handed_off';
export type WorkflowStatus = 'active' | 'waiting' | 'blocked' | 'completed' | 'failed';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: number;
  title: string;
  summary: string;
  status: TaskStatus;
  priority: Priority;
  project_id: number | null;
  owner: string;
  executor: string;
  created_at: string;
  updated_at: string;
  artifact_url: string | null;
}

export interface Workflow {
  id: number;
  name: string;
  summary: string;
  status: WorkflowStatus;
  owner: string;
  executor: string;
  last_update: string;
  last_meaningful_update: string;
  delivery_status: DeliveryStatus;
  review_status: ReviewStatus;
  is_recurring: boolean;
  cron_schedule: string | null;
  last_run: string | null;
  next_run: string | null;
  project_id: number | null;
}

export interface Artifact {
  id: number;
  title: string;
  type: ArtifactType;
  task_id: number | null;
  workflow_id: number | null;
  file_path: string;
  serve_url: string;
  created_at: string;
  review_status: ReviewStatus;
  owner: string;
  project_id: number | null;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  color: string;
}

export interface Agent {
  id: number;
  name: string;
  role: string;
  description: string;
  status: AgentStatus;
  current_task: string | null;
}

export interface CodingRun {
  id: number;
  title: string;
  agent_id: number | null;
  status: CodingRunStatus;
  started_at: string;
  completed_at: string | null;
  last_checkpoint: string | null;
  context_length: number;
  parent_run_id: number | null;
  summary: string;
  project_id: number | null;
}

export interface ActivityLog {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  summary: string;
  timestamp: string;
}

export type StalenessLevel = 'ok' | 'watch' | 'alert';

export function getStaleness(status: string, lastUpdate: string): StalenessLevel {
  const hours = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60);
  if (status === 'blocked') return 'alert';
  if (status === 'active') {
    if (hours > 8) return 'alert';
    if (hours > 4) return 'watch';
  }
  if (status === 'waiting') {
    if (hours > 24) return 'alert';
    if (hours > 12) return 'watch';
  }
  return 'ok';
}

export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
