# VS Code サイドバーターミナル

[![GitHub license](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
[![GitHub stars](https://img.shields.io/github/stars/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/stargazers)
[![CI](https://github.com/s-hiraoku/vscode-sidebar-terminal/workflows/CI/badge.svg)](https://github.com/s-hiraoku/vscode-sidebar-terminal/actions)

開発ワークフローを効率化するために、サイドバーにターミナルを表示する強力なVS Code拡張機能です。他のビューと並んでプライマリサイドバー（左側）にシームレスに統合されます。

## 📸 スクリーンショット

### メインインターフェース

![メインインターフェース](./docs/images/screenshots/main-interface.png)
_複数のタブとコントロールを備えたVS Codeサイドバーに統合されたターミナル_

### 複数ターミナル

![複数ターミナル](./docs/images/screenshots/multiple-terminals.png)
_簡単なタブ切り替えで複数のターミナルセッションを管理_

### 分割ターミナルビュー

![分割ターミナル](./docs/images/screenshots/split-terminal.png)
_並列コマンド実行のための分割ターミナル機能_

## 🎬 デモ

### 基本的な使い方

![基本的な使い方](./docs/images/gifs/basic-usage.gif)
_ターミナルを開いてコマンドを実行する簡単なデモンストレーション_

### ターミナル管理

![ターミナル管理](./docs/images/gifs/terminal-management.gif)
_複数のターミナルを作成、切り替え、管理_

### 設定の構成

![設定デモ](./docs/images/gifs/settings-demo.gif)
_フォントサイズ、テーマ、その他の設定をカスタマイズ_

## 🚀 機能

- **サイドバー統合**: プライマリサイドバー（左側）にターミナルを統合
- **複数ターミナル管理**: 最大5つのターミナルを同時に実行
- **セッションの永続化**: VS Code再起動後にターミナルセッションを自動的に復元
- **完全なターミナル機能**: node-ptyによる完全なシェル実行環境
- **特殊キーのサポート**: バックスペース、Ctrl+C、Ctrl+L、その他の特殊キーの組み合わせ
- **直感的なコントロール**: クリア、新規、分割ボタンで簡単なターミナル管理
- **IMEサポート**: 日本語、中国語、韓国語を含む多言語入力のサポート
- **CLIエージェント統合**: Claude CodeおよびGitHub Copilotのファイル参照ショートカット
- **クロスプラットフォーム**: ネイティブバイナリによるWindows、macOS、Linuxの完全サポート
- **Alt+クリックによるカーソル位置指定**: VS Code標準のAlt+クリックでカーソルを移動（CLIエージェント検出付き）

## 📦 インストール

### VS Code Marketplaceから

1. VS Codeを開く
2. 拡張機能パネルを開く（`Ctrl+Shift+X`または`Cmd+Shift+X`）
3. "Sidebar Terminal"を検索
4. インストールをクリック

### 手動インストール

1. [リリース](https://github.com/s-hiraoku/vscode-sidebar-terminal/releases)から最新の`.vsix`ファイルをダウンロード
2. VS Codeを開き、`Ctrl+Shift+P`（Macでは`Cmd+Shift+P`）を押す
3. "Extensions: Install from VSIX..."を選択
4. ダウンロードした`.vsix`ファイルを選択

## 🎯 使い方

### 基本操作

1. **ターミナルを開く**: エクスプローラーパネルの「ターミナル」ビューをクリック
2. **新しいターミナルを作成**: ターミナルヘッダーの「新規」ボタンをクリック
3. **ターミナルを分割**: 「分割」ボタンをクリックして分割ビューを作成
4. **ターミナルをクリア**: 「クリア」ボタンをクリックしてアクティブなターミナルをクリア
5. **コマンドを実行**: 通常のターミナルと同じようにコマンドを入力

### サイドバーの配置

#### プライマリサイドバー（左側）

- ターミナルは左側のエクスプローラーパネルに表示されます
- 他のサイドバービューと統合され、タブで切り替え可能
- ビューを切り替えてもコンテキストを維持

### コマンドパレット

- `Sidebar Terminal: Create New Terminal` - 新しいターミナルインスタンスを作成
- `Sidebar Terminal: Split Terminal` - 現在のターミナルを分割
- `Sidebar Terminal: Clear Terminal` - アクティブなターミナルをクリア
- `Sidebar Terminal: Kill Terminal` - アクティブなターミナルを終了

### Alt+クリックによるカーソル位置指定

- **標準のVS Codeの動作**: Alt+クリックでマウスの位置にカーソルを移動
- **CLIエージェントの検出**: CLIエージェントの実行中は最適なパフォーマンスのために自動的に無効化
- **視覚的なフィードバック**: 青いハイライトがフェードアニメーション付きでカーソル位置を表示
- **要件**: `terminal.integrated.altClickMovesCursor`と`editor.multiCursorModifier: "alt"`の両方が有効である必要があります

### 🤖 CLIエージェント統合

- **ファイル参照ショートカット**: `Cmd+Option+L`（Mac）または`Alt+Ctrl+L`（Linux/Windows）を使用して`@filename`参照を挿入
- **GitHub Copilot統合**: `#file:filename`形式には`Cmd+K Cmd+C`（Mac）または`Ctrl+K Ctrl+C`（Windows/Linux）を使用
- **独立した操作**: CLIエージェント拡張機能と競合することなく動作
- **設定可能**: 両方の統合は設定で個別に有効/無効にできます

### 🔄 セッションの永続化

- **自動復元**: VS Code再起動後にターミナルの内容と状態を復元
- **スクロールバック履歴**: ターミナルごとに最大1000行のターミナル履歴を保持
- **複数ターミナルのサポート**: すべてのターミナル（最大5つ）を個々の状態で復元
- **設定可能**: セッションの永続化はカスタマイズまたは無効にできます

## ⌨️ キーボードショートカット

- **CLIエージェントファイル参照**: `CMD+OPT+L`（Mac）/ `Ctrl+Alt+L`（Windows/Linux） - `@filename`参照を挿入
- **GitHub Copilot統合**: `CMD+K CMD+C`（Mac）/ `Ctrl+K Ctrl+C`（Windows/Linux） - ファイル参照付きでCopilot Chatをアクティブ化
- **Alt+クリック**: カーソル位置指定（VS Code設定で有効な場合）

## ⚙️ 設定

VS Codeの設定（`settings.json`）で拡張機能をカスタマイズします。

| 設定 | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `sidebarTerminal.shell` | string | `""` | シェル実行可能ファイルへのパス。システムデフォルトを使用する場合は空のままにします。 |
| `sidebarTerminal.shellArgs` | array | `[]` | シェルに渡す引数。 |
| `sidebarTerminal.maxTerminals` | number | 5 | 許可されるターミナルの最大数。 |
| `sidebarTerminal.cursorBlink` | boolean | `true` | ターミナルでカーソルの点滅を有効にします。 |
| `sidebarTerminal.theme` | string | `auto` | ターミナルのテーマ。AutoはVS Codeのテーマに従います。 |
| `sidebarTerminal.defaultDirectory` | string | `""` | 新しいターミナルのデフォルトディレクトリ。ワークスペースルートを使用する場合は空のままにします。 |
| `sidebarTerminal.confirmBeforeKill` | boolean | `false` | ターミナルを閉じる前に確認ダイアログを表示します |
| `sidebarTerminal.protectLastTerminal` | boolean | `true` | 最後のターミナルを閉じるのを防ぎます |
| `sidebarTerminal.minTerminalCount` | number | 1 | 開いたままにするターミナルの最小数 |
| `sidebarTerminal.maxSplitTerminals` | number | 5 | 分割ビューに表示するターミナルの最大数 |
| `sidebarTerminal.minTerminalHeight` | number | 100 | 分割ビューの各ターミナルの最小の高さ（ピクセル） |
| `sidebarTerminal.enableSplitResize` | boolean | `true` | スプリッターをドラッグして分割ターミナルのサイズを変更できるようにします |
| `sidebarTerminal.statusDisplayDuration` | number | 3000 | ステータスメッセージを表示する時間（ミリ秒） |
| `sidebarTerminal.autoHideStatus` | boolean | `true` | 指定した時間が経過するとステータスメッセージを自動的に非表示にします |
| `sidebarTerminal.showStatusOnActivity` | boolean | `true` | ユーザーがアクションを実行したときに最後のステータスメッセージを表示します |
| `sidebarTerminal.showWebViewHeader` | boolean | `true` | Webビューヘッダーにタイトルとコマンドアイコンを表示します |
| `sidebarTerminal.webViewTitle` | string | `Terminal` | Webビューヘッダーに表示するタイトル |
| `sidebarTerminal.showSampleIcons` | boolean | `true` | Webビューヘッダーにサンプルコマンドアイコンを表示します（表示のみ） |
| `sidebarTerminal.sampleIconOpacity` | number | 0.4 | サンプルアイコンの不透明度（0.1〜1.0） |
| `sidebarTerminal.headerFontSize` | number | 14 | Webビューヘッダータイトルのフォントサイズ |
| `sidebarTerminal.headerIconSize` | number | 20 | Webビューヘッダーのターミナルアイコンのサイズ |
| `sidebarTerminal.sampleIconSize` | number | 16 | Webビューヘッダーのサンプルアイコンのサイズ |
| `sidebarTerminal.altClickMovesCursor` | boolean | `true` | Alt/Option + クリックでプロンプトカーソルを再配置するかどうかを制御します。 |
| `sidebarTerminal.enableCliAgentIntegration` | boolean | `true` | Claude CodeなどのCLIエージェントのファイル参照ショートカットを有効にします。 |
| `sidebarTerminal.enableGitHubCopilotIntegration` | boolean | `true` | GitHub Copilot Chat統合ショートカットを有効にします。 |
| `sidebarTerminal.enablePersistentSessions` | boolean | `true` | VS Codeの再起動をまたいでターミナルセッションの永続化を有効にします。 |
| `sidebarTerminal.scrollbackLines` | number | 1000 | ターミナル履歴から復元する最大行数。 |
| `sidebarTerminal.scrollbackCompression` | boolean | `true` | ストレージサイズを削減するためにスクロールバックデータを圧縮します。 |

## 🛠️ 開発

### 前提条件

- Node.js 18+
- VS Code 1.74.0+
- npmまたはyarn

### セットアップ

'''bash
# リポジトリをクローン
git clone https://github.com/s-hiraoku/vscode-sidebar-terminal.git
cd vscode-sidebar-terminal

# 依存関係をインストール
npm install

# 開発ビルド
npm run compile

# 開発用のウォッチモード
npm run watch
'''

### テスト

'''bash
# カバレッジ付きで単体テストを実行
npm run test:unit

# すべてのテストを実行
npm test

# リンターを実行
npm run lint

# コードをフォーマット
npm run format

# 本番ビルド
npm run package
'''

### デバッグ

拡張機能の起動方法、ログの確認、一般的な問題のトラブルシューティングなど、詳細なデバッグ手順については、[デバッグガイド（日本語）](./DEBUG.md)を参照してください。

### リリースプロセス

自動および手動の公開手順を含む、拡張機能の新しいバージョンをリリースする方法の詳細については、[リリースプロセスガイド（日本語）](./RELEASE_PROCESS.md)を参照してください。

## 🧪 テスト戦略

この拡張機能は、最新のツールを使用して包括的なテストを行っています。

- **単体テスト**: ユーティリティとコア機能をカバーする47のテストケース
- **統合テスト**: モックAPIを使用したVS Code拡張機能のテスト
- **コードカバレッジ**: 詳細なレポート付きのnyc（Istanbul）
- **CI/CDパイプライン**: Windows、macOS、Linuxでのマルチプラットフォームテスト
- **最新のツール**: Mocha、Chai、Sinon、JSDOM、@testing-library

テストカバレッジには以下が含まれます。

- DOM操作ユーティリティ（22テスト）
- 通知システム（8テスト）
- Alt+クリック機能（17テスト）
- VS Code API統合
- クロスプラットフォーム互換性

## 🧪 テスト駆動開発（TDD）

このプロジェクトは、持続可能で高品質な開発のために**t-wadaのTDD手法**に従っています。

### TDDインフラストラクチャ

- **📊 メトリクス収集**: リアルタイムのTDDコンプライアンス追跡
- **🔄 自動化されたワークフロー**: Red-Green-Refactorサイクルの自動化
- **📈 品質ゲート**: CI/CD統合品質チェック
- **🎯 インタラクティブセッション**: ガイド付きTDD開発体験

### 利用可能なTDDコマンド

'''bash
# インタラクティブなTDDワークフロー
npm run tdd:interactive

# フェーズ固有のコマンド
npm run tdd:red      # 失敗するテストを検証
npm run tdd:green    # 合格するテストを検証
npm run tdd:refactor # リファクタリング後の品質チェック

# 品質評価
npm run tdd:check-quality    # 包括的な品質分析
npm run tdd:quality-gate     # CI/CD品質ゲートチェック
'''

### TDDメトリクスダッシュボード

- **TDDコンプライアンス率**: 80％以上の目標（Red-Green-Refactorの遵守）
- **テストカバレッジ**: 90％以上の目標
- **コード品質スコア**: 8.0+/10.0の目標
- **リアルタイム追跡**と過去の傾向分析

### ドキュメント

- 📖 [TDD運用ガイド](./docs/TDD-OPERATIONS-GUIDE.md) - 完全なワークフローと日常的な使用法
- 🎯 [TDDベストプラクティス](./docs/TDD-BEST-PRACTICES.md) - 実証済みのパターンとテクニック
- 🚀 [CI/CD統合](./docs/CI-CD-INTEGRATION.md) - 品質ゲートと自動化

### VS Code統合

VS Codeタスクを介してTDDワークフローに直接アクセスします。

- `Ctrl+Shift+P` → "Tasks: Run Task" → "TDD: Interactive Workflow"
- ビルドプロセスに統合された品質チェック
- 開発中のリアルタイムTDDメトリクス

_このTDDインフラストラクチャは、技術的負債の蓄積を防ぎながら、保守可能でテスト可能なコードを保証します。_

## 🏗️ アーキテクチャ

'''
src/
├── constants/          # アプリケーション定数
├── providers/          # WebViewプロバイダー
├── terminals/          # ターミナル管理
├── types/             # TypeScript型定義
├── utils/             # ユーティリティ関数
├── webview/           # フロントエンドコンポーネント
│   ├── components/    # UIコンポーネント
│   ├── managers/      # UIマネージャー
│   └── utils/         # WebViewユーティリティ
└── extension.ts       # 拡張機能のエントリポイント
'''

### 主要コンポーネント

- **TerminalManager**: 複数ターミナルの状態管理
- **SecandarySidebar**: VS Code WebView統合
- **WebView (xterm.js)**: ターミナルUIレンダリング
- **PTY Process**: システムレベルのシェル統合
- **SplitManager**: ターミナル分割機能
- **HeaderManager**: UIヘッダー管理

## 🤝 貢献

貢献を歓迎します！次の手順に従ってください。

1. このリポジトリをフォークする
2. 機能ブランチを作成する（`git checkout -b feature/amazing-feature`）
3. 変更をコミットする（`git commit -m 'Add some amazing feature'`）
4. ブランチにプッシュする（`git push origin feature/amazing-feature`）
5. プルリクエストを開く

### 貢献ガイドライン

- TypeScriptの型安全性を維持する
- ESLintおよびPrettierのルールに従う
- 新しい機能をカバーするテストを追加する
- [Conventional Commits](https://conventionalcommits.org/)形式を使用する
- すべてのプラットフォームでCIテストが合格することを確認する

## 🐛 トラブルシューティング

### 一般的な問題

**Q: ターミナルが表示されない**
A: VS Codeを再起動するか、拡張機能を無効/有効にしてください。

**Q: コマンドが実行されない**
A: これはPTY通信の問題です。VS Codeを再起動し、拡張機能を再度有効にしてください。

**Q: バックスペースキーが機能しない**
A: 特殊キーの処理は修正されました。最新バージョンを使用してください。

**Q: ボタン（クリア/新規/分割）が機能しない**
A: ボタン機能は実装済みです。WebView通信を確認してください。

**Q: シェルが起動しない**
A: `sidebarTerminal.shell`設定に正しいシェルパスがあることを確認してください。

**Q: 日本語/Unicode文字が文字化けする**
A: ターミナルの文字エンコーディングをUTF-8に変更してください。IMEサポートが追加されました。

**Q: パフォーマンスが遅い**
A: `maxTerminals`設定を使用して、同時実行ターミナルの数を減らしてください。

**Q: Alt+クリックが機能しない**
A: VS Code設定で`terminal.integrated.altClickMovesCursor`と`editor.multiCursorModifier: "alt"`の両方が有効になっていることを確認してください。

### デバッグ情報

問題を報告する際は、以下を含めてください。

- VS Codeのバージョン
- 拡張機能のバージョン
- OSとバージョン
- 使用しているシェル
- エラーメッセージ
- 再現手順

## 📄 ライセンス

このプロジェクトは[MITライセンス](LICENSE)の下でライセンスされています。

## 📝 変更履歴

詳細な変更については[CHANGELOG.md](CHANGELOG.md)を参照してください。

### v0.1.31（最新）

- **セッションの永続化**: スクロールバック履歴付きの完全なターミナルセッション復元機能
- **CLIエージェント統合**: Claude Code（`@filename`）およびGitHub Copilot（`#file:filename`）のファイル参照ショートカット
- **クロスプラットフォームネイティブバイナリ**: 最適なパフォーマンスのためのプラットフォーム固有のビルド
- **強化されたロギング**: 適切なログレベルを持つ本番環境対応のロギングシステム
- **コード品質**: デバッグログと未使用コードの包括的なクリーンアップ

### v0.1.25

- **WebViewアーキテクチャのリファクタリング**: 集中管理されたマネージャーを持つモジュラーシステム
- **アクティブなターミナルの視覚化**: アクティブなターミナルの境界線表示
- **SVGアイコン**: より良いスケーリングのための拡張機能アイコンの更新

## 🙏 謝辞

このプロジェクトでは、これらの優れたライブラリを使用しています。

- [xterm.js](https://xtermjs.org/) - ターミナルエミュレータ
- [node-pty](https://github.com/microsoft/node-pty) - PTYプロセス管理
- [VS Code Extension API](https://code.visualstudio.com/api) - 拡張機能フレームワーク

## 🔗 関連リンク

- [VS Code Extension API](https://code.visualstudio.com/api)
- [xterm.jsドキュメント](https://xtermjs.org/docs/)
- [node-ptyドキュメント](https://github.com/microsoft/node-pty)

---

**開発者**: [s-hiraoku](https://github.com/s-hiraoku)
**リポジトリ**: [vscode-sidebar-terminal](https://github.com/s-hiraoku/vscode-sidebar-terminal)
**ライセンス**: MIT
**サポート**: [Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)

---

_このREADMEは2025-07-30に最終更新されました。_
