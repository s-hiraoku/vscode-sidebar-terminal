# CLAUDE.md

This file provides guidance to CLI Agent (gemini.google.com/code) when working with code in this repository.

## Development Commands

### Building and Testing
```bash
# Main build commands
npm run compile           # Build extension and webview
npm run watch            # Watch mode for development  
npm run package          # Production build with optimizations

# Testing
npm test                 # Run unit tests only (recommended for development)
npm run test:unit       # Run unit tests explicitly
npm run test:coverage   # Run tests with coverage reporting
npm run pretest         # Compile tests + build + lint (runs before test)
npm run compile-tests   # Compile test files only
npm run watch-tests     # Watch test files

# Code Quality
npm run lint            # ESLint checking
npm run format          # Prettier formatting

# Extension Packaging
npm run vsce:package    # Create .vsix package
npm run vsce:publish    # Publish to marketplace

# Release Management
npm run release:patch   # Increment patch version and create release
npm run release:minor   # Increment minor version and create release
npm run release:major   # Increment major version and create release
```

### VS Code Development
- Press `F5` to launch Extension Development Host
- Use "Developer: Reload Window" command to reload during development
- Console logs are visible in VS Code Developer Tools (`Ctrl+Shift+I`)

## High-Level Architecture

This is a VS Code extension that provides a terminal interface in the sidebar using a WebView. The architecture follows a clear separation between the extension host (Node.js) and the webview (browser environment).

### Core Components

**Extension Host (Node.js)**
- **TerminalManager**: Manages multiple terminal instances using node-pty, handles PTY process lifecycle, data buffering for performance, and active terminal tracking
- **SidebarTerminalProvider**: Implements VS Code WebviewViewProvider, bridges extension and webview communication, manages webview lifecycle and HTML generation
- **Extension Entry Point**: Registers commands, providers, and handles extension activation/deactivation

**WebView (Browser)**
- **TerminalWebviewManager**: Main coordinator that implements IManagerCoordinator interface and orchestrates all WebView managers
- **MessageManager**: Handles communication between WebView and Extension, processes incoming messages and queues outgoing messages
- **InputManager**: Manages keyboard shortcuts, IME handling, and Alt+Click interactions  
- **UIManager**: Controls visual feedback, theming, borders, and terminal appearance
- **ConfigManager**: Manages settings persistence and configuration
- **NotificationManager**: Provides user feedback and visual alerts
- **SplitManager**: Handles terminal splitting functionality and layout calculations
- **PerformanceManager**: Manages output buffering, debouncing, and performance optimizations
- **xterm.js**: Core terminal emulation library

### Communication Flow

```
User Action → VS Code Command → Extension Host → WebView Message → xterm.js
                                      ↕                    ↕
                               TerminalManager ←→ node-pty process ←→ Shell
```

### Key Design Patterns

**Terminal Lifecycle Management**
- Each terminal has a unique ID and is tracked in TerminalManager
- Active terminal concept: only one terminal receives input at a time
- Terminal numbering: Uses recycled numbers 1-5 instead of incrementing infinitely
- Deletion operations are queued and processed atomically to prevent race conditions
- Infinite loop prevention using `_terminalBeingKilled` tracking set

**Message Communication**
- Webview ↔ Extension communication via `postMessage` protocol
- Commands: `init`, `output`, `input`, `resize`, `clear`, `killTerminal`, `deleteTerminal`, `stateUpdate`, etc.
- Event-driven architecture with proper cleanup on disposal
- MessageManager queues messages for reliable delivery and prevents race conditions

**Performance Optimizations**
- Data buffering: Terminal output is batched to reduce message frequency (16ms intervals, ~60fps)
- Resize debouncing: Terminal resize operations are debounced (configurable delay)
- Flex layout system: Terminals use CSS flexbox for responsive sizing

### File Structure Context

**Core Extension Files**
- `src/extension.ts`: Entry point, command registration
- `src/providers/SidebarTerminalProvider.ts`: WebView provider implementation  
- `src/terminals/TerminalManager.ts`: Terminal process management
- `webpack.config.js`: Dual build configuration (extension + webview)

**WebView Frontend**
- `src/webview/main.ts`: WebView entry point containing TerminalWebviewManager class that coordinates all manager instances
- `src/webview/managers/`: Manager implementations (MessageManager, InputManager, UIManager, PerformanceManager, NotificationManager, SplitManager, ConfigManager)
- `src/webview/components/`: Reusable UI components (SettingsPanel)
- `src/webview/utils/`: Utility functions for DOM, themes, notifications
- `src/webview/core/`: Core logic (NotificationBridge, NotificationSystem)
- `src/webview/interfaces/`: Manager interfaces and type definitions (IManagerCoordinator, IMessageManager, etc.)

**Configuration and Types**
- `package.json`: Extension manifest, commands, settings schema, menu contributions
- `src/types/common.ts`: Shared interfaces between extension and webview
- `src/constants/`: Application constants and terminal configuration

### Important Implementation Details

**New Terminal Management Architecture (Recently Implemented)**
- **Single Source of Truth**: Extension (TerminalManager) is the sole authority for terminal state management
- **Unified Deletion Protocol**: Both header × button and panel trash button use the same `deleteTerminal()` method
- **Race Condition Prevention**: Operations are queued and processed atomically using `operationQueue`
- **State Synchronization**: WebView receives automatic state updates via `onStateUpdate` event
- **Terminal ID Recycling**: Terminal numbers (1-5) are properly reused when terminals are deleted
- **Request Source Tracking**: Deletion requests are tagged with source ('header' or 'panel') for debugging

**Webview Context Retention**
- WebView uses `retainContextWhenHidden: true` to maintain state when sidebar is hidden
- Terminal processes continue running in background via node-pty

**Error Handling Strategy**
- Unified error display via NotificationUtils in webview
- Extension-level error handling with user-friendly messages
- Graceful degradation when terminal processes fail

**Testing Architecture**
- **Unit Tests**: Primary testing approach using Mocha with 275+ tests (93% success rate)
- **Test Organization**: Tests located in `src/test/unit/` with component-specific subdirectories
- **Test Environment**: Uses `TestSetup.ts` for VS Code API mocking and process polyfills
- **CI Integration**: Tests run on Ubuntu, macOS, and Windows with xvfb for headless testing
- **Known Issues**: Mocha cleanup may exit with code 7 due to process event handling; tests themselves pass successfully

### Extension Configuration

The extension provides extensive configuration options in `package.json`:
- Terminal behavior: shell, args, max terminals, cursor blink
- Display: font family/size, theme, header settings  
- Status management: duration, auto-hide, activity triggers
- UI customization: icon opacity, header title, icon sizes

Configuration values are accessed via `vscode.workspace.getConfiguration('sidebarTerminal')` and can be changed at runtime.

### Common Development Patterns

**Webpack Build System**
- Uses dual webpack configuration for extension (Node.js) and webview (browser)
- Extension builds to `dist/extension.js`, webview builds to `dist/webview.js`  
- CSS is bundled into webview.js via style-loader/css-loader
- Process polyfill required for webview environment (`process/browser`)

**VSIX Packaging Issues**
- Development mode uses different paths than packaged extension
- CSS resources must be bundled, not referenced as external files
- Node.js globals (like `process`) need polyfills in webview context
- `node-pty` is bundled as dependency via `bundledDependencies` in package.json

**Debugging Packaged Extensions**
- Test both F5 development mode AND installed .vsix package
- Use browser dev tools for webview debugging (`Ctrl+Shift+I`)
- Check for 404 errors on CSS/resource loading
- Verify process polyfills are working in webview environment

### VS Code Standard Alt+Click Implementation

**Alt+Click Cursor Positioning**
- Follows VS Code standard: `altClickMovesCursor && multiCursorModifier === 'alt'`
- Extension retrieves settings from `terminal.integrated.altClickMovesCursor` and `editor.multiCursorModifier`
- WebView receives settings via `settingsResponse` message and applies VS Code standard logic
- Only enabled when both conditions are met (VS Code standard behavior)

**Settings Integration**
- Extension monitors configuration changes for `editor.multiCursorModifier` and `terminal.integrated.altClickMovesCursor`
- Dynamic setting updates sent to WebView without requiring restart
- Settings applied to new terminals immediately; existing terminals require recreation

**Visual Feedback**
- Alt key press shows `cursor: default` on terminal elements
- Alt+Click shows blue highlight feedback at cursor position with fade animation
- Follows VS Code standard visual patterns for consistency

**Performance Optimizations for CLI Agent Output**
- Adaptive buffering: shorter flush intervals during frequent output (8ms vs 16ms)
- Direct writes for specific terminal IDs to avoid cross-terminal interference
- Immediate flush for large outputs (≥1000 chars) to maintain cursor accuracy

## Alt+Click Cursor Positioning

### Overview
This extension implements VS Code standard Alt+Click cursor positioning with intelligent conflict detection for CLI Agent interactions.

### Current Limitations
- **CLI Agent Interference**: Alt+Click may not work reliably during CLI Agent execution due to:
  - High-frequency output causing cursor position desynchronization
  - Raw mode terminal conflicts with xterm.js Alt+Click implementation
  - Escape sequences being output directly instead of cursor positioning

### Intelligent Conflict Resolution
The extension automatically detects CLI Agent activity and temporarily disables Alt+Click during:
- CLI Agent execution sessions (detected by output patterns)
- High-frequency terminal output (>500 chars in 2 seconds)
- Large output chunks (≥1000 characters)

### User Experience
- **Visual Feedback**: When Alt+Click is disabled, users see:
  - "⚡ CLI Agent Active" tooltip at click location
  - System notification explaining the temporary disable state
  - Re-enablement notification when CLI Agent session ends

### Configuration Requirements
Alt+Click requires both VS Code settings to be enabled:
```json
{
  "terminal.integrated.altClickMovesCursor": true,
  "editor.multiCursorModifier": "alt"
}
```

### Best Practices
1. **Regular Terminal Use**: Alt+Click works normally for standard shell commands
2. **CLI Agent Sessions**: Alt+Click is temporarily disabled for optimal performance
3. **Manual Re-enable**: Alt+Click automatically re-enables after CLI Agent detection ends
4. **Troubleshooting**: Check VS Code Developer Console for Alt+Click event logs

### Technical Implementation
- **Detection Patterns**: Uses regex patterns to identify CLI Agent output
- **Buffer Optimization**: CLI Agent output uses 4ms flush intervals vs 16ms normal
- **State Management**: Tracks CLI Agent activity and Alt+Click availability
- **Error Handling**: Graceful fallback with user notifications

### Recent Architecture Changes

**Configuration Flow**
```
VS Code Settings → Extension (SidebarTerminalProvider) → WebView Message → TerminalWebviewManager
```

**Key Implementation Files**
- `src/providers/SidebarTerminalProvider.ts`: VS Code settings integration and change monitoring
- `src/webview/main.ts`: Alt+Click logic, visual feedback, and settings application
- `src/types/common.ts`: Extended TerminalSettings interface for Alt+Click settings

## Platform-Specific Extension Architecture

This extension uses VS Code's platform-specific extension system to handle native dependencies (node-pty) across different operating systems and architectures.

### Platform Target Support

The extension builds for 9 platform targets:
- **Windows**: win32-x64, win32-arm64
- **macOS**: darwin-x64, darwin-arm64  
- **Linux**: linux-x64, linux-arm64, linux-armhf
- **Alpine**: alpine-x64, alpine-arm64

### Platform-Specific Build Commands

```bash
# Individual platform builds
npm run vsce:package:win32-x64      # Windows 64-bit
npm run vsce:package:darwin-x64     # macOS Intel
npm run vsce:package:darwin-arm64   # macOS Apple Silicon
npm run vsce:package:linux-x64      # Linux 64-bit
npm run vsce:package:linux-arm64    # Linux ARM64

# All platforms via script
./scripts/package-all-platforms.sh
```

### Native Dependency Management

**node-pty Handling**:
- Listed in `bundledDependencies` to ensure inclusion in VSIX packages
- `npm rebuild` runs during `vscode:prepublish` to compile for target platform
- Each platform build contains the appropriate native binary
- Users automatically receive the correct platform version from VS Code Marketplace

### CI/CD Release Process

**GitHub Actions Workflow** (`.github/workflows/build-platform-packages.yml`):
1. **Trigger**: Git tag push (`v*` pattern)
2. **Build Matrix**: Parallel builds on Windows, macOS, Linux runners
3. **Platform Targeting**: Each job builds for specific architecture using `vsce package --target`
4. **Artifact Collection**: All platform VSIXs collected and uploaded
5. **Release Creation**: GitHub Release with all platform packages attached
6. **Marketplace Publishing**: Automatic publishing to VS Code Marketplace

### Release Workflow

**Automated Release Process**: Uses `for-publish` branch for release management
```bash
# Switch to release branch and merge changes
git checkout for-publish
git merge [feature-branch]

# Create release using npm scripts
npm run release:patch    # Automatically increments version, creates tag, and pushes

# GitHub Actions automatically:
# 1. Runs tests with Mocha exit code 7 handling
# 2. Builds all 9 platform packages in parallel
# 3. Creates GitHub Release with VSIX files
# 4. Attempts VS Code Marketplace publishing (requires VSCE_PAT)
```

**CI/CD Workflows**:
- `release.yml`: Triggered by `v*` tags, handles testing, building, and publishing
- `build-platform-packages.yml`: Creates platform-specific VSIX packages
- `ci.yml`: Standard CI for pull requests and branch pushes

### Marketplace Integration

VS Code Marketplace automatically serves the correct platform package to users based on their system:
- Users see a single extension listing
- VS Code automatically downloads the appropriate platform binary
- No user action required for platform selection

### Development Testing

**Local Platform Testing**:
```bash
# Test current platform build
npm run vsce:package

# Test specific platform (may not work cross-platform)
npm run vsce:package:darwin-x64

# Install and test locally
code --install-extension package.vsix
```

**Cross-Platform Validation**:
- Use GitHub Actions for testing on actual target platforms
- Each platform build includes native node-pty compilation
- VSIX packages contain platform-specific binaries in `node_modules/node-pty/build/`

## Testing and Debugging

### Running Tests Locally
```bash
# Recommended for development - runs unit tests only
npm test

# Run with coverage reporting
npm run test:coverage

# Run specific test files
npm run compile-tests
./node_modules/.bin/mocha --require out/test/shared/TestSetup.js 'out/test/unit/specific/test.js'

# Watch mode for TDD
npm run watch-tests
```

### CI Test Behavior
- **Unit Tests**: Run on all platforms (Ubuntu, macOS, Windows)
- **Exit Code Handling**: CI handles Mocha cleanup exit code 7 as success when tests pass
- **Platform-Specific**: Linux runs full test suite, macOS/Windows compile tests only for performance
- **Test Coverage**: ~275 tests with 93% success rate expected

### Debugging Common Issues
- **Process Polyfill Issues**: Check `TestSetup.ts` for VS Code API mocks and process event handlers
- **Node-pty Compilation**: Ensure native module rebuilding works for target platform
- **Webview Context**: Use VS Code Developer Tools (`Ctrl+Shift+I`) for webview debugging
- **Extension Host**: Check VS Code Developer Console for extension-side errors

### Test Environment Setup
The test environment automatically configures:
- VS Code API mocks for workspace, window, commands
- Process event handler polyfills for Mocha compatibility
- DOM mocking via JSDOM for webview component tests
- Sinon sandboxes for isolated test execution