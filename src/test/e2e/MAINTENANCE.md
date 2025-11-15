# E2E Test Maintenance Guide

This guide provides guidelines for maintaining and updating the Playwright E2E test suite.

## Table of Contents

- [Test Review Process](#test-review-process)
- [Test Naming Conventions](#test-naming-conventions)
- [Page Object Pattern](#page-object-pattern)
- [Test Data Management](#test-data-management)
- [Test Failure Triage](#test-failure-triage)
- [Test Refactoring](#test-refactoring)
- [Performance Monitoring](#performance-monitoring)
- [CI/CD Integration](#cicd-integration)

## Test Review Process

### When to Review Tests

- **After Feature Changes**: Update tests when underlying features change
- **After Test Failures**: Investigate and fix flaky or failing tests
- **Quarterly Reviews**: Regular review of entire test suite
- **Before Major Releases**: Comprehensive test validation

### Review Checklist

- [ ] Tests pass consistently (3+ consecutive runs)
- [ ] Test names clearly describe what is being tested
- [ ] Proper use of test priorities (@P0, @P1, @P2 tags)
- [ ] Appropriate use of test categories (@category tags)
- [ ] No hard-coded waits (`setTimeout`)
- [ ] Proper cleanup in `afterEach` hooks
- [ ] Screenshots and traces captured on failure
- [ ] Test execution time < 30 seconds per test
- [ ] Code follows established patterns
- [ ] Comments explain complex test logic

### Code Review Guidelines

**What to check**:
1. **Test Structure**: Follows Arrange-Act-Assert pattern
2. **Selectors**: Uses data-testid for stability
3. **Waits**: Proper use of waitForSelector, waitForLoadState
4. **Assertions**: Clear and specific expectations
5. **Error Handling**: Graceful handling of expected errors
6. **Documentation**: Comments for non-obvious behavior

**Example**:
```typescript
// ❌ Bad: Unclear test name, hard-coded wait, vague assertion
test('test terminal', async () => {
  await page.click('button');
  await new Promise(r => setTimeout(r, 1000));
  expect(await page.locator('div').count()).toBeGreaterThan(0);
});

// ✅ Good: Clear name, proper waits, specific assertion
test('@P0 should create terminal with ID 1 @category:terminal-lifecycle', async () => {
  // Arrange
  await helper.navigateToExtension();

  // Act
  await page.click('[data-testid="create-terminal-button"]');
  await page.waitForSelector('[data-terminal-id="1"]', { state: 'visible' });

  // Assert
  const terminal = await page.locator('[data-terminal-id="1"]');
  await expect(terminal).toBeVisible();
});
```

## Test Naming Conventions

### File Names

```
tests/
├── terminal/
│   ├── creation.spec.ts        # Terminal creation tests
│   ├── deletion.spec.ts        # Terminal deletion tests
│   └── switching.spec.ts       # Terminal switching tests
├── webview/
│   ├── keyboard-input.spec.ts  # Keyboard interaction tests
│   ├── mouse-actions.spec.ts   # Mouse/click interaction tests
│   └── scrolling.spec.ts       # Scrolling behavior tests
└── agents/
    └── detection.spec.ts       # AI agent detection tests
```

**Naming Rules**:
- Use kebab-case: `terminal-creation.spec.ts`
- Be specific and descriptive
- Group related tests in same file
- Maximum 200 tests per file

### Test Names

**Format**: `@Priority should [action] [condition] @category:tag`

**Examples**:
```typescript
test('@P0 should create terminal with default settings @category:terminal-lifecycle')
test('@P1 should handle rapid terminal creation without race conditions @category:concurrency')
test('@P2 should display AI agent status indicator @category:ai-detection @security')
```

**Rules**:
- Start with priority tag (@P0, @P1, @P2)
- Use "should" for expected behavior
- Be specific about what is being tested
- End with category tag(s)
- Add special tags as needed (@security, @accessibility, @performance)

### Test Suite Structure

```typescript
describe('Feature Area', () => {
  describe('Specific Functionality', () => {
    test.beforeEach(async () => {
      // Setup for this group
    });

    test('@P0 critical test case', async () => {
      // Test implementation
    });

    test('@P1 important test case', async () => {
      // Test implementation
    });
  });
});
```

## Page Object Pattern

### When to Use

Use Page Objects for:
- Repeated UI interactions
- Complex page structures
- Reusable selectors
- Multi-step workflows

**Don't use for**:
- Simple, one-time actions
- Tests with unique page structures

### Structure

```typescript
// helpers/TerminalPageObject.ts
export class TerminalPageObject {
  constructor(private page: Page) {}

  // Selectors (private)
  private get createButton() {
    return this.page.locator('[data-testid="create-terminal"]');
  }

  private get terminalList() {
    return this.page.locator('[data-testid="terminal-list"]');
  }

  // Actions (public)
  async createTerminal(): Promise<string> {
    await this.createButton.click();
    await this.page.waitForSelector('[data-terminal-id]');
    return await this.getLastTerminalId();
  }

  async deleteTerminal(id: string): Promise<void> {
    await this.page.click(`[data-terminal-id="${id}"] [data-action="delete"]`);
    await this.page.waitForSelector(`[data-terminal-id="${id}"]`, { state: 'detached' });
  }

  // Queries (public)
  async getTerminalCount(): Promise<number> {
    return await this.terminalList.locator('[data-terminal-id]').count();
  }

  private async getLastTerminalId(): Promise<string> {
    const terminals = await this.terminalList.locator('[data-terminal-id]').all();
    return await terminals[terminals.length - 1].getAttribute('data-terminal-id');
  }
}

// Usage in test
test('terminal creation', async ({ page }) => {
  const terminalPage = new TerminalPageObject(page);

  const terminalId = await terminalPage.createTerminal();
  expect(terminalId).toBe('1');

  const count = await terminalPage.getTerminalCount();
  expect(count).toBe(1);
});
```

## Test Data Management

### Test Fixtures

Store test data in `src/test/fixtures/e2e/`:

```
fixtures/e2e/
├── terminal-output/
│   ├── basic-output.txt
│   ├── ansi-colors.txt
│   └── large-output.txt
├── ai-agents/
│   ├── claude-code-output.txt
│   ├── copilot-output.txt
│   └── gemini-output.txt
└── configs/
    ├── default-settings.json
    └── custom-settings.json
```

### Loading Fixtures

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

function loadFixture(filename: string): string {
  const path = join(__dirname, '../fixtures/e2e', filename);
  return readFileSync(path, 'utf-8');
}

// Usage
const aiOutput = loadFixture('ai-agents/claude-code-output.txt');
```

### Dynamic Test Data

```typescript
// helpers/TestDataFactory.ts
export class TestDataFactory {
  static createTerminalData(count: number = 1) {
    return Array.from({ length: count }, (_, i) => ({
      id: (i + 1).toString(),
      name: `Terminal ${i + 1}`,
      cwd: `/tmp/test-${i + 1}`,
    }));
  }

  static createLargeOutput(lines: number = 1000): string {
    return Array.from({ length: lines }, (_, i) => `Line ${i + 1}`).join('\n');
  }
}
```

## Test Failure Triage

### Triage Process

1. **Identify Pattern**
   - Single failure: Likely environment/timing issue
   - Consistent failure: Real bug or test issue
   - Flaky (intermittent): Test stability problem

2. **Gather Information**
   - Review test logs
   - Check screenshots/videos
   - Analyze trace viewer
   - Review recent code changes

3. **Categorize**
   - **Environment Issue**: CI configuration, dependencies
   - **Test Issue**: Flaky test, incorrect assertion
   - **Product Bug**: Real application issue

4. **Take Action**
   - Environment: Fix CI configuration
   - Test Issue: Refactor test for stability
   - Product Bug: File bug report, add regression test

### Common Failure Patterns

#### Pattern 1: Timing Issues

**Symptoms**:
- "Element not found" errors
- Tests pass locally, fail in CI

**Solutions**:
```typescript
// Add proper waits
await page.waitForSelector('[data-testid="element"]');
await page.click('[data-testid="element"]');

// Wait for network to settle
await page.waitForLoadState('networkidle');

// Wait for specific condition
await page.waitForFunction(() => window.myApp.isReady);
```

#### Pattern 2: Race Conditions

**Symptoms**:
- Tests fail in parallel
- Inconsistent results

**Solutions**:
```typescript
// Ensure test isolation
test.beforeEach(async () => {
  await cleanupTestState();
});

test.afterEach(async () => {
  await disposeResources();
});

// Run serially if needed
test.describe.serial('sequential tests', () => {
  // Tests run one at a time
});
```

#### Pattern 3: State Pollution

**Symptoms**:
- Tests pass individually, fail in suite
- Order-dependent failures

**Solutions**:
```typescript
// Reset state between tests
test.beforeEach(async () => {
  await resetApplicationState();
  await clearLocalStorage();
});

// Use unique test data
const testId = `test-${Date.now()}`;
```

### Failure Documentation

Create issue with:
```markdown
## Test Failure Report

**Test**: tests/terminal/creation.spec.ts - "should create terminal"
**Frequency**: 3/10 runs (flaky)
**Environment**: CI (Ubuntu)

**Error**:
```
TimeoutError: Waiting for selector '[data-terminal-id="1"]' failed
```

**Screenshots**: [Attach]
**Trace**: [Attach trace.zip]

**Hypothesis**: Terminal creation async operation not complete before assertion

**Proposed Fix**: Add explicit wait for terminal ready state
```

## Test Refactoring

### When to Refactor

- Test is flaky (>5% failure rate)
- Test execution time >30 seconds
- Duplicated code across tests
- Hard to understand test logic
- After feature refactoring

### Refactoring Checklist

- [ ] Tests still pass after refactoring
- [ ] Test names updated if behavior changed
- [ ] Extracted common patterns to helpers
- [ ] Removed hard-coded waits
- [ ] Improved test isolation
- [ ] Updated documentation

### Refactoring Example

**Before**:
```typescript
test('test 1', async () => {
  await page.goto('http://localhost:3000');
  await page.click('[data-testid="create"]');
  await new Promise(r => setTimeout(r, 1000));
  expect(await page.locator('[data-terminal-id]').count()).toBe(1);
});

test('test 2', async () => {
  await page.goto('http://localhost:3000');
  await page.click('[data-testid="create"]');
  await new Promise(r => setTimeout(r, 1000));
  await page.click('[data-testid="create"]');
  await new Promise(r => setTimeout(r, 1000));
  expect(await page.locator('[data-terminal-id]').count()).toBe(2);
});
```

**After**:
```typescript
class TerminalHelper {
  async createTerminal(): Promise<void> {
    await this.page.click('[data-testid="create"]');
    await this.page.waitForSelector('[data-terminal-id]:last-child', { state: 'visible' });
  }

  async getTerminalCount(): Promise<number> {
    return await this.page.locator('[data-terminal-id]').count();
  }
}

test('@P0 should create single terminal', async ({ page }) => {
  const helper = new TerminalHelper(page);
  await helper.createTerminal();
  expect(await helper.getTerminalCount()).toBe(1);
});

test('@P0 should create multiple terminals', async ({ page }) => {
  const helper = new TerminalHelper(page);
  await helper.createTerminal();
  await helper.createTerminal();
  expect(await helper.getTerminalCount()).toBe(2);
});
```

## Performance Monitoring

### Tracking Test Duration

```bash
# Run with detailed timing
npx playwright test --reporter=list

# Generate performance report
npx playwright test --reporter=json > results.json
```

### Performance Targets

- **Individual Test**: <30 seconds
- **Test Suite**: <5 minutes (local), <10 minutes (CI)
- **Critical Path (P0)**: <2 minutes

### Optimization Strategies

1. **Parallel Execution**: Use `fullyParallel: true`
2. **Shared Setup**: Use `globalSetup` for expensive operations
3. **Lazy Loading**: Load fixtures only when needed
4. **Selective Testing**: Run only affected tests during development

## CI/CD Integration

### Workflow Maintenance

Review `.github/workflows/e2e-tests.yml` monthly:

- [ ] Dependencies up to date
- [ ] Playwright version current
- [ ] Browser versions current
- [ ] Artifact retention appropriate
- [ ] Timeout values appropriate

### Monitoring CI Health

**Key Metrics**:
- Test pass rate (target: ≥95%)
- Average execution time (target: <10 minutes)
- Flaky test rate (target: <5%)
- Artifact storage usage

**Monthly Review**:
```bash
# Check recent CI runs
gh run list --workflow=e2e-tests.yml --limit 20

# Download and analyze results
gh run download <run-id> --name test-results
```

## Maintenance Schedule

### Weekly
- [ ] Review failed CI runs
- [ ] Fix flaky tests
- [ ] Update test data if needed

### Monthly
- [ ] Review test execution times
- [ ] Refactor slow/flaky tests
- [ ] Update dependencies
- [ ] Review CI metrics

### Quarterly
- [ ] Comprehensive test suite review
- [ ] Update test priorities based on usage
- [ ] Archive obsolete tests
- [ ] Performance optimization

### Before Major Release
- [ ] Run full test suite 3x times
- [ ] Review all P0 tests
- [ ] Update test documentation
- [ ] Verify CI/CD pipeline

## Best Practices Summary

1. **Test Isolation**: Each test should be independent
2. **Explicit Waits**: Use waitForSelector, not setTimeout
3. **Data Test IDs**: Prefer stable selectors
4. **Page Objects**: Extract common patterns
5. **Test Fixtures**: Use structured test data
6. **Regular Review**: Monthly test suite review
7. **Quick Triage**: Address failures within 24 hours
8. **Documentation**: Keep guides up to date
9. **Performance**: Monitor and optimize test duration
10. **CI Health**: Maintain >95% pass rate

## Resources

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Test Maintenance](https://playwright.dev/docs/test-advanced)
- [CI/CD Integration](https://playwright.dev/docs/ci)
