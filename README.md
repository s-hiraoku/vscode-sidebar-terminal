# Secondary Terminal - VS Code Extension

[![Version](https://img.shields.io/visual-studio-marketplace/v/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![License](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)

**The Essential Tool for the CLI Coding Agent Era** - A production-ready terminal extension designed for developers who need more than VS Code's standard terminal. Manage up to 5 terminals across sidebar and panel with exceptional compatibility for Claude Code, Codex CLI, Gemini CLI, and GitHub Copilot. Features complete TypeScript compliance with ProcessState/InteractionState management for maximum reliability.

> ⚠️ **Active Development Notice**: This extension is under active development with new features being added continuously. Please expect some bugs and incomplete functionality as we work to improve the experience.

![Secondary Terminal Demo](resources/demo.gif)

## ✨ Key Features

### 🚀 **Advanced Terminal Management**
- **VS Code Standard Compliance**: Complete ProcessState enum implementation (Uninitialized, Launching, Running, KilledDuringLaunch, KilledByUser, KilledByProcess)
- **InteractionState Tracking**: Advanced state management with None, ReplayOnly, and Session states
- **Production-Ready Architecture**: Zero TypeScript compilation errors with 562 KiB extension and 1.05 MiB webview builds
- **Sidebar Integration**: Dedicated terminal panel in the VS Code activity bar
- **Multiple Terminals**: Support for up to 5 concurrent terminal instances
- **Smart Session Persistence**: Automatically saves and restores terminal sessions across VS Code restarts with up to 1,000 lines of scrollback per terminal
  - **Issue #188**: Fixed session restoration not working (v0.1.120)
  - **Issue #201**: Fixed scrollback restoration after window reload with Promise-based response handling and fallback mechanism
- **Terminal Recycling**: Efficient terminal number management (1-5) with automatic reuse
- **Enhanced Error Handling**: Robust error recovery mechanisms following VS Code standards
- **Cross-Platform Support**: Works seamlessly on Windows, macOS, and Linux

### 🤖 **AI Agent Integration**
- **Enhanced Detection Engine**: Improved CLI agent detection with advanced pattern recognition
- **Claude Code Support**: Full integration with `claude-code` commands and session restoration (detects "Claude Code" startup message)
- **Codex CLI Support**: Complete integration with `codex` commands and AI-powered development assistance
- **CodeRabbit CLI Integration**: Custom slash command support for AI code reviews with smart mode selection
- **GitHub Copilot Integration**: File reference shortcuts with `#file:` format (CMD+K CMD+C)
- **Gemini CLI Support**: Complete integration with `gemini code` commands
- **Always-Visible Status**: AI agent status remains permanently visible once detected (v0.1.101+)
- **Real-time Status Tracking**: Live AI agent status indicators with connection/disconnection detection
- **Smart Toggle Controls**: One-click AI agent switching with status-aware button visibility
- **Manual Reset Functionality**: Force reconnect AI agents when detection issues occur
- **Timeout-based Detection**: Intelligent timeout handling for reliable state management

### 🔧 **Developer Experience**
- **Copy/Paste Support**: Full clipboard integration with standard keyboard shortcuts (Ctrl+C/V or Cmd+C/V) for seamless text operations (v0.1.138+)
  - Reliability improvements in v0.1.141+: selection from the sidebar WebView terminal is now always copied via VS Code's clipboard API, even for long AI agent outputs.
- **Version Information Display**: Built-in version display in Terminal Settings with "About" section and command palette support (v0.1.105+)
- **Streamlined UI**: Compact "ST" panel title for cleaner activity bar (v0.1.105+)
- **Smart Terminal Switching**: Click any tab to switch terminals without changing display mode - clean tab navigation (v0.1.115+)
- **Smart Display Modes**: Always-visible Unicode symbol mode indicator (⊞ single, ⊡ fullscreen) - click to toggle between fullscreen and split views (v0.1.115+)
- **Seamless Tab Reordering**: Drag & drop tabs to reorder terminals - visual and actual display order stay synchronized (v0.1.115+)
- **Alt+Click Cursor Positioning**: VS Code-standard cursor positioning with intelligent CLI agent conflict detection
- **Smart File Reference System**: Instantly share code with AI agents using CMD+Option+L - automatically targets "AI Agent Connected" terminals
- **VS Code Link Parity**: Click any file path emitted in the terminal (e.g. `src/app.ts:42:7`) to open the file at the exact line/column inside VS Code, matching the built-in terminal experience (v0.1.111+). HTTP/HTTPS URLs printed by tools like Claude Code now open reliably in your default browser via VS Code's `openExternal` API (v0.1.141+).
- **Persistent Tab Drag & Drop**: Reorder terminals by dragging tabs; the extension now syncs the updated order with the host for VS Code-style persistence (v0.1.113+)
- **Multi-Agent Workflow**: Seamlessly work with multiple AI agents across different terminals simultaneously
- **Tab Close Button**: Hover-visible white × button for closing terminals, with last tab protection (v0.1.108+)
- **Split Button**: Quick terminal creation with ⊞ button in terminal headers - instantly create new terminals with default profile (v0.1.130+)
- **Stable Tab Visibility**: Terminal tabs remain visible throughout all operations (v0.1.109+)
- **IME Support**: Full Japanese/Chinese/Korean input method support with reliable `compositionend` event handling (v0.1.134+)
- **Fixed Duplicate Input**: Resolved issue where typing single characters appeared duplicated (e.g., "a" → "aa") by switching from `terminal.onData()` to `terminal.onKey()` - now captures only user keyboard input, excluding PTY echo output (v0.1.132+)
- **Split Terminal Views**: Vertical and horizontal terminal splitting optimized for AI agent workflows
- **Split Layout Stability**: New terminals created in split mode now stay aligned with the existing layout without jumping to fullscreen (v0.1.119)
- **Command Palette Integration**: Full VS Code command palette support

### 📊 **Performance & Monitoring**
- **Production-Grade Quality**: Zero TypeScript compilation errors with comprehensive ESLint compliance (0 errors, 281 acceptable warnings)
- **Optimized Build Process**: 608 KiB extension + 1.22 MiB webview builds with stable performance
- **Improved Code Architecture**: Major refactoring reduced provider code by 26.9% (801 lines) through service extraction, resulting in better maintainability and 24 KiB bundle size reduction
- **Terminal Rendering Optimization** (v0.1.131+):
  - **Phase 1**: RenderingOptimizer with WebGL auto-fallback, device-specific scrolling (30%+ draw call reduction)
  - **Phase 2**: ScrollbackManager with ANSI color preservation, wrapped line processing (<1s restore for 1000 lines)
  - **Phase 3**: LifecycleController with DisposableStore pattern, lazy addon loading (30% memory reduction, <100ms disposal)
- **Fast Test Execution**: Parallel test processing (4-8 jobs) with up to 75% speed improvement on multi-core systems (v0.1.116+)
- **Adaptive Performance**: Dynamic buffering optimization for AI agent output (250fps during active sessions)
- **Debug Panel**: Real-time system monitoring with Ctrl+Shift+D shortcut
- **Memory Management**: Efficient resource cleanup and leak prevention with LIFO disposal order
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
| `CMD+C` (Mac)<br>`Ctrl+C` (Win/Linux) | **Copy** | Copy selected text to system clipboard (v0.1.138+) |
| `CMD+V` (Mac)<br>`Ctrl+V` (Win/Linux) | **Paste** | Paste from system clipboard to terminal (v0.1.138+) |
| `CMD+Option+L` (Mac)<br>`Ctrl+Alt+L` (Win/Linux) | **File Reference** | Send current file to "AI Agent Connected" terminals with @filename format - essential for efficient AI agent workflows |
| `CMD+K CMD+C` (Mac)<br>`Ctrl+K Ctrl+C` (Win/Linux) | **Copilot Integration** | Activate GitHub Copilot Chat with #file: reference |
| `Alt+Click` | **Cursor Positioning** | Position terminal cursor (VS Code standard behavior) |
| `Ctrl+Shift+D` | **Debug Panel** | Toggle real-time system monitoring panel |
| `Ctrl+Shift+X` | **Export Diagnostics** | Export system diagnostics to clipboard |

## 🎮 Command Palette Commands

Access these commands via `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac):

| Command | Description |
|---------|-------------|
| `Secondary Terminal: Show Version` | Display extension version information |
| `Secondary Terminal: Focus Terminal` | Focus on the terminal panel |
| `Secondary Terminal: Split Terminal` | Split terminal vertically |
| `Secondary Terminal: Split Terminal Horizontal` | Split terminal horizontally |
| `Secondary Terminal: Clear Corrupted History` | Clear corrupted terminal session history |
| `Secondary Terminal: Manage Terminal Profiles` | Open terminal profile manager |

## 🏗️ Architecture Overview

### Core Components

#### Extension Host (Node.js)
- **TerminalManager**: Manages PTY processes, terminal lifecycle, and AI agent detection
- **RefactoredSecondaryTerminalProvider**: WebView provider with comprehensive message handling
- **AI Agent Services**: Dedicated services for Claude, Gemini, Codex, and GitHub Copilot CLI integration
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

# Codex CLI (OpenAI)
codex "generate unit tests for this function"

# GitHub Copilot CLI
copilot "explain this error message"

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

#### GitHub Copilot CLI
- **Launch Command**: `copilot` or `gh copilot`
- **Auto-Detection**: Detects "Welcome to GitHub Copilot CLI" message
- **Session Management**: Full lifecycle tracking with connected/disconnected states
- **File References**: Supports `@filename` context sharing
- **Best For**: AI-powered CLI assistance, command suggestions, code explanations

#### Codex CLI (OpenAI)
- **Launch Command**: `codex "your development task"`
- **AI-Powered Assistance**: Advanced code generation and completion capabilities
- **Multi-Language Support**: Supports multiple programming languages and frameworks
- **Session Management**: Complete command history and context preservation
- **Best For**: Code generation, refactoring, documentation, unit test creation

#### CodeRabbit CLI
- **Slash Command**: `/coderabbit` (when using Claude Code)
- **Mode Selection**:
  - `--prompt-only`: Optimized for AI agent integration
  - `--plain`: Detailed human-readable feedback
- **Custom Flags**: Full support for CodeRabbit CLI arguments
- **Best For**: Code reviews, quality analysis, security audits

#### Gemini CLI (Google)
- **Launch Command**: `gemini code "your development task"`
- **ASCII Art Detection**: Recognizes unique GEMINI startup graphics and visual indicators
- **Session Management**: Complete lifecycle tracking and restoration
- **Auto-Detection**: Intelligent startup and termination recognition with visual pattern matching
- **File References**: Full `@filename` support
- **Best For**: Code generation, debugging, performance optimization

### 🚀 Advanced AI Workflows

#### Multi-Agent Workflow
1. **Launch multiple agents** in different terminals:
   ```bash
   # Terminal 1: Claude Code for architecture
   claude-code "help design this system"

   # Terminal 2: GitHub Copilot CLI for implementation
   copilot "implement the user service with TypeScript"

   # Terminal 3: Codex for testing
   codex "create comprehensive unit tests"

   # Terminal 4: Gemini for optimization
   gemini code "optimize the user service performance"
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

- **Tab Click Fullscreen** (v0.1.110+): Click any terminal tab to focus on that terminal fullscreen - perfect for focusing on specific AI agent conversations
- **Toggle Split View**: Click the active tab again to switch between fullscreen and split view showing all terminals
- **Smart Display Modes**: The extension automatically manages display transitions (normal → fullscreen → split) based on your tab interactions
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
# Unit Tests (275+ tests)
npm test

# Test with coverage
npm run test:coverage

# Watch mode for TDD
npm run watch-tests

# E2E Tests (82 Playwright tests)
npm run test:e2e

# E2E with visual debugging
npm run test:e2e:headed

# E2E with interactive UI
npm run test:e2e:ui
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
- **E2E Tests**: 82 Playwright tests across 7 categories (NEW)
- **Integration Tests**: End-to-end AI agent interaction scenarios
- **Performance Tests**: Buffer management and memory optimization
- **Edge Case Tests**: Error handling and resource cleanup

### E2E Testing (Playwright)

**82 comprehensive tests** covering all major functionality:

#### Test Categories
- **Terminal Lifecycle** (13 tests): Creation, deletion, ID recycling, rapid operations
- **WebView Interaction** (12 tests): Keyboard input, shortcuts, navigation, performance
- **AI Agent Detection** (10 tests): Claude, Copilot, Gemini detection with security tests
- **Configuration** (12 tests): Settings management, validation, persistence
- **Visual Regression** (10 tests): ANSI colors, themes, accessibility (WCAG AA)
- **Error Handling** (11 tests): Extension failures, crashes, recovery scenarios
- **Concurrency** (12 tests): Race conditions, stress testing, high-frequency operations

#### Test Execution
```bash
# Run all E2E tests
npm run test:e2e

# Visual debugging mode
npm run test:e2e:headed

# Debug mode with breakpoints
npm run test:e2e:debug

# Interactive UI mode
npm run test:e2e:ui

# View test reports
npm run test:e2e:report
```

#### Test Infrastructure
- **Framework**: Playwright Test v1.56.1
- **Parallel Execution**: 5 workers for fast test runs
- **CI/CD Integration**: GitHub Actions workflow with artifact collection
- **Test Helpers**: 4 specialized helper classes for maintainability
- **Priority Tags**: P0 (Critical), P1 (Important), P2 (Nice-to-have)
- **Special Tags**: @security, @accessibility, @performance, @concurrency

### Unit Test Categories

1. **Terminal Management**: Creation, deletion, switching, and lifecycle
2. **AI Agent Integration**: Detection, status tracking, and command processing
   - Strategy pattern for agent-specific detection logic
   - Simplified detection patterns to reduce false positives
   - ASCII art recognition for unique agent startup graphics
   - Standardized activity detection across all supported agents
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

### v0.1.146 - 🏗️ **Registry Pattern & Claude Code Skills**
- 🎯 **Claude Code Skills**: Added 10 comprehensive skill files for VS Code extension development expertise
- 🏗️ **Registry Pattern**: Implemented `RegistryBasedMessageHandler`, `ManagerRegistry`, and `CommandRegistry` patterns
- 🔧 **Code Quality**: Added `StateTracker`, `DebouncedEventBuffer`, and `FontSettingsService` utilities
- ⚡ **Terminal Architecture**: New `TerminalOperationsCoordinator` and `ResizeHandlingCoordinator`
- 🐛 **Fixes**: Auto-scroll, terminal resize, styling application, and race condition prevention

### v0.1.145 - 🔧 **Terminal Width Resize Tracking**
- 🔧 **Resize Fix**: Fixed terminal not following panel width when expanding
- 🎨 **CSS Flex Layout**: Enhanced flex container styling for reliable width expansion
- ⚡ **Performance**: Reduced resize debounce from 100ms to 50ms for faster response

### v0.1.141 (Development) - 🔧 **Scrollback Restoration & Message Queuing**
- 🔧 **Scrollback Fix**: Fixed critical scrollback restoration issues with proper array/string handling
- 📨 **Message Queuing**: Added message queuing to prevent loss during WebView initialization
- 🎨 **ANSI Colors**: Use SerializeAddon for color preservation in scrollback extraction
- 🔒 **Type Safety**: Replaced `any` types with proper interfaces in handlers
- 🧹 **Resource Cleanup**: Added dispose handlers to multiple services

### v0.1.140 - 🔧 **TypeScript Compilation Hotfix**
- 🔧 **TypeScript Fix**: Fixed all TypeScript compilation errors blocking CI
- 🧪 **Test Cleanup**: Removed tests referencing deleted modules

### v0.1.139 - 📦 **ESLint & Manager Pattern Standardization**
- ✅ **ESLint**: Fixed 36 ESLint errors across 22 test files
- 🏗️ **Manager Pattern**: Phase 1-5 complete for manager standardization (7/38 migrated)
- 📋 **Standard Input**: Added Ctrl+Insert/Shift+Insert shortcuts, multi-line paste handling
- 🎨 **Display Rendering**: Verified 256-color and 24-bit RGB true color support

### v0.1.138 - 📋 **Copy/Paste Support**
- 📋 **Clipboard Integration**: Full copy/paste support with Ctrl/Cmd+C/V
- 📦 **Progressive Loading**: Chunk-based scrollback loading with performance benchmarks
- 💾 **Storage Optimization**: 20MB limit with 7-day retention and automatic cleanup

### v0.1.107 - 🎨 **UI Correction**
- 🎨 **Panel Title Fix**: Corrected activity bar abbreviation from "SC" to "ST" (Secondary Terminal)
- 📝 **Documentation Updates**: Fixed all references in package.json, CHANGELOG.md, and README.md
- ✨ **Improved Clarity**: ST is more intuitive and recognizable as Secondary Terminal

### v0.1.106 - 🔧 **Build System Fix**
- 🔧 **TypeScript Compilation**: Fixed build errors in GitHub Actions multi-platform workflow
- ✅ **Test Mock Updates**: Added missing `setVersionInfo` method to test coordinators
- 🛠️ **Type Safety**: Enhanced type guards for version parameter handling
- 📦 **CI/CD Stability**: Resolved multi-platform packaging workflow failures

### v0.1.105 - 🏷️ **Version Information Display & UI Refinements**
- 🏷️ **Version Display**: Added version information display in Terminal Settings with "About" section
- 🎯 **Command Palette**: Added "Show Version" command for quick version checking
- 📦 **VersionUtils Class**: Created utility class to dynamically retrieve version from package.json
- 🎨 **Compact UI**: Changed activity bar title from "Secondary Terminal" to "ST" for cleaner interface
- 🔧 **Type Safety**: Fixed TypeScript compilation errors for production-ready builds

### v0.1.104 - 🤖 **GitHub Copilot CLI Support & Enhanced AI Detection**
- 🆕 **GitHub Copilot CLI**: Added full support for GitHub Copilot CLI integration
- 🎯 **Simplified Detection**: Streamlined AI agent detection patterns for better reliability
- 🔄 **Reconnection Fix**: Fixed disconnected AI agent reconnection issues
- 📈 **Detection Accuracy**: Improved pattern matching across all AI agents

### v0.1.95 - 📁 **Documentation Organization & Codex CLI Support**
- 📁 **Documentation Structure**: Organized 25+ documentation files into categorized `/docs/` directory structure
- 📖 **Enhanced Navigation**: Created comprehensive docs/README.md with structured directory navigation
- 🤖 **Codex CLI Integration**: Added support for OpenAI Codex CLI with complete AI agent functionality
- 📦 **Dependency Updates**: Updated @xterm/addon-web-links to v0.11.0 for improved link handling
- 🗂️ **Project Organization**: Cleaned root directory structure for better maintainability
- 🚀 **Developer Experience**: Improved project navigation with organized documentation structure

### v0.1.94 - 📚 **Comprehensive AI Agent Documentation & Enhanced UX**
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

## 📚 Documentation

### API Documentation

Comprehensive API documentation is available for developers who want to understand the extension's architecture or contribute to the codebase:

- **[API Documentation Guide](docs/API_DOCUMENTATION.md)** - Complete guide to the API documentation
- **[Generated API Reference](docs/api/index.html)** - Browse the full API documentation (TypeDoc)
- **Generate docs**: `npm run docs:generate`
- **View all docs**: See [docs/README.md](docs/README.md) for the complete documentation structure

The API documentation includes:
- Core components (ExtensionLifecycle, Terminal Management)
- Service APIs (Shell Integration, Configuration, Keyboard Shortcuts)
- Command implementations (File References, Copilot Integration)
- Utilities and helpers

## 🤝 Contributing

We welcome contributions! Please see our [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues) to get started.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow TDD practices: Write tests first, then implement
4. Ensure all quality gates pass: `npm run pre-release:check`
5. Submit a pull request with detailed description

### Emergency Rollback Procedures

If you encounter critical issues with a release, we provide automated rollback capabilities:

#### 🚨 **Emergency Rollback (Fully Automated)**
```bash
# Complete automatic rollback + marketplace publishing
npm run rollback:emergency:publish

# Local rollback only (requires manual publishing)
npm run rollback:emergency
```

#### 🔧 **Targeted Rollback**
```bash
# List available versions for rollback
npm run rollback:list

# Rollback to specific version
npm run rollback:to 0.1.95

# Pre-publish safety verification
npm run rollback:verify
```

#### 📊 **Release Monitoring**
```bash
# Single monitoring check
npm run monitor:check

# Continuous monitoring (30min intervals)
npm run monitor:continuous
```

#### 🔥 **Hotfix Release**
```bash
# Automated hotfix workflow
npm run rollback:hotfix
```

**📚 Complete Rollback Documentation:**
- [🚨 Quick Reference Guide](docs/ROLLBACK_QUICK_REFERENCE.md) - 1-minute emergency response
- [📋 Emergency Rollback Guide](docs/EMERGENCY_ROLLBACK.md) - Detailed step-by-step procedures
- [🤖 Automated Rollback System](docs/AUTOMATED_ROLLBACK_SYSTEM.md) - Full automation capabilities
- [⚡ Claude Code Guide](CLAUDE.md) - Complete development & troubleshooting guide

### Code Standards

- **TypeScript**: Strict typing with comprehensive interfaces
- **Testing**: TDD approach with comprehensive test coverage
- **Documentation**: Clear inline comments and updated guides
- **Performance**: Memory-efficient implementations with proper cleanup
- **Release Safety**: Automated rollback system for production stability

## 🔒 Privacy & Telemetry

### Privacy-Respecting Telemetry

Secondary Terminal implements **privacy-respecting telemetry** to help us improve the extension while protecting your data.

#### What We Collect

We collect **anonymous usage data** to understand:
- Which features are most used
- Where errors occur
- Performance bottlenecks
- Feature adoption rates

**Examples of data collected:**
- Extension activation time
- Number of terminals created/deleted
- CLI agent types detected (e.g., 'claude', 'gemini', 'copilot')
- Command execution success/failure
- Performance metrics (operation duration)

#### What We DO NOT Collect

We **never** collect:
- ❌ Terminal content (commands you type)
- ❌ Terminal output
- ❌ File paths or file content
- ❌ Working directory paths
- ❌ Environment variables
- ❌ Credentials or passwords
- ❌ Personal identifiable information (PII)

### Your Privacy Controls

This extension **automatically respects** VS Code's telemetry settings.

**To disable telemetry:**
1. Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "telemetry"
3. Set **"Telemetry: Telemetry Level"** to `"off"`

Or add to your `settings.json`:
```json
{
  "telemetry.telemetryLevel": "off"
}
```

### Learn More

For complete details about our privacy practices, see:
- 📄 [Privacy Policy](PRIVACY.md) - Full privacy documentation
- ✅ Complies with GDPR principles
- 🔒 HTTPS encryption for all data transmission
- 🎯 Minimal data collection approach

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

- **Running Processes Not Preserved on Restart**: Unlike VS Code's built-in terminal, running processes (such as Claude Code, Gemini CLI, or other long-running applications) are terminated when VS Code restarts. Only the terminal output history (scrollback) is preserved and restored. This is an architectural limitation - the extension saves terminal metadata and scrollback content, but does not implement PTY process reconnection. **Workaround**: Use terminal multiplexers like `tmux` or `screen` if you need processes to survive VS Code restarts.
- Some features may be incomplete or have rough edges
- New releases are frequent as we continuously add functionality
- Documentation is being updated regularly to keep pace with development

---

**Built with ❤️ for VS Code developers working with AI agents**

*Supports Claude Code, GitHub Copilot, Gemini CLI, and more*
