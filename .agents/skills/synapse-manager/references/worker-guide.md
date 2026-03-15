# Worker Agent Guide

How to operate as a worker agent in a multi-agent team.

## On Task Receipt

1. **Start immediately** — `[REPLY EXPECTED]` messages require a response; others are fire-and-forget
2. **Check shared knowledge first** — other agents may have already solved similar problems:
   ```bash
   synapse memory search "<task topic>"
   ```
3. **Lock files before editing** — without locks, concurrent edits silently overwrite each other:
   ```bash
   synapse file-safety lock <file> $SYNAPSE_AGENT_ID --intent "description"
   ```

## During Work

Progress reporting prevents managers from sending unnecessary interrupts:
- Report progress on long tasks (>5 min): `synapse send <manager> "Progress: <update>" --silent`
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

## When No Manager Exists

If there is no manager/coordinator agent in the team:
- Assess the situation: `synapse list`
- Coordinate directly with available teammates
- Proactively delegate and spawn when it improves efficiency
- Share decisions via `synapse memory` so the team stays aligned
