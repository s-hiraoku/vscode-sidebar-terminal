# WebView Terminal Implementation Guide - Applying VS Code Patterns

This guide translates VS Code's terminal initialization patterns into concrete implementations for a WebView-based terminal extension.

## Problem Statement

**Current Issues:**
- Terminal.open() might be called multiple times
- fit() causes initial ResizeObserver callback triggering unnecessary updates
- Race conditions between DOM readiness and terminal initialization
- Duplicate event listener registration

**Goal:**
Ensure terminals initialize **exactly once** with clean lifecycle management.

---

## Solution 1: AutoOpenBarrier for DOM Readiness

### Implementation

Create a barrier utility based on VS Code's pattern:

```typescript
// src/webview/utils/Barrier.ts

/**
 * A synchronization primitive that starts closed and opens once.
 * Based on VS Code's Barrier implementation.
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/base/common/async.ts
 */
export class Barrier {
  private _isOpen: boolean = false;
  private _promise: Promise<boolean>;
  private _completePromise!: (v: boolean) => void;

  constructor() {
    this._promise = new Promise<boolean>((resolve) => {
      this._completePromise = resolve;
    });
  }

  /**
   * Returns true if the barrier is already open.
   */
  isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * Opens the barrier permanently, resolving all waiters.
   * Idempotent - calling multiple times has no effect after first call.
   */
  open(): void {
    if (this._isOpen) {
      return;  // Already open - prevent duplicate resolution
    }
    this._isOpen = true;
    this._completePromise(true);
  }

  /**
   * Returns a promise that resolves when the barrier opens.
   */
  wait(): Promise<boolean> {
    return this._promise;
  }
}

/**
 * A barrier that automatically opens after a timeout.
 * Based on VS Code's AutoOpenBarrier implementation.
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/base/common/async.ts
 */
export class AutoOpenBarrier extends Barrier {
  private readonly _timeout: NodeJS.Timeout;

  /**
   * Creates a barrier that automatically opens after the specified timeout.
   * @param autoOpenTimeMs Milliseconds to wait before auto-opening (default: 100ms)
   */
  constructor(autoOpenTimeMs: number = 100) {
    super();
    this._timeout = setTimeout(() => this.open(), autoOpenTimeMs);
  }

  /**
   * Opens the barrier and cancels the auto-open timeout.
   */
  override open(): void {
    clearTimeout(this._timeout);
    super.open();
  }
}
```

### Usage in WebView

```typescript
// src/webview/managers/TerminalLifecycleManager.ts

import { AutoOpenBarrier } from '../utils/Barrier';

export class TerminalLifecycleManager {
  private _domReadyBarrier = new AutoOpenBarrier(100);
  private _terminalAttached: boolean = false;

  async initializeTerminal(): Promise<void> {
    // Guard: Already attached
    if (this._terminalAttached) {
      return;
    }

    // Guard: Terminal already has element
    if (!this.terminal || this.terminal.element) {
      return;
    }

    // Wait for DOM to be ready (max 100ms)
    await this._domReadyBarrier.wait();

    // Safe to call terminal.open() now
    this.terminal.open(this.terminalContainer);
    this._terminalAttached = true;
  }

  /**
   * Call this when you confirm DOM is ready (e.g., after first layout)
   */
  signalDomReady(): void {
    if (!this._domReadyBarrier.isOpen()) {
      this._domReadyBarrier.open();
    }
  }
}
```

---

## Solution 2: DOM Ready Detector

Create a dedicated utility to detect when the DOM is truly stable:

```typescript
// src/webview/utils/DomReadyDetector.ts

/**
 * Detects when the DOM is ready for terminal operations.
 * Uses multiple signals to ensure reliability.
 */
export class DomReadyDetector {
  private _barrier = new AutoOpenBarrier(100);
  private _container: HTMLElement | null = null;
  private _checkInterval: NodeJS.Timeout | null = null;

  constructor(container: HTMLElement) {
    this._container = container;
    this.startDetection();
  }

  /**
   * Starts DOM readiness detection using multiple strategies.
   */
  private startDetection(): void {
    // Strategy 1: Check if container has dimensions
    if (this.hasValidDimensions()) {
      this._barrier.open();
      return;
    }

    // Strategy 2: Wait for DOMContentLoaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.checkAndSignal();
      }, { once: true });
    } else {
      // Document already loaded
      this.checkAndSignal();
    }

    // Strategy 3: Polling fallback (checks every 16ms for ~60fps)
    this._checkInterval = setInterval(() => {
      if (this.checkAndSignal()) {
        this.stopPolling();
      }
    }, 16);

    // Strategy 4: Auto-timeout (100ms from AutoOpenBarrier)
    // Barrier will auto-open after timeout even if dimensions aren't perfect
  }

  /**
   * Checks if container has valid dimensions and signals if ready.
   * @returns true if DOM is ready
   */
  private checkAndSignal(): boolean {
    if (this.hasValidDimensions()) {
      this._barrier.open();
      return true;
    }
    return false;
  }

  /**
   * Checks if container has valid, non-zero dimensions.
   */
  private hasValidDimensions(): boolean {
    if (!this._container) {
      return false;
    }

    const rect = this._container.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Stops the polling interval.
   */
  private stopPolling(): void {
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }
  }

  /**
   * Returns a promise that resolves when the DOM is ready.
   */
  wait(): Promise<boolean> {
    return this._barrier.wait();
  }

  /**
   * Manually signal that the DOM is ready.
   */
  signalReady(): void {
    this._barrier.open();
    this.stopPolling();
  }

  /**
   * Cleanup resources.
   */
  dispose(): void {
    this.stopPolling();
  }
}
```

### Usage

```typescript
// In TerminalLifecycleManager or main initialization

import { DomReadyDetector } from '../utils/DomReadyDetector';

class TerminalWebviewManager {
  private _domDetector: DomReadyDetector | null = null;

  async initialize(container: HTMLElement): Promise<void> {
    // Create detector
    this._domDetector = new DomReadyDetector(container);

    // Wait for DOM
    await this._domDetector.wait();

    // Safe to initialize terminal
    this.terminal.open(container);
  }

  // If you have explicit layout callback
  onLayout(width: number, height: number): void {
    // Signal DOM is definitely ready
    this._domDetector?.signalReady();

    // Proceed with resize
    this.handleResize(width, height);
  }
}
```

---

## Solution 3: Manual Dimension Calculation (No fit() Addon)

Replace the fit() addon with VS Code's manual calculation approach:

```typescript
// src/webview/utils/TerminalDimensions.ts

/**
 * Terminal font metrics and dimension calculation.
 * Based on VS Code's getXtermScaledDimensions implementation.
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts
 */

export interface ITerminalFont {
  charWidth: number;
  charHeight: number;
  letterSpacing: number;
  lineHeight: number;
}

export interface ITerminalDimensions {
  cols: number;
  rows: number;
}

/**
 * Calculates terminal dimensions from container size and font metrics.
 * Accounts for devicePixelRatio for precision.
 */
export function calculateTerminalDimensions(
  window: Window,
  font: ITerminalFont,
  containerWidth: number,
  containerHeight: number
): ITerminalDimensions | null {
  if (!font.charWidth || !font.charHeight) {
    return null;
  }

  // Account for devicePixelRatio (important for retina displays)
  const scaledWidthAvailable = containerWidth * window.devicePixelRatio;
  const scaledCharWidth = font.charWidth * window.devicePixelRatio + font.letterSpacing;
  const cols = Math.max(Math.floor(scaledWidthAvailable / scaledCharWidth), 1);

  const scaledHeightAvailable = containerHeight * window.devicePixelRatio;
  const scaledCharHeight = Math.ceil(font.charHeight * window.devicePixelRatio);
  const scaledLineHeight = Math.floor(scaledCharHeight * font.lineHeight);
  const rows = Math.max(Math.floor(scaledHeightAvailable / scaledLineHeight), 1);

  return { cols, rows };
}

/**
 * Measures actual font metrics from the terminal DOM element.
 * Call this after terminal.open() to get accurate measurements.
 */
export function measureFontMetrics(terminal: Terminal): ITerminalFont | null {
  const element = terminal.element;
  if (!element) {
    return null;
  }

  // Get computed style
  const computedStyle = window.getComputedStyle(element);
  const fontSize = parseFloat(computedStyle.fontSize);
  const fontFamily = computedStyle.fontFamily;
  const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.2;

  // Create temporary span to measure character dimensions
  const span = document.createElement('span');
  span.style.fontFamily = fontFamily;
  span.style.fontSize = `${fontSize}px`;
  span.style.position = 'absolute';
  span.style.visibility = 'hidden';
  span.textContent = 'W';  // Use 'W' as representative character
  document.body.appendChild(span);

  const rect = span.getBoundingClientRect();
  const charWidth = rect.width;
  const charHeight = rect.height;

  document.body.removeChild(span);

  return {
    charWidth,
    charHeight,
    letterSpacing: parseFloat(computedStyle.letterSpacing) || 0,
    lineHeight: lineHeight / fontSize  // Normalize to multiplier
  };
}
```

### Usage in Resize Handler

```typescript
// src/webview/managers/TerminalResizeManager.ts

import { Terminal } from '@xterm/xterm';
import { calculateTerminalDimensions, measureFontMetrics, ITerminalFont } from '../utils/TerminalDimensions';

export class TerminalResizeManager {
  private _terminal: Terminal;
  private _fontMetrics: ITerminalFont | null = null;
  private _resizing: boolean = false;
  private _lastResize: { cols: number; rows: number } | null = null;

  constructor(terminal: Terminal) {
    this._terminal = terminal;
  }

  /**
   * Call this after terminal.open() to measure font metrics.
   */
  initializeFontMetrics(): void {
    this._fontMetrics = measureFontMetrics(this._terminal);
  }

  /**
   * Handles resize with debouncing and manual dimension calculation.
   * @param width Container width in CSS pixels
   * @param height Container height in CSS pixels
   */
  async handleResize(width: number, height: number): Promise<void> {
    // Guard: Prevent concurrent resizes
    if (this._resizing) {
      return;
    }

    // Guard: Need font metrics
    if (!this._fontMetrics) {
      this.initializeFontMetrics();
      if (!this._fontMetrics) {
        return;  // Still no metrics - terminal not ready
      }
    }

    this._resizing = true;
    try {
      // Calculate dimensions manually (no fit() addon)
      const dims = calculateTerminalDimensions(
        window,
        this._fontMetrics,
        width,
        height
      );

      if (!dims) {
        return;  // Invalid dimensions
      }

      // Guard: Skip if dimensions haven't changed
      if (this._lastResize &&
          this._lastResize.cols === dims.cols &&
          this._lastResize.rows === dims.rows) {
        return;
      }

      // Apply resize
      this._terminal.resize(dims.cols, dims.rows);
      this._lastResize = dims;

    } finally {
      this._resizing = false;
    }
  }

  /**
   * Debounced version for ResizeObserver.
   * Debounce interval: 16ms (~60fps)
   */
  private _debouncedResize?: (width: number, height: number) => void;

  setupResizeObserver(container: HTMLElement): ResizeObserver {
    // Create debounced handler
    this._debouncedResize = this.debounce(
      (width: number, height: number) => this.handleResize(width, height),
      16  // ~60fps
    );

    // Create ResizeObserver
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this._debouncedResize!(width, height);
      }
    });

    observer.observe(container);
    return observer;
  }

  /**
   * Simple debounce utility.
   */
  private debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => func(...args), wait);
    };
  }
}
```

---

## Solution 4: Clean Event Handler Management

Use DisposableStore pattern for event handler lifecycle:

```typescript
// src/webview/utils/DisposableStore.ts

/**
 * Disposable interface matching VS Code pattern.
 */
export interface IDisposable {
  dispose(): void;
}

/**
 * Stores and manages disposables.
 * Based on VS Code's DisposableStore implementation.
 */
export class DisposableStore implements IDisposable {
  private _disposables = new Set<IDisposable>();
  private _isDisposed = false;

  /**
   * Adds a disposable to the store.
   */
  add<T extends IDisposable>(disposable: T): T {
    if (this._isDisposed) {
      disposable.dispose();
      return disposable;
    }
    this._disposables.add(disposable);
    return disposable;
  }

  /**
   * Clears all disposables without disposing the store itself.
   * Useful for re-attachment scenarios.
   */
  clear(): void {
    if (this._isDisposed) {
      return;
    }
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
    this._disposables.clear();
  }

  /**
   * Disposes all disposables and marks the store as disposed.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this.clear();
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }
}

/**
 * Creates a disposable from a dispose function.
 */
export function toDisposable(fn: () => void): IDisposable {
  return { dispose: fn };
}
```

### Usage

```typescript
// src/webview/managers/TerminalEventManager.ts

import { DisposableStore, toDisposable } from '../utils/DisposableStore';
import { Terminal } from '@xterm/xterm';

export class TerminalEventManager {
  private _coreDisposables = new DisposableStore();
  private _attachmentDisposables = new DisposableStore();
  private _terminal: Terminal;

  constructor(terminal: Terminal) {
    this._terminal = terminal;
  }

  /**
   * Register core event handlers (called once during creation).
   */
  registerCoreHandlers(
    onData: (data: string) => void,
    onResize: (dims: { cols: number; rows: number }) => void
  ): void {
    // Terminal data events
    this._coreDisposables.add(
      toDisposable(() => {
        // xterm.js doesn't provide disposable directly
        // Store the listener for manual cleanup
        const handler = this._terminal.onData(onData);
        return () => handler.dispose();
      }())
    );

    // Terminal resize events
    this._coreDisposables.add(
      toDisposable(() => {
        const handler = this._terminal.onResize(onResize);
        return () => handler.dispose();
      }())
    );
  }

  /**
   * Register attachment-specific handlers (can be called multiple times).
   */
  registerAttachmentHandlers(container: HTMLElement): void {
    // Clear old handlers
    this._attachmentDisposables.clear();

    // Focus handlers
    const handleFocus = () => console.log('Terminal focused');
    const handleBlur = () => console.log('Terminal blurred');

    container.addEventListener('focus', handleFocus);
    container.addEventListener('blur', handleBlur);

    this._attachmentDisposables.add(toDisposable(() => {
      container.removeEventListener('focus', handleFocus);
      container.removeEventListener('blur', handleBlur);
    }));

    // Mouse wheel handler (passive for performance)
    const handleWheel = (e: WheelEvent) => {
      // Handle wheel events
    };

    container.addEventListener('wheel', handleWheel, { passive: true });

    this._attachmentDisposables.add(toDisposable(() => {
      container.removeEventListener('wheel', handleWheel);
    }));
  }

  /**
   * Cleanup all handlers.
   */
  dispose(): void {
    this._coreDisposables.dispose();
    this._attachmentDisposables.dispose();
  }
}
```

---

## Complete Integration Example

Putting it all together in a terminal manager:

```typescript
// src/webview/managers/LightweightTerminalWebviewManager.ts

import { Terminal } from '@xterm/xterm';
import { AutoOpenBarrier } from '../utils/Barrier';
import { DomReadyDetector } from '../utils/DomReadyDetector';
import { TerminalResizeManager } from './TerminalResizeManager';
import { TerminalEventManager } from './TerminalEventManager';
import { DisposableStore } from '../utils/DisposableStore';

export class LightweightTerminalWebviewManager {
  private _terminal: Terminal | null = null;
  private _terminalAttached: boolean = false;
  private _domReadyBarrier = new AutoOpenBarrier(100);
  private _domDetector: DomReadyDetector | null = null;
  private _resizeManager: TerminalResizeManager | null = null;
  private _eventManager: TerminalEventManager | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _disposables = new DisposableStore();

  /**
   * Initializes the terminal with single-execution guarantees.
   */
  async initialize(container: HTMLElement): Promise<void> {
    // Guard 1: Already attached
    if (this._terminalAttached) {
      console.log('Terminal already attached - skipping initialization');
      return;
    }

    // Guard 2: Terminal already has element
    if (this._terminal?.element) {
      console.log('Terminal already opened - skipping initialization');
      return;
    }

    // Create terminal instance if needed
    if (!this._terminal) {
      this._terminal = new Terminal({
        // ... terminal options
      });
    }

    // Start DOM readiness detection
    this._domDetector = new DomReadyDetector(container);
    this._disposables.add(this._domDetector);

    // Wait for DOM to be ready
    console.log('Waiting for DOM readiness...');
    await this._domDetector.wait();
    console.log('DOM is ready');

    // Open terminal (guaranteed single execution)
    console.log('Opening terminal...');
    this._terminal.open(container);
    this._terminalAttached = true;

    // Initialize managers
    this._resizeManager = new TerminalResizeManager(this._terminal);
    this._resizeManager.initializeFontMetrics();

    this._eventManager = new TerminalEventManager(this._terminal);
    this._eventManager.registerCoreHandlers(
      (data) => this.handleTerminalData(data),
      (dims) => this.handleTerminalResize(dims)
    );
    this._eventManager.registerAttachmentHandlers(container);

    // Setup ResizeObserver with debouncing
    this._resizeObserver = this._resizeManager.setupResizeObserver(container);
    this._disposables.add({
      dispose: () => this._resizeObserver?.disconnect()
    });

    // Initial resize
    const rect = container.getBoundingClientRect();
    await this._resizeManager.handleResize(rect.width, rect.height);

    console.log('Terminal initialization complete');
  }

  /**
   * Call this when layout dimensions are confirmed (e.g., from extension).
   */
  onLayoutConfirmed(width: number, height: number): void {
    // Signal DOM is definitely ready
    this._domDetector?.signalReady();

    // Perform resize
    this._resizeManager?.handleResize(width, height);
  }

  /**
   * Handle terminal data output.
   */
  private handleTerminalData(data: string): void {
    // Send to extension host
    // vscode.postMessage({ type: 'terminalData', data });
  }

  /**
   * Handle terminal resize events.
   */
  private handleTerminalResize(dims: { cols: number; rows: number }): void {
    // Send to extension host
    // vscode.postMessage({ type: 'terminalResize', cols: dims.cols, rows: dims.rows });
  }

  /**
   * Cleanup all resources.
   */
  dispose(): void {
    this._disposables.dispose();
    this._eventManager?.dispose();
    this._terminal?.dispose();
    this._resizeObserver?.disconnect();
  }
}
```

---

## Testing the Implementation

Create tests to verify single initialization:

```typescript
// src/webview/utils/__tests__/DomReadyDetector.test.ts

import { DomReadyDetector } from '../DomReadyDetector';

describe('DomReadyDetector', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should detect when DOM has valid dimensions', async () => {
    // Set dimensions
    container.style.width = '800px';
    container.style.height = '600px';

    const detector = new DomReadyDetector(container);
    const ready = await detector.wait();

    expect(ready).toBe(true);
    detector.dispose();
  });

  it('should timeout if dimensions never become valid', async () => {
    // Leave dimensions at 0
    const detector = new DomReadyDetector(container);

    const start = Date.now();
    await detector.wait();
    const elapsed = Date.now() - start;

    // Should timeout around 100ms
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(150);

    detector.dispose();
  });

  it('should allow manual signaling', async () => {
    const detector = new DomReadyDetector(container);

    // Signal manually before dimensions are valid
    setTimeout(() => detector.signalReady(), 10);

    const start = Date.now();
    await detector.wait();
    const elapsed = Date.now() - start;

    // Should complete quickly due to manual signal
    expect(elapsed).toBeLessThan(50);

    detector.dispose();
  });
});
```

---

## Summary

This implementation guide provides:

1. **AutoOpenBarrier** - Prevents indefinite waiting with timeout protection
2. **DomReadyDetector** - Multi-strategy DOM readiness detection
3. **Manual Dimensions** - Replaces fit() addon with explicit calculations
4. **DisposableStore** - Clean event handler lifecycle management
5. **Complete Integration** - Working example with all patterns combined

**Key Benefits:**
- ✅ Guaranteed single terminal.open() execution
- ✅ No race conditions between DOM and initialization
- ✅ No initial ResizeObserver callback issues
- ✅ Clean disposal and re-attachment support
- ✅ Debounced resize operations
- ✅ Follows VS Code's battle-tested patterns

**Next Steps:**
1. Implement AutoOpenBarrier and Barrier classes
2. Create DomReadyDetector utility
3. Replace fit() addon with manual dimension calculation
4. Integrate DisposableStore for event management
5. Update TerminalLifecycleManager with guards
6. Add tests to verify single initialization
