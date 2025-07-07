# VS Code Sidebar Terminal

[![GitHub license](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
[![GitHub stars](https://img.shields.io/github/stars/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/stargazers)

VS Code のサイドバーに高機能なターミナルインターフェイスを統合する強力な拡張機能です。分割ターミナル、カスタマイズ可能なテーマ、シームレスなワークスペース統合により、開発生産性を大幅に向上させます。

## 🚀 主な機能

### 核となる機能
- **🎯 サイドバー統合**: Primary Sidebar内にターミナルインターフェイスを埋め込み、即座にアクセス可能
- **⚡ 分割ターミナル**: 複数のターミナルセッションを同時実行し、視覚的に分割表示
- **🔧 完全なシェルサポート**: node-ptyによる全てのシェル機能を備えた完全なターミナルエミュレーション
- **🎨 テーマ対応**: VS Codeテーマに自動適応（ダーク/ライトモード）
- **🌐 クロスプラットフォーム**: Windows、macOS、Linuxに完全対応

### 高度な機能
- **📊 ステータス管理**: リアルタイムターミナルステータス表示と自動非表示通知
- **🔒 ターミナル保護**: 設定可能なターミナル終了保護と確認ダイアログ
- **🎛️ リサイズ処理**: デバウンス機能付きインテリジェントなターミナルリサイズ
- **💾 コンテキスト保持**: サイドバーが非表示でもターミナルセッションを維持
- **⌨️ 完全なキー対応**: Ctrl+C、Ctrl+L、矢印キーなど全てのキーボードショートカット

### カスタマイズ機能
- **🎨 外観カスタマイズ**: フォントファミリー、サイズ、カーソル点滅、ヘッダースタイル
- **⚙️ 動作設定**: シェル選択、引数、作業ディレクトリ
- **🔧 レイアウト制御**: 最小ターミナル高さ、分割制限、アイコン透明度
- **🌍 国際化対応**: 日本語IMEを含む多言語サポート

## 📦 インストール

### VS Code Marketplace からのインストール（近日公開予定）

1. VS Code を開く
2. 拡張機能パネル（`Ctrl+Shift+X`）を開く
3. "Sidebar Terminal" を検索
4. インストールボタンをクリック

### 手動インストール

1. [Releases](https://github.com/s-hiraoku/vscode-sidebar-terminal/releases) から最新の `.vsix` ファイルをダウンロード
2. VS Code で `Ctrl+Shift+P` を押してコマンドパレットを開く
3. "Extensions: Install from VSIX..." を選択
4. ダウンロードした `.vsix` ファイルを選択

## 🎯 使用方法

### スタートガイド

1. **ターミナルへのアクセス**: アクティビティバーのターミナルアイコンをクリック、またはExplorerパネルで「Terminal」を検索
2. **ターミナル作成**: 分割ボタンを使用して複数のターミナルセッションを作成
3. **セッション管理**: 視覚的な分割インターフェイスでターミナルを切り替え
4. **コマンド実行**: 標準ターミナルの全機能を完全サポート

### クイックアクション

- **ターミナル分割**: 分割ボタンをクリックまたはコマンドパレットを使用
- **ターミナル終了**: ゴミ箱ボタンを使用（オプションで確認ダイアログ表示）
- **画面クリア**: 標準のCtrl+Lまたはclearコマンド
- **設定アクセス**: ギアアイコンからターミナル設定にアクセス

### 配置について

#### Primary Sidebar（左側）
- ターミナルは左側のExplorerパネルに表示されます
- 他のサイドバービューと同じ場所に配置され、タブで切り替えができます

### コマンドパレット

- `Sidebar Terminal: Split Terminal` - 新しいターミナルセッションを作成
- `Sidebar Terminal: Kill Terminal` - アクティブなターミナルを終了
- `Sidebar Terminal: Terminal Settings` - ターミナル設定パネルを開く

### キーボードショートカット

- 標準ターミナルの全てのキーボードショートカットをサポート
- Ctrl+C、Ctrl+L、Ctrl+Dが期待通り動作
- コマンド履歴ナビゲーション用の矢印キー
- ファイル/コマンド名のタブ補完

## ⚙️ 設定

豊富な設定オプションでターミナル体験をカスタマイズ：

```json
{
  "sidebarTerminal.shell": "",
  "sidebarTerminal.shellArgs": [],
  "sidebarTerminal.fontSize": 14,
  "sidebarTerminal.fontFamily": "Consolas, 'Courier New', monospace",
  "sidebarTerminal.maxTerminals": 5,
  "sidebarTerminal.theme": "auto",
  "sidebarTerminal.cursorBlink": true,
  "sidebarTerminal.confirmBeforeKill": false,
  "sidebarTerminal.protectLastTerminal": true
}
```

### 設定カテゴリー

#### ターミナル動作
| 設定項目 | 型 | デフォルト値 | 説明 |
|---------|---|------------|------|
| `shell` | string | "" | 使用するシェルのパス（空文字でシステムデフォルト） |
| `shellArgs` | array | [] | シェルに渡す引数 |
| `defaultDirectory` | string | "" | 新しいターミナルのデフォルト作業ディレクトリ |
| `maxTerminals` | number | 5 | 同時実行可能なターミナルの最大数 |
| `confirmBeforeKill` | boolean | false | ターミナル終了前の確認ダイアログ表示 |
| `protectLastTerminal` | boolean | true | 最後のターミナルの終了を防止 |

#### 表示・テーマ
| 設定項目 | 型 | デフォルト値 | 説明 |
|---------|---|------------|------|
| `fontSize` | number | 14 | ターミナルのフォントサイズ |
| `fontFamily` | string | "Consolas, 'Courier New', monospace" | ターミナルのフォントファミリー |
| `theme` | string | "auto" | ターミナルテーマ（auto、dark、light） |
| `cursorBlink` | boolean | true | カーソルの点滅有効化 |

#### 分割・レイアウト
| 設定項目 | 型 | デフォルト値 | 説明 |
|---------|---|------------|------|
| `maxSplitTerminals` | number | 5 | 分割表示での最大ターミナル数 |
| `minTerminalHeight` | number | 100 | 分割ターミナルの最小高さ |
| `enableSplitResize` | boolean | true | 分割ターミナルのリサイズ許可 |

#### ステータス・UI
| 設定項目 | 型 | デフォルト値 | 説明 |
|---------|---|------------|------|
| `statusDisplayDuration` | number | 3000 | ステータスメッセージ表示時間（ミリ秒） |
| `autoHideStatus` | boolean | true | ステータスメッセージの自動非表示 |
| `showWebViewHeader` | boolean | true | タイトルとアイコン付きヘッダー表示 |

## 🛠️ 開発

### 必要な環境

- Node.js 18+
- VS Code 1.74.0+
- npm または yarn

### セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/s-hiraoku/vscode-sidebar-terminal.git
cd vscode-sidebar-terminal

# 依存関係をインストール
npm install

# 開発用ビルド
npm run compile

# ウォッチモード
npm run watch
```

### デバッグ

1. VS Code でプロジェクトを開く
2. `F5` キーを押してExtension Development Hostを起動
3. 新しいウィンドウでExplorerパネルの"Terminal"を確認

### テスト実行

```bash
# 単体テスト
npm test

# リンター
npm run lint

# フォーマッター
npm run format

# プロダクションビルド
npm run package
```

## 🏗️ アーキテクチャ

```
src/
├── constants/          # 定数定義
├── providers/          # WebView プロバイダー
├── terminals/          # ターミナル管理
├── types/             # 型定義
├── utils/             # ユーティリティ関数
├── webview/           # フロントエンド
└── extension.ts       # エントリーポイント
```

### 主要コンポーネント

- **TerminalManager**: 複数ターミナルの状態管理
- **SidebarTerminalProvider**: VS Code WebView との連携
- **WebView (xterm.js)**: ターミナル UI の描画
- **PTY Process**: システムレベルのシェル連携

## 🤝 コントリビューション

コントリビューションを歓迎します！以下の手順でお願いします：

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Request を作成

### コントリビューションガイドライン

- TypeScript の型安全性を保つ
- ESLint と Prettier のルールに従う
- テストを追加して機能をカバー
- コミットメッセージは [Conventional Commits](https://conventionalcommits.org/) 形式で記述

## 🐛 トラブルシューティング

### よくある問題

**Q: ターミナルが表示されない**
A: VS Code を再起動するか、拡張機能を無効/有効にしてください。

**Q: コマンドが実行されない**
A: PTY通信の問題です。VS Codeを再起動し、拡張機能を再有効化してください。

**Q: Backspaceキーが動作しない**  
A: 特殊キー処理が修正されました。最新版をご利用ください。

**Q: ボタン（Clear/New/Split）が機能しない**
A: ボタン機能が実装されました。Webview通信を確認してください。


**Q: シェルが起動しない**
A: `sidebarTerminal.shell` 設定でシェルのパスが正しいか確認してください。

**Q: 日本語が文字化けする**
A: ターミナルの文字コード設定を UTF-8 に変更してください。IME対応が追加されています。

**Q: パフォーマンスが遅い**
A: `maxTerminals` 設定で同時実行数を減らしてください。

### デバッグ情報

問題が発生した場合は、以下の情報を含めて Issue を作成してください：

- VS Code バージョン
- 拡張機能バージョン
- OS とバージョン
- 使用しているシェル
- エラーメッセージ
- 再現手順

## 📄 ライセンス

このプロジェクトは [MIT License](LICENSE) の下で公開されています。

## 📝 更新履歴

### v0.0.1 (開発中)

- 初期リリース
- サイドバー・パネルターミナル表示
- 複数ターミナル管理
- 分割機能（Split Button）
- PTY通信の修正・改善
- Backspace キー処理の修正
- Clear/New/Split ボタン実装
- IME（日本語入力）対応
- 設定カスタマイズ

### 修正された問題 (Recent Fixes)

- ✅ PTY通信が動作しない問題を修正
- ✅ Backspaceキーが正常に動作しない問題を修正  
- ✅ Clear・New・Splitボタンが機能しない問題を修正
- ✅ Webviewエントリーポイントの修正（simple.ts → main.ts）
- ✅ TypeScript/ESLint エラーの修正
- ✅ Terminal実行環境の改善
- ✅ ユーザーガイダンスの強化

## 🙏 謝辞

このプロジェクトは以下の優れたライブラリを使用しています：

- [xterm.js](https://xtermjs.org/) - ターミナルエミュレーター
- [node-pty](https://github.com/microsoft/node-pty) - PTY プロセス管理
- [VS Code Extension API](https://code.visualstudio.com/api) - 拡張機能フレームワーク

## 🔗 関連リンク

- [VS Code Extension API](https://code.visualstudio.com/api)
- [xterm.js Documentation](https://xtermjs.org/docs/)
- [node-pty Documentation](https://github.com/microsoft/node-pty)

---

**開発者**: [s-hiraoku](https://github.com/s-hiraoku)  
**リポジトリ**: [vscode-sidebar-terminal](https://github.com/s-hiraoku/vscode-sidebar-terminal)  
**ライセンス**: MIT  
**サポート**: [Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)