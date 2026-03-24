---
title: Split View
---

# Split View

Split view lets you keep multiple terminals visible in the sidebar or bottom panel at the same time. Secondary Terminal supports both vertical and horizontal layouts, drag-to-resize splitters, and automatic direction changes based on where the panel is shown.

## Overview

| Feature            | Behavior                                                                       |
| ------------------ | ------------------------------------------------------------------------------ |
| Vertical split     | Stacks terminals one above another.                                            |
| Horizontal split   | Places terminals side by side.                                                 |
| Dynamic direction  | Uses vertical splits in the sidebar and horizontal splits in the bottom panel. |
| Equal distribution | New or removed terminals are redistributed automatically.                      |
| Split resizing     | Drag splitters when `secondaryTerminal.enableSplitResize` is enabled.          |

## Basic Split Actions

| Action                        | Shortcut or command                               | Result                                          |
| ----------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| Split vertically              | `Cmd+\` on macOS, `Ctrl+Shift+5` on Windows/Linux | Creates another visible terminal in split view. |
| Split horizontally            | `secondaryTerminal.splitTerminalHorizontal`       | Opens a horizontal split directly.              |
| Create terminal in split mode | `secondaryTerminal.createTerminal`                | Adds another terminal and redistributes layout. |
| Close current split           | `secondaryTerminal.killTerminal`                  | Remaining splits resize automatically.          |

## How Layout Direction Works

Secondary Terminal exposes two related controls:

| Setting                                   | Default  | Description                                               |
| ----------------------------------------- | -------- | --------------------------------------------------------- |
| `secondaryTerminal.dynamicSplitDirection` | `true`   | Automatically switches direction based on panel location. |
| `secondaryTerminal.panelLocation`         | `"auto"` | Uses auto detection, or forces sidebar or panel behavior. |
| `secondaryTerminal.maxSplitTerminals`     | `10`     | Caps how many terminals are shown at once in split view.  |
| `secondaryTerminal.minTerminalHeight`     | `100`    | Keeps each split usable in compact layouts.               |
| `secondaryTerminal.enableSplitResize`     | `true`   | Enables draggable splitters between terminals.            |

If you keep the terminal in the VS Code sidebar, vertical splits usually make better use of space. If you move it to the bottom panel, horizontal splits give each terminal more lines and preserve command readability.

## Recommended Settings

```json
{
  "secondaryTerminal.dynamicSplitDirection": true,
  "secondaryTerminal.panelLocation": "auto",
  "secondaryTerminal.maxSplitTerminals": 5,
  "secondaryTerminal.minTerminalHeight": 120,
  "secondaryTerminal.enableSplitResize": true
}
```

## What Happens When You Add or Remove Splits

Split view keeps visible terminals evenly distributed by default. When you add a terminal, the layout refreshes and every visible terminal gets a smaller share of the available space. When you close one, the remaining terminals expand again.

Typical examples:

```text
2 terminals -> 50% / 50%
3 terminals -> 33.33% / 33.33% / 33.33%
4 terminals -> 25% each
10 terminals -> 10% each
```

This matters because the extension is designed so that no terminal should silently disappear when you create another one. The layout updates immediately, including after tab reordering.

## Fullscreen and Split Transitions

If you are temporarily focused on one terminal in fullscreen mode and then create another terminal, Secondary Terminal first restores the existing visible set and then adds the new split. That keeps the layout predictable instead of hiding terminals in the background.

## Drag-to-Resize

When `secondaryTerminal.enableSplitResize` is on, you can drag splitters between terminals to make one panel larger. This is useful when one terminal is monitoring logs and another is only used for quick commands.

Resize behavior is especially helpful when:

- one terminal is showing wide output like test failures
- one AI agent is streaming long responses
- you want a narrow helper shell next to a larger primary shell

## Maximum Visible Splits

You can keep up to 10 terminals open overall, but `secondaryTerminal.maxSplitTerminals` controls how many are allowed in the split layout. If your workflow gets visually crowded, lower this value so the extension stays readable in narrow sidebars.

## Best Practices

| Situation                     | Recommendation                                                             |
| ----------------------------- | -------------------------------------------------------------------------- |
| Narrow sidebar                | Prefer vertical splits and keep `maxSplitTerminals` low.                   |
| Bottom panel layout           | Use dynamic direction or force horizontal splits.                          |
| Mixed shell and AI agent work | Keep one larger split for streaming output and smaller splits for helpers. |
| Frequent layout changes       | Leave split resize enabled so you can rebalance quickly.                   |

## Related Pages

- [Terminal Management](/features/terminal-management)
- [Navigation](/features/navigation)
- [Quick Start](/guide/quick-start)
- [Using with AI Agents](/guide/ai-agents)
