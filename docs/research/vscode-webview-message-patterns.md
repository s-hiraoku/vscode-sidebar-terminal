# VS Code WebView Message Patterns - Research Report

## メッセージキュー管理パターン (Extension ↔ WebView Communication)

**調査日**: 2025-11-05
**焦点**: VS Code標準パターンを参考にした、堅牢なメッセージ通信アーキテクチャ

---

## 1. VS Code Message Protocol Overview

### Core Communication Pattern

```
┌─────────────┐                    ┌─────────────┐
│  Extension  │                    │   WebView   │
│   Process   │◄──────────────────►│   Process   │
└─────────────┘                    └─────────────┘
       │                                  │
       │  postMessage()                   │
       ├─────────────────────────────────►│
       │                                  │
       │  onDidReceiveMessage()           │
       │◄─────────────────────────────────┤
       │                                  │
```

**Key Characteristics**:
- **Asynchronous**: No blocking operations
- **One-Way**: Each direction is independent
- **No Acknowledgment**: Built-in VS Code API has no ACK mechanism
- **Fire-and-Forget**: Messages may be lost if receiver not ready

---

## 2. Message Queue Implementation Patterns

### Pattern A: Simple Queue (No Acknowledgment)

**Current Project Implementation** (`WebViewCommunicationService.ts`):

```typescript
class WebViewCommunicationService {
  private _messageQueue: WebviewMessage[] = [];
  private _isWebViewReady = false;

  async sendMessage(message: WebviewMessage): Promise<void> {
    if (!this._isWebViewReady) {
      // Queue message if WebView not ready
      this._messageQueue.push(message);
      return;
    }

    // Send immediately
    await this._view?.webview.postMessage(message);
  }

  setWebViewReady(): void {
    this._isWebViewReady = true;

    // Flush queue
    while (this._messageQueue.length > 0) {
      const message = this._messageQueue.shift();
      await this._view?.webview.postMessage(message);
    }
  }
}
```

**Assessment**:
- ✅ **Good**: Prevents message loss during initialization
- ⚠️ **Limitation**: No delivery confirmation
- ⚠️ **Limitation**: No retry on failure

### Pattern B: Request-Response Pattern

**Recommended Pattern** (VS Code-inspired):

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
      // Set timeout
      const timeout = setTimeout(() => {
        this._pendingRequests.delete(messageId);
        reject(new Error(`Request timeout: ${message.command}`));
      }, timeoutMs);

      // Store resolver
      this._pendingRequests.set(messageId, { resolve, reject, timeout });

      // Send message
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
```

**Usage Example**:
```typescript
// Extension side
const scrollbackData = await messageService.sendRequestWithResponse({
  command: 'requestScrollback',
  terminalId: 'terminal-1',
  limit: 1000
});

// WebView side (responds)
if (message.requiresResponse) {
  vscode.postMessage({
    command: 'scrollbackDataCollected',
    messageId: message.messageId,  // Echo back message ID
    data: scrollbackLines
  });
}
```

---

## 3. Message Priority and Ordering

### VS Code Pattern: Priority Queues

VS Code uses **priority levels** for different message types:

```typescript
enum MessagePriority {
  Critical = 0,    // Initialization, errors
  High = 1,        // User actions, commands
  Normal = 2,      // State updates
  Low = 3          // Background updates
}

class PriorityMessageQueue {
  private _queues: Map<MessagePriority, WebviewMessage[]>;

  enqueue(message: WebviewMessage, priority: MessagePriority): void {
    const queue = this._queues.get(priority) || [];
    queue.push(message);
    this._queues.set(priority, queue);
  }

  dequeue(): WebviewMessage | undefined {
    // Process in priority order
    for (const priority of [
      MessagePriority.Critical,
      MessagePriority.High,
      MessagePriority.Normal,
      MessagePriority.Low
    ]) {
      const queue = this._queues.get(priority);
      if (queue && queue.length > 0) {
        return queue.shift();
      }
    }
    return undefined;
  }
}
```

**Current Project**: Uses **simple FIFO queue** (no priority)

**Recommendation**: Add priority for:
- **Critical**: `webviewReady`, `extensionReady`, errors
- **High**: `terminalCreated`, `terminalDeleted`, user input
- **Normal**: `output`, `stateUpdate`
- **Low**: `performance metrics`, debug logs

---

## 4. Message Batching and Throttling

### VS Code Pattern: Debounced Output

VS Code batches high-frequency messages to prevent UI freezing:

```typescript
class OutputBatcher {
  private _buffer: string[] = [];
  private _flushTimeout: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL = 16; // 60fps

  addOutput(data: string): void {
    this._buffer.push(data);

    // Schedule flush
    if (!this._flushTimeout) {
      this._flushTimeout = setTimeout(() => {
        this._flush();
      }, this.FLUSH_INTERVAL);
    }
  }

  private _flush(): void {
    if (this._buffer.length === 0) return;

    // Combine all buffered output
    const combinedOutput = this._buffer.join('');
    this._buffer = [];
    this._flushTimeout = null;

    // Send single message
    this._sendMessage({
      command: 'output',
      data: combinedOutput
    });
  }
}
```

**Current Project Implementation** (`PerformanceManager`):
```typescript
// src/webview/managers/PerformanceManager.ts
private readonly BUFFER_FLUSH_INTERVAL = 16; // 60fps
private readonly CLI_AGENT_FLUSH_INTERVAL = 4; // 250fps for AI agents

// ✅ EXCELLENT: Adaptive flush interval based on content
```

**Assessment**: ✅ Current implementation follows VS Code pattern correctly

---

## 5. WebView Ready Detection

### VS Code Pattern: Bidirectional Handshake

```
Extension                          WebView
    |                                 |
    | (HTML loaded)                   |
    ├────────────────────────────────►|
    |                                 | (DOM ready)
    |                                 | (Managers created)
    |                                 |
    |        webviewReady             |
    |◄────────────────────────────────┤
    |                                 |
    | extensionReady + initial state  |
    ├────────────────────────────────►|
    |                                 |
    |                                 | (Start rendering)
    |                                 |
```

**Current Project** (`main.ts` Lines 88-110):
```typescript
// ❌ ISSUE: No acknowledgment from Extension
terminalManager.postMessageToExtension({
  command: 'webviewReady',
  timestamp: Date.now(),
});

// ❌ ISSUE: Assumes Extension is ready after 500ms
setTimeout(() => {
  terminalManager.requestLatestState();
  terminalManager.postMessageToExtension({
    command: 'requestSessionRestore',
    timestamp: Date.now(),
  });
}, 500);
```

**Recommended Fix**:
```typescript
// WebView side
async function waitForExtensionReady(): Promise<void> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'extensionReady') {
        window.removeEventListener('message', handler);
        resolve();
      }
    };

    window.addEventListener('message', handler);

    // Send ready signal
    vscode.postMessage({ command: 'webviewReady' });

    // Timeout fallback (10s)
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(); // Proceed anyway
    }, 10000);
  });
}

// Extension side (SecondaryTerminalProvider.ts)
private _handleWebviewReady(message: WebviewMessage): void {
  // Send acknowledgment
  void this._sendMessage({
    command: 'extensionReady',
    timestamp: Date.now(),
    initialState: this._terminalManager.getCurrentState()
  });

  // THEN initialize
  void this._initializationCoordinator.initialize();
}
```

---

## 6. Message Validation and Security

### VS Code Pattern: Type Guards and Validation

```typescript
// Type guard for message validation
function isValidTerminalMessage(msg: unknown): msg is TerminalMessage {
  if (typeof msg !== 'object' || msg === null) return false;

  const message = msg as Record<string, unknown>;

  // Required fields
  if (typeof message.command !== 'string') return false;

  // Command-specific validation
  if (message.command === 'input' && typeof message.data !== 'string') {
    return false;
  }

  return true;
}

// Current Project Implementation
// ✅ EXCELLENT: Uses type guards (type-guards.ts)
export function isWebviewMessage(msg: unknown): msg is WebviewMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const message = msg as Record<string, unknown>;
  return typeof message.command === 'string';
}
```

**Assessment**: ✅ Current implementation follows best practices

---

## 7. Error Handling and Recovery

### VS Code Pattern: Circuit Breaker

```typescript
class MessageCircuitBreaker {
  private _failureCount = 0;
  private _lastFailureTime = 0;
  private _state: 'closed' | 'open' | 'half-open' = 'closed';

  private readonly MAX_FAILURES = 5;
  private readonly RESET_TIMEOUT = 30000; // 30s

  async sendMessage(message: WebviewMessage): Promise<void> {
    // Check circuit state
    if (this._state === 'open') {
      const timeSinceFailure = Date.now() - this._lastFailureTime;
      if (timeSinceFailure < this.RESET_TIMEOUT) {
        throw new Error('Circuit breaker open - too many failures');
      }
      this._state = 'half-open';
    }

    try {
      await this._view?.webview.postMessage(message);

      // Success - reset
      if (this._state === 'half-open') {
        this._state = 'closed';
        this._failureCount = 0;
      }
    } catch (error) {
      this._failureCount++;
      this._lastFailureTime = Date.now();

      if (this._failureCount >= this.MAX_FAILURES) {
        this._state = 'open';
      }

      throw error;
    }
  }
}
```

**Recommendation**: Add circuit breaker for resilience against:
- Extension crashes
- WebView reload loops
- Memory pressure situations

---

## 8. Message Serialization

### VS Code Pattern: Structured Cloning

VS Code uses **structured cloning** for message serialization:

```typescript
// ✅ SUPPORTED: Structured Clone Algorithm
webview.postMessage({
  command: 'output',
  data: 'Hello',
  timestamp: new Date(),  // Date object preserved
  buffer: new Uint8Array([1, 2, 3])  // TypedArray preserved
});

// ❌ NOT SUPPORTED: Functions, Symbols, DOM nodes
webview.postMessage({
  command: 'error',
  callback: () => {}  // Will throw error!
});
```

**Current Project**: Uses JSON-serializable objects only (✅ Good)

**Anti-Pattern to Avoid**:
```typescript
// ❌ BAD: Passing functions
terminalManager.postMessageToExtension({
  command: 'getData',
  callback: (data) => console.log(data)  // ERROR!
});

// ✅ GOOD: Use request-response pattern
const data = await terminalManager.requestData('getData');
console.log(data);
```

---

## 9. Performance Monitoring

### VS Code Pattern: Message Metrics

```typescript
class MessagePerformanceMonitor {
  private _messageStats = new Map<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    maxTime: number;
  }>();

  trackMessage(command: string, duration: number): void {
    const stats = this._messageStats.get(command) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0
    };

    stats.count++;
    stats.totalTime += duration;
    stats.avgTime = stats.totalTime / stats.count;
    stats.maxTime = Math.max(stats.maxTime, duration);

    this._messageStats.set(command, stats);
  }

  getSlowMessages(thresholdMs = 100): string[] {
    return Array.from(this._messageStats.entries())
      .filter(([_, stats]) => stats.avgTime > thresholdMs)
      .map(([command]) => command);
  }
}

// Usage
const start = performance.now();
await webview.postMessage(message);
const duration = performance.now() - start;
monitor.trackMessage(message.command, duration);
```

**Recommendation**: Add performance monitoring for debugging

---

## Best Practices Summary

### ✅ DO: Recommended Patterns

1. **Queue Messages Before WebView Ready**
   ```typescript
   if (!isWebViewReady) {
     queue.push(message);
   } else {
     await sendImmediately(message);
   }
   ```

2. **Use Type Guards for Validation**
   ```typescript
   if (isWebviewMessage(msg)) {
     handleMessage(msg);
   }
   ```

3. **Batch High-Frequency Messages**
   ```typescript
   const batcher = new OutputBatcher(16); // 60fps
   batcher.addOutput(data);
   ```

4. **Implement Handshake Protocol**
   ```typescript
   // Extension acknowledges WebView ready
   await waitForExtensionReady();
   ```

5. **Add Message Timeouts**
   ```typescript
   const response = await sendWithTimeout(message, 5000);
   ```

### ❌ DON'T: Anti-Patterns to Avoid

1. **Don't Send Messages Before Listeners Ready**
   ```typescript
   // ❌ BAD
   webview.html = html;
   webview.postMessage(message); // Lost!

   // ✅ GOOD
   webview.onDidReceiveMessage(handler);
   webview.html = html;
   ```

2. **Don't Use Arbitrary Timeouts**
   ```typescript
   // ❌ BAD
   setTimeout(() => sendMessage(), 500); // Why 500ms?

   // ✅ GOOD
   await waitForEvent('webviewReady');
   sendMessage();
   ```

3. **Don't Serialize Non-Cloneable Objects**
   ```typescript
   // ❌ BAD
   postMessage({ callback: () => {} }); // Error!

   // ✅ GOOD
   postMessage({ messageId: '123' });
   // Use message ID for request-response
   ```

4. **Don't Ignore Message Delivery Failures**
   ```typescript
   // ❌ BAD
   webview.postMessage(message); // Fire and forget

   // ✅ GOOD
   try {
     await webview.postMessage(message);
   } catch (error) {
     queue.push(message); // Retry later
   }
   ```

---

## Implementation Roadmap

### Phase 1: Immediate Improvements (High Priority)

1. **Add Handshake Protocol** ✅
   - Extension sends `extensionReady` acknowledgment
   - WebView waits for acknowledgment before proceeding

2. **Remove Arbitrary Timeouts** ⚠️
   - Replace `setTimeout(() => requestState(), 500)` with event-based triggers

3. **Add Message ID for Request-Response** 🆕
   - Implement `ReliableMessageService` pattern

### Phase 2: Enhanced Reliability (Medium Priority)

4. **Add Message Priority** 🆕
   - Implement `PriorityMessageQueue`
   - Prioritize critical messages (init, errors)

5. **Add Circuit Breaker** 🆕
   - Prevent message flooding on errors
   - Graceful degradation

### Phase 3: Observability (Low Priority)

6. **Add Performance Monitoring** 🆕
   - Track message latency
   - Identify slow message handlers

7. **Add Message Tracing** 🆕
   - Log message flow for debugging
   - Visualize message sequence

---

## Conclusion

### Current Implementation Assessment

| Pattern | Current Status | Recommendation |
|---------|---------------|----------------|
| **Message Queuing** | ✅ Implemented | Maintain |
| **Type Guards** | ✅ Implemented | Maintain |
| **Output Batching** | ✅ Implemented | Maintain |
| **Handshake Protocol** | ⚠️ Partial | **Add acknowledgment** |
| **Request-Response** | ❌ Missing | **Implement for scrollback** |
| **Priority Queue** | ❌ Missing | Consider for future |
| **Circuit Breaker** | ❌ Missing | Consider for resilience |

### Key Takeaways

1. **Current implementation is solid** for basic use cases
2. **Handshake protocol** is the most critical missing piece
3. **Request-response pattern** needed for scrollback requests
4. **Priority queuing** and **circuit breaker** are nice-to-have enhancements

---

## References

- Project Implementation: `WebViewCommunicationService.ts`
- Provider Implementation: `SecondaryTerminalProvider.ts` (Lines 188-221)
- WebView Main: `main.ts` (Lines 88-110)
- Message Types: `type-guards.ts`

**Research By**: Claude Code (AI Assistant)
**Last Updated**: 2025-11-05
