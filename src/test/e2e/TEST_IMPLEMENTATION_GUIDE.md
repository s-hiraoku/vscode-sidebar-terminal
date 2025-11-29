# E2E Test Implementation Guide

This guide explains how to implement E2E tests using the Playwright Test framework, test helpers, and test plan.

---

## Quick Start

### 1. Review the Test Plan

Start by reviewing the test scenarios in [TEST_PLAN.md](./TEST_PLAN.md) or [TEST_PLAN_SUMMARY.md](./TEST_PLAN_SUMMARY.md).

### 2. Choose a Test Scenario

Pick a test scenario from the plan (preferably P0 or P1 priority).

### 3. Create a Test File

Create a new test file in the appropriate directory:

- Terminal tests: `tests/terminal/`
- WebView tests: `tests/webview/`
- AI agent tests: `tests/agents/`
- Config tests: `tests/config/`

### 4. Implement the Test

Use the test helpers and follow the patterns shown below.

---

## Test File Structure

```typescript
import { test, expect } from '@playwright/test';
import { VSCodeExtensionTestHelper, TerminalLifecycleHelper } from '../../helpers';
import { TEST_TIMEOUTS } from '../../config/test-constants';

test.describe('Feature Name', () => {
  let extensionHelper: VSCodeExtensionTestHelper;
  let terminalHelper: TerminalLifecycleHelper;

  test.beforeEach(async ({ page }) => {
    // 1. Initialize helpers
    extensionHelper = new VSCodeExtensionTestHelper(page);
    terminalHelper = new TerminalLifecycleHelper(page);

    // 2. Set up test environment
    await extensionHelper.activateExtension();
  });

  test.afterEach(async () => {
    // 3. Clean up resources
    await terminalHelper.deleteAllTerminals();
    await extensionHelper.dispose();
  });

  test('should do something @P0 @tag', async () => {
    // 4. Arrange: Set up test data
    // 5. Act: Perform actions
    // 6. Assert: Verify results
  });
});
```

---

## Using Test Helpers

### VSCodeExtensionTestHelper

**Purpose**: Extension lifecycle and command execution

```typescript
import { VSCodeExtensionTestHelper } from '../../helpers';

const extensionHelper = new VSCodeExtensionTestHelper(page);

// Activate extension
await extensionHelper.activateExtension();

// Execute VS Code commands
await extensionHelper.executeCommand('secondaryTerminal.createTerminal');

// Get/update configuration
const fontSize = await extensionHelper.getConfiguration('secondaryTerminal.fontSize');
await extensionHelper.updateConfiguration('secondaryTerminal.fontSize', 16);

// Check extension status
const isActive = await extensionHelper.isExtensionActive();

// Clean up
await extensionHelper.dispose();
```

### TerminalLifecycleHelper

**Purpose**: Terminal creation, deletion, and management

```typescript
import { TerminalLifecycleHelper } from '../../helpers';

const terminalHelper = new TerminalLifecycleHelper(page);

// Create terminal
const terminalId = await terminalHelper.createTerminal();

// Delete terminal
await terminalHelper.deleteTerminal(1);

// Switch to terminal
await terminalHelper.switchToTerminal(2);

// Get terminal info
const terminals = await terminalHelper.listTerminals();
const count = await terminalHelper.getTerminalCount();
const activeId = await terminalHelper.getActiveTerminalId();

// Send text
await terminalHelper.sendText(1, 'echo "Hello World"');

// Get output
const output = await terminalHelper.getTerminalOutput(1);

// Validate terminal ID
const isValid = terminalHelper.isValidTerminalId(3); // true for 1-5

// Clean up all
await terminalHelper.deleteAllTerminals();
```

### WebViewInteractionHelper

**Purpose**: WebView UI interactions

```typescript
import { WebViewInteractionHelper } from '../../helpers';

const webviewHelper = new WebViewInteractionHelper(page);

// Wait for WebView to load
await webviewHelper.waitForWebViewLoad();

// Get WebView frame
const frame = webviewHelper.getWebViewFrame();

// Type in terminal
await webviewHelper.typeInTerminal('ls -la');

// Alt+Click at coordinates
await webviewHelper.altClick(100, 200);

// Get terminal output
const output = await webviewHelper.getTerminalOutput();

// Scroll
await webviewHelper.scrollTo(500);
const scrollPos = await webviewHelper.getScrollPosition();

// Screenshot
await webviewHelper.screenshot('test-output.png');
```

### VisualTestingUtility

**Purpose**: Screenshot capture and visual regression testing

```typescript
import { VisualTestingUtility } from '../../helpers';

const visualHelper = new VisualTestingUtility(page);

// Capture screenshot
await visualHelper.captureScreenshot({
  name: 'terminal-ansi-colors.png',
  fullPage: false,
});

// Compare with baseline
await visualHelper.compareWithBaseline({
  name: 'terminal-rendering.png',
  maxDiffPixels: 100,
  threshold: 0.1,
});

// Capture element
await visualHelper.captureElement('.terminal-container', 'terminal.png');

// Update baseline
await visualHelper.updateBaseline({ name: 'new-baseline.png' });
```

---

## Test Patterns

### Pattern 1: Basic Terminal Test

```typescript
test('should create and verify terminal', async () => {
  // Arrange: No setup needed

  // Act: Create terminal
  const terminalId = await terminalHelper.createTerminal();

  // Assert: Verify creation
  expect(terminalId).toBe(1);
  expect(await terminalHelper.terminalExists(1)).toBe(true);
});
```

### Pattern 2: Multi-Step Test

```typescript
test('should handle terminal lifecycle', async () => {
  // Arrange: Create initial terminals
  await terminalHelper.createTerminal(); // ID 1
  await terminalHelper.createTerminal(); // ID 2

  // Act: Delete and recreate
  await terminalHelper.deleteTerminal(1);
  const newId = await terminalHelper.createTerminal();

  // Assert: ID should be recycled
  expect(newId).toBe(1);
  expect(await terminalHelper.getTerminalCount()).toBe(2);
});
```

### Pattern 3: Visual Regression Test

```typescript
test('should render ANSI colors correctly', async () => {
  // Arrange: Load ANSI color fixture
  const ansiOutput = readFileSync('src/test/fixtures/e2e/terminal-output/ansi-colors.txt', 'utf-8');

  // Act: Send output to terminal
  await terminalHelper.sendText(1, ansiOutput);

  // Assert: Visual comparison
  await visualHelper.compareWithBaseline({
    name: 'ansi-colors.png',
    element: '.terminal-container',
    threshold: 0.1,
  });
});
```

### Pattern 4: AI Agent Detection Test

```typescript
test('should detect Claude Code agent', async () => {
  // Arrange: Load Claude Code startup fixture
  const claudeStartup = readFileSync(
    'src/test/fixtures/e2e/ai-agent-output/claude-code-startup.txt',
    'utf-8'
  );

  // Act: Send startup message to terminal
  await terminalHelper.sendText(1, claudeStartup);

  // Assert: Verify AI agent detected
  // Future: Check status indicator
  // const indicator = await page.locator('.ai-agent-indicator');
  // await expect(indicator).toContainText('Claude Code');
});
```

### Pattern 5: Configuration Test

```typescript
test('should apply font size change', async () => {
  // Arrange: Get initial font size
  const initialSize = await extensionHelper.getConfiguration('secondaryTerminal.fontSize');

  // Act: Change font size
  await extensionHelper.updateConfiguration('secondaryTerminal.fontSize', 16);

  // Assert: Verify change applied
  const newSize = await extensionHelper.getConfiguration('secondaryTerminal.fontSize');
  expect(newSize).toBe(16);
  expect(newSize).not.toBe(initialSize);
});
```

### Pattern 6: Error Handling Test

```typescript
test('should handle invalid shell path gracefully', async () => {
  // Arrange: Set invalid shell path
  await extensionHelper.updateConfiguration('secondaryTerminal.shell.linux', '/invalid/path/bash');

  // Act: Try to create terminal
  // Future: This should show error notification
  try {
    await terminalHelper.createTerminal();
  } catch (error) {
    // Expected to fail
  }

  // Assert: Verify error handling
  // Future: Check for error notification
  // const notification = await page.locator('.notification.error');
  // await expect(notification).toBeVisible();
});
```

---

## Test Tags

Use tags to categorize and filter tests:

### Priority Tags

- `@P0` - Critical (must pass before release)
- `@P1` - Important (should pass before release)
- `@P2` - Nice-to-have (can be deferred)

### Feature Tags

- `@terminal-lifecycle` - Terminal creation/deletion/switching
- `@webview-interaction` - UI interactions
- `@ai-agent-detection` - AI agent features
- `@session-persistence` - Save/restore functionality
- `@configuration` - Settings management
- `@visual-regression` - Visual testing
- `@performance` - Performance benchmarks
- `@cross-platform` - Platform-specific tests

### Example Usage

```typescript
test('should create terminal @P0 @terminal-lifecycle', async () => {
  // Test implementation
});

test('should detect Claude Code @P0 @ai-agent-detection', async () => {
  // Test implementation
});
```

### Running Tagged Tests

```bash
# Run all P0 tests
npx playwright test --grep "@P0"

# Run terminal lifecycle tests
npx playwright test --grep "@terminal-lifecycle"

# Run P0 AND terminal tests
npx playwright test --grep "(?=.*@P0)(?=.*@terminal-lifecycle)"

# Run P0 OR P1 tests
npx playwright test --grep "@P0|@P1"
```

---

## Test Fixtures

Use fixtures for consistent test data:

```typescript
import { readFileSync } from 'fs';
import { TEST_PATHS } from '../../config/test-constants';

// Load terminal output fixture
const ansiOutput = readFileSync(`${TEST_PATHS.TERMINAL_OUTPUT}/ansi-colors.txt`, 'utf-8');

// Load AI agent output fixture
const claudeStartup = readFileSync(
  `${TEST_PATHS.AI_AGENT_OUTPUT}/claude-code-startup.txt`,
  'utf-8'
);

// Load configuration fixture
const defaultConfig = require(`${TEST_PATHS.CONFIGURATIONS}/default-config.json`);
```

---

## Best Practices

### 1. Test Isolation

- Each test should be independent
- Clean up resources in `afterEach`
- Don't rely on test execution order

### 2. Clear Test Names

```typescript
// ✅ Good
test('should create terminal with ID 1 when first terminal is created', async () => {});

// ❌ Bad
test('test terminal', async () => {});
```

### 3. Arrange-Act-Assert Pattern

```typescript
test('should...', async () => {
  // Arrange: Set up test data
  const initialCount = 0;

  // Act: Perform action
  await terminalHelper.createTerminal();

  // Assert: Verify result
  expect(await terminalHelper.getTerminalCount()).toBe(initialCount + 1);
});
```

### 4. Meaningful Assertions

```typescript
// ✅ Good - specific assertion
expect(terminalId).toBe(1);

// ❌ Bad - vague assertion
expect(terminalId).toBeTruthy();
```

### 5. Test Performance

```typescript
test('should complete within timeout', async () => {
  const startTime = Date.now();

  await terminalHelper.createTerminal();

  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(2000); // 2 seconds
});
```

### 6. Use Test Constants

```typescript
// ✅ Good
expect(count).toBe(TERMINAL_CONSTANTS.MAX_TERMINALS);

// ❌ Bad - magic number
expect(count).toBe(5);
```

### 7. Handle Async Properly

```typescript
// ✅ Good - await all promises
const terminalId = await terminalHelper.createTerminal();
await terminalHelper.deleteTerminal(terminalId);

// ❌ Bad - missing await
terminalHelper.createTerminal(); // Returns unresolved promise!
```

---

## Debugging Tests

### 1. Headed Mode

```bash
npm run test:e2e:headed
```

### 2. Debug Mode

```bash
npm run test:e2e:debug
```

### 3. Playwright Inspector

```bash
npx playwright test --debug
```

### 4. Screenshots on Failure

Screenshots are automatically captured on test failures and saved to `test-results/`

### 5. Console Logging

```typescript
test('should...', async ({ page }) => {
  page.on('console', (msg) => console.log('[Browser]', msg.text()));

  // Test implementation
});
```

---

## Example: Complete Test File

See `tests/terminal/creation.spec.ts` for a complete, working example that demonstrates:

- Proper test structure
- Helper usage
- Multiple test scenarios
- Tags and priorities
- Performance testing
- Error handling

---

## Next Steps

1. **Read the Test Plan**: Review [TEST_PLAN.md](./TEST_PLAN.md)
2. **Run Sample Test**: `npx playwright test tests/terminal/creation.spec.ts`
3. **Implement Tests**: Start with P0 scenarios from the test plan
4. **Use Helpers**: Leverage the helper classes for common operations
5. **Add Fixtures**: Create test data files as needed
6. **Visual Testing**: Add screenshot comparisons for UI tests
7. **CI Integration**: Tests run automatically on PRs via GitHub Actions

---

**Questions or Issues?**

- Review this guide
- Check existing test examples
- Consult Playwright docs: https://playwright.dev/

**Last Updated**: 2025-11-01
