# Secondary Terminal - VS Code 拡張機能

[![Version](https://img.shields.io/visual-studio-marketplace/v/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Open VSX](https://img.shields.io/open-vsx/v/s-hiraoku/vscode-sidebar-terminal)](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
[![License](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![Ask DeepWiki](https://img.shields.io/badge/Ask-DeepWiki-blue)](https://deepwiki.com/s-hiraoku/vscode-sidebar-terminal)

[English](README.md) | **日本語** | [中文](README.zh-CN.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

サイドバー、ターミナル、AIエージェント -- すべてを一箇所に。VS Codeのサイドバーに常駐するフル機能のターミナルです。Claude Code、Codex CLI、Gemini CLI、GitHub Copilot CLIのAIエージェント検出機能を内蔵しています。

<video src="resources/demo/demo.mov" controls muted loop playsinline poster="resources/readme-hero.png"></video>

## なぜ Secondary Terminal？

- **サイドバーネイティブのターミナル** -- 編集中もターミナルを表示したまま。ボトムパネルの切り替え操作は不要です。
- **AIエージェント対応** -- Claude Code、Copilot、Gemini (v0.28.2+)、Codexを自動検出。リアルタイムの接続状態を表示し、AIストリーミング出力のレンダリングを最適化します（最大250fps）。
- **フル機能** -- 分割ビュー、セッション永続化、シェル統合、ターミナル内検索、コマンドデコレーション、90のカスタマイズ可能な設定。おもちゃではなく、本番環境で使えるターミナルです。

## クイックスタート

1. **インストール**: VS Codeの拡張機能ビューで "Secondary Terminal" を検索
   - [Open VSX](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)（VSCodium、Gitpod）や [CLI](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal): `code --install-extension s-hiraoku.vscode-sidebar-terminal` からもインストール可能
2. **開く**: アクティビティバーのターミナルアイコン（ST）をクリック
3. **使う**: デフォルトシェルでターミナルが起動します。`claude`、`codex`、`gemini`、`gh copilot` を実行すると、ヘッダーにAIエージェントのステータスが表示されます。

## 機能ハイライト

### AIエージェントワークフロー向け

|                         |                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| **自動検出**            | Claude Code、Codex CLI、Gemini CLI (v0.28.2+)、GitHub Copilot CLIのリアルタイムステータスインジケーター             |
| **ファイル参照**        | `Cmd+Alt+L` / `Ctrl+Alt+L` で現在のファイルパスを挿入、`Cmd+Alt+A` / `Ctrl+Alt+A` で全オープンファイルを挿入 |
| **画像貼り付け**        | macOSで `Cmd+V` するとスクリーンショットをClaude Codeに直接貼り付け                                     |
| **最適化レンダリング**  | AIストリーミング出力向けの250fps適応バッファリング                                                       |
| **セッション永続化**    | VS Codeの再起動後もターミナルの状態を維持 -- 中断したところから再開                                     |
| **マルチエージェント**  | 異なるターミナルで異なるエージェントを実行、`Cmd+Alt+1..5` / `Alt+1..5` で切り替え                       |

### ターミナルのパワー機能

|                            |                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------- |
| **複数ターミナル**         | 最大5つの同時ターミナルとタブ管理（ドラッグ&ドロップによる並び替え）              |
| **分割ビュー**             | 垂直/水平分割とドラッグリサイズ                                                  |
| **セッション永続化**       | ANSIカラー保持による自動保存/復元（最大3,000行のスクロールバック）               |
| **シェル統合**             | コマンドステータスインジケーター、作業ディレクトリ表示、コマンド履歴             |
| **ターミナル内検索**       | `Ctrl+F` / `Cmd+F` -- 正規表現対応のターミナル出力検索                           |
| **コマンドデコレーション** | コマンド境界における成功/エラー/実行中の視覚的インジケーター                     |
| **ナビゲーションマーク**   | `Cmd+Up/Down` / `Ctrl+Up/Down` でコマンド間ジャンプ                              |
| **スクロールバック圧縮**   | 大きな履歴に対応した圧縮ストレージとプログレッシブ読み込み                       |
| **ターミナルプロファイル** | プラットフォーム別のシェルプロファイル（bash、zsh、fish、PowerShellなど）         |

### 開発者エクスペリエンス

|                      |                                                                        |
| -------------------- | ---------------------------------------------------------------------- |
| **フルIMEサポート**  | VS Code標準の処理による日本語、中国語、韓国語入力                      |
| **リンク検出**       | ファイルパスはVS Codeで開き、URLはブラウザで開き、メールリンクも検出   |
| **Alt+クリック**     | VS Code標準のカーソル位置指定                                          |
| **パネルナビゲーション** | オプトイン式のZellij風高速ターミナル切り替えモード                   |
| **マウストラッキング** | TUIアプリ対応（vim、htop、zellij）、自動マウスモード                  |
| **フルクリップボード** | Ctrl/Cmd+C/V、画像貼り付け対応                                       |
| **クロスプラットフォーム** | Windows、macOS、Linux -- 9つのプラットフォーム別ビルド             |
| **アクセシビリティ** | スクリーンリーダー対応                                                 |
| **デバッグパネル**   | `Ctrl+Shift+D` によるリアルタイムモニタリング                          |

## キーボードショートカット

| ショートカット                                 | アクション                                           |
| --------------------------------------------- | --------------------------------------------------- |
| `Cmd+C` / `Ctrl+C`                            | 選択テキストをコピー（選択なしの場合はSIGINT送信）  |
| `Cmd+V` / `Ctrl+V`                            | 貼り付け（テキストと画像）                          |
| `Shift+Enter` / `Option+Enter`                | 改行挿入（Claude Codeの複数行プロンプト用）         |
| `Cmd+Alt+L` / `Ctrl+Alt+L`                    | AIエージェント用に現在のファイル参照を挿入          |
| `Cmd+Alt+A` / `Ctrl+Alt+A`                    | AIエージェント用に全オープンファイル参照を挿入      |
| `Cmd+K Cmd+C` / `Ctrl+K Ctrl+C`               | GitHub Copilot Chatを起動                           |
| ``Ctrl+` ``                                   | Secondary Terminalビューにフォーカス                |
| ``Ctrl+Shift+` ``                             | 新しいターミナルを作成                              |
| `Cmd+\` (Mac) / `Ctrl+Shift+5`                | ターミナルを垂直分割                                |
| `Cmd+K` / `Ctrl+K`                            | ターミナルをクリア                                  |
| `Cmd+Up/Down` (Mac) / `Ctrl+Up/Down`          | 前/次のコマンドにスクロール                         |
| `Alt+Cmd+Left/Right` (Mac) / `Alt+Left/Right` | 前/次のターミナルにフォーカス                       |
| `Cmd+Alt+1..5` (Mac) / `Alt+1..5`             | インデックスでターミナルにフォーカス                |
| `Ctrl+P`                                      | パネルナビゲーションモードの切り替え (要設定有効化) |
| `Cmd+R` / `Ctrl+R`                            | 最近のコマンドを実行                                |
| `Cmd+A` / `Ctrl+A`                            | ターミナルの全コンテンツを選択                      |
| `Ctrl+Shift+D`                                | デバッグパネルの切り替え                            |

### パネルナビゲーションモード (Zellij風)

> **注意**: パネルナビゲーションはターミナルマルチプレクサ（zellij、tmux、screen）との競合を避けるため、**デフォルトで無効**です。設定で有効化してください: `"secondaryTerminal.panelNavigation.enabled": true`

`Ctrl+P` を使用して、専用のナビゲーションモードに入ります（macOSでは `Cmd+P` はVS Code Quick Open用に予約されています）。有効な間：
- `h`, `j`, `k`, `l` または `矢印キー` を使用して、分割されたターミナル間を切り替えることができます。
- 再度 `Ctrl+P` を押すか、`Escape` キーで終了します。
- ナビゲーションモード中は、右上に視覚的なインジケーターが表示されます。

> **Claude Code のコツ**:
>
> - macOSの `Cmd+V` でテキストと画像（スクリーンショット）の両方をClaude Codeに貼り付け可能
> - 複数行プロンプトには `Shift+Enter` または `Option+Enter` で改行を挿入

## 設定

この拡張機能には90の設定があります。特に効果的なカスタマイズ項目：

```json
{
  // 外観
  "secondaryTerminal.fontSize": 12,
  "secondaryTerminal.fontFamily": "monospace",
  "secondaryTerminal.cursorStyle": "block",
  "secondaryTerminal.scrollback": 2000,

  // AIエージェント連携
  "secondaryTerminal.enableCliAgentIntegration": true,

  // セッション永続化
  "secondaryTerminal.enablePersistentSessions": true,
  "secondaryTerminal.persistentSessionScrollback": 1000,

  // 分割ビュー
  "secondaryTerminal.maxSplitTerminals": 5,
  "secondaryTerminal.dynamicSplitDirection": true,

  // パネルナビゲーション (Zellij風 Ctrl+P)
  "secondaryTerminal.panelNavigation.enabled": false,

  // シェル統合
  "secondaryTerminal.shellIntegration.enabled": true,
  "secondaryTerminal.shellIntegration.showCommandStatus": true
}
```

VS Codeの設定で `secondaryTerminal` を検索すると全設定一覧が表示されます。全デフォルト値については [package.json](package.json) を参照してください。

## パフォーマンス

| 指標                   | 値                                                     |
| ---------------------- | ------------------------------------------------------ |
| **レンダリング**       | WebGL（DOM自動フォールバック付き）                      |
| **出力バッファリング** | 適応型2-16msインターバル（AI出力時最大250fps）          |
| **スクロールバック復元** | 1,000行でANSIカラー保持しつつ1秒未満                 |
| **ターミナル破棄**     | 100ms未満のクリーンアップ                              |
| **ビルドサイズ**       | 拡張機能 約790 KiB + WebView 約1.5 MiB                 |

## トラブルシューティング

### ターミナルが起動しない

- `secondaryTerminal.shell` がPATH上の有効なシェルを指しているか確認
- 明示的なシェルパスの設定を試す

### AIエージェントが検出されない

- `secondaryTerminal.enableCliAgentIntegration` が `true` になっているか確認
- デバッグパネル（`Ctrl+Shift+D`）で検出ログを確認

### パフォーマンスの問題

- `secondaryTerminal.scrollback` の値を減らす
- デバッグパネルでシステムリソースを確認

### セッションが復元されない

- `secondaryTerminal.enablePersistentSessions` が `true` になっているか確認
- データが破損している場合は「Clear Corrupted Terminal History」コマンドを使用

### TUI表示の問題

- zellijなどのアプリではマウストラッキングが自動的に有効になります
- 分割モードで表示の問題が発生した場合はフルスクリーンモードに切り替えてみてください

## 既知の制限事項

- **実行中のプロセス**: VS Code再起動時に長時間実行中のプロセスは終了します（スクロールバックは保持）。プロセスの永続化には `tmux`/`screen` を使用してください。
- **プラットフォームサポート**: Alpine LinuxおよびLinux armhfはnode-ptyプリビルドバイナリの制限によりサポートされていません。

## 開発

```bash
npm install && npm run compile    # ビルド
npm test                          # 4,000以上のユニットテスト
npm run test:e2e                  # E2Eテスト（Playwright）
npm run watch                     # ウォッチモード
```

品質: TypeScript strictモード、TDDワークフロー、4,000以上のユニットテスト、PlaywrightによるE2Eカバレッジ、9プラットフォームのCI/CDビルド。

## プライバシー

この拡張機能はVS Codeのテレメトリ設定を尊重します。匿名の使用メトリクス（機能使用状況、エラー率）のみを収集し、ターミナルの内容、ファイルパス、個人情報は一切収集しません。

無効にするには: VS Codeの設定で `telemetry.telemetryLevel` を `"off"` に設定してください。詳細は [PRIVACY.md](PRIVACY.md) を参照してください。

## コントリビューション

1. リポジトリをフォーク
2. フィーチャーブランチを作成: `git checkout -b feature/my-feature`
3. TDDプラクティスに従う
4. 品質チェックを実行: `npm run pre-release:check`
5. プルリクエストを送信

オープンタスクは [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues) を参照してください。

## リンク

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
- [Open VSX Registry](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
- [GitHub リポジトリ](https://github.com/s-hiraoku/vscode-sidebar-terminal)
- [変更履歴](CHANGELOG.md)
- [ブログ記事（日本語）](https://zenn.dev/hiraoku/articles/0de654620028a0)

## ライセンス

MIT License - [LICENSE](LICENSE) ファイルを参照してください。

---

**VS Code で AI エージェントを使う開発者のために作られました**
