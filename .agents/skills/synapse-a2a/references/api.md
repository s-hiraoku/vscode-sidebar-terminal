# A2A Protocol Reference

This document provides technical details for developers and advanced users.
**For normal agent communication, use `synapse send` and `synapse reply` commands.**

## Message Format

### Receiving Messages

Messages arrive with a simple `A2A:` prefix:

```text
A2A: <message content>
```

### Replying to Messages

Use `synapse reply` to respond:

```bash
synapse reply "<your response>"
synapse reply --list-targets
synapse reply "<your response>" --to <sender_id>
```

The framework automatically handles routing - you don't need to know where the message came from.

## API Endpoints

### A2A Compliant

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/agent.json` | GET | Agent Card |
| `/tasks/send` | POST | Send message (subject to Readiness Gate) |
| `/tasks/{id}` | GET | Get task status |
| `/tasks` | GET | List tasks |
| `/tasks/{id}/cancel` | POST | Cancel task |
| `/status` | GET | READY/PROCESSING status |

### Synapse Extensions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tasks/send-priority` | POST | Send with priority (1-5, 5=interrupt; subject to Readiness Gate) |
| `/tasks/create` | POST | Create task without PTY send (for `--wait`) |
| `/reply-stack/list` | GET | List sender IDs available for reply (`synapse reply --list-targets`) |
| `/reply-stack/get` | GET | Get sender info without removing (supports `?sender_id=`) |
| `/reply-stack/pop` | GET | Pop sender info from reply map (supports `?sender_id=`) |

### Agent Teams Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tasks/board` | GET | List shared task board |
| `/tasks/board` | POST | Create task on board (supports `priority` field, default 3) |
| `/tasks/board/{id}/claim` | POST | Claim task atomically |
| `/tasks/board/{id}/complete` | POST | Complete task (auto-unblocks dependents) |
| `/tasks/board/{id}/fail` | POST | Fail task (preserves assignee, does NOT unblock dependents) |
| `/tasks/board/{id}/reopen` | POST | Reopen completed/failed task (clears assignee, returns to pending) |
| `/tasks/{id}/approve` | POST | Approve a plan |
| `/tasks/{id}/reject` | POST | Reject a plan with reason |
| `/team/start` | POST | Start multiple agents in terminal panes (agent-initiated) |
| `/spawn` | POST | Spawn a single agent in a new terminal pane (supports `worktree` field for isolation) |

### Shared Memory Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/memory/list` | GET | List memories (query params: `author`, `tags`, `limit`) |
| `/memory/save` | POST | Save/update memory (`{key, content, tags?, notify?}`) |
| `/memory/search` | GET | Search memories (query param: `q`) |
| `/memory/{id_or_key}` | GET | Get memory by ID or key |
| `/memory/{id_or_key}` | DELETE | Delete memory by ID or key |

### Webhook Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhooks` | POST | Register a webhook for task notifications |
| `/webhooks` | GET | List all registered webhooks |
| `/webhooks` | DELETE | Unregister a webhook (query param: `url`) |
| `/webhooks/deliveries` | GET | Get recent webhook delivery attempts |

### SSE Streaming

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tasks/{id}/subscribe` | GET | Subscribe to task updates via Server-Sent Events |

### External Agent Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/external/discover` | POST | Discover and register external A2A agent |
| `/external/agents` | GET | List registered external agents |
| `/external/agents/{alias}` | GET | Get external agent details |
| `/external/agents/{alias}` | DELETE | Remove external agent |
| `/external/agents/{alias}/send` | POST | Send message to external agent |

## Roundtrip Communication (`--wait` Flow)

When `--wait` is used, the sender waits for a reply:

1. **Sender** calls `/tasks/create` to create a task without PTY send (stores task context)
2. **Sender** calls `/tasks/send` on the target agent with `[REPLY EXPECTED]` marker
3. **Target agent** processes the message and replies via `synapse reply`
4. **Reply** calls `/reply-stack/pop` to get sender info, then sends response back via `/tasks/send`
5. **Sender** receives the response and the roundtrip completes

This flow ensures reliable request-response patterns between agents.

## Readiness Gate

The `/tasks/send` and `/tasks/send-priority` endpoints enforce a **Readiness Gate** that blocks incoming messages until the agent has finished initialization (first READY state).

| Condition | Behavior |
|-----------|----------|
| Agent initializing (not yet READY) | Waits up to `AGENT_READY_TIMEOUT` (default: 30s) for the agent to become ready |
| Agent still not ready after timeout | Returns **HTTP 503** with `Retry-After: 5` header |
| Priority 5 (emergency interrupt) | **Bypasses** the gate entirely |
| Reply messages (`in_reply_to` set) | **Bypasses** the gate (replies are routed before the check) |

**Caller behavior on 503:**
- CLI callers (`synapse send`) handle retries automatically
- Direct API callers should respect the `Retry-After` header and retry after the indicated seconds

**Configuration:**

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_READY_TIMEOUT` | Seconds to wait for agent readiness before returning 503 | `30` |

## Priority Levels

| Priority | Use Case |
|----------|----------|
| 1-2 | Low priority, background tasks |
| 3 | Normal tasks (`send` default) |
| 4 | Urgent follow-ups |
| 5 | Emergency interrupt (sends SIGINT first, bypasses Readiness Gate) |

**Note:** `broadcast` defaults to priority 1 (low), while `send` defaults to priority 3 (normal).

## Long Message Handling

Messages exceeding the TUI input limit (~200-300 characters) are automatically stored in temporary files. The agent receives a reference message instead:

```text
[LONG MESSAGE - FILE ATTACHED]
The full message content is stored at: /tmp/synapse-a2a/messages/<task_id>.txt
Please read this file to get the complete message.
```

**Configuration:**

| Variable | Description | Default |
|----------|-------------|---------|
| `SYNAPSE_LONG_MESSAGE_THRESHOLD` | Character threshold for file storage | `200` |
| `SYNAPSE_LONG_MESSAGE_TTL` | TTL for message files (seconds) | `3600` |
| `SYNAPSE_LONG_MESSAGE_DIR` | Directory for message files | System temp |

**Cleanup:** Files are automatically cleaned up after TTL expires.

## Error Handling

### Agent Not Found

```text
Error: No agent found matching 'xyz'
```
**Solution:** Use `synapse list` to see available agents.

### Multiple Agents Found

```text
Error: Ambiguous target 'codex'. Multiple agents found.
```
**Solution:** Use custom name (e.g., `my-codex`) or specific identifier (e.g., `codex-8120`).

### Agent Not Ready (Initializing)

```text
HTTP 503: Agent not ready (initializing). Retry after a few seconds.
Retry-After: 5
```
**Solution:** The agent is still starting up. Wait a few seconds and retry. Priority 5 messages bypass this check. See "Readiness Gate" section above for details.

### Working Directory Mismatch

```text
Warning: Target agent "my-claude" is in a different directory:
  Sender:  /home/user/project-a
  Target:  /home/user/project-b
Agents in current directory:
  gemini (gemini) - READY
Use --force to send anyway.
```
**Solution:** The target agent is working in a different directory. Either send to an agent in your current directory, use `--force` to bypass the check, or spawn a new agent with `synapse spawn`.

### Agent Not Responding

```text
Error: Agent 'synapse-claude-8100' server on port 8100 is not responding.
```
**Solution:** Restart the agent with `synapse claude`.
