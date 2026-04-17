import { NextRequest } from 'next/server';
import { triggerAgent, PROCESS_QUEUE_PROMPT } from '@/lib/trigger';
import { broadcast } from '@/lib/events';
import { getDb } from '@/lib/db';
import { ensureInit } from '@/lib/init';

// POST /api/trigger
// Body: { kind: 'process_queue' } — wakes Alfred with the standard poll+delegate prompt
//       { kind: 'agent', agent_id, message } — wakes a specific agent with a custom message
export async function POST(req: NextRequest) {
  ensureInit();
  const body = await req.json();
  let result;
  let description: string;

  if (body.kind === 'process_queue') {
    result = triggerAgent('main', PROCESS_QUEUE_PROMPT);
    description = 'Alfred woken to process MC dispatch queue';
  } else if (body.kind === 'agent') {
    if (!body.agent_id || !body.message) {
      return Response.json({ error: 'agent_id and message required' }, { status: 400 });
    }
    result = triggerAgent(body.agent_id, body.message);
    description = `${body.agent_id} woken with custom message`;
  } else {
    return Response.json({ error: 'unknown kind' }, { status: 400 });
  }

  if (result.started) {
    getDb().prepare(`
      INSERT INTO mc_activity (entity_type, entity_id, action, summary, agent_id) VALUES (?, ?, 'triggered', ?, ?)
    `).run('trigger', body.kind === 'agent' ? body.agent_id : 'main', description, 'mission-control');
    broadcast('activity_new', { description });
  }

  return Response.json(result);
}
