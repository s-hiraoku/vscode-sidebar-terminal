---
title: Session Persistence
---

# Session Persistence

Session persistence keeps your terminal context available across VS Code restarts. Secondary Terminal can automatically save and restore scrollback, preserve ANSI color output, enforce storage limits, and give you manual commands for saving, restoring, or clearing saved state.

## What Gets Preserved

| Preserved data  | Details                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| Terminal output | Scrollback is stored and restored into the terminal view.                          |
| ANSI formatting | Color and formatting sequences are preserved instead of flattened into plain text. |
| Terminal state  | Session metadata is restored so the layout feels continuous.                       |
| Recent history  | Configurable scrollback limits prevent runaway storage usage.                      |

The extension focuses on output persistence, not process persistence. Long-running shells and commands do not keep running through a full VS Code restart, but the visible terminal history is still there when you come back.

## Core Settings

| Setting                                                      | Default                  | Description                                      |
| ------------------------------------------------------------ | ------------------------ | ------------------------------------------------ |
| `secondaryTerminal.enablePersistentSessions`                 | `true`                   | Enables session save and restore.                |
| `secondaryTerminal.persistentSessionScrollback`              | `1000`                   | Number of lines restored from history.           |
| `secondaryTerminal.persistentSessionReviveProcess`           | `"onExitAndWindowClose"` | Controls when sessions are saved.                |
| `secondaryTerminal.persistentSessionStorageLimit`            | `20`                     | Maximum storage size in MB.                      |
| `secondaryTerminal.persistentSessionRetentionDays`           | `7`                      | Retains saved sessions for one week by default.  |
| `secondaryTerminal.persistentSessionStorageWarningThreshold` | `80`                     | Warning threshold before optimization is needed. |

## Scrollback Storage Controls

Older compatibility settings are also available for scrollback-specific behavior:

| Setting                                                    | Default    | Description                                                 |
| ---------------------------------------------------------- | ---------- | ----------------------------------------------------------- |
| `secondaryTerminal.restoreScrollback`                      | `true`     | Restores terminal history buffer.                           |
| `secondaryTerminal.scrollbackLines`                        | `2000`     | Maximum lines restored from saved history.                  |
| `secondaryTerminal.scrollbackCompression`                  | `true`     | Compresses saved scrollback to reduce storage use.          |
| `secondaryTerminal.scrollbackProgressiveLoad`              | `false`    | Loads large histories progressively instead of all at once. |
| `secondaryTerminal.scrollbackMaxStorageSize`               | `20971520` | Maximum raw storage in bytes, about `20MB`.                 |
| `secondaryTerminal.features.enhancedScrollbackPersistence` | `true`     | Uses the more VS Code-like persistence path.                |
| `secondaryTerminal.features.scrollbackLineLimit`           | `1000`     | Caps enhanced persisted output.                             |
| `secondaryTerminal.features.fullANSISupport`               | `true`     | Preserves ANSI colors and formatting during restore.        |

## Recommended Configuration

```json
{
  "secondaryTerminal.enablePersistentSessions": true,
  "secondaryTerminal.persistentSessionScrollback": 1500,
  "secondaryTerminal.persistentSessionStorageLimit": 20,
  "secondaryTerminal.persistentSessionRetentionDays": 7,
  "secondaryTerminal.scrollbackCompression": true
}
```

## Manual Session Commands

If you want tighter control than auto-save, use the built-in commands.

| Command                                   | Purpose                                                     |
| ----------------------------------------- | ----------------------------------------------------------- |
| `secondaryTerminal.saveSession`           | Save the current terminal session explicitly.               |
| `secondaryTerminal.restoreSession`        | Restore a previously saved session.                         |
| `secondaryTerminal.clearSession`          | Clear the saved session for the current terminal.           |
| `secondaryTerminal.diagnoseSession`       | Inspect session-related data when debugging restore issues. |
| `secondaryTerminal.clearCorruptedHistory` | Remove damaged scrollback data and reset the saved history. |

## Storage Limits and Retention

The default storage limit is `20MB`, and the default retention window is `7` days. That is enough for normal terminal workflows, including ANSI-rich command output, without letting the extension accumulate large stale histories over time.

If your project produces extremely large output, lower the restored scrollback lines or enable progressive loading. If you want longer history retention, increase the limits carefully because more history means more startup work and larger extension storage.

## Good Use Cases

| Scenario               | Why persistence helps                                   |
| ---------------------- | ------------------------------------------------------- |
| Review-heavy workflows | Keep test output and diffs visible after restart.       |
| AI-assisted sessions   | Restore prior prompts and model responses.              |
| Long setup commands    | Avoid rerunning setup just to see what happened before. |
| Temporary restarts     | Pick up your context quickly after VS Code reloads.     |

## Related Pages

- [Terminal Management](/features/terminal-management)
- [Shell Integration](/features/shell-integration)
- [AI Integration](/features/ai-integration)
- [Quick Start](/guide/quick-start)
