import { test, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../config/test-constants';

/**
 * Basic setup test to verify Playwright configuration
 */
test.describe('E2E Test Setup', () => {
  test('should have Playwright configured correctly', async () => {
    // This test verifies that Playwright is set up and can run
    expect(TEST_TIMEOUTS.DEFAULT).toBe(30_000);
    expect(TEST_TIMEOUTS.EXTENSION_ACTIVATION).toBe(5_000);
  });

  test('should have test constants defined', async () => {
    expect(TEST_TIMEOUTS).toBeDefined();
    expect(TEST_TIMEOUTS.DEFAULT).toBeGreaterThan(0);
  });
});
