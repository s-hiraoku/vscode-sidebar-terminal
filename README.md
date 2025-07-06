# VS Code Sidebar Terminal

[![GitHub license](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
[![GitHub stars](https://img.shields.io/github/stars/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/stargazers)

VS Code のサイドバーにターミナルを表示する拡張機能です。左側のPrimary Sidebarに配置し、効率的な開発作業をサポートします。

## 🚀 主な機能

- **サイドバー配置**: Primary Sidebar（左側）にターミナルを表示
- **複数ターミナル管理**: 最大5つのターミナルを同時に実行
- **実際のターミナル機能**: node-pty による完全なシェル実行環境
- **キー入力対応**: Backspace、Ctrl+C、Ctrl+L等の特殊キー対応
- **ボタン操作**: Clear、New、Split ボタンによる直感的操作
- **IME対応**: 日本語入力等の多言語入力サポート
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
2. **新しいターミナル作成**: ターミナル内の「New」ボタンをクリック
3. **ターミナル分割**: ターミナル内の「Split」ボタンをクリック  
4. **ターミナルクリア**: ターミナル内の「Clear」ボタンをクリック
5. **コマンド実行**: 通常のターミナルと同様にコマンド入力が可能

### 配置について

#### Primary Sidebar（左側）
- ターミナルは左側のExplorerパネルに表示されます
- 他のサイドバービューと同じ場所に配置され、タブで切り替えができます

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