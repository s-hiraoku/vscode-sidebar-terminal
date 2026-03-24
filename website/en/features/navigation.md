---
title: Navigation
---

# Navigation

Secondary Terminal includes several navigation layers so you can move through terminals, command output, and split layouts without relying on the mouse. That includes find-in-terminal search, direct terminal focus shortcuts, previous and next terminal commands, and an opt-in Zellij-style panel navigation mode.

## Navigation Features

| Feature                    | Description                                                   |
| -------------------------- | ------------------------------------------------------------- |
| Find in terminal           | Search terminal output with text or regular expressions.      |
| Focus terminal view        | Jump directly into Secondary Terminal from the keyboard.      |
| Focus by index             | Use terminal number shortcuts for fast switching.             |
| Previous and next terminal | Move across terminals without choosing a specific index.      |
| Panel navigation mode      | Use `Ctrl+P` plus `h/j/k/l` or arrows to move between splits. |

## Search in Terminal

Find-in-terminal behaves like you would expect in a serious terminal workflow.

| Action               | Shortcut           | Notes                                                         |
| -------------------- | ------------------ | ------------------------------------------------------------- |
| Open search          | `Ctrl+F` / `Cmd+F` | Focuses the terminal search UI.                               |
| Regex search         | Search option      | Useful for filenames, test names, or repeated prompt markers. |
| Search across output | Terminal buffer    | Works on the visible terminal history.                        |

This is especially effective when you are searching for specific commands, stack traces, or model responses in a long AI session.

## Focus and Switching Shortcuts

| Action                     | Shortcut                                |
| -------------------------- | --------------------------------------- |
| Focus Secondary Terminal   | ``Ctrl+` ``                             |
| Focus terminal 1-5         | `Alt+1..5` or `Cmd+Alt+1..5` on macOS   |
| Focus next terminal        | `Alt+Right` or `Alt+Cmd+Right` on macOS |
| Focus previous terminal    | `Alt+Left` or `Alt+Cmd+Left` on macOS   |
| Scroll to previous command | `Ctrl+Up` or `Cmd+Up` on macOS          |
| Scroll to next command     | `Ctrl+Down` or `Cmd+Down` on macOS      |

## Zellij-Style Panel Navigation Mode

Panel navigation mode is disabled by default to avoid conflicts with terminal multiplexers like zellij, tmux, or screen. When enabled, it gives you a dedicated keyboard layer for switching between split terminals.

| Setting                                         | Default | Description                                     |
| ----------------------------------------------- | ------- | ----------------------------------------------- |
| `secondaryTerminal.panelNavigation.enabled`     | `false` | Enables the dedicated panel navigation mode.    |
| `secondaryTerminal.navigation.enabled`          | `true`  | Enables general terminal navigation features.   |
| `secondaryTerminal.navigation.showCommandMarks` | `true`  | Shows command boundaries for easier navigation. |

### Panel Navigation Shortcuts

| Key                 | Result                              |
| ------------------- | ----------------------------------- |
| `Ctrl+P`            | Enter or exit panel navigation mode |
| `h` or `ArrowLeft`  | Focus previous terminal             |
| `j` or `ArrowDown`  | Focus next terminal                 |
| `k` or `ArrowUp`    | Focus previous terminal             |
| `l` or `ArrowRight` | Focus next terminal                 |
| `r` or `d`          | Create a new terminal               |
| `x`                 | Close the current terminal          |
| `Escape`            | Exit panel navigation mode          |

Example setup:

```json
{
  "secondaryTerminal.panelNavigation.enabled": true,
  "secondaryTerminal.navigation.enabled": true,
  "secondaryTerminal.navigation.showCommandMarks": true
}
```

## When This Matters Most

Navigation features save the most time when:

- you keep several terminals open all day
- you work in split view
- you need to search long AI or test logs quickly
- you prefer keyboard-first workflows

## Related Pages

- [Split View](/en/features/split-view)
- [Shell Integration](/en/features/shell-integration)
- [Terminal Management](/en/features/terminal-management)
- [Quick Start](/en/guide/quick-start)
