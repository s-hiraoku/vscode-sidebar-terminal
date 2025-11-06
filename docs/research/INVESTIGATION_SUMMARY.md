# VS Code Terminal Initialization Investigation - Summary Report

**Investigation Date**: 2025-11-05
**Status**: ✅ Complete
**Deliverables**: 4 comprehensive research documents

---

## 📊 Executive Summary

VS Code標準ターミナルの初期化シーケンスを調査し、以下の重要パターンを特定しました:

1. **Phase-Based Initialization**: VS Codeは複数フェーズで初期化（BlockStartup → AfterRestored）
2. **Listener-First Pattern**: メッセージリスナーを HTML 設定**前**に登録（critical）
3. **Handshake Protocol**: Extension ↔ WebView の双方向確認で初期化完了を保証
4. **Terminal Lifecycle Handshake**: WebView準備完了後にPTYを開始してプロンプト重複を防止
5. **ResizeObserver + Aspect Ratio**: パネル位置検出の最適解（WebView context制約下）

---

## 📁 Generated Documentation

### 1. [Terminal Initialization Patterns](./vscode-terminal-initialization-patterns.md)

**Focus**: 初期化シーケンス、タイミング、完了判定

**Key Findings**:
- ✅ Current project follows Listener-First pattern correctly
- ⚠️ Timeout-based initialization needs replacement with handshake protocol
- ✅ Prompt duplication prevention via handshake is excellent

**Recommendations**:
1. **Priority 1**: Implement Extension acknowledgment for `webviewReady`
2. **Priority 2**: Replace arbitrary timeouts with event-based triggers
3. **Priority 3**: Create centralized initialization state tracker

### 2. [WebView Message Patterns](./vscode-webview-message-patterns.md)

**Focus**: Extension ↔ WebView 通信パターン、メッセージキュー管理

**Key Findings**:
- ✅ Message queuing implemented correctly
- ✅ Output batching follows VS Code pattern (16ms flush interval)
- ⚠️ No request-response pattern for scrollback data requests

**Recommendations**:
1. **Priority 1**: Add handshake protocol (Extension → `extensionReady` acknowledgment)
2. **Priority 2**: Implement request-response pattern for scrollback
3. **Priority 3**: Consider message priority queue for future enhancement

### 3. [Panel Location Patterns](./vscode-panel-location-patterns.md)

**Focus**: パネル位置検出、動的レイアウト適応 (Issue #148)

**Key Findings**:
- ✅ ResizeObserver + aspect ratio heuristic is optimal for WebView context
- ✅ Threshold = 1.2 provides reliable sidebar/panel distinction
- ✅ Auto-relayout on location change creates seamless UX

**Recommendations**:
1. Current implementation is **production-ready**
2. Add automated tests for detection logic
3. Consider transition animations for smoother relayout

### 4. [Best Practices Guide](./TERMINAL_INITIALIZATION_BEST_PRACTICES.md)

**Focus**: 統合ガイド、実装チェックリスト、クイックリファレンス

**Contents**:
- ✅ Initialization sequence best practices
- ✅ Message communication patterns
- ✅ Prompt duplication prevention
- ✅ Panel location detection
- ✅ Error handling and performance optimization
- ✅ Testing strategy
- ✅ Implementation checklist

---

## 🎯 Critical Patterns Identified

### Pattern 1: Listener-First (CRITICAL)

```typescript
// ✅ CORRECT: Current implementation
public resolveWebviewView(webviewView: vscode.WebviewView): void {
  // 1. Register listeners FIRST
  webviewView.webview.onDidReceiveMessage(handler);

  // 2. THEN set HTML
  webviewView.webview.html = this._getHtmlForWebview();
}
```

**Why Critical**: Messages sent during HTML load are **lost** if listeners not registered.

### Pattern 2: Handshake Protocol (HIGH PRIORITY)

```
Extension                          WebView
    |                                 |
    |        webviewReady             |
    |<--------------------------------|
    |                                 |
    | extensionReady + initial state  |
    |-------------------------------->|
    |                                 |
```

**Current Gap**: Extension doesn't send `extensionReady` acknowledgment.

**Impact**: WebView uses arbitrary 500ms timeout instead of waiting for Extension ready signal.

### Pattern 3: Terminal Initialization Handshake (EXCELLENT)

```
Extension                    WebView
    |                           |
    | terminalCreated           |
    |-------------------------->|
    |                           | (xterm.open())
    |                           |
    | terminalInitializationComplete
    |<--------------------------|
    |                           |
    | (Start PTY)               |
```

**Status**: ✅ Already implemented correctly in project.

**Result**: No prompt duplication issues.

### Pattern 4: ResizeObserver for Panel Detection (OPTIMAL)

```typescript
const ASPECT_RATIO_THRESHOLD = 1.2;

const resizeObserver = new ResizeObserver(() => {
  const aspectRatio = window.innerWidth / window.innerHeight;
  const location = aspectRatio > ASPECT_RATIO_THRESHOLD ? 'panel' : 'sidebar';

  reportPanelLocation(location);
});

resizeObserver.observe(document.body);
```

**Status**: ✅ Already implemented correctly in project.

**Why Optimal**: WebView has no access to VS Code Layout API, heuristic is the best solution.

---

## 📈 Current Implementation Assessment

### ✅ Strengths

| Pattern | Status | Notes |
|---------|--------|-------|
| **Listener-First** | ✅ Excellent | Correctly registers listeners before HTML |
| **Message Queuing** | ✅ Good | Prevents message loss during initialization |
| **Output Batching** | ✅ Excellent | 16ms flush interval matches VS Code |
| **Prompt Prevention** | ✅ Excellent | Handshake protocol prevents duplicates |
| **Panel Detection** | ✅ Excellent | ResizeObserver + aspect ratio is optimal |
| **Error Handling** | ✅ Good | Error boundaries and fallback HTML |

### ⚠️ Areas for Improvement

| Pattern | Priority | Recommendation |
|---------|----------|----------------|
| **Handshake Protocol** | **High** | Add Extension → `extensionReady` acknowledgment |
| **Request-Response** | **Medium** | Implement for scrollback data requests |
| **Timeout Removal** | **Medium** | Replace arbitrary timeouts with events |
| **Message Priority** | **Low** | Consider priority queue for future |
| **Circuit Breaker** | **Low** | Add for resilience (nice-to-have) |

---

## 🚀 Recommended Next Steps

### Phase 1: Critical Improvements (High Priority)

#### 1.1 Implement Handshake Protocol

**File**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/webview/main.ts`

```typescript
// Add before line 88
async function waitForExtensionReady(): Promise<void> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.data.command === 'extensionReady') {
        window.removeEventListener('message', handler);
        resolve();
      }
    };

    window.addEventListener('message', handler);

    vscode.postMessage({
      command: 'webviewReady',
      timestamp: Date.now()
    });

    // Timeout fallback
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve();
    }, 10000);
  });
}

// Replace lines 88-110
async function initializeWebView(): Promise<void> {
  // ... existing DOM check ...

  terminalManager = new LightweightTerminalWebviewManager();
  terminalManager.initializeSimpleTerminal();

  // Wait for Extension acknowledgment
  await waitForExtensionReady();

  // NOW proceed with state requests (no timeout needed)
  terminalManager.requestLatestState();
  terminalManager.postMessageToExtension({
    command: 'requestSessionRestore',
    timestamp: Date.now(),
  });
}
```

**File**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/providers/SecondaryTerminalProvider.ts`

```typescript
// Update _handleWebviewReady (line 424)
private _handleWebviewReady(_message: WebviewMessage): void {
  if (this._isInitialized) {
    return;
  }

  this._isInitialized = true;

  // Send acknowledgment FIRST
  void this._sendMessage({
    command: 'extensionReady',
    timestamp: Date.now(),
    initialState: this._terminalManager.getCurrentState()
  });

  // Send version info
  this._sendVersionInfo();

  // THEN initialize
  void this._initializationCoordinator.initialize();
}
```

**Estimated Effort**: 1-2 hours

#### 1.2 Remove Arbitrary Timeouts

Replace all timeout-based logic in `main.ts`:
- Line 63-75: Remove emergency terminal creation timeout
- Line 97-110: Already fixed by handshake protocol above

**Estimated Effort**: 30 minutes

### Phase 2: Enhanced Reliability (Medium Priority)

#### 2.1 Implement Request-Response Pattern

**File**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/services/webview/WebViewCommunicationService.ts`

Add new method:
```typescript
async sendRequestWithResponse<T>(
  message: WebviewMessage,
  timeoutMs = 5000
): Promise<T> {
  const messageId = generateUniqueId();
  // ... implementation from message patterns doc ...
}
```

**Use Case**: Scrollback data requests (currently uses polling)

**Estimated Effort**: 2-3 hours

### Phase 3: Testing and Validation (Medium Priority)

#### 3.1 Add Integration Tests

```typescript
// New file: src/test/integration/terminal-initialization.test.ts
describe('Terminal Initialization Integration', () => {
  it('completes handshake before state requests', async () => {
    // Test handshake protocol
  });

  it('prevents prompt duplication', async () => {
    // Test terminal lifecycle handshake
  });

  it('detects panel location correctly', async () => {
    // Test ResizeObserver detection
  });
});
```

**Estimated Effort**: 4-6 hours

---

## 📊 Impact Analysis

### High Priority Changes (Phase 1)

| Change | Benefit | Risk | Effort |
|--------|---------|------|--------|
| **Handshake Protocol** | Eliminates timing issues | Low (backward compatible) | 1-2h |
| **Remove Timeouts** | More reliable initialization | Low (improved robustness) | 30min |

**Total Estimated Effort**: 2-3 hours
**Expected ROI**: High (eliminates root cause of initialization race conditions)

### Medium Priority Changes (Phase 2-3)

| Change | Benefit | Risk | Effort |
|--------|---------|------|--------|
| **Request-Response** | Reliable scrollback requests | Low (optional feature) | 2-3h |
| **Integration Tests** | Catch regressions early | None | 4-6h |

**Total Estimated Effort**: 6-9 hours
**Expected ROI**: Medium (improves resilience and maintainability)

---

## 🎓 Key Learnings

### 1. Listener-First is Non-Negotiable

**Learning**: Message listeners MUST be registered before HTML is set.

**Why**: Messages sent during HTML load are lost otherwise.

**Current Status**: ✅ Project already follows this pattern.

### 2. Handshakes Eliminate Race Conditions

**Learning**: Bidirectional handshakes eliminate timing assumptions.

**Why**: Arbitrary timeouts (500ms, 2s) are fragile and break under load.

**Current Status**: ⚠️ Terminal lifecycle handshake exists, but Extension → WebView handshake missing.

### 3. ResizeObserver is the Right Tool

**Learning**: ResizeObserver is optimal for dimension-based detection.

**Why**: Native browser API, fires at optimal timing, no polling overhead.

**Current Status**: ✅ Project uses ResizeObserver correctly.

### 4. VS Code Patterns are Battle-Tested

**Learning**: Following VS Code patterns provides:
- Proven reliability (millions of users)
- Performance optimization (years of refinement)
- Future compatibility (alignment with VS Code evolution)

**Current Status**: ✅ Project follows most VS Code patterns already.

---

## 📚 Reference Architecture

### Complete Initialization Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    VS CODE STARTUP                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Extension: SecondaryTerminalProvider.resolveWebviewView()  │
│  1. Configure WebView Options                               │
│  2. Register Message Listeners ◄── CRITICAL: Before HTML    │
│  3. Initialize Message Handlers                             │
│  4. Set HTML                                                │
│  5. Register Visibility Listener                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  WebView: HTML Loaded, JavaScript Executes                  │
│  1. DOM Ready Check                                         │
│  2. Create Managers (Don't Start)                           │
│  3. Send 'webviewReady' to Extension                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Extension: Receives 'webviewReady'                         │
│  1. Send 'extensionReady' + Initial State                   │
│  2. Start Initialization Coordinator                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  WebView: Receives 'extensionReady'                         │
│  1. Start Managers                                          │
│  2. Request Session Restore                                 │
│  3. Setup Panel Location Monitoring                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Extension: Session Restore or Terminal Creation            │
│  1. Restore Session (if available)                          │
│  2. OR Create Initial Terminals                             │
│  3. Send 'terminalCreated' to WebView                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  WebView: Terminal Initialization                           │
│  1. Create xterm.js instance                                │
│  2. Call xterm.open(container)                              │
│  3. Send 'terminalInitializationComplete'                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Extension: Start PTY → WebView Output                      │
│  1. Initialize shell for terminal                           │
│  2. Start PTY process                                       │
│  3. Shell prompt appears ONCE                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  ✅ TERMINAL READY FOR USER INTERACTION                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Conclusion

### Current Implementation Quality: ⭐⭐⭐⭐☆ (4/5)

**Strengths**:
- ✅ Listener-First pattern implemented correctly
- ✅ Terminal lifecycle handshake prevents prompt duplication
- ✅ Panel location detection is optimal for WebView context
- ✅ Output batching matches VS Code performance
- ✅ Error handling with fallback HTML

**Missing Pieces**:
- ⚠️ Extension → WebView handshake acknowledgment
- ⚠️ Timeout-based initialization logic
- ⚠️ Request-response pattern for scrollback

### With Phase 1 Improvements: ⭐⭐⭐⭐⭐ (5/5)

Adding the handshake protocol and removing timeouts will bring the implementation to **production-grade** quality, fully aligned with VS Code standard patterns.

---

## 📞 Contact & Support

For questions about this investigation or implementation guidance:

- **Research Documentation**: `/docs/research/`
- **Implementation Files**:
  - `src/webview/main.ts`
  - `src/providers/SecondaryTerminalProvider.ts`
  - `src/services/webview/WebViewCommunicationService.ts`
- **Issue Tracker**: GitHub Issues

---

## 📝 Appendix: File Locations

| Document | Path |
|----------|------|
| **This Summary** | `/docs/research/INVESTIGATION_SUMMARY.md` |
| **Initialization Patterns** | `/docs/research/vscode-terminal-initialization-patterns.md` |
| **Message Patterns** | `/docs/research/vscode-webview-message-patterns.md` |
| **Panel Location Patterns** | `/docs/research/vscode-panel-location-patterns.md` |
| **Best Practices Guide** | `/docs/research/TERMINAL_INITIALIZATION_BEST_PRACTICES.md` |

---

**Investigation Completed**: 2025-11-05
**Next Review Date**: After Phase 1 implementation
**Status**: ✅ Ready for Implementation
