# VS Code Terminal Initialization Patterns - Research Report

## 調査概要

VS Code標準ターミナルの初期化シーケンスをリバースエンジニアリングし、プロジェクトのWebView実装に適用可能なパターンを特定。

**調査日**: 2025-11-05
**対象バージョン**: VS Code 1.x (main branch)
**調査対象ファイル**:
- `src/vs/workbench/contrib/terminal/browser/terminal.contribution.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalView.ts` (アクセス制限)
- `src/vs/workbench/contrib/terminal/browser/terminalInstance.ts` (アクセス制限)
- プロジェクト実装ファイル (`main.ts`, `SecondaryTerminalProvider.ts`)

---

## 1. 初期化タイミング (Initialization Timing)

### VS Code Pattern: Workbench Phase System

```typescript
// From terminal.contribution.ts (Lines 66-68)
registerWorkbenchContribution2(
  TerminalMainContribution.ID,
  TerminalMainContribution,
  WorkbenchPhase.BlockStartup  // 🎯 CRITICAL: Blocks startup
);

registerWorkbenchContribution2(
  RemoteTerminalBackendContribution.ID,
  RemoteTerminalBackendContribution,
  WorkbenchPhase.AfterRestored  // ⏰ DELAYED: After workspace restore
);
```

**Key Insight**: VS Code uses **multiple initialization phases**:
1. **BlockStartup**: Critical terminal API initialization (window.createTerminal)
2. **AfterRestored**: Non-critical features (remote terminals, telemetry)

### Current Project Implementation

```typescript
// main.ts (Lines 37-194)
async function initializeWebView(): Promise<void> {
  // ✅ GOOD: DOM ready check
  const terminalBody = document.getElementById('terminal-body');
  if (!terminalBody) {
    setTimeout(() => initializeWebView(), 100);  // Retry pattern
    return;
  }

  // ❌ ISSUE: Immediate terminal manager initialization
  terminalManager = new LightweightTerminalWebviewManager();
  terminalManager.initializeSimpleTerminal();

  // ❌ ISSUE: Emergency terminal creation after 2s timeout
  setTimeout(() => {
    if (terminalManager && terminalManager.getAllTerminalInstances().size === 0) {
      terminalManager.postMessageToExtension({
        command: 'requestInitialTerminal',
        timestamp: Date.now(),
      });
    }
  }, 2000);
}
```

**Problems Identified**:
1. **No Phase Separation**: All initialization happens at once
2. **Timeout-Based Logic**: Relies on arbitrary 2-second wait
3. **Race Condition Risk**: Extension may not be ready when WebView sends messages

---

## 2. メッセージ送信パターン (Extension → WebView Communication)

### VS Code Pattern: Service-Based Architecture

```typescript
// VS Code uses singleton services with dependency injection
registerSingleton(ITerminalService, TerminalService, InstantiationType.Delayed);
registerSingleton(ITerminalEditorService, TerminalEditorService, InstantiationType.Delayed);
```

**Key Principles**:
- **Lazy Initialization**: Services instantiated only when needed
- **Dependency Injection**: Services receive dependencies through constructor
- **Event-Driven**: Services emit events, consumers subscribe

### Current Project Implementation

```typescript
// SecondaryTerminalProvider.ts (Lines 135-161)
public resolveWebviewView(
  webviewView: vscode.WebviewView,
  _context: vscode.WebviewViewResolveContext,
  _token: vscode.CancellationToken
): void {
  try {
    // ✅ GOOD: Reset state for new view
    this._resetForNewView(webviewView);

    // ✅ GOOD: Configure options BEFORE listeners
    this._configureWebview(webviewView);

    // ✅ EXCELLENT: Register message listener BEFORE HTML
    this._registerWebviewMessageListener(webviewView);

    // ✅ GOOD: Initialize handlers before content
    this._initializeMessageHandlers();

    // ✅ GOOD: HTML set AFTER listeners
    this._initializeWebviewContent(webviewView);
  } catch (error) {
    this._handleWebviewSetupError(webviewView, error);
  }
}
```

**Best Practices Identified**:
1. **Listener-First Pattern**: Message listeners MUST be registered before HTML
2. **Error Boundaries**: Centralized error handling prevents total failure
3. **State Reset**: Clean slate for panel moves/reopens

---

## 3. プロンプト表示制御 (Multiple Prompt Prevention)

### VS Code Pattern: Shell Integration Sequence

VS Code prevents multiple prompts through:
1. **PTY Process Lifecycle States**: Track process readiness
2. **Shell Integration Scripts**: Injected before first prompt
3. **Deferred Input**: User input queued until shell ready

### Current Project Implementation

```typescript
// SecondaryTerminalProvider.ts (Lines 651-676)
private async _handleTerminalInitializationComplete(message: WebviewMessage): Promise<void> {
  const terminalId = message.terminalId as string;

  // ✅ EXCELLENT: Wait for WebView terminal ready signal
  const terminal = this._terminalManager.getTerminal(terminalId);
  if (!terminal || !terminal.ptyProcess) {
    return;
  }

  // ✅ GOOD: Start shell initialization AFTER WebView confirms ready
  this._terminalManager.initializeShellForTerminal(
    terminalId,
    terminal.ptyProcess,
    true  // Safe mode: skip shell integration
  );
}
```

**Key Pattern**: **Handshake Protocol**
1. WebView creates xterm.js instance
2. WebView sends `terminalInitializationComplete` to Extension
3. Extension starts PTY output → WebView
4. Shell prompt appears **once**

**Anti-Pattern to Avoid**:
```typescript
// ❌ BAD: Starting PTY before WebView ready
const terminal = createTerminal();
terminal.ptyProcess.start();  // Output lost or duplicated!
```

---

## 4. Panel Location検出 (Panel Location Detection)

### VS Code Pattern: Layout Service Integration

VS Code uses a **centralized LayoutService** to track:
- Panel position (bottom, left, right)
- Panel visibility
- Panel dimensions

**Key Insight**: VS Code **DOES NOT** use ResizeObserver for panel detection. It uses:
1. **VS Code API**: `window.activePanel`, `window.visiblePanels`
2. **Layout Events**: `onDidChangePanelPosition`

### Current Project Implementation (Issue #148)

```typescript
// main.ts (Lines 247-395)
function setupPanelLocationMonitoring(): void {
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const aspectRatio = width / height;

      // 🎯 HEURISTIC: Aspect ratio threshold
      const ASPECT_RATIO_THRESHOLD = 1.2;
      const isPanelLocation = aspectRatio > ASPECT_RATIO_THRESHOLD;
      const detectedLocation = isPanelLocation ? 'panel' : 'sidebar';

      // Report to Extension
      terminalManager.postMessageToExtension({
        command: 'reportPanelLocation',
        location: detectedLocation,
        timestamp: Date.now(),
      });
    }
  });

  resizeObserver.observe(document.body);
}
```

**Assessment**:
- ✅ **Good**: Heuristic-based detection (aspect ratio)
- ⚠️ **Limitation**: Not using VS Code API (no access in WebView context)
- ✅ **Acceptable**: ResizeObserver is a valid fallback for WebViewViewProvider

**Recommendation**: Current approach is **correct** for WebViewViewProvider (no direct VS Code layout API access)

---

## 5. 初期化完了の判定 (Initialization Completion Detection)

### VS Code Pattern: Promise-Based Readiness

VS Code uses:
1. **Service Ready Promises**: Each service provides `whenReady()` method
2. **Lifecycle Phases**: Workbench tracks completion of each phase
3. **Event Aggregation**: Multiple services signal readiness via events

### Current Project Implementation

```typescript
// main.ts (Lines 88-110)
terminalManager.postMessageToExtension({
  command: 'webviewReady',
  timestamp: Date.now(),
});

setTimeout(() => {
  if (terminalManager) {
    terminalManager.requestLatestState();

    terminalManager.postMessageToExtension({
      command: 'requestSessionRestore',
      timestamp: Date.now(),
    });
  }
}, 500);  // ⚠️ Arbitrary 500ms delay
```

**Problems Identified**:
1. **No Acknowledgment**: Extension doesn't confirm `webviewReady` receipt
2. **Timeout-Based**: 500ms delay assumes Extension is ready
3. **No Retry Logic**: If Extension isn't ready, requests are lost

**Recommended Pattern** (VS Code-inspired):
```typescript
// IMPROVED: Promise-based initialization
class WebViewInitializer {
  private _extensionReady = false;
  private _domReady = false;

  async waitForReady(): Promise<void> {
    await Promise.all([
      this.waitForDomReady(),
      this.waitForExtensionReady()
    ]);
  }

  private async waitForExtensionReady(): Promise<void> {
    return new Promise((resolve) => {
      const handler = (message) => {
        if (message.command === 'extensionReady') {
          this._extensionReady = true;
          resolve();
        }
      };

      window.addEventListener('message', handler);

      // Request Extension to send ready signal
      vscode.postMessage({ command: 'webviewReady' });
    });
  }
}
```

---

## Best Practices Summary

### 1. Initialization Sequence

```typescript
// ✅ RECOMMENDED ORDER (VS Code Pattern)
async function initializeWebView() {
  // Phase 1: DOM Ready
  await waitForDomReady();

  // Phase 2: Create Managers (but don't start)
  const terminalManager = new TerminalWebviewManager();

  // Phase 3: Set up event listeners
  setupMessageListeners();

  // Phase 4: Handshake with Extension
  await handshakeWithExtension();

  // Phase 5: Start managers
  await terminalManager.initialize();

  // Phase 6: Restore session (if available)
  await restoreSession();

  // Phase 7: Create initial terminals (if needed)
  await createInitialTerminals();
}
```

### 2. Message Listener Setup (Extension Side)

```typescript
// ✅ EXCELLENT: Current implementation
public resolveWebviewView(webviewView: vscode.WebviewView): void {
  // CRITICAL: Listeners BEFORE HTML
  webviewView.webview.onDidReceiveMessage((message) => {
    this._handleWebviewMessage(message);
  });

  // THEN: Set HTML
  webviewView.webview.html = this._getHtmlForWebview();
}
```

### 3. Prompt Duplication Prevention

```typescript
// ✅ EXCELLENT: Handshake pattern
// WebView side:
xterm.open(container);
vscode.postMessage({
  command: 'terminalInitializationComplete',
  terminalId: id
});

// Extension side:
private async _handleTerminalInitializationComplete(message) {
  const terminal = this._terminalManager.getTerminal(message.terminalId);

  // ONLY NOW start shell initialization
  this._terminalManager.initializeShellForTerminal(
    message.terminalId,
    terminal.ptyProcess
  );
}
```

### 4. Panel Location Detection

```typescript
// ✅ ACCEPTABLE: Heuristic-based (WebView has no Layout API access)
const ASPECT_RATIO_THRESHOLD = 1.2;
const detectPanelLocation = () => {
  const aspectRatio = window.innerWidth / window.innerHeight;
  return aspectRatio > ASPECT_RATIO_THRESHOLD ? 'panel' : 'sidebar';
};

// Use ResizeObserver for changes
const observer = new ResizeObserver(() => {
  const location = detectPanelLocation();
  vscode.postMessage({ command: 'reportPanelLocation', location });
});
observer.observe(document.body);
```

---

## Anti-Patterns to Avoid

### ❌ 1. Timeout-Based Initialization

```typescript
// ❌ BAD: Assumes Extension is ready
setTimeout(() => {
  vscode.postMessage({ command: 'requestInitialTerminal' });
}, 2000);  // What if Extension takes 3 seconds?
```

**Fix**: Use handshake protocol with acknowledgment.

### ❌ 2. HTML Before Listeners

```typescript
// ❌ BAD: Messages lost during HTML load
webviewView.webview.html = html;
webviewView.webview.onDidReceiveMessage(handler);  // Too late!
```

**Fix**: Register listeners BEFORE setting HTML.

### ❌ 3. Starting PTY Before WebView Ready

```typescript
// ❌ BAD: Output lost
const terminal = createTerminal();
terminal.ptyProcess.start();  // WebView not ready yet!

// Extension sends output → WebView
await sendMessage({ command: 'output', data: '...' });  // Lost!
```

**Fix**: Wait for `terminalInitializationComplete` from WebView.

### ❌ 4. No Initialization State Tracking

```typescript
// ❌ BAD: Can initialize multiple times
function initializeWebView() {
  // No check if already initialized
  const manager = new TerminalManager();
  manager.initialize();  // Called multiple times = duplicate terminals!
}
```

**Fix**: Track initialization state:
```typescript
private _isInitialized = false;

function initializeWebView() {
  if (this._isInitialized) return;
  this._isInitialized = true;
  // ... initialization logic
}
```

---

## Recommended Improvements for Project

### Priority 1: Handshake Protocol

Replace timeout-based initialization with handshake:

**Extension Side** (`SecondaryTerminalProvider.ts`):
```typescript
private _handleWebviewReady(message: WebviewMessage): void {
  // Send acknowledgment
  await this._sendMessage({
    command: 'extensionReady',
    timestamp: Date.now()
  });

  // THEN initialize
  await this._initializationCoordinator.initialize();
}
```

**WebView Side** (`main.ts`):
```typescript
async function initializeWebView() {
  // Wait for Extension acknowledgment
  await waitForExtensionReady();

  // THEN proceed with initialization
  terminalManager = new LightweightTerminalWebviewManager();
  await terminalManager.initialize();
}

function waitForExtensionReady(): Promise<void> {
  return new Promise((resolve) => {
    const handler = (event) => {
      if (event.data.command === 'extensionReady') {
        window.removeEventListener('message', handler);
        resolve();
      }
    };

    window.addEventListener('message', handler);

    // Send ready signal
    vscode.postMessage({ command: 'webviewReady' });
  });
}
```

### Priority 2: Remove Timeout-Based Logic

Replace all arbitrary timeouts with:
1. **Event-based triggers**: Wait for actual events
2. **Promise-based async**: Use async/await for sequencing
3. **Retry with backoff**: For resilience, not fixed delays

### Priority 3: Unified Initialization State

Create a centralized initialization state tracker:

```typescript
class InitializationCoordinator {
  private _phases = {
    domReady: false,
    extensionReady: false,
    managersCreated: false,
    sessionRestored: false,
    terminalsCreated: false
  };

  async initialize(): Promise<void> {
    await this.phase1_domReady();
    await this.phase2_extensionHandshake();
    await this.phase3_createManagers();
    await this.phase4_restoreSession();
    await this.phase5_createTerminals();
  }

  getProgress(): number {
    const completed = Object.values(this._phases).filter(Boolean).length;
    return (completed / Object.keys(this._phases).length) * 100;
  }
}
```

---

## Conclusion

### Current Implementation Assessment

| Aspect | Status | Note |
|--------|--------|------|
| **Listener-First Pattern** | ✅ Excellent | Correctly registers listeners before HTML |
| **Panel Location Detection** | ✅ Good | ResizeObserver approach is valid for WebView |
| **Prompt Prevention** | ✅ Excellent | Handshake protocol prevents duplicates |
| **Initialization Timing** | ⚠️ Needs Improvement | Timeout-based logic is fragile |
| **Message Queue** | ⚠️ Needs Improvement | No acknowledgment protocol |

### Recommended Next Steps

1. **Implement Handshake Protocol** (Priority 1)
   - Replace timeout-based initialization
   - Add Extension → WebView acknowledgment

2. **Create DomReadyDetector Utility** (Priority 2)
   - Centralize DOM ready detection logic
   - Add Promise-based API

3. **Refactor Initialization Coordinator** (Priority 3)
   - Use phase-based initialization (like VS Code)
   - Track progress and state

4. **Add Integration Tests** (Priority 4)
   - Test initialization sequence
   - Verify handshake protocol
   - Check panel location detection

---

## References

- VS Code Source: `terminal.contribution.ts` (Lines 66-139)
- Project Implementation: `main.ts` (Lines 37-472)
- Provider Implementation: `SecondaryTerminalProvider.ts` (Lines 135-2404)
- Issue #148: Dynamic split direction based on panel location

**Research By**: Claude Code (AI Assistant)
**Last Updated**: 2025-11-05
