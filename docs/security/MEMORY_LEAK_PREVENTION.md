# Memory Leak Prevention Guide

## Overview

This guide documents the memory leak prevention patterns and best practices for the VS Code Sidebar Terminal extension. It addresses the issues identified in [Issue #232](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/232).

## Table of Contents

1. [Common Memory Leak Sources](#common-memory-leak-sources)
2. [Disposal Patterns](#disposal-patterns)
3. [DisposableStore Pattern](#disposablestore-pattern)
4. [Testing for Memory Leaks](#testing-for-memory-leaks)
5. [Best Practices](#best-practices)
6. [Examples](#examples)

## Common Memory Leak Sources

### 1. VS Code Event Subscriptions

Event subscriptions using `onDid*` events must be disposed:

```typescript
// ❌ BAD: Event subscription without disposal
class MyClass {
  constructor() {
    vscode.workspace.onDidChangeConfiguration(() => {
      // ...
    });
  }
}

// ✅ GOOD: Event subscription with disposal
class MyClass implements vscode.Disposable {
  private readonly _disposables = new DisposableStore();

  constructor() {
    this._disposables.add(
      vscode.workspace.onDidChangeConfiguration(() => {
        // ...
      })
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }
}
```

### 2. Terminal Process Listeners

PTY event handlers must be cleaned up:

```typescript
// ❌ BAD: PTY listener without disposal tracking
ptyProcess.onData((data) => {
  // ...
});

// ✅ GOOD: PTY listener with disposal tracking
const dataDisposable = ptyProcess.onData((data) => {
  // ...
});
this._ptyDataDisposables.set(terminalId, dataDisposable);

// Later in dispose():
for (const disposable of this._ptyDataDisposables.values()) {
  disposable.dispose();
}
this._ptyDataDisposables.clear();
```

### 3. WebView Message Handlers

DOM event listeners must be removed:

```typescript
// ❌ BAD: Event listener without removal
window.addEventListener('message', handleMessage);

// ✅ GOOD: Event listener with removal tracking
const handleMessage = (event: MessageEvent) => {
  // ...
};

window.addEventListener('message', handleMessage);

// Later in cleanup:
window.removeEventListener('message', handleMessage);
```

### 4. Timer References

Timers must be cleared:

```typescript
// ❌ BAD: Timer without cleanup
setInterval(() => {
  // ...
}, 1000);

// ✅ GOOD: Timer with cleanup
private _timer: NodeJS.Timeout | undefined;

this._timer = setInterval(() => {
  // ...
}, 1000);

// Later in dispose():
if (this._timer) {
  clearInterval(this._timer);
  this._timer = undefined;
}
```

### 5. Large Object References

Large objects should be cleared:

```typescript
// ❌ BAD: Terminal state not released
class TerminalManager {
  private _terminals = new Map<string, TerminalInstance>();

  dispose(): void {
    // Forgot to clear terminals
  }
}

// ✅ GOOD: Terminal state properly cleared
class TerminalManager {
  private _terminals = new Map<string, TerminalInstance>();

  dispose(): void {
    for (const terminal of this._terminals.values()) {
      // Clean up terminal resources
      terminal.pty?.kill();
    }
    this._terminals.clear();
  }
}
```

## Disposal Patterns

### Basic Disposable Pattern

All classes that manage resources should implement `vscode.Disposable`:

```typescript
import * as vscode from 'vscode';

class MyResourceManager implements vscode.Disposable {
  private _resource: SomeResource;

  constructor() {
    this._resource = new SomeResource();
  }

  dispose(): void {
    // Clean up resources
    this._resource.cleanup();
  }
}
```

### LIFO Disposal Order

Dispose resources in reverse order of creation (Last In, First Out):

```typescript
dispose(): void {
  // Dispose in reverse order
  for (let i = this._disposables.length - 1; i >= 0; i--) {
    this._disposables[i]?.dispose();
  }
  this._disposables = [];
}
```

### Error Handling in Disposal

Disposal should be resilient to errors:

```typescript
dispose(): void {
  for (const disposable of this._disposables) {
    try {
      disposable.dispose();
    } catch (error) {
      console.error('[Disposal] Error:', error);
      // Continue disposing other resources
    }
  }
  this._disposables = [];
}
```

## DisposableStore Pattern

The `DisposableStore` class provides a convenient way to manage multiple disposables:

```typescript
import { DisposableStore } from '../utils/DisposableStore';

class MyClass implements vscode.Disposable {
  private readonly _disposables = new DisposableStore();

  constructor() {
    // Add disposables to the store
    this._disposables.add(
      vscode.workspace.onDidChangeConfiguration(() => {
        // ...
      })
    );

    this._disposables.add(
      vscode.window.onDidChangeActiveTerminal(() => {
        // ...
      })
    );

    // You can also add custom disposables
    this._disposables.add({
      dispose: () => {
        // Custom cleanup logic
      }
    });
  }

  dispose(): void {
    // Dispose all at once
    this._disposables.dispose();
  }
}
```

### DisposableStore Features

- **Automatic cleanup**: Disposes all registered disposables when the store is disposed
- **LIFO order**: Disposes in reverse order of registration
- **Error handling**: Continues disposal even if individual disposables throw errors
- **Protection**: Prevents adding disposables after the store is disposed

## Testing for Memory Leaks

### Using MemoryLeakDetector

```typescript
import { MemoryLeakDetector } from './utils/MemoryLeakDetector';

describe('MyClass', () => {
  it('should not leak memory', async () => {
    const detector = new MemoryLeakDetector();
    await detector.startMonitoring();

    // Create and dispose instances
    for (let i = 0; i < 100; i++) {
      const instance = new MyClass();
      instance.dispose();
    }

    const result = await detector.checkForLeaks();

    console.log(detector.generateReport());
    expect(result.hasLeak).to.be.false;
  });
});
```

### Stress Testing Disposal

```typescript
import { DisposalStressTest } from './utils/MemoryLeakDetector';

it('should handle stress test', async () => {
  const result = await DisposalStressTest.stressTest(
    () => new MyClass(),
    iterations: 1000
  );

  expect(result.hasLeak).to.be.false;
});
```

### Running Tests with GC

To enable garbage collection in tests, run with the `--expose-gc` flag:

```bash
mocha --require ts-node/register --expose-gc test/**/*.test.ts
```

## Best Practices

### 1. Always Implement Disposable

If your class manages any resources (event subscriptions, timers, file handles, etc.), implement `vscode.Disposable`:

```typescript
class MyClass implements vscode.Disposable {
  dispose(): void {
    // Clean up resources
  }
}
```

### 2. Use DisposableStore for Multiple Subscriptions

When managing multiple disposables, use `DisposableStore`:

```typescript
private readonly _disposables = new DisposableStore();
```

### 3. Track All Timers

Store timer references and clear them on disposal:

```typescript
private _timers: Set<NodeJS.Timeout> = new Set();

createTimer() {
  const timer = setTimeout(() => {}, 1000);
  this._timers.add(timer);
}

dispose() {
  for (const timer of this._timers) {
    clearTimeout(timer);
  }
  this._timers.clear();
}
```

### 4. Clear Collections

Clear all Maps, Sets, and Arrays in disposal:

```typescript
dispose() {
  this._map.clear();
  this._set.clear();
  this._array = [];
}
```

### 5. Null Out Large References

Set large object references to null/undefined:

```typescript
dispose() {
  this._largeObject?.cleanup();
  this._largeObject = undefined;
}
```

### 6. Test for Memory Leaks

Write memory leak tests for classes that manage resources:

```typescript
it('should not leak memory', async () => {
  // Use MemoryLeakDetector to verify
});
```

### 7. Document Disposal Requirements

Document which resources need disposal:

```typescript
/**
 * Manages terminal connections.
 *
 * IMPORTANT: Must call dispose() to clean up:
 * - PTY processes
 * - Event subscriptions
 * - Timer references
 */
class TerminalManager implements vscode.Disposable {
  // ...
}
```

### 8. Use Context Subscriptions

For extension-level resources, add to context.subscriptions:

```typescript
export function activate(context: vscode.ExtensionContext) {
  const myService = new MyService();
  context.subscriptions.push(myService);

  // VS Code will automatically dispose when extension deactivates
}
```

### 9. Avoid Circular References

Circular references can prevent garbage collection:

```typescript
// ❌ BAD: Circular reference
class Parent {
  child = new Child(this);
}
class Child {
  constructor(public parent: Parent) {}
}

// ✅ GOOD: Break the cycle in disposal
class Parent implements vscode.Disposable {
  child = new Child(this);

  dispose() {
    (this.child as any).parent = undefined;
    this.child.dispose();
  }
}
```

### 10. Monitor Extension Memory Usage

Regularly check extension memory usage in VS Code:

1. Open Command Palette
2. Run "Developer: Show Running Extensions"
3. Check memory usage for your extension

## Examples

### Complete Class with Proper Disposal

```typescript
import * as vscode from 'vscode';
import { DisposableStore } from '../utils/DisposableStore';

export class ExampleService implements vscode.Disposable {
  private readonly _disposables = new DisposableStore();
  private readonly _timers = new Set<NodeJS.Timeout>();
  private readonly _cache = new Map<string, any>();
  private _resource: SomeResource | undefined;

  constructor() {
    // Set up event subscriptions
    this._disposables.add(
      vscode.workspace.onDidChangeConfiguration(() => {
        this.handleConfigChange();
      })
    );

    this._disposables.add(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.handleEditorChange();
      })
    );

    // Initialize resource
    this._resource = new SomeResource();

    // Set up periodic cleanup
    const cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000);
    this._timers.add(cleanupTimer);
  }

  private handleConfigChange(): void {
    // ...
  }

  private handleEditorChange(): void {
    // ...
  }

  private cleanup(): void {
    // Clean up old cache entries
    for (const [key, value] of this._cache.entries()) {
      if (this.isExpired(value)) {
        this._cache.delete(key);
      }
    }
  }

  private isExpired(value: any): boolean {
    // Check if value is expired
    return false;
  }

  public dispose(): void {
    // Dispose all event subscriptions
    this._disposables.dispose();

    // Clear all timers
    for (const timer of this._timers) {
      clearInterval(timer);
    }
    this._timers.clear();

    // Clear cache
    this._cache.clear();

    // Clean up resource
    if (this._resource) {
      this._resource.cleanup();
      this._resource = undefined;
    }
  }
}
```

## References

- [VS Code Extension API - Disposable](https://code.visualstudio.com/api/references/vscode-api#Disposable)
- [VS Code Extension Guidelines - Memory Leaks](https://code.visualstudio.com/api/references/extension-guidelines#avoid-memory-leaks)
- [Issue #232: Memory Leak Detection](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/232)

## Checklist

Before committing code that manages resources, verify:

- [ ] Class implements `vscode.Disposable`
- [ ] All event subscriptions are tracked and disposed
- [ ] All timers are stored and cleared
- [ ] All large objects are cleared/nulled
- [ ] Collections (Map, Set, Array) are cleared
- [ ] PTY listeners are disposed
- [ ] Memory leak tests are written
- [ ] Disposal is in LIFO order
- [ ] Error handling in disposal
- [ ] Documentation mentions disposal requirements

---

Last updated: 2025-11-12
Related: Issue #232 - Memory Leak Detection
