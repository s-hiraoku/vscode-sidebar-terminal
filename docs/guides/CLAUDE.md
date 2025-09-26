# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 CRITICAL DEVELOPMENT PRINCIPLES

**NEVER take shortcuts** - implement complete solutions that:
- Meet ALL requirements simultaneously
- Follow VS Code standard patterns (reference using DeepWiki MCP when needed)
- Preserve existing functionality 
- Include proper error handling and testing

**Forbidden approaches:**
- Disabling functionality to "fix" conflicts
- Using placeholder implementations
- Commenting out working code
- **ABSOLUTELY NEVER skip or disable tests in any way**
- **NEVER modify GitHub Actions workflows to ignore test failures**
- **NEVER move test files to disable them temporarily**

## 🚨 CRITICAL TEST REQUIREMENTS

**TESTS ARE SACRED - NEVER SKIP OR DISABLE:**
- ALL tests must compile without TypeScript errors
- ALL tests must run and pass successfully
- Test compilation errors MUST be fixed, not ignored
- GitHub Actions workflows MUST NOT be modified to skip tests
- Test files MUST NOT be moved or renamed to disable them
- ANY test issues must be resolved by fixing the actual code, not bypassing tests

## Development Commands

**Essential Build Commands:**
```bash
npm run compile         # Build extension and webview
npm run watch          # Watch mode for development
npm run package        # Production build with source maps
npm run compile-tests  # Compile test files only
```

**Testing Commands (TDD is MANDATORY):**
```bash
npm test               # Run unit tests (recommended for development)
npm run test:coverage  # Coverage report
npm run test:integration # Integration tests (60s timeout)
npm run test:performance # Performance tests (120s timeout)

# TDD Workflow
npm run tdd:red        # Verify failing tests
npm run tdd:green      # Verify passing tests  
npm run tdd:refactor   # Quality check after refactoring
npm run tdd:quality-gate # CI/CD quality gate check
```

**Running Single Tests:**
```bash
# Compile tests first, then run specific test file
npm run compile-tests
./node_modules/.bin/mocha --require out/test/shared/TestSetup.js --timeout 30000 'out/test/unit/path/to/SpecificTest.test.js'
```

**Code Quality:**
```bash
npm run lint           # ESLint (MUST pass - zero errors required)
npm run format         # Prettier formatting
```

**VS Code Development:**
- `F5`: Launch Extension Development Host
- `Ctrl+Shift+I`: Developer Tools for webview debugging

## Architecture Overview

**Dual-Process Architecture**: VS Code extension with Extension Host (Node.js) and WebView (browser) separation.

### Extension Host (Node.js)
- **TerminalManager** (`src/terminals/TerminalManager.ts`): Core terminal lifecycle using node-pty
- **SecondaryTerminalProvider** (`src/providers/SecondaryTerminalProvider.ts`): WebView provider and message bridge
- **StandardTerminalSessionManager** (`src/sessions/StandardTerminalSessionManager.ts`): Terminal session persistence with scrollback
- **Commands**: File reference (@filename), Copilot integration (#file:) in `src/commands/`
- **Services**: CLI agent detection, buffering, state management in `src/services/`

### WebView (Browser)
- **RefactoredTerminalWebviewManager** (`src/webview/managers/RefactoredTerminalWebviewManager.ts`): Central coordinator
- **Manager Architecture**: Specialized managers implementing `IManagerCoordinator` pattern:
  - **TerminalLifecycleManager**: Terminal creation, deletion, lifecycle
  - **RefactoredMessageManager**: Extension ↔ WebView communication
  - **InputManager**: IME, Alt+Click, keyboard shortcuts 
  - **UIManager**: Themes, borders, visual feedback
  - **PerformanceManager**: Output buffering, CLI agent optimization
  - **SplitManager**: Multi-terminal layout management
  - **NotificationManager**: User feedback and toasts
  - **CliAgentStateManager**: AI agent status tracking
  - **StandardTerminalPersistenceManager**: Session serialization
- **xterm.js**: Terminal emulation with VS Code theme integration and standard addons

### Communication Flow
```
User Input → VS Code Commands → Extension Host → WebView Messages → xterm.js
                    ↕                      ↕                   ↕
              TerminalManager ←→ node-pty processes ←→ Shell/AI Agents
```

## Key Features & Integration Points

**Terminal Session Restoration**: Automatic save/restore of up to 5 terminals with complete scrollback history via VS Code ExtensionContext.globalState using xterm.js serialization

**CLI Agent Integration**: 
- Claude Code, Gemini CLI, GitHub Copilot support
- Real-time status detection via output pattern matching
- File reference shortcuts: `@filename` (CMD+Option+L) and `#file:filename` (CMD+K CMD+C)

**VS Code Standards Compliance**:
- Alt+Click cursor positioning when `terminal.integrated.altClickMovesCursor` + `editor.multiCursorModifier === 'alt'`
- Theme integration via VS Code CSS variables
- Standard terminal shortcuts and IME support

## Development Guidelines

**Code Quality Requirements:**
- TypeScript strict mode with complete interface implementations
- EventEmitter proper disposal to prevent memory leaks
- Update ALL implementing classes when changing interfaces
- Update test mocks when changing interfaces

**TDD Workflow (MANDATORY):**
1. Write failing test first (Red)
2. Implement minimal code to pass (Green) 
3. Refactor while keeping tests green
4. Run `npm run tdd:quality-gate` before commits

**Testing Strategy:**
- Unit tests: Component functionality and edge cases
- Integration tests: AI agent interaction scenarios  
- Performance tests: Buffer management and memory optimization
- Real user problem scenarios: terminal restoration, command history, memory leaks

**Development Workflow:**
1. Update type definitions FIRST in `src/types/common.ts`
2. Update implementations across Extension Host and WebView
3. Search ALL references when renaming (use VS Code global find)
4. Update tests, constants, and documentation together

## File Structure & Communication

**Key Implementation Files:**
- `src/extension.ts`: Entry point, command registration
- `src/terminals/TerminalManager.ts`: node-pty process management, terminal lifecycle
- `src/providers/SecondaryTerminalProvider.ts`: WebView provider, Extension ↔ WebView bridge
- `src/webview/main.ts`: WebView entry point and initialization
- `src/webview/managers/RefactoredTerminalWebviewManager.ts`: Main WebView coordinator
- `src/services/CliAgentDetectionService.ts`: AI agent pattern detection and status
- `src/sessions/StandardTerminalSessionManager.ts`: Session persistence with scrollback via VS Code globalState

**Message Protocol**: Extension ↔ WebView via `postMessage` with commands: `init`, `output`, `input`, `resize`, `clear`, `killTerminal`, `deleteTerminal`, `stateUpdate`, `sessionRestore`, `extractScrollbackData`

**Webpack Build**: Dual configuration builds `dist/extension.js` (Node.js) and `dist/webview.js` (browser) with CSS bundling

## Debugging

**Debug Panel**: `Ctrl+Shift+D` - Real-time monitoring of:
- System Status (READY/BUSY) with pending operations tracking
- Terminal instances, active terminal, and number recycling (1-5)
- Performance metrics, buffer statistics, and CLI agent detection
- State synchronization and deletion/creation queues
- Quick actions: Force Sync, Refresh State, Export Diagnostics

**Common Issues:**
- WebView debugging: `Ctrl+Shift+I` (VS Code Developer Tools)
- Test environment: Check `src/test/shared/TestSetup.ts` for VS Code API mocks
- Build issues: Verify node-pty native compilation for target platform
- Memory leaks: Check EventEmitter disposal in webview managers

## Platform Support

**Native Dependencies**: node-pty bundled per platform in VSIX packages
**Target Platforms**: Windows (x64, ARM64), macOS (Intel, Apple Silicon), Linux (x64, ARM64, ARMHF), Alpine
**Release Process**: GitHub Actions automated with platform-specific builds

## Testing Requirements

**Quality Gates (enforced by CI/CD):**
- TDD compliance: 50%+ (targeting 85%)
- Test coverage: 85%+ with 275+ tests
- ESLint: Zero errors (warnings acceptable)
- TypeScript: Strict compilation success

**Test Commands by Category:**
```bash
npm run test:unit        # Core component tests (30s timeout)
npm run test:integration # End-to-end scenarios (60s timeout) 
npm run test:performance # Buffer/memory tests (120s timeout)
npm run test:coverage    # Generate coverage reports
```

## Current Implementation Status

**✅ Production-Ready Features:**
- Terminal Session Restoration: Scrollback serialization with 97% test success rate
- AI Agent Integration: Claude Code, Gemini CLI, GitHub Copilot with real-time status tracking
- VS Code Standards: Alt+Click, terminal shortcuts, theme integration, keybinding system
- WebView Manager Architecture: Refactored coordinator pattern with specialized managers
- Cross-Platform: Native binaries for all major platforms (Windows, macOS, Linux, Alpine)

**Architecture Maturity**: Service-oriented with manager-based WebView architecture, comprehensive error handling, automated quality gates, and extensive debugging tools