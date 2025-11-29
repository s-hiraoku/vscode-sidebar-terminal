# VS Code Sidebar Terminal Project Overview

## Purpose
A powerful VS Code extension that displays a fully-featured terminal in the sidebar with split support, Alt+Click cursor positioning, and multi-platform compatibility.

## Key Features
- **Sidebar Integration**: Terminal integrated into Primary Sidebar (left side)
- **Multiple Terminal Management**: Run up to 5 terminals simultaneously
- **Session Persistence**: Automatic terminal session restore after VS Code restart
- **Full Terminal Functionality**: Complete shell execution environment powered by node-pty
- **Special Key Support**: Backspace, Ctrl+C, Ctrl+L, and other special key combinations
- **IME Support**: Multi-language input support including Japanese, Chinese, and Korean
- **CLI Agent Integration**: File reference shortcuts for Claude Code and GitHub Copilot
- **Cross-Platform**: Full support for Windows, macOS, and Linux with native binaries
- **Alt+Click Cursor Positioning**: VS Code-standard Alt+Click to move cursor

## Tech Stack
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js 18+
- **VS Code**: Extension API v1.74.0+
- **Terminal Emulation**: xterm.js v5.3.0
- **PTY Management**: @homebridge/node-pty-prebuilt-multiarch
- **Build System**: Webpack 5
- **Testing**: Mocha, Chai, Sinon, nyc (Istanbul)
- **Linting**: ESLint with TypeScript plugin
- **Formatting**: Prettier
- **CI/CD**: GitHub Actions

## Architecture
- **Extension Host (Node.js)**: TerminalManager, SecandarySidebar, Extension Entry Point
- **WebView (Browser)**: TerminalWebviewManager, various UI managers, xterm.js
- **Communication**: postMessage protocol between extension and webview
- **State Management**: Single source of truth in TerminalManager

## Development Status
- Version: 0.1.35
- Publisher: s-hiraoku
- License: MIT
- Active development with TDD methodology