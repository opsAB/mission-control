# Alex Finn Mission Control — Pattern Catalog

Synthesized from 16 Alex Finn YouTube videos (transcripts on PC2: `/tmp/alexfinn/all_transcripts.txt`).

## Core thesis

Mission Control is a **custom dashboard that the agent itself extends on demand**. Tools are built per-user via natural-language prompts to the orchestrator agent. MC is the operator cockpit for a multi-agent autonomous workforce. The orchestrator (Alfred) delegates to specialist sub-agents. MC is the place where the human stays sane while agents run 24/7.

---

## UI/Screen patterns

### 1. Task Board (Kanban)
- Columns: Backlog → In Progress → Review → Done
- Tasks assigned to a specific agent (or "me")
- **Agents poll this board on every heartbeat** — new tasks in the backlog assigned to an agent get picked up autonomously
- Review column is the approval gate before Done
- Each card shows: title, description, owner/assignee (avatar/emoji), age, project tag
- Side-rail: **live activity feed** co-located with the board

### 2. Live Activity Feed
- Continuous stream of every action every agent is taking right now
- Solves "I don't know what my agent is doing"
- Scrolls in real-time (SSE / streaming, not polling)

### 3. Calendar View (Cron / Scheduled Tasks)
- Every scheduled job and future task
- Confirms the agent's claim ("I scheduled X for 7am") matches reality
- Catches agent hallucinations / forgotten commitments

### 4. Projects Screen
- One card per major life project (515, Health, MC itself, etc.)
- Each project shows: linked tasks, linked docs, linked memories, health signals
- **Reverse-prompt hook** per project: "what's one thing we can do right now to advance this?"

### 5. Memory Screen
- Agent's memories organized by day — journal-like
- Scroll backwards in time to see what was discussed
- Visual markdown rendering, not raw files
- Long-term memory section separate from daily logs
- Finn: "like having a record of my entire digital life I can reread 10 years from now"

### 6. Docs / Deliverables Screen
- Every artifact the agent produces, surfaced here automatically
- Categorized, searchable
- Formats: markdown, HTML, images, code snippets
- Pin important docs to related project

### 7. Team / Org Screen
- Agent hierarchy with roles, emojis, current status
- **Mission statement pinned at the top** — always-visible directive that frames all decisions
- Shows: model each agent uses, workspace path, current task, active subagents
- Serves as the record-of-truth for agent routing ("who do I delegate coding to?")

### 8. Office / Visual Screen
- 2D pixel-art office with agents at desks, walking between them
- Visual metaphor for "who's working on what right now"
- Fun element — Finn explicitly argues fun drives usage
- We can skip this for v2 MVP and add later if it adds joy

### 9. Alerts / Notification Feed
- Proactive pings from agents: "this is trending", "I'm blocked", "please review", "anomaly detected"
- Top-bar badge with unread count
- Severity-coded (info / watch / alert)
- Mobile bridge via Telegram for alerts-level events

### 10. Daily Digest
- Auto-generated end-of-day summary
- What each agent completed, what's waiting, what needs approval
- Optional morning digest: "here's what happened overnight"

---

## Interaction patterns

### A. Agent heartbeat polls MC for tasks
The flow is INVERTED from what you might expect:
- User creates task in MC → marks assignee (e.g. James)
- James on heartbeat sees new task in his queue → picks it up → works it → moves through columns → posts artifact → marks ready-for-review
- User reviews, approves/rejects in MC
- MC is the authoritative task queue; agents are polling clients.

This is the backbone pattern. Without it, MC is just a read-only dashboard.

### B. Agent writes back to MC proactively
- New artifact → agent posts to /api/agent/artifact
- Stuck → agent posts to /api/agent/attention (appears in top-bar alerts)
- Status update → agent posts to /api/agent/note on an existing task
- Scheduled cron job changed → agent writes to /api/agent/cron

### C. Reverse prompting built into UI
- Button on project cards: "What should we do next?"
- Button on agent cards: "What could you help me with today?"
- Button on mission statement: "What's one move toward this?"
- These just fire a prompt to the agent and show the response as a suggestion card

### D. Approve / Revise simple reactions
- ✓ / ✗ buttons on review items
- Single-click, train-over-time feedback loop
- Optional note attached

### E. Command dispatch (human → agent)
- From any screen, click "Send command" → choose target agent → type command
- MC writes the task to the agent's queue
- Agent picks up on heartbeat

### F. Mission statement as first-class context
- Always pinned top of dashboard
- Editable via simple textarea
- Every agent reads it; every suggestion/task evaluates against it
- Reverse prompt hook: "refine our mission statement"

---

## Architectural principles Finn uses (or implies)

1. **Agents self-extend MC via prompts.** User says "add a calendar view", agent writes the code. MC must tolerate this without breaking. Implication: good conventions in CLAUDE.md/AGENTS.md.
2. **Markdown is the lingua franca.** Memories, docs, logs all stored as markdown files. Rendered nicely in MC.
3. **Obsidian vault as memory backend.** Separate from core DB. Agents read/write markdown files; MC surfaces them via file-system watches.
4. **Multi-agent supervisor pattern.** Opus plans (expensive, smart) → GPT/cheaper executes → Opus reviews. MC surfaces plan + review + worker output.
5. **Cron + heartbeat drive proactivity.** Agents check things every N minutes/hours. Tasks scheduled for specific times. MC calendar view verifies.
6. **Don't copy Finn's exact setup.** Custom to each user. MC must be user-extensible, not a fixed product.
7. **Mistakes file.** Agents log their own failures so they improve. MC should surface this ("Alfred's recent mistakes").
8. **Shared agent workspace.** One folder all agents can read/write. MC surfaces what's in it.

---

## What we already have (v1)

- [x] Sidebar nav, dark operational UI
- [x] Overview dashboard
- [x] Task board (kanban) — reads OpenClaw task_runs
- [x] Review queue
- [x] Workflows/flows view
- [x] Projects stub (empty, no assignment UI)
- [x] Agents view
- [x] Coding runs view
- [x] Live data from OpenClaw DBs (read-only)
- [x] Seed data removed; real tasks appearing
- [x] Deployed on PC2 as systemd service

## What's missing vs. Finn's model

- [ ] **Bidirectional: agent writes to MC.** Currently read-only; agents can't post notes, artifacts, attention requests.
- [ ] **Real-time updates.** Currently F5 to refresh.
- [ ] **Task-assignment-and-dispatch flow.** Can't create a task in MC and have agent pick it up.
- [ ] **Live activity feed.** Currently a static slice of recent task state changes.
- [ ] **Calendar view.** (Cron jobs exist in MC data, but no dedicated calendar screen.)
- [ ] **Memory screen.** Not surfaced at all.
- [ ] **Docs screen with agent-written artifacts.** Table exists, but no agent writes to it.
- [ ] **Mission statement.** Not stored, not pinned, not wired.
- [ ] **Reverse-prompt hooks.** No "ask the agent what to do" buttons.
- [ ] **Approval ✓/✗ training signal.** Exists per item but no per-agent aggregation.
- [ ] **Command dispatch UI.** No way to send an instruction to an agent from MC.
- [ ] **Attention/alerts channel.** No top-bar alerts.
- [ ] **Daily digest auto-generation.** Nothing compiles it.
- [ ] **Telegram bridge for alerts.** No mobile notification path.
- [ ] **Project assignment UI.** Projects table exists but nothing connects tasks to it.
