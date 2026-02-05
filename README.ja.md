# Secondary Terminal - VS Code 拡張機能

[![Version](https://img.shields.io/visual-studio-marketplace/v/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Open VSX](https://img.shields.io/open-vsx/v/s-hiraoku/vscode-sidebar-terminal)](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
[![License](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![Ask DeepWiki](https://img.shields.io/badge/Ask-DeepWiki-blue)](https://deepwiki.com/s-hiraoku/vscode-sidebar-terminal)

[English](README.md) | **日本語**

サイドバー、ターミナル、AI エージェント -- すべてを一つの場所に。VS Code サイドバーに常駐するフル機能ターミナル。Claude Code、Codex CLI、Gemini CLI、GitHub Copilot CLI、CodeRabbit CLI の AI エージェント検出を内蔵しています。

![Demo](resources/readme-hero.png)

## なぜ Secondary Terminal？

- **サイドバーネイティブターミナル** -- 編集しながらターミナルを常時表示。ボトムパネルの切り替えはもう不要です。
- **AI エージェント対応** -- Claude Code、Copilot、Gemini、Codex、CodeRabbit を自動検出。リアルタイム接続ステータスを表示し、AI ストリーミング出力に最適化されたレンダリング（最大250fps）を提供します。
- **フル機能** -- 分割表示、セッション永続化、シェル統合、ターミナル内検索、コマンドデコレーション、89の設定項目。おもちゃではなく、本格的なプロダクションターミナルです。

## クイックスタート

1. **インストール**: VS Code 拡張機能ビューで "Secondary Terminal" を検索
   - [Open VSX](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)（VS Codium, Gitpod）や [CLI](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal): `code --install-extension s-hiraoku.vscode-sidebar-terminal` でも利用可能
2. **起動**: アクティビティバーのターミナルアイコン（ST）をクリック
3. **使用**: デフォルトシェルでターミナルが開きます。`claude`、`codex`、`gemini`、`gh copilot` を実行すると、ヘッダーに AI エージェントステータスが表示されます。

## 主な機能

### AI エージェントワークフロー

|                        |                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| **自動検出**           | Claude Code、Codex CLI、Gemini CLI、GitHub Copilot CLI、CodeRabbit CLI のリアルタイムステータス表示            |
| **ファイル参照**       | `Cmd+Alt+L` / `Ctrl+Alt+L` で現在のファイルパスを挿入、`Cmd+Alt+A` / `Ctrl+Alt+A` で開いている全ファイルを挿入 |
| **画像貼り付け**       | macOS で `Cmd+V` によりスクリーンショットを Claude Code に直接貼り付け                                         |
| **最適化レンダリング** | AI ストリーミング出力向け 250fps 適応バッファリング                                                            |
| **セッション永続化**   | VS Code 再起動後もターミナル状態を維持 -- 中断したところから再開                                               |
| **マルチエージェント** | 異なるターミナルで異なるエージェントを実行、`Cmd+Alt+1..5` / `Alt+1..5` で切り替え                             |

### ターミナルパワー機能

|                            |                                                                        |
| -------------------------- | ---------------------------------------------------------------------- |
| **複数ターミナル**         | 最大5つの同時ターミナル、タブ管理（ドラッグ&ドロップ並び替え）         |
| **分割表示**               | ドラッグでリサイズ可能な縦・横分割                                     |
| **セッション永続化**       | ANSI カラー保持付き自動保存・復元（最大3,000行のスクロールバック）     |
| **シェル統合**             | コマンドステータス表示、作業ディレクトリ表示、コマンド履歴             |
| **ターミナル内検索**       | `Ctrl+F` / `Cmd+F` -- 正規表現対応のターミナル出力検索                 |
| **コマンドデコレーション** | コマンド境界での成功/エラー/実行中の視覚的インジケータ                 |
| **ナビゲーションマーク**   | `Cmd+Up/Down` / `Ctrl+Up/Down` でコマンド間をジャンプ                  |
| **スクロールバック圧縮**   | 大規模履歴向けのプログレッシブローディング付き圧縮ストレージ           |
| **ターミナルプロファイル** | プラットフォーム別シェルプロファイル（bash, zsh, fish, PowerShell 等） |

### 開発者体験

|                            |                                                                       |
| -------------------------- | --------------------------------------------------------------------- |
| **フル IME 対応**          | 日本語、中国語、韓国語入力（VS Code 標準ハンドリング）                |
| **リンク検出**             | ファイルパスは VS Code で開く、URL はブラウザで開く、メールリンク検出 |
| **Alt+Click**              | VS Code 標準のカーソル配置                                            |
| **マウストラッキング**     | TUI アプリ対応（vim, htop, zellij）、自動マウスモード                 |
| **フルクリップボード**     | Ctrl/Cmd+C/V、画像貼り付け対応                                        |
| **クロスプラットフォーム** | Windows、macOS、Linux -- 9つのプラットフォーム別ビルド                |
| **アクセシビリティ**       | スクリーンリーダー対応                                                |
| **デバッグパネル**         | `Ctrl+Shift+D` でリアルタイム監視                                     |

## キーボードショートカット

| ショートカット                                | アクション                                           |
| --------------------------------------------- | ---------------------------------------------------- |
| `Cmd+C` / `Ctrl+C`                            | 選択テキストをコピー（選択なしの場合は SIGINT 送信） |
| `Cmd+V` / `Ctrl+V`                            | 貼り付け（テキストと画像）                           |
| `Shift+Enter` / `Option+Enter`                | 改行を挿入（Claude Code 複数行プロンプト用）         |
| `Cmd+Alt+L` / `Ctrl+Alt+L`                    | 現在のファイル参照を AI エージェントに挿入           |
| `Cmd+Alt+A` / `Ctrl+Alt+A`                    | 開いている全ファイルの参照を AI エージェントに挿入   |
| `Cmd+K Cmd+C` / `Ctrl+K Ctrl+C`               | GitHub Copilot Chat を起動                           |
| ``Ctrl+` ``                                   | Secondary Terminal ビューにフォーカス                |
| ``Ctrl+Shift+` ``                             | 新しいターミナルを作成                               |
| `Cmd+\`（Mac）/ `Ctrl+Shift+5`                | ターミナルを縦分割                                   |
| `Cmd+K` / `Ctrl+K`                            | ターミナルをクリア                                   |
| `Cmd+Up/Down`（Mac）/ `Ctrl+Up/Down`          | 前/次のコマンドにスクロール                          |
| `Alt+Cmd+Left/Right`（Mac）/ `Alt+Left/Right` | 前/次のターミナルにフォーカス                        |
| `Cmd+Alt+1..5`（Mac）/ `Alt+1..5`             | インデックスでターミナルにフォーカス                 |
| `Cmd+R` / `Ctrl+R`                            | 最近のコマンドを実行                                 |
| `Cmd+A` / `Ctrl+A`                            | ターミナルの全内容を選択                             |
| `Ctrl+Shift+D`                                | デバッグパネルを切り替え                             |

> **Claude Code のヒント**:
>
> - macOS では `Cmd+V` でテキストと画像（スクリーンショット）の両方を Claude Code に貼り付け可能
> - 複数行プロンプトには `Shift+Enter` または `Option+Enter` で改行を挿入

## 設定

拡張機能には89の設定項目があります。最も影響の大きい設定:

```json
{
  // 外観
  "secondaryTerminal.fontSize": 12,
  "secondaryTerminal.fontFamily": "monospace",
  "secondaryTerminal.cursorStyle": "block",
  "secondaryTerminal.scrollback": 2000,

  // AI エージェント統合
  "secondaryTerminal.enableCliAgentIntegration": true,

  // セッション永続化
  "secondaryTerminal.enablePersistentSessions": true,
  "secondaryTerminal.persistentSessionScrollback": 1000,

  // 分割表示
  "secondaryTerminal.maxSplitTerminals": 5,
  "secondaryTerminal.dynamicSplitDirection": true,

  // シェル統合
  "secondaryTerminal.shellIntegration.enabled": true,
  "secondaryTerminal.shellIntegration.showCommandStatus": true
}
```

VS Code 設定で `secondaryTerminal` を検索すると全項目が表示されます。すべてのデフォルト値は [package.json](package.json) を参照してください。

## パフォーマンス

| 指標                     | 値                                         |
| ------------------------ | ------------------------------------------ |
| **レンダリング**         | WebGL（DOM 自動フォールバック）            |
| **出力バッファリング**   | 適応型 2-16ms 間隔（AI 出力時最大 250fps） |
| **スクロールバック復元** | 1,000行で1秒未満（ANSI カラー保持）        |
| **ターミナル廃棄**       | 100ms 未満のクリーンアップ時間             |
| **ビルドサイズ**         | 拡張機能 ~790 KiB + WebView ~1.5 MiB       |

## トラブルシューティング

### ターミナルが起動しない

- `secondaryTerminal.shell` が PATH 内の有効なシェルを指しているか確認
- 明示的なシェルパスの設定を試す

### AI エージェントが検出されない

- `secondaryTerminal.enableCliAgentIntegration` が `true` か確認
- デバッグパネル（`Ctrl+Shift+D`）で検出ログを確認

### パフォーマンスの問題

- `secondaryTerminal.scrollback` の値を下げる
- デバッグパネルでシステムリソースを確認

### セッションが復元されない

- `secondaryTerminal.enablePersistentSessions` が `true` か確認
- データが破損している場合は「Clear Corrupted Terminal History」コマンドを使用

### TUI アプリケーションの表示問題

- zellij などのアプリケーションではマウストラッキングが自動的に有効化
- 分割モードで表示問題が発生した場合、フルスクリーンモードに切り替えを試す

## 既知の制限事項

- **実行中プロセス**: VS Code 再起動時に長時間実行プロセスは終了します（スクロールバックは保持）。プロセス永続化には `tmux`/`screen` を使用してください。
- **プラットフォームサポート**: node-pty プリビルドバイナリの制限により、Alpine Linux と Linux armhf はサポートされていません。

## 開発

```bash
npm install && npm run compile    # ビルド
npm test                          # 3,800以上のユニットテスト
npm run test:e2e                  # E2E テスト（Playwright）
npm run watch                     # ウォッチモード
```

品質: TypeScript strict モード、TDD ワークフロー、3,800以上のユニットテスト、Playwright による E2E カバレッジ、9プラットフォーム CI/CD ビルド。

## プライバシー

この拡張機能は VS Code のテレメトリ設定を尊重します。匿名の使用状況メトリクス（機能使用、エラー率）のみを収集し、ターミナル内容、ファイルパス、個人データは一切収集しません。

無効化するには: VS Code 設定で `telemetry.telemetryLevel` を `"off"` に設定してください。詳細は [PRIVACY.md](PRIVACY.md) をご覧ください。

## コントリビューション

1. リポジトリをフォーク
2. フィーチャーブランチを作成: `git checkout -b feature/my-feature`
3. TDD プラクティスに従う
4. 品質チェックを実行: `npm run pre-release:check`
5. プルリクエストを送信

オープンなタスクは [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues) をご覧ください。

## リンク

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
- [Open VSX Registry](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
- [GitHub リポジトリ](https://github.com/s-hiraoku/vscode-sidebar-terminal)
- [変更履歴](CHANGELOG.md)
- [ブログ記事（日本語）](https://zenn.dev/hiraoku/articles/0de654620028a0)

## ライセンス

MIT License - [LICENSE](LICENSE) ファイルを参照してください。

---

**AI エージェントを使う VS Code 開発者のために作られました**
