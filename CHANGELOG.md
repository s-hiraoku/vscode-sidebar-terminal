# Change Log

All notable changes to the "Sidebar Terminal" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2025-01-15

### Added
- 🎉 **Initial VS Code Marketplace Release**
- ✨ **Core Terminal Features**
  - Fully integrated sidebar terminal interface
  - Advanced split terminal functionality with visual management
  - Support for up to 5 concurrent terminal sessions
  - Complete shell emulation with node-pty backend
  - Seamless VS Code workspace integration
  - Universal cross-platform support (Windows, macOS, Linux)

- 🎨 **Enhanced User Interface**
  - Professional xterm.js-based terminal emulation
  - Automatic VS Code theme synchronization (dark/light modes)
  - Intelligent terminal splitting with drag-and-drop resizing
  - Comprehensive status management with auto-hide notifications
  - Intuitive header controls with customizable icon opacity
  - Responsive design that adapts to sidebar dimensions

- ⚙️ **Extensive Configuration System**
  - **Terminal Behavior**: Shell selection, arguments, working directory
  - **Display & Theming**: Font customization, cursor settings, theme override
  - **Split & Layout**: Minimum heights, resize controls, split limits
  - **Status & Protection**: Kill confirmation, terminal protection, status timing
  - **UI Customization**: Header styling, icon sizes, opacity controls
  - **Performance Tuning**: Buffer settings, resize debouncing, resource limits

- 🔧 **Command Palette Integration**
  - `Sidebar Terminal: Split Terminal` - Create new terminal session
  - `Sidebar Terminal: Kill Terminal` - Close active terminal (with protection)
  - `Sidebar Terminal: Terminal Settings` - Open settings configuration panel
  - Full keyboard shortcut support for all standard terminal operations

- 💻 **Advanced Technical Implementation**
  - **Architecture**: Modern TypeScript with strict type safety
  - **Performance**: Optimized WebView with data buffering (60fps updates)
  - **Process Management**: Robust PTY lifecycle with infinite loop prevention
  - **Memory Management**: Intelligent resource cleanup and context retention
  - **Error Handling**: Comprehensive error recovery and user feedback
  - **Security**: Content Security Policy enforcement and input sanitization

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

### Technical Stack
- **Extension Framework**: VS Code Extension API 1.74.0+
- **Terminal Emulation**: xterm.js 5.3.0 with web-links and fit addons
- **Process Backend**: node-pty 1.0.0 with bundled dependencies
- **Build System**: Webpack 5.99.9 with dual-target compilation
- **Language**: TypeScript 5.3.3 with strict type checking
- **Dependencies**: Minimal runtime footprint with security-focused selection

### Platform Support
- ✅ Windows (cmd.exe, PowerShell)
- ✅ macOS (zsh, bash)
- ✅ Linux (bash, zsh, fish)

### Architecture
- **Extension Host**: Main extension logic and terminal management
- **WebView**: xterm.js-based terminal UI with split view support
- **PTY Layer**: System shell integration with node-pty
- **Configuration**: VS Code settings integration

### Performance Metrics
- **Memory Efficiency**: Optimized buffering for multiple concurrent terminals
- **Startup Performance**: Sub-second initialization with lazy component loading
- **Resource Management**: Proactive cleanup with terminal lifecycle tracking
- **Bundle Optimization**: ~443KB total (extension: 43KB, webview: 400KB)
- **Update Frequency**: 60fps terminal updates with intelligent batching
- **Context Retention**: Persistent terminal state when sidebar is hidden

### Security
- Content Security Policy (CSP) enforcement
- Sandboxed WebView execution
- Input validation and sanitization
- No external network dependencies

### Current Limitations
- Maximum 5 concurrent terminals (user-configurable)
- Terminal features dependent on underlying shell capabilities
- WebView bundle size optimized for functionality over minimal size
- Some platform-specific terminal behaviors may vary

### Roadmap Features
- [ ] Advanced terminal session persistence across VS Code restarts
- [ ] Custom terminal theme marketplace integration
- [ ] Built-in terminal content search and filtering
- [ ] Terminal history export and import functionality
- [ ] Enhanced keyboard shortcut customization
- [ ] Terminal sharing and collaboration features

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