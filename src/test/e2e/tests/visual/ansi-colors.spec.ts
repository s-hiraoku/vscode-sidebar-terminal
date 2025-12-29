import { test, expect } from '@playwright/test';
import { VRTHelper, ANSI } from '../../helpers';

/**
 * Visual Regression Tests - ANSI Colors
 * Based on TEST_PLAN.md Section 4.6: ANSI Color Rendering
 *
 * Test Scenarios:
 * - 4.6 ANSI Color Rendering (P0)
 * - Visual regression for color output
 * - Theme compatibility
 *
 * These tests use fixture-based content injection to validate
 * ANSI color rendering without requiring actual terminal I/O.
 */
test.describe('ANSI Color Rendering @visual-regression', () => {
  let vrtHelper: VRTHelper;

  test.beforeEach(async ({ page }) => {
    vrtHelper = new VRTHelper(page);

    // Navigate to the standalone WebView fixture
    await page.goto('/standalone-webview.html');

    // Prepare page for VRT (disable animations, wait for render)
    await vrtHelper.prepareForVRT();
  });

  /**
   * Test Scenario 4.6: Basic 8-Color Palette
   * Priority: P0 (Critical)
   *
   * Validates that basic ANSI colors (8 colors) are
   * rendered correctly in the terminal.
   */
  test('should render 8-color palette correctly @P0', async ({ page }) => {
    // Arrange: Generate 8-color palette content
    const colorPalette = VRTHelper.generate8ColorPalette();

    // Act: Inject color content into terminal
    await vrtHelper.injectTerminalContent(colorPalette);

    // Assert: Visual comparison with baseline
    const terminalOutput = page.locator('.terminal-output');
    await expect(terminalOutput).toHaveScreenshot('ansi-8-colors.png');
  });

  /**
   * Test Scenario 4.6: 16-Color Palette (includes bright colors)
   * Priority: P0 (Critical)
   *
   * Validates that the full 16-color ANSI palette renders correctly.
   */
  test('should render 16-color palette correctly @P0', async ({ page }) => {
    // Arrange: Generate 16-color palette content
    const colorPalette = VRTHelper.generate16ColorPalette();

    // Act: Inject color content into terminal
    await vrtHelper.injectTerminalContent(colorPalette);

    // Assert: Visual comparison with baseline
    const terminalOutput = page.locator('.terminal-output');
    await expect(terminalOutput).toHaveScreenshot('ansi-16-colors.png');
  });

  /**
   * Test Scenario 4.6 (Extended): Bold and Italic Styling
   * Priority: P0 (Critical)
   *
   * Validates that text styling (bold, italic, underline)
   * is rendered correctly.
   */
  test('should render text styling correctly @P0', async ({ page }) => {
    // Arrange: Text with styling
    const styledText = [
      `${ANSI.BOLD}Bold text${ANSI.RESET}`,
      `${ANSI.ITALIC}Italic text${ANSI.RESET}`,
      `${ANSI.UNDERLINE}Underlined text${ANSI.RESET}`,
      `${ANSI.BOLD}${ANSI.RED}Bold red text${ANSI.RESET}`,
      `${ANSI.ITALIC}${ANSI.GREEN}Italic green text${ANSI.RESET}`,
      `${ANSI.BOLD}${ANSI.UNDERLINE}${ANSI.BLUE}Bold underlined blue${ANSI.RESET}`,
    ].join('\n');

    // Act: Inject styled text
    await vrtHelper.injectTerminalContent(styledText);

    // Assert: Visual comparison
    const terminalOutput = page.locator('.terminal-output');
    await expect(terminalOutput).toHaveScreenshot('ansi-text-styling.png');
  });

  /**
   * Test Scenario 4.6 (Extended): Background Colors
   * Priority: P0 (Critical)
   *
   * Validates that ANSI background colors are rendered.
   */
  test('should render background colors correctly @P0', async ({ page }) => {
    // Arrange: Text with background colors
    const bgColors = [
      `${ANSI.BG_RED}${ANSI.WHITE} Red background ${ANSI.RESET}`,
      `${ANSI.BG_GREEN}${ANSI.BLACK} Green background ${ANSI.RESET}`,
      `${ANSI.BG_YELLOW}${ANSI.BLACK} Yellow background ${ANSI.RESET}`,
      `${ANSI.BG_BLUE}${ANSI.WHITE} Blue background ${ANSI.RESET}`,
      `${ANSI.BG_MAGENTA}${ANSI.WHITE} Magenta background ${ANSI.RESET}`,
      `${ANSI.BG_CYAN}${ANSI.BLACK} Cyan background ${ANSI.RESET}`,
    ].join('\n');

    // Act: Inject background colored text
    await vrtHelper.injectTerminalContent(bgColors);

    // Assert: Visual comparison
    const terminalOutput = page.locator('.terminal-output');
    await expect(terminalOutput).toHaveScreenshot('ansi-background-colors.png');
  });

  /**
   * Test Scenario: Success/Error/Warning Indicators
   * Priority: P0 (Critical)
   *
   * Validates that common indicators (✓✗⚠) render
   * correctly with colors.
   */
  test('should render status indicators correctly @P0', async ({ page }) => {
    // Arrange: Status indicators
    const indicators = [
      `${ANSI.BOLD}${ANSI.GREEN}✓${ANSI.RESET} Tests passed`,
      `${ANSI.BOLD}${ANSI.RED}✗${ANSI.RESET} Tests failed`,
      `${ANSI.BOLD}${ANSI.YELLOW}⚠${ANSI.RESET} Warning: deprecated API`,
      `${ANSI.BLUE}ℹ${ANSI.RESET} Information message`,
      `${ANSI.BRIGHT_CYAN}→${ANSI.RESET} Running command...`,
      `${ANSI.BRIGHT_GREEN}✓${ANSI.RESET} Build successful`,
    ].join('\n');

    // Act: Inject indicators
    await vrtHelper.injectTerminalContent(indicators);

    // Assert: Visual comparison
    const terminalOutput = page.locator('.terminal-output');
    await expect(terminalOutput).toHaveScreenshot('ansi-status-indicators.png');
  });

  /**
   * Test Scenario: Mixed Content Rendering
   * Priority: P0 (Critical)
   *
   * Validates that mixed content (colored and plain text)
   * renders correctly together.
   */
  test('should render mixed colored and plain text @P0', async ({ page }) => {
    // Arrange: Mixed content
    const mixedContent = [
      'Plain text before colored output',
      `${ANSI.GREEN}Success:${ANSI.RESET} Operation completed`,
      'Plain text between colored lines',
      `${ANSI.BOLD}${ANSI.RED}Error:${ANSI.RESET} Something went wrong`,
      'Plain text after colored output',
      `${ANSI.YELLOW}Warning:${ANSI.RESET} Check configuration`,
    ].join('\n');

    // Act: Inject mixed content
    await vrtHelper.injectTerminalContent(mixedContent);

    // Assert: Visual comparison
    const terminalOutput = page.locator('.terminal-output');
    await expect(terminalOutput).toHaveScreenshot('ansi-mixed-content.png');
  });

  /**
   * Test Scenario: Sample Terminal Output
   * Priority: P1 (Important)
   *
   * Validates a realistic terminal output scenario.
   */
  test('should render sample terminal output correctly @P1', async ({ page }) => {
    // Arrange: Sample terminal output
    const sampleContent = VRTHelper.generateSampleANSIContent();

    // Act: Inject sample content
    await vrtHelper.injectTerminalContent(sampleContent);

    // Assert: Visual comparison
    const terminalOutput = page.locator('.terminal-output');
    await expect(terminalOutput).toHaveScreenshot('ansi-sample-output.png');
  });
});

/**
 * Theme Variation Tests for ANSI Colors
 * Validates that colors adapt correctly to different themes.
 */
test.describe('ANSI Colors - Theme Variations @visual-regression', () => {
  let vrtHelper: VRTHelper;

  test.beforeEach(async ({ page }) => {
    vrtHelper = new VRTHelper(page);
    await page.goto('/standalone-webview.html');
    await vrtHelper.prepareForVRT();
  });

  test('should render colors correctly in dark theme @P1', async ({ page }) => {
    // Set dark theme
    await vrtHelper.setTheme('dark');

    // Inject sample content
    const content = VRTHelper.generate16ColorPalette();
    await vrtHelper.injectTerminalContent(content);

    // Assert
    const terminalOutput = page.locator('.terminal-output');
    await expect(terminalOutput).toHaveScreenshot('ansi-colors-dark-theme.png');
  });

  test('should render colors correctly in light theme @P1', async ({ page }) => {
    // Set light theme
    await vrtHelper.setTheme('light');

    // Inject sample content
    const content = VRTHelper.generate16ColorPalette();
    await vrtHelper.injectTerminalContent(content);

    // Assert
    const terminalOutput = page.locator('.terminal-output');
    await expect(terminalOutput).toHaveScreenshot('ansi-colors-light-theme.png');
  });

  test('should render colors correctly in high contrast theme @P2', async ({ page }) => {
    // Set high contrast theme
    await vrtHelper.setTheme('high-contrast');

    // Inject sample content
    const content = VRTHelper.generate16ColorPalette();
    await vrtHelper.injectTerminalContent(content);

    // Assert
    const terminalOutput = page.locator('.terminal-output');
    await expect(terminalOutput).toHaveScreenshot('ansi-colors-high-contrast.png');
  });
});
