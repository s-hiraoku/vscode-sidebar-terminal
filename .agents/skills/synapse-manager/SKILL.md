---
name: synapse-manager
description: >-
  Multi-agent management workflow — task delegation, progress monitoring,
  quality verification with regression testing, feedback delivery, and
  cross-review orchestration. Use this skill when coordinating multiple agents
  on a shared task, monitoring delegated work, ensuring quality across
  agent outputs, or implementing a multi-phase plan (3+ phases or 10+ file changes).
---

# Synapse Manager

Orchestrate multi-agent work with structured delegation, monitoring, and quality gates.

## Task Board Rule

**Every delegation MUST have a matching task board entry.**

Before sending work to any agent via `synapse send`, you must:
1. `synapse tasks create "<task>" -d "<description>"` — register the work unit
2. `synapse tasks assign <id> <agent>` — record ownership
3. Only then `synapse send <agent> "..." --force`

Task board is the **team contract** — it makes ownership, blocking, and completion
state visible to every agent. TodoList is for your personal micro-step tracking only.

## When to Use

- Coordinating 2+ agents on related subtasks
- Monitoring progress of delegated work
- Verifying agent outputs (tests, file changes, integration)
- Sending targeted feedback with error details and fix guidance
- Orchestrating cross-review between agents
- Implementing a multi-phase plan (3+ phases or 10+ file changes)
- Planning agent assignment for multi-file changes

## Workflow (7 Steps)

### Step 1: Plan, Spec, and Setup

New tests first. Follow this order for every implementation task: create tests -> present/confirm spec -> then implement.

Edit `plugins/synapse-a2a/skills/` first, then sync generated copies with `sync-plugin-skills`.

Task board is the default coordination surface for manager-led work.
Create or refresh task board entries before delegation starts so ownership,
blocking, and completion state are visible to the whole team.

**Check existing agents before spawning** — reuse is faster (avoids startup overhead,
instruction injection, and readiness wait):
```bash
synapse list
```

Review WORKING_DIR, ROLE, STATUS, TYPE. Only READY agents can accept work immediately.

**Spawn only when no existing agent can handle the task:**
```bash
synapse spawn claude --worktree --name Impl --role "feature implementation"
synapse spawn gemini -w --name Tester --role "test writer"
```

Cross-model spawning (Claude spawns Gemini, etc.) provides diverse strengths and
distributes token usage across providers, avoiding rate limits.

**Wait for readiness** using the helper script. Resolve it from the skill root so the
command works from any working directory, whether you are in the plugin source or a
synced copy:
```bash
cd plugins/synapse-a2a/skills/synapse-manager
scripts/wait_ready.sh Impl 30
scripts/wait_ready.sh Tester 30

# Synced copy example
cd .agents/skills/synapse-manager
scripts/wait_ready.sh Impl 30
```

See `references/auto-approve-flags.md` for per-CLI permission skip flags.

### Step 2: Create Tests and Confirm the Spec

Task board makes work visible to the entire team, prevents duplication, and ensures
implementation is blocked on confirmed tests/spec:
```bash
synapse tasks create "Write auth tests" \
  -d "Create tests/spec for valid login, invalid credentials, token expiry, refresh flow" \
  --priority 5
# Returns: 3f2a1b4c (displayed prefix of a UUID such as 3f2a1b4c-1111-2222-3333-444444444444)

synapse tasks create "Implement auth module" \
  -d "Add OAuth2 with JWT in synapse/auth.py after tests/spec are confirmed. Follow patterns in synapse/server.py." \
  --priority 4 \
  --blocked-by 3f2a1b4c
# Returns: 7a9d2e10 (displayed prefix of a UUID such as 7a9d2e10-5555-6666-7777-888888888888)
```

`synapse tasks create` stores a full UUID and prints its first 8 characters.
Use that prefix (or the full UUID) for `--blocked-by`, `synapse tasks assign`,
and `synapse tasks complete`.
In practice that means the implementation task should use a dependency like
`--blocked-by 3f2a1b4c`, where `3f2a1b4c` is the created test task's UUID prefix.
Conceptually this is still "implementation --blocked-by tests"; the concrete
value just needs to be the created test task's UUID prefix.

**Assign the test/spec task and confirm scope before implementation starts:**
```bash
TESTS_ID=3f2a1b4c
IMPL_ID=7a9d2e10

synapse tasks assign "$TESTS_ID" Tester
synapse send Tester "Write the tests first and confirm the spec for task $TESTS_ID (Write auth tests).
- Cover valid login, invalid credentials, token expiry, refresh flow
- Report any scope gaps before implementation starts" --attach synapse/server.py --force --wait
```

Use `--attach` to send reference files the agent should study.
Use `--wait` while confirming tests/spec, then `--silent` or `--notify` once execution is unblocked.

Default expectation:
- `synapse tasks create` for each meaningful work unit
- `synapse tasks assign` when ownership changes
- `synapse tasks complete` when verification passes
- `synapse tasks fail` when blocked or broken, with a reason the next agent can act on

### Step 3: Delegate Implementation and Monitor

After tests/spec are confirmed, assign the implementation task:
```bash
synapse tasks assign "$IMPL_ID" Impl
synapse send Impl "Implement auth module — tests/spec are confirmed in task $TESTS_ID (Write auth tests).
- Add OAuth2 flow in synapse/auth.py
- Follow existing patterns" --attach synapse/server.py --force --silent
```

**Shortcut — task-linked send:** For simple delegations, use `--task` / `-T` to create,
assign, and send in one step (auto-claim on receive, auto-complete on finalize):
```bash
synapse send Impl "Implement auth module" --task --attach synapse/server.py --force --silent
```

```bash
synapse list                              # Live status (auto-updates)
synapse tasks list                        # Task board progress and dependencies
synapse history list --agent Impl         # Completed work
```

Or use the aggregation script:
```bash
cd plugins/synapse-a2a/skills/synapse-manager && scripts/check_team_status.sh
```

If an agent stays PROCESSING >5 min, send an interrupt:
```bash
synapse interrupt Impl "Status update — what is your current progress?" --force
```

### Step 4: Approve Plans

```bash
synapse approve <task_id>
synapse reject <task_id> --reason "Use refresh tokens instead of long-lived JWTs."
```

**Plan Card workflow** — for structured plans posted to Canvas:
```bash
# Accept a plan card and register its steps as task board tasks
synapse tasks accept-plan <plan_id>

# Sync task board progress back to the plan card
synapse tasks sync-plan <plan_id>
```

**Update task board after decision:**
```bash
# After approve — keep the approved plan moving via assignment/delegation.
# The task board changes at lifecycle checkpoints (assign, complete, fail, reopen).

# After reject — mark for rework
synapse tasks reopen <task_id>
```

### Step 5: Verify

Testing is the critical quality gate — start with the new tests/spec that were created
up front, then run broader regression coverage because an agent's changes may break
unrelated modules through import chains or shared state:

```bash
# New tests first (fast feedback)
pytest tests/test_auth.py -v

# Full regression (catches cross-module breakage)
pytest --tb=short -q
```

**Regression triage** — distinguish new breakage from pre-existing issues:
```bash
cd plugins/synapse-a2a/skills/synapse-manager && scripts/regression_triage.sh tests/test_failing_module.py -v
```
- Exit 0 = REGRESSION (your changes broke it) → proceed to Step 6
- Exit 1 = PRE-EXISTING (already broken) → note it and continue

**Update task board:**
```bash
synapse tasks complete <task_id>
synapse tasks fail <task_id> --reason "test_refresh_token fails — TypeError on line 42"
```

### Step 6: Feedback

Concrete, actionable feedback saves iteration cycles:
```bash
synapse send Impl "Issues found — please fix:

1. FAILING TEST: test_token_expiry (tests/test_auth.py)
   ERROR: TypeError: cannot unpack non-iterable NoneType object
   FIX: Add None guard at the top of validate_token()

2. REGRESSION: test_existing_endpoint broke
   ERROR: expected 200, got 401
   CAUSE: auth middleware intercepts all routes
   FIX: Exclude health-check endpoints from auth" --force --silent
```

**Save patterns for the team:**
```bash
synapse memory save auth-middleware-pattern \
  "Auth middleware must exclude /status and /.well-known/* endpoints" \
  --tags auth,middleware --notify
```

After sending feedback, reopen the task and return to Step 3 (Monitor):
```bash
synapse tasks reopen <task_id>
```

### Step 7: Review & Wrap-up

**Cross-review catches blind spots** — each agent reviews the other's work:
```bash
synapse send Tester "Review implementation. Focus on: correctness, edge cases" --force \
  --attach synapse/auth.py --wait
synapse send Impl "Review test coverage. Focus on: missing cases, assertion quality" --force \
  --attach tests/test_auth.py --wait
```

**Final verification and cleanup:**
```bash
pytest --tb=short -q                      # All tests pass
synapse tasks list                        # Confirm the UUID prefixes before completion
synapse tasks complete "$TESTS_ID"
synapse tasks complete "$IMPL_ID"
synapse kill Impl -f && synapse kill Tester -f
synapse list                              # Verify cleanup
synapse tasks purge --status completed    # Clean up finished tasks
synapse tasks purge --older-than 7d      # Clean up old tasks
synapse tasks purge --dry-run            # Preview what would be deleted
```

Killing spawned agents frees ports, memory, and PTY sessions. Orphaned agents
may accidentally accept future tasks intended for other agents.

## Decision Table

| Situation | Action |
|-----------|--------|
| Agent stuck PROCESSING >5min | `synapse interrupt <name> "Status?"` |
| Check all agents at once | `synapse broadcast "Status check" -p 4` |
| New test fails | Feedback with error + suggested fix (Step 6) |
| Regression test fails | `scripts/regression_triage.sh` to classify |
| Agent READY but no output | Check `git diff`, re-send if needed |
| Agent submits a plan | `synapse approve` or `synapse reject --reason "..."` |
| Agent posts a plan card | `synapse tasks accept-plan <plan_id>` to register steps, `synapse tasks sync-plan <plan_id>` to update |
| Discovered a reusable pattern | `synapse memory save <key> "<pattern>" --notify` |
| Cross-review finds issue | Send fix request with `--attach`, re-verify |
| Delegating work to an agent | `synapse tasks create` + `synapse tasks assign` before `synapse send` |
| All tests pass, reviews clean | Complete tasks, kill agents, report done |

## References

| Reference | Contents |
|-----------|----------|
| `references/auto-approve-flags.md` | Per-CLI permission skip flags |
| `references/worker-guide.md` | Worker agent responsibilities and communication patterns |
| `references/features-table.md` | A2A features with commands |
| `references/commands-quick-ref.md` | All manager-relevant commands |
| `scripts/wait_ready.sh` | Poll until agent reaches READY status |
| `scripts/check_team_status.sh` | Aggregate team status (agents + task board) |
| `scripts/regression_triage.sh` | Classify test failure as regression or pre-existing |
