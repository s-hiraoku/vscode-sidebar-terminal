---
title: Shell Integration
---

# Shell Integration

Shell integration gives Secondary Terminal more structure than a raw terminal stream. With it enabled, the extension can track command boundaries, show success or error state in the UI, display the current working directory in each header, and keep command history ready for quick reuse.

## What Shell Integration Adds

| Capability         | Description                                                         |
| ------------------ | ------------------------------------------------------------------- |
| Command status     | Shows success, error, or running state for the most recent command. |
| Working directory  | Displays the current folder in the terminal header.                 |
| Command history    | Tracks executed commands for fast reruns.                           |
| Command navigation | Lets you jump between command boundaries in the buffer.             |

## Main Settings

| Setting                                                   | Default | Description                                         |
| --------------------------------------------------------- | ------- | --------------------------------------------------- |
| `secondaryTerminal.enableShellIntegration`                | `true`  | Enables shell integration support.                  |
| `secondaryTerminal.shellIntegration.enabled`              | `true`  | Enables the VS Code shell integration bridge.       |
| `secondaryTerminal.shellIntegration.showCommandStatus`    | `true`  | Shows command result indicators in the header.      |
| `secondaryTerminal.shellIntegration.showWorkingDirectory` | `true`  | Shows the current directory in the terminal header. |
| `secondaryTerminal.shellIntegration.commandHistory`       | `true`  | Tracks command history for quick reuse.             |

## Status Indicators

When shell integration is active, the extension can tell whether a command is still running or whether it finished successfully or with an error.

| Status  | Meaning                                   |
| ------- | ----------------------------------------- |
| Running | The current command has not finished yet. |
| Success | The command exited cleanly.               |
| Error   | The command exited with a failure state.  |

These indicators are useful when you have several terminals open and only want to glance at which one needs attention.

## Working Directory in Headers

Header directory display helps when several terminals are attached to different parts of the same repository. For example, you can keep one terminal in `frontend`, another in `backend`, and a third at the repo root without running `pwd` just to reorient yourself.

This works best when `secondaryTerminal.shellIntegration.showWorkingDirectory` stays enabled.

## Scroll Between Commands

Secondary Terminal exposes command-aware navigation shortcuts that build on shell integration metadata.

| Action                     | Shortcut                                          |
| -------------------------- | ------------------------------------------------- |
| Scroll to previous command | `Cmd+Up` on macOS, `Ctrl+Up` on Windows/Linux     |
| Scroll to next command     | `Cmd+Down` on macOS, `Ctrl+Down` on Windows/Linux |
| Run recent command         | `Cmd+R` on macOS, `Ctrl+R` on Windows/Linux       |

These shortcuts are especially useful in long AI-assisted or build-heavy sessions where the buffer is large and plain scrolling is too slow.

## Rerunning Recent Commands

Use `secondaryTerminal.runRecentCommand` when you want to replay earlier commands without manually searching or copying them. This is helpful for repetitive workflows like:

- rerunning the same test target
- rebuilding a package after edits
- repeating git checks during review

## Decorations and Visual Feedback

Shell integration pairs well with command decorations:

| Setting                                             | Default     | Description                             |
| --------------------------------------------------- | ----------- | --------------------------------------- |
| `secondaryTerminal.decorations.enabled`             | `true`      | Enables visual command decorations.     |
| `secondaryTerminal.decorations.showInGutter`        | `true`      | Shows indicators in the gutter.         |
| `secondaryTerminal.decorations.showInOverviewRuler` | `true`      | Shows indicators in the overview ruler. |
| `secondaryTerminal.decorations.successColor`        | `"#00ff00"` | Color for successful commands.          |
| `secondaryTerminal.decorations.errorColor`          | `"#ff0000"` | Color for failed commands.              |
| `secondaryTerminal.decorations.runningColor`        | `"#ffff00"` | Color for running commands.             |

## Example Configuration

```json
{
  "secondaryTerminal.enableShellIntegration": true,
  "secondaryTerminal.shellIntegration.showCommandStatus": true,
  "secondaryTerminal.shellIntegration.showWorkingDirectory": true,
  "secondaryTerminal.shellIntegration.commandHistory": true,
  "secondaryTerminal.decorations.enabled": true
}
```

## Related Pages

- [Navigation](/features/navigation)
- [Session Persistence](/features/session-persistence)
- [Customization](/features/customization)
- [Quick Start](/guide/quick-start)
