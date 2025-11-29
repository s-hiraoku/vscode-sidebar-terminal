# Fixing WebView Duplicate Rendering Issue

**Project**: VS Code Sidebar Terminal Extension
**Issue**: `resolveWebviewView` called multiple times during panel position changes
**Root Cause**: No guards preventing duplicate HTML initialization
**Solution**: Apply VS Code's proven lifecycle patterns

---

## Problem Analysis

### Current Behavior

The `IntegratedSecondaryTerminalProvider.resolveWebviewView()` method lacks protection against duplicate calls:

```typescript
public resolveWebviewView(
  webviewView: vscode.WebviewView,
  _context: vscode.WebviewViewResolveContext,
  _token: vscode.CancellationToken
): void {
  this.view = webviewView; // ❌ No guard - overwrites on every call

  try {
    this.configureWebview(webviewView.webview); // ❌ Called multiple times
    this.setupEventListeners(webviewView); // ❌ Adds duplicate listeners
    this.completeInitialization(); // ❌ Re-initializes state
  } catch (error) {
    log(`❌ [PROVIDER] Failed to resolve webview: ${error}`);
    this.handleWebviewSetupError(error);
  }
}
```

### When Does This Happen?

`resolveWebviewView` is called multiple times during:

1. **Initial Load**: First webview creation
2. **Panel Movements**: User drags view to different panel location
3. **Workspace Restore**: VS Code restores view state after restart
4. **Visibility Changes**: View hidden and shown again

### Consequences

- **Performance Degradation**: Repeated initialization overhead
- **Memory Leaks**: Duplicate event listeners not disposed
- **State Loss**: Re-initialization resets terminal state
- **Flicker**: HTML re-rendered during panel movements
- **Race Conditions**: Concurrent initialization attempts

---

## VS Code's Solution Pattern

### Pattern 1: Resolution Guard

**File**: `src/vs/workbench/contrib/webviewView/browser/webviewViewService.ts`

```typescript
resolve(viewType: string, webview: WebviewView): Promise<void> {
    if (this._awaitingRevival.has(viewType)) {
        throw new Error('View already awaiting revival');
    }
    // ... proceed with resolution
}
```

**Key Insight**: Prevent duplicate resolution at service layer.

### Pattern 2: Rendering Flag

**File**: `src/vs/base/browser/ui/splitview/paneview.ts`

```typescript
class Pane {
    private _bodyRendered = false;

    protected renderBody(container: HTMLElement): void {
        if (this._bodyRendered) {
            return; // Early exit prevents re-rendering
        }
        this._bodyRendered = true;
        // Render body only once
    }
}
```

**Key Insight**: Use boolean flag to guard rendering logic.

### Pattern 3: State Preservation

**File**: `src/vs/workbench/browser/parts/views/viewPaneContainer.ts`

```typescript
movePane(fromIndex: number, toIndex: number): void {
    const [paneItem] = this.paneItems.splice(fromIndex, 1);
    this.paneItems.splice(toIndex, 0, paneItem);
    // Object reused, not recreated
}
```

**Key Insight**: Preserve object references during position changes.

---

## Implementation Solution

### Step 1: Add Resolution Guards

**File**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/integration/IntegratedSecondaryTerminalProvider.ts`

```typescript
export class IntegratedSecondaryTerminalProvider implements vscode.WebviewViewProvider {
  // Add initialization tracking flags
  private view?: vscode.WebviewView;
  private isInitialized = false; // Existing flag
  private htmlInitialized = false; // ✅ NEW: HTML initialization flag
  private listenersRegistered = false; // ✅ NEW: Event listener flag

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    // ✅ Guard 1: Check if already resolved
    if (this.view !== undefined && this.htmlInitialized) {
      log('⚠️  [PROVIDER] resolveWebviewView called again - ignoring duplicate call');
      return; // Early exit prevents re-initialization
    }

    this.view = webviewView;

    try {
      // ✅ Guard 2: Initialize HTML only once
      if (!this.htmlInitialized) {
        this.configureWebview(webviewView.webview);
        this.htmlInitialized = true;
        log('✅ [PROVIDER] WebView HTML initialized');
      }

      // ✅ Guard 3: Register listeners only once
      if (!this.listenersRegistered) {
        this.setupEventListeners(webviewView);
        this.listenersRegistered = true;
        log('✅ [PROVIDER] Event listeners registered');
      }

      // ✅ Always complete initialization (idempotent)
      this.completeInitialization();
    } catch (error) {
      log(`❌ [PROVIDER] Failed to resolve webview: ${error}`);
      this.handleWebviewSetupError(error);
    }
  }
}
```

### Step 2: Make configureWebview Idempotent

Ensure `configureWebview()` is safe to call multiple times (though guarded):

```typescript
private configureWebview(webview: vscode.Webview): void {
  // Set options (idempotent - safe to overwrite)
  webview.options = {
    enableScripts: true,
    localResourceRoots: [this.context.extensionUri]
  };

  // ✅ Only set HTML if not already set
  if (!webview.html || webview.html === '') {
    webview.html = this.getHtmlContent();
    log('✅ [PROVIDER] WebView HTML content set');
  } else {
    log('⚠️  [PROVIDER] WebView HTML already set - skipping');
  }
}
```

### Step 3: Prevent Duplicate Event Listeners

Update `setupEventListeners()` to be idempotent:

```typescript
private setupEventListeners(webviewView: vscode.WebviewView): void {
  // ✅ Clear existing listeners before adding new ones
  if (this.listenersRegistered) {
    log('⚠️  [PROVIDER] Listeners already registered - skipping');
    return;
  }

  // Register with disposables for proper cleanup
  this.disposables.push(
    webviewView.onDidChangeVisibility(() => {
      this.handleVisibilityChange(webviewView.visible);
    })
  );

  this.disposables.push(
    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      this.handleWebviewMessage(message);
    })
  );

  log('✅ [PROVIDER] Event listeners registered');
}
```

### Step 4: Handle Visibility Changes Correctly

**DON'T** re-initialize HTML on visibility change:

```typescript
private handleVisibilityChange(visible: boolean): void {
  if (visible) {
    // ✅ Restore state without re-initializing HTML
    this.restoreTerminalState();
    log('✅ [PROVIDER] WebView became visible - state restored');
  } else {
    // ✅ Save state before hiding
    this.saveTerminalState();
    log('✅ [PROVIDER] WebView hidden - state saved');
  }
}

private restoreTerminalState(): void {
  // Send state to webview without resetting HTML
  if (this.view) {
    this.view.webview.postMessage({
      type: 'restoreState',
      state: this.getSavedState()
    });
  }
}

private saveTerminalState(): void {
  // Persist current terminal state
  const state = this.getCurrentState();
  this.persistenceService.saveState(state);
}
```

### Step 5: Add Diagnostic Logging

Add logging to detect duplicate calls:

```typescript
public resolveWebviewView(
  webviewView: vscode.WebviewView,
  context: vscode.WebviewViewResolveContext,
  _token: vscode.CancellationToken
): void {
  // ✅ Diagnostic logging
  log(`🔍 [PROVIDER] resolveWebviewView called - Initialized: ${this.htmlInitialized}, Listeners: ${this.listenersRegistered}`);
  log(`🔍 [PROVIDER] Context state: ${JSON.stringify(context.state)}`);

  // ... rest of implementation
}
```

---

## Testing Strategy

### Unit Tests

Create test file: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/test/suite/webview-lifecycle.test.ts`

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';
import { IntegratedSecondaryTerminalProvider } from '../../integration/IntegratedSecondaryTerminalProvider';

suite('WebView Lifecycle Tests', () => {
  let provider: IntegratedSecondaryTerminalProvider;
  let mockWebviewView: vscode.WebviewView;

  setup(() => {
    provider = new IntegratedSecondaryTerminalProvider(
      {} as vscode.ExtensionContext,
      {} as any // Mock TerminalManager
    );

    mockWebviewView = createMockWebviewView();
  });

  test('resolveWebviewView ignores duplicate calls', () => {
    // First call - should initialize
    provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
    const firstHtml = mockWebviewView.webview.html;

    // Second call - should ignore
    provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
    const secondHtml = mockWebviewView.webview.html;

    assert.strictEqual(firstHtml, secondHtml, 'HTML should not change on duplicate call');
  });

  test('resolveWebviewView sets HTML only once', () => {
    let htmlSetCount = 0;
    const mockWebview = {
      html: '',
      options: {},
    };

    Object.defineProperty(mockWebview, 'html', {
      set(value: string) {
        htmlSetCount++;
        this._html = value;
      },
      get() {
        return this._html;
      }
    });

    const view = { webview: mockWebview } as vscode.WebviewView;

    provider.resolveWebviewView(view, {}, {} as vscode.CancellationToken);
    provider.resolveWebviewView(view, {}, {} as vscode.CancellationToken);
    provider.resolveWebviewView(view, {}, {} as vscode.CancellationToken);

    assert.strictEqual(htmlSetCount, 1, 'HTML should be set exactly once');
  });

  test('event listeners registered only once', () => {
    let listenerCount = 0;
    const mockWebviewView = {
      webview: {
        html: '',
        options: {},
        onDidReceiveMessage: () => {
          listenerCount++;
          return { dispose: () => {} };
        }
      },
      onDidChangeVisibility: () => {
        listenerCount++;
        return { dispose: () => {} };
      }
    } as unknown as vscode.WebviewView;

    provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
    const firstListenerCount = listenerCount;

    provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
    const secondListenerCount = listenerCount;

    assert.strictEqual(firstListenerCount, secondListenerCount, 'Listeners should not be re-registered');
  });
});

function createMockWebviewView(): vscode.WebviewView {
  return {
    webview: {
      html: '',
      options: {},
      postMessage: () => Promise.resolve(true),
      onDidReceiveMessage: () => ({ dispose: () => {} }),
      asWebviewUri: (uri: vscode.Uri) => uri,
      cspSource: ''
    },
    visible: true,
    viewType: 'secondaryTerminal',
    onDidChangeVisibility: () => ({ dispose: () => {} }),
    show: () => {},
    onDidDispose: () => ({ dispose: () => {} })
  } as vscode.WebviewView;
}
```

### Integration Tests

Test panel position changes:

```typescript
test('panel position change preserves state', async () => {
  // Create terminal in sidebar
  await vscode.commands.executeCommand('secondaryTerminal.focus');

  // Move to auxiliary bar
  await vscode.commands.executeCommand('workbench.action.moveViewToAuxiliaryBar');

  // Verify state preserved
  const terminals = await getActiveTerminals();
  assert.strictEqual(terminals.length, 1, 'Terminal should be preserved');

  // Move back to sidebar
  await vscode.commands.executeCommand('workbench.action.moveSideBarViewToSidebar');

  // Verify state still preserved
  const terminalsAfter = await getActiveTerminals();
  assert.strictEqual(terminalsAfter.length, 1, 'Terminal should still exist');
});
```

### Manual Testing

1. **Test Duplicate Call Detection**:
   - Enable diagnostic logging
   - Open sidebar terminal
   - Move to different panel locations
   - Check logs for "ignoring duplicate call" messages

2. **Test State Preservation**:
   - Create terminal with scrollback content
   - Move view to different panel
   - Verify scrollback preserved without flicker

3. **Test Performance**:
   - Monitor memory usage during panel movements
   - Ensure no memory leaks
   - Verify no duplicate event listeners

---

## Implementation Checklist

- [ ] **Add initialization flags** (`htmlInitialized`, `listenersRegistered`)
- [ ] **Add resolution guard** (check `this.view !== undefined && this.htmlInitialized`)
- [ ] **Guard HTML initialization** (set HTML only once)
- [ ] **Guard event listener registration** (register listeners only once)
- [ ] **Make visibility handler idempotent** (restore state without re-initializing)
- [ ] **Add diagnostic logging** (track duplicate calls)
- [ ] **Create unit tests** (test duplicate call handling)
- [ ] **Create integration tests** (test panel position changes)
- [ ] **Update documentation** (document lifecycle behavior)
- [ ] **Performance testing** (verify no memory leaks)

---

## Expected Outcomes

After implementing these changes:

✅ **No Duplicate HTML Initialization**: HTML set exactly once per webview lifecycle
✅ **No Duplicate Event Listeners**: Listeners registered exactly once
✅ **State Preservation**: Terminal state preserved during panel movements
✅ **No Flicker**: Smooth panel position changes without visual artifacts
✅ **Performance**: No memory leaks, minimal overhead
✅ **Logging**: Clear diagnostic information for debugging

---

## Monitoring and Validation

### Performance Metrics

Monitor these metrics before and after:

```typescript
// Add performance tracking
class PerformanceMonitor {
  private resolveCallCount = 0;
  private htmlSetCount = 0;
  private listenerCount = 0;

  trackResolveCall(): void {
    this.resolveCallCount++;
    log(`📊 resolveWebviewView calls: ${this.resolveCallCount}`);
  }

  trackHtmlSet(): void {
    this.htmlSetCount++;
    log(`📊 HTML set operations: ${this.htmlSetCount}`);
  }

  trackListenerRegistration(): void {
    this.listenerCount++;
    log(`📊 Listener registrations: ${this.listenerCount}`);
  }

  getReport(): string {
    return `
Performance Report:
- resolveWebviewView calls: ${this.resolveCallCount}
- HTML set operations: ${this.htmlSetCount}
- Listener registrations: ${this.listenerCount}
Expected: resolveCallCount >= htmlSetCount (1), listenerCount (1)
    `.trim();
  }
}
```

### Expected Metrics

| Metric | Before Fix | After Fix |
|--------|-----------|-----------|
| resolveWebviewView calls | Multiple | Multiple (expected) |
| HTML set operations | Multiple | **1** |
| Listener registrations | Multiple | **1** |
| Memory leaks | Yes | **No** |
| Panel movement flicker | Yes | **No** |

---

## Rollback Plan

If issues arise after implementation:

1. **Immediate**: Revert to previous version via git
2. **Investigate**: Check diagnostic logs for unexpected behavior
3. **Fix**: Adjust guard conditions if too restrictive
4. **Test**: Ensure all scenarios covered

---

## References

- **VS Code WebView Lifecycle Patterns**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/docs/vscode-webview-lifecycle-patterns.md`
- **VS Code Source**: https://github.com/microsoft/vscode
- **WebviewViewService**: `src/vs/workbench/contrib/webviewView/browser/webviewViewService.ts`
- **ViewPane**: `src/vs/workbench/browser/parts/views/viewPane.ts`
- **WebView API**: https://code.visualstudio.com/api/extension-guides/webview
