# Multi-Agent Workflow Examples

## Basic Setup

### Start Multiple Agents

```bash
# Terminal 1: Start Claude with File Safety (History is enabled by default since v0.3.13)
SYNAPSE_FILE_SAFETY_ENABLED=true synapse claude

# Terminal 2: Start Codex
SYNAPSE_FILE_SAFETY_ENABLED=true synapse codex

# Terminal 3: Start OpenCode
SYNAPSE_FILE_SAFETY_ENABLED=true synapse opencode

# Terminal 4: Monitor
synapse list
```

## Communication Examples

### Simple Message

```text
@codex Please refactor the authentication module
```

### With Priority

```bash
# Urgent follow-up
synapse send gemini "Status update?" --priority 4 --from synapse-claude-8100

# Emergency interrupt
synapse send codex "STOP" --priority 5 --from synapse-claude-8100
```

### Fire-and-forget (No Response Expected)

```text
@gemini --no-response Log this completion event
```

## File Coordination Example

### Delegating File Edit with Lock

```bash
# 1. Check Codex is ready
synapse list

# 2. Check file is not locked
synapse file-safety locks

# 3. Send task
@codex Please refactor src/auth.py. Acquire file lock before editing.

# 4. Monitor progress
synapse file-safety locks
synapse history list --agent codex --limit 5
```

### Handling Lock Conflict

If a file is locked:

```text
File src/auth.py is locked by gemini (expires: 12:30:00)

Options:
1. Wait for lock to expire
2. Work on different files first
3. Check with lock holder:
   synapse send gemini "What's your progress on src/auth.py?" --from synapse-claude-8100
```

## Collaborative Development

### Code Review Workflow

```bash
# Terminal 1 (Claude): Implement feature
# Make changes to src/feature.py

# Send for review
@codex Please review the changes in src/feature.py

# Wait for feedback and iterate
```

### Parallel Research

```text
# Ask multiple agents simultaneously
@gemini Research best practices for authentication
@codex Check how other projects implement this pattern
```

## Monitoring Tasks

### Watch Agent Status

```bash
synapse list
```

### View Task History

```bash
# Recent tasks
synapse history list --limit 10

# By agent
synapse history list --agent codex

# Search
synapse history search "auth" --agent codex
```

### Check Git Changes

```bash
git status
git log --oneline -5
git diff
```

## Troubleshooting

### Agent Not Responding

1. Check status:
   ```bash
   synapse list
   ```

2. If PROCESSING for too long:
   ```bash
   synapse send <agent> "Status?" --priority 4 --from <your_agent_id>
   ```

3. Emergency stop:
   ```bash
   synapse send <agent> "STOP" --priority 5 --from <your_agent_id>
   ```

### Agent Not Found

```bash
# List available agents
synapse list

# Start missing agent
synapse codex  # in new terminal
```
