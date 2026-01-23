# Secondary Terminal - VS Code Extension

[![Version](https://img.shields.io/visual-studio-marketplace/v/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Open VSX](https://img.shields.io/open-vsx/v/s-hiraoku/vscode-sidebar-terminal)](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
[![License](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![Ask DeepWiki](https://img.shields.io/badge/Ask-DeepWiki-blue)](https://deepwiki.com/s-hiraoku/vscode-sidebar-terminal)

**The Essential Tool for the CLI Coding Agent Era** - A production-ready terminal extension for developers who need more than VS Code's standard terminal. Manage up to 5 terminals in the sidebar with seamless AI agent integration for Claude Code, Codex CLI, Gemini CLI, and Copilot CLI.

> **Note**: This extension is under active development. Please expect some bugs as we continuously improve the experience.

![Secondary Terminal](resources/banner.png)

![Demo](resources/readme-hero.png)

## Quick Start

### Installation

1. **VS Code Marketplace**: Search "Secondary Terminal" in Extensions
2. **Open VSX** (VS Codium, Gitpod, etc.): Search "Secondary Terminal" or visit [Open VSX](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
3. **Command Line**: `code --install-extension s-hiraoku.vscode-sidebar-terminal`
4. **Manual**: Download VSIX from [releases](https://github.com/s-hiraoku/vscode-sidebar-terminal/releases)

### First Use

1. Click the terminal icon (ST) in the activity bar
2. A terminal opens automatically with your default shell
3. Run your AI agent: `claude`, `codex`, `gemini`, or `gh copilot`
4. Look for **"AI Agent Connected"** status in the terminal header

## Key Features

### Terminal Management

| Feature | Description |
|---------|-------------|
| **Multiple Terminals** | Up to 5 concurrent terminal instances |
| **Session Persistence** | Auto-save/restore sessions with configurable scrollback (up to 3,000 lines) |
| **Split Views** | Vertical/horizontal splitting with drag-to-resize |
| **Tab Management** | Drag & drop reordering (synced with split view), close buttons |
| **Terminal Profiles** | Support for custom shell profiles per platform |
| **Cross-Platform** | Windows, macOS, and Linux support |

### AI Agent Integration

Automatic detection and status tracking for:

- **Claude Code** - Anthropic's AI coding assistant
- **Codex CLI** - OpenAI's command-line tool
- **Gemini CLI** - Google's AI assistant
- **GitHub Copilot CLI** - GitHub's AI pair programmer
- **CodeRabbit CLI** - AI code review tool

**Features:**

- Real-time connection status indicators
- File reference sharing with `Cmd+Alt+L` (Mac) / `Ctrl+Alt+L` (Win/Linux)
- Send all open files with `Cmd+Alt+A` (Mac) / `Ctrl+Alt+A` (Win/Linux)
- Session persistence across VS Code restarts
- Multi-agent workflows across terminals

### Developer Experience

| Feature | Description |
|---------|-------------|
| **Full Clipboard Support** | Standard Ctrl/Cmd+C/V shortcuts, image paste support |
| **IME Support** | Japanese, Chinese, Korean input methods with VS Code standard handling |
| **Link Detection** | Click file paths to open in VS Code, URLs open in browser, email links |
| **Alt+Click Positioning** | VS Code-standard cursor placement |
| **Shell Integration** | Command tracking, working directory display, command history |
| **Debug Panel** | Real-time monitoring with `Ctrl+Shift+D` |
| **Mouse Tracking** | Support for TUI applications (vim, htop, zellij) with mouse mode |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+C` / `Ctrl+C` | Copy selected text (or send SIGINT if no selection) |
| `Cmd+V` / `Ctrl+V` | Paste (text and images) |
| `Shift+Enter` / `Option+Enter` | Insert newline (Claude Code multiline prompts) |
| `Cmd+Alt+L` / `Ctrl+Alt+L` | Insert current file reference for AI agents |
| `Cmd+Alt+A` / `Ctrl+Alt+A` | Insert all open files references for AI agents |
| `Cmd+K Cmd+C` / `Ctrl+K Ctrl+C` | Activate GitHub Copilot Chat |
| ``Ctrl+` `` | Focus Secondary Terminal view |
| ``Ctrl+Shift+` `` | Create new terminal |
| `Cmd+\` (Mac) / `Ctrl+Shift+5` | Split terminal vertically |
| `Cmd+K` / `Ctrl+K` | Clear terminal |
| `Alt+Cmd+Left/Right` (Mac) / `Alt+Left/Right` | Focus previous/next terminal |
| `Cmd+Alt+1..5` (Mac) / `Alt+1..5` | Focus terminal by index |
| `Ctrl+Shift+D` | Toggle debug panel |
| `Cmd+A` / `Ctrl+A` | Select all terminal content |

Other UX features:

- `Alt+Click` moves the cursor (VS Code-style) when enabled via `secondaryTerminal.altClickMovesCursor`

> **Claude Code tips**:
> - `Cmd+V` on macOS pastes both text and images (screenshots) into Claude Code
> - Use `Shift+Enter` or `Option+Enter` to insert newlines for multiline prompts

## Command Palette

Access via `Ctrl+Shift+P` (Win/Linux) or `Cmd+Shift+P` (Mac):

| Command | Description |
|---------|-------------|
| `Secondary Terminal: Focus Terminal` | Focus terminal panel |
| `Secondary Terminal: Create New Terminal` | Create a new terminal |
| `Secondary Terminal: Kill Terminal` | Close current terminal |
| `Secondary Terminal: Clear Terminal` | Clear terminal content |
| `Secondary Terminal: Split Terminal Vertically` | Split vertically |
| `Secondary Terminal: Split Terminal Horizontally` | Split horizontally |
| `Secondary Terminal: Select Terminal Profile` | Choose a shell profile |
| `Secondary Terminal: Manage Terminal Profiles` | Edit shell profiles |
| `Secondary Terminal: Focus Terminal 1-5` | Focus specific terminal |
| `Secondary Terminal: Focus Next/Previous Terminal` | Navigate terminals |
| `Secondary Terminal: Save/Restore/Clear Session` | Session management |
| `Secondary Terminal: Run Recent Command` | Execute from history |
| `Secondary Terminal: Show Version` | Display version info |
| `Secondary Terminal: Terminal Settings` | Open settings |
| `Secondary Terminal: Clear Corrupted Terminal History` | Fix session data issues |

## Configuration

### Basic Settings

```json
{
  "secondaryTerminal.shell": "auto",
  "secondaryTerminal.shellArgs": [],
  "secondaryTerminal.maxTerminals": 5,
  "secondaryTerminal.fontSize": 14,
  "secondaryTerminal.fontFamily": "MesloLGS NF, Monaco, monospace",
  "secondaryTerminal.cursorBlink": true,
  "secondaryTerminal.cursorStyle": "block",
  "secondaryTerminal.scrollback": 1000,
  "secondaryTerminal.defaultDirectory": ""
}
```

### AI Agent Settings

```json
{
  "secondaryTerminal.enableCliAgentIntegration": true,
  "secondaryTerminal.enableGitHubCopilotIntegration": true,
  "secondaryTerminal.focusAfterAtMention": true,
  "secondaryTerminal.enableAtMentionSync": false
}
```

### Session Persistence Settings

```json
{
  "secondaryTerminal.enablePersistentSessions": true,
  "secondaryTerminal.persistentSessionScrollback": 1000,
  "secondaryTerminal.persistentSessionReviveProcess": "onWindowClose",
  "secondaryTerminal.persistentSessionStorageLimit": 20,
  "secondaryTerminal.persistentSessionRetentionDays": 7
}
```

### Split View Settings

```json
{
  "secondaryTerminal.maxSplitTerminals": 4,
  "secondaryTerminal.minTerminalHeight": 100,
  "secondaryTerminal.enableSplitResize": true,
  "secondaryTerminal.dynamicSplitDirection": true
}
```

### Shell Integration Settings

```json
{
  "secondaryTerminal.shellIntegration.enabled": true,
  "secondaryTerminal.shellIntegration.showCommandStatus": true,
  "secondaryTerminal.shellIntegration.showWorkingDirectory": true,
  "secondaryTerminal.shellIntegration.commandHistory": true
}
```

### Link Detection Settings

```json
{
  "secondaryTerminal.links.enabled": true,
  "secondaryTerminal.links.detectFileLinks": true,
  "secondaryTerminal.links.detectWebLinks": true,
  "secondaryTerminal.links.detectEmailLinks": true
}
```

### Advanced Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `secondaryTerminal.confirmBeforeKill` | boolean | `true` | Show confirmation before closing terminals |
| `secondaryTerminal.protectLastTerminal` | boolean | `true` | Prevent closing the last terminal |
| `secondaryTerminal.altClickMovesCursor` | boolean | `true` | Enable Alt+Click cursor positioning |
| `secondaryTerminal.sendKeybindingsToShell` | boolean | `true` | Send keybindings to shell |
| `secondaryTerminal.allowChords` | boolean | `true` | Allow multi-key chord sequences |
| `secondaryTerminal.minimumContrastRatio` | number | `4.5` | Minimum contrast ratio for text |
| `secondaryTerminal.activeBorderMode` | string | `"always"` | When to show active terminal border |
| `secondaryTerminal.logging.level` | string | `"info"` | Logging level (debug/info/warn/error) |

## Architecture

![Architecture](resources/architeccture-graphic-recording.png)

![Architecture Detail](resources/readme-architecture.png)

**Extension Host (Node.js)**

- TerminalManager: PTY processes, lifecycle, AI detection
- Session Management: Persistent state across restarts

**WebView (Browser)**

- xterm.js: Terminal emulation with WebGL rendering
- Manager System: Input, UI, Performance, Splitting, Configuration

## Performance

| Metric | Value |
|--------|-------|
| **Build Size** | ~790 KiB extension + ~1.5 MiB webview |
| **Rendering** | WebGL with auto DOM fallback |
| **Output Buffering** | Adaptive 2-16ms intervals (up to 250fps for AI output) |
| **Memory** | Efficient cleanup with LIFO disposal pattern |
| **Scrollback Restore** | <1s for 1,000 lines with ANSI color preservation |
| **Terminal Disposal** | <100ms cleanup time |

## Troubleshooting

### Terminal Not Starting

- Check `secondaryTerminal.shell` setting points to valid shell
- Verify shell is accessible from your PATH
- Try setting an explicit shell path

### AI Agent Not Detected

- Ensure `secondaryTerminal.enableCliAgentIntegration` is `true`
- Check debug panel (`Ctrl+Shift+D`) for detection logs
- Verify agent is properly installed and running

### Performance Issues

- Reduce `secondaryTerminal.maxTerminals` if needed
- Lower `secondaryTerminal.scrollback` value
- Check system resources via debug panel

### Session Not Restoring

- Verify `secondaryTerminal.enablePersistentSessions` is `true`
- Check storage limits with `secondaryTerminal.persistentSessionStorageLimit`
- Use "Clear Corrupted Terminal History" command if data is corrupted

### TUI Applications Display Issues

- Mouse tracking is automatically enabled for applications like zellij
- If display issues occur in split mode, try switching to fullscreen mode

## Development

```bash
# Build
npm install
npm run compile

# Test
npm test              # Unit tests
npm run test:e2e      # E2E tests (Playwright)

# Development
npm run watch         # Watch mode
npm run lint          # ESLint check
```

**Quality Standards:**

- TypeScript strict mode
- 275+ unit tests
- E2E test coverage with Playwright
- TDD development workflow

## Known Limitations

- **Running Processes**: Long-running processes terminate on VS Code restart (scrollback preserved). Use `tmux`/`screen` for process persistence.
- **Active Development**: Some features may have rough edges

## Privacy

This extension respects VS Code's telemetry settings. We collect only anonymous usage metrics (feature usage, error rates) - never terminal content, file paths, or personal data.

To disable: Set `telemetry.telemetryLevel` to `"off"` in VS Code settings.

See [PRIVACY.md](PRIVACY.md) for details.

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
