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
synapse reply "<your response>" --from <your_agent_id>
synapse reply --list-targets --from <your_agent_id>
synapse reply "<your response>" --from <your_agent_id> --to <sender_id>
```

The framework automatically handles routing - you don't need to know where the message came from.

## API Endpoints

### A2A Compliant

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/agent.json` | GET | Agent Card |
| `/tasks/send` | POST | Send message |
| `/tasks/{id}` | GET | Get task status |
| `/tasks` | GET | List tasks |
| `/tasks/{id}/cancel` | POST | Cancel task |
| `/status` | GET | READY/PROCESSING status |

### Synapse Extensions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tasks/send-priority` | POST | Send with priority (1-5, 5=interrupt) |
| `/tasks/create` | POST | Create task without PTY send (for `--response`) |
| `/reply-stack/list` | GET | List sender IDs available for reply (`synapse reply --list-targets`) |
| `/reply-stack/get` | GET | Get sender info without removing (supports `?sender_id=`) |
| `/reply-stack/pop` | GET | Pop sender info from reply map (supports `?sender_id=`) |

### External Agent Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/external/discover` | POST | Discover and register external A2A agent |
| `/external/agents` | GET | List registered external agents |
| `/external/agents/{alias}` | GET | Get external agent details |
| `/external/agents/{alias}` | DELETE | Remove external agent |
| `/external/agents/{alias}/send` | POST | Send message to external agent |

## Roundtrip Communication (`--response` Flow)

When `--response` is used, the sender waits for a reply:

1. **Sender** calls `/tasks/create` to create a task without PTY send (stores task context)
2. **Sender** calls `/tasks/send` on the target agent with `[REPLY EXPECTED]` marker
3. **Target agent** processes the message and replies via `synapse reply`
4. **Reply** calls `/reply-stack/pop` to get sender info, then sends response back via `/tasks/send`
5. **Sender** receives the response and the roundtrip completes

This flow ensures reliable request-response patterns between agents.

## Priority Levels

| Priority | Use Case |
|----------|----------|
| 1-2 | Low priority, background tasks |
| 3 | Normal tasks (`send` default) |
| 4 | Urgent follow-ups |
| 5 | Emergency interrupt (sends SIGINT first) |

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

### Agent Not Responding

```text
Error: Agent 'synapse-claude-8100' server on port 8100 is not responding.
```
**Solution:** Restart the agent with `synapse claude`.
