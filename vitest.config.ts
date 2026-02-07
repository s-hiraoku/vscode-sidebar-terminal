import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'happy-dom',

    // Global test setup
    globals: true,

    // Setup files - run before each test file
    setupFiles: ['./src/test/vitest/setup.ts'],

    // Test file patterns - only include vitest-specific tests
    // Legacy tests remain in src/test/unit, src/test/integration, etc.
    include: ['src/test/vitest/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**'],

    // Timeout settings
    testTimeout: 30000,
    hookTimeout: 30000,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/test/**', 'src/**/*.d.ts', 'src/webview/bundle/**'],
      thresholds: {
        // Adjusted thresholds based on codebase complexity
        // WebView components require DOM/browser environment for full testing
        // Target: Incremental improvement toward 70% lines, 70% functions, 60% branches
        lines: 60,
        functions: 60,
        branches: 50,
      },
    },

    // Reporter
    reporters: ['default'],

    // Parallel execution (Vitest 4 - pool options are now top-level)
    pool: 'forks',
    forks: {
      singleFork: false,
      isolate: true,
    },

    // Sequence for consistent ordering
    sequence: {
      shuffle: false,
    },
  },

  resolve: {
    alias: {
      // Mock vscode module
      vscode: path.resolve(__dirname, 'src/test/vitest/mocks/vscode.ts'),
      // Mock node-pty
      'node-pty': path.resolve(__dirname, 'src/test/vitest/mocks/node-pty.ts'),
    },
  },
});
