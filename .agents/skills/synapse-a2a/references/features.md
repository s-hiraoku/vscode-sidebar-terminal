# Features Reference

## Session Save/Restore

Save running team configurations as named JSON snapshots and restore them later.

Captures each agent's profile, name, role, skill set, worktree setting, and `session_id` (CLI conversation identifier).

**Scopes:** project (`.synapse/sessions/`), user (`~/.synapse/sessions/`), or `--workdir DIR` (`DIR/.synapse/sessions/`).

Restore spawns all agents from the snapshot via `spawn_agent()`. Use `--resume` to resume each agent's previous CLI session (conversation history); if resume fails within 10 seconds, the agent is retried without resume args (shell-level fallback).

```bash
synapse session save <name> [--project|--user|--workdir <dir>]
synapse session list [--project|--user|--workdir <dir>]
synapse session show <name> [--project|--user|--workdir <dir>]
synapse session restore <name> [--project|--user|--workdir <dir>] [--worktree] [--resume] [-- tool_args...]
synapse session delete <name> [--project|--user|--workdir <dir>] [--force]
synapse session sessions                       # List CLI tool sessions from filesystem
synapse session sessions --profile claude      # Filter by profile
synapse session sessions --limit 10            # Limit results
```

## Workflow Definitions

Define multi-step agent workflows as YAML files. Each step targets an agent with a message, priority, and response mode.

**Storage:** `.synapse/workflows/` (project) or `~/.synapse/workflows/` (user).

```bash
synapse workflow create <name> [--project|--user] [--force]     # Create workflow template YAML
synapse workflow list [--project|--user]                        # List saved workflows
synapse workflow show <name> [--project|--user]                 # Show workflow details
synapse workflow run <name> [--project|--user] [--dry-run] [--continue-on-error]  # Execute steps
synapse workflow delete <name> [--project|--user] [--force]    # Delete a saved workflow
```

Supports `--dry-run` to preview execution without sending messages, and `--continue-on-error` to proceed past step failures.

## Saved Agent Definitions

Persist reusable agent definitions with `synapse agents`. Stored as `.agent` files in project or user scope.

Use `--agent`/`-A` flag to start from a saved definition (e.g., `synapse claude --agent calm-lead`), or pass the saved ID/name directly to `synapse spawn`.

```bash
synapse agents list                       # List saved agent definitions
synapse agents show <id_or_name>          # Show details for a saved agent
synapse agents add <id> --name <name> --profile <profile> [--role <role>] [--skill-set <set>] [--scope project|user]
synapse agents delete <id_or_name>        # Delete a saved agent by ID or name
```

**Storage:** `.synapse/agents/` (project scope), `~/.synapse/agents/` (user scope).

## Token/Cost Tracking

`synapse history stats` shows a TOKEN USAGE section when token data exists. Token parsing is implemented via a registry pattern (`TokenUsage` dataclass + `parse_tokens()` registry).

```bash
synapse history stats                     # Overall stats with token usage
synapse history stats --agent gemini      # Per-agent token stats
```

## Skills Management

Central skill store with deploy, import, create, and skill set support. Skill set details (name, description, skills) are included in agent initial instructions when selected.

```bash
synapse skills                            # Interactive TUI skill manager
synapse skills list                       # List all discovered skills
synapse skills list --scope synapse       # List central store skills only
synapse skills show <name>                # Show skill details
synapse skills delete <name> [--force]    # Delete a skill
synapse skills move <name> --to <scope>   # Move skill between scopes
synapse skills deploy <name> --agent claude,codex --scope user  # Deploy from central store
synapse skills import <name>              # Import to central store (~/.synapse/skills/)
synapse skills add <repo>                 # Install from repo (npx skills wrapper)
synapse skills create [name]              # Create new skill template
synapse skills set list                   # List skill sets
synapse skills set show <name>            # Show skill set details
synapse skills apply <target> <set_name>        # Apply skill set to running agent
synapse skills apply <target> <set_name> --dry-run  # Preview changes only
```

**Storage:** `~/.synapse/skills/` (central/SYNAPSE scope).

## Settings Management

Configure Synapse via `settings.json` with interactive TUI or direct scope editing.

```bash
synapse config                            # Interactive config editor
synapse config --scope user               # Edit user settings directly
synapse config --scope project            # Edit project settings directly
synapse config show                       # Show merged settings (read-only)
synapse config show --scope user          # Show user settings only

synapse init                              # Interactive scope selection
synapse init --scope user                 # Create ~/.synapse/settings.json
synapse init --scope project              # Create ./.synapse/settings.json
synapse reset                             # Interactive scope selection
synapse reset --scope user                # Reset user settings to defaults
synapse reset --scope both -f             # Reset both without confirmation
```

Settings include `approvalMode` for controlling initial instruction approval behavior.

## Canvas Board

Shared visual dashboard for agents to post rich content cards rendered in a browser-based SPA.

**Views:** Hash-routed SPA with two views — `#/` (Canvas spotlight) and `#/dashboard` (grid + live feed + system panel). Navigation via header links; view state preserved across SSE reconnects.

**18 card formats:** mermaid, markdown, html, table, json, diff, code, chart, image, log, status, metric, checklist, timeline, alert, file-preview, trace, task-board.

**Rendering highlights:**
- **Code cards**: Syntax highlighted via highlight.js (set `--lang` for best results)
- **Chart cards**: Chart.js supports all chart types (bar, line, pie, doughnut, radar, polarArea, scatter, bubble)
- **Diff cards**: Side-by-side renderer with left (deletions) / right (additions) columns and line numbers
- **HTML cards**: Rendered in sandboxed iframe (`allow-scripts`) with auto-resize to content height
- **Image cards**: PNG, JPEG, SVG, GIF, WebP via URL or Base64 data URI (up to 2MB). SVG is ideal for agent-generated vector diagrams (architecture, network topology, data flow)

```bash
synapse canvas post <format> "<body>" --title "<title>" [--pinned] [--tags "t1,t2"]
synapse canvas open                      # Open in browser (auto-starts server)
synapse canvas list [--agent-id <id>] [--type <format>] [--search "<query>"]
```

**Storage:** `.synapse/canvas.db` (project-local, SQLite).
