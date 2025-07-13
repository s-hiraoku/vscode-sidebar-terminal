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

1. Download the appropriate `.vsix` file for your platform from [Releases](https://github.com/s-hiraoku/vscode-sidebar-terminal/releases):
   - **Windows**: `vscode-sidebar-terminal-win32-x64-*.vsix` (64-bit) or `vscode-sidebar-terminal-win32-arm64-*.vsix` (ARM64)
   - **macOS**: `vscode-sidebar-terminal-darwin-x64-*.vsix` (Intel) or `vscode-sidebar-terminal-darwin-arm64-*.vsix` (Apple Silicon)
   - **Linux**: `vscode-sidebar-terminal-linux-x64-*.vsix` (64-bit), `vscode-sidebar-terminal-linux-arm64-*.vsix` (ARM64), or `vscode-sidebar-terminal-linux-armhf-*.vsix` (ARM 32-bit)
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

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. In the new window, check the "Terminal" view in the Explorer panel

### Building Platform-Specific Packages

Due to native dependencies (node-pty), platform-specific packages must be built:

```bash
# Build for specific platforms
npm run vsce:package:win32-x64     # Windows 64-bit
npm run vsce:package:win32-arm64   # Windows ARM64
npm run vsce:package:linux-x64     # Linux 64-bit
npm run vsce:package:linux-arm64   # Linux ARM64
npm run vsce:package:linux-armhf   # Linux ARM 32-bit
npm run vsce:package:darwin-x64    # macOS Intel
npm run vsce:package:darwin-arm64  # macOS Apple Silicon

# Build all platforms
npm run vsce:package:all
```

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

### v0.1.15 (Latest)

#### Critical Fixes
- **macOS ARM64 Support**: Resolved "slice is not valid mach-o file" error by migrating to `@homebridge/node-pty-prebuilt-multiarch`
- **Cross-Platform Reliability**: Eliminated GitHub Actions cross-compilation issues with prebuilt binaries
- **Build System**: Simplified and more reliable platform-specific packaging

### v0.1.13-0.1.14 (Previous)

#### Features
- Initial release
- Sidebar terminal display
- Multiple terminal management
- Split terminal functionality
- PTY communication improvements
- Special key handling (Backspace, Ctrl+C, etc.)
- Clear/New/Split button implementation
- IME (multi-language input) support
- Customizable settings
- Alt+Click cursor positioning with Claude Code detection
- Comprehensive testing strategy

#### Recent Fixes
- ✅ Fixed PTY communication issues
- ✅ Fixed Backspace key functionality
- ✅ Fixed Clear/New/Split button functionality
- ✅ Fixed WebView entry point (simple.ts → main.ts)
- ✅ Resolved TypeScript/ESLint errors
- ✅ Improved terminal execution environment
- ✅ Enhanced user guidance
- ✅ Implemented comprehensive testing with 47 test cases
- ✅ Added CI/CD pipeline with multi-platform support

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