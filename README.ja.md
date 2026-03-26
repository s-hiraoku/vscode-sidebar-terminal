# Secondary Terminal - VS Code 拡張機能

[![Version](https://img.shields.io/visual-studio-marketplace/v/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Open VSX](https://img.shields.io/open-vsx/v/s-hiraoku/vscode-sidebar-terminal)](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
[![License](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![Documentation](https://img.shields.io/badge/Docs-GitHub%20Pages-blue?logo=github)](https://s-hiraoku.github.io/vscode-sidebar-terminal/)

[English](README.md) | **日本語** | [中文](README.zh-CN.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

サイドバー、ターミナル、AIエージェント -- すべてを一箇所に。

<video src="resources/demo/demo.mov" controls muted loop playsinline poster="resources/readme-hero.png"></video>

## なぜ Secondary Terminal？

- **サイドバーネイティブ** -- 編集中もターミナルを表示したまま。ボトムパネルの切り替えは不要。
- **AIエージェント対応** -- Claude Code、Copilot、Gemini、Codexを自動検出。リアルタイム状態表示と250fps最適化レンダリング。
- **フル機能** -- 分割ビュー、セッション永続化、シェル統合、90以上の設定。本番環境で使えるターミナル。

## クイックスタート

1. **インストール**: VS Codeの拡張機能ビューで "Secondary Terminal" を検索
2. **開く**: アクティビティバーのターミナルアイコン（ST）をクリック
3. **使う**: `claude`、`codex`、`gemini`、`copilot` を実行するとAIエージェントステータスが表示

[Open VSX](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal) やCLI: `code --install-extension s-hiraoku.vscode-sidebar-terminal` でもインストール可能

## 機能

- **複数ターミナル** -- 最大10個の同時ターミナル、タブ管理、ドラッグ&ドロップ、名前変更
- **分割ビュー** -- 垂直/水平分割とドラッグリサイズ
- **AIエージェント検出** -- Claude Code、Codex CLI、Gemini CLI、GitHub Copilot CLI
- **セッション永続化** -- ANSIカラー保持による自動保存/復元
- **シェル統合** -- コマンドステータス、作業ディレクトリ、コマンド履歴
- **ファイル参照** -- `Cmd+Alt+L` / `Ctrl+Alt+L` でターミナルにファイルパスを挿入
- **ターミナル内検索** -- `Cmd+F` / `Ctrl+F`（正規表現対応）
- **フルIMEサポート** -- 日本語、中国語、韓国語入力
- **画像貼り付け** -- macOSで `Cmd+V` でスクリーンショットをClaude Codeに直接貼り付け
- **クロスプラットフォーム** -- Windows、macOS、Linux（9つのプラットフォーム別ビルド）

> **[全機能ドキュメント、キーボードショートカット、設定リファレンス](https://s-hiraoku.github.io/vscode-sidebar-terminal/ja/)**

## プライバシー

VS Codeのテレメトリ設定を尊重。ターミナルの内容やファイルパスは収集しません。詳細は [PRIVACY.md](PRIVACY.md)。

## コントリビューション

開発セットアップとガイドラインは [CONTRIBUTING.md](CONTRIBUTING.md) を参照。

## リンク

- [ドキュメント](https://s-hiraoku.github.io/vscode-sidebar-terminal/ja/)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
- [Open VSX Registry](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
- [変更履歴](CHANGELOG.md)

## ライセンス

MIT -- [LICENSE](LICENSE) を参照。
