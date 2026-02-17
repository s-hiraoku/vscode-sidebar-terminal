# CLI Command Reference

## Agent Management

### List Running Agents

```bash
# Show all running agents (Rich TUI with auto-refresh on changes)
synapse list
```

**Rich TUI Features:**
- Auto-refresh when agent status changes (via file watcher)
- Color-coded status display:
  - READY = green (idle, waiting for input)
  - WAITING = cyan (awaiting user input - selection, confirmation)
  - PROCESSING = yellow (busy handling a task)
  - DONE = blue (task completed, auto-clears after 10s)
  - SHUTTING_DOWN = red (graceful shutdown in progress)
- Flicker-free updates
- **Interactive row selection**: Press 1-9 or ↑/↓ to select an agent row and view full paths in a detail panel
- **Terminal Jump**: Press `Enter` or `j` to jump directly to the selected agent's terminal
- **Kill Agent**: Press `k` to terminate selected agent (with confirmation dialog)
- **Filter**: Press `/` to filter by TYPE, NAME, or WORKING_DIR
- Press `ESC` to clear filter/selection, `q` to exit

**Terminal Jump Supported Terminals:**
- iTerm2 (macOS) - Switches to correct tab/pane
- Terminal.app (macOS) - Switches to correct tab
- Ghostty (macOS) - Activates application
- VS Code integrated terminal - Activates/focuses VS Code window
- tmux - Switches to agent's session/pane
- Zellij - Activates terminal app (direct pane focus not supported via CLI)

**Output columns:**
- **NAME**: Custom name if set, otherwise agent type (e.g., `my-claude` or `claude`)
- **TYPE**: Agent type (claude, gemini, codex, opencode, copilot)
- **ID**: Full agent ID (e.g., `synapse-claude-8100`)
- **ROLE**: Role description if set
- **STATUS**: READY / WAITING / PROCESSING / DONE / SHUTTING_DOWN
- **CURRENT**: Current task preview (truncated to 30 chars) - shows what agent is working on
- **TRANSPORT**: Communication method during inter-agent messages
  - `UDS→` / `TCP→`: Sending via UDS/TCP
  - `→UDS` / `→TCP`: Receiving via UDS/TCP
  - `-`: No active communication
- **WORKING_DIR**: Working directory (truncated in TUI, full path in detail panel)
- **EDITING FILE** (when File Safety enabled): Currently locked file name

**Name vs ID:** Display shows name if set, internal operations use agent ID (`synapse-claude-8100`).

### Start Agents

```bash
# Interactive mode (foreground)
synapse claude
synapse gemini
synapse codex
synapse opencode
synapse copilot

# With custom name and role
synapse claude --name my-claude --role "code reviewer"

# Delegate/coordinator mode (no file editing, delegates via synapse send)
synapse claude --delegate-mode --name coordinator --role "task manager"

# Skip interactive name/role setup
synapse claude --no-setup

# With specific port
synapse claude --port 8101

# History is enabled by default (v0.3.13+)
# To disable history:
SYNAPSE_HISTORY_ENABLED=false synapse claude

# With File Safety enabled
SYNAPSE_FILE_SAFETY_ENABLED=true synapse claude

# Resume mode (skip initial instructions)
# Note: Claude/Gemini use --resume flag, Codex uses resume subcommand, OpenCode/Copilot use --continue
synapse claude -- --resume
synapse gemini -- --resume
synapse codex -- resume      # Codex: resume is a subcommand, not a flag
synapse opencode -- --continue
synapse copilot -- --continue

# Background mode
synapse start claude --port 8100
synapse start claude --port 8100 --foreground  # for debugging

# With SSL/HTTPS
synapse start claude --port 8100 --ssl-cert cert.pem --ssl-key key.pem
```

### Spawn Single Agent

Spawn a single agent in a new terminal pane or window.

```bash
synapse spawn claude                          # Spawn Claude in a new pane
synapse spawn gemini --port 8115              # Spawn with explicit port
synapse spawn claude --name Tester --role "test writer"  # With name/role
synapse spawn claude --terminal tmux          # Use specific terminal

# Pass tool-specific arguments after '--'
synapse spawn claude -- --dangerously-skip-permissions
```

**Headless Mode:**
When an agent is started via `synapse spawn`, it automatically runs with the `--headless` flag. This skips all interactive setup (name/role prompts, startup animations, and initial instruction approval prompts) to allow for smooth programmatic orchestration. The A2A server remains active, and initial instructions are still sent to enable communication.

**Note:** The spawning agent is responsible for the lifecycle of the spawned agent. Ensure you terminate spawned agents using `synapse kill <target> -f` when their task is complete.

**Pane Auto-Close:** Spawned panes close automatically when the agent process terminates in all supported terminals (tmux, zellij, iTerm2, Terminal.app, Ghostty).

### Stop Agents

```bash
# Stop by profile
synapse stop claude

# Stop by specific ID (recommended for precision)
synapse stop synapse-claude-8100

# Stop all instances of a profile
synapse stop claude --all
```

### Kill Agents

```bash
# Graceful shutdown (default): sends A2A shutdown request, waits 30s, then SIGTERM
synapse kill my-claude

# Kill by agent ID
synapse kill synapse-claude-8100

# Kill by agent type (only if single instance)
synapse kill claude

# Force kill (immediate SIGKILL, skip graceful shutdown)
synapse kill my-claude -f
```

**Graceful shutdown flow:**
1. Sends `shutdown_request` A2A message to agent
2. Waits up to 30s (configurable via `shutdown.timeout_seconds` setting)
3. If no response, sends SIGTERM
4. With `-f`: sends SIGKILL immediately (previous behavior)

### Jump to Terminal

```bash
# Jump by custom name
synapse jump my-claude

# Jump by agent ID
synapse jump synapse-claude-8100

# Jump by agent type (only if single instance)
synapse jump claude
```

**Supported Terminals:** iTerm2, Terminal.app, Ghostty, VS Code, tmux, Zellij

### Rename Agents

Assign or update custom names and roles for running agents:

```bash
# Set name and role
synapse rename synapse-claude-8100 --name my-claude --role "code reviewer"

# Update role only (use current name)
synapse rename my-claude --role "test writer"

# Clear name and role
synapse rename my-claude --clear
```

**Name vs ID:**
- Custom names are for **display and user-facing operations** (prompts, `synapse list` output)
- Agent ID (`synapse-claude-8100`) is used **internally** for registry and processing
- Target resolution: name has highest priority when matching

### Port Ranges

| Agent    | Ports     |
|----------|-----------|
| Claude   | 8100-8109 |
| Gemini   | 8110-8119 |
| Codex    | 8120-8129 |
| OpenCode | 8130-8139 |
| Copilot  | 8140-8149 |

## Receiving Messages

When you receive an A2A message, it appears with the `A2A:` prefix:

**Message Formats:**
```
A2A: [REPLY EXPECTED] <message>   <- Reply is REQUIRED
A2A: <message>                    <- Reply is optional (one-way notification)
```

If `[REPLY EXPECTED]` marker is present, you **MUST** reply using `synapse reply`.

**Reply Tracking:** Synapse automatically tracks senders who expect a reply (`[REPLY EXPECTED]` messages). Use `synapse reply` for responses - it automatically knows who to reply to.

**Replying to messages:**

```bash
# Use the reply command (auto-routes to last sender)
synapse reply "<your reply>"

# In sandboxed environments (like Codex), specify your agent ID
synapse reply "<your reply>" --from <your_agent_id>
```

**Example - Question received (MUST reply):**
```
Received: A2A: [REPLY EXPECTED] What is the project structure?
Reply:    synapse reply "The project has src/, tests/..."
```

**Example - Delegation received (no reply needed):**
```
Received: A2A: Run the tests and fix failures
Action:   Just do the task. No reply needed unless you have questions.
```

## Sending Messages

### synapse send (Recommended)

**Use this command for inter-agent communication.** Works from any environment including sandboxed agents.

```bash
synapse send <target> "<message>" [--from <sender>] [--priority <1-5>] [--response | --no-response]
```

**Target Formats (in priority order):**

| Format | Example | Description |
|--------|---------|-------------|
| Custom name | `my-claude` | Highest priority, exact match, case-sensitive |
| Full ID | `synapse-claude-8100` | Always works, unique identifier |
| Type-port | `claude-8100` | Use when multiple agents of same type |
| Agent type | `claude` | Only when single instance exists |

**Parameters:**
- `--from, -f`: Sender agent ID (for reply identification) - **always include this**
- `--priority, -p`: Priority level 1-5 (default: 3)
  - 1-2: Low priority, background tasks
  - 3: Normal tasks
  - 4: Urgent follow-ups
  - 5: Critical/emergency (sends SIGINT first)
- `--response`: Roundtrip mode - sender waits, receiver MUST reply
- `--no-response`: Oneway mode - fire and forget, no reply expected
- `--message-file`: Read message from file (use `-` for stdin)
- `--stdin`: Read message from stdin
- `--attach`: Attach file(s) to message (repeatable)

**Choosing --response vs --no-response:**

Analyze the message content and determine if a reply is expected:
- If the message expects or benefits from a reply → use `--response`
- If the message is purely informational with no reply needed → use `--no-response`
- **If unsure, use `--response`** (safer default)

| Message Type | Flag | Example |
|--------------|------|---------|
| Question | `--response` | "What is the status?" |
| Request for analysis | `--response` | "Please review this code" |
| Status check | `--response` | "Are you ready?" |
| Notification | `--no-response` | "FYI: Build completed" |
| Delegated task | `--no-response` | "Run tests and commit" |

**Examples:**
```bash
# Question - needs reply
synapse send gemini "What is the best approach?" --response --from synapse-codex-8121

# Delegation - no reply needed
synapse send codex "Fix this bug and commit" --from synapse-claude-8100

# Send to specific instance with status check
synapse send claude-8100 "What is your status?" --response --from synapse-gemini-8110

# Emergency interrupt
synapse send codex "STOP" --priority 5 --from synapse-claude-8100
```

**Sending long messages or files:**
```bash
# Send message from file (avoids ARG_MAX shell limits)
synapse send claude --message-file /tmp/review.txt --no-response

# Read message from stdin
echo "long message" | synapse send claude --stdin --no-response
synapse send claude --message-file - --no-response   # '-' reads from stdin

# Attach files to message
synapse send claude "Review this" --attach src/main.py --no-response
synapse send claude "Review these" --attach src/a.py --attach src/b.py --no-response
```

Messages >100KB are automatically written to temp files (configurable via `SYNAPSE_SEND_MESSAGE_THRESHOLD`).

**Important:** Always use `--from` with your agent ID (format: `synapse-<type>-<port>`).

### Reply Command

Reply to the last received message:

```bash
synapse reply "<message>"
```

Synapse automatically knows who to reply to based on tracked senders. The `--from` flag is only needed in sandboxed environments (like Codex).

If multiple senders are pending, list and choose explicitly:

```bash
# Show tracked sender IDs
synapse reply --list-targets

# Reply to a specific sender
synapse reply "<message>" --to <sender_id>
```

### Broadcast Command

Send a message to all agents in the current working directory:

```bash
synapse broadcast "<message>" [--from <sender>] [--priority <1-5>] [--response | --no-response]
```

**Parameters:**
- `message`: Message to broadcast to all cwd agents
- `--from, -f`: Sender agent ID (for reply identification)
- `--priority, -p`: Priority level 1-5 (default: 1)
- `--response`: Wait for responses from all agents
- `--no-response`: Fire-and-forget broadcast

**Scope:** Only targets agents sharing the same working directory as the sender.

**Examples:**
```bash
# Broadcast status check
synapse broadcast "Status check" --from synapse-claude-8100

# Urgent broadcast with priority
synapse broadcast "Stop current work" --priority 4 --from synapse-claude-8100

# Fire-and-forget notification
synapse broadcast "FYI: Build completed" --no-response --from synapse-claude-8100

# Wait for responses from all agents
synapse broadcast "What are you working on?" --response --from synapse-claude-8100
```

### A2A Tool (Advanced)

For advanced use cases or external scripts:

```bash
python -m synapse.tools.a2a send --target <AGENT> [--priority <1-5>] "<MESSAGE>"
python -m synapse.tools.a2a broadcast [--priority <1-5>] [--from <AGENT>] [--response | --no-response] "<MESSAGE>"  # Broadcast to cwd agents
python -m synapse.tools.a2a reply "<MESSAGE>"  # Reply to last received message
python -m synapse.tools.a2a reply --list-targets
python -m synapse.tools.a2a reply "<MESSAGE>" --to <SENDER_ID>
python -m synapse.tools.a2a list                # List agents
python -m synapse.tools.a2a cleanup             # Cleanup stale entries
```

## Task History

Enabled by default (v0.3.13+). To disable: `SYNAPSE_HISTORY_ENABLED=false`.

### List History

```bash
# Recent tasks (default: 50)
synapse history list

# Filter by agent
synapse history list --agent claude

# Limit results
synapse history list --limit 100
```

### Show Task Details

```bash
synapse history show <task_id>
```

### Search Tasks

```bash
# Search by keywords (OR logic)
synapse history search "Python" "Docker" --logic OR

# Search with AND logic
synapse history search "error" "authentication" --logic AND

# Filter by agent
synapse history search "bug" --agent claude --limit 20
```

### View Statistics

```bash
# Overall statistics
synapse history stats

# Per-agent statistics
synapse history stats --agent gemini
```

### Export Data

```bash
# Export to JSON
synapse history export --format json > history.json

# Export to CSV
synapse history export --format csv --agent claude > claude_tasks.csv

# Export to file
synapse history export --format json --output export.json
```

### Cleanup

```bash
# Delete entries older than 30 days
synapse history cleanup --days 30

# Keep database under 100MB
synapse history cleanup --max-size 100

# Preview what would be deleted
synapse history cleanup --days 30 --dry-run

# Skip VACUUM after deletion (faster)
synapse history cleanup --days 30 --no-vacuum
```

### Trace Task

Trace a task across history and file modifications:

```bash
synapse trace <task_id>
```

Shows task history combined with file-safety records for the specified task.

## Settings Management

### Initialize Settings

```bash
# Interactive - prompts for scope selection
synapse init

# Output:
# ? Where do you want to create .synapse/?
#   ❯ User scope (~/.synapse/)
#     Project scope (./.synapse/)
```

Creates `.synapse/` directory with all template files (settings.json, default.md, gemini.md, file-safety.md).

### Edit Settings (Interactive TUI)

```bash
# Interactive TUI for editing settings
synapse config

# Use legacy questionary-based interface instead of Rich TUI
synapse config --no-rich

# Edit specific scope directly (skip scope selection prompt)
synapse config --scope user     # Edit ~/.synapse/settings.json
synapse config --scope project  # Edit ./.synapse/settings.json

# View current settings (read-only)
synapse config show                    # Show merged settings from all scopes
synapse config show --scope user       # Show user settings only
synapse config show --scope project    # Show project settings only
```

**TUI Categories:**
- **Environment Variables**: `SYNAPSE_HISTORY_ENABLED`, `SYNAPSE_FILE_SAFETY_ENABLED`, etc.
- **Instructions**: Agent-specific initial instruction files
- **Approval Mode**: `required` (prompt before sending) or `auto` (no prompt)
- **A2A Protocol**: `flow` mode (auto/roundtrip/oneway)
- **Resume Flags**: CLI flags that indicate session resume mode
- **List Display**: Configure `synapse list` columns

### Settings File Format

`.synapse/settings.json`:
```json
{
  "env": {
    "SYNAPSE_HISTORY_ENABLED": "true",
    "SYNAPSE_FILE_SAFETY_ENABLED": "true",
    "SYNAPSE_FILE_SAFETY_DB_PATH": ".synapse/file_safety.db"
  },
  "approvalMode": "required",
  "hooks": {
    "on_idle": "",
    "on_task_completed": ""
  },
  "shutdown": {
    "timeout_seconds": 30,
    "graceful_enabled": true
  },
  "delegate_mode": {
    "deny_file_locks": true
  },
  "list": {
    "columns": ["ID", "NAME", "STATUS", "CURRENT", "TRANSPORT", "WORKING_DIR"]
  }
}
```

**Available Settings:**

| Variable | Description | Default |
|----------|-------------|---------|
| `SYNAPSE_HISTORY_ENABLED` | Enable task history | `true` (v0.3.13+) |
| `SYNAPSE_FILE_SAFETY_ENABLED` | Enable file safety | `true` |
| `SYNAPSE_FILE_SAFETY_DB_PATH` | File safety DB path | `.synapse/file_safety.db` |
| `SYNAPSE_FILE_SAFETY_RETENTION_DAYS` | Lock history retention days | `30` |
| `SYNAPSE_UDS_DIR` | UDS socket directory | `/tmp/synapse-a2a/` |
| `SYNAPSE_LONG_MESSAGE_THRESHOLD` | Character threshold for file storage | `200` |
| `SYNAPSE_LONG_MESSAGE_TTL` | TTL for message files (seconds) | `3600` |
| `SYNAPSE_LONG_MESSAGE_DIR` | Directory for message files | System temp |
| `SYNAPSE_TASK_BOARD_ENABLED` | Enable shared task board | `true` |
| `SYNAPSE_TASK_BOARD_DB_PATH` | Task board DB path | `.synapse/task_board.db` |
| `SYNAPSE_REGISTRY_DIR` | Local registry directory | `~/.a2a/registry` |
| `SYNAPSE_EXTERNAL_REGISTRY_DIR` | External registry directory | `~/.a2a/external` |
| `SYNAPSE_HISTORY_DB_PATH` | History database path | `~/.synapse/history/history.db` |
| `SYNAPSE_SKILLS_DIR` | Central skill store directory | `~/.synapse/skills` |

Deprecated key:
- `delegation` was removed in v0.3.19. Use `synapse send` for inter-agent communication.

**list.columns:**

Configure which columns to display in `synapse list`:

| Column | Description |
|--------|-------------|
| `ID` | Agent ID (e.g., `synapse-claude-8100`) |
| `NAME` | Custom name if set |
| `TYPE` | Agent type (claude, gemini, etc.) |
| `ROLE` | Role description |
| `STATUS` | READY/WAITING/PROCESSING/DONE/SHUTTING_DOWN |
| `CURRENT` | Current task preview |
| `TRANSPORT` | UDS/TCP communication status |
| `WORKING_DIR` | Working directory |
| `EDITING_FILE` | Currently locked file (requires file-safety) |

**approvalMode:**

| Value | Description |
|-------|-------------|
| `required` | Show approval prompt before sending initial instructions (default) |
| `auto` | Skip approval prompt, send instructions automatically |

## Instructions Management

Manage initial instructions sent to agents at startup.

```bash
# Show instruction content for an agent type
synapse instructions show claude
synapse instructions show gemini
synapse instructions show  # Shows default

# List instruction files used
synapse instructions files claude
# Output shows file locations:
#   - .synapse/default.md       (project directory)

# Send initial instructions to a running agent (useful after --resume)
synapse instructions send claude

# Preview what would be sent without actually sending
synapse instructions send claude --preview

# Send to specific agent ID
synapse instructions send synapse-claude-8100
```

**Use case:** If you started an agent with `--resume` (which skips initial instructions) and later need the A2A protocol information, use `synapse instructions send <agent>` to inject the instructions.

## Logs

View agent log output:

```bash
# Show last 50 lines of Claude logs
synapse logs claude

# Follow logs in real-time
synapse logs gemini -f

# Show last 100 lines
synapse logs codex -n 100
```

**Parameters:**
- `profile`: Agent profile name (claude, gemini, codex, opencode, copilot)
- `-f, --follow`: Follow log output in real-time (like `tail -f`)
- `-n, --lines`: Number of lines to show (default: 50)

Log files are stored in `~/.synapse/logs/`.

## External Agent Management

Connect to and manage external A2A-compatible agents accessible via HTTP/HTTPS.

### Add External Agent

```bash
# Discover and add by URL
synapse external add https://agent.example.com

# Add with custom alias
synapse external add https://agent.example.com --alias myagent
```

**Parameters:**
- `url`: Agent URL (must serve `/.well-known/agent.json`)
- `--alias, -a`: Short alias for the agent (auto-generated from name if not specified)

### List External Agents

```bash
synapse external list
```

Shows: ALIAS, NAME, URL, LAST SEEN.

### Show Agent Details

```bash
synapse external info myagent
```

Shows: Name, Alias, URL, Description, Added date, Last Seen, Capabilities, Skills.

### Send Message to External Agent

```bash
# Send message
synapse external send myagent "Analyze this data"

# Send and wait for completion
synapse external send myagent "Process this file" --wait
```

**Parameters:**
- `alias`: Agent alias
- `message`: Message to send
- `--wait, -w`: Wait for task completion

### Remove External Agent

```bash
synapse external remove myagent
```

External agents are stored persistently in `~/.a2a/external/`.

## Authentication

Manage API key authentication for secure A2A communication.

### Setup (Recommended)

```bash
synapse auth setup
```

Generates API key and admin key, then shows setup instructions including environment variable exports and curl examples.

### Generate API Key

```bash
# Generate a single key
synapse auth generate-key

# Generate multiple keys
synapse auth generate-key -n 3

# Output in export format
synapse auth generate-key -e
synapse auth generate-key -n 3 -e
```

**Parameters:**
- `-n, --count`: Number of keys to generate (default: 1)
- `-e, --export`: Output in `export SYNAPSE_API_KEYS=...` format

### Enable Authentication

```bash
export SYNAPSE_AUTH_ENABLED=true
export SYNAPSE_API_KEYS=<key>
export SYNAPSE_ADMIN_KEY=<admin_key>
synapse claude
```

### Reset Settings

```bash
# Interactive scope selection
synapse reset

# Reset specific scope
synapse reset --scope user
synapse reset --scope project
synapse reset --scope both

# Force reset without confirmation
synapse reset --scope both -f
```

**Parameters:**
- `--scope`: Which settings to reset (`user`, `project`, or `both`)
- `-f, --force`: Skip confirmation prompt

Resets `settings.json` to defaults and re-copies skills from `.claude` to `.agents`.

## Shared Task Board

Coordinate tasks across agents with dependency tracking.

```bash
# List all tasks
synapse tasks list

# Filter by status or agent
synapse tasks list --status pending
synapse tasks list --agent claude

# Create a task
synapse tasks create "Implement auth module" -d "OAuth2 flow with JWT tokens"

# Create with dependency (blocked until blocker completes)
synapse tasks create "Write integration tests" --blocked-by <task_id>

# Claim/assign a task
synapse tasks assign <task_id> claude

# Complete a task (auto-unblocks dependents)
synapse tasks complete <task_id>
```

**Storage:** `.synapse/task_board.db` (SQLite with WAL mode)

## Plan Approval

Review and approve agent plans before implementation.

```bash
# Approve a plan
synapse approve <task_id>

# Reject with reason
synapse reject <task_id> --reason "Use OAuth instead of JWT"
```

**Plan mode:** When `metadata.plan_mode = true` is set in a send request, the agent creates a plan without implementing.

## Team Start (Auto-Spawn Panes)

Start multiple agents in split terminal panes.

**Default behavior:** The 1st agent takes over the current terminal (handoff via `os.execvp`), and remaining agents start in new panes. Use `--all-new` to start all agents in new panes (current terminal stays).

Agent specs use `profile[:name[:role[:skill_set]]]` format. When extra fields are provided, `--no-setup` is added automatically.

```bash
# Default: claude=current terminal, gemini=new pane
synapse team start claude gemini

# With names, roles, and skill sets
synapse team start claude:Reviewer:code-review:reviewer gemini:Searcher

# All agents in new panes (current terminal remains)
synapse team start claude gemini --all-new

# Horizontal layout
synapse team start claude gemini --layout horizontal

# Pass tool-specific arguments after '--' (applied to all agents)
synapse team start claude gemini -- --dangerously-skip-permissions
```

**Supported terminals:** tmux, iTerm2, Terminal.app (tabs), zellij. Falls back to sequential start if unsupported.

### Team Start via A2A API

Agents can spawn teams programmatically via the `/team/start` endpoint:

```bash
curl -X POST http://localhost:8100/team/start \
  -H "Content-Type: application/json" \
  -d '{"agents": ["gemini", "codex"], "layout": "split"}'

# With tool_args (passed through to underlying CLI tool)
curl -X POST http://localhost:8100/team/start \
  -H "Content-Type: application/json" \
  -d '{"agents": ["gemini", "codex"], "tool_args": ["--dangerously-skip-permissions"]}'
```

### Spawn via A2A API

Agents can spawn other agents programmatically via the `/spawn` endpoint:

```bash
curl -X POST http://localhost:8100/spawn \
  -H "Content-Type: application/json" \
  -d '{"profile": "gemini", "name": "Helper"}'
# Response: {"agent_id": "synapse-gemini-8110", "port": 8110, "terminal_used": "tmux", "status": "submitted"}

# With tool_args
curl -X POST http://localhost:8100/spawn \
  -H "Content-Type: application/json" \
  -d '{"profile": "gemini", "tool_args": ["--dangerously-skip-permissions"]}'
```

## Skill Management

Manage skills across scopes with a central store (`~/.synapse/skills/`).

### Interactive TUI

```bash
synapse skills
```

### Non-Interactive Commands

```bash
# List and browse
synapse skills list                                # All scopes
synapse skills list --scope synapse                # Central store only
synapse skills show <name>                         # Skill details

# Manage
synapse skills delete <name> [--force]
synapse skills move <name> --to <scope>

# Central store operations
synapse skills import <name> [--from user|project] # Import to ~/.synapse/skills/
synapse skills deploy <name> --agent claude,codex --scope user  # Deploy from central store
synapse skills add <repo>                          # Install from repo (npx skills wrapper)
synapse skills create [--name <name>]              # Create new skill template

# Skill sets (named groups)
synapse skills set list
synapse skills set show <name>
```

**Skill Set in Initial Instructions:** When an agent starts with a skill set (via `--skill-set` or interactive selection), the skill set details (name, description, included skills) are automatically included in the agent's initial instructions. This allows the agent to understand its assigned capabilities.

### Skill Scopes

| Scope | Location | Description |
|-------|----------|-------------|
| **Synapse** | `~/.synapse/skills/` | Central store (deploy to agents from here) |
| **User** | `~/.claude/skills/`, `~/.agents/skills/` | User-wide skills |
| **Project** | `./.claude/skills/`, `./.agents/skills/` | Project-local skills |
| **Plugin** | `./plugins/*/skills/` | Read-only plugin skills |

### Agent Skill Directories

| Agent | Directory |
|-------|-----------|
| Claude | `.claude/skills/` |
| Codex | `.agents/skills/` |
| Gemini | `.gemini/skills/` |
| OpenCode | `.agents/skills/` |
| Copilot | `.agents/skills/` |

## Storage Locations

```text
~/.a2a/registry/     # Running agents (auto-cleaned)
~/.a2a/external/     # External A2A agents (persistent)
~/.synapse/skills/   # Central skill store
~/.synapse/          # User-level settings and logs
.synapse/            # Project-level settings
/tmp/synapse-a2a/    # Unix Domain Sockets (UDS) for inter-agent communication
```

**Note:** UDS socket location can be customized with `SYNAPSE_UDS_DIR` environment variable.
