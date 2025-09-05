# Secondary Terminal - VS Code Extension

[![Version](https://img.shields.io/visual-studio-marketplace/v/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![License](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)

A powerful VS Code extension that provides a fully-featured terminal in the sidebar with advanced AI agent integration, split terminal support, and comprehensive session management.

![Secondary Terminal Demo](resources/demo.gif)

## ✨ Key Features

### 🚀 **Advanced Terminal Management**
- **Sidebar Integration**: Dedicated terminal panel in the VS Code activity bar
- **Multiple Terminals**: Support for up to 5 concurrent terminal instances
- **Smart Session Persistence**: Automatically saves and restores terminal sessions across VS Code restarts
- **Terminal Recycling**: Efficient terminal number management (1-5) with automatic reuse
- **Cross-Platform Support**: Works seamlessly on Windows, macOS, and Linux

### 🤖 **AI Agent Integration**
- **Claude Code Support**: Full integration with `claude-code` commands and session restoration
- **GitHub Copilot Integration**: File reference shortcuts with `#file:` format (CMD+K CMD+C)
- **Gemini CLI Support**: Complete integration with `gemini code` commands
- **Real-time Status Tracking**: Live AI agent status indicators with connection/disconnection detection
- **Smart Toggle Controls**: One-click AI agent switching with status-aware button visibility

### 🔧 **Developer Experience**
- **Alt+Click Cursor Positioning**: VS Code-standard cursor positioning with intelligent CLI agent conflict detection
- **File Reference Shortcuts**: Quick file sharing with AI agents using @filename format (CMD+Option+L)
- **IME Support**: Full Japanese and multi-language input method support
- **Split Terminal Views**: Vertical and horizontal terminal splitting
- **Command Palette Integration**: Full VS Code command palette support

### 📊 **Performance & Monitoring**
- **Adaptive Performance**: Dynamic buffering optimization for AI agent output (250fps during active sessions)
- **Debug Panel**: Real-time system monitoring with Ctrl+Shift+D shortcut
- **Memory Management**: Efficient resource cleanup and leak prevention
- **Output Optimization**: Smart flushing intervals (2-16ms) based on activity patterns

## 🎯 Quick Start

### Installation

1. **From VS Code Marketplace**: Search for "Secondary Terminal" in the Extensions view
2. **From Command Line**: `code --install-extension s-hiraoku.vscode-sidebar-terminal`
3. **Manual Installation**: Download VSIX from [releases](https://github.com/s-hiraoku/vscode-sidebar-terminal/releases)

### First Use

1. Click the terminal icon in the activity bar or use `Ctrl+Shift+P` → "Focus Terminal"
2. The extension automatically creates an initial terminal with your default shell
3. Start using AI agents by running `claude-code "your command"` or `gemini code "your task"`

## 🔑 Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `CMD+Option+L` (Mac)<br>`Ctrl+Alt+L` (Win/Linux) | **File Reference** | Send current file to active AI agents with @filename format |
| `CMD+K CMD+C` (Mac)<br>`Ctrl+K Ctrl+C` (Win/Linux) | **Copilot Integration** | Activate GitHub Copilot Chat with #file: reference |
| `Alt+Click` | **Cursor Positioning** | Position terminal cursor (VS Code standard behavior) |
| `Ctrl+Shift+D` | **Debug Panel** | Toggle real-time system monitoring panel |
| `Ctrl+Shift+X` | **Export Diagnostics** | Export system diagnostics to clipboard |

## 🏗️ Architecture Overview

### Core Components

#### Extension Host (Node.js)
- **TerminalManager**: Manages PTY processes, terminal lifecycle, and AI agent detection
- **RefactoredSecondaryTerminalProvider**: WebView provider with comprehensive message handling
- **AI Agent Services**: Dedicated services for Claude, Gemini, and Copilot integration
- **Session Management**: Persistent terminal state across VS Code sessions

#### WebView (Browser Environment)
- **RefactoredTerminalWebviewManager**: Central coordinator for all WebView operations
- **Manager Ecosystem**: Specialized managers for Input, UI, Performance, Notifications, Splitting, and Configuration
- **xterm.js Integration**: Full-featured terminal emulation with custom enhancements

### Communication Flow
```
User Input → VS Code Commands → Extension Host → WebView Messages → xterm.js
                    ↕                      ↕                   ↕
              TerminalManager ←→ node-pty processes ←→ Shell/AI Agents
```

## 🤖 AI Agent Integration

### Supported AI Agents

#### Claude Code
- **Command Format**: `claude-code "your task description"`
- **Session Restoration**: Complete command history preservation
- **File References**: Direct file sharing with @filename syntax
- **Status Tracking**: Real-time connection/disconnection monitoring

#### GitHub Copilot
- **Integration**: Seamless chat activation with file context
- **File References**: #file: format for immediate context sharing
- **Keyboard Shortcut**: CMD+K CMD+C for instant activation

#### Gemini CLI
- **Command Format**: `gemini code "your development task"`
- **Full Integration**: Complete lifecycle management and session restoration
- **Smart Detection**: Automatic startup and termination detection

### AI Agent Features

- **Intelligent Status Management**: Automatic detection of agent startup, activity, and termination
- **Multi-Agent Support**: Handle multiple AI agents across different terminals
- **Performance Optimization**: 250fps output processing during active AI sessions
- **Conflict Resolution**: Smart Alt+Click disabling during AI agent activity

## ⚡ Performance Optimizations

### Dynamic Buffering System

The extension uses an advanced buffering system that adapts to different usage patterns:

- **Normal Operations**: 16ms flush intervals (~60fps)
- **Active Typing**: Immediate processing for responsive input
- **AI Agent Mode**: 2-4ms intervals (~250fps) for smooth AI output
- **Large Output**: Immediate processing for chunks >1000 characters

### Memory Management

- **Resource Cleanup**: Automatic disposal of terminals, listeners, and buffers
- **Leak Prevention**: Comprehensive cleanup on extension deactivation
- **Efficient Caching**: Smart caching of frequently accessed elements

## 🔧 Configuration Options

### Terminal Behavior
```json
{
  "secondaryTerminal.shell": "auto",
  "secondaryTerminal.shellArgs": [],
  "secondaryTerminal.maxTerminals": 5,
  "secondaryTerminal.enableCliAgentIntegration": true,
  "secondaryTerminal.enableGitHubCopilotIntegration": true
}
```

### Display Settings
```json
{
  "secondaryTerminal.fontSize": 14,
  "secondaryTerminal.fontFamily": "Monaco, 'Courier New', monospace",
  "secondaryTerminal.cursorBlink": true,
  "secondaryTerminal.theme": "dark"
}
```

### Performance Tuning
```json
{
  "secondaryTerminal.bufferFlushInterval": 16,
  "secondaryTerminal.maxBufferSize": 10000,
  "secondaryTerminal.enablePerformanceOptimization": true
}
```

## 🛠️ Development & Testing

### Building from Source

```bash
git clone https://github.com/s-hiraoku/vscode-sidebar-terminal.git
cd vscode-sidebar-terminal
npm install
npm run compile
```

### Testing

```bash
# Run unit tests (275+ tests)
npm test

# Test with coverage
npm run test:coverage

# Watch mode for TDD
npm run watch-tests
```

### Development Commands

```bash
npm run compile       # Build extension and webview
npm run watch         # Watch mode for development
npm run lint          # ESLint checking
npm run package       # Create production VSIX
```

### Quality Gates

The project maintains strict quality standards:
- **Test Coverage**: 85%+ with 275+ comprehensive tests
- **TDD Compliance**: 50%+ (targeting 85%)
- **ESLint**: Zero errors (warnings acceptable)
- **TypeScript**: Strict compilation with full type safety

## 🧪 Testing Strategy

### Comprehensive Test Suite

- **Unit Tests**: 275+ tests covering core functionality
- **Integration Tests**: End-to-end AI agent interaction scenarios
- **Performance Tests**: Buffer management and memory optimization
- **Edge Case Tests**: Error handling and resource cleanup

### Test Categories

1. **Terminal Management**: Creation, deletion, switching, and lifecycle
2. **AI Agent Integration**: Detection, status tracking, and command processing
3. **Session Persistence**: Save/restore functionality across restarts
4. **Performance**: Buffering, flushing, and memory management
5. **UI Components**: Header management, status displays, and user interactions

## 🐛 Troubleshooting

### Common Issues

#### Terminal Not Starting
```bash
# Check shell configuration
"secondaryTerminal.shell": "/bin/bash"  # or your preferred shell
```

#### AI Agent Not Detected
- Ensure AI agent integration is enabled in settings
- Verify the AI agent is properly installed and accessible
- Check the debug panel (Ctrl+Shift+D) for detection logs

#### Performance Issues
- Enable performance optimization in settings
- Check system resources and terminal count
- Use the debug panel to monitor buffer statistics

### Debug Tools

- **Debug Panel**: Ctrl+Shift+D for real-time system monitoring
- **Diagnostics Export**: Ctrl+Shift+X for comprehensive system information
- **Developer Console**: F12 for WebView debugging (development mode)

## 🚀 Release Process

### Automated CI/CD

The project uses GitHub Actions for automated testing and releases:

1. **Quality Gate**: TDD compliance and test coverage validation
2. **Multi-Platform Build**: Automatic VSIX generation for all supported platforms
3. **Marketplace Publishing**: Automatic publishing on version tags
4. **Release Notes**: Automated changelog generation

### Platform Support

- **Windows**: win32-x64, win32-arm64
- **macOS**: darwin-x64, darwin-arm64 (Apple Silicon)
- **Linux**: linux-x64, linux-arm64, linux-armhf
- **Alpine**: alpine-x64, alpine-arm64

## 📈 Version History

### v0.1.81 (Current) - 🔧 **TypeScript Quality Improvements**
- ✅ **CI/CD TypeScript エラー完全修正**: GitHub Actions Pre-Release Quality Gate 通過
- ✅ **MessageHandlerContext型定義改善**: より実用的で柔軟な型設計
- ✅ **コンパイル安定性確保**: webpack、tsc両方で完全成功
- ✅ **テストスイート完全対応**: 全テストファイルのTypeScriptコンパイル成功
- 🚀 **CI/CDパイプライン安定化**: 自動ビルド・テストの信頼性向上
- 📊 **ESLint品質維持**: エラー0個、警告154個（許容範囲）
- 🔍 **型チェック最適化**: 実用性と型安全性のバランス調整

### v0.1.80 - 🚑 **Critical Japanese Input Hotfix**
- 🇯🇵 **日本語入力完全修復**: 日本語・ひらがな・カタカナ・漢字変換が100%確実に動作
- ⚡ **即座の入力処理**: IME compositionend後の遅延処理を完全削除し、瞬時の入力反映を実現
- 🔧 **シンプル化されたIME処理**: 過剰な二重チェックとバッファー処理を削除、軽量で確実な動作
- 🏥 **緊急品質修正**: v0.1.78で発生した日本語入力完全阻害問題を即座に解決
- 📦 **軽量化**: WebView 2KB削減 (962KB→960KB) でパフォーマンス向上
- ✅ **VS Code標準品質**: VS Code統合ターミナルと同等レベルの多言語入力サポート

### v0.1.79
- 📚 **リリースノート整備**: 包括的なリリース情報とドキュメント更新

### v0.1.78
- 🏗️ **Service-Oriented Architecture**: Extracted WebView HTML generation and message routing services
- 📦 **WebView HTML Generation Service**: Centralized HTML generation with CSP security and nonce management
- 🔄 **Message Routing Service**: Plugin-based message handler architecture with 20+ command support
- 🎯 **Unified Provider Coordinator**: Reduced SecondaryTerminalProvider complexity by 33% (2,122→1,400 lines)
- ⚡ **Enhanced Type Safety**: Fixed critical TypeScript compilation errors and improved type definitions
- 🧪 **Comprehensive Testing**: Added 900+ lines of tests for new services with edge case coverage
- 📚 **Documentation Updates**: Enhanced CLAUDE.md guidelines and architectural documentation

### v0.1.77
- ✨ **Enhanced AI Agent Integration**: Improved Claude Code and Gemini CLI detection
- 🔧 **Performance Optimizations**: Dynamic buffering system for AI agent output
- 🐛 **Critical Fixes**: Resolved terminal deletion race conditions and memory leaks
- 📚 **Documentation**: Comprehensive README and implementation guides

### v0.1.73
- 🔄 **Refactored Architecture**: Complete WebView manager system overhaul
- ⚡ **Performance Improvements**: Optimized terminal rendering and resource management
- 🧪 **Enhanced Testing**: 275+ comprehensive tests with 93% success rate

### v0.1.55
- 🎯 **AI Agent Status Fix**: Resolved flickering status indicators during execution
- 🔧 **Detection Improvements**: Enhanced startup and termination pattern recognition
- 📊 **Stability Enhancements**: Improved state management and error handling

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow TDD practices: Write tests first, then implement
4. Ensure all quality gates pass: `npm run pre-release:check`
5. Submit a pull request with detailed description

### Code Standards

- **TypeScript**: Strict typing with comprehensive interfaces
- **Testing**: TDD approach with comprehensive test coverage
- **Documentation**: Clear inline comments and updated guides
- **Performance**: Memory-efficient implementations with proper cleanup

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋 Support

- **Issues**: [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
- **Discussions**: [GitHub Discussions](https://github.com/s-hiraoku/vscode-sidebar-terminal/discussions)
- **Marketplace**: [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)

---

**Built with ❤️ for VS Code developers working with AI agents**

*Supports Claude Code, GitHub Copilot, Gemini CLI, and more*