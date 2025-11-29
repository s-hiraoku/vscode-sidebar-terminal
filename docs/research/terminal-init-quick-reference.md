# VS Code Terminal Initialization - Quick Reference

## 🎯 Core Principle

**"Explicit coordination over implicit assumptions"**

VS Code ensures terminals initialize **exactly once** through guards, barriers, and manual calculations.

---

## ✅ Critical Guards

### 1. Prevent Duplicate terminal.open()

```typescript
// Guard 1: Attachment flag
if (this._terminalAttached) {
  return;  // Already attached
}

// Guard 2: Element existence
if (this.terminal.element) {
  return;  // Already opened
}

// Safe to call
this.terminal.open(container);
this._terminalAttached = true;
```

### 2. Prevent Duplicate Resize

```typescript
private _resizing: boolean = false;

async handleResize(width: number, height: number) {
  if (this._resizing) return;  // Guard

  this._resizing = true;
  try {
    this.terminal.resize(cols, rows);
  } finally {
    this._resizing = false;
  }
}
```

---

## 🚧 AutoOpenBarrier Pattern

### Implementation

```typescript
class Barrier {
  private _isOpen = false;
  private _promise: Promise<boolean>;
  private _completePromise!: (v: boolean) => void;

  constructor() {
    this._promise = new Promise<boolean>((resolve) => {
      this._completePromise = resolve;
    });
  }

  isOpen() { return this._isOpen; }

  open() {
    this._isOpen = true;
    this._completePromise(true);
  }

  wait() { return this._promise; }
}

class AutoOpenBarrier extends Barrier {
  private _timeout: NodeJS.Timeout;

  constructor(autoOpenTimeMs = 100) {
    super();
    this._timeout = setTimeout(() => this.open(), autoOpenTimeMs);
  }

  override open() {
    clearTimeout(this._timeout);
    super.open();
  }
}
```

### Usage

```typescript
// Create barrier with 100ms timeout
private _domReady = new AutoOpenBarrier(100);

// Wait for readiness
await this._domReady.wait();

// Signal ready (from layout callback)
this._domReady.open();
```

---

## 📐 Manual Dimensions (No fit() Addon)

### Why?

VS Code **does not use fit() addon** to avoid:
- ❌ Initial ResizeObserver callback
- ❌ Race conditions
- ❌ Unpredictable timing

### Instead: Calculate Explicitly

```typescript
function calculateDimensions(
  window: Window,
  font: { charWidth: number; charHeight: number },
  containerWidth: number,
  containerHeight: number
): { cols: number; rows: number } {
  const scaledWidth = containerWidth * window.devicePixelRatio;
  const scaledCharWidth = font.charWidth * window.devicePixelRatio;
  const cols = Math.max(Math.floor(scaledWidth / scaledCharWidth), 1);

  const scaledHeight = containerHeight * window.devicePixelRatio;
  const scaledCharHeight = Math.ceil(font.charHeight * window.devicePixelRatio);
  const rows = Math.max(Math.floor(scaledHeight / scaledCharHeight), 1);

  return { cols, rows };
}

// Use
const dims = calculateDimensions(window, font, width, height);
terminal.resize(dims.cols, dims.rows);  // Direct call
```

---

## ⏱️ Debouncing

```typescript
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Usage
const debouncedResize = debounce((width, height) => {
  handleResize(width, height);
}, 16);  // ~60fps
```

---

## 🗑️ DisposableStore Pattern

```typescript
class DisposableStore {
  private _disposables = new Set<{ dispose(): void }>();
  private _isDisposed = false;

  add<T extends { dispose(): void }>(disposable: T): T {
    if (this._isDisposed) {
      disposable.dispose();
      return disposable;
    }
    this._disposables.add(disposable);
    return disposable;
  }

  clear() {
    for (const d of this._disposables) d.dispose();
    this._disposables.clear();
  }

  dispose() {
    if (this._isDisposed) return;
    this._isDisposed = true;
    this.clear();
  }
}

// Usage
private _coreDisposables = new DisposableStore();
private _attachmentDisposables = new DisposableStore();

// Core handlers (register once)
this._coreDisposables.add(terminal.onData(...));

// Attachment handlers (clear before re-register)
this._attachmentDisposables.clear();
this._attachmentDisposables.add(container.addEventListener(...));
```

---

## 🔄 Initialization Sequence

```
1. Constructor
   └─> Create barriers
   └─> Create terminal instance

2. initialize(container)
   └─> Guard: if (this._terminalAttached) return
   └─> Guard: if (terminal.element) return
   └─> await this._domReady.wait()
   └─> terminal.open(container)
   └─> this._terminalAttached = true
   └─> Register event handlers

3. onLayout(width, height)
   └─> this._domReady.open()  // Signal ready
   └─> Calculate dimensions
   └─> terminal.resize(cols, rows)
```

---

## ❌ Anti-Patterns to Avoid

| Don't | Do |
|-------|-----|
| ❌ Use fit() addon | ✅ Calculate dimensions manually |
| ❌ Call terminal.open() multiple times | ✅ Use attachment flag guard |
| ❌ Use ResizeObserver without debouncing | ✅ Debounce with 16ms interval |
| ❌ Register handlers multiple times | ✅ Use DisposableStore with clear() |
| ❌ Assume DOM is ready | ✅ Use AutoOpenBarrier |

---

## 📋 Checklist for WebView Implementation

- [ ] Implement Barrier and AutoOpenBarrier classes
- [ ] Create DomReadyDetector utility
- [ ] Add `_terminalAttached` flag to manager
- [ ] Guard terminal.open() with existence checks
- [ ] Replace fit() with manual dimension calculation
- [ ] Debounce resize handler (16ms)
- [ ] Use DisposableStore for event handlers
- [ ] Separate core vs attachment handlers
- [ ] Clear attachment handlers before re-registering
- [ ] Wait for barrier before calling terminal.open()
- [ ] Signal barrier from layout callback
- [ ] Add resize guard flag
- [ ] Test single initialization
- [ ] Test re-attachment scenarios
- [ ] Add disposal cleanup

---

## 📚 Full Documentation

- **Complete Patterns:** `terminal-single-initialization-patterns.md`
- **Summary:** `TERMINAL_INIT_SUMMARY.md`
- **Implementation Guide:** `WEBVIEW_TERMINAL_IMPLEMENTATION_GUIDE.md`

---

## 🔍 Quick Debugging

**Terminal opens multiple times?**
→ Check guards in attachToElement()

**Resize fires too frequently?**
→ Add debouncing (16ms minimum)

**Terminal not initializing?**
→ Check barrier is opened in layout callback

**Event handlers duplicating?**
→ Clear attachmentDisposables before re-registering

**DOM not ready errors?**
→ Increase barrier timeout or add polling

---

## 💡 Key Takeaway

VS Code's pattern is all about **explicit control**:

- ✅ Explicit guards prevent duplicate operations
- ✅ Explicit barriers coordinate async timing
- ✅ Explicit dimension calculations replace fit()
- ✅ Explicit disposal management prevents leaks

**Follow these patterns for bulletproof terminal initialization.**
