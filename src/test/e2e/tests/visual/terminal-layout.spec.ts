import { test, expect } from '@playwright/test';
import { VRTHelper } from '../../helpers';

/**
 * Visual Regression Tests - Terminal Layout
 *
 * Test Scenarios:
 * - Terminal container borders (active/inactive states)
 * - Split terminal layouts (vertical/horizontal)
 * - Terminal tabs and header elements
 *
 * These tests validate the visual layout and structure of
 * the terminal WebView without requiring actual terminal I/O.
 */
test.describe('Terminal Layout @visual-regression', () => {
  let vrtHelper: VRTHelper;

  test.beforeEach(async ({ page }) => {
    vrtHelper = new VRTHelper(page);

    // Navigate to the standalone WebView fixture
    await page.goto('/standalone-webview.html');

    // Prepare page for VRT (disable animations, wait for render)
    await vrtHelper.prepareForVRT();
  });

  /**
   * Test Scenario: Single Terminal - Active State
   * Priority: P0 (Critical)
   *
   * Validates that a single active terminal renders correctly
   * with proper borders and styling.
   */
  test('should render single active terminal correctly @P0', async ({ page }) => {
    // Arrange: Set terminal as active with focus border
    await vrtHelper.setTerminalBorderState(true, 1);

    // Inject some sample content
    await vrtHelper.injectTerminalContent('user@host:~$ ls -la\ntotal 32\ndrwxr-xr-x  5 user user 4096 Dec 26 10:00 .');

    // Assert: Visual comparison of the terminal container
    const terminalBody = page.locator('#terminal-body');
    await expect(terminalBody).toHaveScreenshot('terminal-single-active.png');
  });

  /**
   * Test Scenario: Single Terminal - Inactive State
   * Priority: P0 (Critical)
   *
   * Validates that an inactive terminal renders correctly
   * with subdued borders.
   */
  test('should render single inactive terminal correctly @P0', async ({ page }) => {
    // Arrange: Set terminal as inactive
    await vrtHelper.setTerminalBorderState(false, 1);

    // Inject some sample content
    await vrtHelper.injectTerminalContent('user@host:~$ echo "Hello World"\nHello World');

    // Assert: Visual comparison
    const terminalBody = page.locator('#terminal-body');
    await expect(terminalBody).toHaveScreenshot('terminal-single-inactive.png');
  });

  /**
   * Test Scenario: Terminal Header with Controls
   * Priority: P1 (Important)
   *
   * Validates that the terminal header with tabs and action buttons
   * renders correctly.
   */
  test('should render terminal header correctly @P1', async ({ page }) => {
    // Assert: Visual comparison of the header
    const header = page.locator('#header');
    await expect(header).toHaveScreenshot('terminal-header.png');
  });

  /**
   * Test Scenario: Terminal Tabs - Single Tab
   * Priority: P1 (Important)
   *
   * Validates that terminal tabs render correctly with single terminal.
   */
  test('should render terminal tabs correctly @P1', async ({ page }) => {
    // Assert: Visual comparison of the tab list
    const tabList = page.locator('.terminal-tabs');
    await expect(tabList).toHaveScreenshot('terminal-tabs-single.png');
  });

  /**
   * Test Scenario: Full Page Layout
   * Priority: P0 (Critical)
   *
   * Validates the complete WebView layout including header and terminal.
   */
  test('should render full page layout correctly @P0', async ({ page }) => {
    // Inject sample content
    await vrtHelper.injectTerminalContent('user@host:~$ npm run build\n> Building...\n> Build successful!');

    // Assert: Visual comparison of full page
    await expect(page).toHaveScreenshot('terminal-full-layout.png', {
      fullPage: true,
    });
  });
});

/**
 * Split Terminal Layout Tests
 *
 * Validates split terminal configurations.
 */
test.describe('Split Terminal Layout @visual-regression', () => {
  let vrtHelper: VRTHelper;

  test.beforeEach(async ({ page }) => {
    vrtHelper = new VRTHelper(page);
    await page.goto('/standalone-webview.html');
    await vrtHelper.prepareForVRT();
  });

  /**
   * Test Scenario: Vertical Split Layout
   * Priority: P0 (Critical)
   *
   * Validates that two terminals split vertically render correctly.
   */
  test('should render vertical split layout correctly @P0', async ({ page }) => {
    // Arrange: Set up vertical split with 2 terminals
    await vrtHelper.setSplitLayout('vertical', 2);

    // Set first terminal active, second inactive
    await vrtHelper.setTerminalBorderState(true, 1);
    await vrtHelper.setTerminalBorderState(false, 2);

    // Assert: Visual comparison
    const terminalBody = page.locator('#terminal-body');
    await expect(terminalBody).toHaveScreenshot('terminal-split-vertical.png');
  });

  /**
   * Test Scenario: Horizontal Split Layout
   * Priority: P0 (Critical)
   *
   * Validates that two terminals split horizontally render correctly.
   */
  test('should render horizontal split layout correctly @P0', async ({ page }) => {
    // Arrange: Set up horizontal split with 2 terminals
    await vrtHelper.setSplitLayout('horizontal', 2);

    // Set first terminal active
    await vrtHelper.setTerminalBorderState(true, 1);
    await vrtHelper.setTerminalBorderState(false, 2);

    // Assert: Visual comparison
    const terminalBody = page.locator('#terminal-body');
    await expect(terminalBody).toHaveScreenshot('terminal-split-horizontal.png');
  });

  /**
   * Test Scenario: Three-way Vertical Split
   * Priority: P1 (Important)
   *
   * Validates that three terminals split vertically render correctly.
   */
  test('should render three-way vertical split correctly @P1', async ({ page }) => {
    // Arrange: Set up vertical split with 3 terminals
    await vrtHelper.setSplitLayout('vertical', 3);

    // Set middle terminal active
    await vrtHelper.setTerminalBorderState(false, 1);
    await vrtHelper.setTerminalBorderState(true, 2);
    await vrtHelper.setTerminalBorderState(false, 3);

    // Assert: Visual comparison
    const terminalBody = page.locator('#terminal-body');
    await expect(terminalBody).toHaveScreenshot('terminal-split-three-vertical.png');
  });

  /**
   * Test Scenario: Split Resizer Visibility
   * Priority: P1 (Important)
   *
   * Validates that split resizers are visible and correctly positioned.
   */
  test('should render split resizer correctly @P1', async ({ page }) => {
    // Arrange: Set up split layout
    await vrtHelper.setSplitLayout('vertical', 2);

    // Assert: Check resizer is visible
    const resizer = page.locator('.split-resizer');
    await expect(resizer).toBeVisible();

    // Visual comparison of full terminal body including resizer
    const terminalBody = page.locator('#terminal-body');
    await expect(terminalBody).toHaveScreenshot('terminal-split-resizer.png');
  });
});

/**
 * Terminal Action Buttons Tests
 *
 * Validates action button states in the header.
 */
test.describe('Terminal Action Buttons @visual-regression', () => {
  let vrtHelper: VRTHelper;

  test.beforeEach(async ({ page }) => {
    vrtHelper = new VRTHelper(page);
    await page.goto('/standalone-webview.html');
    await vrtHelper.prepareForVRT();
  });

  /**
   * Test Scenario: Action Buttons Default State
   * Priority: P1 (Important)
   *
   * Validates that action buttons render correctly in default state.
   */
  test('should render action buttons in default state @P1', async ({ page }) => {
    // Assert: Visual comparison of action buttons
    const headerRight = page.locator('.header-right');
    await expect(headerRight).toHaveScreenshot('terminal-action-buttons.png');
  });

  /**
   * Test Scenario: New Terminal Button Hover
   * Priority: P2 (Nice-to-have)
   *
   * Validates new terminal button hover state.
   */
  test('should render new terminal button hover state @P2', async ({ page }) => {
    // Hover over new terminal button
    const newTerminalBtn = page.locator('#btn-new-terminal');
    await newTerminalBtn.hover();

    // Assert: Visual comparison
    await expect(newTerminalBtn).toHaveScreenshot('terminal-btn-new-hover.png');
  });

  /**
   * Test Scenario: Split Terminal Button Hover
   * Priority: P2 (Nice-to-have)
   *
   * Validates split terminal button hover state.
   */
  test('should render split terminal button hover state @P2', async ({ page }) => {
    // Hover over split button
    const splitBtn = page.locator('#btn-split-terminal');
    await splitBtn.hover();

    // Assert: Visual comparison
    await expect(splitBtn).toHaveScreenshot('terminal-btn-split-hover.png');
  });
});

/**
 * Agent Status Indicator Tests
 *
 * Validates CLI agent status indicator rendering.
 */
test.describe('Agent Status Indicator @visual-regression', () => {
  let vrtHelper: VRTHelper;

  test.beforeEach(async ({ page }) => {
    vrtHelper = new VRTHelper(page);
    await page.goto('/standalone-webview.html');
    await vrtHelper.prepareForVRT();
  });

  /**
   * Test Scenario: Claude Code Agent Status
   * Priority: P1 (Important)
   *
   * Validates Claude Code agent status indicator rendering.
   */
  test('should render Claude Code agent status correctly @P1', async ({ page }) => {
    // Activate Claude Code agent status
    await page.evaluate(() => {
      (window as any).detectAgent('Claude Code');
    });

    // Wait for status update
    await page.waitForTimeout(100);

    // Assert: Visual comparison
    const agentStatus = page.locator('#agent-status');
    await expect(agentStatus).toHaveScreenshot('agent-status-claude.png');
  });

  /**
   * Test Scenario: GitHub Copilot Agent Status
   * Priority: P1 (Important)
   *
   * Validates GitHub Copilot agent status indicator rendering.
   */
  test('should render GitHub Copilot agent status correctly @P1', async ({ page }) => {
    // Activate GitHub Copilot agent status
    await page.evaluate(() => {
      (window as any).detectAgent('GitHub Copilot');
    });

    await page.waitForTimeout(100);

    // Assert: Visual comparison
    const agentStatus = page.locator('#agent-status');
    await expect(agentStatus).toHaveScreenshot('agent-status-copilot.png');
  });

  /**
   * Test Scenario: Gemini CLI Agent Status
   * Priority: P1 (Important)
   *
   * Validates Gemini CLI agent status indicator rendering.
   */
  test('should render Gemini CLI agent status correctly @P1', async ({ page }) => {
    // Activate Gemini agent status
    await page.evaluate(() => {
      (window as any).detectAgent('Gemini CLI');
    });

    await page.waitForTimeout(100);

    // Assert: Visual comparison
    const agentStatus = page.locator('#agent-status');
    await expect(agentStatus).toHaveScreenshot('agent-status-gemini.png');
  });

  /**
   * Test Scenario: No Agent Status (Hidden)
   * Priority: P2 (Nice-to-have)
   *
   * Validates that agent status is hidden when no agent is detected.
   */
  test('should hide agent status when no agent detected @P2', async ({ page }) => {
    // Ensure no agent is active
    await page.evaluate(() => {
      (window as any).detectAgent(null);
    });

    // Assert: Agent status should not be visible
    const agentStatus = page.locator('#agent-status');
    await expect(agentStatus).not.toHaveClass(/active/);
  });
});
