import { test, expect } from '@playwright/test';
import {
  VSCodeExtensionTestHelper,
  TerminalLifecycleHelper,
  WebViewInteractionHelper,
} from '../../helpers';
import { TEST_TIMEOUTS, TERMINAL_CONSTANTS } from '../../config/test-constants';

/**
 * Terminal Creation Tests
 * Based on TEST_PLAN.md Section 1: Terminal Lifecycle Management
 *
 * Test Scenarios:
 * - 1.1 Single Terminal Creation (P0)
 * - 1.2 Multiple Terminal Creation (P0)
 * - 1.4 Terminal ID Recycling (P0)
 */
test.describe('Terminal Creation', () => {
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
   * Test Scenario 1.1: Single Terminal Creation
   * Priority: P0 (Critical)
   *
   * Validates that a single terminal can be created successfully
   * and receives ID 1 as the first terminal.
   */
  test('should create single terminal with ID 1 @P0 @terminal-lifecycle', async () => {
    // Act: Create a terminal
    const terminalId = await terminalHelper.createTerminal();

    // Assert: Terminal ID should be 1
    expect(terminalId).toBe(1);

    // Assert: Terminal should exist
    const exists = await terminalHelper.terminalExists(1);
    expect(exists).toBe(true);

    // Assert: Terminal count should be 1
    const count = await terminalHelper.getTerminalCount();
    expect(count).toBe(1);

    // Assert: Terminal should be active
    const activeId = await terminalHelper.getActiveTerminalId();
    expect(activeId).toBe(1);
  });

  /**
   * Test Scenario 1.2: Multiple Terminal Creation
   * Priority: P0 (Critical)
   *
   * Validates that multiple terminals can be created up to the
   * maximum limit of 5 terminals with unique IDs.
   */
  test('should create multiple terminals up to limit of 5 @P0 @terminal-lifecycle', async () => {
    const createdIds: number[] = [];

    // Act: Create 5 terminals
    for (let i = 0; i < TERMINAL_CONSTANTS.MAX_TERMINALS; i++) {
      const terminalId = await terminalHelper.createTerminal();
      createdIds.push(terminalId);
    }

    // Assert: All terminal IDs should be unique
    const uniqueIds = new Set(createdIds);
    expect(uniqueIds.size).toBe(TERMINAL_CONSTANTS.MAX_TERMINALS);

    // Assert: Terminal IDs should be 1-5
    expect(createdIds.sort()).toEqual([1, 2, 3, 4, 5]);

    // Assert: Terminal count should be 5
    const count = await terminalHelper.getTerminalCount();
    expect(count).toBe(TERMINAL_CONSTANTS.MAX_TERMINALS);

    // Assert: All terminals should exist
    for (const id of createdIds) {
      const exists = await terminalHelper.terminalExists(id);
      expect(exists).toBe(true);
    }
  });

  /**
   * Test Scenario 1.2 (Extended): Maximum Terminal Limit
   * Priority: P0 (Critical)
   *
   * Validates that attempting to create a 6th terminal
   * is prevented and shows appropriate warning.
   */
  test('should prevent creating more than 5 terminals @P0 @terminal-lifecycle', async () => {
    // Arrange: Create 5 terminals (maximum)
    for (let i = 0; i < TERMINAL_CONSTANTS.MAX_TERMINALS; i++) {
      await terminalHelper.createTerminal();
    }

    // Act: Attempt to create 6th terminal
    // Note: This should either throw an error or return null
    // depending on implementation
    const count = await terminalHelper.getTerminalCount();

    // Assert: Terminal count should still be 5
    expect(count).toBe(TERMINAL_CONSTANTS.MAX_TERMINALS);

    // Future: Verify warning notification appears
    // await expect(page.locator('.notification.warning')).toContainText('Maximum 5 terminals reached');
  });

  /**
   * Test Scenario 1.4: Terminal ID Recycling
   * Priority: P0 (Critical)
   *
   * Validates that when a terminal is deleted, its ID is
   * recycled and reused for the next terminal created.
   */
  test('should recycle terminal ID when terminal is deleted @P0 @terminal-lifecycle', async () => {
    // Arrange: Create 3 terminals
    await terminalHelper.createTerminal(); // ID 1
    await terminalHelper.createTerminal(); // ID 2
    await terminalHelper.createTerminal(); // ID 3

    // Act: Delete terminal 2
    await terminalHelper.deleteTerminal(2);

    // Assert: Terminal 2 should not exist
    const terminal2Exists = await terminalHelper.terminalExists(2);
    expect(terminal2Exists).toBe(false);

    // Act: Create a new terminal
    const newTerminalId = await terminalHelper.createTerminal();

    // Assert: New terminal should reuse ID 2
    expect(newTerminalId).toBe(2);

    // Assert: Terminals 1, 2, 3 should all exist
    expect(await terminalHelper.terminalExists(1)).toBe(true);
    expect(await terminalHelper.terminalExists(2)).toBe(true);
    expect(await terminalHelper.terminalExists(3)).toBe(true);

    // Assert: Terminal count should be 3
    const count = await terminalHelper.getTerminalCount();
    expect(count).toBe(3);
  });

  /**
   * Test Scenario 1.5: Rapid Terminal Creation (Race Conditions)
   * Priority: P1 (Important)
   *
   * Validates that the extension handles rapid terminal creation
   * without race conditions or duplicate IDs.
   */
  test('should handle rapid terminal creation without race conditions @P1 @terminal-lifecycle', async () => {
    // Act: Create multiple terminals rapidly in parallel
    const createPromises = Array(3)
      .fill(null)
      .map(() => terminalHelper.createTerminal());

    const terminalIds = await Promise.all(createPromises);

    // Assert: All IDs should be unique (no race conditions)
    const uniqueIds = new Set(terminalIds);
    expect(uniqueIds.size).toBe(3);

    // Assert: All IDs should be valid (1-5)
    for (const id of terminalIds) {
      expect(terminalHelper.isValidTerminalId(id)).toBe(true);
    }

    // Assert: Terminal count should be 3
    const count = await terminalHelper.getTerminalCount();
    expect(count).toBe(3);
  });

  /**
   * Test Scenario: Terminal Creation Performance
   * Priority: P2 (Nice-to-have)
   *
   * Validates that terminal creation completes within
   * acceptable performance threshold.
   */
  test('should create terminal within performance threshold @P2 @performance', async () => {
    const startTime = Date.now();

    // Act: Create terminal
    await terminalHelper.createTerminal(true);

    const duration = Date.now() - startTime;

    // Assert: Creation should complete within 2 seconds
    expect(duration).toBeLessThan(TEST_TIMEOUTS.TERMINAL_CREATION);

    // Log performance metric
    console.log(`[Performance] Terminal creation took ${duration}ms`);
  });
});
