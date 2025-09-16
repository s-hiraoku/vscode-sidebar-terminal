# Release Notes

## Version 0.1.91 - Quality Consolidation & Agent Controls

### 🎯 Release Highlights

- Added manual recovery tools for Claude/Gemini/Codex sessions so the sidebar toggle can force a reconnect or clear a bad detection state without restarting VS Code (`src/services/CliAgentDetectionService.ts:320-378`, `src/webview/managers/RefactoredTerminalWebviewManager.ts:735-776`).
- Hardened CLI agent pattern detection with expanded real-world prompts and stricter false-positive guards for Claude, Gemini, and Codex CLIs (`src/services/CliAgentPatternDetector.ts:12-333`).
- Brought webview diagnostics to parity with the integrated terminal through dedicated shortcuts (Ctrl+Shift+D/X/R/I) for debug view toggling, log export, resync, and input fixes (`src/webview/main.ts:98-154`, `src/webview/managers/InputManager.ts:934-1025`).
- Unified terminal configuration now keeps Alt+Click cursor moves and session limits in sync across host and webview layers, ensuring consistent multi-terminal behaviour (`src/services/TerminalStateManager.ts:64-306`, `src/webview/managers/ConfigManager.ts:24-267`).
- Documentation refreshed with CLAUDE integration guides and refactoring summaries to match the current architecture (`docs/CLAUDE.md`, `docs/WEBVIEW_REFACTORING_SUMMARY.md`).

### 🛠 Developer Notes

- Manual reset messages reuse the existing `switchAiAgent` channel, so no additional API surface is required on the extension host (`src/webview/managers/RefactoredTerminalWebviewManager.ts:742-776`).
- Release date: September 14, 2024. Compatible with VS Code ^1.74.0 / Node.js ≥18, matching the `package.json` engine settings (`package.json:7-10`).

---

## Version 0.1.88 - Critical Startup Fix & System Stabilization

## 🚨 Critical Fixes

### ✅ Extension Startup & Terminal Display Fix

**Issue Fixed**: Extension would fail to initialize properly on Apple Silicon Macs, preventing terminal display.

**Root Causes Identified**:
1. **node-pty Architecture Mismatch**: Binary built for wrong architecture (x86_64 vs ARM64)
2. **WebView Initialization Error**: RefactoredMessageManager initialization using incorrect Promise handling

**Solution Implemented**:
- **ARM64 Compatibility**: Rebuilt node-pty with proper ARM64 architecture support
- **WebView Error Fix**: Corrected RefactoredTerminalWebviewManager initialization flow
- **Proper Error Handling**: Enhanced error reporting for better debugging

**Technical Changes**:
- Fixed `RefactoredTerminalWebviewManager.initializeExistingManagers()` Promise handling
- Updated node-pty binary build process for Apple Silicon compatibility
- Enhanced error reporting in WebView initialization

**Result**:
- ✅ Extension starts properly on all Mac architectures (Intel & Apple Silicon)
- ✅ Terminal displays correctly in sidebar
- ✅ All core functionality restored (keyboard input, scrolling, command execution)

## 🔧 Infrastructure Improvements

### Enhanced Service Architecture

**Unified Configuration Service**: Consolidated 4 overlapping configuration services into single UnifiedConfigurationService
- Eliminated 1,851 lines of duplicate code
- Improved configuration caching and validation
- Hierarchical configuration support

**Consolidated Message Service**: Unified 3 duplicate message handling implementations
- Removed 394 duplicate message handling occurrences across 56 files
- Priority queuing and dispatcher patterns
- Enhanced error handling and recovery

**Type Safety Improvements**:
- Added comprehensive type guards for runtime validation
- Eliminated unsafe TypeScript `any` usage in critical paths
- Enhanced interface consistency across extension/webview boundary

### Content Security Policy (CSP) Compliance

**Fixed CSP Violations**:
- Removed inline event handlers from WebView HTML generation
- Implemented proper addEventListener patterns
- Enhanced security without compromising functionality

**Files Modified**:
- `src/services/webview/WebViewHtmlGenerator.ts`: Removed inline `onload`/`onerror` handlers
- `src/services/webview/WebViewHtmlGenerationService.ts`: Added proper event listener setup

## 🧪 Test Infrastructure Stabilization

### Comprehensive Test Suite Improvements

**Enhanced Test Mocking**:
- Complete VS Code API mock implementations
- Proper document/URI structure simulation
- Null safety enhancements for activeEditor access

**Improved Test Reliability**:
- Fixed Sinon stub management ("Already wrapped" errors)
- Enhanced resource disposal patterns
- Cross-test isolation improvements

**TypeScript Compilation Fixes**:
- Added missing WebView message types
- Resolved all compilation errors in test environment
- Clean build pipeline across all modules

**Quality Metrics**:
- ✅ ESLint: 0 errors, 159 warnings (TypeScript `any` types only)
- ✅ TypeScript Compilation: Complete success
- ✅ Test Environment: Stable, reliable execution

## 🚀 Performance & Compatibility

### Apple Silicon Native Support

**Architecture Detection**: Automatic detection and building for correct architecture
- ARM64 for Apple Silicon Macs
- x86_64 for Intel Macs and Rosetta environments
- Improved node-pty compatibility across all Mac architectures

### Enhanced Error Reporting

**Detailed Error Context**: Improved error messages with:
- Stack traces for JavaScript errors
- Architecture mismatch detection
- WebView initialization failure details

## 📦 Platform Support

### Tested Environments

- ✅ **Apple Silicon (M1/M2/M3/M4)**: Native ARM64 support
- ✅ **Intel Mac**: x86_64 support maintained  
- ✅ **VS Code Extension Host**: Full compatibility
- ✅ **WebView Environment**: Proper isolation and security

### Node.js & Dependencies

- **node-pty**: Updated with proper multi-architecture support
- **@homebridge/node-pty-prebuilt-multiarch**: ARM64 compatibility
- **VS Code API**: Enhanced integration and stability

## 🔄 Migration Notes

### For Existing Users

No manual migration required. This release focuses on stability and compatibility improvements.

### For Developers

**Updated Development Workflow**:
- Enhanced error reporting during development
- Improved debugging tools and diagnostics
- Stable test environment for reliable TDD

## 🎯 Next Steps

This release establishes a solid foundation for:
- VS Code Terminal Feature Parity implementation (GitHub Issue #175)
- Enhanced CLI Agent integration
- Advanced terminal management features

## 📊 Quality Assurance

**Code Quality**:
- 0 ESLint errors
- 100% successful TypeScript compilation
- Comprehensive test coverage maintained
- Enhanced resource management and cleanup

**Stability**:
- Elimination of critical startup failures
- Proper error handling and recovery
- Memory leak prevention
- Consistent behavior across platforms

---

**Full Changelog**: [GitHub Release](https://github.com/hiraoku/vscode-sidebar-terminal/releases/tag/v0.1.88)

**GitHub Issue**: This release resolves critical startup issues blocking VS Code Terminal Feature Parity development

**Extension Marketplace**: [Secondary Terminal](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)

---

## Previous Version History

### Version 0.1.87 - VS Code Standard Terminal Scroll Behavior

### 🎯 **Core Enhancement: Auto-Scroll Implementation**

#### 主要改善事項
- **VS Code標準準拠**: 統合ターミナルと完全同等の自動スクロール動作
- **自動スクロール機能**: 新しい出力時に自動的に最下部へスクロール
- **ユーザビリティ向上**: 常に最新の出力が見える改善されたUX

### ⚡ **Technical Implementation**

#### 実装詳細
- **実装箇所**: `src/webview/managers/TerminalLifecycleManager.ts:897`
- **実装方式**: `writeToTerminal()`メソッドでの`terminal.scrollToBottom()`自動実行
- **xterm.js統合**: ネイティブスクロールAPIによる確実な実装
- **パフォーマンス**: ゼロオーバーヘッドの軽量実装

### 🛡️ **Quality Assurance Results**

#### Pre-Release Quality Checklist: ✅ ALL PASSED
- **ESLint**: ✅ 0エラー、174警告（TypeScript `any`型のみ - 許容範囲）
- **TypeScript**: ✅ 完全コンパイル成功（テスト文字列リテラルエラー修正済み）
- **Test Suite**: ✅ 275+テスト実行、継続的品質確保
- **VSIX Package**: ✅ 3.76MB多機能パッケージ生成成功

#### Build Quality Metrics
- **Extension Bundle**: 224KB（本番最適化済み）
- **WebView Bundle**: 977KB（xterm.js含む完全機能）
- **Package Size**: 3.76MB（native dependencies含む）
- **Platform Support**: 9プラットフォーム対応

### 🔧 **Enhanced User Experience**

#### 改善されたターミナル動作
- **直感的操作**: VS Codeユーザーに馴染みのあるスクロール動作
- **情報の可視性**: 重要なコマンド出力を見逃さない設計
- **ワークフロー改善**: CLI Agent使用時の出力追跡が容易

#### 開発者体験
- **一貫性**: VS Code環境全体での統一されたターミナル体験
- **予測可能性**: 期待通りに動作する信頼性のあるスクロール
- **生産性向上**: コマンド実行結果の確認がスムーズ

### 📊 **Release Package Information**

#### Package Details
- **File**: `vscode-sidebar-terminal-0.1.87.vsix`
- **Size**: 3.76MB (3,760,992 bytes)
- **Files**: 480ファイル（native dependencies含む）
- **Platforms**: macOS (Intel/Apple Silicon), Linux (x64/ARM), Windows (x64/ARM)

#### Content Structure
- **Core Extension**: TypeScript/webpack最適化済み
- **WebView Components**: xterm.jsエコシステム完全統合
- **Native Dependencies**: node-ptyクロスプラットフォーム対応
- **Documentation**: 包括的なREADMEと設定ガイド

### 🚀 **Automated CI/CD Deployment**

#### Release Process
- **Git Tag**: v0.1.87 → GitHub Actions自動トリガー
- **Quality Gates**: Pre-releaseチェックリスト完全クリア
- **Multi-Platform Build**: 9プラットフォーム自動ビルド
- **VS Code Marketplace**: 自動公開プロセス

#### Platform Coverage
- **macOS**: darwin-x64（Intel）, darwin-arm64（Apple Silicon）
- **Linux**: linux-x64, linux-arm64, linux-armhf
- **Windows**: win32-x64, win32-arm64
- **Alpine**: alpine-x64, alpine-arm64（コンテナ環境対応）

### 📈 **Impact & Future Roadmap**

#### 今回のリリースの影響
- **基本的なUX改善**: VS Code標準動作によるストレスフリーなターミナル操作
- **開発効率向上**: コマンド結果の追跡が自動化されワークフロー改善
- **プラットフォーム統一**: 全環境で一貫したターミナル体験

#### 今後の展望
- **パフォーマンス最適化**: より効率的なレンダリングとスクロール処理
- **機能パリティ**: VS Code統合ターミナルとの更なる機能同期
- **ユーザーフィードバック**: 実使用に基づく継続的改善

---

### 🏆 **Production Ready Status**

**Release Readiness**: ✅ **FULLY QUALIFIED FOR PRODUCTION**

All critical quality gates have been satisfied:
- ✅ **Build Quality**: Clean compilation & successful packaging
- ✅ **Code Standards**: ESLint compliance & TypeScript safety
- ✅ **Test Infrastructure**: Comprehensive test suite operational
- ✅ **Cross-Platform**: Multi-platform VSIX packages ready
- ✅ **Documentation**: Complete release notes & user guides

---

**Release Date**: September 7, 2025  
**Version**: 0.1.87  
**Compatibility**: VS Code 1.60.0+  
**Status**: Production Ready ✅

**Built with ❤️ for VS Code developers using Claude Code, GitHub Copilot, and Gemini CLI**
