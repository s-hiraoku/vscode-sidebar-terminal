import { test, expect } from '@playwright/test';
import { VSCodeExtensionTestHelper, TerminalLifecycleHelper } from '../../helpers';

/**
 * Terminal Deletion Tests
 * Based on TEST_PLAN.md Section 1: Terminal Lifecycle Management
 *
 * Test Scenarios:
 * - 1.3 Terminal Deletion (P0)
 * - 1.6 Last Terminal Protection (P1)
 */
test.describe('Terminal Deletion', () => {
  let extensionHelper: VSCodeExtensionTestHelper;
  let terminalHelper: TerminalLifecycleHelper;

  test.beforeEach(async ({ page }) => {
    extensionHelper = new VSCodeExtensionTestHelper(page);
    terminalHelper = new TerminalLifecycleHelper(page);

    await extensionHelper.activateExtension();
  });

  test.afterEach(async () => {
    await terminalHelper.deleteAllTerminals();
    await extensionHelper.dispose();
  });

  /**
   * Test Scenario 1.3: Terminal Deletion
   * Priority: P0 (Critical)
   *
   * Validates that terminals can be deleted and that
   * the active terminal switches appropriately.
   */
  test('should delete terminal and switch focus @P0 @terminal-lifecycle', async () => {
    // Arrange: Create 3 terminals
    await terminalHelper.createTerminal(); // ID 1
    await terminalHelper.createTerminal(); // ID 2
    await terminalHelper.createTerminal(); // ID 3

    // Verify initial state
    expect(await terminalHelper.getTerminalCount()).toBe(3);

    // Act: Delete terminal 2
    await terminalHelper.deleteTerminal(2);

    // Assert: Terminal 2 should be gone
    expect(await terminalHelper.terminalExists(2)).toBe(false);
    expect(await terminalHelper.getTerminalCount()).toBe(2);

    // Assert: Terminals 1 and 3 should still exist
    expect(await terminalHelper.terminalExists(1)).toBe(true);
    expect(await terminalHelper.terminalExists(3)).toBe(true);

    // Assert: Active terminal should be 1 or 3 (not 2)
    const activeId = await terminalHelper.getActiveTerminalId();
    expect(activeId).not.toBe(2);
    expect([1, 3]).toContain(activeId);
  });

  /**
   * Test Scenario 1.3 (Extended): Delete Active Terminal
   * Priority: P0 (Critical)
   *
   * Validates that deleting the active terminal
   * automatically switches focus to another terminal.
   */
  test('should switch focus when deleting active terminal @P0 @terminal-lifecycle', async () => {
    // Arrange: Create 3 terminals
    await terminalHelper.createTerminal(); // ID 1
    await terminalHelper.createTerminal(); // ID 2
    await terminalHelper.createTerminal(); // ID 3

    // Switch to terminal 2
    await terminalHelper.switchToTerminal(2);

    // Verify terminal 2 is active
    const activeBeforeDelete = await terminalHelper.getActiveTerminalId();
    expect(activeBeforeDelete).toBe(2);

    // Act: Delete active terminal (2)
    await terminalHelper.deleteTerminal(2);

    // Assert: Active terminal should change to 1 or 3
    const activeAfterDelete = await terminalHelper.getActiveTerminalId();
    expect(activeAfterDelete).not.toBe(2);
    expect([1, 3]).toContain(activeAfterDelete);
  });

  /**
   * Test Scenario: Delete All Terminals Sequentially
   * Priority: P0 (Critical)
   *
   * Validates that terminals can be deleted one by one
   * until none remain.
   */
  test('should delete all terminals sequentially @P0 @terminal-lifecycle', async () => {
    // Arrange: Create 3 terminals
    await terminalHelper.createTerminal();
    await terminalHelper.createTerminal();
    await terminalHelper.createTerminal();

    // Act & Assert: Delete terminals one by one
    await terminalHelper.deleteTerminal(1);
    expect(await terminalHelper.getTerminalCount()).toBe(2);

    await terminalHelper.deleteTerminal(2);
    expect(await terminalHelper.getTerminalCount()).toBe(1);

    await terminalHelper.deleteTerminal(3);
    expect(await terminalHelper.getTerminalCount()).toBe(0);
  });

  /**
   * Test Scenario 1.6: Last Terminal Protection
   * Priority: P1 (Important)
   *
   * Validates that the last terminal may require
   * confirmation before deletion (if configured).
   */
  test('should handle last terminal deletion @P1 @terminal-lifecycle', async () => {
    // Arrange: Create single terminal
    await terminalHelper.createTerminal();

    expect(await terminalHelper.getTerminalCount()).toBe(1);

    // Act: Delete the last terminal
    await terminalHelper.deleteTerminal(1);

    // Assert: Terminal should be deleted
    expect(await terminalHelper.getTerminalCount()).toBe(0);

    // Future: If confirmation is required, test the confirmation dialog
    // const confirmDialog = await page.locator('.confirmation-dialog');
    // await expect(confirmDialog).toBeVisible();
  });

  /**
   * Test Scenario: Prevent Duplicate Deletion
   * Priority: P0 (Critical)
   *
   * Validates that attempting to delete the same terminal
   * multiple times doesn't cause errors.
   */
  test('should prevent duplicate deletion attempts @P0 @terminal-lifecycle', async () => {
    // Arrange: Create terminal
    await terminalHelper.createTerminal();

    // Act: Delete terminal multiple times
    await terminalHelper.deleteTerminal(1);

    // Attempt to delete again (should be safe/no-op)
    try {
      await terminalHelper.deleteTerminal(1);
    } catch (error) {
      // Expected - terminal already deleted
    }

    // Assert: Terminal count should be 0
    expect(await terminalHelper.getTerminalCount()).toBe(0);
    expect(await terminalHelper.terminalExists(1)).toBe(false);
  });

  /**
   * Test Scenario: Delete Non-Existent Terminal
   * Priority: P1 (Important)
   *
   * Validates graceful handling when attempting to
   * delete a terminal that doesn't exist.
   */
  test('should handle deleting non-existent terminal gracefully @P1 @terminal-lifecycle', async () => {
    // Arrange: No terminals exist

    // Act: Try to delete non-existent terminal
    try {
      await terminalHelper.deleteTerminal(5);
    } catch (error) {
      // Expected - terminal doesn't exist
    }

    // Assert: Terminal count should still be 0
    expect(await terminalHelper.getTerminalCount()).toBe(0);
  });

  /**
   * Test Scenario: Rapid Deletion (Race Conditions)
   * Priority: P0 (Critical)
   *
   * Validates that rapid deletion attempts don't
   * cause race conditions or duplicate deletions.
   */
  test('should handle rapid deletion without race conditions @P0 @terminal-lifecycle', async () => {
    // Arrange: Create 3 terminals
    await terminalHelper.createTerminal();
    await terminalHelper.createTerminal();
    await terminalHelper.createTerminal();

    // Act: Delete all terminals rapidly in parallel
    const deletePromises = [
      terminalHelper.deleteTerminal(1),
      terminalHelper.deleteTerminal(2),
      terminalHelper.deleteTerminal(3),
    ];

    await Promise.all(deletePromises);

    // Assert: All terminals should be deleted
    expect(await terminalHelper.getTerminalCount()).toBe(0);
    expect(await terminalHelper.terminalExists(1)).toBe(false);
    expect(await terminalHelper.terminalExists(2)).toBe(false);
    expect(await terminalHelper.terminalExists(3)).toBe(false);
  });
});
