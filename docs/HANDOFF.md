# Mission Control — Session Handoff

Last updated: 2026-04-17. Author: Claude Opus (1M context) in session with Alex.

## TL;DR for the next session

Mission Control v2 is **live on PC2** at `http://192.168.12.53:3001`. It's an operator cockpit for Alex's OpenClaw agent workforce (Alfred orchestrator + James / Milo / Lewis / contractor specialists). MC reads OpenClaw's SQLite state read-only and overlays its own data (projects, review state, artifacts, alerts, dispatches, digest). Bidirectional API lets agents write back. Real-time via SSE. Alex triggers Alfred on demand via `/api/trigger`.

## Infra

- **Code:** `/c/Users/Alex/Desktop/Claude Code Projects/mission-control/` on PC1 (Windows); deployed to `~/mission-control/` on PC2 (Ubuntu)
- **GitHub:** https://github.com/opsAB/mission-control (git credentials cached on PC1 Windows, SSH from PC1 to PC2 via `pc2` alias using `~/.ssh/mission_control_agent` key)
- **PC2 SSH:** `ssh pc2 "<cmd>"` works. Passwordless sudo scoped to `systemctl * mission-control` only via `/etc/sudoers.d/mission-control`
- **Service:** `mission-control.service` via systemd; survives reboot; `sudo -n systemctl restart mission-control` works over SSH non-interactively
- **Deploy loop:** `ssh pc2 "cd ~/mission-control && git pull && npm install --silent && npm run build && sudo -n systemctl restart mission-control"`

## Stack

Next.js 16 App Router + TypeScript + Tailwind + SQLite via `better-sqlite3`. Listens on `0.0.0.0:3001` on PC2 (3000 was taken by OpenClaw's own service). UFW allows 3001 from any LAN IP.

## Data model

**MC-owned tables** (in `~/mission-control/data/mission-control.db`):
- `projects` (5 seeded: Mission Control, Five Fifteen, Personal Ops, Health Dashboard, Research)
- `task_overlay` — keyed on OpenClaw `task_id`: project_id, review_status, starred
- `flow_overlay` — similar for flows
- `artifacts` — agent-registered deliverables; served at `/api/artifacts/serve/<filename>`
- `mc_activity` — MC-originated activity log
- `mc_dispatched_tasks` — tasks Alex creates via `/dispatch` UI; agents poll for these
- `alerts` — agent-to-Alex attention pings; surfaced in `/alerts` with unread badge
- `agent_notes` — free-form notes attached to tasks/flows
- `settings` — key/value (mission_statement, digest_time, telegram_enabled, etc.)
- `digests` — historical morning digests

**Read from OpenClaw** (read-only, at `~/.openclaw/`):
- `tasks/runs.sqlite` → `task_runs` → MC tasks
- `flows/registry.sqlite` → `flow_runs` → MC workflows / flow runs
- `memory/<agent>.sqlite` → FTS-indexed agent memory; browsable in `/memory`
- `cron/jobs.json` → recurring jobs; shown in `/workflows`
- `openclaw.json` → agent roster (`agents.list[]`); also source of `channels.telegram.accounts.default.botToken` reused by MC for its Telegram bridge

## Pages

| Route | Purpose |
|---|---|
| `/` | Overview: live stat cards, blocked, needs-review, recurring cron, stale, recent activity |
| `/tasks` | **Overview cards** (status counts) + Board toggle + project/agent filters |
| `/tasks?view=board` | 4-column kanban, click card opens drawer |
| `/tasks?status=X` | Single-column drill-down |
| `/dispatch` | Alex creates tasks → agents pick up on heartbeat or via "Poll queue now" button |
| `/review` | Approval queue for pending artifacts + `status=review` tasks |
| `/docs` | Artifact table, each openable in browser |
| `/workflows` | Cron jobs + flow runs |
| `/memory` | Per-agent SQLite memory: file list + content viewer + full-text search |
| `/projects` | 5 project cards → click → filtered tasks |
| `/agents` | Agent roster cards |
| `/office` | Pixel-art office visualizer; active dispatches light the assignee green |
| `/coding-runs` | Flow runs with status |
| `/alerts` | Unread alert center |
| `/settings` | Mission statement, attention threshold, Telegram bridge, digest time/preview/send-now |

## Agent write API (`/api/agent/*`)

- `POST attention` — severity ping; alert severity reaches Telegram if `only_main_pings`=true and agent is `main`
- `POST status` — mark a dispatch `picked_up` / `in_progress` / `done` / `failed`
- `POST artifact` — register a deliverable file (inline content or filepath on PC2)
- `POST note` — attach a note to a task/flow/dispatch
- `GET dispatch?agent_id=X` — agent polls its queue
- `POST dispatch` — claim a dispatch (set to `picked_up`)

Agents call these via the CLI at `~/.openclaw/skills/mc-client/mc.sh` on PC2. See `skills/mc-client/README.md` and `AGENTS.md` (in repo root) for conventions agents must follow.

## Triggering Alfred

`POST /api/trigger { kind: 'process_queue' }` forks `openclaw agent --agent main --message <prompt>` on PC2 to wake Alfred immediately without waiting for his 1-hour heartbeat. UI: "Poll queue now" button on `/dispatch`, plus dispatch form's "Trigger Alfred immediately" checkbox (default on; forced on for `critical` priority).

## Real-time

`/api/stream` is an SSE endpoint; `<LiveUpdater />` in root layout subscribes and calls `router.refresh()` on relevant events. `broadcast()` in `src/lib/events.ts` pushes events whenever MC state changes.

## Daily digest

In-process scheduler (`src/lib/scheduler.ts`) ticks every 60s; fires at `settings.digest_time` (default 06:00 local). Markdown-formatted, pushed to Telegram with plain-text fallback on markdown reject. Manual via Settings → "Send digest now" button.

## Known open issues / follow-ups

1. **Specialist heartbeat**: only Alfred polls MC. Specialists (james, milo, lewis) rely on Alfred to delegate. This works but means Alfred must be awake. `Poll queue now` handles it.
2. **Office visualization** only reflects dispatch-assignee activity; OpenClaw sub-agent spawns attribute to `main` in task_runs, so specialists look idle if their work comes via Alfred's sub-agent pattern (fixed by also reading `mc_dispatched_tasks` with `picked_up` status).
3. **The 3 group-C test dispatches** were dispatched at ~19:05: Five Fifteen launch checklist (james), Bryan Johnson blood test synthesis (milo), rebalance equities (main, expected to block on E-Trade login). Alfred was triggered to process them. Status should be in MC by the time next session starts.
4. **"Test Brief" artifact (id 1)** is a residual test file — safe to leave or delete.
5. **Milo / Lewis memory DBs don't exist** yet — those agents haven't accumulated memory.
6. **No auto-refresh of specialist memory DBs** — would be good if MC re-reads memory SQLite after each agent turn.

## Rules captured to Claude's persistent memory

See `C:\Users\Alex\.claude\projects\C--Users-Alex-Desktop-Claude-Code-Projects\memory\`:
- `user_alex.md` — Alex profile, devices, PC2 = 192.168.12.53
- `feedback_technical_decisions.md` — Alex is non-technical; don't ask him implementation questions
- `feedback_five_fifteen_naming.md` — Always "Five Fifteen" (words), never "515"
- `project_mission_control.md` — project overview
- `project_mission_control_v2_prefs.md` — Alfred-only pings, Telegram-only bridge, 6am digest
- `project_openclaw_agents.md` — Alfred / James (Five Fifteen) / Milo (health) / Lewis (unused) / contractor

## Next likely work (Alex's stated priorities)

1. **Test pass Group C** — the 3 real-world dispatches already fired; check outcomes
2. **PC2 system audit** — Alex wants cleanup of old files / configs from prior MC attempts with Alfred
3. **Mobile-friendly layout** — currently desktop-only; Alex uses iPhone and might want read-only at least
4. **Telegram→MC reply routing** — replies to MC alerts on Telegram should update the MC alert state (currently one-way)

## How to pick up

1. `ssh pc2 "sudo -n systemctl status mission-control --no-pager | head -5"` → confirm service running
2. Open `http://192.168.12.53:3001` from PC1 browser → sanity check
3. Check `mc_dispatched_tasks` status for dispatches 3, 4, 5 → see if Alfred completed Group C
4. Ask Alex what's next
