# VS Code Sidebar Terminal

[![GitHub license](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
[![GitHub stars](https://img.shields.io/github/stars/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/stargazers)

VS Code のサイドパネルにターミナルを表示する拡張機能です。複数のターミナルを縦分割で同時に表示し、効率的な開発作業をサポートします。

## 🚀 主な機能

- **サイドパネル表示**: Explorer パネルでターミナルを確認しながら作業
- **複数ターミナル管理**: 最大5つのターミナルを同時に実行
- **タブ切り替え**: 直感的なタブでターミナル間の切り替え
- **分割機能**: ターミナルを縦分割して同時に表示
- **カスタマイズ可能**: フォント、サイズ、シェルの設定が可能
- **クロスプラットフォーム**: Windows、macOS、Linux 対応

## 📦 インストール

### VS Code Marketplace からのインストール（予定）

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

### 基本操作

1. **ターミナルを開く**: Explorer パネルで "Terminal" ビューをクリック
2. **新しいターミナル作成**: タイトルバーの `+` ボタンをクリック
3. **ターミナル分割**: タイトルバーの分割ボタンをクリック
4. **ターミナル切り替え**: タブをクリックして切り替え
5. **ターミナル終了**: タイトルバーの `×` ボタンをクリック

### コマンドパレット

- `Sidebar Terminal: Create New Terminal` - 新しいターミナルを作成
- `Sidebar Terminal: Split Terminal` - ターミナルを分割
- `Sidebar Terminal: Clear Terminal` - アクティブなターミナルをクリア
- `Sidebar Terminal: Kill Terminal` - アクティブなターミナルを終了

## ⚙️ 設定

VS Code の設定（`settings.json`）で以下の項目をカスタマイズできます：

```json
{
  "sidebarTerminal.shell": "",
  "sidebarTerminal.shellArgs": [],
  "sidebarTerminal.fontSize": 14,
  "sidebarTerminal.fontFamily": "Consolas, 'Courier New', monospace",
  "sidebarTerminal.maxTerminals": 5
}
```

### 設定項目詳細

| 設定項目 | 型 | デフォルト値 | 説明 |
|---------|---|------------|------|
| `shell` | string | "" | 使用するシェルのパス（空文字でシステムデフォルト） |
| `shellArgs` | array | [] | シェルに渡す引数 |
| `fontSize` | number | 14 | ターミナルのフォントサイズ |
| `fontFamily` | string | "Consolas, 'Courier New', monospace" | ターミナルのフォントファミリー |
| `maxTerminals` | number | 5 | 同時実行可能なターミナルの最大数 |

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

**Q: シェルが起動しない**
A: `sidebarTerminal.shell` 設定でシェルのパスが正しいか確認してください。

**Q: 日本語が文字化けする**
A: ターミナルの文字コード設定を UTF-8 に変更してください。

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
- サイドパネルターミナル表示
- 複数ターミナル管理
- 縦分割機能
- 設定カスタマイズ

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