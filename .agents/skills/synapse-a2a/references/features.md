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

## Proactive Mode

Enforces mandatory usage of all Synapse coordination features for every task, regardless of size.

**Activation:** `SYNAPSE_PROACTIVE_MODE_ENABLED=true synapse claude`

When enabled, the `.synapse/proactive.md` instruction file is injected at startup. It requires agents to follow a strict per-task checklist:

**Before work:** Register on task board, search shared memory, check available agents.
**During work:** Lock files before editing, save discoveries to memory, post artifacts to canvas, delegate subtasks.
**After work:** Unlock files, mark task complete, broadcast completion, post summary to canvas.

**Rules:**
- Never skip task board registration — even for 1-line fixes
- Always lock files before editing in multi-agent setups
- Always save useful findings to shared memory
- Always post significant artifacts to canvas
- For tasks with 2+ phases: delegate at least one phase to another agent
- For tasks touching 3+ files: use file-safety locks on all files

**Difference from default behavior:** Without proactive mode, the Collaboration Decision Framework in default instructions recommends feature usage but leaves it to agent judgment. With proactive mode, every step is mandatory and must be followed as a checklist.

**Configuration:** Toggle via `synapse config` TUI or set the environment variable directly.

## MCP Bootstrap Server

Distribute Synapse initial instructions via MCP (Model Context Protocol) resources and tools. MCP-compatible clients (Claude Code, Codex, Gemini CLI, OpenCode) can read instructions as structured resources instead of relying solely on PTY injection.

**Phase 1 (current):** Instruction resources + `bootstrap_agent` tool + automatic PTY skip + `analyze_task` Smart Suggest tool. `bootstrap_agent` returns runtime context and instruction resource URIs for the current agent. When a Synapse MCP server config entry is detected for Claude Code, Codex, Gemini CLI, or OpenCode, Synapse automatically skips PTY startup instruction injection. Non-Synapse MCP entries do not trigger the skip. Copilot supports MCP tools only (`bootstrap_agent`, `list_agents`, `analyze_task`) and cannot consume MCP resources/prompts.

**Resources:**

| URI | Description |
|-----|-------------|
| `synapse://instructions/default` | Base Synapse bootstrap instructions |
| `synapse://instructions/file-safety` | File locking rules (if enabled) |
| `synapse://instructions/shared-memory` | Shared memory conventions (if enabled) |
| `synapse://instructions/learning` | Learning mode guidance (if enabled) |
| `synapse://instructions/proactive` | Proactive mode instructions (if enabled) |

**Tools:**
- `bootstrap_agent` returns runtime context (agent_id, agent_type, port, working_dir, instruction_resources, available_features).
- `list_agents` lists running Synapse agents with status and connection info.
- `analyze_task` analyzes a user prompt and suggests team/task splits when the work is large enough (Smart Suggest).

```bash
# Start MCP server (stdio transport)
synapse mcp serve [--agent-id ID] [--agent-type TYPE] [--port PORT]

# Module entrypoint (recommended for MCP client configs)
python -m synapse.mcp --agent-id synapse-claude-8100 --agent-type claude --port 8100
```

**Client configuration:** Add to `.mcp.json` (Claude Code), `~/.codex/config.toml` (Codex), `~/.gemini/settings.json` (Gemini CLI), or `~/.config/opencode/opencode.json` (OpenCode). Use `uv run --directory <repo> python -m synapse.mcp` as the command to ensure the correct Synapse version is used.

**Copilot MCP support:** GitHub Copilot's coding agent supports MCP tools only and cannot consume MCP resources/prompts. Copilot agents use `bootstrap_agent` to retrieve runtime context and `analyze_task` for smart suggestions; the `synapse://instructions/*` resources are not available to Copilot.

**Settings caching:** The MCP server caches `SynapseSettings` as a lazy singleton for the lifetime of the process, avoiding repeated file reads.

## Canvas Board

Shared visual dashboard for agents to post rich content cards rendered in a browser-based SPA.

**Views:** Hash-routed SPA with five views — `#/` (Canvas spotlight), `#/dashboard` (operational overview with expandable summary+detail widgets: Agents, Tasks, File Locks, Worktrees, Memory, Errors), `#/history` (grid + live feed + agent messages), `#/system` (configuration panel: tips, saved agents, skills, skill sets, sessions, workflows, environment), and `#/admin` (Admin Command Center: clickable agent table for selection, textarea input with Cmd+Enter send, reply-based response via `synapse reply`, IME composition handling, sticky table headers). Navigation via sidebar (fixed on desktop, hamburger drawer on mobile); view state preserved across SSE reconnects.

**23 card formats:** mermaid, markdown, html, table, json, diff, code, chart, image, log, status, metric, checklist, timeline, alert, file-preview, trace, task-board, progress, terminal, dependency-graph, cost, link-preview.

**Rendering highlights:**
- **Markdown cards**: Enhanced parser supports headings, paragraphs, bold/italic, inline code, code blocks, unordered and ordered lists, tables, blockquotes, horizontal rules, and links. Document content uses Source Sans 3 body font and Source Code Pro monospace font for a polished typographic appearance
- **Code cards**: Syntax highlighted via highlight.js (set `--lang` for best results)
- **Chart cards**: Chart.js supports all chart types (bar, line, pie, doughnut, radar, polarArea, scatter, bubble)
- **Diff cards**: Side-by-side renderer with left (deletions) / right (additions) columns and line numbers
- **HTML cards**: Rendered in sandboxed iframe (`allow-scripts`) with theme sync via `postMessage` (CSS variables `--bg`, `--fg`, `--border`), auto-resize via ResizeObserver, dark mode background, and full document normalization (extracts `<head>`/`<body>` from complete HTML documents to avoid CSP/cascade conflicts)
- **Mermaid cards**: Diagrams auto-sync with the Canvas light/dark theme toggle; dark mode uses a Catppuccin-inspired palette, light mode uses an Indigo palette with brand accent `#4051b5`
- **Image cards**: PNG, JPEG, SVG, GIF, WebP via URL or Base64 data URI (up to 2MB). SVG is ideal for agent-generated vector diagrams (architecture, network topology, data flow)
- **Link-preview cards**: Fetches Open Graph metadata from a URL and renders a rich card with title, description, and thumbnail image
- **Task-board cards**: Expandable task cards with markdown-rendered descriptions; expand state persists across polling re-renders; view toggle tabs (Status|Group|Component) for grouped views

```bash
synapse canvas post <format> "<body>" --title "<title>" [--pinned] [--tags "t1,t2"]
synapse canvas link "<url>" --title "<title>" [--pinned]
synapse canvas briefing '<json>' --title "<title>" [--pinned]
synapse canvas briefing --file report.json --title "CI Report"
synapse canvas open                      # Open in browser (auto-starts server)
synapse canvas list [--agent-id <id>] [--type <format>] [--search "<query>"]
```

**Templates (6):** briefing, comparison, dashboard, steps, slides, plan. Templates control how composite content blocks are laid out. Use `synapse canvas briefing` for the briefing template CLI shortcut, `synapse canvas plan` for plan cards with Mermaid DAG and step tracking, or `synapse canvas post-raw` with `template`/`template_data` fields for any template. See `references/commands.md` for full schema details.

### Plan Cards

Plan cards combine a Mermaid DAG visualization with a step list for tracking multi-step work. Plans can be accepted into the task board and progress synced back.

```bash
synapse canvas plan '{"plan_id":"plan-auth","status":"proposed","mermaid":"graph TD; A-->B","steps":[{"id":"s1","subject":"Design","status":"pending"}]}' --title "Auth Plan"
synapse tasks accept-plan plan-auth              # Register steps as task board tasks
synapse tasks sync-plan plan-auth                # Sync task board progress back to plan card
```

**Storage:** `.synapse/canvas.db` (project-local, SQLite).
