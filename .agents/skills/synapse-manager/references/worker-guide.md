# Worker Agent Guide

How to operate as a worker agent in a multi-agent team.

## On Task Receipt

1. **Start immediately** — `[REPLY EXPECTED]` messages require a response; others are fire-and-forget
2. **Check the task board** — verify a task board entry exists for your work.
   If the message contains `[Task: XXXXXXXX]`, the board task was auto-claimed for you (no manual `tasks assign` needed); it will auto-complete when you finalize the A2A task.
   If the delegator forgot to create one, create it yourself as a safety net:
   ```bash
   synapse tasks list
   # If no entry exists for your assignment, create and self-assign:
   synapse tasks create "<task subject>" -d "<what was delegated>"
   # Returns: 3f2a1b4c (displayed prefix of a UUID)
   synapse tasks assign 3f2a1b4c $SYNAPSE_AGENT_ID
   ```
   Use that task ID in all subsequent status updates and completion reports.
3. **Check shared knowledge first** — other agents may have already solved similar problems:
   ```bash
   synapse memory search "<task topic>"
   ```
4. **Lock files before editing** — without locks, concurrent edits silently overwrite each other:
   ```bash
   synapse file-safety lock <file> $SYNAPSE_AGENT_ID --intent "description"
   ```

## During Work

Progress reporting prevents managers from sending unnecessary interrupts:
- **Keep task board lifecycle current**: use `synapse tasks complete <task_id>` when done or
  `synapse tasks fail <task_id> --reason "<reason>"` when blocked
- Report progress on long tasks (>5 min): `synapse send <manager> "Progress on 3f2a1b4c — <update>" --silent`
- Report blockers immediately: `synapse send <manager> "<specific question>" --wait`
- Save discoveries for the team: `synapse memory save <key> "<finding>" --tags <topic>`

### Sub-Delegation

Workers can spawn helpers for independent subtasks. This is efficient when your task has naturally parallel parts:
```bash
synapse spawn gemini --worktree --name Helper --role "test writer"
synapse send Helper "Write tests for auth.py and report the result" --notify
# Poll or interrupt if you need an urgent status check:
synapse interrupt Helper "Quick status check" --priority 4
# Wait for the completion notification (or use --wait above), then clean up:
synapse kill Helper -f
```
Prefer different model types to distribute load and avoid rate limits.

## On Completion

1. Update the task board so the manager and team have visibility:
   ```bash
   synapse tasks complete <task_id>
   ```
2. Report results to manager:
   ```bash
   synapse send <manager> "Done: <change summary>" --silent
   ```
3. Include test results if tests were run

## On Failure

Transparency prevents wasted effort — the manager needs to reassign or adjust the plan:
1. `synapse tasks fail <task_id> --reason "<reason>"`
2. `synapse send <manager> "Failed: <error details>" --silent`
3. Do NOT silently move on

## Default vs Proactive Mode

In **default mode**, the task board checkpoints described above (On Task Receipt step 2,
On Completion, On Failure) apply as written.

In **proactive mode** (`SYNAPSE_PROACTIVE_MODE_ENABLED=true`), those same checkpoints apply
**plus** mandatory use of shared memory, file safety, canvas, and broadcast — even for
1-line fixes. Follow the injected checklist strictly. See `synapse-a2a/references/features.md`
for the full checklist.

## When No Manager Exists

If there is no manager/coordinator agent in the team:
- Assess the situation: `synapse list`
- Coordinate directly with available teammates
- Proactively delegate and spawn when it improves efficiency
- Share decisions via `synapse memory` so the team stays aligned
