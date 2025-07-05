# Change Log

All notable changes to the "Sidebar Terminal" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2024-01-15

### Added
- 🎉 Initial release of VS Code Sidebar Terminal
- ✨ **Core Features**
  - Terminal display in VS Code sidebar (Explorer panel)
  - Multiple terminal management (up to 5 terminals)
  - Tab-based terminal switching with intuitive UI
  - Terminal split functionality for side-by-side view
  - Cross-platform support (Windows, macOS, Linux)

- 🎨 **User Interface**
  - Clean and intuitive terminal interface using xterm.js
  - VS Code theme integration (dark/light mode support)
  - Resizable terminal panes
  - Terminal tabs with close buttons
  - Split terminal button in title bar

- ⚙️ **Configuration Options**
  - Customizable shell selection (`sidebarTerminal.shell`)
  - Font size and family settings (`sidebarTerminal.fontSize`, `sidebarTerminal.fontFamily`)
  - Shell arguments configuration (`sidebarTerminal.shellArgs`)
  - Maximum terminal limit setting (`sidebarTerminal.maxTerminals`)

- 🔧 **Commands**
  - `Sidebar Terminal: Create New Terminal` - Create a new terminal instance
  - `Sidebar Terminal: Split Terminal` - Split the current terminal view
  - `Sidebar Terminal: Clear Terminal` - Clear the active terminal content
  - `Sidebar Terminal: Kill Terminal` - Close the active terminal

- 💻 **Technical Features**
  - TypeScript implementation with full type safety
  - WebView-based architecture for performance
  - PTY process management with node-pty
  - Memory-efficient terminal handling
  - Proper resource cleanup and disposal

- 🧪 **Quality Assurance**
  - Comprehensive unit tests for core functionality
  - Integration tests for component interaction
  - E2E tests for user workflow validation
  - ESLint and Prettier code formatting
  - CI/CD pipeline with GitHub Actions

- 📦 **Development Tools**
  - Webpack-based build system
  - Hot reload development environment
  - Automated testing and linting
  - VSIX packaging for distribution

### Technical Details
- **Framework**: VS Code Extension API 1.74.0+
- **Terminal Emulator**: xterm.js 5.3.0
- **Process Management**: node-pty 1.0.0
- **Build System**: Webpack 5.89.0
- **Language**: TypeScript 5.3.3

### Platform Support
- ✅ Windows (cmd.exe, PowerShell)
- ✅ macOS (zsh, bash)
- ✅ Linux (bash, zsh, fish)

### Architecture
- **Extension Host**: Main extension logic and terminal management
- **WebView**: xterm.js-based terminal UI with split view support
- **PTY Layer**: System shell integration with node-pty
- **Configuration**: VS Code settings integration

### Performance
- **Memory Usage**: Optimized for multiple terminal instances
- **Startup Time**: Fast initialization with lazy loading
- **Resource Management**: Automatic cleanup of inactive terminals
- **Bundle Size**: ~308KB total (extension + webview)

### Security
- Content Security Policy (CSP) enforcement
- Sandboxed WebView execution
- Input validation and sanitization
- No external network dependencies

### Known Limitations
- Maximum 5 concurrent terminals (configurable)
- WebView bundle size may affect initial load time
- Some terminal features depend on shell capabilities

### Planned Features
- [ ] Horizontal terminal splitting
- [ ] Terminal session persistence
- [ ] Custom terminal themes
- [ ] Integrated terminal search
- [ ] Terminal export functionality

---

## Development Notes

### Build Information
- Built with modern TypeScript and ES2020 target
- Bundled with Webpack for optimal performance
- All dependencies are production-ready versions
- Tested on multiple operating systems

### Contributing
This project follows [Conventional Commits](https://conventionalcommits.org/) for commit messages and maintains high code quality standards with automated testing and linting.

### Feedback
Please report issues, suggest features, or contribute to the project on [GitHub](https://github.com/s-hiraoku/vscode-sidebar-terminal).

---

**Enjoy the enhanced terminal experience in VS Code! 🚀**