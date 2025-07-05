# VS Code Sidebar Terminal Extension

VS Code のサイドパネルにターミナルを表示する拡張機能です。

## 機能

- 🖥️ サイドパネルでのターミナル表示
- ➗ 縦分割機能のサポート
- 🎨 xterm.js によるリッチなターミナルエミュレーション
- ⚙️ カスタマイズ可能な設定
- 🚀 高速で軽量な実装

## 技術スタック

- TypeScript
- VS Code Extension API
- WebView API
- xterm.js
- node-pty

## 開発セットアップ

```bash
# 依存関係のインストール
npm install

# 開発モードで実行
npm run watch

# VS Code でデバッグ
F5 キーを押して新しい VS Code ウィンドウを開く
```

## プロジェクト構造

```
vscode-sidebar-terminal/
├── src/
│   ├── extension.ts          # エントリーポイント
│   ├── terminalManager.ts    # ターミナル管理
│   ├── webviewProvider.ts    # WebView プロバイダー
│   ├── ptyManager.ts         # PTY プロセス管理
│   └── webview/             # WebView のリソース
│       ├── index.html
│       ├── style.css
│       └── terminal.js
├── package.json
├── tsconfig.json
└── README.md
```

## GitHub Issues

プロジェクトの進捗は GitHub Issues で管理されています。以下のスクリプトを実行して、全ての Issues を作成できます：

```bash
# GitHub CLI でログイン
gh auth login

# リポジトリを作成
gh repo create vscode-sidebar-terminal --public

# Issues を作成
bash create-github-issues.sh
```

## ライセンス

MIT