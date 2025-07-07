# VS Code Sidebar Terminal

[![GitHub license](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
[![GitHub stars](https://img.shields.io/github/stars/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/stargazers)

A powerful VS Code extension that brings a fully-featured terminal interface directly to your sidebar. Boost your development productivity with split terminals, customizable themes, and seamless integration with your VS Code workspace.

## 🚀 Features

### Core Functionality
- **🎯 Sidebar Integration**: Terminal interface embedded in your Primary Sidebar for instant access
- **⚡ Split Terminals**: Run multiple terminal sessions simultaneously with visual splitting
- **🔧 Full Shell Support**: Complete terminal emulation using node-pty with all shell features
- **🎨 Theme Aware**: Automatically adapts to your VS Code theme (dark/light)
- **🌐 Cross-Platform**: Full Windows, macOS, and Linux support

### Advanced Features
- **📊 Status Management**: Real-time terminal status with auto-hide notifications
- **🔒 Terminal Protection**: Configurable terminal kill protection and confirmation dialogs
- **🎛️ Resize Handling**: Intelligent terminal resizing with debounced updates
- **💾 Context Retention**: Terminals persist when sidebar is hidden
- **⌨️ Complete Key Support**: All keyboard shortcuts including Ctrl+C, Ctrl+L, arrow keys

### Customization Options
- **🎨 Visual Customization**: Font family, size, cursor blinking, and header styling
- **⚙️ Behavior Settings**: Shell selection, arguments, working directory
- **🔧 Layout Control**: Minimum terminal heights, split limits, and icon opacity
- **🌍 Internationalization**: Multi-language support including Japanese IME

## 📦 Installation

### From VS Code Marketplace (Coming Soon)

1. Open VS Code
2. Open Extensions panel (`Ctrl+Shift+X`)
3. Search for "Sidebar Terminal"
4. Click Install button

### Manual Installation

1. Download the latest `.vsix` file from [Releases](https://github.com/s-hiraoku/vscode-sidebar-terminal/releases)
2. Open Command Palette in VS Code (`Ctrl+Shift+P`)
3. Select "Extensions: Install from VSIX..."
4. Select the downloaded `.vsix` file

## 🎯 Usage

### Getting Started

1. **Access Terminal**: Click the terminal icon in the Activity Bar or find "Terminal" in the Explorer panel
2. **Create Terminals**: Use the split button to create multiple terminal sessions
3. **Manage Sessions**: Switch between terminals using the visual split interface
4. **Execute Commands**: Full shell functionality with all standard terminal features

### Quick Actions

- **Split Terminal**: Click the split button or use Command Palette
- **Kill Terminal**: Use the trash button (with optional confirmation)
- **Clear Screen**: Standard Ctrl+L or clear command
- **Settings**: Access terminal settings through the gear icon

### Placement

#### Primary Sidebar (Left Side)
- Terminal is displayed in the left Explorer panel
- Located in the same area as other sidebar views, switchable with tabs

### Command Palette

- `Sidebar Terminal: Split Terminal` - Create a new terminal session
- `Sidebar Terminal: Kill Terminal` - Close the active terminal
- `Sidebar Terminal: Terminal Settings` - Open terminal configuration panel

### Keyboard Shortcuts

- All standard terminal keyboard shortcuts are supported
- Ctrl+C, Ctrl+L, Ctrl+D work as expected
- Arrow keys for command history navigation
- Tab completion for file/command names

## ⚙️ Configuration

Customize your terminal experience with extensive configuration options:

```json
{
  "sidebarTerminal.shell": "",
  "sidebarTerminal.shellArgs": [],
  "sidebarTerminal.fontSize": 14,
  "sidebarTerminal.fontFamily": "Consolas, 'Courier New', monospace",
  "sidebarTerminal.maxTerminals": 5,
  "sidebarTerminal.theme": "auto",
  "sidebarTerminal.cursorBlink": true,
  "sidebarTerminal.confirmBeforeKill": false,
  "sidebarTerminal.protectLastTerminal": true
}
```

### Configuration Categories

#### Terminal Behavior
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `shell` | string | "" | Path to shell executable (empty for system default) |
| `shellArgs` | array | [] | Arguments to pass to shell |
| `defaultDirectory` | string | "" | Default working directory for new terminals |
| `maxTerminals` | number | 5 | Maximum number of concurrent terminals |
| `confirmBeforeKill` | boolean | false | Show confirmation before closing terminals |
| `protectLastTerminal` | boolean | true | Prevent closing the last terminal |

#### Display & Theme
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `fontSize` | number | 14 | Terminal font size |
| `fontFamily` | string | "Consolas, 'Courier New', monospace" | Terminal font family |
| `theme` | string | "auto" | Terminal theme (auto, dark, light) |
| `cursorBlink` | boolean | true | Enable cursor blinking |

#### Split & Layout
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `maxSplitTerminals` | number | 5 | Maximum terminals in split view |
| `minTerminalHeight` | number | 100 | Minimum height for split terminals |
| `enableSplitResize` | boolean | true | Allow resizing split terminals |

#### Status & UI
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `statusDisplayDuration` | number | 3000 | Status message display duration (ms) |
| `autoHideStatus` | boolean | true | Auto-hide status messages |
| `showWebViewHeader` | boolean | true | Show header with title and icons |

## 🛠️ Development

### Requirements

- Node.js 18+
- VS Code 1.74.0+
- npm or yarn

### Setup

```bash
# Clone repository
git clone https://github.com/s-hiraoku/vscode-sidebar-terminal.git
cd vscode-sidebar-terminal

# Install dependencies
npm install

# Development build
npm run compile

# Watch mode
npm run watch
```

### Debugging

1. Open project in VS Code
2. Press `F5` to launch Extension Development Host
3. Check "Terminal" in Explorer panel in the new window

### Running Tests

```bash
# Unit tests
npm test

# Linter
npm run lint

# Formatter
npm run format

# Production build
npm run package
```

## 🏗️ Architecture

```
src/
├── constants/          # Constants definition
├── providers/          # WebView provider
├── terminals/          # Terminal management
├── types/             # Type definitions
├── utils/             # Utility functions
├── webview/           # Frontend
└── extension.ts       # Entry point
```

### Main Components

- **TerminalManager**: Multi-terminal state management
- **SidebarTerminalProvider**: VS Code WebView integration
- **WebView (xterm.js)**: Terminal UI rendering
- **PTY Process**: System-level shell integration

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork this repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add some amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Create Pull Request

### Contribution Guidelines

- Maintain TypeScript type safety
- Follow ESLint and Prettier rules
- Add tests to cover functionality
- Use [Conventional Commits](https://conventionalcommits.org/) format

## 🐛 Troubleshooting

### Common Issues

**Q: Terminal not displaying**
A: Restart VS Code or disable/enable the extension.

**Q: Commands not executing**
A: PTY communication issue. Restart VS Code and re-enable the extension.

**Q: Backspace key not working**
A: Special key handling has been fixed. Please use the latest version.

**Q: Buttons (Clear/New/Split) not functioning**
A: Button functionality has been implemented. Check WebView communication.

**Q: Shell not starting**
A: Check if the shell path in `sidebarTerminal.shell` setting is correct.

**Q: Japanese text garbled**
A: Change terminal character encoding to UTF-8. IME support has been added.

**Q: Performance issues**
A: Reduce concurrent terminals using `maxTerminals` setting.

### Debug Information

When reporting issues, please include:

- VS Code version
- Extension version
- OS and version
- Shell being used
- Error messages
- Steps to reproduce

## 📄 License

This project is licensed under [MIT License](LICENSE).

## 📝 Changelog

### v0.0.1 (In Development)

- Initial release
- Sidebar/Panel terminal display
- Multiple terminal management
- Split functionality (Split Button)
- PTY communication fixes and improvements
- Backspace key handling fixes
- Clear/New/Split button implementation
- IME (Japanese input) support
- Configuration customization

### Recent Fixes

- ✅ Fixed PTY communication issues
- ✅ Fixed Backspace key not working properly
- ✅ Fixed Clear/New/Split buttons not functioning
- ✅ Fixed WebView entry point (simple.ts → main.ts)
- ✅ Fixed TypeScript/ESLint errors
- ✅ Improved terminal execution environment
- ✅ Enhanced user guidance

## 🙏 Acknowledgments

This project uses the following excellent libraries:

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