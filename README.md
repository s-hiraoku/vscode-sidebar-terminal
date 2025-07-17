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

```json
{
  "sidebarTerminal.shell": "",
  "sidebarTerminal.shellArgs": [],
  "sidebarTerminal.fontSize": 14,
  "sidebarTerminal.fontFamily": "Consolas, 'Courier New', monospace",
  "sidebarTerminal.maxTerminals": 5,
  "sidebarTerminal.theme": "auto",
  "sidebarTerminal.cursorBlink": true,
  "sidebarTerminal.altClickMovesCursor": true
}
```

### Configuration Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `shell` | string | "" | Path to shell executable (empty for system default) |
| `shellArgs` | array | [] | Arguments to pass to the shell |
| `fontSize` | number | 14 | Terminal font size |
| `fontFamily` | string | "Consolas, 'Courier New', monospace" | Terminal font family |
| `maxTerminals` | number | 5 | Maximum number of concurrent terminals |
| `theme` | string | "auto" | Terminal theme (auto/dark/light) |
| `cursorBlink` | boolean | true | Enable cursor blinking |
| `altClickMovesCursor` | boolean | true | Enable Alt+Click cursor positioning |

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

### v0.0.1 (Initial Release)

#### Features
- Initial release of Sidebar Terminal extension
- **Core Features**: Terminal integration in VS Code Primary Sidebar, multiple terminal management (up to 5), split terminal functionality, Clear, New, and Split button controls, full shell execution environment powered by node-pty.
- **Platform Support**: Cross-platform compatibility (Windows, macOS, Linux), IME support for multi-language input, special key handling.
- **Advanced Features**: Alt+Click cursor positioning with VS Code standard behavior, Claude Code detection for optimal performance, visual feedback with blue cursor highlight, automatic conflict resolution for terminal output interference.
- **Customization Options**: Configurable shell and shell arguments, font family and size customization, terminal theme support, cursor blinking controls, maximum terminal count settings.
- **Developer Experience**: Comprehensive testing strategy with 47 test cases, modern testing tooling, multi-platform CI/CD pipeline, code coverage reporting, ESLint and Prettier integration.

#### Technical Implementation
- **Architecture**: Clean separation between extension host (Node.js) and WebView (browser).
- **Terminal Rendering**: xterm.js for high-performance terminal emulation.
- **Process Management**: node-pty for cross-platform PTY support.
- **State Management**: Centralized TerminalManager for multi-terminal coordination.
- **Communication**: Event-driven architecture with proper message handling.

#### Testing & Quality Assurance
- **Unit Tests**: 47 test cases covering core functionality (DOM manipulation, notification system, Alt+Click).
- **Integration Tests**: VS Code extension testing with mocked APIs.
- **Code Coverage**: Comprehensive coverage reporting with nyc (Istanbul).
- **CI/CD**: GitHub Actions workflow for multi-platform testing.
- **Code Quality**: ESLint, Prettier, and TypeScript strict mode.

#### Fixed Issues
- ✅ PTY communication reliability improvements.
- ✅ Backspace key and special character handling.
- ✅ WebView entry point resolution (simple.ts → main.ts).
- ✅ Clear/New/Split button functionality.
- ✅ TypeScript and ESLint error resolution.
- ✅ Cross-platform terminal execution environment.
- ✅ User guidance and error handling enhancements.

#### Performance Optimizations
- **Output Buffering**: Adaptive buffering (8ms vs 16ms) for optimal performance.
- **Claude Code Detection**: Automatic performance optimization during AI interactions.
- **Memory Management**: Proper cleanup and disposal patterns.
- **Resize Handling**: Debounced terminal resize operations.

#### Security & Reliability
- **Input Validation**: Comprehensive input sanitization.
- **Error Handling**: Graceful degradation and user-friendly error messages.
- **Resource Management**: Proper cleanup of PTY processes and WebView resources.
- **Security Testing**: CodeQL analysis and dependency vulnerability scanning.

### v0.0.2 (Future Release - Planned)

#### Planned Features
- **Enhanced Testing**: Complete Phase 2 WebView component testing (SplitManager, HeaderManager, SettingsPanel).
- **Advanced Testing**: Phase 3 implementation (Performance testing framework, Accessibility testing with axe-core, Load testing for multiple terminals).
- **User Experience**: Terminal session persistence, custom themes and color schemes, enhanced keyboard shortcuts, terminal history management.

#### WebView Architecture Refactoring (Completed in v0.0.2)
- Transformed monolithic `main.ts` into a modular system with 9 focused managers (Performance, ClaudeCode, Input, UI, Config, Message, Notification, TerminalCoordinator).
- Achieved significant improvements in code organization, maintainability, and performance.
- Implemented intelligent buffering, debounced operations, and efficient resource management.

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