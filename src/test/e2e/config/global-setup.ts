/**
 * Global setup for Playwright E2E tests
 * Runs once before all tests
 */

import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export default async function globalSetup(_config: FullConfig) {
  console.log('🚀 Starting Playwright E2E test setup...');

  try {
    // Verify the fixture file exists
    const fixturePath = path.join(__dirname, '../fixtures/standalone-webview.html');
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Fixture file not found: ${fixturePath}`);
    }
    console.log('✅ Fixture file verified');

    // Write the port to a file for tests to read
    const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';

    // Optionally verify browser can load the page
    if (process.env.E2E_VERIFY_SETUP === 'true') {
      const browser = await chromium.launch();
      const page = await browser.newPage();
      try {
        await page.goto(`${baseUrl}/`, { timeout: 5000 });
        const title = await page.title();
        console.log(`✅ Verified test page loads: "${title}"`);
      } finally {
        await browser.close();
      }
    }

    console.log('✅ Global setup complete');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}
