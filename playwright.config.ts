import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for VS Code extension E2E testing
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './src/test/e2e',

  // Maximum time one test can run
  timeout: 30 * 1000,

  // Global timeout for entire test run
  globalTimeout: process.env.CI ? 10 * 60 * 1000 : undefined, // 10 minutes in CI

  // Test expectations timeout
  expect: {
    timeout: 5 * 1000, // 5 seconds for expect assertions
  },

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Test sharding for CI (splits tests across multiple machines)
  // Usage: npx playwright test --shard=1/3
  shard: process.env.CI && process.env.SHARD
    ? { current: parseInt(process.env.SHARD.split('/')[0]), total: parseInt(process.env.SHARD.split('/')[1]) }
    : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    process.env.CI ? ['github'] : ['list'],
  ],

  // Shared settings for all projects
  use: {
    // Base URL for the test server
    baseURL: 'http://localhost:3333',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Action timeout
    actionTimeout: 10 * 1000,
  },

  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // VS Code extension test setup
  globalSetup: require.resolve('./src/test/e2e/config/global-setup.ts'),
  globalTeardown: require.resolve('./src/test/e2e/config/global-teardown.ts'),

  // Web server to serve test fixtures
  webServer: {
    command: 'npx http-server src/test/e2e/fixtures -p 3333 -c-1 --silent -o /standalone-webview.html',
    url: 'http://localhost:3333/standalone-webview.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
  },

  // Output directory for test artifacts
  outputDir: 'test-results/',
});
