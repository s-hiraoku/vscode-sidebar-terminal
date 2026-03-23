---
name: pr-guardian
description: >-
  Continuously monitor a GitHub PR for merge conflicts, CI failures, and
  CodeRabbit review comments, then automatically fix any issues found.
  Polls every 5 minutes and loops until every check is green. Use this
  skill whenever a PR has just been created or code has been pushed to a
  PR branch — it should be the default follow-up action after any PR
  creation or push. Also trigger on: "watch this PR", "guard this PR",
  "monitor CI", "keep fixing until green", "PRを監視して", "CIが通るまで
  直して", /pr-guardian. When a PostToolUse hook reports that a push or
  PR creation just happened, proactively invoke this skill to start
  monitoring without waiting for the user to ask.
---

# PR Guardian

Watch a PR, detect problems, fix them, repeat — until everything is green.

## Why this exists

After pushing a PR you typically wait for CI, check for merge conflicts,
and respond to CodeRabbit review comments. Each issue requires a separate
manual step. PR Guardian automates the entire feedback loop: it polls the
PR status at a fixed interval, dispatches the appropriate fix skill when
a problem is found, and exits only when all checks pass (or the iteration
limit is reached).

## Quick start

```
/pr-guardian                     # Default: 5 min interval, 20 max iterations
/pr-guardian --interval 3        # Poll every 3 minutes
/pr-guardian --max-iterations 10 # Give up after 10 cycles
```

## Workflow

### Step 0: Validate preconditions

Before starting the loop, verify:

1. `gh` CLI is installed and authenticated
2. Current branch has an open PR (`gh pr view`)
3. Display the PR number and URL

If any check fails, report the error and stop.

### Step 1: Poll PR status

Run the bundled status script:

```bash
bash <skill-path>/scripts/poll_pr_status.sh
```

This returns a JSON object with these fields:

| Field               | Type    | Meaning                                       |
|---------------------|---------|-----------------------------------------------|
| `branch`            | string  | Current branch name                           |
| `pr_number`         | int     | PR number                                     |
| `checks_total`      | int     | Total CI checks (excludes CodeRabbit)         |
| `checks_passed`     | int     | CI checks that passed                         |
| `checks_failed`     | int     | CI checks that failed                         |
| `checks_running`    | int     | CI checks still in progress                   |
| `has_conflict`      | bool    | Merge conflicts detected                      |
| `coderabbit_check`  | string  | CodeRabbit check status: `none`/`pending`/`pass`/`fail` |
| `coderabbit_comments` | int   | Number of CodeRabbit inline comments          |
| `all_green`         | bool    | True when everything passes (including CodeRabbit) |

**Important**: `all_green` is only true when ALL of these hold:
- No merge conflicts
- No CI failures
- No CI checks still running
- CodeRabbit check is NOT `pending` AND NOT `none` (review must have completed at least once)
- No unresolved CodeRabbit inline comments (comments marked `✅ Addressed` are excluded)
- At least one CI check exists

### Step 2: Evaluate and report

Print a concise status line each cycle:

```
[PR Guardian] Cycle 3/20 — PR #42
  CI: 4 passed, 1 failed, 0 running
  Conflicts: none
  CodeRabbit: review completed, 2 inline comments
  → Action: fixing CodeRabbit comments
```

### Step 3: Dispatch fixes (priority order)

When issues are found, fix them one category at a time in this order.
Only fix one category per cycle — after fixing, go back to Step 1 to
re-poll, because a fix may have changed the state (e.g., a push
triggers new CI runs).

**Priority 1 — Merge conflicts**

Merge conflicts block everything else. When `has_conflict` is true:

1. Invoke `/fix-conflict`
2. After resolution, the push triggers new CI runs — go back to Step 1

**Priority 2 — CI failures**

When `checks_failed > 0` and `checks_running == 0` (wait for running
checks to finish before diagnosing failures):

1. Invoke `/fix-ci`
2. After the fix commit is pushed, go back to Step 1

**Priority 3 — CodeRabbit review comments**

When `coderabbit_check == "pass"` and `coderabbit_comments > 0` and CI
is passing:

1. Invoke `/fix-review`
2. `/fix-review` will verify each finding against current code before fixing
3. After the fix commit is pushed, go back to Step 1

**IMPORTANT**: Only dispatch `/fix-review` when `coderabbit_check` is
`"pass"` (review completed). If it is `"pending"`, wait — the review is
still in progress and comments may not be final yet.

### Step 4: Handle pending states

The correct action is to **wait** (not fix) when:

- `checks_running > 0`: CI is still running — do not diagnose yet
- `coderabbit_check == "pending"`: CodeRabbit review is in progress —
  wait for it to finish before looking at comments
- `coderabbit_check == "none"`: CodeRabbit hasn't started yet (common
  right after a push) — wait at least one cycle for it to appear
- `checks_total == 0` and it's the first cycle: checks haven't started
  yet — wait for GitHub Actions to pick up the push

Sleep for the poll interval and re-check. Do not invoke any fix skill
while checks are still running or reviews are pending — you would be
fixing based on incomplete information.

### Step 5: Check exit conditions

After each cycle, check:

1. **All green** (`all_green == true`): Print success message and exit
2. **Max iterations reached**: Print summary of remaining issues and exit
3. **Same failure repeated 3 times**: The automatic fix is not working.
   Print what failed and suggest manual intervention, then exit

If none of these conditions are met, sleep for the configured interval
and go back to Step 1.

### Step 6: Sleep between cycles

```bash
sleep <interval_minutes * 60>
```

The default interval is 5 minutes (300 seconds). This gives CI enough
time to run after a fix push before the next poll.

## Configuration

| Flag               | Default | Description                        |
|--------------------|---------|------------------------------------|
| `--interval`       | 5       | Minutes between polls              |
| `--max-iterations` | 20      | Max cycles before giving up        |

## Exit messages

**Success:**
```
[PR Guardian] All checks green! PR #42 is ready.
  CI: 6/6 passed | Conflicts: none | CodeRabbit: pass, 0 comments
  Completed in 3 cycles over 15 minutes.
```

**Max iterations:**
```
[PR Guardian] Reached 20 cycles without all-green.
  Remaining issues:
    - CI: tests failing (pytest assertion error in test_auth.py)
    - CodeRabbit: 2 unresolved inline comments
  Manual intervention needed.
```

**Repeated failure:**
```
[PR Guardian] Same CI failure persisted after 3 fix attempts.
  Failing check: tests
  Last error: AssertionError in test_auth.py:42
  Automatic repair is not resolving this — please fix manually.
```

## Important notes

- This skill composes `/fix-conflict`, `/fix-ci`, and `/fix-review`.
  It does not reimplement their logic — it orchestrates them.
- Only one fix category is attempted per cycle to avoid cascading
  changes that confuse the state.
- The skill respects both CI timing AND CodeRabbit timing: it waits
  for running checks AND pending reviews to finish before attempting
  fixes.
- CodeRabbit check status (`pending`/`pass`/`fail`) is tracked
  separately from inline comment count. A `pending` check means
  the review is still running — do NOT dispatch `/fix-review` yet.
- Each fix skill handles its own commit and push. PR Guardian only
  handles the polling loop and dispatch.
- `/fix-review` verifies each CodeRabbit finding against the current
  code before applying fixes — it does not blindly apply suggestions.
