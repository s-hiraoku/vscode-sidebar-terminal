# Test CLAUDE.md - TDD Implementation Guide

This file provides guidance for efficient Test-Driven Development (TDD) implementation.

## TDD Quality Standards

### Current Quality Level

- **Test Count**: 275+ tests
- **Pass Rate**: 93% (progressively improving to 95%)
- **TDD Compliance**: 50% (targeting 85%)
- **Coverage**: 85%+ required

### TDD Quality Gate (Automated)

```bash
# Pre-release automated quality checks
npm run pre-release:check     # Comprehensive quality gate
npm run tdd:quality-gate      # TDD quality standards check
npm run tdd:comprehensive-check # Coverage + quality + gate
```

## Efficient Test Implementation Templates

### Red-Green-Refactor Cycle

```typescript
// 1. RED - Write a failing test first
describe('NewFeature', () => {
  it('should handle new functionality', () => {
    const result = newFeature();
    expect(result).to.equal(expectedValue); // Fails - not implemented yet
  });
});

// 2. GREEN - Write minimal code to pass the test
function newFeature() {
  return expectedValue; // Minimal implementation
}

// 3. REFACTOR - Improve the code
function newFeature() {
  // Proper implementation
  return calculateExpectedValue();
}
```

### High-Efficiency Test Patterns

#### Session Management Tests

```typescript
// src/test/unit/sessions/SessionManager.test.ts
describe('UnifiedSessionManager', () => {
  let sessionManager: UnifiedSessionManager;
  let mockVscode: any;

  beforeEach(() => {
    mockVscode = createMockVSCode();
    sessionManager = new UnifiedSessionManager(mockVscode.context);
  });

  afterEach(() => {
    sessionManager.dispose();
  });

  it('should save and restore multiple terminals', async () => {
    // Given: Multiple terminal states
    const terminals = createTestTerminals(3);

    // When: Save session
    await sessionManager.saveSession(terminals);

    // Then: Restored accurately
    const restored = await sessionManager.restoreSession();
    expect(restored).to.have.length(3);
    expect(restored[0].scrollback).to.equal(terminals[0].scrollback);
  });
});
```

#### WebView Manager Tests

```typescript
// src/test/unit/webview/managers/MessageManager.test.ts
describe('MessageManager', () => {
  let messageManager: MessageManager;
  let mockCoordinator: IManagerCoordinator;

  beforeEach(() => {
    mockCoordinator = createMockCoordinator();
    messageManager = new MessageManager(mockCoordinator);
  });

  it('should queue messages when webview is not ready', () => {
    // Given: WebView not ready state
    messageManager.setReady(false);

    // When: Send message
    messageManager.postMessage({ command: 'test', data: 'data' });

    // Then: Saved to queue
    expect(messageManager.getQueueSize()).to.equal(1);
  });
});
```

#### Terminal Management Tests

```typescript
// src/test/unit/terminals/TerminalManager.test.ts
describe('TerminalManager', () => {
  let terminalManager: TerminalManager;

  beforeEach(() => {
    terminalManager = new TerminalManager();
  });

  it('should prevent infinite deletion loops', async () => {
    // Given: Terminal exists
    const terminal = await terminalManager.createTerminal();

    // When: Concurrent deletion attempts
    const deletePromises = [
      terminalManager.deleteTerminal(terminal.id),
      terminalManager.deleteTerminal(terminal.id),
      terminalManager.deleteTerminal(terminal.id),
    ];

    // Then: Only one succeeds
    const results = await Promise.all(deletePromises);
    const successCount = results.filter((r) => r.success).length;
    expect(successCount).to.equal(1);
  });
});
```

## Test Environment Setup

### TestSetup.ts Pattern

```typescript
// src/test/shared/TestSetup.ts - Unified test environment
export function setupCompleteTestEnvironment() {
  setupJSDOMEnvironment(); // DOM environment
  setupConsoleMocks(); // Console mocking
  setupTestEnvironment(); // VS Code API mock

  return {
    mockVscode: getMockVscode(),
    cleanup: cleanupTestEnvironment,
  };
}
```

### Mock Factory Pattern

```typescript
// src/test/utils/TDDTestHelper.ts
export class TestDataFactory {
  static createTerminalData(count: number = 1): TerminalInfo[] {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `Terminal ${i + 1}`,
      scrollback: [`Line ${i + 1}`],
      isActive: i === 0,
    }));
  }

  static createMockVSCode(): any {
    return {
      context: {
        globalState: new Map(),
        subscriptions: [],
      },
      workspace: {
        getConfiguration: sinon.stub().returns({
          get: sinon.stub(),
        }),
      },
    };
  }
}
```

## Performance Tests

### Load Testing Pattern

```typescript
describe('Performance Tests', () => {
  it('should handle high-frequency terminal output', async () => {
    const startTime = Date.now();

    // High-frequency data transmission test
    for (let i = 0; i < 1000; i++) {
      await terminalManager.sendData(1, `Line ${i}\n`);
    }

    const duration = Date.now() - startTime;
    expect(duration).to.be.lessThan(1000); // Under 1 second
  });

  it('should prevent memory leaks', () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Create and destroy many objects
    for (let i = 0; i < 100; i++) {
      const terminal = createTestTerminal();
      terminal.dispose();
    }

    // Force GC
    if (global.gc) global.gc();

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    expect(memoryIncrease).to.be.lessThan(1024 * 1024); // Under 1MB
  });
});
```

## CI/CD Integration Tests

### GitHub Actions Quality Gate

```yaml
# .github/workflows/quality-gate.yml
- name: TDD Quality Gate
  run: |
    npm run tdd:quality-gate
    if [ $? -ne 0 ]; then
      echo "TDD quality standards not met"
      exit 1
    fi
```

### Pre-Release Automated Checks

```bash
# scripts/pre-release-check.sh
#!/bin/bash
set -e

echo "Running TDD quality checks..."
npm run tdd:quality-gate

echo "Running test coverage..."
npm run test:coverage

echo "Running all tests..."
npm test

echo "All quality gates passed!"
```

## Debugging & Troubleshooting

### Test Failure Pattern Solutions

#### 1. VS Code API Related Errors

```typescript
// If mock is incomplete
const setupMocks = () => {
  (global as any).vscode = {
    workspace: {
      getConfiguration: () => ({
        get: (key: string) => defaultConfigs[key],
      }),
    },
  };
};
```

#### 2. Async Timing Issues

```typescript
// Wait for Promise resolution
it('should handle async operations', async () => {
  const promise = asyncOperation();
  await expect(promise).to.eventually.equal(expectedValue);
});

// Set timeout
it('should complete within time limit', function (this: any) {
  this.timeout(5000);
  return longRunningTest();
});
```

#### 3. Memory Leak Detection

```typescript
// Confirm resource disposal
afterEach(() => {
  // Release all resources
  if (testResource) {
    testResource.dispose();
    testResource = null;
  }
});
```

## TDD Practice Checklists

### When Creating Tests

- [ ] Red: Write failing test first
- [ ] Green: Write minimal code to pass
- [ ] Refactor: Improve the code
- [ ] Test name clearly expresses specification
- [ ] One test, one feature principle
- [ ] Setup/teardown properly implemented

### Quality Assurance

- [ ] TDD quality gate passed (50%+)
- [ ] Test coverage 85%+
- [ ] All tests executed and passing
- [ ] Performance tests executed
- [ ] Memory leak check
- [ ] CI/CD quality gate passed

### When Refactoring

- [ ] Confirm existing tests pass
- [ ] Add test cases for new features
- [ ] Verify test execution time
- [ ] Confirm mock/stub appropriateness
- [ ] Add edge case tests

Following this guide enables efficient implementation while maintaining TDD quality.
