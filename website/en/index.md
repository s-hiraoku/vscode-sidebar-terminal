---
layout: home

hero:
  name: Secondary Terminal
  text: Your sidebar, your terminal, your AI agents
  tagline: A full-featured terminal for VS Code with built-in AI agent detection for Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI.
  image:
    src: /images/icon.png
    alt: Secondary Terminal
  actions:
    - theme: brand
      text: Get Started
      link: /en/guide/quick-start
    - theme: alt
      text: View on Marketplace
      link: https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal

features:
  - icon: 🖥️
    title: Multiple Terminals
    details: Up to 10 concurrent terminals with tab management, drag & drop reordering, and double-click to rename.
    link: /en/features/terminal-management
  - icon: ⚡
    title: Split Views
    details: Vertical and horizontal splitting with drag-to-resize. Dynamic direction adapts to panel location.
    link: /en/features/split-view
  - icon: 🤖
    title: AI Agent Detection
    details: Auto-detects Claude Code, Copilot, Gemini (v0.28.2+), Codex CLI with real-time status indicators.
    link: /en/features/ai-integration
  - icon: 💾
    title: Session Persistence
    details: Auto-save and restore terminal state across VS Code restarts with ANSI color preservation.
    link: /en/features/session-persistence
  - icon: 🐚
    title: Shell Integration
    details: Command status indicators, working directory display, and command history tracking.
    link: /en/features/shell-integration
  - icon: ⌨️
    title: Rich Input Support
    details: Full clipboard, IME support (Japanese/Chinese/Korean), Alt+Click cursor positioning, and image paste.
    link: /en/features/input-interaction
  - icon: 🔍
    title: Find in Terminal
    details: Search through terminal output with regex support. Navigate between commands with keyboard shortcuts.
    link: /en/features/navigation
  - icon: 🔗
    title: Smart Link Detection
    details: File paths open in VS Code, URLs in browser, emails detected. All automatic.
    link: /en/features/link-detection
  - icon: 🎨
    title: Fully Customizable
    details: 90+ settings for fonts, cursor, theme, colors, header, and terminal behavior.
    link: /en/features/customization
  - icon: ♿
    title: Accessible
    details: Screen reader support and WCAG-compliant contrast ratios for inclusive terminal usage.
    link: /en/features/accessibility
  - icon: 🔔
    title: Agent Notifications
    details: Sound and toast notifications when AI agents are waiting for your input.
    link: /en/features/ai-integration
  - icon: 📊
    title: Performance Optimized
    details: WebGL rendering, 250fps AI streaming, sub-1s restore, sub-100ms disposal.
    link: /en/features/terminal-management
---

<script setup>
import { withBase } from 'vitepress'
</script>

<div style="text-align: center; margin: 2rem 0">

## See It in Action

<video class="demo-video" controls muted loop playsinline width="720">
  <source :src="withBase('/demo.mp4')" type="video/mp4" />
</video>

</div>

## Why Secondary Terminal?

| | |
|---|---|
| **Sidebar-native** | Keep your terminal visible while editing. No more toggling the bottom panel. |
| **AI agent aware** | Auto-detects Claude Code, Copilot, Gemini, Codex. Real-time status and 250fps rendering. |
| **Full-featured** | Split views, session persistence, shell integration, 90+ settings. Production terminal. |
| **Cross-platform** | Windows, macOS, and Linux. Available on VS Code Marketplace and Open VSX. |

## Quick Install

```sh
code --install-extension s-hiraoku.vscode-sidebar-terminal
```

Or search **"Secondary Terminal"** in the VS Code Extensions view. Also available on [Open VSX](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal) for VSCodium, Gitpod, and Eclipse Theia.
