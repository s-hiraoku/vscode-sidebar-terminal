import { test, expect } from '@playwright/test';
import { VRTHelper, ANSI } from '../../helpers';

/**
 * Visual Regression Tests - Theme Variations
 *
 * Test Scenarios:
 * - Dark theme rendering
 * - Light theme rendering
 * - High contrast theme rendering
 * - Theme switching effects
 *
 * These tests validate that the terminal WebView renders correctly
 * across different VS Code themes.
 */
test.describe('Theme Variations @visual-regression', () => {
  let vrtHelper: VRTHelper;

  test.beforeEach(async ({ page }) => {
    vrtHelper = new VRTHelper(page);
    await page.goto('/standalone-webview.html');
    await vrtHelper.prepareForVRT();
  });

  /**
   * Test Scenario: Dark Theme - Full Layout
   * Priority: P1 (Important)
   *
   * Validates the complete WebView layout in dark theme.
   */
  test('should render full layout correctly in dark theme @P1', async ({ page }) => {
    // Set dark theme
    await vrtHelper.setTheme('dark');

    // Inject sample content
    await vrtHelper.injectTerminalContent([
      'user@host:~$ npm run build',
      `${ANSI.GREEN}✓${ANSI.RESET} Build completed successfully`,
      'user@host:~$ _',
    ].join('\n'));

    // Assert: Full page screenshot
    await expect(page).toHaveScreenshot('theme-dark-full-layout.png', {
      fullPage: true,
    });
  });

  /**
   * Test Scenario: Light Theme - Full Layout
   * Priority: P1 (Important)
   *
   * Validates the complete WebView layout in light theme.
   */
  test('should render full layout correctly in light theme @P1', async ({ page }) => {
    // Set light theme
    await vrtHelper.setTheme('light');

    // Inject sample content
    await vrtHelper.injectTerminalContent([
      'user@host:~$ npm run build',
      `${ANSI.GREEN}✓${ANSI.RESET} Build completed successfully`,
      'user@host:~$ _',
    ].join('\n'));

    // Assert: Full page screenshot
    await expect(page).toHaveScreenshot('theme-light-full-layout.png', {
      fullPage: true,
    });
  });

  /**
   * Test Scenario: High Contrast Theme - Full Layout
   * Priority: P2 (Nice-to-have)
   *
   * Validates the complete WebView layout in high contrast theme.
   */
  test('should render full layout correctly in high contrast theme @P2', async ({ page }) => {
    // Set high contrast theme
    await vrtHelper.setTheme('high-contrast');

    // Inject sample content
    await vrtHelper.injectTerminalContent([
      'user@host:~$ npm run build',
      `${ANSI.GREEN}✓${ANSI.RESET} Build completed successfully`,
      'user@host:~$ _',
    ].join('\n'));

    // Assert: Full page screenshot
    await expect(page).toHaveScreenshot('theme-high-contrast-full-layout.png', {
      fullPage: true,
    });
  });

  /**
   * Test Scenario: Dark Theme - Header
   * Priority: P1 (Important)
   *
   * Validates header rendering in dark theme.
   */
  test('should render header correctly in dark theme @P1', async ({ page }) => {
    await vrtHelper.setTheme('dark');

    const header = page.locator('#header');
    await expect(header).toHaveScreenshot('theme-dark-header.png');
  });

  /**
   * Test Scenario: Light Theme - Header
   * Priority: P1 (Important)
   *
   * Validates header rendering in light theme.
   */
  test('should render header correctly in light theme @P1', async ({ page }) => {
    await vrtHelper.setTheme('light');

    const header = page.locator('#header');
    await expect(header).toHaveScreenshot('theme-light-header.png');
  });

  /**
   * Test Scenario: Dark Theme - Terminal Container
   * Priority: P1 (Important)
   *
   * Validates terminal container rendering in dark theme.
   */
  test('should render terminal container correctly in dark theme @P1', async ({ page }) => {
    await vrtHelper.setTheme('dark');
    await vrtHelper.setTerminalBorderState(true, 1);
    await vrtHelper.injectTerminalContent('user@host:~$ echo "Dark theme test"\nDark theme test');

    const terminalBody = page.locator('#terminal-body');
    await expect(terminalBody).toHaveScreenshot('theme-dark-terminal-container.png');
  });

  /**
   * Test Scenario: Light Theme - Terminal Container
   * Priority: P1 (Important)
   *
   * Validates terminal container rendering in light theme.
   */
  test('should render terminal container correctly in light theme @P1', async ({ page }) => {
    await vrtHelper.setTheme('light');
    await vrtHelper.setTerminalBorderState(true, 1);
    await vrtHelper.injectTerminalContent('user@host:~$ echo "Light theme test"\nLight theme test');

    const terminalBody = page.locator('#terminal-body');
    await expect(terminalBody).toHaveScreenshot('theme-light-terminal-container.png');
  });
});

/**
 * Theme Comparison Tests
 *
 * Tests to ensure visual consistency across themes.
 */
test.describe('Theme Consistency @visual-regression', () => {
  let vrtHelper: VRTHelper;

  test.beforeEach(async ({ page }) => {
    vrtHelper = new VRTHelper(page);
    await page.goto('/standalone-webview.html');
    await vrtHelper.prepareForVRT();
  });

  /**
   * Test Scenario: Status Indicators Visibility Across Themes
   * Priority: P1 (Important)
   *
   * Validates that status indicators remain visible and readable
   * across all themes.
   */
  test('should render status indicators visibly in dark theme @P1', async ({ page }) => {
    await vrtHelper.setTheme('dark');

    const content = [
      `${ANSI.BOLD}${ANSI.GREEN}✓${ANSI.RESET} Success`,
      `${ANSI.BOLD}${ANSI.RED}✗${ANSI.RESET} Error`,
      `${ANSI.BOLD}${ANSI.YELLOW}⚠${ANSI.RESET} Warning`,
    ].join('\n');

    await vrtHelper.injectTerminalContent(content);

    const terminalOutput = page.locator('.terminal-output');
    await expect(terminalOutput).toHaveScreenshot('theme-dark-status-indicators.png');
  });

  test('should render status indicators visibly in light theme @P1', async ({ page }) => {
    await vrtHelper.setTheme('light');

    const content = [
      `${ANSI.BOLD}${ANSI.GREEN}✓${ANSI.RESET} Success`,
      `${ANSI.BOLD}${ANSI.RED}✗${ANSI.RESET} Error`,
      `${ANSI.BOLD}${ANSI.YELLOW}⚠${ANSI.RESET} Warning`,
    ].join('\n');

    await vrtHelper.injectTerminalContent(content);

    const terminalOutput = page.locator('.terminal-output');
    await expect(terminalOutput).toHaveScreenshot('theme-light-status-indicators.png');
  });

  test('should render status indicators visibly in high contrast theme @P2', async ({ page }) => {
    await vrtHelper.setTheme('high-contrast');

    const content = [
      `${ANSI.BOLD}${ANSI.GREEN}✓${ANSI.RESET} Success`,
      `${ANSI.BOLD}${ANSI.RED}✗${ANSI.RESET} Error`,
      `${ANSI.BOLD}${ANSI.YELLOW}⚠${ANSI.RESET} Warning`,
    ].join('\n');

    await vrtHelper.injectTerminalContent(content);

    const terminalOutput = page.locator('.terminal-output');
    await expect(terminalOutput).toHaveScreenshot('theme-high-contrast-status-indicators.png');
  });

  /**
   * Test Scenario: Split Layout Across Themes
   * Priority: P2 (Nice-to-have)
   *
   * Validates that split layouts render correctly across themes.
   */
  test('should render split layout correctly in dark theme @P2', async ({ page }) => {
    await vrtHelper.setTheme('dark');
    await vrtHelper.setSplitLayout('vertical', 2);
    await vrtHelper.setTerminalBorderState(true, 1);
    await vrtHelper.setTerminalBorderState(false, 2);

    const terminalBody = page.locator('#terminal-body');
    await expect(terminalBody).toHaveScreenshot('theme-dark-split-layout.png');
  });

  test('should render split layout correctly in light theme @P2', async ({ page }) => {
    await vrtHelper.setTheme('light');
    await vrtHelper.setSplitLayout('vertical', 2);
    await vrtHelper.setTerminalBorderState(true, 1);
    await vrtHelper.setTerminalBorderState(false, 2);

    const terminalBody = page.locator('#terminal-body');
    await expect(terminalBody).toHaveScreenshot('theme-light-split-layout.png');
  });
});

/**
 * Focus and Border Theme Tests
 *
 * Validates focus borders and active states across themes.
 */
test.describe('Focus and Border States @visual-regression', () => {
  let vrtHelper: VRTHelper;

  test.beforeEach(async ({ page }) => {
    vrtHelper = new VRTHelper(page);
    await page.goto('/standalone-webview.html');
    await vrtHelper.prepareForVRT();
  });

  /**
   * Test Scenario: Focus Border in Dark Theme
   * Priority: P1 (Important)
   */
  test('should render focus border correctly in dark theme @P1', async ({ page }) => {
    await vrtHelper.setTheme('dark');
    await vrtHelper.setTerminalBorderState(true, 1);

    const container = page.locator('.terminal-container[data-terminal-id="1"]');
    await expect(container).toHaveScreenshot('theme-dark-focus-border.png');
  });

  /**
   * Test Scenario: Focus Border in Light Theme
   * Priority: P1 (Important)
   */
  test('should render focus border correctly in light theme @P1', async ({ page }) => {
    await vrtHelper.setTheme('light');
    await vrtHelper.setTerminalBorderState(true, 1);

    const container = page.locator('.terminal-container[data-terminal-id="1"]');
    await expect(container).toHaveScreenshot('theme-light-focus-border.png');
  });

  /**
   * Test Scenario: Focus Border in High Contrast Theme
   * Priority: P2 (Nice-to-have)
   */
  test('should render focus border correctly in high contrast theme @P2', async ({ page }) => {
    await vrtHelper.setTheme('high-contrast');
    await vrtHelper.setTerminalBorderState(true, 1);

    const container = page.locator('.terminal-container[data-terminal-id="1"]');
    await expect(container).toHaveScreenshot('theme-high-contrast-focus-border.png');
  });
});
