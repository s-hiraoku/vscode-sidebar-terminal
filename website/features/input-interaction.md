---
title: Input & Interaction
---

# Input & Interaction

Secondary Terminal is designed to behave like a serious editor-integrated terminal, not a simplified console widget. It supports normal clipboard flows, multilingual input through IME, precise cursor positioning, multiline prompts, and selection commands that matter in real development work.

## Input Features at a Glance

| Feature                      | Description                                                        |
| ---------------------------- | ------------------------------------------------------------------ |
| Full clipboard               | Copy and paste with familiar VS Code-style shortcuts.              |
| Image paste on macOS         | Paste screenshots directly into Claude Code with `Cmd+V`.          |
| Alt+Click cursor positioning | Move the shell cursor under the mouse when supported by the shell. |
| IME support                  | Handles Japanese, Chinese, and Korean composition correctly.       |
| Multiline input              | Insert a newline without immediately submitting the command.       |
| Select All                   | Select the whole terminal buffer for copying or review.            |

## Common Shortcuts

| Action                       | Shortcut           | Notes                                                       |
| ---------------------------- | ------------------ | ----------------------------------------------------------- |
| Copy                         | `Ctrl+C` / `Cmd+C` | Copies selection, or sends SIGINT when nothing is selected. |
| Paste                        | `Ctrl+V` / `Cmd+V` | Works with text, and images on supported macOS workflows.   |
| Insert newline               | `Shift+Enter`      | Useful for multiline prompts.                               |
| Alternative newline on macOS | `Option+Enter`     | Another way to add a line without submitting.               |
| Select all                   | `Ctrl+A` / `Cmd+A` | Selects the current terminal content.                       |

## Clipboard Behavior

Clipboard support is intended to match normal VS Code expectations as closely as possible. That means copying a selection should feel obvious, and pasting should not require special terminal-only shortcuts.

These behaviors are governed by the feature flag settings below:

| Setting                                              | Default | Description                                                       |
| ---------------------------------------------------- | ------- | ----------------------------------------------------------------- |
| `secondaryTerminal.features.vscodeKeyboardShortcuts` | `true`  | Enables VS Code-style copy, paste, and related keyboard behavior. |
| `secondaryTerminal.allowChords`                      | `true`  | Allows multi-key sequences like `Ctrl+K Ctrl+C`.                  |
| `secondaryTerminal.allowMnemonics`                   | `true`  | Preserves platform mnemonic behavior where applicable.            |
| `secondaryTerminal.sendKeybindingsToShell`           | `false` | Sends fewer workbench shortcuts straight to the shell.            |

## Image Paste for Claude Code on macOS

If you are running Claude Code, you can paste screenshots directly from the macOS clipboard into the terminal with `Cmd+V`. This is especially useful when an agent needs a UI screenshot, error dialog capture, or diagram snippet.

Typical workflow:

```text
1. Capture screenshot with Cmd+Shift+4
2. Focus the Secondary Terminal running claude
3. Press Cmd+V
4. Claude Code receives the pasted image
```

## Alt+Click Cursor Positioning

When `secondaryTerminal.altClickMovesCursor` is enabled, holding `Alt` on Windows/Linux or `Option` on macOS while clicking attempts to move the shell cursor to the clicked position.

| Setting                                 | Default | Description                                    |
| --------------------------------------- | ------- | ---------------------------------------------- |
| `secondaryTerminal.altClickMovesCursor` | `true`  | Enables Alt/Option-click cursor repositioning. |

This depends on shell behavior, so it may work better in some shells than others.

## IME Support

The extension includes explicit support for IME composition so developers using Japanese, Chinese, or Korean input methods are not forced into broken or partial terminal input behavior.

| Setting                                        | Default | Description                                 |
| ---------------------------------------------- | ------- | ------------------------------------------- |
| `secondaryTerminal.features.vscodeStandardIME` | `true`  | Uses VS Code-like IME composition handling. |

If you switch between English commands and multilingual natural language prompts, this setting matters a lot in AI workflows.

## Multiline Input

Multiline prompts are common when writing AI instructions, shell heredocs, SQL, or quick notes before execution. Secondary Terminal keeps this simple:

```text
Shift+Enter      -> insert a newline
Option+Enter     -> insert a newline on macOS
Enter            -> submit the command
```

This prevents accidental command submission while still keeping the shell responsive.

## Related Pages

- [AI Integration](/features/ai-integration)
- [Navigation](/features/navigation)
- [Using with AI Agents](/guide/ai-agents)
- [Quick Start](/guide/quick-start)
