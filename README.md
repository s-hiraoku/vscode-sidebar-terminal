# Secondary Terminal - VS Code Extension

[![Version](https://img.shields.io/visual-studio-marketplace/v/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![License](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)

**The Essential Tool for the CLI Coding Agent Era** - A production-ready terminal extension designed for developers who need more than VS Code's standard terminal. Manage up to 5 terminals across sidebar and panel with exceptional compatibility for Claude Code, Gemini CLI, and GitHub Copilot. Features complete TypeScript compliance with ProcessState/InteractionState management for maximum reliability.

> ⚠️ **Active Development Notice**: This extension is under active development with new features being added continuously. Please expect some bugs and incomplete functionality as we work to improve the experience.

![Secondary Terminal Demo](resources/demo.gif)

## ✨ Key Features

### 🚀 **Advanced Terminal Management**
- **VS Code Standard Compliance**: Complete ProcessState enum implementation (Uninitialized, Launching, Running, KilledDuringLaunch, KilledByUser, KilledByProcess)
- **InteractionState Tracking**: Advanced state management with None, ReplayOnly, and Session states
- **Production-Ready Architecture**: Zero TypeScript compilation errors with 562 KiB extension and 1.05 MiB webview builds
- **Sidebar Integration**: Dedicated terminal panel in the VS Code activity bar
- **Multiple Terminals**: Support for up to 5 concurrent terminal instances
- **Smart Session Persistence**: Automatically saves and restores terminal sessions across VS Code restarts
- **Terminal Recycling**: Efficient terminal number management (1-5) with automatic reuse
- **Enhanced Error Handling**: Robust error recovery mechanisms following VS Code standards
- **Cross-Platform Support**: Works seamlessly on Windows, macOS, and Linux

### 🤖 **AI Agent Integration**
- **Enhanced Detection Engine**: Improved CLI agent detection with advanced pattern recognition
- **Claude Code Support**: Full integration with `claude-code` commands and session restoration
- **CodeRabbit CLI Integration**: Custom slash command support for AI code reviews with smart mode selection
- **GitHub Copilot Integration**: File reference shortcuts with `#file:` format (CMD+K CMD+C)
- **Gemini CLI Support**: Complete integration with `gemini code` commands
- **Real-time Status Tracking**: Live AI agent status indicators with connection/disconnection detection
- **Smart Toggle Controls**: One-click AI agent switching with status-aware button visibility
- **Manual Reset Functionality**: Force reconnect AI agents when detection issues occur
- **Timeout-based Detection**: Intelligent timeout handling for reliable state management

### 🔧 **Developer Experience**
- **Alt+Click Cursor Positioning**: VS Code-standard cursor positioning with intelligent CLI agent conflict detection
- **Smart File Reference System**: Instantly share code with AI agents using CMD+Option+L - automatically targets "AI Agent Connected" terminals
- **Multi-Agent Workflow**: Seamlessly work with multiple AI agents across different terminals simultaneously
- **IME Support**: Full Japanese and multi-language input method support
- **Split Terminal Views**: Vertical and horizontal terminal splitting optimized for AI agent workflows
- **Command Palette Integration**: Full VS Code command palette support

### 📊 **Performance & Monitoring**
- **Production-Grade Quality**: Zero TypeScript compilation errors with comprehensive ESLint compliance (0 errors, 333 acceptable warnings)
- **Optimized Build Process**: 562 KiB extension + 1.05 MiB webview builds with stable performance
- **Adaptive Performance**: Dynamic buffering optimization for AI agent output (250fps during active sessions)
- **Debug Panel**: Real-time system monitoring with Ctrl+Shift+D shortcut
- **Memory Management**: Efficient resource cleanup and leak prevention
- **Output Optimization**: Smart flushing intervals (2-16ms) based on activity patterns
- **Subtle Notifications**: Improved visual design with reduced opacity and VS Code integration

## 🎯 Quick Start

### Why Secondary Terminal?

> *"With CLI coding agents becoming widespread these days, isn't VS Code's standard terminal alone sometimes insufficient?"*

Optimized for modern developers who need to use multiple AI agents simultaneously and efficiently send file references. Perfect for the era where AI-powered coding assistants are essential development tools.

### Installation

1. **From VS Code Marketplace**: Search for "Secondary Terminal" in the Extensions view
2. **From Command Line**: `code --install-extension s-hiraoku.vscode-sidebar-terminal`
3. **Manual Installation**: Download VSIX from [releases](https://github.com/s-hiraoku/vscode-sidebar-terminal/releases)

### First Use

1. Click the terminal icon in the activity bar or use `Ctrl+Shift+P` → "Focus Terminal"
2. The extension automatically creates an initial terminal with your default shell
3. Start using AI agents by running `claude-code "your command"` or `gemini code "your task"`
4. Look for "AI Agent Connected" status indicator to confirm agent connection

> 📖 **Want more details?** Check out our [comprehensive blog article](https://zenn.dev/hiraoku/articles/0de654620028a0) for detailed usage examples and advanced workflows.

## 🔑 Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `CMD+Option+L` (Mac)<br>`Ctrl+Alt+L` (Win/Linux) | **File Reference** | Send current file to "AI Agent Connected" terminals with @filename format - essential for efficient AI agent workflows |
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

Secondary Terminal is specifically designed to work seamlessly with modern CLI coding agents. Here's how to get the most out of each supported agent:

### 🎯 Getting Started with AI Agents

#### Step 1: Launch Your AI Agent
Choose your preferred AI agent and launch it in Secondary Terminal:

```bash
# Claude Code (Anthropic)
claude-code "help me with this React component"

# Gemini CLI (Google)
gemini code "optimize this Python function"

# For GitHub Copilot - use the keyboard shortcut
# CMD+K CMD+C (Mac) or Ctrl+K Ctrl+C (Win/Linux)
```

#### Step 2: Look for Connection Status
Watch for the **"AI Agent Connected"** indicator in the terminal header - this shows which terminals are actively connected to AI agents.

#### Step 3: Use File References
Press `CMD+Option+L` (Mac) or `Ctrl+Alt+L` (Win/Linux) while editing a file to instantly share it with connected AI agents using the `@filename` format.

### 🔧 Supported AI Agents

#### Claude Code (Anthropic)
- **Launch Command**: `claude-code "your task description"`
- **File Sharing**: Automatic `@filename` references via CMD+Option+L
- **Session Persistence**: Complete command history and context restoration across VS Code restarts
- **Status Detection**: Real-time connection/disconnection monitoring
- **Best For**: Complex reasoning tasks, code refactoring, architectural decisions

#### GitHub Copilot
- **Activation**: `CMD+K CMD+C` (Mac) or `Ctrl+K Ctrl+C` (Win/Linux)
- **File Context**: Automatically includes current file with `#file:` reference
- **Integration**: Seamless VS Code native chat experience
- **Status Tracking**: Shows when Copilot Chat is active
- **Best For**: Code completion, quick fixes, inline suggestions

#### CodeRabbit CLI
- **Slash Command**: `/coderabbit` (when using Claude Code)
- **Mode Selection**:
  - `--prompt-only`: Optimized for AI agent integration
  - `--plain`: Detailed human-readable feedback
- **Custom Flags**: Full support for CodeRabbit CLI arguments
- **Best For**: Code reviews, quality analysis, security audits

#### Gemini CLI (Google)
- **Launch Command**: `gemini code "your development task"`
- **Session Management**: Complete lifecycle tracking and restoration
- **Auto-Detection**: Intelligent startup and termination recognition
- **File References**: Full `@filename` support
- **Best For**: Code generation, debugging, performance optimization

### 🚀 Advanced AI Workflows

#### Multi-Agent Workflow
1. **Launch multiple agents** in different terminals:
   ```bash
   # Terminal 1: Claude Code for architecture
   claude-code "help design this system"

   # Terminal 2: Gemini for implementation
   gemini code "implement the user service"
   ```

2. **Share files efficiently** using CMD+Option+L to send the same file to all connected agents

3. **Switch between contexts** using terminal tabs while maintaining separate conversations

#### File Reference System
- **Automatic Detection**: Extension automatically detects "AI Agent Connected" terminals
- **Smart Targeting**: CMD+Option+L sends files only to connected AI agents
- **Format Consistency**: Uses standardized `@filename` format across all agents
- **Context Preservation**: Maintains file references across terminal sessions

### 🎛️ AI Agent Configuration

#### Detection Settings
```json
{
  "secondaryTerminal.enableCliAgentIntegration": true,
  "secondaryTerminal.enableGitHubCopilotIntegration": true,
  "secondaryTerminal.focusAfterAtMention": true
}
```

#### Performance Tuning for AI Agents
- **High-Speed Output**: 250fps processing during active AI sessions
- **Smart Buffering**: Adaptive buffering based on agent activity
- **Memory Optimization**: Efficient cleanup of agent sessions

### 🔍 Troubleshooting AI Agents

#### Agent Not Detected?
1. Check the terminal header for "AI Agent Connected" status
2. Verify the agent is properly installed and accessible
3. Use the debug panel (Ctrl+Shift+D) for detection logs
4. Try the manual reset functionality if needed

#### File References Not Working?
1. Ensure `secondaryTerminal.enableCliAgentIntegration` is enabled
2. Verify you're using CMD+Option+L (not Ctrl+Alt+L on Mac)
3. Check that at least one terminal shows "AI Agent Connected"
4. Try refreshing the terminal connection

### 💡 Pro Tips

- **Use Split Terminals**: Keep multiple AI agents visible simultaneously
- **Session Persistence**: Your AI conversations are automatically restored after VS Code restarts
- **Keyboard Efficiency**: Master CMD+Option+L for instant file sharing
- **Debug Panel**: Use Ctrl+Shift+D to monitor AI agent status in real-time

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

### v0.1.94 (Current) - 📚 **Comprehensive AI Agent Documentation & Enhanced UX**
- 📖 **Complete AI Agent Guide**: Added comprehensive documentation for Claude Code, Gemini CLI, GitHub Copilot, and CodeRabbit CLI integration
- 🎯 **CLI Agent Era Positioning**: Enhanced value proposition for modern AI-assisted development workflows
- 🔧 **Multi-Agent Workflows**: Detailed documentation for advanced multi-agent usage patterns and best practices
- 🚀 **Development Transparency**: Clear development status communication with bug acknowledgment and user expectations
- 📝 **Documentation Excellence**: Completely revamped README.md with step-by-step guides and troubleshooting
- 🌐 **Zenn Blog Integration**: Added references to comprehensive Japanese blog article for detailed usage examples

### v0.1.86 - 🔧 **AI Agent Toggle Enhancement**
- 📎 **AI Agentトグル改善**: クリップボタンでconnectedエージェント移動時、前のconnectedをdisconnectedに変更
- ⚡ **シームレスな状態遷移**: より直感的なAI Agent切り替え動作
- 🎨 **Toaster通知の控えめ化**: 25%透明度向上とカラー調整で視覚的な邪魔を軽減

### v0.1.85 - 🚑 **Critical Cleanup & Manual Reset**
- 🗑️ **重複コード削除**: `src/integration/`フォルダ全体と未使用ファイル完全削除
- 🔄 **手動リセット機能**: AI Agent検知エラー時の強制再接続機能追加
- 🎯 **コードベース整理**: 実際に使用されているコードのみ保持
- ✅ **検知精度向上**: 過剰検知への対応策実装

### v0.1.84 - 🚑 **日本語入力完全修復+品質改善**
- 🇯🇵 **日本語入力問題の完全解決**: `terminal.onData()`でのIME入力ブロックを削除
- ✅ **VS Code標準準拠**: 統合ターミナルと同等のIME処理品質を実現
- ✅ **IME確定文字の確実反映**: ひらがな・カタカナ・漢字変換が100%動作
- ⚡ **xterm.js内蔵処理委任**: 安定性向上と遅延ゼロ実現
- 🔧 **根本原因修正**: `isIMEComposing()`による不適切な入力ブロック削除
- 📊 **ESLintエラー大幅削減**: 21個→11個（48%削減）で品質向上

### v0.1.81 - 🔧 **TypeScript Quality Improvements**
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

We welcome contributions! Please see our [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues) to get started.

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

## 🙋 Support & Contributing

> 🚧 **Development Status**: This extension is actively being developed with frequent updates. New features are continuously being added, and there may be some bugs or incomplete functionality. We appreciate your patience and feedback!

### Get Help & Report Issues

- **Issues**: [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues) - Report bugs or request features
- **Discussions**: [GitHub Discussions](https://github.com/s-hiraoku/vscode-sidebar-terminal/discussions)
- **Marketplace**: [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
- **Blog Article**: [Detailed Introduction (Japanese)](https://zenn.dev/hiraoku/articles/0de654620028a0) - Comprehensive guide to features and use cases

### Known Limitations

- Some features may be incomplete or have rough edges
- New releases are frequent as we continuously add functionality
- Documentation is being updated regularly to keep pace with development

---

**Built with ❤️ for VS Code developers working with AI agents**

*Supports Claude Code, GitHub Copilot, Gemini CLI, and more*