# Secondary Terminal - VS Code 扩展

[![Version](https://img.shields.io/visual-studio-marketplace/v/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Open VSX](https://img.shields.io/open-vsx/v/s-hiraoku/vscode-sidebar-terminal)](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
[![License](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![Ask DeepWiki](https://img.shields.io/badge/Ask-DeepWiki-blue)](https://deepwiki.com/s-hiraoku/vscode-sidebar-terminal)

[English](README.md) | [日本語](README.ja.md) | **中文** | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

侧边栏、终端、AI 代理——一切尽在一处。一个常驻于 VS Code 侧边栏的全功能终端，内置 Claude Code、Codex CLI、Gemini CLI、GitHub Copilot CLI 的 AI 代理检测功能。

<video src="resources/demo/demo.mov" controls muted loop playsinline poster="resources/readme-hero.png"></video>

## 为什么选择 Secondary Terminal？

- **侧边栏原生终端** -- 编辑代码时保持终端可见，无需切换底部面板。
- **AI 代理感知** -- 自动检测 Claude Code、Copilot、Gemini (v0.28.2+)、Codex。显示实时连接状态，并针对 AI 流式输出优化渲染（最高 250fps）。
- **全功能** -- 分屏视图、会话持久化、Shell 集成、终端内搜索、命令装饰器、90 项可配置设置。这不是玩具——而是一个生产级终端。

## 快速开始

1. **安装**：在 VS Code 扩展视图中搜索 "Secondary Terminal"
   - 也可从 [Open VSX](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)（VSCodium、Gitpod）或通过 [CLI](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal) 安装：`code --install-extension s-hiraoku.vscode-sidebar-terminal`
2. **打开**：点击活动栏中的终端图标（ST）
3. **使用**：终端将以默认 Shell 启动。运行 `claude`、`codex`、`gemini` 或 `gh copilot`，即可在标题栏看到 AI 代理状态。

## 功能亮点

### AI 代理工作流

|                    |                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| **自动检测**       | Claude Code、Codex CLI、Gemini CLI (v0.28.2+)、GitHub Copilot CLI 的实时状态指示器                               |
| **文件引用**       | `Cmd+Alt+L` / `Ctrl+Alt+L` 插入当前文件路径；`Cmd+Alt+A` / `Ctrl+Alt+A` 插入所有打开的文件          |
| **图片粘贴**       | macOS 上 `Cmd+V` 可将截图直接粘贴到 Claude Code                                                     |
| **优化渲染**       | AI 流式输出的 250fps 自适应缓冲                                                                      |
| **会话持久化**     | VS Code 重启后终端状态保持不变——从中断处继续                                                         |
| **多代理**         | 在不同终端运行不同代理，使用 `Cmd+Alt+1..5` / `Alt+1..5` 切换                                       |

### 终端强大功能

|                    |                                                                            |
| ------------------ | -------------------------------------------------------------------------- |
| **多终端**         | 最多 5 个并发终端，支持标签管理（拖拽排序）                                |
| **分屏视图**       | 垂直/水平分屏，可拖拽调整大小                                              |
| **会话持久化**     | 自动保存/恢复，保留 ANSI 颜色（最多 3,000 行回滚）                        |
| **Shell 集成**     | 命令状态指示器、工作目录显示、命令历史                                     |
| **终端内搜索**     | `Ctrl+F` / `Cmd+F` -- 支持正则表达式的终端输出搜索                        |
| **命令装饰器**     | 命令边界处的成功/错误/运行中视觉指示器                                     |
| **导航标记**       | `Cmd+Up/Down` / `Ctrl+Up/Down` 在命令间跳转                               |
| **回滚压缩**       | 压缩存储与渐进加载，适用于大量历史记录                                     |
| **终端配置文件**   | 按平台设置 Shell 配置文件（bash、zsh、fish、PowerShell 等）                |

### 开发者体验

|                    |                                                                    |
| ------------------ | ------------------------------------------------------------------ |
| **完整 IME 支持**  | 日语、中文、韩语输入，采用 VS Code 标准处理方式                    |
| **链接检测**       | 文件路径在 VS Code 中打开，URL 在浏览器中打开，邮件链接自动检测   |
| **Alt+点击**       | VS Code 标准光标定位                                               |
| **鼠标追踪**       | TUI 应用支持（vim、htop、zellij），自动鼠标模式                    |
| **完整剪贴板**     | Ctrl/Cmd+C/V，支持图片粘贴                                        |
| **跨平台**         | Windows、macOS、Linux -- 9 个平台专用构建                          |
| **无障碍访问**     | 屏幕阅读器支持                                                     |
| **调试面板**       | `Ctrl+Shift+D` 实时监控                                            |

## 键盘快捷键

| 快捷键                                         | 操作                                                 |
| --------------------------------------------- | --------------------------------------------------- |
| `Cmd+C` / `Ctrl+C`                            | 复制选中文本（无选中时发送 SIGINT）                 |
| `Cmd+V` / `Ctrl+V`                            | 粘贴（文本和图片）                                  |
| `Shift+Enter` / `Option+Enter`                | 插入换行（Claude Code 多行提示）                    |
| `Cmd+Alt+L` / `Ctrl+Alt+L`                    | 为 AI 代理插入当前文件引用                          |
| `Cmd+Alt+A` / `Ctrl+Alt+A`                    | 为 AI 代理插入所有打开的文件引用                    |
| `Cmd+K Cmd+C` / `Ctrl+K Ctrl+C`               | 激活 GitHub Copilot Chat                            |
| ``Ctrl+` ``                                   | 聚焦 Secondary Terminal 视图                        |
| ``Ctrl+Shift+` ``                             | 创建新终端                                          |
| `Cmd+\` (Mac) / `Ctrl+Shift+5`                | 垂直分屏终端                                        |
| `Cmd+K` / `Ctrl+K`                            | 清除终端                                            |
| `Cmd+Up/Down` (Mac) / `Ctrl+Up/Down`          | 滚动到上/下一个命令                                 |
| `Alt+Cmd+Left/Right` (Mac) / `Alt+Left/Right` | 聚焦上/下一个终端                                   |
| `Cmd+Alt+1..5` (Mac) / `Alt+1..5`             | 按索引聚焦终端                                      |
| `Ctrl+P`                                      | 切换面板导航模式 (需启用设置)                       |
| `Cmd+R` / `Ctrl+R`                            | 运行最近的命令                                      |
| `Cmd+A` / `Ctrl+A`                            | 全选终端内容                                        |
| `Ctrl+Shift+D`                                | 切换调试面板                                        |

### 面板导航模式 (Zellij 风格)

> **注意**: 面板导航**默认禁用**，以避免与终端多路复用器（zellij、tmux、screen）冲突。在设置中启用: `"secondaryTerminal.panelNavigation.enabled": true`

使用 `Ctrl+P` 进入专用导航模式（macOS 上 `Cmd+P` 保留用于 VS Code Quick Open）。在该模式下：
- 使用 `h`, `j`, `k`, `l` 或 `方向键` 在分屏终端之间切换。
- 再次按下 `Ctrl+P` 或 `Escape` 键退出。
- 处于导航模式时，右上角会显示视觉指示器。

> **Claude Code 小技巧**：
>
> - macOS 上 `Cmd+V` 可同时粘贴文本和图片（截图）到 Claude Code
> - 使用 `Shift+Enter` 或 `Option+Enter` 插入换行以编写多行提示

## 配置

该扩展有 90 项设置。以下是最有用的自定义项：

```json
{
  // 外观
  "secondaryTerminal.fontSize": 12,
  "secondaryTerminal.fontFamily": "monospace",
  "secondaryTerminal.cursorStyle": "block",
  "secondaryTerminal.scrollback": 2000,

  // AI 代理集成
  "secondaryTerminal.enableCliAgentIntegration": true,

  // 会话持久化
  "secondaryTerminal.enablePersistentSessions": true,
  "secondaryTerminal.persistentSessionScrollback": 1000,

  // 分屏视图
  "secondaryTerminal.maxSplitTerminals": 5,
  "secondaryTerminal.dynamicSplitDirection": true,

  // 面板导航 (Zellij 风格 Ctrl+P)
  "secondaryTerminal.panelNavigation.enabled": false,

  // Shell 集成
  "secondaryTerminal.shellIntegration.enabled": true,
  "secondaryTerminal.shellIntegration.showCommandStatus": true
}
```

在 VS Code 设置中搜索 `secondaryTerminal` 可查看完整设置列表，所有默认值请参阅 [package.json](package.json)。

## 性能

| 指标               | 值                                                      |
| ------------------ | ------------------------------------------------------- |
| **渲染**           | WebGL（自动回退到 DOM）                                 |
| **输出缓冲**       | 自适应 2-16ms 间隔（AI 输出最高 250fps）                |
| **回滚恢复**       | 1,000 行保留 ANSI 颜色，不到 1 秒                      |
| **终端销毁**       | 清理时间 <100ms                                         |
| **构建大小**       | 扩展 ~790 KiB + WebView ~1.5 MiB                       |

## 故障排除

### 终端无法启动

- 检查 `secondaryTerminal.shell` 是否指向 PATH 中的有效 Shell
- 尝试设置显式的 Shell 路径

### AI 代理未被检测到

- 确认 `secondaryTerminal.enableCliAgentIntegration` 为 `true`
- 查看调试面板（`Ctrl+Shift+D`）中的检测日志

### 性能问题

- 降低 `secondaryTerminal.scrollback` 的值
- 通过调试面板检查系统资源

### 会话未恢复

- 确认 `secondaryTerminal.enablePersistentSessions` 为 `true`
- 如数据损坏，使用 "Clear Corrupted Terminal History" 命令

### TUI 显示问题

- zellij 等应用会自动启用鼠标追踪
- 如分屏模式出现显示问题，尝试切换到全屏模式

## 已知限制

- **运行中的进程**：VS Code 重启时长时间运行的进程会终止（回滚内容保留）。如需进程持久化，请使用 `tmux`/`screen`。
- **平台支持**：由于 node-pty 预编译二进制的限制，不支持 Alpine Linux 和 Linux armhf。

## 开发

```bash
npm install && npm run compile    # 构建
npm test                          # 4,000+ 单元测试
npm run test:e2e                  # E2E 测试（Playwright）
npm run watch                     # 监视模式
```

质量：TypeScript 严格模式、TDD 工作流、4,000+ 单元测试、Playwright E2E 覆盖、9 平台 CI/CD 构建。

## 隐私

本扩展遵循 VS Code 的遥测设置。我们仅收集匿名使用指标（功能使用情况、错误率）——从不收集终端内容、文件路径或个人数据。

禁用方式：在 VS Code 设置中将 `telemetry.telemetryLevel` 设为 `"off"`。详情请参阅 [PRIVACY.md](PRIVACY.md)。

## 贡献

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/my-feature`
3. 遵循 TDD 实践
4. 运行质量检查：`npm run pre-release:check`
5. 提交 Pull Request

查看 [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues) 了解待办任务。

## 链接

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
- [Open VSX Registry](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
- [GitHub 仓库](https://github.com/s-hiraoku/vscode-sidebar-terminal)
- [更新日志](CHANGELOG.md)
- [博客文章（日语）](https://zenn.dev/hiraoku/articles/0de654620028a0)

## 许可证

MIT License - 请参阅 [LICENSE](LICENSE) 文件。

---

**为使用 AI 代理的 VS Code 开发者而构建**
