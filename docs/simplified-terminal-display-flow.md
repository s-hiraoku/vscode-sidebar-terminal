# Simplified Terminal Display Flow Design

## Overview

This document describes the simplified terminal display flow based on VS Code's standard terminal implementation patterns.

## Current Issues

### 1. Over-Engineering
- **18+ Managers** in WebView causing complex initialization dependencies
- **11+ Message Handlers** with scattered logic
- **Multiple coordination layers** (TerminalOperationsCoordinator, ResizeCoordinator, etc.)
- **Redundant state management** in both Extension and WebView

### 2. Complex Message Flow
```
Current: Extension → WebViewCommunicationService → ConsolidatedMessageManager
         → TerminalLifecycleMessageHandler → TerminalLifecycleCoordinator
         → TerminalCreationService → SplitManager → UIManager → ...
```

### 3. Race Conditions
- Handshake protocol with multiple retry mechanisms
- Output gating with complex buffer management
- Initialization acknowledgment tracking

---

## VS Code Standard Pattern (Simplified)

### Key Principles from VS Code

1. **Barrier Pattern**: Simple Promise-based waiting for async operations
2. **Single Source of Truth**: State managed in one place
3. **Event-Driven**: Clear event flow without complex message routing
4. **Fail-Fast**: No complex retry mechanisms, just clear error states

### VS Code's Terminal Display Flow

```
1. TerminalService.createTerminal()
   └─> Creates TerminalInstance

2. TerminalInstance constructor
   └─> Creates XtermTerminal (async)
   └─> xtermReadyPromise resolves when ready

3. attachToElement(container)
   └─> xterm.open(element)
   └─> _attachBarrier.open()

4. PTY Process starts AFTER container ready
   └─> containerReadyBarrier.wait()
   └─> processManager.createProcess()

5. Data flows
   └─> PTY → TerminalInstance.onData → xterm.write()
```

---

## Proposed Simplified Architecture

### Phase 1: Simplified WebView Initialization

**New Entry Point: `SimpleTerminalWebView.ts`**

```typescript
/**
 * Simplified WebView Manager
 *
 * Responsibilities:
 * 1. VS Code API management
 * 2. Terminal instances (Map<string, XtermInstance>)
 * 3. Message handling (direct, no queue)
 * 4. UI updates (theme, focus)
 */
export class SimpleTerminalWebView {
  private readonly terminals = new Map<string, XtermInstance>();
  private activeTerminalId: string | null = null;
  private readonly vscodeApi: VSCodeAPI;

  constructor() {
    this.vscodeApi = acquireVsCodeApi();
    this.setupMessageListener();
    this.notifyReady();
  }

  private setupMessageListener(): void {
    window.addEventListener('message', (e) => this.handleMessage(e.data));
  }

  private handleMessage(msg: Message): void {
    switch (msg.command) {
      case 'createTerminal':
        this.createTerminal(msg.terminalId, msg.name, msg.config);
        break;
      case 'output':
        this.writeOutput(msg.terminalId, msg.data);
        break;
      case 'removeTerminal':
        this.removeTerminal(msg.terminalId);
        break;
      case 'focus':
        this.focusTerminal(msg.terminalId);
        break;
      case 'resize':
        this.resizeTerminal(msg.terminalId, msg.cols, msg.rows);
        break;
    }
  }

  private notifyReady(): void {
    this.vscodeApi.postMessage({ command: 'webviewReady' });
  }
}
```

### Phase 2: Simplified Terminal Creation

**Simplified Flow:**

```
Extension                          WebView
    |                                 |
    |--- webviewReady <---------------|
    |                                 |
    |--- createTerminal ------------->|
    |    {id, name, config}           |
    |                                 |
    |                            [Create xterm]
    |                            [Open in DOM]
    |                            [Setup FitAddon]
    |                                 |
    |<-- terminalReady ---------------|
    |    {id, cols, rows}             |
    |                                 |
    |--- startOutput ---------------->|
    |                                 |
    |--- output --------------------->|
    |--- output --------------------->|
```

**Key Changes:**
1. **No handshake retry** - If terminal creation fails, report error
2. **No output buffering** - Extension waits for `terminalReady` before sending data
3. **No complex state synchronization** - Single direction of truth

### Phase 3: Simplified XtermInstance

```typescript
/**
 * XtermInstance - Single terminal wrapper
 *
 * Replaces:
 * - TerminalLifecycleCoordinator
 * - TerminalCreationService
 * - Multiple addon managers
 */
export class XtermInstance {
  public readonly terminal: Terminal;
  public readonly fitAddon: FitAddon;
  public readonly container: HTMLElement;

  private constructor(
    public readonly id: string,
    public readonly name: string,
    container: HTMLElement,
    config: TerminalConfig
  ) {
    this.container = container;
    this.terminal = new Terminal(config);
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
  }

  static async create(
    id: string,
    name: string,
    parentElement: HTMLElement,
    config: TerminalConfig
  ): Promise<XtermInstance> {
    // 1. Create container
    const container = document.createElement('div');
    container.id = `terminal-${id}`;
    container.className = 'terminal-container';
    parentElement.appendChild(container);

    // 2. Create instance
    const instance = new XtermInstance(id, name, container, config);

    // 3. Open terminal (attach to DOM)
    instance.terminal.open(container);

    // 4. Initial fit
    await new Promise(r => requestAnimationFrame(r));
    instance.fitAddon.fit();

    // 5. Setup resize observer
    instance.setupResizeObserver();

    return instance;
  }

  private resizeObserver: ResizeObserver | null = null;

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.fitAddon.fit();
    });
    this.resizeObserver.observe(this.container);
  }

  public write(data: string): void {
    this.terminal.write(data);
  }

  public focus(): void {
    this.terminal.focus();
  }

  public dispose(): void {
    this.resizeObserver?.disconnect();
    this.terminal.dispose();
    this.container.remove();
  }
}
```

### Phase 4: Simplified Message Protocol

**Reduced Message Types:**

| Command | Direction | Purpose |
|---------|-----------|---------|
| `webviewReady` | WebView → Extension | WebView initialized |
| `createTerminal` | Extension → WebView | Create new terminal |
| `terminalReady` | WebView → Extension | Terminal created and ready |
| `removeTerminal` | Extension → WebView | Remove terminal |
| `output` | Extension → WebView | Terminal output data |
| `input` | WebView → Extension | User input |
| `resize` | Both | Terminal resize |
| `focus` | Extension → WebView | Focus terminal |

**Removed Messages:**
- `terminalCreated` (merged with `createTerminal` response)
- `terminalInitializationComplete` (replaced by `terminalReady`)
- `startOutput` (Extension waits for `terminalReady`)
- `stateUpdate` (no complex state sync needed)
- Various handshake/retry messages

---

## Implementation Plan

### Step 1: Create New Simplified Files

```
src/webview/
├── simple/
│   ├── SimpleTerminalWebView.ts    # Main WebView manager
│   ├── XtermInstance.ts            # Single terminal wrapper
│   ├── MessageHandler.ts           # Simple message routing
│   └── types.ts                    # Message types
```

### Step 2: Gradual Migration

1. Create new `SimpleTerminalWebView` alongside existing code
2. Add feature flag to switch between implementations
3. Test new implementation thoroughly
4. Remove old code once validated

### Step 3: Files to Remove/Consolidate

**Remove:**
- `src/webview/managers/ConsolidatedMessageManager.ts`
- `src/webview/managers/handlers/*.ts` (11 files)
- `src/webview/coordinators/*.ts`
- `src/webview/controllers/SessionMessageController.ts`
- `src/webview/controllers/CliAgentMessageController.ts`

**Consolidate:**
- `TerminalLifecycleCoordinator` + `TerminalCreationService` → `XtermInstance`
- `LightweightTerminalWebviewManager` → `SimpleTerminalWebView`
- `SplitManager` → Simplified layout management in `SimpleTerminalWebView`

---

## Key Simplifications

### Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| Managers | 18+ | 1 main + 1 per terminal |
| Message handlers | 11 files | 1 simple switch |
| Lines of code | ~5000 | ~500 |
| State sync | Bidirectional | Unidirectional |
| Retry logic | Complex exponential backoff | None (fail-fast) |
| Output buffering | Complex gate system | None (proper sequencing) |

### Why This Works

1. **VS Code Pattern**: Extension controls terminal lifecycle completely
2. **Simple Sequencing**: `webviewReady` → `createTerminal` → `terminalReady` → `output`
3. **No Race Conditions**: Clear ordering eliminates need for complex synchronization
4. **Fail-Fast**: Errors are surfaced immediately, not hidden by retries

---

## Implementation Status

### Completed Files

| File | Size | Description |
|------|------|-------------|
| `src/webview/simple/types.ts` | ~200 lines | Message and config types |
| `src/webview/simple/XtermInstance.ts` | ~450 lines | Single terminal wrapper |
| `src/webview/simple/SimpleTerminalWebView.ts` | ~400 lines | Main WebView manager |
| `src/webview/simple/index.ts` | ~15 lines | Module exports |
| `src/providers/services/SimpleWebViewBridge.ts` | ~280 lines | Extension-side bridge |

**Total: ~1,345 lines** (compared to ~5,000+ lines in current implementation)

### Build Output

| Bundle | Size | Description |
|--------|------|-------------|
| `dist/webview-simple.js` | 481 KB | Simplified WebView |
| `dist/webview.js` | 1,575 KB | Current WebView |

**Size reduction: 69%**

---

## Integration Guide

### Step 1: Use SimpleWebViewBridge in Extension

```typescript
// In SecondaryTerminalProvider.ts or similar

import { SimpleWebViewBridge, SimpleWebViewCallbacks } from './services/SimpleWebViewBridge';

class TerminalProvider {
  private bridge = new SimpleWebViewBridge();

  resolveWebviewView(view: vscode.WebviewView) {
    const callbacks: SimpleWebViewCallbacks = {
      onWebViewReady: () => this.handleWebViewReady(),
      onTerminalReady: (info) => this.handleTerminalReady(info),
      onTerminalCreationFailed: (id, error) => this.handleCreationFailed(id, error),
      onInput: (id, data) => this.handleInput(id, data),
      onResize: (id, cols, rows) => this.handleResize(id, cols, rows),
      onDeleteRequest: (id) => this.handleDeleteRequest(id),
      onTerminalFocused: (id) => this.handleFocused(id),
    };

    this.bridge.setView(view, callbacks);
  }

  private handleWebViewReady(): void {
    // Create initial terminal
    this.bridge.createTerminal('terminal-1', 'bash', 1, {}, true);
  }

  private handleTerminalReady(info: TerminalReadyInfo): void {
    // Start PTY process now
    this.startPtyProcess(info.terminalId, info.cols, info.rows);
  }
}
```

### Step 2: Use Simplified WebView HTML

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="...">
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    #terminal-body {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="terminal-body"></div>
  <!-- Use simplified webview bundle -->
  <script src="${webviewUri}/webview-simple.js"></script>
</body>
</html>
```

### Step 3: Feature Flag for Gradual Rollout

```typescript
// In configuration
const USE_SIMPLE_WEBVIEW = vscode.workspace
  .getConfiguration('sidebarTerminal')
  .get('useSimplifiedWebview', false);

// In HTML generation
const webviewScript = USE_SIMPLE_WEBVIEW
  ? 'webview-simple.js'
  : 'webview.js';
```

---

## Migration Checklist

- [x] Create `SimpleTerminalWebView.ts`
- [x] Create `XtermInstance.ts`
- [x] Create simple message types
- [x] Create `SimpleWebViewBridge.ts`
- [x] Add webpack entry point
- [x] Verify TypeScript compilation
- [x] Verify bundle size reduction
- [x] Update `WebViewHtmlGenerationService` with `generateSimplifiedHtml()` method
- [x] Add feature flag for gradual rollout (`secondaryTerminal.useSimplifiedWebView`)
- [x] Integrate feature flag into `SecondaryTerminalProvider`
- [ ] Test basic terminal operations
- [ ] Test session restore
- [ ] Test AI agent detection
- [ ] Performance comparison testing
- [ ] Remove old code (after validation)

---

## Risks and Mitigations

### Risk 1: Breaking Existing Features
**Mitigation**: Feature flag allows A/B testing and gradual rollout

### Risk 2: Session Restore Complexity
**Mitigation**: Session restore handled by Extension, WebView just receives terminal data

### Risk 3: AI Agent Detection
**Mitigation**: Keep detection logic, just simplify where it runs

---

## Expected Benefits

1. **Reduced Complexity**: 90% less code in WebView
2. **Faster Initialization**: No complex handshake delays
3. **Easier Debugging**: Clear message flow, single source of truth
4. **Better Maintainability**: VS Code patterns are well-documented
5. **Fewer Bugs**: Less code = fewer bugs
