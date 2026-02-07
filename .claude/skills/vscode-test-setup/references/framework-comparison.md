# Test Framework Comparison: Vitest vs Mocha vs Jest

## Overview

| Feature | Vitest | Mocha | Jest |
|---------|--------|-------|------|
| Built-in assertions | Yes | No (use Chai) | Yes |
| Mocking | Yes (vi) | No (use Sinon) | Yes |
| Snapshot testing | Yes | No | Yes |
| Watch mode | Yes (excellent) | Yes | Yes (better than Mocha) |
| Parallel execution | Yes | Yes (v8+) | Yes |
| Code coverage | Yes (v8/c8) | No (use c8/nyc) | Yes |
| TypeScript support | Native | Via ts-node | Via ts-jest |
| VS Code integration | Community | Official support | Community |
| ESM support | Native | Limited | Limited |
| Speed | Fastest | Fast | Moderate |

## Recommendation for VS Code Extensions

**Use Vitest** for unit and integration testing because:

1. **All-in-one**: Built-in assertions, mocking, coverage, and watch mode
2. **Fastest**: Vite-powered, native ESM, parallel execution
3. **TypeScript native**: No configuration needed for TypeScript
4. **Compatible API**: Similar to Jest, easy migration
5. **Modern**: Native ESM support, no CommonJS workarounds

**Use Mocha** only when:
- Running VS Code extension host tests via `@vscode/test-electron` (requires Mocha)
- Existing legacy test suites that haven't been migrated

**Use Jest** when:
- Building pure Node.js libraries
- Team already familiar with Jest ecosystem

## Vitest Stack

### Strengths

- **All-in-one**: Assertions, mocking, coverage, watch mode included
- **Fastest**: Vite-powered test runner
- **TypeScript native**: No additional configuration
- **Modern**: ESM-first, no CommonJS issues
- **Compatible**: Jest-compatible API for easy migration

### Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/test/vitest/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 60,
      },
    },
  },
});
```

### Test Example

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should do something', async () => {
    const stub = vi.spyOn(dependency, 'method').mockResolvedValue('result');

    const result = await component.doSomething();

    expect(stub).toHaveBeenCalledOnce();
    expect(result).toBe('expected');
  });
});
```

## Mocha + Chai + Sinon Stack (Legacy)

### Strengths

- **VS Code compatible**: Works with official @vscode/test-electron runner
- **Mature ecosystem**: Well-documented, stable

### When Still Needed

Mocha is still required for:
- `@vscode/test-electron` E2E tests (VS Code extension host)
- `@vscode/test-cli` integration tests

## Jest Stack

### Strengths

- **All-in-one**: Assertions, mocking, coverage included
- **Snapshots**: Great for UI testing
- **Watch mode**: Intelligent re-running

## Migration Guide: Mocha/Chai/Sinon to Vitest

### Assertions

```typescript
// Chai
expect(value).to.equal(1);
expect(array).to.include(item);
expect(obj).to.deep.equal({ key: 'value' });
expect(fn).to.throw();

// Vitest
expect(value).toBe(1);
expect(array).toContain(item);
expect(obj).toEqual({ key: 'value' });
expect(fn).toThrow();
```

### Async Testing

```typescript
// Chai (with chai-as-promised)
await expect(promise).to.eventually.equal('value');
await expect(promise).to.be.rejectedWith('error');

// Vitest
expect(await promise).toBe('value');
await expect(promise).rejects.toThrow('error');
```

### Mocking

```typescript
// Sinon
const stub = sinon.stub().returns('value');
const spy = sinon.stub(obj, 'method').returns('mock');
sandbox.restore();

// Vitest
const mock = vi.fn().mockReturnValue('value');
const spy = vi.spyOn(obj, 'method').mockReturnValue('mock');
vi.restoreAllMocks();
```

### Lifecycle Hooks

```typescript
// Mocha
before(() => { /* ... */ });
beforeEach(() => { /* ... */ });
afterEach(() => { /* ... */ });
after(() => { /* ... */ });

// Vitest
beforeAll(() => { /* ... */ });
beforeEach(() => { /* ... */ });
afterEach(() => { /* ... */ });
afterAll(() => { /* ... */ });
```

### Timeouts

```typescript
// Mocha
it('slow test', function() {
  this.timeout(5000);
  // ...
});

// Vitest
it('slow test', async () => {
  // ...
}, 5000);
```

## Performance Comparison

### Test Execution Time (1000 tests)

| Framework | Time | Memory |
|-----------|------|--------|
| Vitest | ~8s | ~120MB |
| Mocha | ~15s | ~150MB |
| Jest | ~20s | ~300MB |

## Decision Matrix

| Criteria | Weight | Vitest | Mocha | Jest |
|----------|--------|--------|-------|------|
| Speed | 5 | ★★★★★ (5) | ★★★ (3) | ★★★ (3) |
| TypeScript support | 5 | ★★★★★ (5) | ★★★ (3) | ★★★★ (4) |
| Built-in features | 4 | ★★★★★ (5) | ★★ (2) | ★★★★★ (5) |
| VS Code E2E compat | 3 | ★★★ (3) | ★★★★★ (5) | ★★★ (3) |
| ESM support | 4 | ★★★★★ (5) | ★★★ (3) | ★★★ (3) |
| Ease of setup | 4 | ★★★★★ (5) | ★★★ (3) | ★★★★ (4) |
| **Total** | | **119/125** | **79/125** | **93/125** |

> Scoring: Each star = 1 point (1–5 scale). Total = sum of (weight × star rating) for each criterion. Maximum possible = 125 (sum of all weights × 5).

## Final Recommendation

For VS Code extension development:

1. **Primary choice**: Vitest
   - Use for all unit tests
   - Use for integration tests that don't need VS Code API
   - Built-in mocking, assertions, and coverage

2. **Secondary**: Mocha (for VS Code extension host tests)
   - Use only for E2E tests requiring `@vscode/test-electron`
   - Required by `@vscode/test-cli`

3. **Avoid**: Jest
   - Unless team has strong Jest preference
   - Slower than Vitest, no VS Code E2E support
