---
name: synapse-a2a
description: This skill provides comprehensive guidance for inter-agent communication using the Synapse A2A framework. Use this skill when sending messages to other agents, routing @agent patterns, understanding priority levels, handling A2A protocol operations, managing task history, configuring settings, or using File Safety features for multi-agent coordination. Automatically triggered when agent communication, A2A protocol tasks, history operations, or file safety operations are detected.
---

# Synapse A2A Communication

Inter-agent communication framework via Google A2A Protocol.

## Quick Reference

| Task | Command |
|------|---------|
| List agents (Rich TUI) | `synapse list` (event-driven refresh via file watcher with 10s fallback, ↑/↓ or 1-9 to select, Enter/j jump, k kill, / filter by TYPE/NAME/WORKING_DIR) |
| Send message | `synapse send <target> "<message>" --from <sender>` |
| Broadcast to cwd agents | `synapse broadcast "<message>" --from <sender>` |
| Wait for reply | `synapse send <target> "<message>" --response --from <sender>` |
| Reply to last message | `synapse reply "<response>" --from <agent>` |
| Reply to specific sender | `synapse reply "<response>" --from <agent> --to <sender_id>` |
| List reply targets | `synapse reply --list-targets --from <agent>` |
| Emergency stop | `synapse send <target> "STOP" --priority 5 --from <sender>` |
| Stop agent | `synapse stop <profile\|id>` |
| Kill agent | `synapse kill <target>` (with confirmation, use `-f` to force) |
| Jump to terminal | `synapse jump <target>` |
| Rename agent | `synapse rename <target> --name <name> --role <role>` |
| Check file locks | `synapse file-safety locks` |
| View history | `synapse history list` |
| Initialize settings | `synapse init` |
| Edit settings (TUI) | `synapse config` (includes List Display for column config) |
| View settings | `synapse config show [--scope user\|project]` |
| Reset settings | `synapse reset [--scope user\|project\|both]` |
| Show instructions | `synapse instructions show <agent>` |
| Send instructions | `synapse instructions send <agent> [--preview]` |
| View logs | `synapse logs <profile> [-f] [-n <lines>]` |
| Add external agent | `synapse external add <url> [--alias <name>]` |
| List external agents | `synapse external list` |
| External agent info | `synapse external info <alias>` |
| Send to external | `synapse external send <alias> "<message>" [--wait]` |
| Remove external agent | `synapse external remove <alias>` |
| Auth setup | `synapse auth setup` (generate keys + instructions) |
| Generate API key | `synapse auth generate-key [-n <count>] [-e]` |
| Version info | `synapse --version` |

**Tip:** Run `synapse list` before sending to verify the target agent is READY.

## Sending Messages (Recommended)

**Use `synapse send` command for inter-agent communication.** This works reliably from any environment including sandboxed agents.

```bash
synapse send gemini "Please review this code" --response --from synapse-claude-8100
synapse send claude "What is the status?" --response --from synapse-codex-8121
synapse send codex-8120 "Fix this bug" --response --priority 3 --from synapse-gemini-8110
```

**Important:**
- Always use `--from` with your **agent ID** (format: `synapse-<type>-<port>`). Do NOT use custom names or agent types for `--from`.
- By default, use `--response` to wait for a reply. Only use `--no-response` for notifications or fire-and-forget tasks.

**Target Resolution (Matching Priority):**
1. Custom name: `my-claude` (highest priority, exact match, case-sensitive)
2. Exact ID: `synapse-claude-8100` (direct match)
3. Type-port: `claude-8100`, `codex-8120`, `opencode-8130`, `copilot-8140` (shorthand)
4. Type only: `claude`, `gemini`, `codex`, `opencode`, `copilot` (only if single instance)

**Note:** When multiple agents of the same type are running, type-only targets (e.g., `claude`) will fail with an ambiguity error. Use custom name (e.g., `my-claude`) or type-port shorthand (e.g., `claude-8100`) instead.

### Choosing --response vs --no-response

Analyze the message content and determine if a reply is expected:
- If the message expects or benefits from a reply → use `--response`
- If the message is purely informational with no reply needed → use `--no-response`
- **If unsure, use `--response`** (safer default)

```bash
# Message that expects a reply
synapse send gemini "What is the best approach?" --response --from synapse-claude-8100

# Purely informational, no reply needed
synapse send codex "FYI: Build completed" --no-response --from synapse-claude-8100
```

### Roundtrip Communication (--response)

For request-response patterns:

```bash
# Sender: Wait for response (blocks until reply received)
synapse send gemini "Analyze this data" --response --from synapse-claude-8100

# Receiver: Reply to sender
synapse reply "Analysis result: ..." --from synapse-gemini-8110
```

The `--response` flag makes the sender wait. The receiver should reply using the `synapse reply` command.

**Reply Tracking:** Synapse automatically tracks senders who expect a reply (`[REPLY EXPECTED]` messages). Use `synapse reply` for responses - it automatically knows who to reply to.

### Broadcasting to All Agents

Send a message to all agents sharing the same working directory:

```bash
# Broadcast status check to all cwd agents
synapse broadcast "Status check" --from synapse-claude-8100

# Urgent broadcast
synapse broadcast "Urgent: stop all work" --priority 4 --from synapse-claude-8100

# Fire-and-forget broadcast
synapse broadcast "FYI: Build completed" --no-response --from synapse-claude-8100
```

**Note:** Broadcast only targets agents in the **same working directory** as the sender. This prevents unintended messages to agents working on different projects.

## Receiving and Replying to Messages

When you receive an A2A message, it appears with the `A2A:` prefix:

**Message Formats:**
```
A2A: [REPLY EXPECTED] <message>   <- Reply is REQUIRED
A2A: <message>                    <- Reply is optional (one-way notification)
```

If `[REPLY EXPECTED]` marker is present, you **MUST** reply using `synapse reply`.

**Reply Tracking:** Synapse stores sender info only for messages with `[REPLY EXPECTED]` marker. Multiple senders can be tracked simultaneously (each sender has one entry).

**Replying to messages:**

```bash
# Use the reply command
# --from: Use your agent ID (synapse-<type>-<port>)
synapse reply "Here is my analysis..." --from <your_agent_id>

# When multiple senders are pending, inspect and choose target
synapse reply --list-targets --from <your_agent_id>
synapse reply "Here is my analysis..." --from <your_agent_id> --to <sender_id>
```

**Example - Question received (MUST reply):**
```
Received: A2A: [REPLY EXPECTED] What is the project structure?
Reply:    synapse reply "The project has src/, tests/..." --from synapse-codex-8121
```

**Example - Delegation received (no reply needed):**
```
Received: A2A: Run the tests and fix failures
Action:   Just do the task. No reply needed unless you have questions.
```

## Priority Levels

| Priority | Description | Use Case |
|----------|-------------|----------|
| 1-2 | Low | Background tasks |
| 3 | Normal | Standard tasks |
| 4 | Urgent | Follow-ups, status checks |
| 5 | Interrupt | Emergency (sends SIGINT first) |

Default priority: `send` = 3 (normal), `broadcast` = 1 (low).

```bash
# Normal priority (default: 3) - with response
synapse send gemini "Analyze this" --response --from synapse-claude-8100

# Higher priority - urgent request
synapse send claude "Urgent review needed" --response --priority 4 --from synapse-codex-8121

# Emergency interrupt
synapse send codex "STOP" --priority 5 --from synapse-claude-8100
```

## Agent Status

| Status | Meaning | Color |
|--------|---------|-------|
| READY | Idle, waiting for input | Green |
| WAITING | Awaiting user input (selection, confirmation) | Cyan |
| PROCESSING | Busy handling a task | Yellow |
| DONE | Task completed (auto-clears after 10s) | Blue |

**Verify before sending:** Run `synapse list` and confirm the target agent's Status column shows `READY`:

```bash
synapse list
# Output (NAME column shows custom name if set, otherwise agent ID):
# NAME        TYPE    STATUS      PORT   WORKING_DIR
# my-claude   claude  READY       8100   my-project      # <- has custom name
# gemini      gemini  WAITING     8110   my-project      # <- no custom name, shows type
# codex       codex   PROCESSING  8120   my-project      # <- busy
```

**Status meanings:**
- `READY`: Safe to send messages
- `WAITING`: Agent needs user input - use terminal jump (see below) to respond
- `PROCESSING`: Busy, wait or use `--priority 5` for emergency interrupt
- `DONE`: Recently completed, will return to READY shortly

## Interactive Controls

In `synapse list`, you can interact with agents:

| Key | Action |
|-----|--------|
| `1-9` | Select agent row (direct) |
| `↑/↓` | Navigate agent rows |
| `Enter` or `j` | Jump to selected agent's terminal |
| `k` | Kill selected agent (with confirmation) |
| `/` | Filter by TYPE, NAME, or WORKING_DIR |
| `ESC` | Clear filter first, then selection |
| `q` | Quit |

**Supported Terminals:**
- iTerm2 (macOS) - Switches to correct tab/pane
- Terminal.app (macOS) - Switches to correct tab
- Ghostty (macOS) - Activates application
- VS Code integrated terminal - Opens to working directory
- tmux - Switches to agent's session
- Zellij - Focuses agent's terminal pane

**Use case:** When an agent shows `WAITING` status, use terminal jump to quickly respond to its selection prompt.

## Agent Naming

Assign custom names and roles to agents for easier identification:

```bash
# Start with name and role
synapse claude --name my-claude --role "code reviewer"

# Skip interactive name/role setup
synapse claude --no-setup

# Update name/role after agent is running
synapse rename synapse-claude-8100 --name my-claude --role "test writer"
synapse rename my-claude --role "documentation"  # Change role only
synapse rename my-claude --clear                 # Clear name and role
```

Once named, use the custom name for all operations:

```bash
synapse send my-claude "Review this code" --from synapse-codex-8121
synapse jump my-claude
synapse kill my-claude
```

**Name vs ID:**
- **Display/Prompts**: Shows name if set, otherwise ID (e.g., `Kill my-claude (PID: 1234)?`)
- **Internal processing**: Always uses agent ID (`synapse-claude-8100`)
- **Target resolution**: Name has highest priority when matching targets

## External Agent Management

Connect to external A2A-compatible agents over HTTP/HTTPS:

```bash
# Discover and add an external agent
synapse external add https://agent.example.com --alias myagent

# List registered external agents
synapse external list

# Show agent details (capabilities, skills)
synapse external info myagent

# Send message to external agent
synapse external send myagent "Analyze this data"
synapse external send myagent "Process file" --wait  # Wait for completion

# Remove agent
synapse external remove myagent
```

External agents are stored persistently in `~/.a2a/external/`.

## Authentication

Secure A2A communication with API key authentication:

```bash
# Interactive setup (generates keys + shows instructions)
synapse auth setup

# Generate API key(s)
synapse auth generate-key
synapse auth generate-key -n 3 -e  # 3 keys in export format

# Enable authentication
export SYNAPSE_AUTH_ENABLED=true
export SYNAPSE_API_KEYS=<key>
export SYNAPSE_ADMIN_KEY=<admin_key>
synapse claude
```

## Resume Mode

Start agents without sending initial instructions (for session recovery):

```bash
synapse claude -- --resume
synapse gemini -- --resume
synapse codex -- resume        # Codex: resume is a subcommand
synapse opencode -- --continue
synapse copilot -- --continue
```

To inject instructions later: `synapse instructions send <agent>`.

## Key Features

- **Agent Naming**: Custom names and roles for easy identification
- **Agent Communication**: `synapse send` command, `synapse broadcast` for cwd-scoped messaging, priority control, response handling
- **Task History**: Search, export, statistics (`synapse history`)
- **File Safety**: Lock files to prevent conflicts (`synapse file-safety`); active locks shown in `synapse list` EDITING_FILE column
- **External Agents**: Connect to external A2A agents (`synapse external`)
- **Authentication**: API key-based security (`synapse auth`)
- **Settings**: Configure via `settings.json` (`synapse init`)
- **Approval Mode**: Control initial instruction approval (`approvalMode` in settings)

## Path Overrides

When running multiple environments or tests, override storage paths via env vars:

- `SYNAPSE_REGISTRY_DIR` (default: `~/.a2a/registry`)
- `SYNAPSE_EXTERNAL_REGISTRY_DIR` (default: `~/.a2a/external`)
- `SYNAPSE_HISTORY_DB_PATH` (default: `~/.synapse/history/history.db`)

## References

For detailed documentation, read:

- `references/commands.md` - Full CLI command reference
- `references/file-safety.md` - File Safety detailed guide
- `references/api.md` - A2A endpoints and message format
- `references/examples.md` - Multi-agent workflow examples
