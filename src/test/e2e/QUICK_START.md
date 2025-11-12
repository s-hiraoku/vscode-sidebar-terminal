# E2E Testing Quick Start Guide

Welcome to the Playwright E2E testing suite for VS Code Sidebar Terminal! This guide will get you up and running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- VS Code 1.74+ installed
- Basic TypeScript knowledge
- Familiarity with VS Code extensions (helpful but not required)

## Installation

```bash
# Clone repository (if not already done)
git clone https://github.com/s-hiraoku/vscode-sidebar-terminal.git
cd vscode-sidebar-terminal

# Install dependencies (includes Playwright)
npm install

# Install Playwright browsers
npx playwright install chromium
```

## Running Your First Test

### Option 1: Command Line (Quick)

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/terminal/creation.spec.ts

# Run in headed mode (see browser)
npm run test:e2e:headed
```

### Option 2: VS Code (Recommended)

1. Open VS Code
2. Press `F5` or go to Run → Start Debugging
3. Select "E2E Tests (Headed)" from dropdown
4. Watch tests run in visible browser!

### Option 3: UI Mode (Best for Development)

```bash
npm run test:e2e:ui
```

This opens an interactive test runner where you can:
- See all tests with status
- Run individual tests with one click
- Watch tests re-run automatically
- Step through test execution

## Understanding Test Structure

### Test File Location

```
src/test/e2e/
├── tests/                  # All test files
│   ├── terminal/          # Terminal lifecycle tests
│   │   ├── creation.spec.ts
│   │   └── deletion.spec.ts
│   ├── webview/           # WebView interaction tests
│   │   └── keyboard-input.spec.ts
│   ├── agents/            # AI agent detection tests
│   │   └── detection.spec.ts
│   ├── config/            # Configuration tests
│   │   └── settings.spec.ts
│   ├── visual/            # Visual regression tests
│   │   └── ansi-colors.spec.ts
│   └── errors/            # Error handling tests
│       ├── error-scenarios.spec.ts
│       └── concurrent-operations.spec.ts
├── helpers/               # Test helpers
├── fixtures/              # Test data
├── config/                # Test configuration
└── docs/                  # Documentation (you're here!)
```

### Basic Test Anatomy

```typescript
import { test, expect } from '@playwright/test';

test('@P0 should create terminal with ID 1 @category:terminal-lifecycle', async ({ page }) => {
  // 1. ARRANGE - Set up test preconditions
  await page.goto('http://localhost:3000');

  // 2. ACT - Perform the action being tested
  await page.click('[data-testid="create-terminal-button"]');

  // 3. ASSERT - Verify expected outcome
  const terminal = await page.locator('[data-terminal-id="1"]');
  await expect(terminal).toBeVisible();
});
```

**Key Elements**:
- **Priority Tag**: `@P0` (Critical), `@P1` (Important), `@P2` (Nice-to-have)
- **Test Name**: Clear description of what's being tested
- **Category Tag**: `@category:terminal-lifecycle` for organization
- **Arrange-Act-Assert**: Standard test structure

## Writing Your First Test

Let's write a test to verify terminal deletion works:

### Step 1: Create Test File

```bash
touch src/test/e2e/tests/terminal/my-first-test.spec.ts
```

### Step 2: Add Test Code

```typescript
import { test, expect } from '@playwright/test';

test.describe('Terminal Deletion', () => {
  test('@P1 should delete terminal @category:terminal-lifecycle', async ({ page }) => {
    // Arrange: Navigate to extension
    await page.goto('http://localhost:3000');

    // Create a terminal first
    await page.click('[data-testid="create-terminal-button"]');
    await page.waitForSelector('[data-terminal-id="1"]');

    // Act: Delete the terminal
    await page.click('[data-terminal-id="1"] [data-action="delete"]');

    // Assert: Terminal should be removed
    const terminal = page.locator('[data-terminal-id="1"]');
    await expect(terminal).not.toBeVisible();
  });
});
```

### Step 3: Run Your Test

```bash
npx playwright test tests/terminal/my-first-test.spec.ts --headed
```

### Step 4: Debug (if needed)

If test fails:

```bash
# Run in debug mode
npx playwright test tests/terminal/my-first-test.spec.ts --debug
```

This opens Playwright Inspector where you can:
- Step through test line by line
- Inspect page state
- Try different selectors

## Common Test Patterns

### Pattern 1: Testing User Interactions

```typescript
test('keyboard input', async ({ page }) => {
  // Type text
  await page.fill('[data-testid="input"]', 'Hello World');

  // Press keys
  await page.press('[data-testid="input"]', 'Enter');

  // Click elements
  await page.click('[data-testid="submit-button"]');

  // Verify result
  await expect(page.locator('[data-testid="output"]')).toHaveText('Hello World');
});
```

### Pattern 2: Testing Async Operations

```typescript
test('async operation', async ({ page }) => {
  // Trigger async operation
  await page.click('[data-testid="load-data-button"]');

  // Wait for completion
  await page.waitForSelector('[data-testid="data-loaded"]', {
    state: 'visible',
    timeout: 5000
  });

  // Verify result
  const data = await page.locator('[data-testid="data-content"]').textContent();
  expect(data).toBeTruthy();
});
```

### Pattern 3: Testing Multiple Elements

```typescript
test('multiple terminals', async ({ page }) => {
  // Create multiple terminals
  await page.click('[data-testid="create-terminal-button"]');
  await page.click('[data-testid="create-terminal-button"]');
  await page.click('[data-testid="create-terminal-button"]');

  // Count terminals
  const terminals = await page.locator('[data-terminal-id]').count();
  expect(terminals).toBe(3);

  // Check each terminal has unique ID
  const ids = await page.locator('[data-terminal-id]').evaluateAll(
    elements => elements.map(el => el.getAttribute('data-terminal-id'))
  );
  expect(new Set(ids).size).toBe(3); // All unique
});
```

### Pattern 4: Using Test Helpers

```typescript
import { VSCodeTestHelper } from '../helpers/vscode-helper';

test('with helper', async ({ page }) => {
  const helper = new VSCodeTestHelper(page);

  // Helper methods simplify common operations
  await helper.createTerminal();
  await helper.typeInTerminal('echo "Hello"');
  const output = await helper.getTerminalOutput();

  expect(output).toContain('Hello');
});
```

## Test Priorities Explained

### @P0: Critical (Must Pass 100%)

These tests validate core functionality. If a P0 test fails, **do not merge**.

**Examples**:
- Terminal creation
- Terminal deletion
- Basic keyboard input
- Extension activation

### @P1: Important (Must Pass ≥95%)

These tests validate important features. Occasional failures acceptable but should be investigated.

**Examples**:
- AI agent detection
- Configuration changes
- Advanced keyboard shortcuts
- Session persistence

### @P2: Nice-to-have (Must Pass ≥80%)

These tests validate nice-to-have features. Some failures acceptable but should be tracked.

**Examples**:
- Visual regression tests
- Performance benchmarks
- Edge case handling

## Using Playwright Agents (Claude Code)

When using Claude Code, leverage specialized Playwright agents for test creation:

### playwright-test-planner

Generate test scenarios by exploring the application:

```
User: "Help me create test scenarios for the terminal deletion feature"

Claude: *Uses Task tool to launch playwright-test-planner agent*
        Agent explores the extension and generates comprehensive test scenarios
```

### playwright-test-generator

Implement tests based on scenarios:

```
User: "Implement tests for terminal creation"

Claude: *Uses Task tool to launch playwright-test-generator agent*
        Agent generates test code following best practices
```

### Example Workflow

```typescript
// 1. Ask Claude to generate test plan
"Can you create a test plan for AI agent detection?"

// 2. Claude uses playwright-test-planner agent
// Generates: TEST_PLAN.md with scenarios

// 3. Ask Claude to implement tests
"Implement the AI agent detection tests"

// 4. Claude uses playwright-test-generator agent
// Creates: tests/agents/detection.spec.ts
```

## Debugging Tips

### Quick Debugging Workflow

```bash
# 1. Run test in headed mode to see what's happening
npm run test:e2e:headed

# 2. If fails, run in debug mode
npm run test:e2e:debug

# 3. Check screenshots in test-results/
ls test-results/

# 4. View HTML report
npm run test:e2e:report
```

### Common Issues and Solutions

#### Issue: "Element not found"

```typescript
// ❌ Bad: No wait
await page.click('[data-testid="button"]');

// ✅ Good: Wait for element
await page.waitForSelector('[data-testid="button"]');
await page.click('[data-testid="button"]');
```

#### Issue: "Test times out"

```typescript
// ❌ Bad: Default timeout might be too short
await page.waitForSelector('[data-testid="slow-element"]');

// ✅ Good: Increase timeout for slow operations
await page.waitForSelector('[data-testid="slow-element"]', { timeout: 10000 });
```

#### Issue: "Flaky test"

```typescript
// ❌ Bad: Hard-coded wait
await page.click('button');
await new Promise(r => setTimeout(r, 1000));

// ✅ Good: Wait for specific condition
await page.click('button');
await page.waitForLoadState('networkidle');
```

## Next Steps

### Learn More

1. **Read Test Documentation**
   - [TEST_PLAN.md](./TEST_PLAN.md) - Comprehensive test scenarios
   - [TEST_IMPLEMENTATION_GUIDE.md](./TEST_IMPLEMENTATION_GUIDE.md) - Detailed implementation guide
   - [DEBUGGING.md](./DEBUGGING.md) - Debugging strategies
   - [MAINTENANCE.md](./MAINTENANCE.md) - Maintenance guidelines

2. **Explore Existing Tests**
   - Browse `tests/` directory
   - Run tests in UI mode to see them in action
   - Read test code to understand patterns

3. **Practice Writing Tests**
   - Start with simple tests
   - Use helpers for common operations
   - Follow Arrange-Act-Assert pattern
   - Add proper priorities and categories

### Get Help

- **Ask Claude Code**: Use specialized Playwright agents for guidance
- **Review Documentation**: Check guide files in this directory
- **GitHub Issues**: Report bugs or request features
- **Test Examples**: Look at existing tests for patterns

## Frequently Asked Questions

### How do I run a single test?

```bash
# By file
npx playwright test tests/terminal/creation.spec.ts

# By test name
npx playwright test -g "should create terminal"
```

### How do I skip a test temporarily?

```typescript
test.skip('test to skip', async ({ page }) => {
  // Test code
});
```

### How do I run tests only for specific priority?

```bash
# Run only P0 tests
npx playwright test -g "@P0"

# Run P0 and P1 tests
npx playwright test -g "@P0|@P1"
```

### How do I update screenshots for visual tests?

```bash
npx playwright test --update-snapshots
```

### How do I see detailed test output?

```bash
# Verbose output
npx playwright test --reporter=list

# HTML report with screenshots
npx playwright test
npm run test:e2e:report
```

### How long should tests take?

- **Individual test**: <30 seconds
- **Full suite (local)**: <5 minutes
- **Full suite (CI)**: <10 minutes

## Best Practices Checklist

When writing tests, remember:

- [ ] Use meaningful test names with priorities
- [ ] Follow Arrange-Act-Assert pattern
- [ ] Add category tags for organization
- [ ] Use data-testid selectors for stability
- [ ] Add proper waits (no setTimeout)
- [ ] Clean up in afterEach hook
- [ ] Keep tests independent
- [ ] Test should pass 3+ times consecutively
- [ ] Test execution time <30 seconds
- [ ] Add comments for complex logic

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Test Plan](./TEST_PLAN.md)
- [Implementation Guide](./TEST_IMPLEMENTATION_GUIDE.md)

Happy Testing! 🎭
