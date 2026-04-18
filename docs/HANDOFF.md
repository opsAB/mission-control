# Mission Control — Session Handoff

Last updated: 2026-04-18. Author: Claude Opus (1M context) in session with Alex.

## TL;DR for the next session

Mission Control v2 is **live and hardened** on PC2 at `http://192.168.12.53:3001`. Last session completed a full PC2 audit + cleanup and a full MC v2 audit with 14 findings closed, plus three follow-up hardening fixes after debugging four stuck-dispatch auto-fails. Agent API now has shared-secret auth. Alfred's "triage queue" went from fiction to real. The SIGTERM/SIGKILL restart loop is fixed. Everything built, deployed, and verified as of this handoff.

## Infra (unchanged since last handoff)

- **Code:** `/c/Users/Alex/Desktop/Claude Code Projects/mission-control/` on PC1 (Windows); deployed to `~/mission-control/` on PC2 (Ubuntu)
- **GitHub:** https://github.com/opsAB/mission-control (Claude pushes to main directly — each push requires user confirmation via harness permission gate)
- **PC2 SSH:** `ssh pc2 "<cmd>"` works. Passwordless sudo scoped to `systemctl * mission-control`, `systemctl * openclaw-gateway`, `openclaw update`, plus read-only `ufw status`, `journalctl`, `ss`, `systemctl status *`
- **Service:** `mission-control.service` via systemd; now shuts down cleanly on SIGTERM in ~170ms (was 90s + SIGKILL)
- **Deploy loop:** `ssh pc2 "cd ~/mission-control && git pull && npm install --silent && npm run build && sudo -n systemctl restart mission-control"`

## What changed this session

### PC2 system-level cleanup (all done)
- Killed orphan MC v1 (port 3000), ngrok tunnel (4040), stray health-dashboard user service (5050)
- Deleted `~/workspace/mission-control/`, `~/.pm2/`, `~/cloudflared`, `~/cf.log`, `~/nohup.out`, `~/alex-unveil-batch-backup/`
- Archived 6 openclaw.json backups to `~/.openclaw/backups-archive/`
- Cron: fixed broken FTL watchdog path, changed openclaw-update `&&` to `;`, moved whoop_sync to 06:30, moved MC digest to 07:00, consolidated logs to `~/logs/cron/` with 14-day retention
- Purged Docker residue, disabled unused desktop services (bluetooth, cups, cups-browsed, avahi-daemon, ModemManager, gnome-remote-desktop)
- Expanded read-only NOPASSWD sudoers
- Token-based agent auth enabled: `~/.openclaw/mc_auth_token` (plain file, mode 0600). Originally stashed in `openclaw.json`, moved to a sibling file on 2026-04-18 after OpenClaw 2026.4.15 added strict root-schema validation that rejected unknown keys.

### MC v2 audit (14 findings, all closed)
All fixes live in commit `8d68b62` and follow-up `6e67890`:

**Security**
- Path traversal on artifact serve — `path.resolve` + sep boundary
- Artifact filename validation — explicit reject of `/`, `\`, `..`, leading-dot
- **Shared-secret agent auth** (new `src/lib/agent-auth.ts`). All `/api/agent/*` and `/api/alerts/*/triage` require `Authorization: Bearer <token>`. `mc.sh` auto-reads token from env or openclaw.json.

**Reliability**
- SIGTERM handler on SSE streams (`src/lib/events.ts` + `src/app/api/stream/route.ts`)
- Dispatch pickup 409 on no-op UPDATE instead of phantom broadcast
- Migration ALTERs only swallow duplicate-column errors
- openclaw.json parse errors now log instead of silent empty list
- Digest persists the body actually sent (stripped markdown on Telegram fallback)
- Digest scheduler uses "past time today + haven't fired" match, survives restarts
- Stuck-dispatch auto-fail at 12h
- Review actions carry `agent_id='mission-control'` so Office board doesn't drop the row

**Alfred triage queue (real)**
- New `alerts.triaged_at/triaged_by/triage_decision/triage_note` columns
- `GET /api/alerts/pending-triage` — Alfred's queue
- `POST /api/alerts/:id/triage` — escalated | acked
- `/api/agent/attention` returns `queued_for_triage` (replaces the `routed_to_main` lie)
- `trigger.ts` injects pending triage into Alfred's wake-up prompt
- 24h scheduler fallback auto-escalates anything pending

**Anti-abandonment hardening (follow-up after debugging stuck dispatches)**
- **Nudge tick**: dispatches stuck `in_progress` with no artifact + no note >30 min re-trigger Alfred with a pointed prompt (45-min cooldown). Catches "Alfred said Writing X then turn ended" 11.5h before the 12h auto-fail.
- **Prompt reorder**: `PROCESS_QUEUE_PROMPT` now collapses claim→work→artifact→done into one turn. Hard rule: "do not send in_progress and stop." Mirrored in AGENTS.md.
- **Spawn-evidence check**: specialist status updates (james/milo/lewis/contractor) without a recent OpenClaw `task_runs` row raise an alert. Non-blocking — warns, doesn't reject. Catches "Alfred claimed on Milo's behalf without actually spawning Milo."

### Architecture recommendation (NOT YET IMPLEMENTED)
Workspace three-tier model, parked for a future session:
- `~/projects/` (rename of `~/workspace/`) — human-owned project code (Five Fifteen, health, etc.)
- `~/.openclaw/workspace-<agent>/` — per-agent scratch space
- `~/mission-control/data/artifacts/` — finished deliverables registered in MC

Currently project code is split between `~/workspace/` and `~/.openclaw/workspace/`. Agents don't have a clear rule. Consolidation needed but non-trivial (touches agent instructions, file paths in scripts).

## Stack (unchanged)

Next.js 16 App Router + TypeScript + Tailwind + SQLite via `better-sqlite3`. Listens on `0.0.0.0:3001`.

## Data model

Same tables as before, plus new columns:
- `alerts.triaged_at`, `triaged_by`, `triage_decision`, `triage_note`
- `mc_dispatched_tasks.last_nudged_at`

## Agent write API

Same endpoints, but **all now require auth header** when token is configured:

```
Authorization: Bearer <mc_auth_token>
```

`mc.sh` handles this automatically by reading from `$MC_AGENT_TOKEN` env or `~/.openclaw/mc_auth_token` (plain file). Do not put the token back into `openclaw.json` — OpenClaw 2026.4.15+ rejects unknown root keys and will refuse to start.

New subcommands in `mc.sh`:
- `mc.sh triage-pending` — Alfred only, lists queue
- `mc.sh triage-escalate <alert_id> <triaged_by> [note]`
- `mc.sh triage-ack <alert_id> <triaged_by> [note]`

## Known open items

1. **Workspace three-tier migration** — design agreed, not executed
2. **Kernel reboot** — pending kernel 6.17.0-19 installed March 15; dropped from todo list per user request. Reboot when physically at PC2, never urgent
3. **FTL wrapper doesn't register artifacts with MC** — it writes files to `~/mission-control/data/artifacts/ftl-intel/` (fixed path) but doesn't POST to `/api/agent/artifact`. So FTL output won't appear in MC's Docs page. Separate enhancement.
4. **"Five Fifteen Menu — Revision 2" artifact (id 5)** has empty `file_path` — likely inline content; worth a look
5. **Test/smoke artifacts still in DB** — ~25 test entries in `data/artifacts/` (alfred-smoke-test-*, stream-demo-*, live-demo-fact-*) are still in the DB and on disk. Fine to prune when Alex is ready.

## Rules captured to Claude's persistent memory

See `C:\Users\Alex\.claude\projects\C--Users-Alex-Desktop-Claude-Code-Projects\memory\`:
- `user_alex.md` — Alex profile, devices, PC2 = 192.168.12.53
- `feedback_technical_decisions.md` — Alex is non-technical; make arch calls, ask user-level questions
- `feedback_five_fifteen_naming.md` — always "Five Fifteen", never "515"
- `project_mission_control.md` — project overview
- `project_mission_control_v2_prefs.md` — Alfred-only pings, Telegram-only bridge, 6am→7am digest
- `project_openclaw_agents.md` — Alfred / James (Five Fifteen) / Milo (health) / Lewis (unused) / contractor

## How to pick up

1. `ssh pc2 "sudo -n systemctl is-active mission-control"` → confirm running
2. Open `http://192.168.12.53:3001` from PC1 browser → sanity check, look at `/alerts` for any stuck-dispatch / spawn-evidence warnings
3. `mc.sh triage-pending` on PC2 → see if specialists have been pinging and Alfred's been ignoring
4. Ask Alex what's next. Likely candidates: workspace migration, FTL→MC artifact wiring, or something new Alex thought of
