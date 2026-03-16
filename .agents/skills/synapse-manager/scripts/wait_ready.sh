#!/bin/sh
# Wait for a Synapse agent to reach READY status.
# Usage: wait_ready.sh <agent_name> [timeout_seconds]
set -e

agent="${1:?Usage: wait_ready.sh <agent_name> [timeout_seconds]}"
timeout="${2:-30}"
elapsed=0

while true; do
  if synapse status "$agent" --json 2>/dev/null | grep -Eq '"status"[[:space:]]*:[[:space:]]*"READY"'; then
    break
  fi
  sleep 1
  elapsed=$((elapsed + 1))
  if [ "$elapsed" -ge "$timeout" ]; then
    echo "ERROR: ${agent} not READY after ${elapsed}s" >&2
    exit 1
  fi
done

echo "${agent} is READY (${elapsed}s)"
