/**
 * Global teardown for Playwright E2E tests
 * Runs once after all tests complete
 */

import { FullConfig } from '@playwright/test';

export default async function globalTeardown(_config: FullConfig) {
  console.log('🧹 Starting Playwright E2E test cleanup...');

  try {
    // Clean up any test artifacts if needed
    if (process.env.CLEAN_ARTIFACTS === 'true') {
      // Future: Clean up generated screenshots, videos, etc.
    }

    console.log('✅ Global teardown complete');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw to allow test results to be reported
  }
}
