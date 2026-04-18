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

## Auth

All `/api/agent/*` and `/api/alerts/*/triage` endpoints expect an `Authorization: Bearer <token>` header. The token is read from `MC_AGENT_TOKEN` env var or `~/.openclaw/mc_auth_token` (plain file, one line, mode 0600). `mc.sh` reads these automatically, so you don't need to think about it. If MC has no token configured, auth is skipped (with a server-side warning log) — but you should still pass the header when available.

**Do NOT add `mc_auth_token` (or any other MC-owned key) to `~/.openclaw/openclaw.json`.** OpenClaw 2026.4.15+ enforces a strict root schema and will refuse to start if it sees unknown keys. The sibling-file pattern (`~/.openclaw/mc_auth_token`) keeps MC state out of OpenClaw's parser.

## Hard rules

1. **Only Alfred (agent_id `main`) is authorized to interrupt Alex directly.** Specialists (james, milo, lewis, contractor) may still POST to `/api/agent/attention`, but the server queues non-main pings for **Alfred's triage** — they won't hit Alex's Telegram unless Alfred decides to escalate.

   **Alfred's triage workflow.** On every wake, Alfred receives the pending triage queue in his prompt (you'll see a section "— Pending triage — ..."). For each entry, he decides:
   - `mc.sh triage-escalate <alert_id> main "<why this needs Alex>"` → sends to Alex's Telegram
   - `mc.sh triage-ack <alert_id> main "<why safe to ignore>"` → closes without bothering Alex

   Anything left pending for 24h is auto-escalated by Mission Control so nothing is truly lost.

2. **Heartbeat polling.** On every heartbeat, check `GET /api/agent/dispatch?agent_id=<you>` for tasks Alex sent you. For each returned task, run the full sequence in ONE turn:
   - `POST /api/agent/dispatch` to claim it (sets status `picked_up`)
   - **Do the actual work and write the deliverable.** No narration, no "I will now write X" pings.
   - `POST /api/agent/artifact` to register the file (include `dispatch_id`)
   - `POST /api/agent/status` with status `done` (or `failed` if you couldn't do it)

   **Do NOT send `in_progress` and then stop.** Historical failure mode: agent claims task, sends "in_progress: Writing X" ping, turn ends without writing anything, dispatch strands until Mission Control auto-fails it 12 hours later. If you genuinely need multiple turns (rare), you may send `in_progress`, but Mission Control will nudge you back with a pointed prompt after 30 minutes if no artifact or note has landed. For anything short enough to finish in one turn, skip `in_progress` entirely.

   **Specialists must actually run.** If a dispatch is assigned to james/milo/lewis/contractor, Alfred MUST spawn the specialist sub-agent before any claim/work/artifact sequence. Claiming "on behalf of" a specialist without actually spawning them is a lie to the system — the specialist's OpenClaw task_run must exist for MC to trust the status updates.

3. **Post artifacts for anything reviewable — this is enforced server-side.** If a dispatched task produces any file — a menu, a brief, a report, code, a plan, notes, anything — you MUST call `mc.sh artifact ... --dispatch-id <id>` before marking the dispatch done. `/api/agent/status` **rejects** `done` on a dispatch with no linked artifact (HTTP 409 `artifact_required`).

   If the task genuinely has no file output (confirmation, status check, etc.), resend status with `allow_no_artifact: true` and `no_artifact_reason: "<why>"`. Don't use this as an escape hatch — if you produced any written output, it belongs in an artifact.

   **When delegating to a specialist:** set `agent_id` on the artifact to the specialist (e.g. `james`), not `main`. Same for `mc.sh status` on the dispatch. Always pass `--dispatch-id` on both so MC links artifact to dispatch.

   **Correct completion sequence for a specialist dispatch:**
   ```
   # while they're working
   mc.sh status james in_progress "starting menu draft" --dispatch-id 2
   # when they finish with a file — dispatch-id is REQUIRED for enforcement to pass
   mc.sh artifact james "Five Fifteen Lounge Menu — first pass" brief /path/to/file.md --summary "8 cocktails, 10 food items" --dispatch-id 2
   mc.sh status james done "Delivered first pass" --dispatch-id 2
   ```

   **Handling a revision request.** When Alex clicks "Request revision" on an artifact, MC opens a NEW dispatch addressed to the artifact's owner with Alex's revision notes in the description. Pick it up like any other dispatch. When delivering the revision, register a NEW artifact (don't edit the old one), pass `--dispatch-id` of the revision dispatch, and reference the prior artifact in your summary so context is preserved.

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
