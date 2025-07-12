# VS Code Sidebar Terminal

[![GitHub license](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
[![GitHub stars](https://img.shields.io/github/stars/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/stargazers)

A VS Code extension that displays a terminal in the sidebar for efficient development workflow. The terminal is placed in the Primary Sidebar (left side) to support productive development.

## 🚀 Features

- **Sidebar Placement**: Display terminal in Primary Sidebar (left side)
- **Multiple Terminal Management**: Run up to 5 terminals simultaneously
- **Full Terminal Functionality**: Complete shell execution environment using node-pty
- **Key Input Support**: Support for special keys like Backspace, Ctrl+C, Ctrl+L
- **Button Controls**: Intuitive operation with Clear, New, Split buttons
- **IME Support**: Multi-language input support including Japanese
- **Visual Focus Indicators**: Active terminal highlighted with colored border
- **Customizable**: Configurable font, size, and shell settings
- **Cross-Platform**: Windows, macOS, Linux support

## 📦 Installation

### From VS Code Marketplace

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

### Basic Operations

1. **Open Terminal**: Click "Terminal" view in Explorer panel
2. **Create New Terminal**: Click "New" button in terminal
3. **Split Terminal**: Click "Split" button in terminal
4. **Clear Terminal**: Click "Clear" button in terminal
5. **Execute Commands**: Type commands like in a regular terminal

### Placement

#### Primary Sidebar (Left Side)
- Terminal is displayed in the left Explorer panel
- Located in the same area as other sidebar views, switchable with tabs

### Command Palette

- `Sidebar Terminal: Create New Terminal` - Create new terminal
- `Sidebar Terminal: Split Terminal` - Split terminal
- `Sidebar Terminal: Clear Terminal` - Clear active terminal
- `Sidebar Terminal: Kill Terminal` - Kill active terminal

## ⚙️ Configuration

Customize the following settings in VS Code's `settings.json`:

```json
{
  "sidebarTerminal.shell": "",
  "sidebarTerminal.shellArgs": [],
  "sidebarTerminal.fontSize": 14,
  "sidebarTerminal.fontFamily": "Consolas, 'Courier New', monospace",
  "sidebarTerminal.maxTerminals": 5
}
```

### Configuration Details

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `shell` | string | "" | Path to shell executable (empty for system default) |
| `shellArgs` | array | [] | Arguments to pass to shell |
| `fontSize` | number | 14 | Terminal font size |
| `fontFamily` | string | "Consolas, 'Courier New', monospace" | Terminal font family |
| `maxTerminals` | number | 5 | Maximum number of concurrent terminals |

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