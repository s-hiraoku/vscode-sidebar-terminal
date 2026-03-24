---
layout: home

hero:
  name: Secondary Terminal
  text: 侧边栏、终端、AI代理
  tagline: 一个功能齐全的VS Code侧边栏终端，内置Claude Code、Codex CLI、Gemini CLI、GitHub Copilot CLI的AI代理检测。
  image:
    src: /images/icon.png
    alt: Secondary Terminal
  actions:
    - theme: brand
      text: 快速开始
      link: /zh-CN/guide/quick-start
    - theme: alt
      text: 在Marketplace查看
      link: https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal

features:
  - icon: 🖥️
    title: 多终端
    details: 最多10个并发终端，标签管理，拖放重排，双击重命名。
    link: /zh-CN/features/terminal-management
  - icon: ⚡
    title: 分屏视图
    details: 垂直/水平分屏，拖拽调整大小，根据面板位置自动调整方向。
    link: /zh-CN/features/split-view
  - icon: 🤖
    title: AI代理检测
    details: 实时自动检测Claude Code、Copilot、Gemini (v0.28.2+)、Codex CLI。
    link: /zh-CN/features/ai-integration
  - icon: 💾
    title: 会话持久化
    details: 支持ANSI颜色保留的自动保存和恢复。VS Code重启后从中断处继续。
    link: /zh-CN/features/session-persistence
  - icon: ⌨️
    title: 丰富的输入支持
    details: 完整剪贴板、IME支持（中文/日文/韩文）、Alt+点击光标定位。
    link: /zh-CN/features/input-interaction
  - icon: 🎨
    title: 完全自定义
    details: 90+设置项，涵盖字体、光标、主题、颜色、终端行为。
    link: /zh-CN/features/customization
---

## 为什么选择 Secondary Terminal？

| | |
|---|---|
| **侧边栏原生** | 编辑时保持终端可见，无需切换底部面板。 |
| **AI代理感知** | 自动检测Claude Code、Copilot、Gemini、Codex。实时状态和250fps渲染。 |
| **功能齐全** | 分屏、会话持久化、Shell集成、90+设置。生产级终端。 |

## 快速安装

```sh
code --install-extension s-hiraoku.vscode-sidebar-terminal
```
