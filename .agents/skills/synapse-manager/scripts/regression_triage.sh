#!/bin/sh
# Triage a test failure: regression vs pre-existing.
# Usage: regression_triage.sh <test_path> [pytest_args...]
#
# Stashes current changes, runs the test on clean state, then restores.
# Exit codes: 0 = regression (new breakage), 1 = pre-existing, 2 = error
set -e

test_path="${1:?Usage: regression_triage.sh <test_path> [pytest_args...]}"
shift

echo "=== Regression Triage: ${test_path} ==="

# Check for uncommitted or untracked changes
has_untracked=$(git ls-files --others --exclude-standard)
if git diff --quiet && git diff --cached --quiet && [ -z "$has_untracked" ]; then
  echo "No uncommitted changes to stash — cannot compare clean vs dirty state" >&2
  exit 2
fi

echo "Stashing current changes (including untracked files)..."
stash_name="regression-triage-$(date +%s)"
git stash push --include-untracked -m "$stash_name" --quiet

# Ensure stash is restored even if pytest or stash pop fails
restore_stash() {
  echo "Restoring changes..."
  if ! git stash pop --quiet 2>/dev/null; then
    echo "WARNING: git stash pop failed (possible conflict). Your changes are in: git stash list" >&2
  fi
}
trap restore_stash EXIT

echo "Running test on clean state..."
clean_exit=0
pytest "$test_path" "$@" --tb=short -q 2>&1 || clean_exit=$?

# trap EXIT will restore the stash automatically

if [ "$clean_exit" -eq 0 ]; then
  echo ""
  echo "RESULT: REGRESSION — test passes on clean state but fails with your changes."
  echo "ACTION: The current changes introduced this failure. Fix before merging."
  exit 0
else
  echo ""
  echo "RESULT: PRE-EXISTING — test also fails on clean state."
  echo "ACTION: Not caused by current changes. Note it and continue."
  exit 1
fi
