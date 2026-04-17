# Mission Control v2 — Operator Cockpit Plan

## Context

V1 of Mission Control is a read-only window into OpenClaw's state: tasks, flows, agents, cron jobs all surfaced in a dark operational UI. Live data flows from OpenClaw SQLite DBs into MC, but the window only opens one way. You see what agents are doing; you can't talk back through MC; the dashboard doesn't update until you hit F5; agents can't ping you for attention; artifacts and memories aren't surfaced; projects are a stub.

V2 turns MC from an observer into the **actual operator cockpit** — the place you live while Alfred, James, Milo, and Lewis run your work 24/7. Agents can write to MC. MC updates in real time. You can dispatch work from MC to agents. Agents ping you through MC when they need attention. Your mission statement frames every decision visible on screen.

This plan translates Alex Finn's mission-control pattern vocabulary (see `alex-finn-patterns.md`) into a concrete v2 for your setup.

---

## Scope of v2

Six capability areas. Each is independently valuable and shippable; I'll build them in the priority order below.

### 1. Bidirectional: agents can write to MC
MC exposes HTTP endpoints on `http://192.168.12.53:3001/api/agent/*` that agents call from OpenClaw. A small "MC client" tool lands in the OpenClaw skills directory — once installed, any agent can call:
- `attention` — ping me about something needing eyes
- `status` — update an existing task's state ("started X", "stuck on Y")
- `artifact` — register a browser-openable deliverable (HTML report, doc, etc.)
- `note` — post a free-form note
- `digest` — contribute to today's daily digest

Agents discover the client via a skill file. No auth required (LAN-only access already enforced by UFW).

### 2. Real-time updates (no F5)
MC pushes events to every open browser tab over Server-Sent Events. When Alfred posts an attention ping, your dashboard highlights it within 1 second. No polling. No WebSocket overhead.

### 3. Task dispatch: you → agent
- "New Task" button (top right of Tasks page)
- Form: title, description, assignee (dropdown of agents), priority, project
- MC writes to its own task queue table; OpenClaw agents on heartbeat poll MC's queue and pick up tasks assigned to them
- Task moves through kanban as the agent works it
- Requires a small change to Alfred's orchestration loop (I'll write the prompt/skill)

### 4. Mission statement + reverse-prompt hooks
- Editable mission statement pinned to top of Overview (and sidebar status)
- "What should we do next?" button on project cards → dispatches reverse-prompt to Alfred → shows suggestion cards
- "What can you help with?" button on agent cards
- Every dispatched prompt and response logged to activity feed

### 5. Attention & alerts
- Top-bar bell icon with unread count
- Full alerts panel listing agent pings with severity color
- Critical alerts also push to Telegram (bridge runs on PC2, reuses existing Telegram config)
- Daily digest auto-compiles every evening at a configurable time

### 6. Memory, docs, and projects filled in
- **Memory screen:** reads your OpenClaw `.openclaw/memory/` directory; daily logs surfaced like a journal
- **Docs screen:** agents POST artifacts; MC serves them at browser-openable URLs (already wired in v1's `/api/artifacts/serve/*`)
- **Projects:** quick-assign UI (right-click task → set project); heuristic auto-tagging based on agent (James→515, Milo→Health, etc.)

---

## Priority order

I'll build in this order — each one valuable on its own, each building on the previous:

1. **Real-time updates (SSE layer)** — fastest win, makes everything else feel alive
2. **Agent write API + OpenClaw skill** — unlocks bidirectional flow
3. **Mission statement + attention/alerts panel** — immediate operator-feel upgrade
4. **Task dispatch UI + agent heartbeat polling** — the "I can command agents" feature
5. **Memory + docs filled in** — depth on existing screens
6. **Daily digest + Telegram bridge** — automation layer

Each of steps 1-4 is ~1-2 hours of implementation. Steps 5-6 are smaller. Total estimated build: 6-10 hours across multiple sessions. I can do it in chunks.

---

## Architectural decisions (made, not asked)

These are the non-user-facing technical choices I'm committing to. Captured here so they're visible, but you don't need to evaluate them:

- **Real-time transport: Server-Sent Events** (simpler than WebSockets, perfect for one-way server-to-client push on LAN)
- **Agent write transport: HTTP POST JSON** to MC's `/api/agent/*` (standard, debuggable, easy to call from any language)
- **Agent polling for task dispatch: heartbeat with short poll** (no push needed from MC; agents check every ~60s for assigned tasks)
- **Persistence: keep current SQLite split** — MC overlay DB stays; OpenClaw DBs read-only
- **Memory: read `~/.openclaw/memory/` directly as markdown files** rather than copying into MC's DB. Single source of truth.
- **Artifact storage: `~/mission-control/data/artifacts/` on PC2** — agents write files there; MC serves via existing route
- **Telegram bridge: reuse Alex's existing Telegram bot token** (pulled from OpenClaw config, not duplicated)
- **Agent guardrails: agents commit to `agent/*` branches**, never push to main; I review + merge
- **Code conventions for agents: `AGENTS.md` in repo explains MC's architecture, DB schemas, API surface** so Codex-based agents understand the system

---

## Non-goals for v2

- Multi-user support (LAN-only, single operator — you)
- Authentication / login (LAN + UFW firewall is the security layer)
- Mobile-native app (LAN browser access via Tailscale already works from phone)
- The pixel-art office visualization (fun but skippable; revisit later)
- Migration away from OpenClaw (it's the agent layer; MC is the operator layer)

---

## User-level questions for you

These are questions I cannot decide on your behalf because they're about your taste or workflow. Everything else is my call.

### Q1 — Attention ping policy
How aggressive should agents be with attention pings?
- A) Only when truly blocked or when a deliverable is ready for review
- B) A + periodic "here's what I'm thinking" updates during long tasks
- C) A + B + curiosity pings ("I noticed X in the research, want to explore?")

### Q2 — Telegram bridge direction
Telegram integration with alerts — what do you want?
- A) MC pushes alerts to Telegram (your phone buzzes when something needs eyes)
- B) A + you can reply to Telegram messages to respond to alerts (approve/dismiss/ask follow-up)
- C) Skip Telegram bridge for v2; LAN browser is fine

### Q3 — Daily digest timing
When should the daily digest compile and land?
- A) 10 PM (end of day — "here's what got done today")
- B) 7 AM (morning brief — "here's what happened overnight and what's queued")
- C) Both
- D) Configurable; I decide later

### Q4 — Finn patterns you DON'T want
From the catalog I assembled, any of these you want to skip entirely?
- Memory screen (journal of daily logs)
- Office / pixel-art view (fun but cosmetic)
- Reverse-prompt buttons throughout UI
- Mistakes file surfacing
- Shared agent workspace view
- Daily digest
- Telegram alerts bridge

### Q5 — Mission statement starter
Do you want to write your mission statement now, or have Alfred draft one based on what he knows about you and we refine it?

### Q6 — Execution pacing
Do I:
- A) Build all 6 areas straight through in a multi-hour session
- B) Build 1-2 at a time, test, regroup, continue
- C) Only build the top 3 priorities for now and revisit v3 later

---

## What happens after v2

Once this ships, MC is a real cockpit. Post-v2 directions to think about:
- **PC2 system audit** (you already flagged this — cleanup of old files, orphaned configs, etc.)
- **Agent-editable dashboard tiles** — Alfred can add new screens/widgets autonomously via prompts
- **Scheduled task templates** — one-click "set up my morning routine" → creates a cron job via MC UI
- **Memory visual wiki** — graph view of people/concepts/projects mentioned across all daily logs
- **Multi-device view** — if you add a second machine to the OpenClaw cluster, MC already knows
