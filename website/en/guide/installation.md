---
title: Installation
---

# Installation

## VS Code Marketplace

The easiest way to install Secondary Terminal:

1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"Secondary Terminal"**
4. Click **Install**

Or install via the command line:

```sh
code --install-extension s-hiraoku.vscode-sidebar-terminal
```

## Open VSX Registry

For VSCodium, Gitpod, and Eclipse Theia users:

- Visit [Open VSX](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
- Or install via CLI in compatible editors

## Requirements

- **VS Code** 1.106.0 or later
- **Node.js** 18.0 or later (for development only)
- Works on **Windows**, **macOS**, and **Linux**

## Platform-Specific Builds

Secondary Terminal provides optimized builds for each platform:

| Platform | Build |
|----------|-------|
| Windows x64 | `win32-x64` |
| Windows ARM64 | `win32-arm64` |
| macOS x64 (Intel) | `darwin-x64` |
| macOS ARM64 (Apple Silicon) | `darwin-arm64` |
| Linux x64 | `linux-x64` |
| Linux ARM64 | `linux-arm64` |
| Linux ARMhf | `linux-armhf` |
| Alpine x64 | `alpine-x64` |
| Alpine ARM64 | `alpine-arm64` |

The Marketplace automatically delivers the correct build for your platform.

## Verify Installation

After installing, you should see a terminal icon (ST) in the VS Code Activity Bar (left sidebar). Click it to open your first terminal.
