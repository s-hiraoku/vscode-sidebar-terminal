---
title: Terminal Management
---

# Terminal Management

Secondary Terminal is built to manage several active workflows at once without pushing your terminal into the bottom panel. You can open up to 10 terminals, reorder them, rename them, choose different profiles, and control how aggressively the extension protects you from accidental closes.

## What You Can Do

| Capability         | What it means                                                                           |
| ------------------ | --------------------------------------------------------------------------------------- |
| Multiple terminals | Keep up to `10` terminals open at the same time with `secondaryTerminal.maxTerminals`.  |
| Tab management     | Switch from tabs, drag tabs to reorder them, and double-click a tab name to rename it.  |
| Profiles           | Pick platform-specific shell profiles when creating a terminal.                         |
| Safe closing       | Enable confirmations and keep the last terminal protected if you want a safer workflow. |

## Common Actions

| Action                   | Shortcut or command              | Notes                                      |
| ------------------------ | -------------------------------- | ------------------------------------------ |
| Focus Secondary Terminal | ``Ctrl+` ``                      | Opens or focuses the view.                 |
| Create new terminal      | ``Ctrl+Shift+` ``                | Also available from the header `+` button. |
| Close current terminal   | `secondaryTerminal.killTerminal` | Uses confirmation when enabled.            |
| Focus terminal 1-5       | `Alt+1..5`                       | On macOS, use `Cmd+Alt+1..5`.              |
| Focus next terminal      | `Alt+Right`                      | On macOS, use `Alt+Cmd+Right`.             |
| Focus previous terminal  | `Alt+Left`                       | On macOS, use `Alt+Cmd+Left`.              |

## Managing Multiple Terminals

The extension supports up to ten concurrent terminals. That is enough for a typical setup like one shell for your app, one for tests, one for git operations, and several more for AI agents or background tasks.

When more than one terminal is open, each terminal gets its own tab. The active tab stays highlighted, and the active terminal can also show a border depending on `secondaryTerminal.activeBorderMode`.

### Typical Multi-Terminal Setup

```text
Terminal 1: app server
Terminal 2: test runner
Terminal 3: git and release tasks
Terminal 4: claude
Terminal 5: codex
```

## Reordering and Renaming Tabs

Tab order is not fixed. Drag a tab to another position and the visible terminal order updates to match. This is useful when you want related terminals grouped together, especially in split view.

Double-click a tab to rename it. Rename tabs to reflect intent instead of shell defaults, for example `api`, `ui`, `release`, or `claude-review`.

## Working With Profiles

Secondary Terminal uses platform-specific profile settings so you can present the right shells in the terminal picker and choose a default one per operating system.

| Setting                                    | Default | Purpose                                         |
| ------------------------------------------ | ------- | ----------------------------------------------- |
| `secondaryTerminal.profiles.windows`       | `{}`    | Defines Windows profiles shown in the selector. |
| `secondaryTerminal.profiles.linux`         | `{}`    | Defines Linux profiles shown in the selector.   |
| `secondaryTerminal.profiles.osx`           | `{}`    | Defines macOS profiles shown in the selector.   |
| `secondaryTerminal.defaultProfile.windows` | `null`  | Selects a default Windows profile by name.      |
| `secondaryTerminal.defaultProfile.linux`   | `null`  | Selects a default Linux profile by name.        |
| `secondaryTerminal.defaultProfile.osx`     | `null`  | Selects a default macOS profile by name.        |

Example configuration:

```json
{
  "secondaryTerminal.defaultProfile.osx": "zsh",
  "secondaryTerminal.defaultProfile.linux": "fish",
  "secondaryTerminal.defaultProfile.windows": "PowerShell 7"
}
```

## Preventing Accidental Closes

If you regularly keep long-running terminals open, turn on the safety settings before you need them.

| Setting                                 | Default          | Description                                        |
| --------------------------------------- | ---------------- | -------------------------------------------------- |
| `secondaryTerminal.confirmBeforeKill`   | `false`          | Ask for confirmation before closing a terminal.    |
| `secondaryTerminal.protectLastTerminal` | `true`           | Prevent closing the final remaining terminal.      |
| `secondaryTerminal.minTerminalCount`    | `1`              | Keep at least this many terminals open.            |
| `secondaryTerminal.maxTerminals`        | `10`             | Hard limit for how many terminals you can create.  |
| `secondaryTerminal.activeBorderMode`    | `"multipleOnly"` | Controls when the active terminal border is shown. |

Safer defaults for shared or production-focused workspaces:

```json
{
  "secondaryTerminal.confirmBeforeKill": true,
  "secondaryTerminal.protectLastTerminal": true,
  "secondaryTerminal.minTerminalCount": 1
}
```

## When to Use This Feature

Terminal management matters most when you want the sidebar terminal to replace the bottom-panel workflow entirely. Instead of constantly opening, closing, and recreating shells, keep named terminals around and move between them quickly.

This is also the foundation for split view, AI workflows, and persistent sessions. Once your terminal layout is stable, the rest of the extension feels much closer to a dedicated workspace.

## Related Pages

- [Split View](/en/features/split-view)
- [Session Persistence](/en/features/session-persistence)
- [Using with AI Agents](/en/guide/ai-agents)
- [Quick Start](/en/guide/quick-start)
