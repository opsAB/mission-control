<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Agent guide for Mission Control

If you're an OpenClaw agent reading this, you can write to Mission Control. This file is your reference.

## What Mission Control is

A Next.js app running on PC2 at `http://127.0.0.1:3001` (and reachable on the LAN at `http://192.168.12.53:3001`). It's Alex's operator cockpit over your work.

Mission Control reads from OpenClaw (tasks/runs.sqlite, flows/registry.sqlite, openclaw.json, cron/jobs.json, memory/) in **read-only mode**. You don't change your behavior by editing Mission Control's DB; you change it by doing your normal OpenClaw work and using the write API (below) to post updates MC can't infer on its own.

## The write API

Base URL: `http://127.0.0.1:3001/api/agent/*`

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/agent/attention` | POST | Ping Alex about something needing his attention |
| `/api/agent/status` | POST | Report task progress |
| `/api/agent/artifact` | POST | Register a deliverable (file or inline content) |
| `/api/agent/note` | POST | Attach a free-form note to a task/flow |
| `/api/agent/dispatch?agent_id=X` | GET | Pull tasks Alex dispatched to you |
| `/api/agent/dispatch` | POST | Mark a dispatched task as picked up |

A convenience CLI exists at `~/.openclaw/skills/mc-client/mc.sh` (see `skills/mc-client/README.md`). Prefer the CLI over direct curl.

## Hard rules

1. **Only Alfred (agent_id `main`) is authorized to interrupt Alex directly.** Specialists (james, milo, lewis, contractor) may still POST to `/api/agent/attention`, but the server routes non-main pings through Alfred's triage queue — they won't hit Alex's Telegram unless Alfred escalates them.

2. **Heartbeat polling.** On every heartbeat, check `GET /api/agent/dispatch?agent_id=<you>` for tasks Alex sent you. If any returned:
   - `POST /api/agent/dispatch` to claim it (sets status `picked_up`)
   - Work on it
   - `POST /api/agent/status` with status `in_progress` during, `done` or `failed` at end
   - If you produced a deliverable, `POST /api/agent/artifact`

3. **Post artifacts for anything reviewable — this is NOT optional.** If a dispatched task produces any file — a menu, a brief, a report, code, a plan, notes, anything — you MUST call `mc.sh artifact` before marking the dispatch done. A dispatch marked done without its artifact is a broken contract; Alex loses the deliverable and has to go hunting through workspace directories.

   **When delegating to a specialist:** set the `agent_id` on the artifact to the specialist (e.g. `james`), not `main`. Same for `mc.sh status` on the dispatch — the status update should use the specialist's id so MC attributes activity correctly.

   **Correct completion sequence for a specialist dispatch:**
   ```
   # while they're working
   mc.sh status james in_progress "starting menu draft" --dispatch-id 2
   # when they finish with a file
   mc.sh artifact james "515 Lounge Menu — first pass" brief /path/to/file.md --summary "8 cocktails, 10 food items"
   mc.sh status james done "Delivered first pass" --dispatch-id 2
   ```

4. **Be conservative with attention pings.** Alex's current setting is `blocked_review_only` — only `severity: alert` reaches him. Don't post `info` pings as a substitute for logging; use `note` for that.

## How MC's data model maps to OpenClaw

| OpenClaw | Mission Control |
|---|---|
| `task_runs.task_id` | referenced as `openclaw_task_id` from dispatched tasks; shown in Tasks page |
| `task_runs.owner_key` parsed | `agent_id` + `source` (telegram/subagent/main) |
| `task_runs.progress_summary` / `terminal_summary` | surfaced on task detail |
| `flow_runs` | Mission Control's Workflows page |
| `agents/<id>/` | Agents page; identity/emoji from `openclaw.json` |
| `cron/jobs.json` | Recurring Jobs section |
| `memory/*.md` | Memory page (read-only browser) |

## How to extend Mission Control safely

Alex has a preference: Claude (Opus) makes architectural changes; Codex-based agents can make tactical changes (new tiles, copy tweaks, small routes) — but **never push directly to `main`**.

If you need to modify MC:
1. Work in `~/mission-control/`
2. Create a branch: `git checkout -b agent/<your_id>/<short-description>`
3. Commit your change
4. DO NOT merge. DO NOT `git push`. Ping Alex (`mc.sh attention main alert "MC change proposed" "Branch agent/<id>/... ready for review"`)
5. Alex or Claude will review and merge

## Conventions

- TypeScript, Next.js App Router, Tailwind, SQLite via `better-sqlite3`
- MC-owned state in `task_overlay`, `flow_overlay`, `artifacts`, `mc_activity`, `alerts`, `agent_notes`, `mc_dispatched_tasks`, `settings`, `digests`
- OpenClaw state is NEVER written to — `openclaw.ts` only reads
- All server-pushed events broadcast via `src/lib/events.ts` (SSE). If you add a new entity type, add a broadcast call so live refresh works
- Pages use `export const dynamic = 'force-dynamic'` so data is fresh each render

## Settings that affect agent behavior

`/api/settings` (GET/PATCH) exposes:
- `mission_statement` — when set, include it in reasoning
- `attention_threshold` — `blocked_review_only` | `plus_thinking` | `plus_curiosity`
- `only_main_pings` — if true, only Alfred's attention pings reach Alex's Telegram
- `telegram_enabled`, `telegram_chat_id`
- `digest_enabled`, `digest_time` — controls the morning digest

## Naming rules

- Alex's new members club is **Five Fifteen** (two words) — never write "515" in any user-facing copy, note, artifact, or dispatch description. The typographic logo spells out the name; using digits breaks the brand.
- Internal agent_id `james` stays as-is (system identifier, not brand copy).
- Refer to Alex as "Alex" in Telegram and MC output, not "the user" or "Mr. Barlow".

## When in doubt

Ask Alex. Use `mc.sh attention main alert "<question>" "<details>"`. Do not guess at architecture.
