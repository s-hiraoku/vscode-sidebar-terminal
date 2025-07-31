# Change Log

All notable changes to the "Sidebar Terminal" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.35] - 2025-07-31

### Added

- **Session Persistence**: Complete terminal session restore functionality
  - Automatic terminal content and state restoration after VS Code restart
  - Scrollback history preservation (up to 1000 lines per terminal)
  - Multi-terminal support with individual state management
  - Configurable session persistence settings
  - 7-day session expiration with automatic cleanup
- **CLI Agent Integration**: File reference shortcuts for AI assistants
  - Claude Code integration with `@filename` format (`Cmd+Option+L`)
  - GitHub Copilot integration with `#file:filename` format (`Cmd+K Cmd+C`)
  - Independent configuration for each integration
  - Line range support for precise code references
- **Cross-Platform Native Binaries**: Platform-specific extension builds
  - Individual builds for Windows (x64, ARM64), macOS (Intel, Apple Silicon), Linux (x64, ARM64, ARMhf), and Alpine
  - Automatic platform detection and optimal binary selection
  - Improved performance with native node-pty compilation

### Changed

- **Production-Ready Logging**: Comprehensive logging system overhaul
  - Removed excessive debug logs and console.log statements
  - Implemented appropriate log levels for production environment
  - Maintained essential error logging and user feedback
- **Code Quality Improvements**: Extensive codebase cleanup
  - Removed unused code and commented-out implementations
  - Deleted obsolete files (OptimizedLogger, VSCodeTerminalSender, etc.)
  - Cleaned up session manager implementations
  - Removed TODO comments and unimplemented features
- **Configuration Enhancements**: Updated settings with new options
  - Added CLI agent integration toggles
  - Session persistence configuration options
  - Scrollback history management settings

### Removed

- Unused session manager classes (SimpleSessionManager, SessionManager)
- Obsolete ScrollbackSessionManager.ts.disabled file
- Redundant type definitions (scrollback-session.ts, simple-session.ts)
- Excessive debug logging throughout codebase
- Commented-out code blocks and unimplemented features
- Duplicate bundleDependencies configuration in package.json

### Fixed

- Package.json configuration cleanup and validation
- Consistent logging patterns across all components
- Proper resource cleanup and memory management

### Technical Improvements

- Enhanced TypeScript type safety
- Improved error handling and user feedback
- Optimized build process for multiple platforms
- Streamlined codebase structure and maintainability

## [0.1.25] - 2025-07-18

### Changed

- **WebView Architecture Refactoring**
  - Transformed monolithic `main.ts` into a modular system with 9 focused managers (Performance, CliAgent, Input, UI, Config, Message, Notification, TerminalCoordinator).
  - Achieved significant improvements in code organization, maintainability, and performance.
  - Implemented intelligent buffering, debounced operations, and efficient resource management.
- Updated extension icon path to use SVG format (`resources/icon.svg`) for improved scalability and display consistency.

### Added

- Active terminal border visualization
  - 1px border around the terminal with cursor focus
  - Blue border (--vscode-focusBorder) for active terminal
  - Gray border (--vscode-widget-border) for inactive terminals
  - Smooth transition animations (0.2s)
  - Visual feedback for terminal focus state.
  - Enhanced type safety through comprehensive interfaces and strong typing.

## [0.0.1] - 2025-07-11

### Added

- Initial release of Sidebar Terminal extension
- **Core Features**:
  - Terminal integration in VS Code Primary Sidebar (Explorer panel)
  - Multiple terminal management (up to 5 concurrent terminals)
  - Split terminal functionality with flexible layout
  - Clear, New, and Split button controls
  - Full shell execution environment powered by node-pty

- **Platform Support**:
  - Cross-platform compatibility (Windows, macOS, Linux)
  - IME support for multi-language input (Japanese, Chinese, Korean)
  - Special key handling (Backspace, Ctrl+C, Ctrl+L, etc.)

- **Advanced Features**:
  - Alt+Click cursor positioning with VS Code standard behavior
  - CLI Agent detection for optimal performance during AI interactions
  - Visual feedback with blue cursor highlight and fade animation
  - Automatic conflict resolution for terminal output interference

- **Customization Options**:
  - Configurable shell and shell arguments
  - Font family and size customization
  - Terminal theme support (auto/dark/light)
  - Cursor blinking controls
  - Maximum terminal count settings

- **Developer Experience**:
  - Comprehensive testing strategy with 47 test cases
  - Modern testing tooling (nyc, Mocha, Chai, Sinon, JSDOM)
  - Multi-platform CI/CD pipeline
  - Code coverage reporting with 85% target
  - ESLint and Prettier integration

### Technical Implementation

- **Architecture**: Clean separation between extension host (Node.js) and WebView (browser)
- **Terminal Rendering**: xterm.js for high-performance terminal emulation
- **Process Management**: node-pty for cross-platform PTY support
- **State Management**: Centralized TerminalManager for multi-terminal coordination
- **Communication**: Event-driven architecture with proper message handling

### Testing & Quality Assurance

- **Unit Tests**: 47 test cases covering core functionality
  - DOM manipulation utilities (22 tests)
  - Notification system (8 tests)
  - Alt+Click functionality (17 tests)
- **Integration Tests**: VS Code extension testing with mocked APIs
- **Code Coverage**: Comprehensive coverage reporting with nyc (Istanbul)
- **CI/CD**: GitHub Actions workflow for multi-platform testing
- **Code Quality**: ESLint, Prettier, and TypeScript strict mode

### Fixed Issues

- ✅ PTY communication reliability improvements
- ✅ Backspace key and special character handling
- ✅ WebView entry point resolution (simple.ts → main.ts)
- ✅ Clear/New/Split button functionality
- ✅ TypeScript and ESLint error resolution
- ✅ Cross-platform terminal execution environment
- ✅ User guidance and error handling enhancements

### Performance Optimizations

- **Output Buffering**: Adaptive buffering (8ms vs 16ms) for optimal performance
- **CLI Agent Detection**: Automatic performance optimization during AI interactions
- **Memory Management**: Proper cleanup and disposal patterns
- **Resize Handling**: Debounced terminal resize operations

### Security & Reliability

- **Input Validation**: Comprehensive input sanitization
- **Error Handling**: Graceful degradation and user-friendly error messages
- **Resource Management**: Proper cleanup of PTY processes and WebView resources
- **Security Testing**: CodeQL analysis and dependency vulnerability scanning

---

## Development Notes

### Testing Strategy Evolution

This release implements a comprehensive 3-phase testing strategy:

- **Phase 1** ✅: Modern testing infrastructure (nyc, Sinon, Chai, JSDOM)
- **Phase 2** 🔄: WebView component testing (partially complete)
- **Phase 3** 📋: Advanced testing strategies (planned for future releases)

### Architecture Highlights

The extension follows VS Code best practices with:

- Clean separation of concerns between extension host and WebView
- Event-driven communication patterns
- Proper resource management and cleanup
- TypeScript strict mode for type safety
- Comprehensive error handling and user feedback

### Compatibility Notes

- **VS Code**: Requires VS Code 1.74.0 or higher
- **Node.js**: Requires Node.js 18.0.0 or higher
- **Operating Systems**: Full support for Windows 10+, macOS 10.15+, Ubuntu 18.04+

---

For more details about features and usage, see the [README](README.md).
For reporting issues or feature requests, visit our [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues).
