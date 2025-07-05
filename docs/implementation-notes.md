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
├── terminal/
│   ├── manager.ts        # ターミナル管理
│   ├── pty.ts           # PTY プロセス管理
│   └── types.ts         # 型定義
├── webview/
│   ├── provider.ts      # WebView プロバイダー
│   ├── content.ts       # HTML コンテンツ生成
│   └── resources/       # 静的リソース
└── utils/
    ├── config.ts        # 設定管理
    └── logger.ts        # ログ出力
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

### 3. エラーハンドリング
```typescript
export class ErrorHandler {
  static handlePtyError(error: Error, terminalId: string): void {
    console.error(`PTY error for terminal ${terminalId}:`, error);
    vscode.window.showErrorMessage(
      `Terminal error: ${error.message}`,
      'Restart Terminal'
    ).then(selection => {
      if (selection === 'Restart Terminal') {
        vscode.commands.executeCommand('sidebarTerminal.restartTerminal', terminalId);
      }
    });
  }
  
  static handleWebviewError(error: Error): void {
    console.error('WebView error:', error);
    vscode.window.showErrorMessage(`WebView error: ${error.message}`);
  }
}
```

### 4. 設定管理
```typescript
export class ConfigManager {
  private static readonly CONFIG_SECTION = 'sidebarTerminal';
  
  static getDefaultShell(): string {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    return config.get<string>('defaultShell') || this.getSystemShell();
  }
  
  static getMaxTerminals(): number {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    return config.get<number>('maxTerminals', 10);
  }
  
  private static getSystemShell(): string {
    switch (process.platform) {
      case 'win32':
        return process.env.COMSPEC || 'cmd.exe';
      case 'darwin':
        return process.env.SHELL || '/bin/zsh';
      default:
        return process.env.SHELL || '/bin/bash';
    }
  }
}
```

## デバッグとテスト

### 1. デバッグ設定
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}"
      ],
      "outFiles": [
        "${workspaceFolder}/out/**/*.js"
      ],
      "preLaunchTask": "${workspaceFolder}/npm: watch"
    }
  ]
}
```

### 2. テスト実行
```bash
# 単体テスト
npm run test

# 拡張機能テスト
npm run test:extension

# カバレッジ
npm run test:coverage
```

### 3. ログ出力
```typescript
export class Logger {
  private static outputChannel = vscode.window.createOutputChannel('Sidebar Terminal');
  
  static info(message: string): void {
    this.outputChannel.appendLine(`[INFO] ${new Date().toISOString()}: ${message}`);
  }
  
  static error(message: string, error?: Error): void {
    this.outputChannel.appendLine(`[ERROR] ${new Date().toISOString()}: ${message}`);
    if (error) {
      this.outputChannel.appendLine(`Stack: ${error.stack}`);
    }
  }
}
```

## パフォーマンス最適化

### 1. メモリ管理
```typescript
export class MemoryManager {
  private static readonly MAX_BUFFER_SIZE = 1024 * 1024; // 1MB
  
  static checkMemoryUsage(): void {
    const usage = process.memoryUsage();
    if (usage.heapUsed > this.MAX_BUFFER_SIZE) {
      Logger.info(`High memory usage: ${usage.heapUsed / 1024 / 1024}MB`);
    }
  }
  
  static cleanup(): void {
    // 不要なリソースのクリーンアップ
    global.gc && global.gc();
  }
}
```

### 2. 非同期処理
```typescript
export class AsyncManager {
  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    });
    
    return Promise.race([promise, timeout]);
  }
}
```

## 互換性考慮事項

### 1. OS 固有の処理
```typescript
export class PlatformUtils {
  static getShellCommand(): string {
    switch (process.platform) {
      case 'win32':
        return 'cmd.exe';
      case 'darwin':
        return '/bin/zsh';
      default:
        return '/bin/bash';
    }
  }
  
  static getTerminalArgs(): string[] {
    if (process.platform === 'win32') {
      return ['/c'];
    }
    return [];
  }
}
```

### 2. VS Code バージョン互換性
```json
// package.json
{
  "engines": {
    "vscode": "^1.74.0"
  }
}
```

## セキュリティ考慮事項

### 1. 入力の検証
```typescript
export class InputValidator {
  static sanitizeCommand(command: string): string {
    // 危険なコマンドの除去
    const dangerousPatterns = [
      /rm\s+-rf\s+\//,
      /format\s+c:/,
      /del\s+\/s\s+\/q/
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        throw new Error('Dangerous command detected');
      }
    }
    
    return command;
  }
}
```

### 2. 権限管理
```typescript
export class PermissionManager {
  static checkFileAccess(path: string): boolean {
    try {
      fs.accessSync(path, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }
}
```

## トラブルシューティング

### 1. 一般的な問題
- **PTY が作成できない**: シェルのパスが正しいか確認
- **WebView が表示されない**: CSP の設定を確認
- **メモリリーク**: ターミナルの適切なクリーンアップを確認

### 2. デバッグコマンド
```bash
# ログの確認
code --open-devtools

# 拡張機能の再読み込み
Ctrl+Shift+P → "Developer: Reload Window"
```

### 3. よくあるエラー
```typescript
// node-pty エラー
if (error.code === 'ENOENT') {
  Logger.error('Shell not found, using default shell');
}

// WebView エラー
if (error.message.includes('CSP')) {
  Logger.error('Content Security Policy violation');
}
```