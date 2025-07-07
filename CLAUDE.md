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