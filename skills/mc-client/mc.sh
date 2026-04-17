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
# Subcommands:
#   mc.sh attention <agent_id> <severity:info|watch|alert> <title> [body] [entity_type] [entity_id]
#   mc.sh status    <agent_id> <status> [summary] [--task-id <id>] [--dispatch-id <id>]
#   mc.sh artifact  <agent_id> <title> <type> <filepath> [--task-id <id>] [--flow-id <id>] [--project-id <id>] [--summary <text>]
#   mc.sh note      <agent_id> <entity_type> <entity_id> <note>
#   mc.sh poll      <agent_id>            # returns queued dispatched tasks
#   mc.sh pickup    <dispatch_id> <agent_id> [openclaw_task_id]
#
# Exit codes:
#   0 on success, 1 on HTTP error, 2 on usage error.

set -euo pipefail

MC_URL="${MC_URL:-http://127.0.0.1:3001}"

die() { echo "mc.sh: $*" >&2; exit "${2:-2}"; }

require_jq() {
  command -v jq >/dev/null 2>&1 || die "jq required (apt-get install jq)"
}

post_json() {
  local path="$1"; shift
  local body="$1"; shift
  local resp
  resp="$(curl -sS -w '\n%{http_code}' -X POST -H 'Content-Type: application/json' -d "$body" "$MC_URL$path")"
  local code="${resp##*$'\n'}"
  local data="${resp%$'\n'*}"
  echo "$data"
  [[ "$code" =~ ^2 ]] || { echo "HTTP $code" >&2; exit 1; }
}

get_json() {
  local path="$1"; shift
  local resp
  resp="$(curl -sS -w '\n%{http_code}' "$MC_URL$path")"
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
    task_id=""; dispatch_id=""
    while [[ $# -gt 3 ]]; do
      case "$4" in
        --task-id) task_id="${5:?}"; shift 2 ;;
        --dispatch-id) dispatch_id="${5:?}"; shift 2 ;;
        *) shift ;;
      esac
    done
    json=$(jq -nc --arg a "$agent" --arg st "$status" --arg sm "$summary" --arg ti "$task_id" --arg di "$dispatch_id" \
      '{agent_id:$a, status:$st, summary:$sm} + (if $ti=="" then {} else {task_id:$ti} end) + (if $di=="" then {} else {dispatch_id:($di|tonumber)} end)')
    post_json /api/agent/status "$json"
    ;;
  artifact)
    require_jq
    agent="${1:?agent_id}"; title="${2:?title}"; type="${3:?type}"; filepath="${4:?filepath}"
    shift 4
    task_id=""; flow_id=""; project_id=""; summary=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --task-id) task_id="${2:?}"; shift 2 ;;
        --flow-id) flow_id="${2:?}"; shift 2 ;;
        --project-id) project_id="${2:?}"; shift 2 ;;
        --summary) summary="${2:?}"; shift 2 ;;
        *) shift ;;
      esac
    done
    # Read file content; if small text send as string, else base64.
    if [[ ! -f "$filepath" ]]; then die "file not found: $filepath"; fi
    size=$(stat -c %s "$filepath")
    filename=$(basename "$filepath")
    if (( size < 500000 )) && file "$filepath" | grep -qE '(text|ASCII|UTF-8)'; then
      content=$(cat "$filepath")
      json=$(jq -nc --arg a "$agent" --arg t "$title" --arg ty "$type" --arg fn "$filename" --arg c "$content" --arg ti "$task_id" --arg fi "$flow_id" --arg pi "$project_id" --arg sm "$summary" \
        '{agent_id:$a, title:$t, type:$ty, filename:$fn, content:$c} + (if $ti=="" then {} else {task_id:$ti} end) + (if $fi=="" then {} else {flow_id:$fi} end) + (if $pi=="" then {} else {project_id:($pi|tonumber)} end) + (if $sm=="" then {} else {summary:$sm} end)')
    else
      content64=$(base64 -w0 "$filepath")
      json=$(jq -nc --arg a "$agent" --arg t "$title" --arg ty "$type" --arg fn "$filename" --arg c "$content64" --arg ti "$task_id" --arg fi "$flow_id" --arg pi "$project_id" --arg sm "$summary" \
        '{agent_id:$a, title:$t, type:$ty, filename:$fn, content_base64:$c} + (if $ti=="" then {} else {task_id:$ti} end) + (if $fi=="" then {} else {flow_id:$fi} end) + (if $pi=="" then {} else {project_id:($pi|tonumber)} end) + (if $sm=="" then {} else {summary:$sm} end)')
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
  help|"")
    sed -n '1,35p' "$0" | grep '^#' | sed 's/^# \{0,1\}//'
    ;;
  *)
    die "unknown subcommand: $cmd. Run 'mc.sh help'."
    ;;
esac
