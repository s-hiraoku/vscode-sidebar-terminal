# Spawning Reference

Spawning is sub-agent delegation. The parent spawns child agents to offload subtasks, preserving its own context window for the main task. The parent always owns the full lifecycle: **spawn, send task, evaluate result, kill**.

## Why Spawn

- **Context preservation** -- offloading a subtask keeps the parent's context window focused on the primary goal.
- **Parallel execution** -- independent subtasks run simultaneously, cutting total wall-clock time.
- **Specialist precision** -- a dedicated role (e.g., "test writer") produces higher-quality results than a generalist handling everything.

## When to Spawn vs. Reuse

| Situation | Action | Why |
|-----------|--------|-----|
| Task is small or within your expertise | **Do it yourself** | No overhead, fastest path |
| Another agent is already running and READY | **`synapse send` to existing agent** | Reusing avoids startup cost, instruction injection, and readiness wait |
| Task is large and would consume your context | **`synapse spawn` a new agent** | Offloads work so your context stays clean |
| Task has independent parallel subtasks | **`synapse spawn` N agents** | Each agent focuses on one subtask; total time is max(subtask times) instead of sum |

**Rule of thumb:** Spawn when delegating would be faster, more precise, or prevent your context from being consumed by a large subtask.

## How Many Agents

1. **User-specified count** -- follow it exactly (top priority).
2. **No user specification** -- the parent analyzes the task and decides:
   - Single focused subtask: 1 agent.
   - Independent parallel subtasks: N specialists (one per subtask).
   - The parent assigns a name and role to each spawned agent.

## Spawn Lifecycle

```
Parent receives task
  |
  +-- User-specified agent count? --> Use that count ----+
  |                                                      |
  +-- No specification? --> Parent decides count & roles-+
                                                         |
                                                         v
                                                   spawn child(ren)
                                                         |
                                                         v
                                                   send task  <-----------+
                                                         |                |
                                                         v                |
                                                   evaluate result        |
                                                         |                |
                                                   +- Sufficient? -> kill |
                                                   |                      |
                                                   +- Insufficient? ------+
```

### Basic Example

```bash
# 1. Spawn a helper
synapse spawn gemini --name Tester --role "test writer"

# 2. Poll for readiness (synapse list is a point-in-time snapshot, so poll until READY)
elapsed=0
while ! synapse list | grep -q "Tester.*READY"; do
  sleep 1; elapsed=$((elapsed + 1))
  [ "$elapsed" -ge 30 ] && echo "ERROR: Tester not READY after ${elapsed}s" >&2 && exit 1
done

# 3. Send the task (--wait blocks until the agent replies)
synapse send Tester "Write unit tests for src/auth.py" --wait

# 4. Evaluate the result -- if insufficient, refine (do NOT kill and re-spawn)
synapse send Tester "Add edge-case tests for expired tokens" --wait

# 5. Kill when done -- frees ports, memory, PTY sessions, and prevents orphaned agents
synapse kill Tester -f
```

`$SYNAPSE_AGENT_ID` is set automatically by Synapse at startup (e.g., `synapse-claude-8100`). The `--from` flag is auto-detected from this env var, so you can usually omit it.

### Evaluating Results

After receiving a `--wait` reply from a spawned agent:

1. **Read the reply content** -- does it address what you asked?
2. **Verify artifacts if needed** -- run `git diff`, `pytest`, or read modified files to confirm the work.
3. **Decide next step:**
   - Result is sufficient: `synapse kill <child> -f`
   - Result is insufficient: re-send with refined instructions (do NOT kill and re-spawn; the agent retains context from the previous attempt)

### Mandatory Cleanup

Killing spawned agents after completion frees ports, memory, and PTY sessions, and prevents orphaned agents from accidentally accepting future tasks.

```bash
synapse kill <spawned-agent-name> -f
synapse list  # Verify the agent is gone
```

## Permission Skip Flags (per CLI)

Each CLI has its own flag to skip interactive permission prompts. These are passed as tool args after `--` because they are forwarded to the underlying CLI, not consumed by Synapse itself.

**Recommended default:** When using `synapse spawn` or `synapse team start`,
include the relevant approval-skip flag unless you explicitly want an
interactive approval flow. Spawned agents are normally used unattended, so
approval-skipping should be the default operating mode.

| CLI | Flag | Notes |
|-----|------|-------|
| **Claude Code** | `--dangerously-skip-permissions` | Skips all permission prompts |
| **Gemini CLI** | `--approval-mode=yolo` | Yolo mode -- auto-approve all actions |
| **Codex CLI** | `--full-auto` | Sandboxed auto-approve (`-a on-request --sandbox workspace-write`) |
| **OpenCode** | *(no flag)* | No auto-approve flag available |
| **Copilot CLI** | `--allow-all-tools` | Allow all tools without prompts |

```bash
# Spawn with permission skip
synapse spawn claude -- --dangerously-skip-permissions
synapse spawn gemini -- --approval-mode=yolo
synapse spawn codex -- --full-auto
synapse spawn copilot -- --allow-all-tools

# Team start with permission skip (flag applies to ALL agents, so keep teams homogeneous)
synapse team start claude claude -- --dangerously-skip-permissions
synapse team start gemini gemini -- --approval-mode=yolo
# For Codex full unrestricted mode: --dangerously-bypass-approvals-and-sandbox
```

## CLI and API

### CLI

```bash
synapse spawn claude                          # Spawn in new pane
synapse spawn gemini --port 8115              # Explicit port
synapse spawn claude --name Reviewer --role "code review" --skill-set dev-set
synapse spawn claude --terminal tmux          # Specific terminal
synapse spawn sharp-checker                   # Spawn by saved Agent ID
synapse spawn Claud                           # Spawn by saved agent display name
synapse spawn claude --worktree               # Spawn in isolated worktree
synapse spawn claude -w my-feature            # Named worktree
synapse spawn claude -- --dangerously-skip-permissions   # Tool args after '--'
synapse spawn gemini -- --approval-mode=yolo            # Gemini yolo mode
synapse spawn codex -- --full-auto                       # Codex sandboxed auto-approve
synapse spawn copilot -- --allow-all-tools               # Copilot allow all
```

### Spawn via API

Agents can spawn other agents programmatically via `POST /spawn`:

```jsonc
// Basic spawn
{"profile": "gemini", "name": "Helper", "skill_set": "dev-set", "tool_args": ["--approval-mode=yolo"]}

// With worktree isolation
{"profile": "gemini", "name": "Worker", "worktree": true}
{"profile": "claude", "name": "Worker", "worktree": "my-feature"}

// Claude with permission skip
{"profile": "claude", "name": "Worker", "tool_args": ["--dangerously-skip-permissions"]}

// Codex with auto-approve
{"profile": "codex", "name": "Coder", "tool_args": ["--full-auto"]}

// On failure: {"status": "failed", "reason": "..."}
// On success: {agent_id, port, terminal_used, status, worktree_path, worktree_branch, worktree_base_branch}
```

### Team Start

```bash
synapse team start claude gemini          # claude=current terminal, gemini=new pane
synapse team start claude gemini codex --layout horizontal
synapse team start claude gemini --all-new  # All agents in new panes
synapse team start claude gemini --worktree  # Each agent in its own worktree
synapse team start claude gemini codex -w my-feature  # Named prefix: my-feature-claude-0, etc.
synapse team start claude claude -- --dangerously-skip-permissions
```

Team Start via API (`POST /team/start`):

```jsonc
{"agents": ["gemini", "codex"], "layout": "split"}
{"agents": ["gemini", "gemini"], "tool_args": ["--approval-mode=yolo"]}
```

## Worktree Isolation

`--worktree` / `-w` is a **Synapse-level flag** that creates an isolated git worktree for each agent. It works for all agent types and is placed **before** `--` (not as a tool arg). Each worktree is created under `.synapse/worktrees/<name>/` with a branch named `worktree-<name>`.

### When to Use Worktrees

| Situation | Action |
|-----------|--------|
| Multiple agents may edit the same files | Use `--worktree` to avoid conflicts |
| Coordinator + Worker pattern (Worker edits code) | Worker gets `--worktree` |
| Read-only tasks (investigation, analysis, review) | Worktree not needed |
| Single agent working alone | Worktree not needed |

### Usage

```bash
# Auto-generated worktree name
synapse spawn claude --name Impl --role "implementer" --worktree
synapse spawn gemini --name Analyst --role "analyzer" -w

# Named worktree (creates .synapse/worktrees/feat-auth/ with branch worktree-feat-auth)
synapse spawn claude --name Impl --role "implementer" --worktree feat-auth

# Team start with worktree per agent
synapse team start claude gemini --worktree
synapse team start claude gemini codex -w my-feature
```

### Indicators and Environment

Agents running in worktrees show a `[WT]` prefix in the WORKING_DIR column of `synapse list`.

Environment variables set automatically for worktree agents:

| Variable | Description |
|----------|-------------|
| `SYNAPSE_WORKTREE_PATH` | Absolute path to the worktree directory |
| `SYNAPSE_WORKTREE_BRANCH` | Branch name of the worktree |
| `SYNAPSE_WORKTREE_BASE_BRANCH` | Base branch the worktree was created from (e.g., `origin/main`). Used for change detection during cleanup. Determined via 3-step fallback: `git symbolic-ref` -> `origin/main` -> `HEAD`. |

### Caveats

- `--worktree` is a Synapse flag -- place it **before** `--`. Placing it after `--` triggers a warning because it would be passed to the underlying CLI as a tool arg instead.
- `.gitignore`-listed files (`.env`, `.venv/`, `node_modules/`) are **not copied** to the worktree. Run `uv sync`, `npm install`, or copy `.env` manually if needed.
- On exit: worktrees with no uncommitted changes and no new commits (vs. the base branch) are auto-deleted; worktrees with changes prompt to keep or remove.
- `synapse kill` also handles worktree cleanup for killed agents.
- Consider adding `.synapse/worktrees/` to your `.gitignore` to prevent untracked worktree files from cluttering `git status`.

## Technical Notes

- **Headless mode:** `synapse spawn` and `synapse team start` always add `--no-setup --headless`, skipping interactive setup while keeping the A2A server and initial instructions active.
- **Readiness:** After spawning, Synapse waits for the agent to register and warns with concrete `synapse send` examples if not yet ready. At the HTTP level, a Readiness Gate blocks `/tasks/send` until the agent finishes initialization (returns HTTP 503 + `Retry-After: 5` if not ready within 30s).
- **Pane auto-close:** Spawned panes close automatically when the agent process terminates (tmux, zellij, iTerm2, Terminal.app, Ghostty).
- **Known limitation ([#237](https://github.com/s-hiraoku/synapse-a2a/issues/237)):** Spawned agents cannot use `synapse reply` (PTY injection does not register sender info). Use `synapse send <target> "message"` for bidirectional communication (`--from` is auto-detected).
