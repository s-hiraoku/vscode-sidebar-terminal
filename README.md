# VS Code Sidebar Terminal

[![GitHub license](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
[![GitHub stars](https://img.shields.io/github/stars/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/stargazers)
[![CI](https://github.com/s-hiraoku/vscode-sidebar-terminal/workflows/CI/badge.svg)](https://github.com/s-hiraoku/vscode-sidebar-terminal/actions)

A powerful VS Code extension that displays a terminal in the sidebar for efficient development workflow. Seamlessly integrated into the Primary Sidebar (left side) alongside other views.

## 📸 Screenshots

### Main Interface
![Main Interface](./docs/images/screenshots/main-interface.png)
*Terminal integrated into VS Code sidebar with multiple tabs and controls*

### Multiple Terminals
![Multiple Terminals](./docs/images/screenshots/multiple-terminals.png)
*Manage multiple terminal sessions with easy tab switching*

### Split Terminal View
![Split Terminal](./docs/images/screenshots/split-terminal.png)
*Split terminal functionality for parallel command execution*

## 🎬 Demos

### Basic Usage
![Basic Usage](./docs/images/gifs/basic-usage.gif)
*Quick demonstration of opening terminal and running commands*

### Terminal Management
![Terminal Management](./docs/images/gifs/terminal-management.gif)
*Creating, switching, and managing multiple terminals*

### Settings Configuration
![Settings Demo](./docs/images/gifs/settings-demo.gif)
*Customizing font size, theme, and other settings*

## 🚀 Features

- **Sidebar Integration**: Terminal integrated into Primary Sidebar (left side)
- **Multiple Terminal Management**: Run up to 5 terminals simultaneously
- **Full Terminal Functionality**: Complete shell execution environment powered by node-pty
- **Special Key Support**: Backspace, Ctrl+C, Ctrl+L, and other special key combinations
- **Intuitive Controls**: Clear, New, and Split buttons for easy terminal management
- **IME Support**: Multi-language input support including Japanese, Chinese, and Korean
- **Highly Customizable**: Configure fonts, sizes, shell, and other preferences
- **Cross-Platform**: Full support for Windows, macOS, and Linux
- **Alt+Click Cursor Positioning**: VS Code-standard Alt+Click to move cursor (with Claude Code detection)

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

### Alt+Click Cursor Positioning

- **Standard VS Code Behavior**: Alt+Click to move cursor to mouse position
- **Claude Code Detection**: Automatically disabled during Claude Code execution for optimal performance
- **Visual Feedback**: Blue highlight shows cursor position with fade animation
- **Requirements**: Both `terminal.integrated.altClickMovesCursor` and `editor.multiCursorModifier: "alt"` must be enabled

## ⚙️ Configuration

Customize the extension through VS Code settings (`settings.json`):

| Setting | Type | Default | Description |
|---|---|---|---|
| `sidebarTerminal.shell` | string | `""` | Path to shell executable. Leave empty to use system default. |
| `sidebarTerminal.shellArgs` | array | `[]` | Arguments to pass to the shell. |
| `sidebarTerminal.maxTerminals` | number | 5 | Maximum number of terminals allowed. |
| `sidebarTerminal.cursorBlink` | boolean | `true` | Enable cursor blinking in terminal. |
| `sidebarTerminal.theme` | string | `auto` | Terminal theme. Auto follows VS Code theme. |
| `sidebarTerminal.defaultDirectory` | string | `""` | Default directory for new terminals. Leave empty to use workspace root. |
| `sidebarTerminal.confirmBeforeKill` | boolean | `false` | Show confirmation dialog before closing terminals |
| `sidebarTerminal.protectLastTerminal` | boolean | `true` | Prevent closing the last terminal |
| `sidebarTerminal.minTerminalCount` | number | 1 | Minimum number of terminals to keep open |
| `sidebarTerminal.maxSplitTerminals` | number | 5 | Maximum number of terminals to display in split view |
| `sidebarTerminal.minTerminalHeight` | number | 100 | Minimum height for each terminal in split view (pixels) |
| `sidebarTerminal.enableSplitResize` | boolean | `true` | Allow resizing split terminals by dragging splitters |
| `sidebarTerminal.statusDisplayDuration` | number | 3000 | Duration to display status messages (milliseconds) |
| `sidebarTerminal.autoHideStatus` | boolean | `true` | Automatically hide status messages after specified duration |
| `sidebarTerminal.showStatusOnActivity` | boolean | `true` | Show last status message when user performs actions |
| `sidebarTerminal.showWebViewHeader` | boolean | `true` | Show title and command icons in the webview header |
| `sidebarTerminal.webViewTitle` | string | `Terminal` | Title to display in the webview header |
| `sidebarTerminal.showSampleIcons` | boolean | `true` | Show sample command icons in webview header (display only) |
| `sidebarTerminal.sampleIconOpacity` | number | 0.4 | Opacity of sample icons (0.1 to 1.0) |
| `sidebarTerminal.headerFontSize` | number | 14 | Font size for webview header title |
| `sidebarTerminal.headerIconSize` | number | 20 | Size of terminal icon in webview header |
| `sidebarTerminal.sampleIconSize` | number | 16 | Size of sample icons in webview header |
| `sidebarTerminal.altClickMovesCursor` | boolean | `true` | Controls whether Alt/Option + click will reposition the prompt cursor. |

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

For detailed debugging instructions, including how to launch the extension, check logs, and troubleshoot common issues, please refer to the [Debugging Guide (Japanese)](./DEBUG.md).

### Release Process

For detailed instructions on how to release new versions of the extension, including automated and manual publishing steps, please refer to the [Release Process Guide (Japanese)](./RELEASE_PROCESS.md).

## 🧪 Testing Strategy

This extension uses comprehensive testing with modern tooling:

- **Unit Tests**: 47 test cases covering utilities and core functionality
- **Integration Tests**: VS Code extension testing with mocked APIs
- **Code Coverage**: nyc (Istanbul) with detailed reporting
- **CI/CD Pipeline**: Multi-platform testing on Windows, macOS, and Linux
- **Modern Tools**: Mocha, Chai, Sinon, JSDOM, and @testing-library

Test coverage includes:
- DOM manipulation utilities (22 tests)
- Notification system (8 tests) 
- Alt+Click functionality (17 tests)
- VS Code API integration
- Cross-platform compatibility

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

- **TerminalManager**: Multi-terminal state management
- **SidebarTerminalProvider**: VS Code WebView integration
- **WebView (xterm.js)**: Terminal UI rendering
- **PTY Process**: System-level shell integration
- **SplitManager**: Terminal split functionality
- **HeaderManager**: UI header management

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

See [CHANGELOG.md](CHANGELOG.md) for detailed changes.

### v0.1.25
- **WebView Architecture Refactoring**: Transformed the frontend into a modular system with 9 focused managers, improving organization, maintainability, and performance.
- **Active Terminal Visualization**: Added a border to the active terminal for better focus indication.
- **SVG Icon**: Updated the extension icon to SVG for better scaling.

### v0.0.1 (Initial Release)
- Core features including sidebar integration, multiple terminals, and split view.
- Cross-platform support (Windows, macOS, Linux) with IME handling.
- Advanced features like Alt+Click cursor positioning.

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

*This README was last updated on 2025-07-18.*