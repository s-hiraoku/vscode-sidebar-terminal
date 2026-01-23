# Secondary Terminal - VS Code 拡張機能

[![Version](https://img.shields.io/visual-studio-marketplace/v/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Open VSX](https://img.shields.io/open-vsx/v/s-hiraoku/vscode-sidebar-terminal)](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
[![License](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![Ask DeepWiki](https://img.shields.io/badge/Ask-DeepWiki-blue)](https://deepwiki.com/s-hiraoku/vscode-sidebar-terminal)

[English](README.md) | **日本語**

**CLI コーディングエージェント時代の必須ツール** - VS Code 標準ターミナル以上の機能を必要とする開発者のための本格的なターミナル拡張機能。サイドバーで最大5つのターミナルを管理し、Claude Code、Codex CLI、Gemini CLI、Copilot CLI との シームレスな AI エージェント統合を実現します。

> **注意**: この拡張機能は活発に開発中です。継続的な改善に伴い、一部バグが発生する可能性があります。

![Secondary Terminal](resources/banner.png)

![Demo](resources/readme-hero.png)

## クイックスタート

### インストール

1. **VS Code Marketplace**: 拡張機能で "Secondary Terminal" を検索
2. **Open VSX** (VS Codium, Gitpod など): "Secondary Terminal" を検索、または [Open VSX](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal) にアクセス
3. **コマンドライン**: `code --install-extension s-hiraoku.vscode-sidebar-terminal`
4. **手動**: [releases](https://github.com/s-hiraoku/vscode-sidebar-terminal/releases) から VSIX をダウンロード

### 初めて使う

1. アクティビティバーのターミナルアイコン（ST）をクリック
2. デフォルトシェルでターミナルが自動的に開きます
3. AI エージェントを実行: `claude`、`codex`、`gemini`、`gh copilot`
4. ターミナルヘッダーに **「AI Agent Connected」** ステータスが表示されることを確認

## 主な機能

### ターミナル管理

| 機能 | 説明 |
|------|------|
| **複数ターミナル** | 最大5つの同時ターミナルインスタンス |
| **セッション永続化** | 設定可能なスクロールバック（最大3,000行）での自動保存・復元 |
| **分割表示** | ドラッグでリサイズ可能な縦・横分割 |
| **タブ管理** | ドラッグ&ドロップ並び替え（分割表示と同期）、閉じるボタン |
| **ターミナルプロファイル** | プラットフォームごとのカスタムシェルプロファイル対応 |
| **クロスプラットフォーム** | Windows、macOS、Linux 対応 |

### AI エージェント統合

以下の自動検出とステータス追跡：

- **Claude Code** - Anthropic の AI コーディングアシスタント
- **Codex CLI** - OpenAI のコマンドラインツール
- **Gemini CLI** - Google の AI アシスタント
- **GitHub Copilot CLI** - GitHub の AI ペアプログラマー
- **CodeRabbit CLI** - AI コードレビューツール

**機能:**

- リアルタイム接続ステータス表示
- `Cmd+Alt+L`（Mac）/ `Ctrl+Alt+L`（Win/Linux）でファイル参照を共有
- `Cmd+Alt+A`（Mac）/ `Ctrl+Alt+A`（Win/Linux）で開いている全ファイルを送信
- VS Code 再起動後もセッション永続化
- ターミナル間でのマルチエージェントワークフロー

### 開発者体験

| 機能 | 説明 |
|------|------|
| **フルクリップボード対応** | 標準 Ctrl/Cmd+C/V ショートカット、画像貼り付け対応 |
| **IME 対応** | 日本語、中国語、韓国語入力メソッド（VS Code 標準ハンドリング） |
| **リンク検出** | ファイルパスクリックで VS Code で開く、URL はブラウザで開く、メールリンク |
| **Alt+Click カーソル移動** | VS Code 標準のカーソル配置 |
| **シェル統合** | コマンド追跡、作業ディレクトリ表示、コマンド履歴 |
| **デバッグパネル** | `Ctrl+Shift+D` でリアルタイム監視 |
| **マウストラッキング** | TUI アプリケーション（vim, htop, zellij）のマウスモード対応 |

## キーボードショートカット

| ショートカット | アクション |
|----------------|------------|
| `Cmd+C` / `Ctrl+C` | 選択テキストをコピー（選択なしの場合は SIGINT 送信） |
| `Cmd+V` / `Ctrl+V` | 貼り付け（テキストと画像） |
| `Shift+Enter` / `Option+Enter` | 改行を挿入（Claude Code 複数行プロンプト用） |
| `Cmd+Alt+L` / `Ctrl+Alt+L` | 現在のファイル参照を AI エージェントに挿入 |
| `Cmd+Alt+A` / `Ctrl+Alt+A` | 開いている全ファイルの参照を AI エージェントに挿入 |
| `Cmd+K Cmd+C` / `Ctrl+K Ctrl+C` | GitHub Copilot Chat を起動 |
| ``Ctrl+` `` | Secondary Terminal ビューにフォーカス |
| ``Ctrl+Shift+` `` | 新しいターミナルを作成 |
| `Cmd+\`（Mac）/ `Ctrl+Shift+5` | ターミナルを縦分割 |
| `Cmd+K` / `Ctrl+K` | ターミナルをクリア |
| `Alt+Cmd+Left/Right`（Mac）/ `Alt+Left/Right` | 前/次のターミナルにフォーカス |
| `Cmd+Alt+1..5`（Mac）/ `Alt+1..5` | インデックスでターミナルにフォーカス |
| `Ctrl+Shift+D` | デバッグパネルを切り替え |
| `Cmd+A` / `Ctrl+A` | ターミナルの全内容を選択 |

その他の UX 機能：

- `Alt+Click` で `secondaryTerminal.altClickMovesCursor` 有効時にカーソル移動（VS Code スタイル）

> **Claude Code のヒント**:
> - macOS では `Cmd+V` でテキストと画像（スクリーンショット）の両方を Claude Code に貼り付け可能
> - 複数行プロンプトには `Shift+Enter` または `Option+Enter` で改行を挿入

## コマンドパレット

`Ctrl+Shift+P`（Win/Linux）または `Cmd+Shift+P`（Mac）でアクセス：

| コマンド | 説明 |
|----------|------|
| `Secondary Terminal: Focus Terminal` | ターミナルパネルにフォーカス |
| `Secondary Terminal: Create New Terminal` | 新しいターミナルを作成 |
| `Secondary Terminal: Kill Terminal` | 現在のターミナルを閉じる |
| `Secondary Terminal: Clear Terminal` | ターミナル内容をクリア |
| `Secondary Terminal: Split Terminal Vertically` | 縦分割 |
| `Secondary Terminal: Split Terminal Horizontally` | 横分割 |
| `Secondary Terminal: Select Terminal Profile` | シェルプロファイルを選択 |
| `Secondary Terminal: Manage Terminal Profiles` | シェルプロファイルを編集 |
| `Secondary Terminal: Focus Terminal 1-5` | 特定のターミナルにフォーカス |
| `Secondary Terminal: Focus Next/Previous Terminal` | ターミナル間を移動 |
| `Secondary Terminal: Save/Restore/Clear Session` | セッション管理 |
| `Secondary Terminal: Run Recent Command` | 履歴からコマンドを実行 |
| `Secondary Terminal: Show Version` | バージョン情報を表示 |
| `Secondary Terminal: Terminal Settings` | 設定を開く |
| `Secondary Terminal: Clear Corrupted Terminal History` | セッションデータの問題を修正 |

## 設定

### 基本設定

```json
{
  "secondaryTerminal.shell": "auto",
  "secondaryTerminal.shellArgs": [],
  "secondaryTerminal.maxTerminals": 5,
  "secondaryTerminal.fontSize": 14,
  "secondaryTerminal.fontFamily": "MesloLGS NF, Monaco, monospace",
  "secondaryTerminal.cursorBlink": true,
  "secondaryTerminal.cursorStyle": "block",
  "secondaryTerminal.scrollback": 1000,
  "secondaryTerminal.defaultDirectory": ""
}
```

### AI エージェント設定

```json
{
  "secondaryTerminal.enableCliAgentIntegration": true,
  "secondaryTerminal.enableGitHubCopilotIntegration": true,
  "secondaryTerminal.focusAfterAtMention": true,
  "secondaryTerminal.enableAtMentionSync": false
}
```

### セッション永続化設定

```json
{
  "secondaryTerminal.enablePersistentSessions": true,
  "secondaryTerminal.persistentSessionScrollback": 1000,
  "secondaryTerminal.persistentSessionReviveProcess": "onWindowClose",
  "secondaryTerminal.persistentSessionStorageLimit": 20,
  "secondaryTerminal.persistentSessionRetentionDays": 7
}
```

### 分割表示設定

```json
{
  "secondaryTerminal.maxSplitTerminals": 4,
  "secondaryTerminal.minTerminalHeight": 100,
  "secondaryTerminal.enableSplitResize": true,
  "secondaryTerminal.dynamicSplitDirection": true
}
```

### シェル統合設定

```json
{
  "secondaryTerminal.shellIntegration.enabled": true,
  "secondaryTerminal.shellIntegration.showCommandStatus": true,
  "secondaryTerminal.shellIntegration.showWorkingDirectory": true,
  "secondaryTerminal.shellIntegration.commandHistory": true
}
```

### リンク検出設定

```json
{
  "secondaryTerminal.links.enabled": true,
  "secondaryTerminal.links.detectFileLinks": true,
  "secondaryTerminal.links.detectWebLinks": true,
  "secondaryTerminal.links.detectEmailLinks": true
}
```

### 詳細設定

| 設定 | 型 | デフォルト | 説明 |
|------|-----|----------|------|
| `secondaryTerminal.confirmBeforeKill` | boolean | `true` | ターミナル終了前に確認を表示 |
| `secondaryTerminal.protectLastTerminal` | boolean | `true` | 最後のターミナルの終了を防止 |
| `secondaryTerminal.altClickMovesCursor` | boolean | `true` | Alt+Click カーソル移動を有効化 |
| `secondaryTerminal.sendKeybindingsToShell` | boolean | `true` | キーバインドをシェルに送信 |
| `secondaryTerminal.allowChords` | boolean | `true` | 複数キーのコードシーケンスを許可 |
| `secondaryTerminal.minimumContrastRatio` | number | `4.5` | テキストの最小コントラスト比 |
| `secondaryTerminal.activeBorderMode` | string | `"always"` | アクティブターミナルの枠線表示タイミング |
| `secondaryTerminal.logging.level` | string | `"info"` | ログレベル（debug/info/warn/error） |

## アーキテクチャ

![Architecture](resources/architeccture-graphic-recording.png)

![Architecture Detail](resources/readme-architecture.png)

**Extension Host (Node.js)**

- TerminalManager: PTY プロセス、ライフサイクル、AI 検出
- Session Management: 再起動後の状態永続化

**WebView (ブラウザ)**

- xterm.js: WebGL レンダリングによるターミナルエミュレーション
- Manager System: 入力、UI、パフォーマンス、分割、設定

## パフォーマンス

| 指標 | 値 |
|------|-----|
| **ビルドサイズ** | 拡張機能 ~790 KiB + WebView ~1.5 MiB |
| **レンダリング** | WebGL（DOM 自動フォールバック） |
| **出力バッファリング** | 適応型 2-16ms 間隔（AI 出力時最大 250fps） |
| **メモリ** | LIFO 廃棄パターンによる効率的クリーンアップ |
| **スクロールバック復元** | 1,000行で1秒未満（ANSIカラー保持） |
| **ターミナル廃棄** | 100ms 未満のクリーンアップ時間 |

## トラブルシューティング

### ターミナルが起動しない

- `secondaryTerminal.shell` 設定が有効なシェルを指しているか確認
- シェルが PATH からアクセス可能か確認
- 明示的なシェルパスの設定を試す

### AI エージェントが検出されない

- `secondaryTerminal.enableCliAgentIntegration` が `true` か確認
- デバッグパネル（`Ctrl+Shift+D`）で検出ログを確認
- エージェントが正しくインストールされ実行中か確認

### パフォーマンスの問題

- 必要に応じて `secondaryTerminal.maxTerminals` を減らす
- `secondaryTerminal.scrollback` の値を下げる
- デバッグパネルでシステムリソースを確認

### セッションが復元されない

- `secondaryTerminal.enablePersistentSessions` が `true` か確認
- `secondaryTerminal.persistentSessionStorageLimit` でストレージ制限を確認
- データが破損している場合は「Clear Corrupted Terminal History」コマンドを使用

### TUI アプリケーションの表示問題

- zellij などのアプリケーションではマウストラッキングが自動的に有効化
- 分割モードで表示問題が発生した場合、フルスクリーンモードに切り替えを試す

## 開発

```bash
# ビルド
npm install
npm run compile

# テスト
npm test              # ユニットテスト
npm run test:e2e      # E2E テスト（Playwright）

# 開発
npm run watch         # ウォッチモード
npm run lint          # ESLint チェック
```

**品質基準:**

- TypeScript strict モード
- 275以上のユニットテスト
- Playwright による E2E テストカバレッジ
- TDD 開発ワークフロー

## 既知の制限事項

- **実行中プロセス**: VS Code 再起動時に長時間実行プロセスは終了します（スクロールバックは保持）。プロセス永続化には `tmux`/`screen` を使用してください。
- **プラットフォームサポート**: node-pty プリビルドバイナリの制限により、Alpine Linux と Linux armhf はサポートされていません
- **開発中**: 一部機能には粗削りな部分があるかもしれません

## プライバシー

この拡張機能は VS Code のテレメトリ設定を尊重します。匿名の使用状況メトリクス（機能使用、エラー率）のみを収集し、ターミナル内容、ファイルパス、個人データは一切収集しません。

無効化するには: VS Code 設定で `telemetry.telemetryLevel` を `"off"` に設定してください。

詳細は [PRIVACY.md](PRIVACY.md) をご覧ください。

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
