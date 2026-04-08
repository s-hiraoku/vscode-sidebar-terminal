---
title: AI Integration
---

# AI Integration

Secondary Terminal is built for CLI-based AI workflows, not just general shell usage. It can detect supported agents automatically, show live status in each terminal header, render streaming output at high speed, and notify you when an agent completes processing.

## Supported CLI Agents

| Agent              | Detection trigger | Notes                                                         |
| ------------------ | ----------------- | ------------------------------------------------------------- |
| Claude Code        | Run `claude`      | Works with file reference shortcuts and image paste on macOS. |
| Codex CLI          | Run `codex`       | Status appears in the terminal header automatically.          |
| Gemini CLI         | Run `gemini`      | Requires Gemini CLI `v0.28.2+` for supported detection.       |
| GitHub Copilot CLI | Run `copilot`     | Separate from Copilot Chat activation.                        |

## What Detection Changes

Once a supported CLI agent is detected, Secondary Terminal treats that terminal as an AI-aware workspace.

| Behavior                   | Why it matters                                                           |
| -------------------------- | ------------------------------------------------------------------------ |
| Real-time status indicator | See whether the agent is connected, disconnected, or idle.               |
| Fast rendering path        | Streaming responses render with adaptive buffering up to `250fps`.       |
| Message routing support    | The active agent terminal can be targeted reliably by related workflows. |

## Agent Status Model

The extension distinguishes between actual runtime state and user intent. That means status changes only when an agent really starts or stops, not when you type an exit command.

| Status       | Meaning                                                               |
| ------------ | --------------------------------------------------------------------- |
| Connected    | This is the currently active CLI agent terminal.                      |
| Disconnected | The agent is still running, but another terminal is the active agent. |
| None         | No supported CLI agent is currently running in that terminal.         |

This is important if you keep several agents open at once. The most recently started supported agent becomes the active one, and older agents remain available as disconnected terminals instead of disappearing from the UI.

## Performance for Streaming Output

Secondary Terminal switches to a more aggressive render path for AI output:

| Metric                 | Standard terminal mode | AI-aware mode                     |
| ---------------------- | ---------------------- | --------------------------------- |
| Flush cadence          | ~`16ms`                | ~`4ms`                            |
| Approximate frame rate | ~`60fps`               | up to `250fps`                    |
| Rendering backend      | WebGL with fallback    | Same backend, tuned for streaming |

That reduces lag when an agent prints text continuously for several seconds.

## Completion Notifications

When an agent completes processing, Secondary Terminal can notify you with toast messages inside VS Code and OS-native desktop notifications.

| Setting                                               | Default | Description                                                |
| ----------------------------------------------------- | ------- | ---------------------------------------------------------- |
| `secondaryTerminal.agentToastNotification.enabled`    | `true`  | Shows toast notifications for completion.                  |
| `secondaryTerminal.agentToastNotification.cooldownMs` | `10000` | Throttles repeated toasts.                                 |
| `secondaryTerminal.nativeNotification.enabled`        | `true`  | Shows OS-native notifications for completion.              |
| `secondaryTerminal.nativeNotification.activateWindow` | `true`  | Optionally brings VS Code to the foreground on completion. |
| `secondaryTerminal.nativeNotification.cooldownMs`     | `10000` | Throttles repeated native notifications.                   |

Example configuration:

```json
{
  "secondaryTerminal.agentToastNotification.enabled": true,
  "secondaryTerminal.nativeNotification.enabled": true
}
```

## File and Context Shortcuts

| Action                | Shortcut                        | Result                                                |
| --------------------- | ------------------------------- | ----------------------------------------------------- |
| Insert current file   | `Ctrl+Alt+L` / `Cmd+Alt+L`      | Sends the active editor path into the terminal.       |
| Insert all open files | `Ctrl+Alt+A` / `Cmd+Alt+A`      | Sends all open editor paths.                          |
| Activate Copilot Chat | `Ctrl+K Ctrl+C` / `Cmd+K Cmd+C` | Opens GitHub Copilot Chat from the terminal workflow. |

These shortcuts are especially useful when your agent expects file paths in the prompt rather than direct editor integration.

## Recommended Agent Workflow

```sh
# Terminal 1
claude

# Terminal 2
codex

# Terminal 3
copilot
```

Use `Alt+1..5` or `Cmd+Alt+1..5` to jump between active terminals. The header indicators show which terminal currently owns the connected AI status.

## Related Pages

- [Input & Interaction](/features/input-interaction)
- [Session Persistence](/features/session-persistence)
- [Using with AI Agents](/guide/ai-agents)
- [Quick Start](/guide/quick-start)
