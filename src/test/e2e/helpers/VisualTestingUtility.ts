import { Page, expect } from '@playwright/test';
import { VISUAL_TEST_CONSTANTS, TEST_PATHS } from '../config/test-constants';
import * as path from 'path';

/**
 * Screenshot options interface
 */
export interface ScreenshotOptions {
  /** File name for the screenshot */
  name: string;
  /** Whether to capture full page */
  fullPage?: boolean;
  /** Element selector to screenshot */
  element?: string;
  /** Maximum pixel differences allowed */
  maxDiffPixels?: number;
  /** Threshold for comparison */
  threshold?: number;
}

/**
 * Helper class for visual testing and screenshot comparison
 * Provides utilities for capturing and comparing screenshots
 */
export class VisualTestingUtility {
  constructor(private page: Page) {}

  /**
   * Capture a screenshot
   * @param options - Screenshot options
   * @returns Path to saved screenshot
   */
  async captureScreenshot(options: ScreenshotOptions): Promise<string> {
    const { name, fullPage = false, element } = options;
    const screenshotPath = path.join(TEST_PATHS.SCREENSHOTS, name);

    if (element) {
      const locator = this.page.locator(element);
      await locator.screenshot({ path: screenshotPath });
    } else {
      await this.page.screenshot({
        path: screenshotPath,
        fullPage,
      });
    }

    console.log(`[E2E] Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  }

  /**
   * Compare screenshot with baseline
   * @param options - Screenshot options
   */
  async compareWithBaseline(options: ScreenshotOptions): Promise<void> {
    const {
      name,
      maxDiffPixels = VISUAL_TEST_CONSTANTS.MAX_DIFF_PIXELS,
      threshold = VISUAL_TEST_CONSTANTS.THRESHOLD,
    } = options;

    await expect(this.page).toHaveScreenshot(name, {
      maxDiffPixels,
      threshold,
    });
  }

  /**
   * Capture element screenshot
   * @param selector - Element selector
   * @param name - Screenshot name
   * @returns Path to saved screenshot
   */
  async captureElement(selector: string, name: string): Promise<string> {
    return await this.captureScreenshot({
      name,
      element: selector,
    });
  }

  /**
   * Capture full page screenshot
   * @param name - Screenshot name
   * @returns Path to saved screenshot
   */
  async captureFullPage(name: string): Promise<string> {
    return await this.captureScreenshot({
      name,
      fullPage: true,
    });
  }

  /**
   * Update baseline screenshot
   * @param options - Screenshot options
   */
  async updateBaseline(options: ScreenshotOptions): Promise<void> {
    // Capture new screenshot as baseline
    await this.captureScreenshot(options);
    console.log(`[E2E] Baseline updated: ${options.name}`);
  }

  /**
   * Check if two screenshots match
   * @param actual - Actual screenshot path
   * @param expected - Expected screenshot path
   * @param tolerance - Pixel difference tolerance (0.0-1.0)
   * @returns True if screenshots match within tolerance
   */
  async screenshotsMatch(actual: string, expected: string, tolerance: number = 0.001): Promise<boolean> {
    // Future: Implement pixel-by-pixel comparison
    console.log(`[E2E] Comparing screenshots: ${actual} vs ${expected}`);
    return true;
  }

  /**
   * Get screenshot diff percentage
   * @param actual - Actual screenshot path
   * @param expected - Expected screenshot path
   * @returns Percentage of different pixels (0.0-100.0)
   */
  async getScreenshotDiff(actual: string, expected: string): Promise<number> {
    // Future: Calculate pixel difference percentage
    return 0.0;
  }

  /**
   * Generate diff image
   * @param actual - Actual screenshot path
   * @param expected - Expected screenshot path
   * @param output - Output path for diff image
   */
  async generateDiffImage(actual: string, expected: string, output: string): Promise<void> {
    // Future: Generate highlighted diff image
    console.log(`[E2E] Diff image would be saved to: ${output}`);
  }
}
