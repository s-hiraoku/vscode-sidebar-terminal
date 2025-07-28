# VS Code Sidebar Terminal - デバッグガイド

## 🔧 デバッグ手順

### 1. 開発環境でのデバッグ実行

```bash
# ビルドして実行
npm run compile
```

VS Code内で **F5** を押してExtension Development Hostを起動

### 2. デバッグログの確認場所

- **Extension Host コンソール**: `Ctrl+Shift+Y` → "Debug Console"
- **Webview DevTools**: Terminal ビュー上で `Ctrl+Shift+I`

### 3. 主要なデバッグポイント

#### Extension起動

- ファイル: `src/extension.ts:8`
- ログ: `🚀 [DEBUG] Sidebar Terminal extension is now active!`

#### Webview初期化

- ファイル: `src/providers/SecandarySidebar.ts:22`
- ログ: `🔧 [DEBUG] SecandarySidebar.resolveWebviewView called`

#### ターミナル作成

- ファイル: `src/terminals/TerminalManager.ts:35`
- ログ: `🔧 [DEBUG] TerminalManager.createTerminal called`

#### Webview読み込み

- ファイル: `src/webview/main.ts:450`
- ログ: `🎯 [DEBUG] Webview loaded and ready`

### 4. トラブルシューティング

#### 拡張機能が表示されない

1. Explorer パネルでTerminalビューが見えるかチェック
2. `Ctrl+Shift+P` → "View: Show Explorer"
3. Debug Consoleでエラーログを確認

#### ターミナルが起動しない

1. node-ptyの権限を確認
2. シェルパスの設定を確認
3. TerminalManager のログを確認

#### Webviewが表示されない

1. CSPエラーがないかDevToolsで確認
2. xterm.jsの読み込みエラーをチェック
3. webview.htmlの生成状況を確認

### 5. ログ出力の解釈

```
🚀 [DEBUG] - Extension関連
🔧 [DEBUG] - Provider・Manager関連
🎯 [DEBUG] - Webview関連
```

### 6. パフォーマンスデバッグ

Extension Development Hostで:

- `Ctrl+Shift+P` → "Developer: Reload Window"
- `Ctrl+Shift+P` → "Developer: Show Extension Host Log"

### 7. 本格的なデバッグセッション

```bash
# 詳細ログを有効にして起動
code --log debug --extensionDevelopmentPath="${PWD}"
```

## 🐛 よくある問題

### Terminal が作成されない

- PTYプロセスの権限問題
- シェルパスの設定ミス

### Webview が空白

- CSP (Content Security Policy) 違反
- リソースファイルのパス問題

### Split View が動作しない

- JavaScriptエラー
- DOM要素の取得失敗

---

**デバッグ成功の確認方法:**

1. Extension Development Hostでターミナルビューが表示される
2. ターミナルを作成してコマンド実行ができる
3. Split Viewボタンで表示切り替えができる
