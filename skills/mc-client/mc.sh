#!/usr/bin/env bash
# Mission Control agent client.
# Small wrapper around MC's /api/agent/* endpoints so any OpenClaw agent can
# write to Mission Control without knowing URL/JSON details.
#
# Install once on PC2:
#   cp mc.sh ~/.openclaw/skills/mc-client/mc.sh
#   chmod +x ~/.openclaw/skills/mc-client/mc.sh
#
# Export MC_URL if running somewhere other than localhost:
#   export MC_URL=http://127.0.0.1:3001
#
# Auth: if MC_AGENT_TOKEN env var is set, or ~/.openclaw/mc_auth_token exists,
# it's sent as "Authorization: Bearer <token>". If MC has no token configured,
# auth is skipped (with a server-side warning log).
#
# Subcommands:
#   mc.sh attention <agent_id> <severity:info|watch|alert> <title> [body] [entity_type] [entity_id]
#   mc.sh status    <agent_id> <status> [summary] [--task-id <id>] [--dispatch-id <id>] [--allow-no-artifact] [--no-artifact-reason <text>]
#   mc.sh artifact  <agent_id> <title> <type> <filepath> [--task-id <id>] [--flow-id <id>] [--project-id <id>] [--summary <text>] [--dispatch-id <id>]
#   mc.sh note      <agent_id> <entity_type> <entity_id> <note>
#   mc.sh poll      <agent_id>            # returns queued dispatched tasks
#   mc.sh pickup    <dispatch_id> <agent_id> [openclaw_task_id]
#   mc.sh triage-pending                                         # Alfred only — lists specialist alerts waiting for triage
#   mc.sh triage-escalate <alert_id> <triaged_by> [note]         # Alfred promotes to Alex's Telegram
#   mc.sh triage-ack      <alert_id> <triaged_by> [note]         # Alfred closes without notifying Alex
#
# Exit codes:
#   0 on success, 1 on HTTP error, 2 on usage error.

set -euo pipefail

MC_URL="${MC_URL:-http://127.0.0.1:3001}"

die() { echo "mc.sh: $*" >&2; exit "${2:-2}"; }

require_jq() {
  command -v jq >/dev/null 2>&1 || die "jq required (apt-get install jq)"
}

# Resolve the MC auth token from (in order): MC_AGENT_TOKEN env, then
# ~/.openclaw/mc_auth_token (plain file). Empty string if neither is set;
# MC will reject the request if auth is enforced server-side.
#
# The token used to live in openclaw.json under `mc_auth_token`, but OpenClaw
# 2026.4.15 enforces a strict root schema and rejects unknown keys, so we moved
# it to a sibling file that OpenClaw doesn't parse.
resolve_token() {
  if [[ -n "${MC_AGENT_TOKEN:-}" ]]; then
    printf '%s' "$MC_AGENT_TOKEN"
    return
  fi
  local tokfile="${OPENCLAW_HOME:-$HOME/.openclaw}/mc_auth_token"
  if [[ -f "$tokfile" ]]; then
    tr -d '\n\r' < "$tokfile"
  fi
}

auth_header_args() {
  local tok
  tok="$(resolve_token)"
  if [[ -n "$tok" ]]; then
    printf -- '-H\nAuthorization: Bearer %s\n' "$tok"
  fi
}

post_json() {
  local path="$1"; shift
  local body="$1"; shift
  local resp
  local auth_args=()
  while IFS= read -r line; do auth_args+=("$line"); done < <(auth_header_args)
  resp="$(curl -sS -w '\n%{http_code}' -X POST -H 'Content-Type: application/json' "${auth_args[@]}" -d "$body" "$MC_URL$path")"
  local code="${resp##*$'\n'}"
  local data="${resp%$'\n'*}"
  echo "$data"
  [[ "$code" =~ ^2 ]] || { echo "HTTP $code" >&2; exit 1; }
}

get_json() {
  local path="$1"; shift
  local resp
  local auth_args=()
  while IFS= read -r line; do auth_args+=("$line"); done < <(auth_header_args)
  resp="$(curl -sS -w '\n%{http_code}' "${auth_args[@]}" "$MC_URL$path")"
  local code="${resp##*$'\n'}"
  local data="${resp%$'\n'*}"
  echo "$data"
  [[ "$code" =~ ^2 ]] || { echo "HTTP $code" >&2; exit 1; }
}

cmd="${1:-}"; shift || true

case "$cmd" in
  attention)
    require_jq
    agent="${1:?agent_id}"; severity="${2:?severity}"; title="${3:?title}"
    body="${4:-}"; entity_type="${5:-}"; entity_id="${6:-}"
    json=$(jq -nc --arg a "$agent" --arg s "$severity" --arg t "$title" --arg b "$body" --arg et "$entity_type" --arg ei "$entity_id" \
      '{agent_id:$a, severity:$s, title:$t} + (if $b=="" then {} else {body:$b} end) + (if $et=="" then {} else {entity_type:$et} end) + (if $ei=="" then {} else {entity_id:$ei} end)')
    post_json /api/agent/attention "$json"
    ;;
  status)
    require_jq
    agent="${1:?agent_id}"; status="${2:?status}"; summary="${3:-}"
    shift 3 || true
    task_id=""; dispatch_id=""; allow_no_artifact="false"; no_artifact_reason=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --task-id) task_id="${2:?}"; shift 2 ;;
        --dispatch-id) dispatch_id="${2:?}"; shift 2 ;;
        --allow-no-artifact) allow_no_artifact="true"; shift ;;
        --no-artifact-reason) no_artifact_reason="${2:?}"; shift 2 ;;
        *) shift ;;
      esac
    done
    json=$(jq -nc --arg a "$agent" --arg st "$status" --arg sm "$summary" --arg ti "$task_id" --arg di "$dispatch_id" --argjson ana "$allow_no_artifact" --arg nar "$no_artifact_reason" \
      '{agent_id:$a, status:$st, summary:$sm}
       + (if $ti=="" then {} else {task_id:$ti} end)
       + (if $di=="" then {} else {dispatch_id:($di|tonumber)} end)
       + (if $ana then {allow_no_artifact:true} else {} end)
       + (if $nar=="" then {} else {no_artifact_reason:$nar} end)')
    post_json /api/agent/status "$json"
    ;;
  artifact)
    require_jq
    agent="${1:?agent_id}"; title="${2:?title}"; type="${3:?type}"; filepath="${4:?filepath}"
    shift 4
    task_id=""; flow_id=""; project_id=""; summary=""; dispatch_id=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --task-id) task_id="${2:?}"; shift 2 ;;
        --flow-id) flow_id="${2:?}"; shift 2 ;;
        --project-id) project_id="${2:?}"; shift 2 ;;
        --summary) summary="${2:?}"; shift 2 ;;
        --dispatch-id) dispatch_id="${2:?}"; shift 2 ;;
        *) shift ;;
      esac
    done
    # Read file content; if small text send as string, else base64.
    if [[ ! -f "$filepath" ]]; then die "file not found: $filepath"; fi
    size=$(stat -c %s "$filepath")
    filename=$(basename "$filepath")
    if (( size < 500000 )) && file "$filepath" | grep -qE '(text|ASCII|UTF-8)'; then
      content=$(cat "$filepath")
      json=$(jq -nc --arg a "$agent" --arg t "$title" --arg ty "$type" --arg fn "$filename" --arg c "$content" --arg ti "$task_id" --arg fi "$flow_id" --arg pi "$project_id" --arg sm "$summary" --arg di "$dispatch_id" \
        '{agent_id:$a, title:$t, type:$ty, filename:$fn, content:$c} + (if $ti=="" then {} else {task_id:$ti} end) + (if $fi=="" then {} else {flow_id:$fi} end) + (if $pi=="" then {} else {project_id:($pi|tonumber)} end) + (if $sm=="" then {} else {summary:$sm} end) + (if $di=="" then {} else {dispatch_id:($di|tonumber)} end)')
    else
      content64=$(base64 -w0 "$filepath")
      json=$(jq -nc --arg a "$agent" --arg t "$title" --arg ty "$type" --arg fn "$filename" --arg c "$content64" --arg ti "$task_id" --arg fi "$flow_id" --arg pi "$project_id" --arg sm "$summary" --arg di "$dispatch_id" \
        '{agent_id:$a, title:$t, type:$ty, filename:$fn, content_base64:$c} + (if $ti=="" then {} else {task_id:$ti} end) + (if $fi=="" then {} else {flow_id:$fi} end) + (if $pi=="" then {} else {project_id:($pi|tonumber)} end) + (if $sm=="" then {} else {summary:$sm} end) + (if $di=="" then {} else {dispatch_id:($di|tonumber)} end)')
    fi
    post_json /api/agent/artifact "$json"
    ;;
  note)
    require_jq
    agent="${1:?agent_id}"; etype="${2:?entity_type}"; eid="${3:?entity_id}"; note="${4:?note}"
    json=$(jq -nc --arg a "$agent" --arg et "$etype" --arg ei "$eid" --arg n "$note" \
      '{agent_id:$a, entity_type:$et, entity_id:$ei, note:$n}')
    post_json /api/agent/note "$json"
    ;;
  poll)
    agent="${1:?agent_id}"
    get_json "/api/agent/dispatch?agent_id=$(printf %s "$agent" | jq -sRr @uri)"
    ;;
  pickup)
    require_jq
    dispatch_id="${1:?dispatch_id}"; agent="${2:?agent_id}"; oc_task="${3:-}"
    json=$(jq -nc --arg d "$dispatch_id" --arg a "$agent" --arg t "$oc_task" \
      '{dispatch_id:($d|tonumber), agent_id:$a} + (if $t=="" then {} else {openclaw_task_id:$t} end)')
    post_json /api/agent/dispatch "$json"
    ;;
  triage-pending)
    # List specialist-raised alerts waiting for triage (Alfred's queue).
    get_json "/api/alerts/pending-triage"
    ;;
  triage-escalate)
    # Alfred promotes an alert → Alex's Telegram.
    require_jq
    alert_id="${1:?alert_id}"; triaged_by="${2:?triaged_by}"; note="${3:-}"
    json=$(jq -nc --arg b "$triaged_by" --arg n "$note" \
      '{decision:"escalated", triaged_by:$b} + (if $n=="" then {} else {note:$n} end)')
    post_json "/api/alerts/$alert_id/triage" "$json"
    ;;
  triage-ack)
    # Alfred acknowledges an alert → closed without bothering Alex.
    require_jq
    alert_id="${1:?alert_id}"; triaged_by="${2:?triaged_by}"; note="${3:-}"
    json=$(jq -nc --arg b "$triaged_by" --arg n "$note" \
      '{decision:"acked", triaged_by:$b} + (if $n=="" then {} else {note:$n} end)')
    post_json "/api/alerts/$alert_id/triage" "$json"
    ;;
  help|"")
    sed -n '1,35p' "$0" | grep '^#' | sed 's/^# \{0,1\}//'
    ;;
  *)
    die "unknown subcommand: $cmd. Run 'mc.sh help'."
    ;;
esac
