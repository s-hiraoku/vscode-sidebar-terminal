# 実装時の注意事項

## 開発環境セットアップ

### 1. 必要なツール
```bash
# VS Code Extension Generator
npm install -g yo generator-code

# VS Code Extension CLI
npm install -g @vscode/vsce

# 開発用依存関係
npm install --save-dev @types/vscode @types/node typescript
```

### 2. プロジェクト初期化
```bash
# 拡張機能の雛形作成
yo code

# 選択肢:
# - New Extension (TypeScript)
# - Extension name: vscode-sidebar-terminal
# - Identifier: sidebar-terminal
# - Description: Terminal in sidebar with split functionality
# - Initialize git repository: Yes
# - Bundle the source code: No
# - Package manager: npm
```

### 3. 依存関係の追加
```bash
# ターミナル関連
npm install xterm @xterm/addon-fit node-pty

# 型定義
npm install --save-dev @types/node-pty
```

## コーディング規約

### 1. TypeScript 設定
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### 2. ESLint 設定
```json
// .eslintrc.json
{
  "extends": ["@typescript-eslint/recommended"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### 3. コード構成
```
src/
├── extension.ts          # エントリーポイント
├── config/               # 設定管理
├── constants/            # アプリケーション定数
├── providers/            # WebViewプロバイダー
├── terminals/            # ターミナル管理
├── types/                # TypeScript型定義
├── utils/                # ユーティリティ関数
├── webview/              # フロントエンドコード
│   ├── main.ts           # WebViewエントリーポイント
│   ├── components/       # UIコンポーネント
│   ├── constants/        # WebView固有の定数
│   ├── core/             # コアロジック（例: NotificationBridge, NotificationSystem）
│   ├── interfaces/       # マネージャーインターフェース
│   ├── managers/         # UI/ロジックマネージャー（例: InputManager, UIManager）
│   ├── types/            # WebView固有の型定義
│   └── utils/            # WebViewユーティリティ関数
└── test/                 # テスト関連ファイル
```

## 実装のポイント

### 1. WebView のセキュリティ
```typescript
// Content Security Policy の設定
const csp = [
  "default-src 'none'",
  "script-src 'unsafe-inline' vscode-resource:",
  "style-src 'unsafe-inline' vscode-resource:",
  "font-src vscode-resource:",
  "connect-src 'none'"
].join('; ');

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta charset="UTF-8">
  <title>Terminal</title>
</head>
<body>
  <div id="terminal-container"></div>
</body>
</html>
`;
```

### 2. PTY プロセスの管理
```typescript
export class PtyManager {
  private processes = new Map<string, pty.IPty>();
  
  createPty(id: string, options: PtyOptions): pty.IPty {
    const ptyProcess = pty.spawn(options.shell, [], {
      name: 'xterm-color',
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd,
      env: { ...process.env, ...options.env }
    });
    
    this.processes.set(id, ptyProcess);
    this.setupPtyEvents(id, ptyProcess);
    
    return ptyProcess;
  }
  
  private setupPtyEvents(id: string, ptyProcess: pty.IPty): void {
    ptyProcess.on('data', (data) => {
      this.onDataReceived(id, data);
    });
    
    ptyProcess.on('exit', (code) => {
      this.onPtyExit(id, code);
      this.processes.delete(id);
    });
  }
}
```

### 3. エラーハンドリング (NotificationManager, ErrorHandler)
```typescript
// Extension側 (例: SidebarTerminalProvider.ts)
// PTYエラーを処理し、WebViewのNotificationManagerを通じてユーザーに通知
import { NotificationType } from '../webview/types/webview.types';

// ...

ptyProcess.on('error', (error) => {
  console.error(`PTY error: ${error.message}`);
  // WebViewのNotificationManagerにエラーを送信
  this.messageManager.postMessageToWebview({
    type: 'showNotification',
    notificationType: NotificationType.Error,
    message: `Terminal error: ${error.message}`,
    options: { button: 'Restart Terminal', terminalId: terminalId }
  });
});

// WebView側 (例: NotificationManager.ts)
// Extensionからの通知メッセージを受信し、表示
import { NotificationSystem } from '../core/NotificationSystem';

export class NotificationManager {
  private notificationSystem: NotificationSystem;

  constructor(messageManager: MessageManager) {
    this.notificationSystem = new NotificationSystem();
    messageManager.onDidReceiveMessage('showNotification', (message) => {
      this.notificationSystem.showNotification(
        message.notificationType,
        message.message,
        message.options
      );
    });
  }
}
```

### 4. 設定管理 (ConfigManager)
```typescript
// Extension側 (例: ConfigManager.ts)
// VS Codeの設定を読み込み、WebViewに送信
import * as vscode from 'vscode';

export class ConfigManager {
  private static readonly CONFIG_SECTION = 'sidebarTerminal';

  static getConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(this.CONFIG_SECTION);
  }

  static async sendConfigToWebview(webview: vscode.Webview): Promise<void> {
    const config = this.getConfiguration();
    webview.postMessage({
      type: 'updateConfig',
      payload: {
        shell: config.get<string>('shell'),
        shellArgs: config.get<string[]>('shellArgs'),
        fontSize: config.get<number>('fontSize'),
        fontFamily: config.get<string>('fontFamily'),
        maxTerminals: config.get<number>('maxTerminals'),
        theme: config.get<string>('theme'),
        cursorBlink: config.get<boolean>('cursorBlink'),
        altClickMovesCursor: config.get<boolean>('altClickMovesCursor'),
      }
    });
  }
}

// WebView側 (例: ConfigManager.ts)
// Extensionから設定を受信し、内部で管理
import { MessageManager } from '../core/MessageManager';
import { TerminalSettings } from '../types/webview.types';

export class ConfigManagerWebview {
  private settings: TerminalSettings;

  constructor(messageManager: MessageManager) {
    this.settings = {} as TerminalSettings; // 初期化
    messageManager.onDidReceiveMessage('updateConfig', (message) => {
      this.settings = { ...this.settings, ...message.payload };
      console.log('Received updated config:', this.settings);
      // 設定変更に応じたUIや動作の更新
    });
  }

  getSetting<T extends keyof TerminalSettings>(key: T): TerminalSettings[T] {
    return this.settings[key];
  }
}
```

## デバッグとテスト

詳細なデバッグ手順とテストの実行方法については、[デバッグガイド (日本語)](./DEBUG.md) を参照してください。

## トラブルシューティング

一般的な問題の解決策とデバッグ方法については、[デバッグガイド (日本語)](./DEBUG.md) を参照してください。