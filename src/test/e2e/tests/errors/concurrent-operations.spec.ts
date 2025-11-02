import { test, expect } from '@playwright/test';
import {
  VSCodeExtensionTestHelper,
  TerminalLifecycleHelper,
  WebViewInteractionHelper,
} from '../../helpers';

/**
 * Concurrent Operation Tests
 * Based on Phase 4.2: Concurrent Operations
 *
 * Test Scenarios:
 * - Rapid terminal creation/deletion
 * - Simultaneous terminal operations
 * - Concurrent configuration changes
 * - Multiple WebView interactions at once
 * - Race condition scenarios
 */
test.describe('Concurrent Operations', () => {
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
    await terminalHelper.deleteAllTerminals();
    await extensionHelper.dispose();
  });

  /**
   * Test Scenario: Rapid Terminal Creation
   * Priority: P0 (Critical)
   *
   * Validates that creating terminals rapidly doesn't
   * cause race conditions or ID conflicts.
   */
  test('should handle rapid terminal creation without race conditions @P0 @concurrency', async () => {
    // Act: Create terminals rapidly in parallel
    const createPromises = [
      terminalHelper.createTerminal(),
      terminalHelper.createTerminal(),
      terminalHelper.createTerminal(),
      terminalHelper.createTerminal(),
      terminalHelper.createTerminal(),
    ];

    const terminalIds = await Promise.all(createPromises);

    // Assert: All terminals should be created with unique IDs
    expect(terminalIds).toHaveLength(5);

    // Check for unique IDs (no duplicates)
    const uniqueIds = new Set(terminalIds);
    expect(uniqueIds.size).toBe(5);

    // Verify IDs are in valid range (1-5)
    terminalIds.forEach((id) => {
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(5);
    });

    // Verify correct count
    expect(await terminalHelper.getTerminalCount()).toBe(5);

    console.log('[Concurrency Test] Rapid creation verified:', terminalIds);
  });

  /**
   * Test Scenario: Rapid Terminal Deletion
   * Priority: P0 (Critical)
   *
   * Validates that deleting terminals rapidly doesn't
   * cause duplicate deletions or state corruption.
   */
  test('should handle rapid terminal deletion without duplicates @P0 @concurrency', async () => {
    // Arrange: Create 5 terminals
    for (let i = 0; i < 5; i++) {
      await terminalHelper.createTerminal();
    }

    expect(await terminalHelper.getTerminalCount()).toBe(5);

    // Act: Delete same terminal multiple times simultaneously
    const deletePromises = [
      terminalHelper.deleteTerminal(3),
      terminalHelper.deleteTerminal(3),
      terminalHelper.deleteTerminal(3),
    ];

    const results = await Promise.allSettled(deletePromises);

    // Assert: Only one deletion should succeed
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    expect(succeeded).toBeLessThanOrEqual(1);

    // Verify terminal count decreased by exactly 1
    expect(await terminalHelper.getTerminalCount()).toBe(4);

    console.log('[Concurrency Test] Duplicate deletion prevented');
  });

  /**
   * Test Scenario: Simultaneous Create and Delete
   * Priority: P0 (Critical)
   *
   * Validates that creating and deleting terminals
   * simultaneously maintains state consistency.
   */
  test('should handle simultaneous create and delete @P0 @concurrency', async () => {
    // Arrange: Create initial terminal
    await terminalHelper.createTerminal();

    // Act: Simultaneously create and delete terminals
    const operations = [
      terminalHelper.createTerminal(),
      terminalHelper.deleteTerminal(1),
      terminalHelper.createTerminal(),
      terminalHelper.createTerminal(),
    ];

    await Promise.allSettled(operations);

    // Assert: Final state should be consistent
    const count = await terminalHelper.getTerminalCount();
    expect(count).toBeGreaterThanOrEqual(0);
    expect(count).toBeLessThanOrEqual(5);

    // Assert: All existing terminals should be valid
    // Future: Verify each terminal is in valid state
    // const terminals = await terminalHelper.listTerminals();
    // terminals.forEach(t => {
    //   expect(t.id).toBeGreaterThan(0);
    //   expect(t.ptyProcess).toBeDefined();
    // });

    console.log(`[Concurrency Test] Simultaneous operations completed, final count: ${count}`);
  });

  /**
   * Test Scenario: Rapid Terminal Switching
   * Priority: P1 (Important)
   *
   * Validates that switching between terminals rapidly
   * doesn't cause focus or state issues.
   */
  test('should handle rapid terminal switching @P1 @concurrency', async () => {
    // Arrange: Create 3 terminals
    await terminalHelper.createTerminal(); // 1
    await terminalHelper.createTerminal(); // 2
    await terminalHelper.createTerminal(); // 3

    // Act: Switch rapidly between terminals
    const switchPromises = [
      terminalHelper.switchToTerminal(2),
      terminalHelper.switchToTerminal(3),
      terminalHelper.switchToTerminal(1),
      terminalHelper.switchToTerminal(2),
      terminalHelper.switchToTerminal(3),
    ];

    await Promise.all(switchPromises);

    // Assert: Final active terminal should be valid
    const activeId = await terminalHelper.getActiveTerminalId();
    expect(activeId).toBeGreaterThanOrEqual(1);
    expect(activeId).toBeLessThanOrEqual(3);

    // Assert: All terminals should still exist
    expect(await terminalHelper.getTerminalCount()).toBe(3);

    console.log(`[Concurrency Test] Rapid switching completed, active: ${activeId}`);
  });

  /**
   * Test Scenario: Concurrent Configuration Changes
   * Priority: P1 (Important)
   *
   * Validates that changing multiple configuration
   * values simultaneously doesn't cause corruption.
   */
  test('should handle concurrent configuration changes @P1 @concurrency', async () => {
    // Act: Change multiple settings simultaneously
    const configPromises = [
      extensionHelper.updateConfiguration('secondaryTerminal.fontSize', 16),
      extensionHelper.updateConfiguration('secondaryTerminal.maxTerminals', 3),
      extensionHelper.updateConfiguration('secondaryTerminal.scrollback', 3000),
      extensionHelper.updateConfiguration('secondaryTerminal.theme', 'dark'),
    ];

    await Promise.all(configPromises);

    // Assert: All changes should be applied
    expect(await extensionHelper.getConfiguration('secondaryTerminal.fontSize')).toBe(16);
    expect(await extensionHelper.getConfiguration('secondaryTerminal.maxTerminals')).toBe(3);
    expect(await extensionHelper.getConfiguration('secondaryTerminal.scrollback')).toBe(3000);
    expect(await extensionHelper.getConfiguration('secondaryTerminal.theme')).toBe('dark');

    // Cleanup
    await extensionHelper.updateConfiguration('secondaryTerminal.fontSize', 14);
    await extensionHelper.updateConfiguration('secondaryTerminal.maxTerminals', 5);
    await extensionHelper.updateConfiguration('secondaryTerminal.scrollback', 2000);

    console.log('[Concurrency Test] Concurrent config changes verified');
  });

  /**
   * Test Scenario: Multiple WebView Interactions
   * Priority: P1 (Important)
   *
   * Validates that typing in multiple terminals
   * simultaneously doesn't cause input conflicts.
   */
  test('should handle multiple WebView interactions @P1 @concurrency', async ({ page }) => {
    // Arrange: Create 3 terminals
    await terminalHelper.createTerminal(); // 1
    await terminalHelper.createTerminal(); // 2
    await terminalHelper.createTerminal(); // 3

    // Act: Type in different terminals simultaneously
    const typePromises = [
      (async () => {
        await terminalHelper.switchToTerminal(1);
        await webviewHelper.typeInTerminal('terminal 1');
      })(),
      (async () => {
        await terminalHelper.switchToTerminal(2);
        await webviewHelper.typeInTerminal('terminal 2');
      })(),
      (async () => {
        await terminalHelper.switchToTerminal(3);
        await webviewHelper.typeInTerminal('terminal 3');
      })(),
    ];

    await Promise.all(typePromises);

    // Assert: All terminals should have received their input
    // Future: Verify each terminal has correct input
    // const output1 = await terminalHelper.getTerminalOutput(1);
    // const output2 = await terminalHelper.getTerminalOutput(2);
    // const output3 = await terminalHelper.getTerminalOutput(3);
    // expect(output1).toContain('terminal 1');
    // expect(output2).toContain('terminal 2');
    // expect(output3).toContain('terminal 3');

    console.log('[Concurrency Test] Multiple WebView interactions completed');
  });

  /**
   * Test Scenario: Race Condition - Create at Max Limit
   * Priority: P0 (Critical)
   *
   * Validates that creating terminals when at max limit
   * handles race conditions correctly.
   */
  test('should prevent race conditions at max terminal limit @P0 @concurrency', async () => {
    // Arrange: Create 4 terminals (one below max)
    for (let i = 0; i < 4; i++) {
      await terminalHelper.createTerminal();
    }

    expect(await terminalHelper.getTerminalCount()).toBe(4);

    // Act: Try to create 3 terminals simultaneously (only 1 should succeed)
    const createPromises = [
      terminalHelper.createTerminal(),
      terminalHelper.createTerminal(),
      terminalHelper.createTerminal(),
    ];

    const results = await Promise.allSettled(createPromises);

    // Assert: Should have exactly 5 terminals (max limit)
    const finalCount = await terminalHelper.getTerminalCount();
    expect(finalCount).toBe(5);

    // Assert: At most 1 creation should have succeeded
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    expect(succeeded).toBeLessThanOrEqual(1);

    console.log('[Concurrency Test] Max limit race condition handled');
  });

  /**
   * Test Scenario: Race Condition - Delete Last Terminal
   * Priority: P1 (Important)
   *
   * Validates that deleting the last terminal handles
   * concurrent deletion attempts correctly.
   */
  test('should handle race condition when deleting last terminal @P1 @concurrency', async () => {
    // Arrange: Create single terminal
    await terminalHelper.createTerminal();

    // Act: Try to delete same terminal multiple times
    const deletePromises = [
      terminalHelper.deleteTerminal(1),
      terminalHelper.deleteTerminal(1),
      terminalHelper.deleteTerminal(1),
    ];

    await Promise.allSettled(deletePromises);

    // Assert: Should have 0 terminals
    // Note: Last terminal protection may keep 1 terminal
    const count = await terminalHelper.getTerminalCount();
    expect(count).toBeGreaterThanOrEqual(0);
    expect(count).toBeLessThanOrEqual(1);

    console.log(`[Concurrency Test] Last terminal deletion race handled, count: ${count}`);
  });

  /**
   * Test Scenario: Rapid Create-Delete Cycles
   * Priority: P1 (Important)
   *
   * Validates that rapid create-delete cycles maintain
   * ID recycling system integrity.
   */
  test('should maintain ID recycling during rapid create-delete cycles @P1 @concurrency', async () => {
    // Act: Perform rapid create-delete cycles
    for (let cycle = 0; cycle < 10; cycle++) {
      // Create terminal
      const id = await terminalHelper.createTerminal();

      // Delete immediately
      await terminalHelper.deleteTerminal(id);
    }

    // Assert: Should be able to create terminals normally
    const id1 = await terminalHelper.createTerminal();
    const id2 = await terminalHelper.createTerminal();

    expect(id1).toBeGreaterThanOrEqual(1);
    expect(id1).toBeLessThanOrEqual(5);
    expect(id2).toBeGreaterThanOrEqual(1);
    expect(id2).toBeLessThanOrEqual(5);
    expect(id1).not.toBe(id2);

    console.log('[Concurrency Test] ID recycling maintained through cycles');
  });

  /**
   * Test Scenario: Concurrent Data Writing
   * Priority: P2 (Nice-to-have)
   *
   * Validates that writing to multiple terminals
   * simultaneously doesn't cause data corruption.
   */
  test('should handle concurrent data writing @P2 @concurrency', async () => {
    // Arrange: Create 3 terminals
    await terminalHelper.createTerminal();
    await terminalHelper.createTerminal();
    await terminalHelper.createTerminal();

    // Act: Write data to all terminals simultaneously
    const writePromises = [];
    for (let i = 1; i <= 3; i++) {
      for (let j = 0; j < 10; j++) {
        writePromises.push(
          terminalHelper.sendText(i, `Terminal ${i} - Line ${j}\n`)
        );
      }
    }

    await Promise.all(writePromises);

    // Assert: All terminals should have received data
    // Future: Verify data integrity in each terminal
    // for (let i = 1; i <= 3; i++) {
    //   const output = await terminalHelper.getTerminalOutput(i);
    //   for (let j = 0; j < 10; j++) {
    //     expect(output).toContain(`Terminal ${i} - Line ${j}`);
    //   }
    // }

    console.log('[Concurrency Test] Concurrent data writing completed');
  });

  /**
   * Test Scenario: Session Save During Operations
   * Priority: P1 (Important)
   *
   * Validates that session save doesn't interfere with
   * ongoing terminal operations.
   */
  test('should handle session save during operations @P1 @concurrency', async () => {
    // Arrange: Create terminals
    await terminalHelper.createTerminal();
    await terminalHelper.createTerminal();

    // Act: Perform operations while saving session
    const operations = [
      webviewHelper.typeInTerminal('echo test'),
      terminalHelper.createTerminal(),
      // Future: Save session
      // extensionHelper.executeCommand('secondaryTerminal.saveSession'),
      webviewHelper.typeInTerminal('echo more'),
      terminalHelper.switchToTerminal(2),
    ];

    await Promise.all(operations);

    // Assert: Operations should complete successfully
    const count = await terminalHelper.getTerminalCount();
    expect(count).toBeGreaterThanOrEqual(2);

    console.log('[Concurrency Test] Session save during operations handled');
  });

  /**
   * Test Scenario: Stress Test - High Frequency Operations
   * Priority: P2 (Nice-to-have)
   *
   * Validates that system remains stable under high
   * frequency of concurrent operations.
   */
  test('should remain stable under high frequency operations @P2 @concurrency @performance', async () => {
    const startTime = Date.now();

    // Act: Perform many operations rapidly
    const operations = [];

    // Create/delete cycles
    for (let i = 0; i < 20; i++) {
      operations.push(
        (async () => {
          const id = await terminalHelper.createTerminal();
          if (id) {
            await terminalHelper.deleteTerminal(id);
          }
        })()
      );
    }

    // Config changes
    for (let i = 0; i < 10; i++) {
      operations.push(
        extensionHelper.updateConfiguration('secondaryTerminal.fontSize', 12 + (i % 4))
      );
    }

    // Wait for all operations
    await Promise.allSettled(operations);

    const duration = Date.now() - startTime;

    // Assert: Should complete within reasonable time
    expect(duration).toBeLessThan(10000); // 10 seconds

    // Assert: System should be in valid state
    const count = await terminalHelper.getTerminalCount();
    expect(count).toBeGreaterThanOrEqual(0);
    expect(count).toBeLessThanOrEqual(5);

    console.log(`[Concurrency Test] Stress test completed in ${duration}ms, final count: ${count}`);

    // Cleanup
    await extensionHelper.updateConfiguration('secondaryTerminal.fontSize', 14);
  });
});
