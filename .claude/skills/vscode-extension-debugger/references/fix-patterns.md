# Proven Fix Implementation Patterns

## Defensive Programming Patterns

### Guard Clause Pattern

Early return for invalid states to avoid deep nesting.

```typescript
async function processTerminal(id: number): Promise<void> {
  // Guard: Validate input
  if (!Number.isInteger(id) || id < 1) {
    throw new Error(`Invalid terminal ID: ${id}`);
  }

  // Guard: Check existence
  const terminal = this.terminals.get(id);
  if (!terminal) {
    console.warn(`Terminal ${id} not found`);
    return;
  }

  // Guard: Check state
  if (terminal.disposed) {
    console.warn(`Terminal ${id} already disposed`);
    return;
  }

  // Safe to proceed with main logic
  await terminal.process();
}
```

### Null Object Pattern

Avoid null checks by providing default behavior.

```typescript
interface Logger {
  log(message: string): void;
  error(message: string, error: Error): void;
}

// Null object that does nothing
const NullLogger: Logger = {
  log: () => {},
  error: () => {}
};

class TerminalManager {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? NullLogger; // Never null
  }

  createTerminal(): void {
    this.logger.log('Creating terminal'); // Safe, no null check needed
  }
}
```

### Option Type Pattern

Explicit handling of optional values.

```typescript
type Option<T> = { value: T; hasValue: true } | { hasValue: false };

function findTerminal(id: number): Option<Terminal> {
  const terminal = this.terminals.get(id);
  if (terminal) {
    return { value: terminal, hasValue: true };
  }
  return { hasValue: false };
}

// Usage forces explicit handling
const result = findTerminal(1);
if (result.hasValue) {
  result.value.write('Hello'); // Safe
} else {
  console.log('Terminal not found');
}
```

## Resource Management Patterns

### Disposable Store Pattern

Centralized management of disposable resources.

```typescript
class DisposableStore implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private disposed = false;

  add<T extends vscode.Disposable>(disposable: T): T {
    if (this.disposed) {
      console.warn('Adding to disposed store');
      disposable.dispose();
    } else {
      this.disposables.push(disposable);
    }
    return disposable;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // LIFO order for proper dependency handling
    const items = this.disposables.splice(0);
    for (let i = items.length - 1; i >= 0; i--) {
      try {
        items[i].dispose();
      } catch (e) {
        console.error('Dispose error:', e);
      }
    }
  }
}

// Usage
class MyService {
  private store = new DisposableStore();

  initialize(context: vscode.ExtensionContext): void {
    this.store.add(
      vscode.workspace.onDidChangeConfiguration(() => this.refresh())
    );
    this.store.add(
      vscode.window.onDidChangeActiveTextEditor(() => this.update())
    );

    context.subscriptions.push(this.store);
  }
}
```

### RAII Pattern (Resource Acquisition Is Initialization)

```typescript
async function withTerminal<T>(
  manager: TerminalManager,
  action: (terminal: Terminal) => Promise<T>
): Promise<T> {
  const terminal = await manager.createTerminal();
  try {
    return await action(terminal);
  } finally {
    await manager.disposeTerminal(terminal.id);
  }
}

// Usage - terminal automatically disposed
const result = await withTerminal(manager, async (terminal) => {
  await terminal.sendText('npm test');
  return terminal.waitForOutput(/PASSED|FAILED/);
});
```

### Lazy Initialization Pattern

```typescript
class LazyResource<T> {
  private value: T | undefined;
  private initializer: () => T;

  constructor(initializer: () => T) {
    this.initializer = initializer;
  }

  get(): T {
    if (this.value === undefined) {
      this.value = this.initializer();
    }
    return this.value;
  }

  reset(): void {
    this.value = undefined;
  }
}

// Usage
const expensiveService = new LazyResource(() => {
  console.log('Initializing expensive service...');
  return new ExpensiveService();
});

// Only initializes on first access
expensiveService.get().doWork();
```

## Concurrency Patterns

### Mutex/Lock Pattern

```typescript
class Mutex {
  private locked = false;
  private queue: Array<() => void> = [];

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (!this.locked) {
          this.locked = true;
          resolve(() => this.release());
        } else {
          this.queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }

  private release(): void {
    this.locked = false;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

// Usage
class TerminalManager {
  private mutex = new Mutex();

  async createTerminal(): Promise<Terminal> {
    const unlock = await this.mutex.acquire();
    try {
      return await this.doCreateTerminal();
    } finally {
      unlock();
    }
  }
}
```

### Semaphore Pattern

```typescript
class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (this.permits > 0) {
          this.permits--;
          resolve(() => this.release());
        } else {
          this.queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }

  private release(): void {
    this.permits++;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

// Usage: Limit concurrent terminal operations
const terminalSemaphore = new Semaphore(3); // Max 3 concurrent

async function runInTerminal(command: string): Promise<void> {
  const release = await terminalSemaphore.acquire();
  try {
    await executeCommand(command);
  } finally {
    release();
  }
}
```

### Debounce Pattern

```typescript
function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | undefined;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = undefined;
    }, delay);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  return debounced;
}

// Usage
const debouncedResize = debounce((width: number, height: number) => {
  terminal.resize(width, height);
}, 100);

// Cleanup
context.subscriptions.push({
  dispose: () => debouncedResize.cancel()
});
```

### Throttle Pattern

```typescript
function throttle<T extends (...args: any[]) => void>(
  fn: T,
  limit: number
): T {
  let inThrottle = false;
  let lastArgs: Parameters<T> | undefined;

  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = undefined;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  }) as T;
}

// Usage
const throttledUpdate = throttle((data: string) => {
  webview.postMessage({ type: 'update', data });
}, 16); // 60fps max
```

## Error Handling Patterns

### Result Type Pattern

```typescript
type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

function createTerminal(config: TerminalConfig): Result<Terminal> {
  try {
    const terminal = new Terminal(config);
    return { success: true, value: terminal };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

// Usage forces error handling
const result = createTerminal(config);
if (result.success) {
  result.value.show();
} else {
  vscode.window.showErrorMessage(`Failed: ${result.error.message}`);
}
```

### Retry Pattern

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 2,
    shouldRetry = () => true
  } = options;

  let lastError: Error;
  let currentDelay = delay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw lastError;
      }

      console.log(`Attempt ${attempt} failed, retrying in ${currentDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= backoff;
    }
  }

  throw lastError!;
}

// Usage
const terminal = await withRetry(
  () => createTerminal(),
  {
    maxAttempts: 3,
    delay: 500,
    shouldRetry: (error) => error.message.includes('EBUSY')
  }
);
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 30000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}

// Usage
const terminalCircuit = new CircuitBreaker(3, 10000);

async function createTerminalSafe(): Promise<Terminal> {
  return terminalCircuit.execute(() => createTerminal());
}
```

## State Management Patterns

### State Machine Pattern

```typescript
type TerminalState = 'idle' | 'creating' | 'running' | 'disposing' | 'disposed';

type TerminalTransition =
  | { from: 'idle'; to: 'creating' }
  | { from: 'creating'; to: 'running' | 'disposed' }
  | { from: 'running'; to: 'disposing' }
  | { from: 'disposing'; to: 'disposed' };

class TerminalStateMachine {
  private state: TerminalState = 'idle';

  private transitions: Map<string, TerminalState[]> = new Map([
    ['idle', ['creating']],
    ['creating', ['running', 'disposed']],
    ['running', ['disposing']],
    ['disposing', ['disposed']]
  ]);

  canTransition(to: TerminalState): boolean {
    const allowed = this.transitions.get(this.state);
    return allowed?.includes(to) ?? false;
  }

  transition(to: TerminalState): void {
    if (!this.canTransition(to)) {
      throw new Error(`Invalid transition: ${this.state} -> ${to}`);
    }
    this.state = to;
  }

  getState(): TerminalState {
    return this.state;
  }
}
```

### Event Emitter Pattern

```typescript
type EventMap = {
  terminalCreated: { id: number };
  terminalDisposed: { id: number };
  error: { message: string; error: Error };
};

class TypedEventEmitter<T extends Record<string, any>> {
  private listeners = new Map<keyof T, Set<(data: any) => void>>();

  on<K extends keyof T>(event: K, listener: (data: T[K]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => this.off(event, listener);
  }

  off<K extends keyof T>(event: K, listener: (data: T[K]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.listeners.get(event)?.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${String(event)}:`, error);
      }
    });
  }
}

// Usage
const events = new TypedEventEmitter<EventMap>();

const unsubscribe = events.on('terminalCreated', ({ id }) => {
  console.log(`Terminal ${id} created`);
});

events.emit('terminalCreated', { id: 1 });
unsubscribe(); // Cleanup
```

## WebView Communication Patterns

### Message Queue Pattern

```typescript
interface Message {
  type: string;
  data?: unknown;
  id?: string;
}

class MessageQueue {
  private queue: Message[] = [];
  private ready = false;
  private webview: vscode.Webview | undefined;

  setWebview(webview: vscode.Webview): void {
    this.webview = webview;
  }

  setReady(ready: boolean): void {
    this.ready = ready;
    if (ready) {
      this.flush();
    }
  }

  send(message: Message): void {
    if (this.ready && this.webview) {
      this.webview.postMessage(message);
    } else {
      this.queue.push(message);
    }
  }

  private flush(): void {
    if (!this.webview) return;

    while (this.queue.length > 0) {
      const message = this.queue.shift()!;
      this.webview.postMessage(message);
    }
  }

  clear(): void {
    this.queue = [];
    this.ready = false;
  }
}
```

### Request-Response Pattern

```typescript
class RequestResponseHandler {
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  async request<T>(
    webview: vscode.Webview,
    type: string,
    data?: unknown,
    timeoutMs = 5000
  ): Promise<T> {
    const id = crypto.randomUUID();

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${type} timed out`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      webview.postMessage({ type, data, id });
    });
  }

  handleResponse(message: { id?: string; result?: unknown; error?: string }): boolean {
    if (!message.id) return false;

    const pending = this.pendingRequests.get(message.id);
    if (!pending) return false;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(message.id);

    if (message.error) {
      pending.reject(new Error(message.error));
    } else {
      pending.resolve(message.result);
    }

    return true;
  }

  dispose(): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Handler disposed'));
    }
    this.pendingRequests.clear();
  }
}
```

## Testing Patterns

### Test Double Pattern

```typescript
// Interface for dependency
interface ITerminalService {
  create(config: TerminalConfig): Promise<Terminal>;
  dispose(id: number): Promise<void>;
}

// Fake implementation for testing
class FakeTerminalService implements ITerminalService {
  private terminals = new Map<number, Terminal>();
  private nextId = 1;

  createCalls: TerminalConfig[] = [];
  disposeCalls: number[] = [];

  async create(config: TerminalConfig): Promise<Terminal> {
    this.createCalls.push(config);
    const terminal = { id: this.nextId++, config } as Terminal;
    this.terminals.set(terminal.id, terminal);
    return terminal;
  }

  async dispose(id: number): Promise<void> {
    this.disposeCalls.push(id);
    this.terminals.delete(id);
  }

  reset(): void {
    this.terminals.clear();
    this.createCalls = [];
    this.disposeCalls = [];
    this.nextId = 1;
  }
}

// Usage in tests
describe('TerminalManager', () => {
  let fakeService: FakeTerminalService;
  let manager: TerminalManager;

  beforeEach(() => {
    fakeService = new FakeTerminalService();
    manager = new TerminalManager(fakeService);
  });

  it('should create terminal with correct config', async () => {
    await manager.createTerminal({ shell: '/bin/bash' });

    expect(fakeService.createCalls).toHaveLength(1);
    expect(fakeService.createCalls[0].shell).toBe('/bin/bash');
  });
});
```

### Snapshot Testing Pattern

```typescript
function captureState(manager: TerminalManager): object {
  return {
    terminalCount: manager.getTerminalCount(),
    activeTerminalId: manager.getActiveTerminalId(),
    terminalIds: manager.getAllTerminalIds(),
    state: manager.getState()
  };
}

// In tests
it('should maintain consistent state after operations', async () => {
  const manager = new TerminalManager();

  await manager.createTerminal();
  await manager.createTerminal();
  const snapshot1 = captureState(manager);

  await manager.disposeTerminal(1);
  const snapshot2 = captureState(manager);

  expect(snapshot1).toMatchSnapshot('after-create-two');
  expect(snapshot2).toMatchSnapshot('after-dispose-one');
});
```
