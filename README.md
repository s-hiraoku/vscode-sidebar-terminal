# VS Code Sidebar Terminal

サイドバーに統合されたターミナル機能を提供するVisual Studio Code拡張です。複数のターミナルタブと分割表示をサポートし、直感的なUI/UXでターミナル操作を効率化します。

## 機能

### 🖥️ 主な機能
- **サイドバー統合**: メインエディタエリアを占有せずにターミナルを使用
- **複数ターミナル**: 最大5つまでのターミナルインスタンスを同時実行
- **タブベースUI**: 各ターミナルをタブで切り替え可能
- **プラットフォーム対応**: Windows、macOS、Linuxすべてで動作
- **設定可能**: フォント、シェル、動作設定をカスタマイズ可能

### ⚡ 高度な機能
- **xterm.js統合**: フル機能のターミナルエミュレーション
- **Unicode対応**: 絵文字や多言語文字の完全サポート
- **リンク検出**: URLの自動検出とクリック対応
- **リサイズ対応**: ウィンドウサイズに応じた自動調整
- **テーマ連携**: VS Codeのダーク/ライトテーマに自動対応

## インストール

### Visual Studio Code Marketplace経由
1. VS Codeを開く
2. 拡張機能ビュー（`Ctrl+Shift+X`）を開く
3. "Sidebar Terminal"を検索
4. インストールボタンをクリック

### 手動インストール
```bash
# リポジトリをクローン
git clone https://github.com/yourusername/vscode-sidebar-terminal.git
cd vscode-sidebar-terminal

# 依存関係をインストール
npm install

# 拡張をビルド
npm run compile

# VS Codeで開発モードで実行
# F5キーを押して開発ホストでテスト
```

## 使用方法

### 基本操作

#### ターミナルの開始
1. VS Codeのサイドバーで「ターミナル」ビューを選択
2. 自動的に最初のターミナルが作成されます

#### 新しいターミナルの作成
- コマンドパレット（`Ctrl+Shift+P`）で「Sidebar Terminal: Create Terminal」を実行
- または、既存のターミナルタブの隣の「+」ボタンをクリック

#### ターミナルの切り替え
- タブをクリックして切り替え
- キーボードショートカット（設定可能）

#### ターミナルの終了
- コマンドパレットで「Sidebar Terminal: Kill Terminal」を実行
- または、ターミナル内で`exit`コマンドを実行

### キーボードショートカット

| コマンド | デフォルト | 説明 |
|---------|-----------|------|
| 新しいターミナル作成 | `Ctrl+Shift+`` | サイドバーに新しいターミナルを作成 |
| ターミナルクリア | `Ctrl+K` | アクティブなターミナルの内容をクリア |
| ターミナル終了 | `Ctrl+Shift+K` | アクティブなターミナルを終了 |

## 設定

### 設定項目

```json
{
  // 最大ターミナル数（1-10）
  "sidebarTerminal.maxTerminals": 5,
  
  // フォント設定
  "sidebarTerminal.fontSize": 14,
  "sidebarTerminal.fontFamily": "Consolas, 'Courier New', monospace",
  
  // シェル設定（空の場合はシステムデフォルト）
  "sidebarTerminal.shell": "",
  "sidebarTerminal.shellArgs": []
}
```

### プラットフォーム別設定

#### Windows
```json
{
  "sidebarTerminal.shell": "powershell.exe",
  "sidebarTerminal.shellArgs": ["-NoLogo"]
}
```

#### macOS
```json
{
  "sidebarTerminal.shell": "/bin/zsh",
  "sidebarTerminal.shellArgs": ["-l"]
}
```

#### Linux
```json
{
  "sidebarTerminal.shell": "/bin/bash",
  "sidebarTerminal.shellArgs": ["--login"]
}
```

## 開発

### 技術スタック
- **TypeScript**: メインの開発言語
- **node-pty**: ターミナルプロセス管理
- **xterm.js**: ターミナルUI
- **VS Code API**: 拡張機能フレームワーク

### プロジェクト構造
```
src/
├── constants/          # 定数定義
│   └── index.ts
├── providers/          # VS Code プロバイダー
│   └── SidebarTerminalProvider.ts
├── terminals/          # ターミナル管理
│   └── TerminalManager.ts
├── types/             # TypeScript型定義
│   └── common.ts
├── utils/             # ユーティリティ関数
│   └── common.ts
├── webview/           # Webview（フロントエンド）
│   └── main.ts
└── extension.ts       # 拡張エントリーポイント
```

### ビルドスクリプト
```bash
# 開発ビルド
npm run compile

# ウォッチモード
npm run watch

# 本番ビルド
npm run package

# テスト実行
npm test

# リンター実行
npm run lint

# フォーマット
npm run format
```

### デバッグ
1. VS Codeでプロジェクトを開く
2. `F5`キーを押して開発ホストを起動
3. 新しいVS Codeウィンドウで拡張をテスト
4. `Ctrl+Shift+I`で開発者ツールを開く

## トラブルシューティング

### よくある問題

#### ターミナルが表示されない
1. VS Codeのバージョンが最新か確認
2. 拡張が有効になっているか確認
3. 設定のシェルパスが正しいか確認

#### パフォーマンスの問題
1. 同時に開くターミナル数を制限（設定で調整）
2. 不要なターミナルを終了
3. スクロールバックの行数を調整

#### 文字化け
1. フォントファミリの設定を確認
2. Unicode対応フォントを使用
3. シェルのエンコーディング設定を確認

### ログの確認
1. 開発者ツール（`Ctrl+Shift+I`）を開く
2. コンソールタブでエラーメッセージを確認
3. 出力パネルで"Sidebar Terminal"チャンネルを選択

## コントリビューション

### 貢献方法
1. このリポジトリをフォーク
2. 機能ブランチを作成（`git checkout -b feature/amazing-feature`）
3. 変更をコミット（`git commit -m 'Add amazing feature'`）
4. ブランチをプッシュ（`git push origin feature/amazing-feature`）
5. プルリクエストを作成

### 開発ガイドライン
- TypeScriptの厳密な型チェックを使用
- ESLintとPrettierの設定に従う
- 新機能にはテストを追加
- コミットメッセージは[Conventional Commits](https://conventionalcommits.org/)形式

### バグレポート
GitHubのIssuesでバグレポートを作成してください。以下の情報を含めてください：
- OS（Windows/macOS/Linux）
- VS Codeバージョン
- 拡張バージョン
- 再現手順
- 期待される動作
- 実際の動作

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 謝辞

- [xterm.js](https://xtermjs.org/) - 優れたターミナルエミュレーター
- [node-pty](https://github.com/microsoft/node-pty) - クロスプラットフォームターミナル
- VS Code チーム - 素晴らしい拡張API

## 変更履歴

### v1.0.0 (予定)
- 初回リリース
- 基本的なターミナル機能
- 複数ターミナルサポート
- 設定可能なオプション

---

**作者**: Your Name
**リポジトリ**: https://github.com/yourusername/vscode-sidebar-terminal
**バグレポート**: https://github.com/yourusername/vscode-sidebar-terminal/issues