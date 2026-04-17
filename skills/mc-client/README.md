# Mission Control Client Skill

Small bash wrapper that lets any OpenClaw agent write to Mission Control without needing to know URL, JSON, or HTTP details.

## Install on PC2

```bash
mkdir -p ~/.openclaw/skills/mc-client
cp ~/mission-control/skills/mc-client/mc.sh ~/.openclaw/skills/mc-client/mc.sh
chmod +x ~/.openclaw/skills/mc-client/mc.sh
```

Then tell your agent this skill exists. In a Telegram chat with Alfred, say something like:

> You have a new skill at `~/.openclaw/skills/mc-client/mc.sh`. Read `~/.openclaw/skills/mc-client/README.md` and `~/mission-control/AGENTS.md`. Use it to (a) poll for tasks dispatched to you in Mission Control every heartbeat, and (b) post attention pings, status updates, notes, and artifacts to Mission Control as you work.

## Commands

| Command | Purpose |
|---|---|
| `mc.sh attention <agent_id> <severity> <title> [body] [entity_type] [entity_id]` | Ping Alex (routed to him if main, to Alfred's triage otherwise) |
| `mc.sh status <agent_id> <status> [summary] [--task-id ID] [--dispatch-id ID]` | Report progress on a task or dispatch |
| `mc.sh artifact <agent_id> <title> <type> <filepath> [--task-id ID] [--flow-id ID] [--project-id ID] [--summary TEXT]` | Register a deliverable (HTML report, doc, code, etc.) |
| `mc.sh note <agent_id> <entity_type> <entity_id> <note>` | Attach a free-form note to a task or flow |
| `mc.sh poll <agent_id>` | Return tasks Alex dispatched to this agent |
| `mc.sh pickup <dispatch_id> <agent_id> [openclaw_task_id]` | Mark a dispatched task as picked up |

## severity levels

- `info` — FYI, no alert by default
- `watch` — something mildly concerning
- `alert` — blocked, review-needed, or genuinely interrupt-worthy

Alex's settings in MC control whether each severity reaches Telegram. Default is `alert` only.

## artifact types

`report | brief | research | document | page | code | other`

## Heartbeat pattern (recommended)

Every OpenClaw heartbeat, each agent should run:

```bash
~/.openclaw/skills/mc-client/mc.sh poll <my_agent_id>
```

Parse the JSON response. For each task:
1. Call `mc.sh pickup <id> <my_agent_id>` immediately to claim it
2. Do the work
3. Call `mc.sh status <my_agent_id> in_progress "..." --dispatch-id <id>` as you go
4. When done, call `mc.sh status <my_agent_id> done "summary" --dispatch-id <id>`
5. If you produced a deliverable, call `mc.sh artifact ...`

## Examples

```bash
# Alfred pings Alex about a blocker
mc.sh attention main alert "Payment Stripe key missing" "Need STRIPE_API_KEY in .env to proceed"

# James posts a 515 menu draft
mc.sh artifact james "515 Menu Draft v3" brief /home/maximus/.openclaw/workspace-james/menu-v3.md --summary "Final-ish menu with 24 items. Needs beverage pairing review."

# Any agent notes progress on an existing task
mc.sh note james task abc-123-def "Competitor analysis complete; moving to pricing research"
```
