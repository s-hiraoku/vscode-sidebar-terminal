#!/usr/bin/env bash
# poll_pr_status.sh — One-shot PR health check.
# Exits with a JSON blob on stdout describing the current state.
# Exit codes: 0 = produced status, 1 = fatal error (no PR, gh missing, etc.)

set -euo pipefail

PORT="${1:-}"

# --- helpers -----------------------------------------------------------
die() { echo "ERROR: $*" >&2; exit 1; }

command -v gh >/dev/null 2>&1 || die "gh CLI not found"
gh auth status >/dev/null 2>&1 || die "gh CLI not authenticated"

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || die "not in a git repo"

PR_JSON=$(gh pr view --json number,url,mergeable,mergeStateStatus 2>/dev/null) \
  || die "no PR found for branch $BRANCH"

PR_NUMBER=$(echo "$PR_JSON" | jq -r '.number')
MERGEABLE=$(echo "$PR_JSON" | jq -r '.mergeable')
MERGE_STATE=$(echo "$PR_JSON" | jq -r '.mergeStateStatus')

# --- CI checks ---------------------------------------------------------
# gh pr checks --json returns: name, state (SUCCESS|FAILURE|PENDING|QUEUED|...)
# Note: "conclusion" is NOT a valid field — only "state" carries the result.
CHECKS_JSON=$(gh pr checks --json name,state 2>/dev/null || echo "[]")

# Separate CodeRabbit check from CI checks
CI_CHECKS=$(echo "$CHECKS_JSON" | jq '[.[] | select(.name != "CodeRabbit")]')
CR_CHECK=$(echo "$CHECKS_JSON" | jq '[.[] | select(.name == "CodeRabbit")]')

TOTAL=$(echo "$CI_CHECKS" | jq 'length')
PASSED=$(echo "$CI_CHECKS" | jq '[.[] | select(.state == "SUCCESS" or .state == "NEUTRAL" or .state == "SKIPPED")] | length')
FAILED=$(echo "$CI_CHECKS" | jq '[.[] | select(.state == "FAILURE" or .state == "CANCELLED" or .state == "TIMED_OUT" or .state == "ACTION_REQUIRED" or .state == "ERROR")] | length')
RUNNING=$(echo "$CI_CHECKS" | jq '[.[] | select(.state == "IN_PROGRESS" or .state == "QUEUED" or .state == "PENDING" or .state == "WAITING" or .state == "REQUESTED" or .state == "EXPECTED")] | length')

# --- CodeRabbit check status -------------------------------------------
CR_CHECK_STATE="none"
CR_CHECK_COUNT=$(echo "$CR_CHECK" | jq 'length')
if [[ "$CR_CHECK_COUNT" -gt 0 ]]; then
  CR_STATE=$(echo "$CR_CHECK" | jq -r '.[0].state // empty')
  case "$CR_STATE" in
    SUCCESS|NEUTRAL)
      CR_CHECK_STATE="pass"
      ;;
    FAILURE|ERROR|CANCELLED|TIMED_OUT|ACTION_REQUIRED)
      CR_CHECK_STATE="fail"
      ;;
    *)
      # PENDING, IN_PROGRESS, QUEUED, WAITING, REQUESTED, EXPECTED
      CR_CHECK_STATE="pending"
      ;;
  esac
fi

# --- Merge conflict state -----------------------------------------------
HAS_CONFLICT=false
if [[ "$MERGEABLE" == "CONFLICTING" ]] || [[ "$MERGE_STATE" == "DIRTY" ]]; then
  HAS_CONFLICT=true
fi

# --- CodeRabbit inline comments -----------------------------------------
# Only count comments NOT already marked as "✅ Addressed" by CodeRabbit.
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo "")
CR_COMMENTS=0
if [[ -n "$REPO" ]]; then
  CR_COMMENTS=$(gh api "repos/$REPO/pulls/$PR_NUMBER/comments" \
    --jq '[.[] | select(.user.login == "coderabbitai[bot]") | select(.body | test("✅ Addressed") | not)] | length' 2>/dev/null || echo "0")
fi

# --- Output JSON --------------------------------------------------------
# all_green requires:
#   - No conflicts, no CI failures, no CI running
#   - At least one CI check exists
#   - CodeRabbit check is NOT pending AND NOT "none" (review must have completed)
#   - No unresolved CodeRabbit inline comments
ALL_GREEN=false
if [[ "$HAS_CONFLICT" == "false" ]] && \
   [[ "$FAILED" -eq 0 ]] && \
   [[ "$RUNNING" -eq 0 ]] && \
   [[ "$CR_COMMENTS" -eq 0 ]] && \
   [[ "$TOTAL" -gt 0 ]] && \
   [[ "$CR_CHECK_STATE" != "pending" ]] && \
   [[ "$CR_CHECK_STATE" != "none" ]]; then
  ALL_GREEN=true
fi

cat <<EOF
{
  "branch": "$BRANCH",
  "pr_number": $PR_NUMBER,
  "checks_total": $TOTAL,
  "checks_passed": $PASSED,
  "checks_failed": $FAILED,
  "checks_running": $RUNNING,
  "has_conflict": $HAS_CONFLICT,
  "coderabbit_check": "$CR_CHECK_STATE",
  "coderabbit_comments": $CR_COMMENTS,
  "all_green": $ALL_GREEN
}
EOF
