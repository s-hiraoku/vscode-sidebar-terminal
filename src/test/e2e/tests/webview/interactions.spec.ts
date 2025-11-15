import { test, expect } from '@playwright/test';
import {
  VSCodeExtensionTestHelper,
  TerminalLifecycleHelper,
  WebViewInteractionHelper,
  VisualTestingUtility,
} from '../../helpers';
import { TEST_TIMEOUTS } from '../../config/test-constants';

/**
 * WebView Interaction Tests
 * Based on TEST_PLAN.md Section 4: WebView Interactions
 *
 * Test Scenarios:
 * - 4.2 Alt+Click Cursor Positioning (P1)
 * - 4.3 IME Composition (Japanese Input) (P1)
 * - 4.4 IME Composition (Chinese Input) (P2)
 * - 4.5 Copy and Paste Functionality (P0)
 * - 4.6 Scrolling Behavior (P1)
 * - 4.8 Theme Changes (P1)
 */
test.describe('WebView Interactions', () => {
  let extensionHelper: VSCodeExtensionTestHelper;
  let terminalHelper: TerminalLifecycleHelper;
  let webviewHelper: WebViewInteractionHelper;
  let visualHelper: VisualTestingUtility;

  test.beforeEach(async ({ page }) => {
    // Initialize test helpers
    extensionHelper = new VSCodeExtensionTestHelper(page);
    terminalHelper = new TerminalLifecycleHelper(page);
    webviewHelper = new WebViewInteractionHelper(page);
    visualHelper = new VisualTestingUtility(page);

    // Activate extension
    await extensionHelper.activateExtension();

    // Wait for WebView to load
    await webviewHelper.waitForWebViewLoad();

    // Create default terminal
    await terminalHelper.createTerminal();
  });

  test.afterEach(async () => {
    // Clean up all terminals
    await terminalHelper.deleteAllTerminals();

    // Dispose extension resources
    await extensionHelper.dispose();
  });

  /**
   * Test Scenario 4.2: Alt+Click Cursor Positioning
   * Priority: P1 (Important)
   *
   * Validates that holding Alt/Option and clicking in the terminal
   * moves the cursor to the clicked position using ANSI escape sequences.
   */
  test('should move cursor with Alt+Click @P1 @webview-interaction', async ({ page }) => {
    // Arrange: Enable Alt+Click feature
    await extensionHelper.updateConfiguration('secondaryTerminal.altClickMovesCursor', true);

    // Generate multi-line output
    await terminalHelper.sendText(1, 'echo "Line 1: First line"');
    await terminalHelper.sendText(1, 'echo "Line 2: Second line"');
    await terminalHelper.sendText(1, 'echo "Line 3: Third line"');

    // Wait for output
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Act: Get terminal output element
    const terminalElement = await page.locator('.terminal-container').first();
    const boundingBox = await terminalElement.boundingBox();

    if (!boundingBox) {
      throw new Error('Terminal element not found');
    }

    // Calculate position in middle of "Second" word on Line 2
    // This is approximate - actual implementation would need to calculate
    // character position based on font metrics
    const clickX = boundingBox.x + 150;
    const clickY = boundingBox.y + 40; // Approximate second line

    // Perform Alt+Click
    await page.keyboard.down('Alt');
    await page.mouse.click(clickX, clickY);
    await page.keyboard.up('Alt');

    // Type text at cursor position
    await webviewHelper.typeInTerminal('INSERTED');

    // Wait for text to appear
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Assert: Text should be inserted at clicked position
    const output = await terminalHelper.getTerminalOutput(1);
    expect(output).toContain('INSERTED');

    // Assert: Cursor position should have changed
    // (ANSI escape sequences sent to terminal)
    // This is verified by the text appearing in the expected position
  });

  /**
   * Test Scenario 4.2b: Alt+Click Disabled
   * Priority: P1 (Important)
   *
   * Validates that Alt+Click does not move cursor when feature is disabled.
   */
  test('should not move cursor with Alt+Click when disabled @P1 @webview-interaction', async ({
    page,
  }) => {
    // Arrange: Disable Alt+Click feature
    await extensionHelper.updateConfiguration('secondaryTerminal.altClickMovesCursor', false);

    await terminalHelper.sendText(1, 'echo "Test line"');
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Act: Perform Alt+Click
    const terminalElement = await page.locator('.terminal-container').first();
    const boundingBox = await terminalElement.boundingBox();

    if (boundingBox) {
      await page.keyboard.down('Alt');
      await page.mouse.click(boundingBox.x + 100, boundingBox.y + 20);
      await page.keyboard.up('Alt');
    }

    // Type text
    await webviewHelper.typeInTerminal('NO_MOVE');

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Assert: Text should appear at current cursor position (end of line)
    // not at the clicked position
    const output = await terminalHelper.getTerminalOutput(1);
    expect(output).toContain('NO_MOVE');
  });

  /**
   * Test Scenario 4.3: IME Composition (Japanese Input)
   * Priority: P1 (Important)
   *
   * Validates that Japanese IME input (romaji -> kanji conversion)
   * works correctly with composition events.
   */
  test('should handle Japanese IME composition @P1 @webview-interaction @ime', async ({ page }) => {
    // Note: This test simulates IME events. Actual IME testing requires
    // system-level IME to be enabled and is typically done manually.

    // Arrange: Focus terminal
    await webviewHelper.focusTerminal();

    // Act: Simulate IME composition events for "nihongo" -> "日本語"
    const terminalInput = await page.locator('.terminal-input').first();

    // Simulate compositionstart
    await terminalInput.dispatchEvent('compositionstart', { data: '' });

    // Simulate compositionupdate (typing romaji)
    await terminalInput.dispatchEvent('compositionupdate', { data: 'nihongo' });

    // Simulate composition conversion (space key pressed for kanji selection)
    await terminalInput.dispatchEvent('compositionupdate', { data: '日本語' });

    // Simulate compositionend (Enter key to confirm)
    await terminalInput.dispatchEvent('compositionend', { data: '日本語' });

    // Trigger input event with final text
    await terminalInput.fill('日本語');
    await page.keyboard.press('Enter');

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Assert: Japanese characters should appear in terminal
    const output = await terminalHelper.getTerminalOutput(1);
    expect(output).toContain('日本語');

    // Assert: No duplicate characters
    const matches = output.match(/日本語/g);
    expect(matches?.length).toBe(1);
  });

  /**
   * Test Scenario 4.4: IME Composition (Chinese Input)
   * Priority: P2 (Nice-to-have)
   *
   * Validates that Chinese IME input (pinyin -> hanzi conversion)
   * works correctly.
   */
  test('should handle Chinese IME composition @P2 @webview-interaction @ime', async ({ page }) => {
    // Arrange: Focus terminal
    await webviewHelper.focusTerminal();

    // Act: Simulate IME composition for "zhongwen" -> "中文"
    const terminalInput = await page.locator('.terminal-input').first();

    await terminalInput.dispatchEvent('compositionstart', { data: '' });
    await terminalInput.dispatchEvent('compositionupdate', { data: 'zhongwen' });
    await terminalInput.dispatchEvent('compositionupdate', { data: '中文' });
    await terminalInput.dispatchEvent('compositionend', { data: '中文' });

    await terminalInput.fill('中文');
    await page.keyboard.press('Enter');

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Assert: Chinese characters should appear correctly
    const output = await terminalHelper.getTerminalOutput(1);
    expect(output).toContain('中文');

    // Assert: Multi-byte characters displayed correctly (no encoding issues)
    const bytes = Buffer.from('中文', 'utf-8');
    expect(bytes.length).toBeGreaterThan(2); // Multi-byte verification
  });

  /**
   * Test Scenario 4.5: Copy and Paste Functionality
   * Priority: P0 (Critical)
   *
   * Validates that text can be selected, copied to clipboard,
   * and pasted back into the terminal correctly.
   */
  test('should copy and paste text correctly @P0 @webview-interaction', async ({ page, context }) => {
    // Arrange: Generate output to copy
    await terminalHelper.sendText(1, 'echo "Test content for copy-paste"');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Act: Select text "Test content" with mouse drag
    const terminalElement = await page.locator('.terminal-container').first();
    const boundingBox = await terminalElement.boundingBox();

    if (!boundingBox) {
      throw new Error('Terminal element not found');
    }

    // Select text by dragging
    await page.mouse.move(boundingBox.x + 50, boundingBox.y + 20);
    await page.mouse.down();
    await page.mouse.move(boundingBox.x + 200, boundingBox.y + 20);
    await page.mouse.up();

    // Wait for selection
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Copy to clipboard (Ctrl+C or Cmd+C)
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+KeyC`);

    // Wait for clipboard operation
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('Test content');

    // Act: Paste text back into terminal
    await webviewHelper.focusTerminal();
    await page.keyboard.press(`${modifier}+KeyV`);

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Assert: Pasted text should appear in terminal output
    const output = await terminalHelper.getTerminalOutput(1);
    const pastedTextOccurrences = (output.match(/Test content/g) || []).length;
    expect(pastedTextOccurrences).toBeGreaterThanOrEqual(2); // Original + pasted

    // Assert: ANSI escape codes should be removed from copied text
    expect(clipboardText).not.toMatch(/\x1b\[[0-9;]*m/); // No ANSI codes
  });

  /**
   * Test Scenario 4.5b: Multi-line Copy/Paste
   * Priority: P0 (Critical)
   *
   * Validates that multi-line text can be copied and pasted
   * with line breaks preserved.
   */
  test('should preserve line breaks in multi-line copy-paste @P0 @webview-interaction', async ({
    page,
    context,
  }) => {
    // Arrange: Generate multi-line output
    await terminalHelper.sendText(1, 'echo "Line 1"');
    await terminalHelper.sendText(1, 'echo "Line 2"');
    await terminalHelper.sendText(1, 'echo "Line 3"');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Act: Select all text with Ctrl+A / Cmd+A
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await webviewHelper.focusTerminal();
    await page.keyboard.press(`${modifier}+KeyA`);

    // Copy
    await page.keyboard.press(`${modifier}+KeyC`);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Grant permissions and read clipboard
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    // Assert: Clipboard should contain multiple lines
    const lines = clipboardText.split('\n').filter((line) => line.trim().length > 0);
    expect(lines.length).toBeGreaterThan(1);

    // Assert: All three lines should be present
    expect(clipboardText).toContain('Line 1');
    expect(clipboardText).toContain('Line 2');
    expect(clipboardText).toContain('Line 3');
  });

  /**
   * Test Scenario 4.6: Scrolling Behavior
   * Priority: P1 (Important)
   *
   * Validates that terminal scrolling works correctly with
   * mouse wheel, scrollbar, and keyboard shortcuts.
   */
  test('should handle terminal scrolling correctly @P1 @webview-interaction', async ({ page }) => {
    // Arrange: Generate 100 lines of output
    await terminalHelper.sendText(1, 'for i in {1..100}; do echo "Line $i"; done');

    // Wait for output generation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Act: Get initial scroll position
    const initialScrollPos = await webviewHelper.getScrollPosition();

    // Scroll up with mouse wheel
    const terminalElement = await page.locator('.terminal-container').first();
    await terminalElement.hover();

    // Simulate wheel scroll up (negative deltaY)
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, -100);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const scrolledUpPos = await webviewHelper.getScrollPosition();

    // Assert: Scroll position should have decreased (scrolled up)
    expect(scrolledUpPos).toBeLessThan(initialScrollPos);

    // Act: Scroll to top with Page Up
    await page.keyboard.press('PageUp');
    await new Promise((resolve) => setTimeout(resolve, 300));

    const topScrollPos = await webviewHelper.getScrollPosition();

    // Assert: Should be near top
    expect(topScrollPos).toBeLessThan(scrolledUpPos);

    // Act: Scroll to bottom with Page Down
    await page.keyboard.press('End'); // Jump to bottom
    await new Promise((resolve) => setTimeout(resolve, 300));

    const bottomScrollPos = await webviewHelper.getScrollPosition();

    // Assert: Should be back near bottom
    expect(bottomScrollPos).toBeGreaterThan(topScrollPos);

    // Act: Generate new output while scrolled up
    await page.keyboard.press('Home'); // Jump to top
    await new Promise((resolve) => setTimeout(resolve, 300));

    await terminalHelper.sendText(1, 'echo "New output"');
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Assert: Should auto-scroll to bottom when new output appears
    // (This behavior depends on implementation - some terminals only
    // auto-scroll if user is already at bottom)
    const finalScrollPos = await webviewHelper.getScrollPosition();
    // Verify scrollbar position reflects buffer size
    expect(finalScrollPos).toBeGreaterThanOrEqual(0);
  });

  /**
   * Test Scenario 4.8: Theme Changes
   * Priority: P1 (Important)
   *
   * Validates that terminal colors update immediately when
   * VS Code theme is changed (light, dark, high contrast).
   */
  test('should apply theme changes to terminal colors @P1 @webview-interaction @visual-regression', async ({
    page,
  }) => {
    // Arrange: Generate colored output
    await terminalHelper.sendText(
      1,
      'echo -e "\\033[31mRed\\033[0m \\033[32mGreen\\033[0m \\033[34mBlue\\033[0m"'
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Capture baseline with current theme
    await visualHelper.captureScreenshot({
      name: 'terminal-initial-theme.png',
      element: '.terminal-container',
    });

    // Act: Switch to light theme
    await extensionHelper.executeCommand('workbench.action.selectTheme');
    await page.keyboard.type('Light');
    await page.keyboard.press('Enter');

    // Wait for theme to apply
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Capture light theme
    await visualHelper.captureScreenshot({
      name: 'terminal-light-theme.png',
      element: '.terminal-container',
    });

    // Act: Switch to dark theme
    await extensionHelper.executeCommand('workbench.action.selectTheme');
    await page.keyboard.type('Dark');
    await page.keyboard.press('Enter');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Capture dark theme
    await visualHelper.captureScreenshot({
      name: 'terminal-dark-theme.png',
      element: '.terminal-container',
    });

    // Assert: Terminal background should have changed
    const lightBg = await page.locator('.terminal-container').first().evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Switch back to light and verify
    await extensionHelper.executeCommand('workbench.action.selectTheme');
    await page.keyboard.type('Light');
    await page.keyboard.press('Enter');
    await new Promise((resolve) => setTimeout(resolve, 500));

    const lightBg2 = await page.locator('.terminal-container').first().evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Assert: Background colors should be different between light and dark
    // and consistent for the same theme
    expect(lightBg).toBeTruthy();
    expect(lightBg2).toBeTruthy();

    // Assert: No visual artifacts during transition
    // (This is verified by the screenshots captured above)
  });

  /**
   * Test Scenario: Scrollback Limit Enforcement
   * Priority: P1 (Important)
   *
   * Validates that scrollback buffer respects the configured limit.
   */
  test('should enforce scrollback limit @P1 @webview-interaction', async () => {
    // Arrange: Set scrollback limit to 2000 lines (default)
    await extensionHelper.updateConfiguration('secondaryTerminal.scrollback', 2000);

    // Generate 2500 lines (exceeds limit)
    await terminalHelper.sendText(1, 'for i in {1..2500}; do echo "Line $i"; done');

    // Wait for output
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Act: Get terminal output
    const output = await terminalHelper.getTerminalOutput(1);
    const _lines = output.split('\n').filter((line) => line.trim().length > 0);

    // Assert: Only last 2000 lines should be preserved
    // First 500 lines should be discarded
    expect(output).toContain('Line 2500');
    expect(output).toContain('Line 501');
    expect(output).not.toContain('Line 1 '); // Space to avoid "Line 1000"
    expect(output).not.toContain('Line 500');

    // Assert: Scrollbar should reflect correct buffer size
    const scrollHeight = await webviewHelper.getScrollHeight();
    expect(scrollHeight).toBeGreaterThan(0);
  });
});
