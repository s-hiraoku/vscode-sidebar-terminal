import { test, expect } from '@playwright/test';
import {
  VSCodeExtensionTestHelper,
  TerminalLifecycleHelper,
  WebViewInteractionHelper,
} from '../../helpers';
import { TERMINAL_CONSTANTS } from '../../config/test-constants';

/**
 * Configuration Settings Tests
 * Based on TEST_PLAN.md Section 5: Configuration Management
 *
 * Test Scenarios:
 * - 5.1 Font Settings (P0)
 * - 5.3 Max Terminals Limit (P0)
 * - 5.4 Feature Toggles (P1)
 */
// TODO: Re-enable once VSCodeExtensionTestHelper is fully implemented
// Currently helper methods return placeholder values and cannot modify actual configuration
test.describe.skip('Configuration Settings', () => {
  let extensionHelper: VSCodeExtensionTestHelper;
  let terminalHelper: TerminalLifecycleHelper;
  let webviewHelper: WebViewInteractionHelper;

  test.beforeEach(async ({ page }) => {
    extensionHelper = new VSCodeExtensionTestHelper(page);
    terminalHelper = new TerminalLifecycleHelper(page);
    webviewHelper = new WebViewInteractionHelper(page);

    await extensionHelper.activateExtension();
    await webviewHelper.waitForWebViewLoad();
  });

  test.afterEach(async () => {
    // Restore default configuration
    await extensionHelper.updateConfiguration('secondaryTerminal.fontSize', 14);
    await extensionHelper.updateConfiguration('secondaryTerminal.maxTerminals', 5);

    await terminalHelper.deleteAllTerminals();
    await extensionHelper.dispose();
  });

  /**
   * Test Scenario 5.1: Font Size Configuration
   * Priority: P0 (Critical)
   *
   * Validates that font size can be changed and is
   * applied to terminal rendering.
   */
  test('should apply font size change @P0 @configuration', async () => {
    // Arrange: Get initial font size
    const initialSize = await extensionHelper.getConfiguration('secondaryTerminal.fontSize');

    // Act: Change font size
    await extensionHelper.updateConfiguration('secondaryTerminal.fontSize', 16);

    // Assert: Font size should be updated
    const newSize = await extensionHelper.getConfiguration('secondaryTerminal.fontSize');
    expect(newSize).toBe(16);
    expect(newSize).not.toBe(initialSize);

    // Future: Verify font size is applied in terminal
    // const terminalElement = await page.locator('.terminal');
    // const fontSize = await terminalElement.evaluate(el =>
    //   window.getComputedStyle(el).fontSize
    // );
    // expect(fontSize).toBe('16px');
  });

  /**
   * Test Scenario 5.1 (Extended): Font Family Configuration
   * Priority: P1 (Important)
   *
   * Validates that font family can be changed.
   */
  test('should apply font family change @P1 @configuration', async () => {
    // Act: Change font family
    const newFont = 'Courier New, monospace';
    await extensionHelper.updateConfiguration('secondaryTerminal.fontFamily', newFont);

    // Assert: Font family should be updated
    const fontFamily = await extensionHelper.getConfiguration('secondaryTerminal.fontFamily');
    expect(fontFamily).toBe(newFont);

    // Future: Verify font family is applied in terminal
  });

  /**
   * Test Scenario 5.3: Max Terminals Limit Configuration
   * Priority: P0 (Critical)
   *
   * Validates that the max terminals limit can be
   * configured and is enforced.
   */
  test('should enforce max terminals limit configuration @P0 @configuration', async () => {
    // Arrange: Set max terminals to 3 (instead of default 5)
    await extensionHelper.updateConfiguration('secondaryTerminal.maxTerminals', 3);

    // Act: Try to create 4 terminals
    await terminalHelper.createTerminal(); // 1
    await terminalHelper.createTerminal(); // 2
    await terminalHelper.createTerminal(); // 3

    // Assert: 3 terminals should exist
    expect(await terminalHelper.getTerminalCount()).toBe(3);

    // Act: Try to create 4th terminal
    // This should be prevented by the limit
    // Future: Implement actual limit enforcement check

    // Assert: Still only 3 terminals
    // Future: expect(await terminalHelper.getTerminalCount()).toBe(3);
  });

  /**
   * Test Scenario 5.3 (Extended): Restore Default Max Terminals
   * Priority: P1 (Important)
   *
   * Validates that max terminals can be restored to default.
   */
  test('should restore default max terminals limit @P1 @configuration', async () => {
    // Arrange: Change max terminals
    await extensionHelper.updateConfiguration('secondaryTerminal.maxTerminals', 3);

    // Act: Restore to default (5)
    await extensionHelper.updateConfiguration('secondaryTerminal.maxTerminals', 5);

    // Assert: Default limit should be restored
    const maxTerminals = await extensionHelper.getConfiguration('secondaryTerminal.maxTerminals');
    expect(maxTerminals).toBe(TERMINAL_CONSTANTS.MAX_TERMINALS);

    // Verify: Can now create 5 terminals
    for (let i = 0; i < 5; i++) {
      await terminalHelper.createTerminal();
    }

    expect(await terminalHelper.getTerminalCount()).toBe(5);
  });

  /**
   * Test Scenario 5.4: Persistent Sessions Toggle
   * Priority: P1 (Important)
   *
   * Validates that persistent sessions feature can be
   * enabled/disabled via configuration.
   */
  test('should toggle persistent sessions feature @P1 @configuration', async () => {
    // Act: Disable persistent sessions
    await extensionHelper.updateConfiguration('secondaryTerminal.enablePersistentSessions', false);

    // Assert: Feature should be disabled
    const persistentSessions = await extensionHelper.getConfiguration(
      'secondaryTerminal.enablePersistentSessions'
    );
    expect(persistentSessions).toBe(false);

    // Act: Re-enable persistent sessions
    await extensionHelper.updateConfiguration('secondaryTerminal.enablePersistentSessions', true);

    // Assert: Feature should be enabled
    const enabled = await extensionHelper.getConfiguration(
      'secondaryTerminal.enablePersistentSessions'
    );
    expect(enabled).toBe(true);
  });

  /**
   * Test Scenario 5.4 (Extended): AI Agent Detection Toggle
   * Priority: P1 (Important)
   *
   * Validates that AI agent detection can be toggled.
   */
  test('should toggle AI agent detection feature @P1 @configuration', async () => {
    // Act: Disable AI agent detection
    await extensionHelper.updateConfiguration('secondaryTerminal.enableAIAgentDetection', false);

    // Assert: Feature should be disabled
    const aiDetection = await extensionHelper.getConfiguration(
      'secondaryTerminal.enableAIAgentDetection'
    );
    expect(aiDetection).toBe(false);

    // Act: Re-enable
    await extensionHelper.updateConfiguration('secondaryTerminal.enableAIAgentDetection', true);

    // Assert: Feature should be enabled
    const enabled = await extensionHelper.getConfiguration(
      'secondaryTerminal.enableAIAgentDetection'
    );
    expect(enabled).toBe(true);
  });

  /**
   * Test Scenario: Scrollback Configuration
   * Priority: P1 (Important)
   *
   * Validates that scrollback line limit can be configured.
   */
  test('should configure scrollback line limit @P1 @configuration', async () => {
    // Act: Change scrollback limit
    await extensionHelper.updateConfiguration('secondaryTerminal.scrollback', 5000);

    // Assert: Scrollback limit should be updated
    const scrollback = await extensionHelper.getConfiguration('secondaryTerminal.scrollback');
    expect(scrollback).toBe(5000);

    // Restore default
    await extensionHelper.updateConfiguration('secondaryTerminal.scrollback', 2000);
  });

  /**
   * Test Scenario: Theme Configuration
   * Priority: P1 (Important)
   *
   * Validates that terminal theme can be configured.
   */
  test('should configure terminal theme @P1 @configuration', async () => {
    // Test auto theme
    await extensionHelper.updateConfiguration('secondaryTerminal.theme', 'auto');
    let theme = await extensionHelper.getConfiguration('secondaryTerminal.theme');
    expect(theme).toBe('auto');

    // Test dark theme
    await extensionHelper.updateConfiguration('secondaryTerminal.theme', 'dark');
    theme = await extensionHelper.getConfiguration('secondaryTerminal.theme');
    expect(theme).toBe('dark');

    // Test light theme
    await extensionHelper.updateConfiguration('secondaryTerminal.theme', 'light');
    theme = await extensionHelper.getConfiguration('secondaryTerminal.theme');
    expect(theme).toBe('light');
  });

  /**
   * Test Scenario: Invalid Configuration Handling
   * Priority: P0 (Critical)
   *
   * Validates that invalid configuration values are
   * handled gracefully.
   */
  test('should handle invalid configuration values gracefully @P0 @configuration', async () => {
    // Act: Try to set invalid font size (negative)
    try {
      await extensionHelper.updateConfiguration('secondaryTerminal.fontSize', -1);
    } catch (error) {
      // Expected - invalid value should be rejected
    }

    // Assert: Font size should remain valid
    const fontSize = await extensionHelper.getConfiguration('secondaryTerminal.fontSize');
    expect(fontSize).toBeGreaterThan(0);

    // Act: Try to set invalid max terminals (0)
    try {
      await extensionHelper.updateConfiguration('secondaryTerminal.maxTerminals', 0);
    } catch (error) {
      // Expected - invalid value should be rejected
    }

    // Assert: Max terminals should remain valid
    const maxTerminals = await extensionHelper.getConfiguration('secondaryTerminal.maxTerminals');
    expect(maxTerminals).toBeGreaterThan(0);
  });

  /**
   * Test Scenario: Configuration Persistence
   * Priority: P1 (Important)
   *
   * Validates that configuration changes persist
   * across extension reloads.
   */
  test('should persist configuration changes @P1 @configuration', async () => {
    // Act: Change configuration
    await extensionHelper.updateConfiguration('secondaryTerminal.fontSize', 18);

    // Simulate extension reload
    await extensionHelper.dispose();
    await extensionHelper.activateExtension();

    // Assert: Configuration should persist
    const fontSize = await extensionHelper.getConfiguration('secondaryTerminal.fontSize');
    expect(fontSize).toBe(18);

    // Cleanup
    await extensionHelper.updateConfiguration('secondaryTerminal.fontSize', 14);
  });

  /**
   * Test Scenario: Multiple Configuration Changes
   * Priority: P1 (Important)
   *
   * Validates that multiple configuration changes
   * can be made simultaneously.
   */
  test('should handle multiple configuration changes @P1 @configuration', async () => {
    // Act: Change multiple settings
    await extensionHelper.updateConfiguration('secondaryTerminal.fontSize', 16);
    await extensionHelper.updateConfiguration('secondaryTerminal.maxTerminals', 3);
    await extensionHelper.updateConfiguration('secondaryTerminal.scrollback', 3000);

    // Assert: All changes should be applied
    expect(await extensionHelper.getConfiguration('secondaryTerminal.fontSize')).toBe(16);
    expect(await extensionHelper.getConfiguration('secondaryTerminal.maxTerminals')).toBe(3);
    expect(await extensionHelper.getConfiguration('secondaryTerminal.scrollback')).toBe(3000);
  });
});
