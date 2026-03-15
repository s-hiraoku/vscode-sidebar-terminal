---
name: synapse-a2a
description: >-
  Synapse A2A agent communication — sending messages, spawning agents,
  delegating tasks, sharing memory, and coordinating file edits.
  Use this skill when: running synapse send/reply/broadcast/interrupt,
  spawning agents with synapse spawn or synapse team start,
  managing the task board with synapse tasks, sharing knowledge with
  synapse memory, locking files with synapse file-safety, checking
  agent status with synapse list/status, or orchestrating any
  multi-agent workflow.
---

# Synapse A2A Communication

Inter-agent communication framework via Google A2A Protocol.

## Quick Reference

| Task | Command |
|------|---------|
| List agents | `synapse list` (auto-refresh, interactive: arrows/1-9 select, Enter jump, k kill, / filter) |
| Agent detail | `synapse status <target> [--json]` |
| Send message | `synapse send <target> "<msg>"` (default: `--notify`; `--from` auto-detected) |
| Broadcast | `synapse broadcast "<msg>"` |
| Wait for reply | `synapse send <target> "<msg>" --wait` |
| Fire-and-forget | `synapse send <target> "<msg>" --silent` |
| Reply | `synapse reply "<response>"` |
| Reply to specific | `synapse reply "<response>" --to <sender_id>` |
| Interrupt (priority 4) | `synapse interrupt <target> "<msg>"` |
| Spawn agent | `synapse spawn <type> --name <n> --role "<r>" -- <approval-skip-flag>` |
| Spawn with worktree | `synapse spawn <type> --worktree --name <n> --role "<r>" -- <approval-skip-flag>` |
| Team start | `synapse team start <homogeneous-profiles...> [--worktree] -- <approval-skip-flag>` |
| Create task | `synapse tasks create "<subject>" -d "<desc>" --priority <n>` |
| Assign task | `synapse tasks assign <id> <agent>` |
| Complete task | `synapse tasks complete <id>` |
| Approve plan | `synapse approve <id>` |
| Reject plan | `synapse reject <id> --reason "<feedback>"` |
| Save knowledge | `synapse memory save <key> "<content>" --tags <t> --notify` |
| Search knowledge | `synapse memory search "<query>"` |
| Lock file | `synapse file-safety lock <file> <agent_id> --intent "..."` |
| Check locks | `synapse file-safety locks` |
| Task history | `synapse history list --agent <name>` |
| Kill agent | `synapse kill <name> -f` |
| Attach files | `synapse send <target> "<msg>" --attach <file> --wait` |
| Saved agents | `synapse agents list` / `synapse spawn <agent_id>` |
| Post to Canvas | `synapse canvas post <format> "<body>" --title "<title>"` |
| Open Canvas | `synapse canvas open` (auto-starts server, opens browser) |

## Collaboration Decision Framework

Evaluate collaboration opportunities before starting work:

| Situation | Action |
|-----------|--------|
| Small task within your role | Do it yourself |
| Task outside your role, READY agent exists | Delegate: `synapse send --notify` or `--silent` |
| No suitable agent exists | Spawn: `synapse spawn <type> --name <n> --role "<r>" -- <approval-skip-flag>` |
| Stuck or need expertise | Ask: `synapse send <target> "<question>" --wait` |
| Completed a milestone | Report: `synapse send <manager> "<summary>" --silent` |
| Discovered a pattern | Share: `synapse memory save <key> "<pattern>" --tags ... --notify` |

**Mandatory Collaboration Gate** (3+ phases OR 10+ file changes):
1. `synapse list` — check available agents
2. `synapse memory search "<topic>"` — check shared knowledge
3. `synapse tasks create` — register work on the task board
4. Build Agent Assignment Plan (Phase / Agent / Rationale)
5. Spawn specialists if needed (prefer different model types for diversity)

## Use Synapse Features Actively

| Feature | Why It Matters | Commands |
|---------|---------------|----------|
| **Task Board** | Transparent work tracking prevents duplication | `synapse tasks create/assign/complete/fail/reopen` |
| **Shared Memory** | Collective knowledge survives agent restarts | `synapse memory save/search/list` |
| **File Safety** | Locking prevents data loss when two agents edit the same file | `synapse file-safety lock/unlock/locks` |
| **Worktree** | File isolation eliminates merge conflicts in parallel editing | `synapse spawn --worktree` |
| **Broadcast** | Team-wide announcements reach all agents instantly | `synapse broadcast "<msg>"` |
| **History** | Audit trail tracks what happened and when | `synapse history list/show/stats` |
| **Plan Approval** | Gated execution ensures quality before action | `synapse approve/reject` |
| **Canvas** | Visual dashboard for sharing rich cards (code, charts, diffs, diagrams) | `synapse canvas post/open/list` |

## Spawning Decision Table

**Default spawn policy:** When using `synapse spawn`, pass the underlying CLI's
approval-skip / auto-approve flag by default so spawned agents can run
unattended. Use tool args after `--`.

Apply the same rule to `synapse team start`: include the approval-skip flag by
default, and keep teams homogeneous when the forwarded flag is CLI-specific.

Common defaults:
- Claude Code: `synapse spawn claude --name <n> --role "<r>" -- --dangerously-skip-permissions`
- Gemini CLI: `synapse spawn gemini --name <n> --role "<r>" -- --approval-mode=yolo`
- Codex CLI: `synapse spawn codex --name <n> --role "<r>" -- --full-auto`
- Copilot CLI: `synapse spawn copilot --name <n> --role "<r>" -- --allow-all-tools`
- Claude team: `synapse team start claude claude -- --dangerously-skip-permissions`
- Gemini team: `synapse team start gemini gemini -- --approval-mode=yolo`
- Codex team: `synapse team start codex codex -- --full-auto`
- Copilot team: `synapse team start copilot copilot -- --allow-all-tools`

| Condition | Action |
|-----------|--------|
| Existing READY agent can handle it | `synapse send` — reuse is faster (avoids startup overhead) |
| Need parallel execution | `synapse spawn` with `--worktree -- <approval-skip-flag>` for file isolation |
| Task needs a different model's strengths | Spawn a different type (Claude spawns Gemini, etc.) |
| User specified agent count | Follow exactly |
| Single focused subtask | Spawn 1 agent |
| N independent subtasks | Spawn N agents |

**Spawn lifecycle**: spawn → confirm in `synapse list` → wait for READY → send task → evaluate result → kill → confirm cleanup in `synapse list`

Killing spawned agents after completion frees ports, memory, and PTY sessions,
and prevents orphaned agents from accidentally accepting future tasks.

```bash
# Spawn, delegate, verify, cleanup
synapse spawn gemini --name Tester --role "test writer" -- --approval-mode=yolo
synapse list                              # Verify agent appears
# Wait for readiness (or rely on server-side Readiness Gate)
synapse send Tester "Write tests for src/auth.py" --wait
# Evaluate result, then cleanup
synapse kill Tester -f
synapse list                              # Verify cleanup
```

If `synapse kill` fails or the agent still appears in `synapse list`, retry with `-f`,
check the agent status/logs, and report the cleanup failure instead of leaving an
orphaned agent behind.

## Response Mode Guide

Choose based on whether you need the result:

| Mode | Flag | Use When |
|------|------|----------|
| **Wait** | `--wait` | You need the answer before continuing (questions, reviews) |
| **Notify** | `--notify` (default) | Async — you'll be notified on completion |
| **Silent** | `--silent` | Fire-and-forget delegation (no response needed) |

## Worker Agent Guide

When you receive a task from a manager or pick one from the task board:

### On Task Receipt
1. Start work immediately (`[REPLY EXPECTED]` requires a reply; otherwise no reply needed)
2. Check shared knowledge: `synapse memory search "<task topic>"`
3. Lock files before editing: `synapse file-safety lock <file> $SYNAPSE_AGENT_ID`

### During Work
- Report progress if task takes >5 minutes: `synapse send <manager> "Progress: <update>" --silent`
- Report blockers immediately: `synapse send <manager> "<question>" --wait`
- Save findings: `synapse memory save <key> "<finding>" --tags <topic>`
- You can delegate subtasks too — spawn helpers (prefer different model types)
- Always clean up agents you spawn: `synapse kill <name> -f`

### On Completion
1. Update task board: `synapse tasks complete <task_id>`
2. Report to manager: `synapse send <manager> "Done: <summary>" --silent`

### On Failure
1. Update task board: `synapse tasks fail <task_id> --reason "<reason>"`
2. Report details: `synapse send <manager> "Failed: <error details>" --silent`

## Related Skills

| Skill | Purpose |
|-------|---------|
| `synapse-manager` | Multi-agent orchestration workflow (delegation, monitoring, verification) |
| `synapse-reinst` | Re-inject instructions after `/clear` or context reset |

## References

For detailed information, consult these reference files:

| Reference | Contents |
|-----------|----------|
| `references/commands.md` | Full CLI command documentation with all options |
| `references/api.md` | A2A endpoints, readiness gate, error handling |
| `references/examples.md` | Multi-agent workflow examples and patterns |
| `references/file-safety.md` | File locking workflow and commands |
| `references/messaging.md` | Sending, replying, priorities, status states, interactive controls |
| `references/spawning.md` | Spawn lifecycle, patterns, worktree, permissions, API |
| `references/collaboration.md` | Agent naming, external agents, auth, resume, path overrides |
| `references/features.md` | Sessions, workflows, saved agents, tokens, skills, settings, Canvas |
