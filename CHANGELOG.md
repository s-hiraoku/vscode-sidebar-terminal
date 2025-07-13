# Change Log

All notable changes to the "Sidebar Terminal" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planning
- Enhanced terminal session persistence
- Custom themes and color schemes
- Advanced keyboard shortcuts

## [0.1.14] - 2025-07-13

### Fixed
- **Critical**: 根本的なマルチプラットフォーム対応問題を解決
- **node-pty**: package.json依存関係重複とバージョン不一致を解消
- **Error Handling**: Mach-O, ELF, DLL対応の詳細エラーメッセージ追加
- **macOS**: "slice is not valid mach-o file"エラーの詳細診断
- **Linux**: アーキテクチャミスマッチの詳細検出
- **Windows**: VC++ Redistributables要件の案内
- **CI/CD**: GitHub Actionsワークフロー重複削除と最適化
- **Build**: プラットフォーム固有ネイティブバイナリ検証機能追加
- **Diagnostics**: VS Code 1.75+ activationEvents自動生成対応

### Technical Improvements
- bundledDependencies設定の重複削除
- vscode:prepublishスクリプト最適化
- ネイティブモジュールビルド検証の自動化
- プラットフォーム診断機能の強化

### Scripts Added
- `scripts/test-local-build.sh` - ローカルビルドテスト
- `scripts/package-all-platforms.sh` - マルチプラットフォームパッケージング改善

## [0.1.13] - 2025-07-13

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
  - Claude Code detection for optimal performance during AI interactions
  - Visual feedback with blue cursor highlight and fade animation
  - Automatic conflict resolution for terminal output interference
  - Active terminal border visualization with smooth transitions
  - Multi-platform node-pty support with enhanced error handling

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
- **Claude Code Detection**: Automatic performance optimization during AI interactions
- **Memory Management**: Proper cleanup and disposal patterns
- **Resize Handling**: Debounced terminal resize operations

### Security & Reliability
- **Input Validation**: Comprehensive input sanitization
- **Error Handling**: Graceful degradation and user-friendly error messages
- **Resource Management**: Proper cleanup of PTY processes and WebView resources
- **Security Testing**: CodeQL analysis and dependency vulnerability scanning

## [0.2.0] - Future Release (Planned)

### Planned Features
- **Enhanced Testing**: Complete Phase 2 WebView component testing
  - SplitManager comprehensive test suite
  - HeaderManager functionality tests
  - SettingsPanel component testing
- **Advanced Testing**: Phase 3 implementation
  - Performance testing framework
  - Accessibility testing with axe-core
  - Load testing for multiple terminals
- **User Experience**:
  - Terminal session persistence
  - Custom themes and color schemes
  - Enhanced keyboard shortcuts
  - Terminal history management

---

## Development Notes

### Testing Strategy Evolution
This release implements a comprehensive 3-phase testing strategy:

- **Phase 1** ✅: Modern testing infrastructure (nyc, Sinon, Chai, JSDOM)
- **Phase 2** 🔄: WebView component testing (partially complete)
- **Phase 3** 📋: Advanced testing strategies (planned for v0.0.2)

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