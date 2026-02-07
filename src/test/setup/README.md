# Test Setup Files

This directory contains the test environment setup files for legacy E2E tests.

> **Note**: For unit and integration tests, use **Vitest** setup at `src/test/vitest/setup.ts`.
> This directory is only relevant for E2E tests via `@vscode/test-electron`.

## Execution Order (Legacy E2E)

1. **00-global-setup.js** - Global environment setup (process, Node.js APIs)
2. **01-vscode-mock.js** - VS Code API mock initialization (legacy E2E setup)
3. **02-xterm-mock.js** - xterm.js mock setup
4. **03-mocha-patches.js** - Mocha Runner patches (required by @vscode/test-electron E2E tests)

## Guidelines for New Tests

- **New tests should use Vitest** in `src/test/vitest/`
- Use `vi.fn()`, `vi.spyOn()`, `vi.mock()` for mocking
- Use `expect()` from Vitest for assertions
- See `src/test/vitest/` for current test patterns

## Usage Example (Vitest - Recommended)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('MyService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should work with mocks', () => {
    const mockFn = vi.fn().mockReturnValue('result');
    expect(mockFn()).toBe('result');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
```
