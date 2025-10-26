# Test Setup Files

This directory contains the test environment setup files that run before any tests.
Files are executed in numerical order.

## Execution Order

1. **00-global-setup.js** - Global environment setup (process, Node.js APIs)
2. **01-vscode-mock.js** - VS Code API mock initialization (from mocha-setup.ts)
3. **02-xterm-mock.js** - xterm.js mock setup
4. **03-mocha-patches.js** - Mocha Runner patches (from setup-exit-handler.js)

## Guidelines

- **DO NOT** create VS Code mocks in individual test files
- **DO** use `VSCodeMockFactory` from `test/fixtures/vscode-mocks.ts`
- **DO** reset stubs in `beforeEach` hooks
- **DO** restore sandboxes in `afterEach` hooks

## Usage Example

```typescript
import { VSCodeMockFactory } from '../../fixtures/vscode-mocks';

describe('MyService', () => {
  let sandbox: sinon.SinonSandbox;
  let vscode: ReturnType<typeof VSCodeMockFactory.setupGlobalMock>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    vscode = VSCodeMockFactory.setupGlobalMock(sandbox);

    // Configure defaults
    VSCodeMockFactory.configureDefaults(vscode.configuration, {
      fontSize: 14,
      fontFamily: 'monospace',
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should work with mocks', () => {
    // Test code here
  });
});
```
