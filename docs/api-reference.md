# API リファレンス

## VS Code Extension API

### 1. WebView View API

#### WebView View の作成
```typescript
vscode.window.registerWebviewViewProvider(
  'sidebarTerminal.terminalView',
  provider,
  { webviewOptions: { retainContextWhenHidden: true } }
);
```

#### WebView Provider の実装
```typescript
export class TerminalWebViewProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionContext.extensionUri]
    };
    
    webviewView.webview.html = this.getWebviewContent(webviewView.webview);
  }
}
```

### 2. Terminal API

#### Terminal の作成
```typescript
const terminal = vscode.window.createTerminal({
  name: 'Sidebar Terminal',
  shellPath: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'
});
```

#### Terminal Events
```typescript
// Terminal 作成時
vscode.window.onDidOpenTerminal((terminal) => {
  console.log('Terminal opened:', terminal.name);
});

// Terminal 終了時
vscode.window.onDidCloseTerminal((terminal) => {
  console.log('Terminal closed:', terminal.name);
});

// Active Terminal 変更時
vscode.window.onDidChangeActiveTerminal((terminal) => {
  console.log('Active terminal changed:', terminal?.name);
});
```

### 3. Command API

#### Command の登録
```typescript
const disposable = vscode.commands.registerCommand(
  'sidebarTerminal.createTerminal',
  () => {
    // コマンドの実装
  }
);
```

#### Command の実行
```typescript
vscode.commands.executeCommand('sidebarTerminal.splitTerminal');
```

### 4. Configuration API

#### 設定の取得
```typescript
const config = vscode.workspace.getConfiguration('sidebarTerminal');
const defaultShell = config.get<string>('defaultShell', '/bin/bash');
```

#### 設定の監視
```typescript
vscode.workspace.onDidChangeConfiguration((event) => {
  if (event.affectsConfiguration('sidebarTerminal')) {
    // 設定変更時の処理
  }
});
```

## Node-pty API

### 1. PTY の作成
```typescript
import * as pty from 'node-pty';

const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-color',
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: process.env
});
```

### 2. データの送受信
```typescript
// データの送信
ptyProcess.write('ls -la\r');

// データの受信
ptyProcess.on('data', (data) => {
  webviewView.webview.postMessage({
    type: 'terminalOutput',
    data: data
  });
});
```

### 3. プロセス管理
```typescript
// プロセスの終了
ptyProcess.kill();

// プロセス終了の監視
ptyProcess.on('exit', (code) => {
  console.log('Process exited with code:', code);
});
```

## xterm.js API

### 1. Terminal の初期化
```javascript
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

const terminal = new Terminal({
  cursorBlink: true,
  theme: {
    background: '#1e1e1e',
    foreground: '#d4d4d4'
  }
});

const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
```

### 2. DOM への描画
```javascript
terminal.open(document.getElementById('terminal'));
fitAddon.fit();
```

### 3. データの送受信
```javascript
// データの送信
terminal.onData((data) => {
  vscode.postMessage({
    type: 'terminalInput',
    data: data
  });
});

// データの受信
terminal.write(data);
```

### 4. イベントハンドリング
```javascript
// リサイズイベント
terminal.onResize((size) => {
  vscode.postMessage({
    type: 'terminalResize',
    cols: size.cols,
    rows: size.rows
  });
});

// 選択イベント
terminal.onSelectionChange(() => {
  const selection = terminal.getSelection();
  // 選択テキストの処理
});
```

## WebView Manager Architecture

WebViewのフロントエンドは、以前のモノリシックな`main.ts`ファイルから、9つの特化したマネージャーで構成されるモジュラーアーキテクチャに再構築されました。これにより、コードの整理、保守性、パフォーマンスが大幅に向上しました。

### 主要なマネージャーとその役割

- **PerformanceManager**: 出力バッファリング、デバウンス、パフォーマンス最適化を管理します。
- **ClaudeCodeManager**: AIインタラクションのインテリジェンスとAlt+Clickの競合解決を処理します。
- **InputManager**: キーボードショートカット、IME処理、Alt+Clickインタラクションを管理します。
- **UIManager**: 視覚的なフィードバック、テーマ設定、ボーダー、ターミナルの外観を処理します。
- **ConfigManager**: 設定の永続化と構成管理を担当します。
- **MessageManager**: WebViewとExtension間の通信を処理します。
- **NotificationManager**: ユーザーフィードバックと視覚的なアラートを提供します。
- **SplitManager**: ターミナルの分割機能とレイアウト計算を処理します。
- **TerminalCoordinator**: すべてのマネージャーを調整するメインのオーケストレーターです。

この新しいアーキテクチャでは、各マネージャーが単一の責任原則に従い、明確な関心事の分離を実現しています。

## WebView メッセージ API

WebViewとExtension間のメッセージ通信は、主に`MessageManager`によって処理されるようになりました。これにより、通信ロジックが一元化され、よりクリーンな分離が実現されています。

### 1. Extension → WebView (MessageManager 経由)

```typescript
// Extension側 (例: SidebarTerminalProvider.ts)
// MessageManagerのインスタンスを介してメッセージを送信
this.messageManager.postMessageToWebview({
  type: 'terminalOutput',
  data: data,
  terminalId: terminalId
});
```

```javascript
// WebView側 (例: main.ts または TerminalCoordinator.ts)
// MessageManagerがメッセージをリッスンし、適切なハンドラにディスパッチ
// 直接のwindow.addEventListener('message')はMessageManager内部で処理されます
// 例: TerminalCoordinatorがterminalOutputメッセージを購読
this.messageManager.onDidReceiveMessage('terminalOutput', (message) => {
  // ターミナルへの出力処理
  this.terminalManager.getTerminal(message.terminalId).write(message.data);
});
```

### 2. WebView → Extension (MessageManager 経由)

```javascript
// WebView側 (例: InputManager.ts)
// MessageManagerのインスタンスを介してメッセージを送信
this.messageManager.postMessageToExtension({
  type: 'terminalInput',
  data: data,
  terminalId: terminalId
});
```

```typescript
// Extension側 (例: SidebarTerminalProvider.ts)
// MessageManagerがメッセージをリッスンし、適切なハンドラにディスパッチ
// 例: SidebarTerminalProviderがterminalInputメッセージを購読
this.messageManager.onDidReceiveMessage('terminalInput', (message) => {
  // PTYへの入力処理
  this.terminalManager.getTerminal(message.terminalId).write(message.data);
});
```

## 設定スキーマ

### package.json の設定
```json
{
  "contributes": {
    "views": {
      "explorer": [
        {
          "id": "sidebarTerminal.terminalView",
          "name": "Terminal",
          "type": "webview"
        }
      ]
    },
    "commands": [
      {
        "command": "sidebarTerminal.createTerminal",
        "title": "New Terminal",
        "icon": "$(terminal)"
      },
      {
        "command": "sidebarTerminal.splitTerminal",
        "title": "Split Terminal",
        "icon": "$(split-vertical)"
      }
    ],
    "configuration": {
      "title": "Sidebar Terminal",
      "properties": {
        "sidebarTerminal.defaultShell": {
          "type": "string",
          "description": "Default shell to use"
        },
        "sidebarTerminal.maxTerminals": {
          "type": "number",
          "default": 10,
          "description": "Maximum number of terminals"
        }
      }
    }
  }
}
```

## エラーハンドリング

### 1. PTY エラー
```typescript
ptyProcess.on('error', (error) => {
  vscode.window.showErrorMessage(`Terminal error: ${error.message}`);
});
```

### 2. WebView エラー
```typescript
webviewView.webview.onDidReceiveMessage((message) => {
  try {
    // メッセージ処理
  } catch (error) {
    console.error('WebView message error:', error);
  }
});
```

### 3. 設定エラー
```typescript
try {
  const config = vscode.workspace.getConfiguration('sidebarTerminal');
  const shell = config.get<string>('defaultShell');
} catch (error) {
  vscode.window.showWarningMessage('Configuration error, using default shell');
}
```

## パフォーマンス最適化

### 1. メッセージのバッチ処理
```typescript
let messageBuffer: string[] = [];
let bufferTimeout: NodeJS.Timeout;

ptyProcess.on('data', (data) => {
  messageBuffer.push(data);
  
  if (bufferTimeout) {
    clearTimeout(bufferTimeout);
  }
  
  bufferTimeout = setTimeout(() => {
    webviewView.webview.postMessage({
      type: 'terminalOutput',
      data: messageBuffer.join('')
    });
    messageBuffer = [];
  }, 16); // 60fps
});
```

### 2. リソース管理
```typescript
export class TerminalManager {
  private terminals = new Map<string, pty.IPty>();
  
  createTerminal(id: string): pty.IPty {
    if (this.terminals.size >= MAX_TERMINALS) {
      throw new Error('Maximum terminals reached');
    }
    
    const terminal = pty.spawn(shell, [], options);
    this.terminals.set(id, terminal);
    return terminal;
  }
  
  dispose() {
    for (const terminal of this.terminals.values()) {
      terminal.kill();
    }
    this.terminals.clear();
  }
}
```