---
title: Using with AI Agents
---

# Using with AI Agents

Secondary Terminal is designed to work seamlessly with CLI-based AI agents. It auto-detects running agents and optimizes the terminal experience for AI-assisted workflows.

## Supported Agents

| Agent | Detection | Status |
|-------|-----------|--------|
| **Claude Code** | Automatic on `claude` command | Real-time connection indicator |
| **Codex CLI** | Automatic on `codex` command | Real-time connection indicator |
| **Gemini CLI** | Automatic on `gemini` command (v0.28.2+) | Real-time connection indicator |
| **GitHub Copilot CLI** | Automatic on `copilot` or `gh copilot` command | Real-time connection indicator |

## How Detection Works

When you run a supported CLI agent, Secondary Terminal:

1. **Detects** the agent from terminal output using pattern matching
2. **Shows status** in the terminal header with a color-coded indicator
3. **Optimizes rendering** -- switches from 60fps to 250fps adaptive buffering for smooth AI streaming
4. **Monitors state** -- tracks whether the agent is active, idle, or disconnected

## File Reference Shortcuts

Quickly send file references to your AI agent:

| Action | Shortcut | Result |
|--------|----------|--------|
| Current file | `Ctrl+Alt+L` / `Cmd+Alt+L` | Inserts `@filename` with the current editor file path |
| All open files | `Ctrl+Alt+A` / `Cmd+Alt+A` | Inserts all open editor file paths |

## Image Paste (macOS)

On macOS, you can paste screenshots directly into Claude Code:

1. Take a screenshot (`Cmd+Shift+4`)
2. Focus the terminal with Claude Code running
3. Paste with `Cmd+V`

The image is sent directly to the AI agent.

## Agent Waiting Notifications

Get notified when an AI agent is waiting for your input:

| Setting | Default | Description |
|---------|---------|-------------|
| `agentWaitingNotification.enabled` | `true` | Enable/disable notifications |
| `agentWaitingNotification.soundFile` | - | Custom notification sound file path |
| `agentWaitingNotification.volume` | `50` | Sound volume (0-100) |
| `agentWaitingNotification.cooldownMs` | `5000` | Minimum time between notifications |

## Multi-Agent Workflows

Run different agents in different terminals:

1. Open terminal 1 -- run `claude`
2. Open terminal 2 -- run `gemini`
3. Switch between them with `Alt+1` / `Alt+2` (or `Cmd+Alt+1` / `Cmd+Alt+2` on Mac)

Each terminal independently tracks its agent status. Session persistence ensures you can pick up where you left off after restarting VS Code.

## GitHub Copilot Chat Integration

Activate GitHub Copilot Chat directly from the terminal:

- **Shortcut**: `Ctrl+K Ctrl+C` / `Cmd+K Cmd+C`
- **Setting**: `enableGitHubCopilotIntegration` (default: `true`)

This sends the current context to Copilot Chat in `#file:` format.

## Performance

AI agent rendering is optimized for high-throughput output:

| Metric | Standard | AI Agent Mode |
|--------|----------|---------------|
| Buffer flush interval | 16ms (60fps) | 4ms (250fps) |
| Rendering | Standard xterm.js | WebGL-accelerated with auto-fallback |
| Scrollback | 2,000 lines | 2,000 lines (configurable) |
