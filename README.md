# Secondary Terminal - VS Code Extension

[![Version](https://img.shields.io/visual-studio-marketplace/v/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Open VSX](https://img.shields.io/open-vsx/v/s-hiraoku/vscode-sidebar-terminal)](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
[![License](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![Ask DeepWiki](https://img.shields.io/badge/Ask-DeepWiki-blue)](https://deepwiki.com/s-hiraoku/vscode-sidebar-terminal)

**English** | [日本語](README.ja.md) | [中文](README.zh-CN.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

Your sidebar, your terminal, your AI agents -- all in one place. A full-featured terminal that lives in the VS Code sidebar, with built-in AI agent detection for Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI.

![Demo](resources/readme-hero.png)

## Why Secondary Terminal?

- **Sidebar-native terminal** -- Keep your terminal visible while editing. No more toggling the bottom panel.
- **AI agent aware** -- Auto-detects Claude Code, Copilot, Gemini, Codex. Shows real-time connection status and optimizes rendering for AI streaming output (up to 250fps).
- **Full-featured** -- Split views, session persistence, shell integration, find-in-terminal, command decorations, 89 configurable settings. Not a toy -- a production terminal.

## Quick Start

1. **Install**: Search "Secondary Terminal" in the VS Code Extensions view
   - Also available on [Open VSX](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal) (VSCodium, Gitpod) and via [CLI](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal): `code --install-extension s-hiraoku.vscode-sidebar-terminal`
2. **Open**: Click the terminal icon (ST) in the activity bar
3. **Use**: A terminal opens with your default shell. Run `claude`, `codex`, `gemini`, or `gh copilot` and watch the AI agent status appear in the header.

## Feature Highlights

### For AI Agent Workflows

|                         |                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| **Auto-detection**      | Real-time status indicators for Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI                  |
| **File references**     | `Cmd+Alt+L` / `Ctrl+Alt+L` inserts current file path; `Cmd+Alt+A` / `Ctrl+Alt+A` inserts all open files |
| **Image paste**         | `Cmd+V` on macOS pastes screenshots directly into Claude Code                                           |
| **Optimized rendering** | 250fps adaptive buffering for AI streaming output                                                       |
| **Session persistence** | Terminal state survives VS Code restarts -- pick up where you left off                                  |
| **Multi-agent**         | Run different agents in different terminals, switch with `Cmd+Alt+1..5` / `Alt+1..5`                    |

### Terminal Power Features

|                            |                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------- |
| **Multiple terminals**     | Up to 10 concurrent terminals with tab management (drag & drop reordering, double-click to rename) |
| **Split views**            | Vertical / horizontal splitting with drag-to-resize                              |
| **Session persistence**    | Auto-save/restore with ANSI color preservation, terminal names, and header indicator colors |
| **Shell integration**      | Command status indicators, working directory display, command history            |
| **Find in terminal**       | `Ctrl+F` / `Cmd+F` -- search through terminal output with regex support          |
| **Command decorations**    | Visual success/error/running indicators at command boundaries                    |
| **Navigation marks**       | Jump between commands with `Cmd+Up/Down` / `Ctrl+Up/Down`                        |
| **Scrollback compression** | Compressed storage with progressive loading for large histories                  |
| **Terminal profiles**      | Per-platform shell profiles (bash, zsh, fish, PowerShell, etc.)                  |

### Developer Experience

|                      |                                                                        |
| -------------------- | ---------------------------------------------------------------------- |
| **Full IME support** | Japanese, Chinese, Korean input with VS Code standard handling         |
| **Link detection**   | File paths open in VS Code, URLs open in browser, email links detected |
| **Alt+Click**        | VS Code-standard cursor positioning                                    |
| **Mouse tracking**   | TUI app support (vim, htop, zellij) with automatic mouse mode          |
| **Full clipboard**   | Ctrl/Cmd+C/V with image paste support                                  |
| **Cross-platform**   | Windows, macOS, Linux -- 9 platform-specific builds                    |
| **Accessibility**    | Screen reader support                                                  |
| **Debug panel**      | Real-time monitoring with `Ctrl+Shift+D`                               |

## Keyboard Shortcuts

| Shortcut                                      | Action                                              |
| --------------------------------------------- | --------------------------------------------------- |
| `Cmd+C` / `Ctrl+C`                            | Copy selected text (or send SIGINT if no selection) |
| `Cmd+V` / `Ctrl+V`                            | Paste (text and images)                             |
| `Shift+Enter` / `Option+Enter`                | Insert newline (Claude Code multiline prompts)      |
| `Cmd+Alt+L` / `Ctrl+Alt+L`                    | Insert current file reference for AI agents         |
| `Cmd+Alt+A` / `Ctrl+Alt+A`                    | Insert all open files references for AI agents      |
| `Cmd+K Cmd+C` / `Ctrl+K Ctrl+C`               | Activate GitHub Copilot Chat                        |
| ``Ctrl+` ``                                   | Focus Secondary Terminal view                       |
| ``Ctrl+Shift+` ``                             | Create new terminal                                 |
| `Cmd+\` (Mac) / `Ctrl+Shift+5`                | Split terminal vertically                           |
| `Cmd+K` / `Ctrl+K`                            | Clear terminal                                      |
| `Cmd+Up/Down` (Mac) / `Ctrl+Up/Down`          | Scroll to previous/next command                     |
| `Alt+Cmd+Left/Right` (Mac) / `Alt+Left/Right` | Focus previous/next terminal                        |
| `Cmd+Alt+1..5` (Mac) / `Alt+1..5`             | Focus terminal by index                             |
| `Cmd+R` / `Ctrl+R`                            | Run recent command                                  |
| `Cmd+A` / `Ctrl+A`                            | Select all terminal content                         |
| `Ctrl+Shift+D`                                | Toggle debug panel                                  |

> **Claude Code tips**:
>
> - `Cmd+V` on macOS pastes both text and images (screenshots) into Claude Code
> - Use `Shift+Enter` or `Option+Enter` to insert newlines for multiline prompts

## Configuration

The extension has 89 settings. Here are the most impactful ones to customize:

```json
{
  // Appearance
  "secondaryTerminal.fontSize": 12,
  "secondaryTerminal.fontFamily": "monospace",
  "secondaryTerminal.cursorStyle": "block",
  "secondaryTerminal.scrollback": 2000,

  // AI agent integration
  "secondaryTerminal.enableCliAgentIntegration": true,

  // Session persistence
  "secondaryTerminal.enablePersistentSessions": true,
  "secondaryTerminal.persistentSessionScrollback": 1000,

  // Split view
  "secondaryTerminal.maxSplitTerminals": 5,
  "secondaryTerminal.dynamicSplitDirection": true,

  // Shell integration
  "secondaryTerminal.shellIntegration.enabled": true,
  "secondaryTerminal.shellIntegration.showCommandStatus": true
}
```

Search `secondaryTerminal` in VS Code Settings for the full list, or see [package.json](package.json) for all defaults.

## Performance

| Metric                 | Value                                                  |
| ---------------------- | ------------------------------------------------------ |
| **Rendering**          | WebGL with auto DOM fallback                           |
| **Output buffering**   | Adaptive 2-16ms intervals (up to 250fps for AI output) |
| **Scrollback restore** | <1s for 1,000 lines with ANSI color preservation       |
| **Terminal disposal**  | <100ms cleanup time                                    |
| **Build size**         | ~790 KiB extension + ~1.5 MiB webview                  |

## Troubleshooting

### Terminal not starting

- Check `secondaryTerminal.shell` points to a valid shell in your PATH
- Try setting an explicit shell path

### AI agent not detected

- Ensure `secondaryTerminal.enableCliAgentIntegration` is `true`
- Check debug panel (`Ctrl+Shift+D`) for detection logs

### Performance issues

- Reduce `secondaryTerminal.scrollback` value
- Check system resources via the debug panel

### Session not restoring

- Verify `secondaryTerminal.enablePersistentSessions` is `true`
- Use "Clear Corrupted Terminal History" command if data is corrupted

### TUI display issues

- Mouse tracking is automatically enabled for apps like zellij
- If display issues occur in split mode, try switching to fullscreen mode

## Known Limitations

- **Running processes**: Long-running processes terminate on VS Code restart (scrollback preserved). Use `tmux`/`screen` for process persistence.
- **Platform support**: Alpine Linux and Linux armhf are not supported due to node-pty prebuilt binary limitations.

## Development

```bash
npm install && npm run compile    # Build
npm test                          # 3,800+ unit tests
npm run test:e2e                  # E2E tests (Playwright)
npm run watch                     # Watch mode
```

Quality: TypeScript strict mode, TDD workflow, 3,800+ unit tests, E2E coverage with Playwright, 9-platform CI/CD builds.

## Privacy

This extension respects VS Code's telemetry settings. We collect only anonymous usage metrics (feature usage, error rates) -- never terminal content, file paths, or personal data.

To disable: Set `telemetry.telemetryLevel` to `"off"` in VS Code settings. See [PRIVACY.md](PRIVACY.md) for details.

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Follow TDD practices
4. Run quality checks: `npm run pre-release:check`
5. Submit pull request

See [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues) for open tasks.

## Links

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
- [Open VSX Registry](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
- [GitHub Repository](https://github.com/s-hiraoku/vscode-sidebar-terminal)
- [Changelog](CHANGELOG.md)
- [Blog Article (Japanese)](https://zenn.dev/hiraoku/articles/0de654620028a0)

## License

MIT License - see [LICENSE](LICENSE) file.

---

**Built for VS Code developers working with AI agents**
