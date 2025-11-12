import { test, expect } from '@playwright/test';
import {
  VSCodeExtensionTestHelper,
  TerminalLifecycleHelper,
  WebViewInteractionHelper,
} from '../../helpers';
import { TEST_TIMEOUTS, TERMINAL_CONSTANTS } from '../../config/test-constants';

/**
 * Split Terminal and Layout Tests
 * Based on TEST_PLAN.md Section 6: Split Terminal and Layout
 *
 * Test Scenarios:
 * - 6.1 Vertical Split (P1)
 * - 6.2 Horizontal Split (P1)
 * - 6.3 Maximum Split Terminals (P2)
 */
test.describe('Split Terminal and Layout', () => {
  let extensionHelper: VSCodeExtensionTestHelper;
  let terminalHelper: TerminalLifecycleHelper;
  let webviewHelper: WebViewInteractionHelper;

  test.beforeEach(async ({ page }) => {
    // Initialize test helpers
    extensionHelper = new VSCodeExtensionTestHelper(page);
    terminalHelper = new TerminalLifecycleHelper(page);
    webviewHelper = new WebViewInteractionHelper(page);

    // Activate extension
    await extensionHelper.activateExtension();

    // Wait for WebView to load
    await webviewHelper.waitForWebViewLoad();
  });

  test.afterEach(async () => {
    // Clean up all terminals
    await terminalHelper.deleteAllTerminals();

    // Dispose extension resources
    await extensionHelper.dispose();
  });

  /**
   * Test Scenario 6.1: Vertical Split
   * Priority: P1 (Important)
   *
   * Validates that terminals can be split vertically to create
   * side-by-side layout with independent scrolling and content.
   */
  test('should create vertical split with two side-by-side terminals @P1 @split-terminal', async ({
    page,
  }) => {
    // Arrange: Create initial terminal with content
    const terminal1Id = await terminalHelper.createTerminal();
    await terminalHelper.sendText(terminal1Id, 'echo "First terminal"');

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Act: Execute vertical split command
    await extensionHelper.executeCommand('secondaryTerminal.splitTerminalVertical');

    // Wait for split to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Assert: Two terminals should exist
    const terminalCount = await terminalHelper.getTerminalCount();
    expect(terminalCount).toBe(2);

    // Assert: Get terminal IDs
    const terminals = await terminalHelper.listTerminals();
    expect(terminals.length).toBe(2);
    expect(terminals[0].id).toBe(1);
    expect(terminals[1].id).toBe(2);

    // Assert: First terminal should retain content
    const terminal1Output = await terminalHelper.getTerminalOutput(1);
    expect(terminal1Output).toContain('First terminal');

    // Assert: Second terminal should be empty (new terminal)
    const terminal2Output = await terminalHelper.getTerminalOutput(2);
    expect(terminal2Output).not.toContain('First terminal');

    // Act: Verify both terminals are visible side-by-side
    const terminal1Element = await page.locator('[data-terminal-id="1"]').first();
    const terminal2Element = await page.locator('[data-terminal-id="2"]').first();

    const terminal1Box = await terminal1Element.boundingBox();
    const terminal2Box = await terminal2Element.boundingBox();

    if (terminal1Box && terminal2Box) {
      // Assert: Terminals should be positioned side-by-side (vertical split)
      // Terminal 2 should be to the right of Terminal 1 (or vice versa)
      const areSideBySide =
        Math.abs(terminal1Box.y - terminal2Box.y) < 50 && // Same vertical position
        Math.abs(terminal1Box.x - terminal2Box.x) > 100; // Different horizontal position

      expect(areSideBySide).toBe(true);

      // Assert: Terminals should be approximately equal width
      const widthDifference = Math.abs(terminal1Box.width - terminal2Box.width);
      expect(widthDifference).toBeLessThan(50); // Allow small difference
    }

    // Assert: Each terminal should be independently scrollable
    await terminalHelper.sendText(1, 'for i in {1..50}; do echo "Terminal 1 Line $i"; done');
    await terminalHelper.sendText(2, 'for i in {1..50}; do echo "Terminal 2 Line $i"; done');

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify both terminals have independent content
    const terminal1FinalOutput = await terminalHelper.getTerminalOutput(1);
    const terminal2FinalOutput = await terminalHelper.getTerminalOutput(2);

    expect(terminal1FinalOutput).toContain('Terminal 1 Line');
    expect(terminal2FinalOutput).toContain('Terminal 2 Line');
    expect(terminal1FinalOutput).not.toContain('Terminal 2 Line');
    expect(terminal2FinalOutput).not.toContain('Terminal 1 Line');
  });

  /**
   * Test Scenario 6.1b: Vertical Split with Resize
   * Priority: P1 (Important)
   *
   * Validates that vertically split terminals resize proportionally
   * when the VS Code window is resized.
   */
  test('should resize split terminals proportionally on window resize @P1 @split-terminal', async ({
    page,
  }) => {
    // Arrange: Create vertical split
    await terminalHelper.createTerminal();
    await extensionHelper.executeCommand('secondaryTerminal.splitTerminalVertical');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get initial terminal widths
    const terminal1ElementBefore = await page.locator('[data-terminal-id="1"]').first();
    const terminal2ElementBefore = await page.locator('[data-terminal-id="2"]').first();

    const terminal1BoxBefore = await terminal1ElementBefore.boundingBox();
    const terminal2BoxBefore = await terminal2ElementBefore.boundingBox();

    // Act: Resize VS Code window
    await page.setViewportSize({ width: 1600, height: 900 });
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get terminal widths after resize
    const terminal1ElementAfter = await page.locator('[data-terminal-id="1"]').first();
    const terminal2ElementAfter = await page.locator('[data-terminal-id="2"]').first();

    const terminal1BoxAfter = await terminal1ElementAfter.boundingBox();
    const terminal2BoxAfter = await terminal2ElementAfter.boundingBox();

    // Assert: Terminal widths should have changed proportionally
    if (terminal1BoxBefore && terminal2BoxBefore && terminal1BoxAfter && terminal2BoxAfter) {
      const initialWidthRatio = terminal1BoxBefore.width / terminal2BoxBefore.width;
      const finalWidthRatio = terminal1BoxAfter.width / terminal2BoxAfter.width;

      // Ratios should be approximately equal (proportional resize)
      expect(Math.abs(initialWidthRatio - finalWidthRatio)).toBeLessThan(0.2);
    }

    // Assert: Both terminals should still be visible and functional
    const terminalCount = await terminalHelper.getTerminalCount();
    expect(terminalCount).toBe(2);
  });

  /**
   * Test Scenario 6.2: Horizontal Split
   * Priority: P1 (Important)
   *
   * Validates that terminals can be split horizontally to create
   * stacked layout (one above the other).
   */
  test('should create horizontal split with stacked terminals @P1 @split-terminal', async ({
    page,
  }) => {
    // Arrange: Enable dynamic split direction
    await extensionHelper.updateConfiguration('secondaryTerminal.dynamicSplitDirection', true);

    // Set panel location to bottom (triggers horizontal split)
    await extensionHelper.updateConfiguration('secondaryTerminal.panelLocation', 'panel');

    const terminal1Id = await terminalHelper.createTerminal();
    await terminalHelper.sendText(terminal1Id, 'echo "Top terminal"');

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Act: Execute horizontal split command
    await extensionHelper.executeCommand('secondaryTerminal.splitTerminalHorizontal');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Assert: Two terminals should exist
    const terminalCount = await terminalHelper.getTerminalCount();
    expect(terminalCount).toBe(2);

    // Assert: Get terminal elements
    const terminal1Element = await page.locator('[data-terminal-id="1"]').first();
    const terminal2Element = await page.locator('[data-terminal-id="2"]').first();

    const terminal1Box = await terminal1Element.boundingBox();
    const terminal2Box = await terminal2Element.boundingBox();

    if (terminal1Box && terminal2Box) {
      // Assert: Terminals should be stacked vertically (horizontal split)
      // Terminal 2 should be below Terminal 1 (or vice versa)
      const areStacked =
        Math.abs(terminal1Box.x - terminal2Box.x) < 50 && // Same horizontal position
        Math.abs(terminal1Box.y - terminal2Box.y) > 100; // Different vertical position

      expect(areStacked).toBe(true);

      // Assert: Terminals should be approximately equal height
      const heightDifference = Math.abs(terminal1Box.height - terminal2Box.height);
      expect(heightDifference).toBeLessThan(50);
    }

    // Assert: First terminal should retain content
    const terminal1Output = await terminalHelper.getTerminalOutput(1);
    expect(terminal1Output).toContain('Top terminal');

    // Assert: Both terminals should be independently functional
    await terminalHelper.sendText(2, 'echo "Bottom terminal"');
    await new Promise((resolve) => setTimeout(resolve, 500));

    const terminal2Output = await terminalHelper.getTerminalOutput(2);
    expect(terminal2Output).toContain('Bottom terminal');
  });

  /**
   * Test Scenario 6.2b: Splitter Bar Dragging
   * Priority: P1 (Important)
   *
   * Validates that the splitter bar between split terminals
   * can be dragged to resize the terminals.
   */
  test('should allow splitter bar dragging to resize terminals @P1 @split-terminal', async ({
    page,
  }) => {
    // Arrange: Create horizontal split
    await extensionHelper.updateConfiguration('secondaryTerminal.dynamicSplitDirection', true);
    await terminalHelper.createTerminal();
    await extensionHelper.executeCommand('secondaryTerminal.splitTerminalHorizontal');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get initial terminal heights
    const terminal1ElementBefore = await page.locator('[data-terminal-id="1"]').first();
    const terminal1HeightBefore = (await terminal1ElementBefore.boundingBox())?.height || 0;

    // Act: Find and drag splitter bar
    const splitterBar = await page.locator('.split-view-splitter').first();
    const splitterBox = await splitterBar.boundingBox();

    if (splitterBox) {
      // Drag splitter down by 100 pixels
      await page.mouse.move(splitterBox.x + splitterBox.width / 2, splitterBox.y);
      await page.mouse.down();
      await page.mouse.move(
        splitterBox.x + splitterBox.width / 2,
        splitterBox.y + 100,
        { steps: 10 }
      );
      await page.mouse.up();

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get terminal heights after dragging
      const terminal1ElementAfter = await page.locator('[data-terminal-id="1"]').first();
      const terminal1HeightAfter = (await terminal1ElementAfter.boundingBox())?.height || 0;

      // Assert: Terminal 1 height should have increased
      expect(terminal1HeightAfter).toBeGreaterThan(terminal1HeightBefore);
    }

    // Assert: Minimum height should be enforced (100px default)
    const terminal2Element = await page.locator('[data-terminal-id="2"]').first();
    const terminal2Height = (await terminal2Element.boundingBox())?.height || 0;
    expect(terminal2Height).toBeGreaterThanOrEqual(100);
  });

  /**
   * Test Scenario 6.3: Maximum Split Terminals
   * Priority: P2 (Nice-to-have)
   *
   * Validates that the maximum number of split terminals is enforced
   * and proper warning messages are shown.
   */
  test('should enforce maximum split terminal limit @P2 @split-terminal', async () => {
    // Arrange: Set maximum split terminals to 3
    await extensionHelper.updateConfiguration('secondaryTerminal.maxSplitTerminals', 3);

    // Act: Create terminals up to the limit
    const terminal1Id = await terminalHelper.createTerminal();

    await extensionHelper.executeCommand('secondaryTerminal.splitTerminalVertical');
    await new Promise((resolve) => setTimeout(resolve, 500));

    await extensionHelper.executeCommand('secondaryTerminal.splitTerminalVertical');
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Assert: 3 terminals should exist
    let terminalCount = await terminalHelper.getTerminalCount();
    expect(terminalCount).toBe(3);

    // Act: Attempt to create 4th split terminal
    try {
      await extensionHelper.executeCommand('secondaryTerminal.splitTerminalVertical');
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      // Expected to fail or show warning
    }

    // Assert: Still 3 terminals (4th split blocked)
    terminalCount = await terminalHelper.getTerminalCount();
    expect(terminalCount).toBe(3);

    // Assert: Warning message should be shown
    // (Implementation-dependent - may appear as notification)
    // Future: Check for notification message
    // const notification = await page.locator('.notification.warning');
    // await expect(notification).toContainText('Maximum split terminals reached');

    // Act: Close one terminal
    await terminalHelper.deleteTerminal(2);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Assert: Terminal count reduced to 2
    terminalCount = await terminalHelper.getTerminalCount();
    expect(terminalCount).toBe(2);

    // Act: Now split should succeed again
    await extensionHelper.executeCommand('secondaryTerminal.splitTerminalVertical');
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Assert: Terminal count should be 3 again
    terminalCount = await terminalHelper.getTerminalCount();
    expect(terminalCount).toBe(3);
  });

  /**
   * Test Scenario: Split View Reorganization on Terminal Close
   * Priority: P1 (Important)
   *
   * Validates that when a split terminal is closed, remaining terminals
   * resize to fill the available space.
   */
  test('should reorganize split view when terminal is closed @P1 @split-terminal', async ({
    page,
  }) => {
    // Arrange: Create 3 split terminals
    await terminalHelper.createTerminal();
    await extensionHelper.executeCommand('secondaryTerminal.splitTerminalVertical');
    await extensionHelper.executeCommand('secondaryTerminal.splitTerminalVertical');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get initial terminal widths
    const terminal1ElementBefore = await page.locator('[data-terminal-id="1"]').first();
    const terminal2ElementBefore = await page.locator('[data-terminal-id="2"]').first();

    const terminal1WidthBefore = (await terminal1ElementBefore.boundingBox())?.width || 0;
    const terminal2WidthBefore = (await terminal2ElementBefore.boundingBox())?.width || 0;

    // Act: Close terminal 3
    await terminalHelper.deleteTerminal(3);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get terminal widths after closing
    const terminal1ElementAfter = await page.locator('[data-terminal-id="1"]').first();
    const terminal2ElementAfter = await page.locator('[data-terminal-id="2"]').first();

    const terminal1WidthAfter = (await terminal1ElementAfter.boundingBox())?.width || 0;
    const terminal2WidthAfter = (await terminal2ElementAfter.boundingBox())?.width || 0;

    // Assert: Remaining terminals should have expanded to fill space
    expect(terminal1WidthAfter).toBeGreaterThan(terminal1WidthBefore);
    expect(terminal2WidthAfter).toBeGreaterThan(terminal2WidthBefore);

    // Assert: 2 terminals should remain
    const terminalCount = await terminalHelper.getTerminalCount();
    expect(terminalCount).toBe(2);

    // Assert: Terminals should still be functional
    await terminalHelper.sendText(1, 'echo "Still working"');
    await new Promise((resolve) => setTimeout(resolve, 500));

    const output = await terminalHelper.getTerminalOutput(1);
    expect(output).toContain('Still working');
  });

  /**
   * Test Scenario: Split View with Independent Scrolling
   * Priority: P1 (Important)
   *
   * Validates that each split terminal has independent scrolling.
   */
  test('should maintain independent scrolling in split terminals @P1 @split-terminal', async ({
    page,
  }) => {
    // Arrange: Create split terminals with output
    const terminal1Id = await terminalHelper.createTerminal();
    await extensionHelper.executeCommand('secondaryTerminal.splitTerminalVertical');

    await terminalHelper.sendText(1, 'for i in {1..100}; do echo "T1 Line $i"; done');
    await terminalHelper.sendText(2, 'for i in {1..100}; do echo "T2 Line $i"; done');

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Act: Scroll terminal 1 to top
    const terminal1Container = await page.locator('[data-terminal-id="1"] .xterm-viewport').first();
    await terminal1Container.evaluate((el) => {
      el.scrollTop = 0;
    });

    // Keep terminal 2 at bottom (default position)

    await new Promise((resolve) => setTimeout(resolve, 300));

    // Get scroll positions
    const terminal1ScrollTop = await terminal1Container.evaluate((el) => el.scrollTop);
    const terminal2Container = await page.locator('[data-terminal-id="2"] .xterm-viewport').first();
    const terminal2ScrollTop = await terminal2Container.evaluate((el) => el.scrollTop);

    // Assert: Terminal 1 should be scrolled to top
    expect(terminal1ScrollTop).toBe(0);

    // Assert: Terminal 2 should be at bottom (different scroll position)
    expect(terminal2ScrollTop).toBeGreaterThan(0);

    // Act: Scroll terminal 2 to top
    await terminal2Container.evaluate((el) => {
      el.scrollTop = 0;
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    const terminal2ScrollTopAfter = await terminal2Container.evaluate((el) => el.scrollTop);

    // Assert: Terminal 2 scroll position changed independently
    expect(terminal2ScrollTopAfter).toBe(0);

    // Assert: Each terminal maintains its own scrollbar
    const terminal1Scrollbar = await page.locator('[data-terminal-id="1"] .xterm-scrollbar').count();
    const terminal2Scrollbar = await page.locator('[data-terminal-id="2"] .xterm-scrollbar').count();

    expect(terminal1Scrollbar).toBeGreaterThan(0);
    expect(terminal2Scrollbar).toBeGreaterThan(0);
  });
});
