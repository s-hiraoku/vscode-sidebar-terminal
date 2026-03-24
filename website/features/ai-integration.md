---
title: AI Integration
---

# AI Integration

Secondary Terminal is built for CLI-based AI workflows, not just general shell usage. It can detect supported agents automatically, show live status in each terminal header, render streaming output at high speed, and notify you when an agent is waiting for your response.

## Supported CLI Agents

| Agent              | Detection trigger | Notes                                                         |
| ------------------ | ----------------- | ------------------------------------------------------------- |
| Claude Code        | Run `claude`      | Works with file reference shortcuts and image paste on macOS. |
| Codex CLI          | Run `codex`       | Status appears in the terminal header automatically.          |
| Gemini CLI         | Run `gemini`      | Requires Gemini CLI `v0.28.2+` for supported detection.       |
| GitHub Copilot CLI | Run `copilot`  | Separate from Copilot Chat activation.                        |

## What Detection Changes

Once a supported CLI agent is detected, Secondary Terminal treats that terminal as an AI-aware workspace.

| Behavior                   | Why it matters                                                               |
| -------------------------- | ---------------------------------------------------------------------------- |
| Real-time status indicator | See whether the agent is connected, disconnected, or idle.                   |
| Fast rendering path        | Streaming responses render with adaptive buffering up to `250fps`.           |
| Waiting detection          | The extension can alert you when the agent is waiting for approval or input. |
| Message routing support    | The active agent terminal can be targeted reliably by related workflows.     |

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

## Waiting Notifications

When an agent stops to ask for confirmation or more input, Secondary Terminal can notify you with sound and toast messages.

| Setting                                                 | Default | Description                                                |
| ------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| `secondaryTerminal.agentWaitingNotification.enabled`    | `true`  | Plays a sound when a CLI agent is waiting.                 |
| `secondaryTerminal.agentWaitingNotification.soundFile`  | `""`    | Uses a custom sound file when provided.                    |
| `secondaryTerminal.agentWaitingNotification.volume`     | `50`    | Controls notification volume from `0` to `100`.            |
| `secondaryTerminal.agentWaitingNotification.cooldownMs` | `5000`  | Prevents repeated sound spam.                              |
| `secondaryTerminal.agentToastNotification.enabled`      | `true`  | Shows toast notifications for waiting or completion.       |
| `secondaryTerminal.agentToastNotification.cooldownMs`   | `10000` | Throttles repeated toasts.                                 |
| `secondaryTerminal.agentIdleDetection.timeoutMs`        | `3000`  | Idle time before the extension considers an agent waiting. |

Example configuration:

```json
{
  "secondaryTerminal.agentWaitingNotification.enabled": true,
  "secondaryTerminal.agentWaitingNotification.volume": 60,
  "secondaryTerminal.agentToastNotification.enabled": true,
  "secondaryTerminal.agentIdleDetection.timeoutMs": 3000
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
