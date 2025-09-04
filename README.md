# VS Code Sidebar Terminal

[![GitHub license](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
[![GitHub stars](https://img.shields.io/github/stars/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/stargazers)
[![CI](https://github.com/s-hiraoku/vscode-sidebar-terminal/workflows/CI/badge.svg)](https://github.com/s-hiraoku/vscode-sidebar-terminal/actions)

A powerful VS Code extension that displays a terminal in the sidebar for efficient development workflow. Seamlessly integrated into the Primary Sidebar (left side) alongside other views.

## 📸 Screenshots

### Main Interface

![Main Interface](./docs/images/screenshots/main-interface.png)
_Terminal integrated into VS Code sidebar with multiple tabs and controls_

### Multiple Terminals

![Multiple Terminals](./docs/images/screenshots/multiple-terminals.png)
_Manage multiple terminal sessions with easy tab switching_

### Split Terminal View

![Split Terminal](./docs/images/screenshots/split-terminal.png)
_Split terminal functionality for parallel command execution_

## 🎬 Demos

### Basic Usage

![Basic Usage](./docs/images/gifs/basic-usage.gif)
_Quick demonstration of opening terminal and running commands_

### Terminal Management

![Terminal Management](./docs/images/gifs/terminal-management.gif)
_Creating, switching, and managing multiple terminals_

### Settings Configuration

![Settings Demo](./docs/images/gifs/settings-demo.gif)
_Customizing font size, theme, and other settings_

## 🚀 Features

### 🖥️ Core Terminal Features
- **Sidebar Integration**: Terminal integrated into Primary Sidebar (left side)
- **Multiple Terminal Management**: Run up to 5 terminals simultaneously
- **Session Persistence**: Automatic terminal session restore after VS Code restart with full history
- **Full Terminal Functionality**: Complete shell execution environment powered by node-pty
- **✅ VS Code Standard Behavior**: Arrow keys work perfectly for bash history, tab completion, and cursor movement
- **Special Key Support**: Backspace, Ctrl+C, Ctrl+L, and other special key combinations
- **Cross-Platform**: Full support for Windows, macOS, and Linux with platform-specific native binaries

### 🎨 User Interface & Experience  
- **Intuitive Controls**: Clear, New, Split, and Delete buttons for easy terminal management
- **Terminal Splitting**: Advanced split-view functionality with resizable panes
- **Visual Feedback**: Active terminal highlighting with border indication
- **Status Management**: Real-time status display with auto-hide functionality
- **Theme Integration**: Automatic VS Code theme following with customizable options
- **IME Support**: Full multi-language input support including Japanese, Chinese, and Korean

### 🤖 AI Agent Integration
- **Multi-Agent Support**: Detection and integration for Claude Code, GitHub Copilot, Gemini, and OpenAI Codex
- **File Reference Shortcuts**: 
  - `@filename` format for CLI agents (Cmd+Option+L / Ctrl+Alt+L)
  - `#file:filename` format for GitHub Copilot (Cmd+K Cmd+C / Ctrl+K Ctrl+C)
- **Advanced Status Management**: Real-time AI agent state tracking with CONNECTED/DISCONNECTED/NONE status
- **✨ Always-Visible Toggle**: Beautiful sparkles icon (✨) for consistent AI agent control
- **Smart Status Detection**: Intelligent pattern matching for various AI agent outputs
- **Independent Operation**: Works alongside AI agent extensions without conflicts

### 🔧 Advanced Features
- **Alt+Click Cursor Positioning**: VS Code-standard Alt+Click to move cursor (with intelligent CLI Agent detection)
- **Debug Panel**: Real-time terminal state monitoring with Ctrl+Shift+D
- **System Diagnostics**: Comprehensive diagnostics export with Ctrl+Shift+X
- **Performance Optimization**: Efficient buffering and processing for high-frequency output
- **Memory Management**: Automatic resource cleanup and leak prevention

## 📦 Installation

### From VS Code Marketplace

1. Open VS Code
2. Open Extensions panel (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for "Sidebar Terminal"
4. Click Install

### Manual Installation

1. Download the latest `.vsix` file from [Releases](https://github.com/s-hiraoku/vscode-sidebar-terminal/releases)
2. Open VS Code and press `Ctrl+Shift+P` (`Cmd+Shift+P` on Mac)
3. Select "Extensions: Install from VSIX..."
4. Choose the downloaded `.vsix` file

## 🎯 Usage

### Basic Operations

1. **Open Terminal**: Click "Terminal" view in the Explorer panel
2. **Create New Terminal**: Click the "New" button in the terminal header
3. **Split Terminal**: Click the "Split" button to create a split view
4. **Clear Terminal**: Click the "Clear" button to clear the active terminal
5. **Execute Commands**: Type commands as you would in any terminal

### Sidebar Placement

#### Primary Sidebar (Left Side)

- Terminal appears in the Explorer panel on the left side
- Integrated with other sidebar views, switchable via tabs
- Maintains context when switching between views

### Command Palette

- `Sidebar Terminal: Create New Terminal` - Create a new terminal instance
- `Sidebar Terminal: Split Terminal` - Split the current terminal
- `Sidebar Terminal: Clear Terminal` - Clear the active terminal
- `Sidebar Terminal: Kill Terminal` - Terminate the active terminal

### ✅ Terminal Functionality (v0.1.43 Update)

- **Arrow Key Navigation**: ↑↓ keys work perfectly for bash command history navigation
- **Tab Completion**: Shell completion functions exactly like VS Code integrated terminal
- **Cursor Movement**: ←→ keys provide natural text editing and cursor positioning
- **Standard Terminal Shortcuts**: All Ctrl+C, Ctrl+L, and other shortcuts work as expected

### Alt+Click Cursor Positioning

- **Standard VS Code Behavior**: Alt+Click to move cursor to mouse position
- **Visual Feedback**: Blue highlight shows cursor position with fade animation
- **Requirements**: Both `terminal.integrated.altClickMovesCursor` and `editor.multiCursorModifier: "alt"` must be enabled

### 🤖 AI Agent Integration

- **Multi-Agent Detection**: Comprehensive support for Claude Code, GitHub Copilot, Gemini, and OpenAI Codex CLI agents
- **File Reference Shortcuts**: 
  - `@filename` format: `Cmd+Option+L` (Mac) or `Ctrl+Alt+L` (Windows/Linux)
  - `#file:filename` format: `Cmd+K Cmd+C` (Mac) or `Ctrl+K Ctrl+C` (Windows/Linux)
- **✨ Always-Visible Toggle**: Beautiful sparkles icon remains visible in all connection states
- **Intelligent Status Detection**: Advanced pattern matching for reliable agent state tracking
- **Smart Status Transitions**: Seamless CONNECTED → DISCONNECTED → NONE → (removed) lifecycle
- **Performance Optimized**: CLI Agent output uses optimized 4ms flush intervals for responsiveness
- **Independent Operation**: Works alongside AI agent extensions without conflicts
- **Configurable Integration**: Both CLI and Copilot integrations can be independently enabled/disabled

### 🔄 Session Persistence

- **Complete Session Restoration**: Full terminal state and history restored after VS Code restart
- **Scrollback History**: Up to 1000 lines of terminal history preserved per terminal
- **Multi-Terminal Support**: All terminals (up to 5) restored with their individual states and active terminal selection
- **Infinite Loop Prevention**: Advanced safeguards prevent terminal creation loops during restoration
- **Data Integrity**: 7-day session expiration with automatic cleanup for optimal performance
- **Compression Support**: Optional scrollback compression to reduce storage requirements
- **Configurable Persistence**: Session restoration can be customized or completely disabled

## ⌨️ Keyboard Shortcuts

### 🤖 AI Agent Integration
- **CLI Agent File Reference**: `Cmd+Option+L` (Mac) / `Ctrl+Alt+L` (Windows/Linux) - Insert `@filename` reference
- **GitHub Copilot Integration**: `Cmd+K Cmd+C` (Mac) / `Ctrl+K Ctrl+C` (Windows/Linux) - Activate Copilot Chat with file reference

### 🖱️ Mouse Interactions
- **Alt+Click**: Cursor positioning (requires VS Code settings: `terminal.integrated.altClickMovesCursor` and `editor.multiCursorModifier: "alt"`)

### 🔍 Debug & Troubleshooting

- **Terminal State Debug Panel**: `Ctrl+Shift+D` - Toggle real-time terminal state monitoring panel
- **System Diagnostics Export**: `Ctrl+Shift+X` - Export detailed system diagnostics for troubleshooting

The Debug Panel provides comprehensive insights including:
- System status (READY/BUSY state)
- Active terminal count and available slots
- Performance metrics and memory usage
- Pending operations queue status
- Individual terminal instance details

## ⚙️ Configuration

Customize the extension through VS Code settings (`settings.json`):

| Setting                                 | Type    | Default    | Description                                                             |
| --------------------------------------- | ------- | ---------- | ----------------------------------------------------------------------- |
| `sidebarTerminal.shell`                 | string  | `""`       | Path to shell executable. Leave empty to use system default.            |
| `sidebarTerminal.shellArgs`             | array   | `[]`       | Arguments to pass to the shell.                                         |
| `sidebarTerminal.maxTerminals`          | number  | 5          | Maximum number of terminals allowed.                                    |
| `sidebarTerminal.cursorBlink`           | boolean | `true`     | Enable cursor blinking in terminal.                                     |
| `sidebarTerminal.theme`                 | string  | `auto`     | Terminal theme. Auto follows VS Code theme.                             |
| `sidebarTerminal.defaultDirectory`      | string  | `""`       | Default directory for new terminals. Leave empty to use workspace root. |
| `sidebarTerminal.confirmBeforeKill`     | boolean | `false`    | Show confirmation dialog before closing terminals                       |
| `sidebarTerminal.protectLastTerminal`   | boolean | `true`     | Prevent closing the last terminal                                       |
| `sidebarTerminal.minTerminalCount`      | number  | 1          | Minimum number of terminals to keep open                                |
| `sidebarTerminal.maxSplitTerminals`     | number  | 5          | Maximum number of terminals to display in split view                    |
| `sidebarTerminal.minTerminalHeight`     | number  | 100        | Minimum height for each terminal in split view (pixels)                 |
| `sidebarTerminal.enableSplitResize`     | boolean | `true`     | Allow resizing split terminals by dragging splitters                    |
| `sidebarTerminal.statusDisplayDuration` | number  | 3000       | Duration to display status messages (milliseconds)                      |
| `sidebarTerminal.autoHideStatus`        | boolean | `true`     | Automatically hide status messages after specified duration             |
| `sidebarTerminal.showStatusOnActivity`  | boolean | `true`     | Show last status message when user performs actions                     |
| `sidebarTerminal.showWebViewHeader`     | boolean | `true`     | Show title and command icons in the webview header                      |
| `sidebarTerminal.webViewTitle`          | string  | `Terminal` | Title to display in the webview header                                  |
| `sidebarTerminal.showSampleIcons`       | boolean | `true`     | Show sample command icons in webview header (display only)              |
| `sidebarTerminal.sampleIconOpacity`     | number  | 0.4        | Opacity of sample icons (0.1 to 1.0)                                    |
| `sidebarTerminal.headerFontSize`        | number  | 14         | Font size for webview header title                                      |
| `sidebarTerminal.headerIconSize`        | number  | 20         | Size of terminal icon in webview header                                 |
| `sidebarTerminal.sampleIconSize`        | number  | 16         | Size of sample icons in webview header                                  |
| `sidebarTerminal.altClickMovesCursor`   | boolean | `true`     | Controls whether Alt/Option + click will reposition the prompt cursor.  |
| `sidebarTerminal.enableCliAgentIntegration` | boolean | `true`     | Enable file reference shortcuts for CLI agents like Claude Code.        |
| `sidebarTerminal.enableGitHubCopilotIntegration` | boolean | `true`     | Enable GitHub Copilot Chat integration shortcuts.                       |
| `sidebarTerminal.enablePersistentSessions` | boolean | `true`     | Enable terminal session persistence across VS Code restarts.             |
| `sidebarTerminal.scrollbackLines`      | number  | 1000       | Maximum number of lines to restore from terminal history.               |
| `sidebarTerminal.scrollbackCompression` | boolean | `true`     | Compress scrollback data to reduce storage size.                        |

## 🛠️ Development

### Prerequisites

- Node.js 18+
- VS Code 1.74.0+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/s-hiraoku/vscode-sidebar-terminal.git
cd vscode-sidebar-terminal

# Install dependencies
npm install

# Development build
npm run compile

# Watch mode for development
npm run watch
```

### Testing

```bash
# Run unit tests with coverage
npm run test:unit

# Run all tests
npm test

# Run linter
npm run lint

# Format code
npm run format

# Production build
npm run package
```

### Debugging

For detailed debugging instructions, including how to launch the extension, check logs, and troubleshoot common issues, please refer to the [Debugging Guide (Japanese)](./docs/DEBUG.md).

### Release Process

For detailed instructions on how to release new versions of the extension, including automated and manual publishing steps, please refer to the [Release Process Guide (Japanese)](./docs/RELEASE_PROCESS.md).

## 🧪 Testing Strategy

This extension uses comprehensive testing with modern tooling and robust infrastructure:

### 📊 Test Coverage
- **Unit Tests**: 275+ test cases covering utilities, managers, and core functionality
- **Integration Tests**: Full VS Code extension testing with enhanced API mocking  
- **Performance Tests**: High-frequency output handling and memory leak prevention
- **End-to-End Tests**: Complete user scenarios including session restoration
- **CI/CD Pipeline**: Multi-platform testing on Windows, macOS, and Linux

### 🛠️ Testing Infrastructure
- **Modern Tooling**: Mocha, Chai, Sinon, JSDOM, and chai-as-promised
- **Enhanced VS Code Mocking**: Complete document/URI structure simulation
- **Test Isolation**: Proper cleanup and resource management between tests
- **Code Coverage**: nyc (Istanbul) with detailed HTML/LCOV reporting
- **Quality Gates**: Automated TDD compliance and quality checks

### 🎯 Test Categories
- **Core Functionality**: Terminal management, session persistence, AI agent detection
- **UI Components**: Message handling, split management, performance optimization  
- **Edge Cases**: Error handling, resource disposal, infinite loop prevention
- **Platform Compatibility**: Cross-platform shell integration and native binary support
- **Regression Tests**: Critical bug prevention with comprehensive scenario coverage

### 📈 Quality Metrics
- **Test Success Rate**: 93%+ with continuous improvement
- **Code Coverage**: 85%+ across all modules
- **ESLint Compliance**: 100% (0 errors, warnings only for intentional `any` types)
- **TypeScript Safety**: Strict mode compliance with proper type assertions

## 🧪 Test-Driven Development (TDD)

This project follows **t-wada's TDD methodology** for sustainable, high-quality development:

### TDD Infrastructure

- **📊 Metrics Collection**: Real-time TDD compliance tracking
- **🔄 Automated Workflows**: Red-Green-Refactor cycle automation
- **📈 Quality Gates**: CI/CD integrated quality checks
- **🎯 Interactive Sessions**: Guided TDD development experience

### Available TDD Commands

```bash
# Interactive TDD workflow
npm run tdd:interactive

# Phase-specific commands
npm run tdd:red      # Verify failing tests
npm run tdd:green    # Verify passing tests
npm run tdd:refactor # Quality check after refactoring

# Quality assessment
npm run tdd:check-quality    # Comprehensive quality analysis
npm run tdd:quality-gate     # CI/CD quality gate check
```

### TDD Metrics Dashboard

- **TDD Compliance Rate**: 50%+ achieved (Red-Green-Refactor adherence) - targeting 85%
- **Test Coverage**: 85%+ maintained across all modules
- **Code Quality Score**: 9.0+/10.0 achieved with comprehensive infrastructure improvements  
- **ESLint Compliance**: ✅ **100%** (0 errors) - Production ready code quality
- **TypeScript Safety**: ✅ **100%** - Strict mode compliance with enhanced type safety
- **Test Success Rate**: 93%+ with robust infrastructure and isolation improvements
- **Real-time tracking** with automated quality gates and historical trend analysis

### Documentation

- 📖 [TDD Operations Guide](./docs/TDD-OPERATIONS-GUIDE.md) - Complete workflow and daily usage
- 🎯 [TDD Best Practices](./docs/TDD-BEST-PRACTICES.md) - Proven patterns and techniques
- 🚀 [CI/CD Integration](./docs/CI-CD-INTEGRATION.md) - Quality gates and automation

### VS Code Integration

Access TDD workflows directly through VS Code tasks:

- `Ctrl+Shift+P` → "Tasks: Run Task" → "TDD: Interactive Workflow"
- Integrated quality checks in build process
- Real-time TDD metrics in development

_This TDD infrastructure ensures maintainable, testable code while preventing technical debt accumulation._

## 🏗️ Architecture

```
src/
├── constants/          # Application constants
├── providers/          # WebView providers
├── terminals/          # Terminal management
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
├── webview/           # Frontend components
│   ├── components/    # UI components
│   ├── managers/      # UI managers
│   └── utils/         # WebView utilities
└── extension.ts       # Extension entry point
```

### Key Components

- **TerminalManager**: Multi-terminal state management with session persistence
- **RefactoredMessageManager**: Enhanced WebView message handling with priority queuing
- **UnifiedSessionManager**: Complete terminal session restoration with infinite loop prevention  
- **CliAgentDetectionService**: Multi-agent AI detection with advanced pattern matching
- **SecandarySidebar**: VS Code WebView integration with enhanced resource management
- **WebView (xterm.js)**: Terminal UI rendering with performance optimizations
- **PTY Process**: System-level shell integration with cross-platform native binaries
- **SplitManager**: Advanced terminal split functionality with dynamic resizing
- **PerformanceManager**: Output buffering and high-frequency processing optimization

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Contribution Guidelines

- Maintain TypeScript type safety
- Follow ESLint and Prettier rules
- Add tests to cover new functionality
- Use [Conventional Commits](https://conventionalcommits.org/) format
- Ensure CI tests pass on all platforms

## 🐛 Troubleshooting

### Common Issues

**Q: Terminal doesn't appear**  
A: Restart VS Code or disable/enable the extension.

**Q: Commands don't execute**  
A: This is a PTY communication issue. Restart VS Code and re-enable the extension.

**Q: Backspace key doesn't work**  
A: Special key handling has been fixed. Please use the latest version.

**Q: Buttons (Clear/New/Split) don't work**  
A: Button functionality has been implemented. Check WebView communication.

**Q: Shell doesn't start**  
A: Verify that the `sidebarTerminal.shell` setting has the correct shell path.

**Q: Japanese/Unicode characters are garbled**  
A: Change terminal character encoding to UTF-8. IME support has been added.

**Q: Performance is slow**  
A: Reduce the number of concurrent terminals using the `maxTerminals` setting.

**Q: Alt+Click doesn't work**  
A: Ensure both `terminal.integrated.altClickMovesCursor` and `editor.multiCursorModifier: "alt"` are enabled in VS Code settings.

### Debug Information

When reporting issues, please include:

- VS Code version
- Extension version
- OS and version
- Shell being used
- Error messages
- Steps to reproduce

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 📝 Changelog

See [CHANGELOG.md](docs/CHANGELOG.md) for detailed changes.

### v0.1.77 (Latest)

- **🔧 Test Infrastructure Stabilization**: Major improvements to test suite reliability and CI/CD stability
- **🤖 Multi-Agent AI Support**: Enhanced detection for Claude Code, GitHub Copilot, Gemini, and OpenAI Codex
- **✨ Always-Visible AI Toggle**: Beautiful sparkles icon (✨) remains visible in all connection states  
- **🔄 Session Persistence**: Robust terminal session restoration with infinite loop prevention
- **📊 Quality Improvements**: 93%+ test success rate, enhanced VS Code API mocking, improved TypeScript safety
- **🚀 Performance Optimization**: Advanced output buffering, memory management, and resource cleanup

### Previous Major Updates

#### v0.1.76
- **OpenAI Codex Integration**: Added comprehensive support for OpenAI Codex CLI agent detection
- **Enhanced AI Agent Switching**: Improved status transitions and UI synchronization

#### v0.1.75  
- **✨ Always-Visible Toggle**: AI Agent toggle button now uses sparkles icon and remains visible
- **UI Consistency**: Improved user experience with consistent AI agent control visibility

#### v0.1.50
- **Session Persistence**: Complete terminal session restore functionality with scrollback history
- **CLI Agent Integration**: File reference shortcuts for Claude Code (`@filename`) and GitHub Copilot (`#file:filename`)
- **Cross-Platform Native Binaries**: Platform-specific builds for optimal performance

### v0.1.25

- **WebView Architecture Refactoring**: Modular system with focused managers
- **Active Terminal Visualization**: Border indication for active terminal
- **SVG Icon**: Updated extension icon for better scaling

## 🙏 Acknowledgments

This project uses these excellent libraries:

- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [node-pty](https://github.com/microsoft/node-pty) - PTY process management
- [VS Code Extension API](https://code.visualstudio.com/api) - Extension framework

## 🔗 Related Links

- [VS Code Extension API](https://code.visualstudio.com/api)
- [xterm.js Documentation](https://xtermjs.org/docs/)
- [node-pty Documentation](https://github.com/microsoft/node-pty)

---

**Developer**: [s-hiraoku](https://github.com/s-hiraoku)  
**Repository**: [vscode-sidebar-terminal](https://github.com/s-hiraoku/vscode-sidebar-terminal)  
**License**: MIT  
**Support**: [Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)

---

_This README was last updated on 2025-01-06 for v0.1.77._
