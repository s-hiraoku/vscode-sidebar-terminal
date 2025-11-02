import { Page, Locator } from '@playwright/test';
import { TEST_TIMEOUTS } from '../config/test-constants';

/**
 * Helper class for WebView interaction operations
 * Provides utilities for interacting with the terminal WebView UI
 */
export class WebViewInteractionHelper {
  constructor(private page: Page) {}

  /**
   * Wait for WebView to be fully loaded
   * @param timeout - Maximum wait time
   */
  async waitForWebViewLoad(timeout: number = TEST_TIMEOUTS.WEBVIEW_LOAD): Promise<void> {
    // Future: Wait for WebView iframe to load
    await this.page.waitForLoadState('networkidle', { timeout });
    console.log('[E2E] WebView loaded');
  }

  /**
   * Get WebView iframe element
   * @returns Locator for WebView iframe
   */
  getWebViewFrame(): Locator {
    // Future: Locate actual WebView iframe
    return this.page.locator('iframe.webview');
  }

  /**
   * Click an element in the WebView
   * @param selector - CSS selector for the element
   */
  async clickInWebView(selector: string): Promise<void> {
    const frame = this.getWebViewFrame();
    await frame.locator(selector).click();
  }

  /**
   * Type text into WebView terminal
   * @param text - Text to type
   */
  async typeInTerminal(text: string): Promise<void> {
    // Future: Type into terminal input
    console.log(`[E2E] Type in terminal: ${text}`);
  }

  /**
   * Perform Alt+Click at coordinates
   * @param x - X coordinate
   * @param y - Y coordinate
   */
  async altClick(x: number, y: number): Promise<void> {
    await this.page.mouse.click(x, y, { modifiers: ['Alt'] });
  }

  /**
   * Get terminal output text
   * @returns Terminal output content
   */
  async getTerminalOutput(): Promise<string> {
    // Future: Extract terminal text content
    return '';
  }

  /**
   * Check if WebView is visible
   * @returns True if visible, false otherwise
   */
  async isWebViewVisible(): Promise<boolean> {
    const frame = this.getWebViewFrame();
    return await frame.isVisible();
  }

  /**
   * Scroll WebView to position
   * @param scrollTop - Scroll position
   */
  async scrollTo(scrollTop: number): Promise<void> {
    const frame = this.getWebViewFrame();
    await frame.evaluate((top) => {
      window.scrollTo(0, top);
    }, scrollTop);
  }

  /**
   * Get WebView scroll position
   * @returns Current scroll position
   */
  async getScrollPosition(): Promise<number> {
    const frame = this.getWebViewFrame();
    return await frame.evaluate(() => window.scrollY);
  }

  /**
   * Take screenshot of WebView
   * @param path - File path to save screenshot
   */
  async screenshot(path: string): Promise<void> {
    const frame = this.getWebViewFrame();
    await frame.screenshot({ path });
  }
}
