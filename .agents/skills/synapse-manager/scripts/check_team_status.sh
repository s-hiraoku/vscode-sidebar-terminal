#!/bin/sh
# Aggregate team status: agents + task board.
# Usage: check_team_status.sh
set -e

if ! command -v synapse >/dev/null 2>&1; then
  echo "synapse CLI not found in PATH." >&2
  exit 1
fi

echo "=== Agent Status ==="
if list_output=$(synapse list 2>&1); then
  if printf '%s\n' "$list_output" | grep -q "No agents running."; then
    echo "No agents are currently running."
  else
    printf '%s\n' "$list_output"
  fi
else
  list_status=$?
  echo "synapse list failed: $list_output" >&2
  exit "$list_status"
fi

echo ""
echo "=== Task Board ==="
if task_output=$(synapse tasks list 2>&1); then
  if printf '%s\n' "$task_output" | grep -q "No tasks found."; then
    echo "No tasks on the board."
  else
    printf '%s\n' "$task_output"
  fi
else
  task_status=$?
  echo "synapse tasks list failed: $task_output" >&2
  exit "$task_status"
fi
