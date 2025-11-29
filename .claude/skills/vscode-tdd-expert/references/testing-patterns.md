# VS Code Extension Testing Patterns

## Terminal Component Testing

### Testing Terminal Creation Lifecycle

```typescript
import { expect } from 'chai';
import * as sinon from 'sinon';
import { TerminalManager } from '../../terminals/TerminalManager';
import { ProcessState, InteractionState } from '../../types/terminal';

suite('Terminal Lifecycle Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let manager: TerminalManager;

  setup(() => {
    sandbox = sinon.createSandbox();
    manager = TerminalManager.getInstance();
  });

  teardown(() => {
    sandbox.restore();
    manager.dispose();
  });

  test('should transition through lifecycle states', async () => {
    // Arrange
    const stateChanges: ProcessState[] = [];
    manager.onStateChange((state) => stateChanges.push(state));

    // Act
    const terminal = await manager.createTerminal();
    await manager.initializeShell(terminal.id);
    await manager.deleteTerminal(terminal.id);

    // Assert
    expect(stateChanges).to.deep.equal([
      ProcessState.Creating,
      ProcessState.Running,
      ProcessState.Terminated
    ]);
  });

  test('should handle atomic operations correctly', async () => {
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
    expect(ids.length).to.equal(uniqueIds.size);
  });
});
```

### Testing Terminal ID Recycling

```typescript
suite('Terminal ID Recycling Tests', () => {
  test('should recycle IDs in order 1-5', async () => {
    // Create 5 terminals
    const terminals = [];
    for (let i = 0; i < 5; i++) {
      terminals.push(await manager.createTerminal());
    }

    // Verify IDs are 1-5
    const ids = terminals.map(t => t.id);
    expect(ids).to.deep.equal([1, 2, 3, 4, 5]);

    // Delete terminal 2 and 4
    await manager.deleteTerminal(2);
    await manager.deleteTerminal(4);

    // Create new terminal - should get ID 2 (lowest available)
    const newTerminal1 = await manager.createTerminal();
    expect(newTerminal1.id).to.equal(2);

    // Create another - should get ID 4
    const newTerminal2 = await manager.createTerminal();
    expect(newTerminal2.id).to.equal(4);
  });
});
```

## WebView Testing Patterns

### Testing Message Passing

```typescript
import { expect } from 'chai';
import * as sinon from 'sinon';
import { MessageManager } from '../../webview/managers/MessageManager';

suite('WebView Message Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let messageManager: MessageManager;
  let mockPostMessage: sinon.SinonStub;

  setup(() => {
    sandbox = sinon.createSandbox();
    mockPostMessage = sandbox.stub().resolves(true);
    messageManager = new MessageManager({
      postMessage: mockPostMessage
    } as any);
  });

  teardown(() => {
    sandbox.restore();
  });

  test('should queue messages when webview not ready', async () => {
    // Arrange
    messageManager.setReady(false);

    // Act
    messageManager.sendMessage({ type: 'test', data: 'payload' });

    // Assert
    expect(mockPostMessage).not.to.have.been.called;
    expect(messageManager.getQueueSize()).to.equal(1);
  });

  test('should flush queue when webview becomes ready', async () => {
    // Arrange
    messageManager.setReady(false);
    messageManager.sendMessage({ type: 'test1' });
    messageManager.sendMessage({ type: 'test2' });

    // Act
    messageManager.setReady(true);

    // Assert
    expect(mockPostMessage).to.have.been.calledTwice;
    expect(messageManager.getQueueSize()).to.equal(0);
  });

  test('should handle message receive correctly', async () => {
    // Arrange
    const handler = sandbox.stub();
    messageManager.onMessage('action', handler);

    // Act
    await messageManager.handleIncomingMessage({
      type: 'action',
      data: { value: 42 }
    });

    // Assert
    expect(handler).to.have.been.calledWith({ value: 42 });
  });
});
```

### Testing WebView Content Security

```typescript
suite('WebView Security Tests', () => {
  test('should include CSP meta tag', () => {
    // Act
    const html = provider.getWebviewContent(mockWebview);

    // Assert
    expect(html).to.include('Content-Security-Policy');
    expect(html).to.include("default-src 'none'");
    expect(html).to.match(/script-src 'nonce-[a-zA-Z0-9]+'/);
  });

  test('should use nonce for inline scripts', () => {
    // Act
    const html = provider.getWebviewContent(mockWebview);

    // Assert - All scripts should have nonce
    const scriptTags = html.match(/<script[^>]*>/g) || [];
    for (const tag of scriptTags) {
      expect(tag).to.include('nonce=');
    }
  });

  test('should sanitize user input in HTML', () => {
    // Arrange
    const maliciousInput = '<script>alert("XSS")</script>';

    // Act
    const sanitized = provider.sanitizeForHtml(maliciousInput);

    // Assert
    expect(sanitized).not.to.include('<script>');
    expect(sanitized).to.include('&lt;script&gt;');
  });
});
```

## Session Persistence Testing

```typescript
suite('Session Persistence Tests', () => {
  let sessionManager: SessionManager;
  let mockStorage: sinon.SinonStubbedInstance<Storage>;

  setup(() => {
    mockStorage = {
      get: sandbox.stub(),
      update: sandbox.stub().resolves()
    } as any;
    sessionManager = new SessionManager(mockStorage);
  });

  test('should save terminal state', async () => {
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
    expect(mockStorage.update).to.have.been.calledWith(
      'terminal-1',
      sinon.match(terminalState)
    );
  });

  test('should restore session within expiry', async () => {
    // Arrange
    const savedState = {
      id: 1,
      savedAt: Date.now() - (1 * 24 * 60 * 60 * 1000) // 1 day ago
    };
    mockStorage.get.returns(savedState);

    // Act
    const restored = await sessionManager.restoreSession(1);

    // Assert
    expect(restored).to.deep.equal(savedState);
  });

  test('should not restore expired session', async () => {
    // Arrange
    const expiredState = {
      id: 1,
      savedAt: Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days ago
    };
    mockStorage.get.returns(expiredState);

    // Act
    const restored = await sessionManager.restoreSession(1);

    // Assert
    expect(restored).to.be.null;
  });
});
```

## AI Agent Detection Testing

```typescript
suite('AI Agent Detection Tests', () => {
  let detector: AgentDetector;

  setup(() => {
    detector = new AgentDetector();
  });

  test('should detect Claude Code agent', () => {
    // Arrange
    const output = 'Running claude code assistant...';

    // Act
    const detected = detector.detectAgent(output);

    // Assert
    expect(detected).to.equal('claude-code');
  });

  test('should prevent false positives with substring attacks', () => {
    // Arrange - Malicious input trying to trigger detection
    const maliciousOutput = 'notclaude code but looks like it';

    // Act
    const detected = detector.detectAgent(maliciousOutput);

    // Assert - Should use word boundaries, not includes()
    expect(detected).to.be.null;
  });

  test('should use regex with word boundaries', () => {
    // Verify implementation uses secure pattern
    const pattern = detector.getDetectionPattern('claude-code');
    expect(pattern.source).to.include('\\b'); // Word boundary
  });
});
```

## Performance Testing

```typescript
suite('Performance Tests', () => {
  test('should create terminal within 500ms', async () => {
    // Arrange
    const startTime = performance.now();

    // Act
    await manager.createTerminal();

    // Assert
    const duration = performance.now() - startTime;
    expect(duration).to.be.lessThan(500);
  });

  test('should handle high-frequency output', async () => {
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
    expect(duration).to.be.lessThan(1000); // 1 second for 1000 lines
  });

  test('should not leak memory on dispose', async () => {
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
    expect(memoryIncrease).to.be.lessThan(10 * 1024 * 1024); // 10MB threshold
  });
});
```

## Event Handler Testing

```typescript
suite('Event Handler Tests', () => {
  test('should register and unregister event handlers', () => {
    // Arrange
    const handler = sandbox.stub();
    const disposable = manager.onTerminalCreated(handler);

    // Act - Create terminal
    manager.createTerminal();

    // Assert - Handler called
    expect(handler).to.have.been.calledOnce;

    // Act - Dispose handler
    disposable.dispose();
    manager.createTerminal();

    // Assert - Handler not called again
    expect(handler).to.have.been.calledOnce;
  });

  test('should handle multiple listeners', () => {
    // Arrange
    const handler1 = sandbox.stub();
    const handler2 = sandbox.stub();
    manager.onTerminalCreated(handler1);
    manager.onTerminalCreated(handler2);

    // Act
    manager.createTerminal();

    // Assert
    expect(handler1).to.have.been.calledOnce;
    expect(handler2).to.have.been.calledOnce;
  });
});
```

## Integration Test Patterns

```typescript
suite('Integration Tests', () => {
  test('should integrate terminal with webview', async () => {
    // Arrange
    const terminal = await terminalManager.createTerminal();
    const webview = webviewManager.getPanel();

    // Act - Send output to webview
    terminal.write('Hello World\n');
    await performanceManager.flush();

    // Assert - Webview received message
    expect(webview.postMessage).to.have.been.calledWith(
      sinon.match({
        type: 'terminalOutput',
        terminalId: terminal.id,
        data: sinon.match.string
      })
    );
  });

  test('should persist and restore complete state', async () => {
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
    expect(terminalManager.getTerminalCount()).to.equal(2);
    const restored1 = terminalManager.getTerminal(1);
    expect(restored1?.scrollback).to.include('Output 1');
  });
});
```
