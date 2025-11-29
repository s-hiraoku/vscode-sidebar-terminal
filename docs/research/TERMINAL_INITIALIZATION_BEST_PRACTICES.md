# Terminal Initialization Best Practices Guide

## VS Code標準ターミナル実装パターン - 統合ガイド

**Version**: 1.0
**Last Updated**: 2025-11-05
**Status**: ✅ Production Ready

このドキュメントは、VS Code標準ターミナルの実装パターンをリバースエンジニアリングし、プロジェクトに適用可能なベストプラクティスをまとめたものです。

---

## 📑 Table of Contents

1. [初期化シーケンス](#1-初期化シーケンス)
2. [メッセージ通信パターン](#2-メッセージ通信パターン)
3. [プロンプト重複防止](#3-プロンプト重複防止)
4. [パネル位置検出](#4-パネル位置検出)
5. [エラーハンドリング](#5-エラーハンドリング)
6. [パフォーマンス最適化](#6-パフォーマンス最適化)
7. [テスト戦略](#7-テスト戦略)
8. [実装チェックリスト](#8-実装チェックリスト)

---

## 1. 初期化シーケンス

### VS Code Pattern: Phase-Based Initialization

VS Codeは**複数フェーズ**で初期化を行います:

```
Phase 1: DOM Ready
    ↓
Phase 2: Create Managers (Don't Start)
    ↓
Phase 3: Register Listeners
    ↓
Phase 4: Handshake with Extension
    ↓
Phase 5: Load HTML
    ↓
Phase 6: Start Managers
    ↓
Phase 7: Restore Session
    ↓
Phase 8: Create Initial Terminals (If Needed)
```

### ✅ Recommended Implementation

```typescript
// WebView Side (main.ts)
async function initializeWebView(): Promise<void> {
  // Phase 1: DOM Ready Check
  if (!waitForDomReady()) {
    setTimeout(() => initializeWebView(), 100);
    return;
  }

  // Phase 2: Create Managers (Don't Start)
  const terminalManager = new TerminalWebviewManager();

  // Phase 3: Register Event Listeners
  setupMessageListeners(terminalManager);
  setupErrorHandlers();

  // Phase 4: Handshake with Extension
  await handshakeWithExtension();

  // Phase 5: (HTML already loaded by Extension)

  // Phase 6: Start Managers
  await terminalManager.initialize();

  // Phase 7: Restore Session (If Available)
  const sessionRestored = await restoreSession();

  // Phase 8: Create Initial Terminals (Only If No Session)
  if (!sessionRestored) {
    await createInitialTerminals();
  }
}

// Extension Side (SecondaryTerminalProvider.ts)
public resolveWebviewView(webviewView: vscode.WebviewView): void {
  // 1. Configure WebView Options
  this._configureWebview(webviewView);

  // 2. Register Message Listeners (BEFORE HTML)
  this._registerWebviewMessageListener(webviewView);

  // 3. Initialize Message Handlers
  this._initializeMessageHandlers();

  // 4. Set HTML (AFTER Listeners)
  this._initializeWebviewContent(webviewView);

  // 5. Register Additional Listeners
  this._registerVisibilityListener(webviewView);
  this._setupPanelLocationChangeListener(webviewView);
}
```

### ✅ Handshake Protocol

```typescript
// WebView Side
async function handshakeWithExtension(): Promise<void> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.data.command === 'extensionReady') {
        window.removeEventListener('message', handler);
        resolve();
      }
    };

    window.addEventListener('message', handler);

    // Send ready signal
    vscode.postMessage({
      command: 'webviewReady',
      timestamp: Date.now()
    });

    // Timeout fallback
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(); // Proceed anyway
    }, 10000);
  });
}

// Extension Side
private _handleWebviewReady(message: WebviewMessage): void {
  // Send acknowledgment
  await this._sendMessage({
    command: 'extensionReady',
    timestamp: Date.now(),
    initialState: this._terminalManager.getCurrentState()
  });

  // THEN initialize
  await this._initializationCoordinator.initialize();
}
```

### ❌ Anti-Pattern: Timeout-Based Initialization

```typescript
// ❌ BAD: Assumes Extension is ready after arbitrary timeout
terminalManager.postMessageToExtension({ command: 'webviewReady' });

setTimeout(() => {
  // What if Extension takes longer than 500ms?
  terminalManager.requestLatestState();
}, 500);

// ✅ GOOD: Wait for acknowledgment
await handshakeWithExtension();
terminalManager.requestLatestState();
```

---

## 2. メッセージ通信パターン

### VS Code Pattern: Message Queuing

```typescript
class WebViewCommunicationService {
  private _messageQueue: WebviewMessage[] = [];
  private _isWebViewReady = false;

  async sendMessage(message: WebviewMessage): Promise<void> {
    if (!this._isWebViewReady) {
      // Queue message if WebView not ready
      this._messageQueue.push(message);
      log(`📬 [QUEUE] Message queued: ${message.command}`);
      return;
    }

    // Send immediately
    await this._view?.webview.postMessage(message);
  }

  setWebViewReady(): void {
    this._isWebViewReady = true;

    // Flush queue
    log(`📤 [QUEUE] Flushing ${this._messageQueue.length} queued messages`);
    while (this._messageQueue.length > 0) {
      const message = this._messageQueue.shift();
      await this._view?.webview.postMessage(message);
    }
  }
}
```

### ✅ Request-Response Pattern

```typescript
interface MessageWithId extends WebviewMessage {
  messageId: string;
  requiresResponse?: boolean;
}

class ReliableMessageService {
  private _pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>();

  async sendRequestWithResponse<T>(
    message: WebviewMessage,
    timeoutMs = 5000
  ): Promise<T> {
    const messageId = generateUniqueId();
    const messageWithId: MessageWithId = {
      ...message,
      messageId,
      requiresResponse: true
    };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingRequests.delete(messageId);
        reject(new Error(`Request timeout: ${message.command}`));
      }, timeoutMs);

      this._pendingRequests.set(messageId, { resolve, reject, timeout });
      this._sendMessage(messageWithId);
    });
  }

  handleResponse(response: MessageWithId): void {
    const pending = this._pendingRequests.get(response.messageId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(response);
      this._pendingRequests.delete(response.messageId);
    }
  }
}

// Usage
const scrollbackData = await messageService.sendRequestWithResponse({
  command: 'requestScrollback',
  terminalId: 'terminal-1',
  limit: 1000
});
```

### ✅ Message Batching

```typescript
class OutputBatcher {
  private _buffer: string[] = [];
  private _flushTimeout: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL = 16; // 60fps

  addOutput(data: string): void {
    this._buffer.push(data);

    if (!this._flushTimeout) {
      this._flushTimeout = setTimeout(() => {
        this._flush();
      }, this.FLUSH_INTERVAL);
    }
  }

  private _flush(): void {
    if (this._buffer.length === 0) return;

    const combinedOutput = this._buffer.join('');
    this._buffer = [];
    this._flushTimeout = null;

    this._sendMessage({
      command: 'output',
      data: combinedOutput
    });
  }
}
```

---

## 3. プロンプト重複防止

### VS Code Pattern: Terminal Initialization Handshake

```
Extension                    WebView
    |                           |
    | terminalCreated           |
    |-------------------------->|
    |                           | (Create xterm.js instance)
    |                           | (Wait for xterm.open())
    |                           |
    |  terminalInitializationComplete
    |<--------------------------|
    |                           |
    | (Start PTY → WebView)     |
    |                           |
    | output                    |
    |-------------------------->|
    |                           | (Shell prompt appears ONCE)
```

### ✅ Implementation

```typescript
// Extension Side
private async _handleTerminalCreated(terminalId: string): Promise<void> {
  const config = getTerminalConfig();

  // Send creation message to WebView
  await this._sendMessage({
    command: 'terminalCreated',
    terminalId,
    config
  });

  // ❌ DON'T START PTY HERE!
  // Wait for WebView to confirm initialization
}

private async _handleTerminalInitializationComplete(
  message: WebviewMessage
): Promise<void> {
  const terminalId = message.terminalId;
  const terminal = this._terminalManager.getTerminal(terminalId);

  if (!terminal || !terminal.ptyProcess) {
    return;
  }

  // ✅ NOW start shell initialization
  this._terminalManager.initializeShellForTerminal(
    terminalId,
    terminal.ptyProcess,
    true  // Safe mode: skip shell integration
  );
}

// WebView Side
function handleTerminalCreated(message: WebviewMessage): void {
  const xterm = new Terminal();
  xterm.open(containerElement);

  // ✅ Confirm ready AFTER xterm.open()
  vscode.postMessage({
    command: 'terminalInitializationComplete',
    terminalId: message.terminalId
  });
}
```

### ❌ Anti-Pattern: Starting PTY Too Early

```typescript
// ❌ BAD: Start PTY before WebView confirms ready
const terminal = createTerminal();
terminal.ptyProcess.start();  // Output will be lost!

await sendMessage({
  command: 'terminalCreated',
  terminalId: terminal.id
});

// ✅ GOOD: Wait for confirmation
await sendMessage({
  command: 'terminalCreated',
  terminalId: terminal.id
});

// Wait for WebView confirmation
await waitForMessage('terminalInitializationComplete');

// NOW start PTY
terminal.ptyProcess.start();
```

---

## 4. パネル位置検出

### VS Code Pattern: Layout Service Integration

VS Codeは**LayoutService**でパネル位置を管理します。

WebViewコンテキストでは**Layout APIにアクセスできない**ため、**ヒューリスティック検出**を使用:

```typescript
// Aspect Ratio Heuristic
const ASPECT_RATIO_THRESHOLD = 1.2;

function detectPanelLocation(): 'sidebar' | 'panel' {
  const aspectRatio = window.innerWidth / window.innerHeight;
  return aspectRatio > ASPECT_RATIO_THRESHOLD ? 'panel' : 'sidebar';
}
```

### ✅ ResizeObserver Implementation

```typescript
function setupPanelLocationMonitoring(): void {
  let previousAspectRatio: number | null = null;
  let isInitialized = false;
  const ASPECT_RATIO_THRESHOLD = 1.2;

  const resizeObserver = new ResizeObserver((entries) => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (width === 0 || height === 0) return;

    const aspectRatio = width / height;
    const isPanelLocation = aspectRatio > ASPECT_RATIO_THRESHOLD;
    const detectedLocation = isPanelLocation ? 'panel' : 'sidebar';

    // Initial detection
    if (!isInitialized) {
      previousAspectRatio = aspectRatio;
      isInitialized = true;

      reportPanelLocation(detectedLocation);
      return;
    }

    // Detect threshold crossing
    if (previousAspectRatio !== null) {
      const wasPanelLocation = previousAspectRatio > ASPECT_RATIO_THRESHOLD;

      if (wasPanelLocation !== isPanelLocation) {
        // Location changed!
        reportPanelLocation(detectedLocation);
      }
    }

    previousAspectRatio = aspectRatio;
  });

  resizeObserver.observe(document.body);
}
```

### ✅ Auto-Relayout

```typescript
// Extension Side
private async _handleReportPanelLocation(message: WebviewMessage): Promise<void> {
  const terminalCount = this._terminalManager.getTerminals().length;

  if (terminalCount >= 2) {
    const splitDirection = message.location === 'panel' ? 'vertical' : 'horizontal';

    await this._communicationService.sendMessage({
      command: 'relayoutTerminals',
      direction: splitDirection,
    });
  }
}

// WebView Side
function handleRelayoutTerminals(message: WebviewMessage): void {
  const container = document.getElementById('terminal-container');
  if (!container) return;

  // Update flex direction
  container.style.flexDirection = message.direction === 'vertical' ? 'row' : 'column';

  // Resize all terminals
  for (const terminal of terminals) {
    terminal.xterm.fit();
  }
}
```

---

## 5. エラーハンドリング

### VS Code Pattern: Error Boundaries

```typescript
// Extension Side
private _handleWebviewSetupError(webviewView: vscode.WebviewView, error: unknown): void {
  try {
    const errorHtml = this._htmlGenerationService.generateErrorHtml({
      error,
      allowRetry: true,
      customMessage: 'Terminal initialization failed. Please try reloading.'
    });

    webviewView.webview.html = errorHtml;
    TerminalErrorHandler.handleWebviewError(error);
  } catch (fallbackError) {
    // Last resort
    webviewView.webview.html = '<html><body><h3>Critical Error</h3></body></html>';
  }
}

// WebView Side
window.addEventListener('error', (event) => {
  error_category('Global error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
  });

  // Send error report to Extension
  vscode.postMessage({
    command: 'reportError',
    error: {
      message: event.message,
      stack: event.error?.stack
    }
  });
});

window.addEventListener('unhandledrejection', (event) => {
  error_category('Unhandled promise rejection:', event.reason);

  vscode.postMessage({
    command: 'reportError',
    error: {
      message: 'Unhandled Promise Rejection',
      reason: event.reason
    }
  });

  event.preventDefault();
});
```

---

## 6. パフォーマンス最適化

### VS Code Pattern: Output Buffering

```typescript
// ✅ CURRENT IMPLEMENTATION (PerformanceManager)
private readonly BUFFER_FLUSH_INTERVAL = 16;  // 60fps for normal output
private readonly CLI_AGENT_FLUSH_INTERVAL = 4; // 250fps for AI agents
```

**Assessment**: ✅ Optimal for terminal output

### VS Code Pattern: Redundant Update Guards

```typescript
// ✅ GOOD: Avoid unnecessary DOM updates
function updateFlexDirection(direction: 'row' | 'column'): boolean {
  const container = document.getElementById('terminal-container');
  const currentDirection = container.style.flexDirection;

  if (currentDirection === direction) {
    return false; // No update needed
  }

  container.style.flexDirection = direction;
  return true; // Updated
}
```

---

## 7. テスト戦略

### Unit Tests

```typescript
describe('Panel Location Detection', () => {
  it('detects sidebar for tall dimensions', () => {
    mockWindowSize(300, 800);
    expect(detectPanelLocation()).toBe('sidebar');
  });

  it('detects panel for wide dimensions', () => {
    mockWindowSize(1200, 300);
    expect(detectPanelLocation()).toBe('panel');
  });

  it('handles threshold edge case', () => {
    mockWindowSize(1200, 1000); // ratio = 1.2
    expect(detectPanelLocation()).toBe('panel');
  });
});
```

### Integration Tests

```typescript
describe('Terminal Initialization', () => {
  it('completes handshake before creating terminals', async () => {
    const provider = new SecondaryTerminalProvider();
    const spy = jest.spyOn(provider, '_sendMessage');

    // Simulate webviewReady
    await provider._handleWebviewMessage({ command: 'webviewReady' });

    // Verify extensionReady sent
    expect(spy).toHaveBeenCalledWith({
      command: 'extensionReady',
      initialState: expect.any(Object)
    });
  });
});
```

---

## 8. 実装チェックリスト

### Phase 1: Core Initialization ✅

- [x] DOM ready detection
- [x] Message listeners registered before HTML
- [x] Handshake protocol implemented
- [x] Error boundaries in place
- [x] Initialization state tracking

### Phase 2: Message Communication ✅

- [x] Message queuing (WebView not ready)
- [x] Type guards for validation
- [x] Output batching/throttling
- [ ] Request-response pattern (Priority: Medium)
- [ ] Message priority queue (Priority: Low)

### Phase 3: Terminal Lifecycle ✅

- [x] Prompt duplication prevention
- [x] Terminal initialization handshake
- [x] PTY lifecycle management
- [x] Session restoration
- [x] Graceful cleanup

### Phase 4: Panel Location ✅

- [x] ResizeObserver detection
- [x] Aspect ratio heuristic
- [x] Threshold crossing detection
- [x] Auto-relayout on location change
- [x] Context key integration

### Phase 5: Reliability ⚠️

- [x] Error handling
- [x] Fallback HTML
- [ ] Circuit breaker (Priority: Medium)
- [ ] Retry logic with backoff (Priority: Low)
- [ ] Performance monitoring (Priority: Low)

---

## Quick Reference

### Initialization Order (Critical)

```
1. Configure WebView Options
2. Register Message Listeners ← BEFORE HTML!
3. Initialize Message Handlers
4. Set HTML
5. Register Additional Listeners
```

### Message Communication Best Practices

```
✅ Queue messages when WebView not ready
✅ Use type guards for validation
✅ Batch high-frequency output
✅ Implement handshake protocol
❌ Don't send messages before listeners ready
❌ Don't use arbitrary timeouts
```

### Prompt Duplication Prevention

```
Extension: Send 'terminalCreated'
   ↓
WebView: Create xterm, call xterm.open()
   ↓
WebView: Send 'terminalInitializationComplete'
   ↓
Extension: Start PTY output → WebView
   ↓
Shell prompt appears ONCE
```

### Panel Location Detection

```
Aspect Ratio > 1.2 → Panel (bottom)
Aspect Ratio < 1.2 → Sidebar (left/right)

Use ResizeObserver for changes
Report to Extension for state sync
Auto-relayout when location changes
```

---

## Related Documentation

- [Terminal Initialization Patterns](./vscode-terminal-initialization-patterns.md)
- [WebView Message Patterns](./vscode-webview-message-patterns.md)
- [Panel Location Patterns](./vscode-panel-location-patterns.md)

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-05 | Initial comprehensive guide |

**Maintained By**: VS Code Sidebar Terminal Project
**Last Review**: 2025-11-05
