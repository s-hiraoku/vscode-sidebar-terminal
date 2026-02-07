# VS Code Extension Testing Patterns

## Terminal Component Testing

### Testing Terminal Creation Lifecycle

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TerminalManager } from '../../terminals/TerminalManager';
import { ProcessState, InteractionState } from '../../types/terminal';

describe('Terminal Lifecycle Tests', () => {
  let manager: TerminalManager;

  beforeEach(() => {
    manager = TerminalManager.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    manager.dispose();
  });

  it('should transition through lifecycle states', async () => {
    // Arrange
    const stateChanges: ProcessState[] = [];
    manager.onStateChange((state) => stateChanges.push(state));

    // Act
    const terminal = await manager.createTerminal();
    await manager.initializeShell(terminal.id);
    await manager.deleteTerminal(terminal.id);

    // Assert
    expect(stateChanges).toEqual([
      ProcessState.Creating,
      ProcessState.Running,
      ProcessState.Terminated
    ]);
  });

  it('should handle atomic operations correctly', async () => {
    // Arrange
    const createPromises: Promise<void>[] = [];

    // Act - Attempt concurrent creation
    for (let i = 0; i < 3; i++) {
      createPromises.push(manager.createTerminal());
    }

    const results = await Promise.allSettled(createPromises);

    // Assert - All should succeed without duplicates
    const successful = results.filter(r => r.status === 'fulfilled');
    const ids = successful.map(r => (r as PromiseFulfilledResult<any>).value.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});
```

### Testing Terminal ID Recycling

```typescript
describe('Terminal ID Recycling Tests', () => {
  it('should recycle IDs in order 1-5', async () => {
    // Create 5 terminals
    const terminals = [];
    for (let i = 0; i < 5; i++) {
      terminals.push(await manager.createTerminal());
    }

    // Verify IDs are 1-5
    const ids = terminals.map(t => t.id);
    expect(ids).toEqual([1, 2, 3, 4, 5]);

    // Delete terminal 2 and 4
    await manager.deleteTerminal(2);
    await manager.deleteTerminal(4);

    // Create new terminal - should get ID 2 (lowest available)
    const newTerminal1 = await manager.createTerminal();
    expect(newTerminal1.id).toBe(2);

    // Create another - should get ID 4
    const newTerminal2 = await manager.createTerminal();
    expect(newTerminal2.id).toBe(4);
  });
});
```

## WebView Testing Patterns

### Testing Message Passing

```typescript
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { MessageManager } from '../../webview/managers/MessageManager';

describe('WebView Message Tests', () => {
  let messageManager: MessageManager;
  let mockPostMessage: Mock;

  beforeEach(() => {
    mockPostMessage = vi.fn().mockResolvedValue(true);
    messageManager = new MessageManager({
      postMessage: mockPostMessage
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should queue messages when webview not ready', async () => {
    // Arrange
    messageManager.setReady(false);

    // Act
    messageManager.sendMessage({ type: 'test', data: 'payload' });

    // Assert
    expect(mockPostMessage).not.toHaveBeenCalled();
    expect(messageManager.getQueueSize()).toBe(1);
  });

  it('should flush queue when webview becomes ready', async () => {
    // Arrange
    messageManager.setReady(false);
    messageManager.sendMessage({ type: 'test1' });
    messageManager.sendMessage({ type: 'test2' });

    // Act
    messageManager.setReady(true);

    // Assert
    expect(mockPostMessage).toHaveBeenCalledTimes(2);
    expect(messageManager.getQueueSize()).toBe(0);
  });

  it('should handle message receive correctly', async () => {
    // Arrange
    const handler = vi.fn();
    messageManager.onMessage('action', handler);

    // Act
    await messageManager.handleIncomingMessage({
      type: 'action',
      data: { value: 42 }
    });

    // Assert
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });
});
```

### Testing WebView Content Security

```typescript
describe('WebView Security Tests', () => {
  it('should include CSP meta tag', () => {
    // Act
    const html = provider.getWebviewContent(mockWebview);

    // Assert
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain("default-src 'none'");
    expect(html).toMatch(/script-src 'nonce-[a-zA-Z0-9]+'/);
  });

  it('should use nonce for inline scripts', () => {
    // Act
    const html = provider.getWebviewContent(mockWebview);

    // Assert - All scripts should have nonce
    const scriptTags = html.match(/<script[^>]*>/g) || [];
    for (const tag of scriptTags) {
      expect(tag).toContain('nonce=');
    }
  });

  it('should sanitize user input in HTML', () => {
    // Arrange
    const maliciousInput = '<script>alert("XSS")</script>';

    // Act
    const sanitized = provider.sanitizeForHtml(maliciousInput);

    // Assert
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;script&gt;');
  });
});
```

## Session Persistence Testing

```typescript
describe('Session Persistence Tests', () => {
  let sessionManager: SessionManager;
  let mockStorage: { get: Mock; update: Mock };

  beforeEach(() => {
    mockStorage = {
      get: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined)
    };
    sessionManager = new SessionManager(mockStorage as any);
  });

  it('should save terminal state', async () => {
    // Arrange
    const terminalState = {
      id: 1,
      name: 'Terminal 1',
      scrollback: 'command output...',
      cwd: '/home/user'
    };

    // Act
    await sessionManager.saveTerminalState(terminalState);

    // Assert
    expect(mockStorage.update).toHaveBeenCalledWith(
      'terminal-1',
      expect.objectContaining(terminalState)
    );
  });

  it('should restore session within expiry', async () => {
    // Arrange
    const savedState = {
      id: 1,
      savedAt: Date.now() - (1 * 24 * 60 * 60 * 1000) // 1 day ago
    };
    mockStorage.get.mockReturnValue(savedState);

    // Act
    const restored = await sessionManager.restoreSession(1);

    // Assert
    expect(restored).toEqual(savedState);
  });

  it('should not restore expired session', async () => {
    // Arrange
    const expiredState = {
      id: 1,
      savedAt: Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days ago
    };
    mockStorage.get.mockReturnValue(expiredState);

    // Act
    const restored = await sessionManager.restoreSession(1);

    // Assert
    expect(restored).toBeNull();
  });
});
```

## AI Agent Detection Testing

```typescript
describe('AI Agent Detection Tests', () => {
  let detector: AgentDetector;

  beforeEach(() => {
    detector = new AgentDetector();
  });

  it('should detect Claude Code agent', () => {
    // Arrange
    const output = 'Running claude code assistant...';

    // Act
    const detected = detector.detectAgent(output);

    // Assert
    expect(detected).toBe('claude-code');
  });

  it('should prevent false positives with substring attacks', () => {
    // Arrange - Malicious input trying to trigger detection
    const maliciousOutput = 'notclaude code but looks like it';

    // Act
    const detected = detector.detectAgent(maliciousOutput);

    // Assert - Should use word boundaries, not includes()
    expect(detected).toBeNull();
  });

  it('should use regex with word boundaries', () => {
    // Verify implementation uses secure pattern
    const pattern = detector.getDetectionPattern('claude-code');
    expect(pattern.source).toContain('\\b'); // Word boundary
  });
});
```

## Performance Testing

```typescript
describe('Performance Tests', () => {
  it('should create terminal within 500ms', async () => {
    // Arrange
    const startTime = performance.now();

    // Act
    await manager.createTerminal();

    // Assert
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(500);
  });

  it('should handle high-frequency output', async () => {
    // Arrange
    const terminal = await manager.createTerminal();
    const outputCount = 1000;

    // Act
    const startTime = performance.now();
    for (let i = 0; i < outputCount; i++) {
      terminal.write(`Line ${i}\n`);
    }
    await performanceManager.flush();
    const duration = performance.now() - startTime;

    // Assert - Should buffer efficiently
    expect(duration).toBeLessThan(1000); // 1 second for 1000 lines
  });

  it('should not leak memory on dispose', async () => {
    // Arrange
    const initialMemory = process.memoryUsage().heapUsed;

    // Act - Create and dispose many terminals
    for (let i = 0; i < 100; i++) {
      const terminal = await manager.createTerminal();
      await manager.deleteTerminal(terminal.id);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Assert
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB threshold
  });
});
```

## Event Handler Testing

```typescript
describe('Event Handler Tests', () => {
  it('should register and unregister event handlers', () => {
    // Arrange
    const handler = vi.fn();
    const disposable = manager.onTerminalCreated(handler);

    // Act - Create terminal
    manager.createTerminal();

    // Assert - Handler called
    expect(handler).toHaveBeenCalledTimes(1);

    // Act - Dispose handler
    disposable.dispose();
    manager.createTerminal();

    // Assert - Handler not called again
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple listeners', () => {
    // Arrange
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    manager.onTerminalCreated(handler1);
    manager.onTerminalCreated(handler2);

    // Act
    manager.createTerminal();

    // Assert
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });
});
```

## Integration Test Patterns

```typescript
describe('Integration Tests', () => {
  it('should integrate terminal with webview', async () => {
    // Arrange
    const terminal = await terminalManager.createTerminal();
    const webview = webviewManager.getPanel();

    // Act - Send output to webview
    terminal.write('Hello World\n');
    await performanceManager.flush();

    // Assert - Webview received message
    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'terminalOutput',
        terminalId: terminal.id,
        data: expect.any(String)
      })
    );
  });

  it('should persist and restore complete state', async () => {
    // Arrange - Create state
    const terminal1 = await terminalManager.createTerminal();
    const terminal2 = await terminalManager.createTerminal();
    terminal1.write('Output 1\n');
    terminal2.write('Output 2\n');

    // Act - Save and restore
    await sessionManager.saveAllSessions();
    terminalManager.dispose();
    terminalManager = TerminalManager.getInstance();
    await sessionManager.restoreAllSessions();

    // Assert
    expect(terminalManager.getTerminalCount()).toBe(2);
    const restored1 = terminalManager.getTerminal(1);
    expect(restored1?.scrollback).toContain('Output 1');
  });
});
```
