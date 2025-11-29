# WebView Lifecycle Quick Reference

**Purpose**: Quick lookup for VS Code WebView lifecycle patterns
**Audience**: Developers implementing WebView-based extensions
**Source**: VS Code repository analysis (2025-11-10)

---

## The Three Critical Guards

### 1. Resolution Guard
```typescript
public resolveWebviewView(webviewView: vscode.WebviewView): void {
  if (this._view !== undefined && this._htmlInitialized) {
    return; // ✅ Ignore duplicate calls
  }
  // ... proceed with initialization
}
```

### 2. HTML Initialization Guard
```typescript
private configureWebview(webview: vscode.Webview): void {
  if (!this._htmlInitialized) {
    webview.html = this.getHtmlContent();
    this._htmlInitialized = true; // ✅ Set flag after initialization
  }
}
```

### 3. Event Listener Guard
```typescript
private setupEventListeners(webviewView: vscode.WebviewView): void {
  if (this._listenersRegistered) {
    return; // ✅ Prevent duplicate registration
  }

  this.disposables.push(
    webviewView.onDidChangeVisibility(() => { /* ... */ })
  );

  this._listenersRegistered = true;
}
```

---

## Required Class Properties

```typescript
class YourWebviewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _htmlInitialized = false;       // ✅ Tracks HTML initialization
  private _listenersRegistered = false;   // ✅ Tracks listener registration
  private readonly disposables: vscode.Disposable[] = [];

  // ... implementation
}
```

---

## VS Code Source File Map

| Pattern | VS Code File | Line Reference |
|---------|--------------|----------------|
| Resolution Guard | `src/vs/workbench/contrib/webviewView/browser/webviewViewService.ts` | `resolve()` method |
| Rendering Flag | `src/vs/base/browser/ui/splitview/paneview.ts` | `_bodyRendered` property |
| State Preservation | `src/vs/workbench/browser/parts/views/viewPaneContainer.ts` | `movePane()` method |
| Disposal Pattern | `src/vs/base/common/lifecycle.ts` | `DisposableStore` class |

---

## Common Mistakes

### ❌ DON'T

```typescript
// Mistake 1: No duplicate call protection
public resolveWebviewView(view: vscode.WebviewView): void {
  this._view = view; // Called multiple times!
  view.webview.html = this.getHtml(); // Re-renders HTML!
}

// Mistake 2: Re-initialize on visibility change
private onVisibilityChange(visible: boolean): void {
  if (visible) {
    this._view.webview.html = this.getHtml(); // Causes flicker!
  }
}

// Mistake 3: No disposal tracking
view.onDidChangeVisibility(() => { /* leak */ });
```

### ✅ DO

```typescript
// Correct 1: Guard against duplicate calls
public resolveWebviewView(view: vscode.WebviewView): void {
  if (this._htmlInitialized) return;
  this._view = view;
  view.webview.html = this.getHtml();
  this._htmlInitialized = true;
}

// Correct 2: Restore state, don't re-initialize
private onVisibilityChange(visible: boolean): void {
  if (visible) {
    this.restoreState(); // No HTML modification
  }
}

// Correct 3: Track disposables
this.disposables.push(
  view.onDidChangeVisibility(() => { /* ... */ })
);
```

---

## Lifecycle Event Flow

```
1. Extension Activation
   └─> registerWebviewViewProvider()

2. View First Shown
   └─> resolveWebviewView()  [First call]
       ├─> Set _view reference
       ├─> Initialize HTML (htmlInitialized = true)
       ├─> Register listeners (listenersRegistered = true)
       └─> Complete initialization

3. Panel Position Change
   └─> resolveWebviewView()  [Duplicate call]
       └─> Early return (already initialized) ✅

4. View Hidden
   └─> onDidChangeVisibility(false)
       └─> Save state

5. View Shown Again
   └─> onDidChangeVisibility(true)
       └─> Restore state (no HTML modification)

6. Extension Deactivation
   └─> dispose()
       └─> Dispose all tracked resources
```

---

## Performance Expectations

| Operation | Expected Time | Max Acceptable |
|-----------|---------------|----------------|
| resolveWebviewView | < 50ms | 100ms |
| HTML initialization | < 100ms | 200ms |
| State restoration | < 50ms | 100ms |
| Panel movement | No flicker | < 200ms animation |

---

## Debugging Checklist

When experiencing WebView issues:

- [ ] Check if `resolveWebviewView` called multiple times (add log statement)
- [ ] Verify `_htmlInitialized` flag set after first HTML initialization
- [ ] Verify `_listenersRegistered` flag set after listener registration
- [ ] Check for duplicate event listeners (use Chrome DevTools)
- [ ] Verify disposables are tracked and disposed properly
- [ ] Test panel position changes (sidebar ↔ auxiliary bar)
- [ ] Test visibility changes (hide/show view)
- [ ] Monitor memory usage (check for leaks)

---

## Testing Template

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('WebView Lifecycle', () => {
  test('resolveWebviewView ignores duplicates', () => {
    const provider = new YourProvider();
    const view = createMockWebviewView();

    // First call
    provider.resolveWebviewView(view, {}, token);
    const html1 = view.webview.html;

    // Duplicate call
    provider.resolveWebviewView(view, {}, token);
    const html2 = view.webview.html;

    assert.strictEqual(html1, html2); // ✅ HTML unchanged
  });

  test('listeners registered once', () => {
    let count = 0;
    const view = {
      onDidChangeVisibility: () => {
        count++;
        return { dispose: () => {} };
      }
    };

    provider.resolveWebviewView(view, {}, token);
    provider.resolveWebviewView(view, {}, token);

    assert.strictEqual(count, 1); // ✅ Registered once
  });
});
```

---

## Migration Path

### Before (Problematic)

```typescript
export class OldProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  resolveWebviewView(view: vscode.WebviewView): void {
    this._view = view;
    view.webview.html = getHtml(); // ❌ Resets on every call
    view.onDidChangeVisibility(() => {}); // ❌ Memory leak
  }
}
```

### After (Fixed)

```typescript
export class NewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _htmlInitialized = false; // ✅ NEW
  private _listenersRegistered = false; // ✅ NEW
  private disposables: vscode.Disposable[] = []; // ✅ NEW

  resolveWebviewView(view: vscode.WebviewView): void {
    if (this._htmlInitialized) return; // ✅ Guard

    this._view = view;

    if (!this._htmlInitialized) {
      view.webview.html = getHtml();
      this._htmlInitialized = true; // ✅ Set flag
    }

    if (!this._listenersRegistered) {
      this.disposables.push(
        view.onDidChangeVisibility(() => {})
      );
      this._listenersRegistered = true; // ✅ Set flag
    }
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose()); // ✅ Cleanup
  }
}
```

---

## Key Takeaways

1. **Always guard `resolveWebviewView`** - VS Code may call it multiple times
2. **Initialize HTML exactly once** - Use `_htmlInitialized` flag
3. **Register listeners exactly once** - Use `_listenersRegistered` flag
4. **Track all disposables** - Prevent memory leaks
5. **Never reset HTML on visibility change** - Only restore state
6. **Test panel position changes** - Ensure state preservation
7. **Add diagnostic logging** - Track duplicate calls during development

---

## Quick Links

- **Full Documentation**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/docs/vscode-webview-lifecycle-patterns.md`
- **Implementation Guide**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/docs/fix-webview-duplicate-rendering.md`
- **VS Code Source**: https://github.com/microsoft/vscode
- **WebView API**: https://code.visualstudio.com/api/extension-guides/webview

---

## Need Help?

If you're still experiencing issues:

1. Enable diagnostic logging in `resolveWebviewView`
2. Check if flags are set correctly
3. Verify disposables are tracked
4. Test with minimal provider implementation
5. Compare with VS Code's WebviewViewPane implementation

**Remember**: The key is **prevention, not reaction**. Guard against duplicate calls proactively rather than trying to handle them reactively.
