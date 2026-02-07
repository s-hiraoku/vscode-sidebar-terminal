---
name: vscode-tdd-expert
description: This skill provides expert-level guidance for Test-Driven Development (TDD) in VS Code extension development following t-wada methodology. Use when writing tests before implementation, creating comprehensive test suites, implementing Red-Green-Refactor cycles, or improving test coverage for extension components like WebViews, terminal managers, and activation logic.
---

# VS Code Extension TDD Expert

## Overview

This skill enables rigorous Test-Driven Development for VS Code extensions by providing comprehensive knowledge of testing frameworks, TDD workflows, and VS Code-specific testing patterns. It implements t-wada's TDD methodology adapted for extension development contexts.

## When to Use This Skill

- Writing tests before implementing new extension features
- Creating comprehensive test suites for WebView components
- Testing terminal management and lifecycle logic
- Implementing Red-Green-Refactor cycles for VS Code APIs
- Setting up test infrastructure for extension projects
- Debugging flaky or failing tests
- Improving test coverage for existing code

## Core TDD Principles (t-wada Methodology)

### The Three Laws of TDD

1. **Write no production code except to pass a failing test**
2. **Write only enough of a test to fail**
3. **Write only enough production code to pass the test**

### Red-Green-Refactor Cycle

```
┌──────────────────────────────────────────────────────┐
│                   TDD CYCLE                          │
│                                                      │
│   ┌─────────┐    ┌─────────┐    ┌──────────┐       │
│   │   RED   │───▶│  GREEN  │───▶│ REFACTOR │       │
│   │  Write  │    │  Make   │    │  Clean   │       │
│   │ failing │    │   it    │    │   up     │       │
│   │  test   │    │  pass   │    │  code    │       │
│   └─────────┘    └─────────┘    └──────────┘       │
│        ▲                              │             │
│        └──────────────────────────────┘             │
└──────────────────────────────────────────────────────┘
```

### TDD Workflow Commands

```bash
# Red phase - Write failing test
npm run tdd:red

# Green phase - Minimal implementation
npm run tdd:green

# Refactor phase - Improve code
npm run tdd:refactor

# Verify TDD compliance
npm run tdd:quality-gate
```

## VS Code Extension Testing Stack

### Required Dependencies

```json
{
  "devDependencies": {
    "@vscode/test-cli": "^0.0.10",
    "@vscode/test-electron": "^2.4.1",
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0"
  }
}
```

### Test Configuration (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.ts'],
    globals: true,
    testTimeout: 20000,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/test/**', '**/*.d.ts'],
    },
  },
});
```

### Test Directory Structure

```
src/
├── test/
│   ├── unit/                    # Unit tests (no VS Code API)
│   │   ├── utils.test.ts
│   │   └── models.test.ts
│   ├── integration/             # Integration tests (VS Code API mocked)
│   │   ├── terminal.test.ts
│   │   └── webview.test.ts
│   ├── e2e/                     # End-to-end tests (real VS Code)
│   │   ├── activation.test.ts
│   │   └── commands.test.ts
│   ├── fixtures/                # Test data and fixtures
│   │   ├── mock-terminal.ts
│   │   └── sample-data.json
│   └── helpers/                 # Test utilities
│       ├── vscode-mock.ts
│       └── async-helpers.ts
```

## Testing VS Code Extension Components

### 1. Command Testing

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';

describe('Command Tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('RED: createTerminal command should create new terminal', async () => {
    // Arrange - Setup expectations
    const createTerminalSpy = vi.spyOn(vscode.window, 'createTerminal');

    // Act - Execute command
    await vscode.commands.executeCommand('extension.createTerminal');

    // Assert - Verify behavior
    expect(createTerminalSpy).toHaveBeenCalledOnce();
  });
});
```

### 2. WebView Testing

```typescript
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { WebviewPanel } from 'vscode';
import { MyWebviewProvider } from '../../webview/MyWebviewProvider';

describe('WebView Provider Tests', () => {
  let mockPanel: {
    webview: {
      html: string;
      postMessage: Mock;
      onDidReceiveMessage: Mock;
    };
    onDidDispose: Mock;
    dispose: Mock;
  };

  beforeEach(() => {
    mockPanel = {
      webview: {
        html: '',
        postMessage: vi.fn().mockResolvedValue(true),
        onDidReceiveMessage: vi.fn()
      },
      onDidDispose: vi.fn(),
      dispose: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('RED: should handle message from webview', async () => {
    // Arrange
    const provider = new MyWebviewProvider();
    const message = { type: 'action', data: 'test' };

    // Act
    await provider.handleMessage(message);

    // Assert
    expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
      type: 'response',
      success: true
    });
  });
});
```

### 3. Terminal Manager Testing

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalManager } from '../../terminals/TerminalManager';

describe('TerminalManager Tests', () => {
  let terminalManager: TerminalManager;

  beforeEach(() => {
    terminalManager = new TerminalManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    terminalManager.dispose();
  });

  it('RED: should recycle terminal IDs 1-5', async () => {
    // Arrange
    const terminal1 = await terminalManager.createTerminal();
    const terminal2 = await terminalManager.createTerminal();

    // Act - Delete first terminal
    await terminalManager.deleteTerminal(terminal1.id);
    const terminal3 = await terminalManager.createTerminal();

    // Assert - ID should be recycled
    expect(terminal3.id).toBe(terminal1.id);
  });

  it('RED: should prevent creating more than 5 terminals', async () => {
    // Arrange - Create 5 terminals
    for (let i = 0; i < 5; i++) {
      await terminalManager.createTerminal();
    }

    // Act & Assert
    await expect(terminalManager.createTerminal())
      .rejects.toThrow('Maximum terminal limit reached');
  });
});
```

### 4. Configuration Testing

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

describe('Configuration Tests', () => {
  const originalConfig: Map<string, any> = new Map();

  beforeEach(async () => {
    // Save original config
    const config = vscode.workspace.getConfiguration('myExtension');
    originalConfig.set('enabled', config.get('enabled'));
  });

  afterEach(async () => {
    // Restore original config
    const config = vscode.workspace.getConfiguration('myExtension');
    for (const [key, value] of originalConfig) {
      await config.update(key, value, vscode.ConfigurationTarget.Global);
    }
  });

  it('RED: should read configuration values', () => {
    // Arrange
    const config = vscode.workspace.getConfiguration('myExtension');

    // Act
    const enabled = config.get<boolean>('enabled');

    // Assert
    expect(enabled).toBeTypeOf('boolean');
  });
});
```

### 5. Activation Testing

```typescript
import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';

describe('Extension Activation Tests', () => {
  it('RED: extension should activate', async () => {
    // Arrange
    const extensionId = 'publisher.extension-name';

    // Act
    const extension = vscode.extensions.getExtension(extensionId);
    await extension?.activate();

    // Assert
    expect(extension?.isActive).toBe(true);
  });

  it('RED: should register all commands', async () => {
    // Arrange
    const expectedCommands = [
      'extension.createTerminal',
      'extension.deleteTerminal',
      'extension.togglePanel'
    ];

    // Act
    const commands = await vscode.commands.getCommands();

    // Assert
    for (const cmd of expectedCommands) {
      expect(commands).toContain(cmd);
    }
  });
});
```

## Mocking VS Code API

### Creating VS Code Mocks

```typescript
// test/helpers/vscode-mock.ts
import { vi } from 'vitest';

export function createMockExtensionContext(): vscode.ExtensionContext {
  return {
    subscriptions: [],
    workspaceState: {
      get: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockReturnValue([])
    },
    globalState: {
      get: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockReturnValue([]),
      setKeysForSync: vi.fn()
    },
    secrets: {
      get: vi.fn().mockResolvedValue(undefined),
      store: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      onDidChange: vi.fn()
    },
    extensionUri: vscode.Uri.file('/mock/extension'),
    extensionPath: '/mock/extension',
    storagePath: '/mock/storage',
    globalStoragePath: '/mock/global-storage',
    logPath: '/mock/logs',
    extensionMode: vscode.ExtensionMode.Test,
    storageUri: vscode.Uri.file('/mock/storage'),
    globalStorageUri: vscode.Uri.file('/mock/global-storage'),
    logUri: vscode.Uri.file('/mock/logs'),
    asAbsolutePath: (path: string) => `/mock/extension/${path}`,
    environmentVariableCollection: {} as any,
    extension: {} as any,
    languageModelAccessInformation: {} as any
  } as vscode.ExtensionContext;
}

export function createMockTerminal(): vscode.Terminal {
  return {
    name: 'Mock Terminal',
    processId: Promise.resolve(12345),
    creationOptions: {},
    exitStatus: undefined,
    state: { isInteractedWith: false },
    sendText: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn()
  } as unknown as vscode.Terminal;
}
```

### Spying on VS Code Window

```typescript
// test/helpers/window-stubs.ts
import { vi } from 'vitest';
import * as vscode from 'vscode';

export function stubWindowMethods() {
  return {
    showInformationMessage: vi.spyOn(vscode.window, 'showInformationMessage'),
    showErrorMessage: vi.spyOn(vscode.window, 'showErrorMessage'),
    showWarningMessage: vi.spyOn(vscode.window, 'showWarningMessage'),
    showQuickPick: vi.spyOn(vscode.window, 'showQuickPick'),
    showInputBox: vi.spyOn(vscode.window, 'showInputBox'),
    createTerminal: vi.spyOn(vscode.window, 'createTerminal'),
    createWebviewPanel: vi.spyOn(vscode.window, 'createWebviewPanel')
  };
}
```

## Test Patterns for Common Scenarios

### Testing Async Operations

```typescript
import { it, expect } from 'vitest';

it('RED: should handle async terminal creation', async () => {
  // Arrange
  const manager = new TerminalManager();

  // Act
  const terminal = await manager.createTerminal();

  // Assert
  expect(terminal).toBeDefined();
  expect(terminal.id).toBeTypeOf('number');
});
```

### Testing Event Emitters

```typescript
import { it, expect, vi } from 'vitest';
import { EventEmitter } from 'vscode';

it('RED: should emit event on terminal creation', async () => {
  // Arrange
  const manager = new TerminalManager();
  const eventSpy = vi.fn();
  manager.onDidCreateTerminal(eventSpy);

  // Act
  await manager.createTerminal();

  // Assert
  expect(eventSpy).toHaveBeenCalledOnce();
});
```

### Testing Disposables

```typescript
import { it, expect } from 'vitest';

it('RED: should dispose all resources', async () => {
  // Arrange
  const manager = new TerminalManager();
  const terminal = await manager.createTerminal();

  // Act
  manager.dispose();

  // Assert
  expect(manager.getTerminalCount()).toBe(0);
  expect(manager.isDisposed).toBe(true);
});
```

### Testing Error Handling

```typescript
import { it, expect } from 'vitest';

it('RED: should handle invalid shell path', async () => {
  // Arrange
  const manager = new TerminalManager();
  const invalidPath = '/nonexistent/shell';

  // Act & Assert
  await expect(manager.createTerminal({ shellPath: invalidPath }))
    .rejects.toThrow('Shell not found');
});
```

## Coverage Configuration

### Vitest Coverage Configuration (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/test/**', '**/*.d.ts'],
      reporter: ['text', 'html', 'lcov'],
      all: true,
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  }
});
```

### Coverage Commands

```bash
# Run tests with coverage
npm run test:coverage
# or: npx vitest run --coverage

# Generate HTML report (included via reporter config above)
# Open coverage/index.html after running coverage

# Check coverage thresholds (enforced via thresholds config above)
npx vitest run --coverage
```

## TDD Quality Gate

### Pre-commit Check Script

```typescript
// scripts/tdd-quality-gate.ts
import { execSync } from 'child_process';

function runTddQualityGate(): boolean {
  const checks = [
    { name: 'Unit Tests', cmd: 'npm run test:unit' },
    { name: 'Coverage Threshold', cmd: 'npx vitest run --coverage' },
    { name: 'Type Check', cmd: 'npm run compile' },
    { name: 'Lint', cmd: 'npm run lint' }
  ];

  for (const check of checks) {
    try {
      console.log(`Running ${check.name}...`);
      execSync(check.cmd, { stdio: 'inherit' });
      console.log(`✅ ${check.name} passed`);
    } catch (error) {
      console.error(`❌ ${check.name} failed`);
      return false;
    }
  }

  return true;
}
```

## Best Practices

### Test Naming Convention

```typescript
// Pattern: should [expected behavior] when [condition]
it('should create terminal with default shell when no options provided', async () => {
  // ...
});

it('should throw error when maximum terminals exceeded', async () => {
  // ...
});

it('should recycle ID when terminal is deleted', async () => {
  // ...
});
```

### Arrange-Act-Assert Pattern

```typescript
it('should update terminal title', async () => {
  // Arrange - Setup test conditions
  const terminal = await manager.createTerminal();
  const newTitle = 'New Title';

  // Act - Execute the operation
  await manager.setTerminalTitle(terminal.id, newTitle);

  // Assert - Verify the result
  expect(terminal.name).toBe(newTitle);
});
```

### Test Isolation

```typescript
describe('TerminalManager Tests', () => {
  let manager: TerminalManager;

  // Fresh instance for each test
  beforeEach(() => {
    manager = new TerminalManager();
  });

  // Cleanup after each test
  afterEach(() => {
    manager.dispose();
  });
});
```

### Avoiding Test Interdependence

```typescript
// BAD - Tests depend on each other
it('should create terminal', () => { /* creates terminal */ });
it('should delete the terminal', () => { /* uses terminal from previous test */ });

// GOOD - Each test is independent
it('should create terminal', () => {
  const terminal = manager.createTerminal();
  expect(terminal).toBeDefined();
});

it('should delete terminal', () => {
  const terminal = manager.createTerminal();
  manager.deleteTerminal(terminal.id);
  expect(manager.getTerminal(terminal.id)).toBeUndefined();
});
```

## Common Pitfalls and Solutions

### Pitfall: Flaky Async Tests

**Problem**: Tests pass/fail randomly due to timing issues

**Solution**: Use proper async/await and explicit waits

```typescript
// BAD
it('flaky test', () => {
  manager.createTerminal();
  expect(manager.getTerminalCount()).toBe(1);
});

// GOOD
it('stable test', async () => {
  await manager.createTerminal();
  expect(manager.getTerminalCount()).toBe(1);
});
```

### Pitfall: Global State Pollution

**Problem**: Tests affect each other through shared state

**Solution**: Reset state in beforeEach/afterEach

```typescript
beforeEach(() => {
  // Reset singleton state
  TerminalManager.resetInstance();
});
```

### Pitfall: Incomplete Cleanup

**Problem**: Resources leak between tests

**Solution**: Dispose all resources in afterEach

```typescript
afterEach(async () => {
  // Dispose all created terminals
  await manager.disposeAll();
  // Clear all event listeners
  manager.removeAllListeners();
});
```

## Resources

For detailed reference documentation, see:
- `references/testing-patterns.md` - VS Code-specific test patterns
- `references/mock-strategies.md` - Mocking VS Code API
- `references/coverage-guide.md` - Coverage configuration and analysis
