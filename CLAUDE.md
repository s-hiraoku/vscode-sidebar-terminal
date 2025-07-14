# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Testing
```bash
# Main build commands
npm run compile           # Build extension and webview
npm run watch            # Watch mode for development  
npm run package          # Production build with optimizations

# Testing
npm test                 # Run all tests
npm run test:unit        # Run unit tests only with coverage
npm run test:integration # Run integration tests only
npm run test:coverage    # Run all tests with coverage report
npm run pretest         # Compile tests + build + lint (runs before test)
npm run compile-tests   # Compile test files only
npm run watch-tests     # Watch test files

# Code Quality
npm run lint            # ESLint checking
npm run format          # Prettier formatting

# Extension Packaging
npm run vsce:package    # Create .vsix package
npm run vsce:publish    # Publish to marketplace
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
- **TerminalWebviewManager**: Main webview controller, manages xterm.js instances and UI state
- **SplitManager**: Handles terminal splitting functionality and layout calculations
- **StatusManager/SimpleStatusManager**: User feedback and status display
- **SettingsPanel**: In-webview settings configuration
- **NotificationUtils**: Unified error/warning/info notifications

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
- Kill operations always target the active terminal (not by ID)
- Infinite loop prevention using `_terminalBeingKilled` tracking set

**Message Communication**
- Webview ↔ Extension communication via `postMessage` protocol
- Commands: `init`, `output`, `input`, `resize`, `clear`, `killTerminal`, etc.
- Event-driven architecture with proper cleanup on disposal

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
- `src/webview/main.ts`: WebView entry point using xterm.js
- `src/webview/managers/`: UI component managers (split, status, etc.)
- `src/webview/components/`: Reusable UI components
- `src/webview/utils/`: Utility functions for DOM, themes, notifications

**Configuration and Types**
- `package.json`: Extension manifest, commands, settings schema, menu contributions
- `src/types/common.ts`: Shared interfaces between extension and webview
- `src/constants/`: Application constants and terminal configuration

### Important Implementation Details

**Terminal Kill Specification**
- The kill button and `killTerminal` command always kill the **active terminal**, not a specific terminal ID
- This is enforced in both TerminalManager and webview layers

**Webview Context Retention**
- WebView uses `retainContextWhenHidden: true` to maintain state when sidebar is hidden
- Terminal processes continue running in background via node-pty

**Error Handling Strategy**
- Unified error display via NotificationUtils in webview
- Extension-level error handling with user-friendly messages
- Graceful degradation when terminal processes fail

**Testing Architecture**
- Comprehensive test suite covering extension, terminal manager, webview, and integration scenarios
- Performance tests for memory usage and terminal lifecycle
- End-to-end tests using VS Code test runner

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
- `@homebridge/node-pty-prebuilt-multiarch` is bundled as dependency via `bundledDependencies` in package.json
- Prebuilt binaries eliminate build-time dependencies and compilation issues

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

**Performance Optimizations for Claude Code Output**
- Adaptive buffering: shorter flush intervals during frequent output (8ms vs 16ms)
- Direct writes for specific terminal IDs to avoid cross-terminal interference
- Immediate flush for large outputs (≥1000 chars) to maintain cursor accuracy

## Alt+Click Cursor Positioning

### Overview
This extension implements VS Code standard Alt+Click cursor positioning with intelligent conflict detection for Claude Code interactions.

### Current Limitations
- **Claude Code Interference**: Alt+Click may not work reliably during Claude Code execution due to:
  - High-frequency output causing cursor position desynchronization
  - Raw mode terminal conflicts with xterm.js Alt+Click implementation
  - Escape sequences being output directly instead of cursor positioning

### Intelligent Conflict Resolution
The extension automatically detects Claude Code activity and temporarily disables Alt+Click during:
- Claude Code execution sessions (detected by output patterns)
- High-frequency terminal output (>500 chars in 2 seconds)
- Large output chunks (≥1000 characters)

### User Experience
- **Visual Feedback**: When Alt+Click is disabled, users see:
  - "⚡ Claude Code Active" tooltip at click location
  - System notification explaining the temporary disable state
  - Re-enablement notification when Claude Code session ends

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
2. **Claude Code Sessions**: Alt+Click is temporarily disabled for optimal performance
3. **Manual Re-enable**: Alt+Click automatically re-enables after Claude Code detection ends
4. **Troubleshooting**: Check VS Code Developer Console for Alt+Click event logs

### Technical Implementation
- **Detection Patterns**: Uses regex patterns to identify Claude Code output
- **Buffer Optimization**: Claude Code output uses 4ms flush intervals vs 16ms normal
- **State Management**: Tracks Claude Code activity and Alt+Click availability
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

**@homebridge/node-pty-prebuilt-multiarch Handling**:
- Uses prebuilt binaries instead of compile-time native modules for reliability
- Listed in `bundledDependencies` to ensure inclusion in VSIX packages  
- No compilation required during CI/CD - uses pre-compiled platform-specific binaries
- Eliminates cross-compilation issues on GitHub Actions runners
- Each platform build contains the appropriate prebuilt binary
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

```bash
# Development workflow
npm version patch|minor|major   # Update package.json version
git push origin for-publish     # Push changes
git tag vX.X.X                 # Create release tag
git push origin vX.X.X         # Trigger automated release

# GitHub Actions automatically:
# 1. Builds all 9 platform packages
# 2. Creates GitHub Release
# 3. Publishes to VS Code Marketplace
```

### Marketplace Integration

VS Code Marketplace automatically serves the correct platform package to users based on their system:
- Users see a single extension listing
- VS Code automatically downloads the appropriate platform binary
- No user action required for platform selection

### Development Testing

**Local Platform Testing**:
```bash
# Test current platform build and validate node-pty
./scripts/test-local-build.sh

# Test specific platform (may not work cross-platform)
npm run vsce:package:darwin-x64

# Install and test locally
code --install-extension package.vsix
```

**Cross-Platform Validation**:
- Use GitHub Actions for testing on actual target platforms
- Each platform build includes prebuilt binaries from `@homebridge/node-pty-prebuilt-multiarch`
- VSIX packages contain platform-specific prebuilt binaries
- Validation checks verify prebuilt module functionality via `node -e "require('@homebridge/node-pty-prebuilt-multiarch')"`

## Critical Development Guidelines

### @homebridge/node-pty-prebuilt-multiarch Native Module Handling
- **Dynamic Import**: TerminalManager uses `await import('@homebridge/node-pty-prebuilt-multiarch')` with comprehensive error handling
- **Platform Validation**: Extension validates platform support before attempting to load the prebuilt module
- **Error Messages**: Platform-specific error messages for Mach-O (macOS), ELF (Linux), and DLL (Windows) issues with detailed architecture diagnostics
- **Build Verification**: Use `scripts/test-local-build.sh` to verify prebuilt module installation
- **Prebuilt Benefits**: No cross-compilation issues, reliable ARM64/x64 binaries, eliminates "slice is not valid mach-o file" errors

### Pull Request Protocol
**IMPORTANT**: Never merge pull requests automatically. Always request explicit approval before merging.

### Multi-Platform Build Requirements
- **Prebuilt Binaries**: Uses `@homebridge/node-pty-prebuilt-multiarch` eliminating need for cross-compilation
- `bundledDependencies` configuration ensures prebuilt module is included in VSIX packages
- CI/CD pipeline at `.github/workflows/build-platform-packages.yml` handles cross-platform builds without native compilation
- Platform-specific builds automatically include correct prebuilt binaries for target architecture
- No need for `npm rebuild` during development - prebuilt binaries work across platforms

### Code Quality Requirements
**Always run before committing:**
```bash
npm run format    # Prettier code formatting
npm run lint      # ESLint code quality checks
```

## Recent Critical Fixes (v0.1.15)

### macOS ARM64 Compatibility Resolution
The extension previously suffered from "slice is not valid mach-o file" errors on macOS M1/M2 systems due to:
- GitHub Actions `macos-latest` runners being Intel x64 machines
- Cross-compilation issues when building `darwin-arm64` targets with `npm rebuild node-pty`
- Incompatible x64 binaries being packaged in ARM64 VSIXs

**Solution Implemented:**
- Migrated from `node-pty` to `@homebridge/node-pty-prebuilt-multiarch`
- Eliminated cross-compilation requirements in CI/CD
- Prebuilt binaries ensure correct architecture matching for all platforms
- Updated GitHub Actions workflow to verify prebuilt binary installation instead of compilation

This architectural change ensures reliable operation across all supported platforms without compilation dependencies.