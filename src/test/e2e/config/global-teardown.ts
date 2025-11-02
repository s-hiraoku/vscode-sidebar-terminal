/**
 * Global teardown for Playwright E2E tests
 * Runs once after all tests complete
 */
export default async function globalTeardown() {
  console.log('🧹 Starting Playwright E2E test cleanup...');

  // Future: Clean up test workspaces
  // Future: Dispose extension resources

  console.log('✅ Global teardown complete');
}
