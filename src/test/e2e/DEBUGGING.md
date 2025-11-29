# E2E Test Debugging Guide

This guide provides strategies and tools for debugging Playwright E2E tests.

## Quick Start

### Running Tests in Debug Mode

```bash
# Debug mode with Playwright Inspector
npm run test:e2e:debug

# Headed mode (visible browser)
npm run test:e2e:headed

# UI mode (interactive test runner)
npm run test:e2e:ui

# Debug specific test file
npx playwright test tests/terminal/creation.spec.ts --debug
```

### VS Code Debug Configurations

Use VS Code's built-in debugger with these launch configurations:

1. **E2E Tests (Debug)** - Run all tests with Playwright Inspector
2. **E2E Tests (Headed)** - Run with visible browser window
3. **E2E Tests (UI Mode)** - Interactive test runner
4. **E2E Tests (Current File)** - Debug the currently open test file

## Debugging Strategies

### 1. Visual Debugging with Headed Mode

**When to use**: First step for most debugging scenarios

```bash
npm run test:e2e:headed
```

**Benefits**:

- See browser window and interactions in real-time
- Observe test failures visually
- Understand timing issues

**Tips**:

- Add `await page.pause()` to stop execution at specific points
- Use `slowMo` option to slow down test execution:
  ```typescript
  use: {
    slowMo: 1000, // 1 second delay between actions
  }
  ```

### 2. Playwright Inspector

**When to use**: Step-through debugging of test logic

```bash
npm run test:e2e:debug
```

**Features**:

- Step through test execution line by line
- Inspect page state at each step
- Run Playwright commands in console
- Record actions to generate test code

**Tips**:

- Click on any step to jump to that point
- Use "Pick Locator" to test selectors
- View network requests and console logs

### 3. UI Mode (Recommended for Development)

**When to use**: Iterative test development and debugging

```bash
npm run test:e2e:ui
```

**Features**:

- Interactive test runner with visual feedback
- Time-travel debugging through test steps
- Watch mode for automatic re-runs
- Visual comparison of before/after states

**Tips**:

- Use "Watch" mode during test development
- Click on any action to see the page state
- Filter tests by status (passed/failed/skipped)

### 4. Trace Viewer

**When to use**: Post-mortem analysis of failed tests

Traces are automatically collected on first retry in CI.

```bash
# View trace for failed test
npx playwright show-trace test-results/trace.zip
```

**Features**:

- Full timeline of test execution
- Network activity
- Console logs
- Screenshots at each step
- DOM snapshots

**Tips**:

- Hover over timeline to see snapshots
- Click network tab to see all requests
- Use console tab for application logs

### 5. Screenshots and Videos

Screenshots and videos are automatically captured on failure.

**Location**: `test-results/`

**Configuration**:

```typescript
use: {
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}
```

**Manual capture**:

```typescript
await page.screenshot({ path: 'debug-screenshot.png' });
```

## Common Issues and Solutions

### Issue: Test times out

**Symptoms**:

- Test exceeds 30-second timeout
- "Test timeout of 30000ms exceeded" error

**Solutions**:

1. Increase timeout for specific test:

   ```typescript
   test('slow operation', async () => {
     test.setTimeout(60000); // 60 seconds
     // test code
   });
   ```

2. Add explicit waits:

   ```typescript
   await page.waitForSelector('[data-testid="element"]', { timeout: 10000 });
   ```

3. Check for network bottlenecks in trace viewer

### Issue: Flaky test (passes sometimes, fails other times)

**Symptoms**:

- Test passes locally but fails in CI
- Inconsistent failures

**Solutions**:

1. Add proper waits instead of `setTimeout`:

   ```typescript
   // Bad
   await page.click('button');
   await new Promise((resolve) => setTimeout(resolve, 1000));

   // Good
   await page.click('button');
   await page.waitForLoadState('networkidle');
   ```

2. Use `waitForSelector` with proper state:

   ```typescript
   await page.waitForSelector('button', { state: 'visible' });
   await page.click('button');
   ```

3. Enable retries in playwright.config.ts:
   ```typescript
   retries: process.env.CI ? 2 : 0,
   ```

### Issue: Element not found

**Symptoms**:

- "Element not found" error
- "Selector did not match any elements"

**Solutions**:

1. Use Playwright Inspector's "Pick Locator" to find correct selector
2. Add wait before interaction:

   ```typescript
   await page.waitForSelector('[data-testid="button"]');
   await page.click('[data-testid="button"]');
   ```

3. Check if element is in iframe:
   ```typescript
   const frame = page.frameLocator('iframe[name="myframe"]');
   await frame.locator('button').click();
   ```

### Issue: VS Code Extension not activating

**Symptoms**:

- WebView not loading
- Extension commands not available

**Solutions**:

1. Check extension activation events in package.json
2. Verify extension is compiled: `npm run compile`
3. Check VS Code Extension Host logs
4. Add explicit activation wait in test setup

### Issue: Race conditions in concurrent tests

**Symptoms**:

- Tests fail when run in parallel
- Interference between tests

**Solutions**:

1. Use test isolation with beforeEach/afterEach:

   ```typescript
   test.beforeEach(async () => {
     // Create clean test state
   });

   test.afterEach(async () => {
     // Clean up resources
   });
   ```

2. Run tests serially for debugging:

   ```bash
   npx playwright test --workers=1
   ```

3. Use unique test data for each test

## Debugging Workflows

### Workflow 1: Quick Visual Check

```bash
# 1. Run in headed mode
npm run test:e2e:headed

# 2. If fails, check screenshots
ls test-results/

# 3. Review video if available
open test-results/*.webm
```

### Workflow 2: Deep Investigation

```bash
# 1. Run with trace
npx playwright test --trace on

# 2. View trace for failed test
npx playwright show-trace test-results/trace.zip

# 3. Analyze timeline, network, console
```

### Workflow 3: Interactive Development

```bash
# 1. Start UI mode
npm run test:e2e:ui

# 2. Enable watch mode
# 3. Make code changes
# 4. See tests re-run automatically
```

### Workflow 4: CI Debugging

```bash
# 1. Download artifacts from GitHub Actions
# 2. Extract test-results and playwright-report
# 3. View trace or HTML report
npx playwright show-report playwright-report/
```

## Advanced Debugging

### Custom Debug Logging

Add custom logging to tests:

```typescript
test('debug example', async ({ page }) => {
  console.log('Starting test...');

  page.on('console', (msg) => {
    console.log('Browser console:', msg.text());
  });

  await page.goto('http://localhost:3000');
  console.log('Page loaded:', await page.title());
});
```

### Conditional Breakpoints

Use conditional breakpoints in VS Code:

```typescript
// Set breakpoint with condition: count > 5
for (let i = 0; i < 10; i++) {
  const count = await page.locator('.item').count();
  console.log('Count:', count); // Breakpoint here
}
```

### Network Debugging

Capture and analyze network traffic:

```typescript
test('network debug', async ({ page }) => {
  // Log all requests
  page.on('request', (request) => {
    console.log('>>', request.method(), request.url());
  });

  // Log all responses
  page.on('response', (response) => {
    console.log('<<', response.status(), response.url());
  });

  await page.goto('http://localhost:3000');
});
```

### State Inspection

Inspect application state during test:

```typescript
test('state debug', async ({ page }) => {
  // Get element properties
  const text = await page.locator('button').textContent();
  const isVisible = await page.locator('button').isVisible();
  console.log({ text, isVisible });

  // Evaluate in browser context
  const appState = await page.evaluate(() => {
    return window.myApp.getState();
  });
  console.log('App state:', appState);
});
```

## Performance Debugging

### Identify Slow Tests

```bash
# Run with reporter that shows duration
npx playwright test --reporter=list
```

### Profile Test Execution

```typescript
test('performance check', async ({ page }) => {
  const start = Date.now();

  await page.goto('http://localhost:3000');
  console.log('Page load:', Date.now() - start, 'ms');

  const actionStart = Date.now();
  await page.click('button');
  console.log('Button click:', Date.now() - actionStart, 'ms');
});
```

## Best Practices

1. **Use Data Test IDs**: Prefer `[data-testid="..."]` selectors for stability
2. **Add Explicit Waits**: Use `waitForSelector`, `waitForLoadState` instead of `setTimeout`
3. **Enable Tracing on Failure**: Automatically collect traces for failed tests
4. **Use UI Mode During Development**: Faster feedback loop
5. **Run Tests Serially for Debugging**: `--workers=1` to avoid parallel issues
6. **Check CI Artifacts**: Always review screenshots/videos from failed CI runs
7. **Use Headed Mode First**: Visual debugging is often fastest for simple issues
8. **Leverage Inspector for Complex Issues**: Step-through debugging for logic problems

## Resources

- [Playwright Debugging Guide](https://playwright.dev/docs/debug)
- [Playwright Inspector](https://playwright.dev/docs/inspector)
- [Trace Viewer](https://playwright.dev/docs/trace-viewer)
- [VS Code Debugging](https://code.visualstudio.com/docs/editor/debugging)
