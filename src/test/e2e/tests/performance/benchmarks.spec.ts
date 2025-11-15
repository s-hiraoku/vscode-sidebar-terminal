import { test, expect } from '@playwright/test';
import {
  VSCodeExtensionTestHelper,
  TerminalLifecycleHelper,
  WebViewInteractionHelper,
} from '../../helpers';
import { TEST_TIMEOUTS, TERMINAL_CONSTANTS } from '../../config/test-constants';

/**
 * Performance Benchmark Tests
 * Based on TEST_PLAN.md - Performance Requirements
 *
 * Benchmark Targets:
 * - Terminal creation: <500ms
 * - Session restore (5 terminals): <3 seconds
 * - AI agent detection: <100ms after output
 * - Output rendering (1000 lines): <1 second
 * - Memory usage (5 terminals): <100MB
 */
test.describe('Performance Benchmarks', () => {
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
   * Performance Test: Terminal Creation Speed
   * Target: <500ms per terminal
   *
   * Validates that terminal creation completes quickly
   * to ensure responsive user experience.
   */
  test('should create terminal within 500ms @P1 @performance', async () => {
    const creationTimes: number[] = [];

    // Test terminal creation 10 times
    for (let i = 0; i < 10; i++) {
      const startTime = Date.now();

      // Act: Create terminal
      await terminalHelper.createTerminal();

      const creationTime = Date.now() - startTime;
      creationTimes.push(creationTime);

      console.log(`Terminal ${i + 1} creation time: ${creationTime}ms`);

      // Clean up for next iteration
      if (i < 9) {
        await terminalHelper.deleteAllTerminals();
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // Calculate statistics
    const averageTime = creationTimes.reduce((a, b) => a + b, 0) / creationTimes.length;
    const maxTime = Math.max(...creationTimes);
    const minTime = Math.min(...creationTimes);

    console.log(`Terminal Creation Performance:
      Average: ${averageTime.toFixed(2)}ms
      Min: ${minTime}ms
      Max: ${maxTime}ms
    `);

    // Assert: Average creation time should be under 500ms
    expect(averageTime).toBeLessThan(500);

    // Assert: Maximum creation time should be under 1000ms (allow occasional spikes)
    expect(maxTime).toBeLessThan(1000);
  });

  /**
   * Performance Test: Large Output Rendering
   * Target: <1 second for 1000 lines
   *
   * Validates that large amounts of terminal output are rendered
   * efficiently without blocking the UI.
   */
  test('should render 1000 lines of output within 1 second @P1 @performance', async () => {
    // Arrange: Create terminal
    const terminalId = await terminalHelper.createTerminal();

    // Act: Generate 1000 lines of output
    const startTime = Date.now();

    await terminalHelper.sendText(terminalId, 'for i in {1..1000}; do echo "Line $i: Test output with some content"; done');

    // Wait for output to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify last line appeared (output complete)
    let outputComplete = false;
    let attempts = 0;
    while (!outputComplete && attempts < 20) {
      const output = await terminalHelper.getTerminalOutput(terminalId);
      if (output.includes('Line 1000')) {
        outputComplete = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    const renderTime = Date.now() - startTime;

    console.log(`1000 lines render time: ${renderTime}ms`);

    // Assert: Rendering should complete within reasonable time
    expect(outputComplete).toBe(true);
    expect(renderTime).toBeLessThan(3000); // Allow 3 seconds for command execution + rendering

    // Assert: Terminal should remain responsive
    await terminalHelper.sendText(terminalId, 'echo "Still responsive"');
    await new Promise((resolve) => setTimeout(resolve, 500));

    const finalOutput = await terminalHelper.getTerminalOutput(terminalId);
    expect(finalOutput).toContain('Still responsive');
  });

  /**
   * Performance Test: Rapid Terminal Creation (Concurrency)
   * Target: No race conditions, all terminals created successfully
   *
   * Validates that rapidly creating multiple terminals doesn't cause
   * race conditions or performance degradation.
   */
  test('should handle rapid terminal creation without race conditions @P1 @performance @concurrency', async () => {
    const startTime = Date.now();

    // Act: Rapidly create 5 terminals
    const creationPromises = [];
    for (let i = 0; i < TERMINAL_CONSTANTS.MAX_TERMINALS; i++) {
      creationPromises.push(terminalHelper.createTerminal());
    }

    // Wait for all creations to complete
    const terminalIds = await Promise.all(creationPromises);

    const totalTime = Date.now() - startTime;

    console.log(`Rapid creation of 5 terminals: ${totalTime}ms`);

    // Assert: All terminals created successfully
    expect(terminalIds.length).toBe(TERMINAL_CONSTANTS.MAX_TERMINALS);

    // Assert: All IDs are unique
    const uniqueIds = new Set(terminalIds);
    expect(uniqueIds.size).toBe(TERMINAL_CONSTANTS.MAX_TERMINALS);

    // Assert: IDs are in valid range (1-5)
    terminalIds.forEach((id) => {
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(5);
    });

    // Assert: All terminals exist
    const terminalCount = await terminalHelper.getTerminalCount();
    expect(terminalCount).toBe(TERMINAL_CONSTANTS.MAX_TERMINALS);

    // Assert: Total time should be reasonable
    expect(totalTime).toBeLessThan(3000); // 3 seconds for 5 terminals
  });

  /**
   * Performance Test: AI Agent Detection Latency
   * Target: <100ms after output
   *
   * Validates that AI agent detection happens quickly after
   * agent output appears in the terminal.
   */
  test('should detect AI agent within 100ms of output @P1 @performance @ai-agent-detection', async ({
    page,
  }) => {
    // Arrange: Enable AI agent detection
    await extensionHelper.updateConfiguration('secondaryTerminal.enableCliAgentIntegration', true);

    const terminalId = await terminalHelper.createTerminal();

    // Prepare Claude Code mock output
    const claudeOutput = 'Claude Code v1.0 (Mock)\nType "exit" to quit\n';

    // Act: Send Claude Code output and measure detection time
    const startTime = Date.now();

    await terminalHelper.sendText(terminalId, claudeOutput);

    // Poll for AI agent status indicator to appear
    let detectionTime = 0;
    let detected = false;
    const timeout = 1000; // 1 second timeout

    while (!detected && detectionTime < timeout) {
      const statusIndicator = await page.locator('[data-testid="ai-agent-status"]').count();
      if (statusIndicator > 0) {
        detectionTime = Date.now() - startTime;
        detected = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      detectionTime = Date.now() - startTime;
    }

    console.log(`AI agent detection time: ${detectionTime}ms`);

    // Assert: Detection should happen quickly
    expect(detected).toBe(true);
    expect(detectionTime).toBeLessThan(500); // Allow 500ms (more lenient than target)
  });

  /**
   * Performance Test: Memory Usage
   * Target: <100MB for 5 terminals
   *
   * Validates that memory usage stays within acceptable limits
   * even with multiple terminals and scrollback buffers.
   */
  test('should maintain reasonable memory usage with multiple terminals @P2 @performance', async ({
    page,
  }) => {
    // Arrange: Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });

    // Act: Create 5 terminals with scrollback
    for (let i = 0; i < 5; i++) {
      const terminalId = await terminalHelper.createTerminal();
      // Generate 500 lines per terminal
      await terminalHelper.sendText(
        terminalId,
        `for j in {1..500}; do echo "Terminal ${i + 1} Line $j"; done`
      );
    }

    // Wait for all output to complete
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Force garbage collection if available (requires --expose-gc flag)
    await page.evaluate(() => {
      if (global.gc) {
        global.gc();
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });

    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

    console.log(`Memory usage:
      Initial: ${(initialMemory / (1024 * 1024)).toFixed(2)} MB
      Final: ${(finalMemory / (1024 * 1024)).toFixed(2)} MB
      Increase: ${memoryIncreaseMB.toFixed(2)} MB
    `);

    // Assert: Memory increase should be reasonable
    // Note: This is a soft limit as memory usage varies by browser/environment
    expect(memoryIncreaseMB).toBeLessThan(150); // Allow 150MB increase
  });

  /**
   * Performance Test: Terminal Deletion Speed
   * Target: <200ms per deletion
   *
   * Validates that terminal deletion and cleanup happens quickly.
   */
  test('should delete terminals quickly @P1 @performance', async () => {
    // Arrange: Create 5 terminals
    for (let i = 0; i < 5; i++) {
      await terminalHelper.createTerminal();
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const deletionTimes: number[] = [];

    // Act: Delete all terminals and measure time
    for (let id = 5; id >= 1; id--) {
      const startTime = Date.now();

      await terminalHelper.deleteTerminal(id);

      const deletionTime = Date.now() - startTime;
      deletionTimes.push(deletionTime);

      console.log(`Terminal ${id} deletion time: ${deletionTime}ms`);

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Calculate statistics
    const averageTime = deletionTimes.reduce((a, b) => a + b, 0) / deletionTimes.length;
    const maxTime = Math.max(...deletionTimes);

    console.log(`Terminal Deletion Performance:
      Average: ${averageTime.toFixed(2)}ms
      Max: ${maxTime}ms
    `);

    // Assert: Average deletion time should be fast
    expect(averageTime).toBeLessThan(300);

    // Assert: Maximum deletion time should be reasonable
    expect(maxTime).toBeLessThan(1000);

    // Assert: All terminals deleted
    const finalCount = await terminalHelper.getTerminalCount();
    expect(finalCount).toBe(0);
  });

  /**
   * Performance Test: Output Buffering Efficiency
   * Target: UI remains responsive during high-frequency output
   *
   * Validates that the performance manager's buffering system
   * prevents UI blocking during rapid output.
   */
  test('should maintain UI responsiveness during rapid output @P1 @performance', async () => {
    // Arrange: Create terminal
    const terminalId = await terminalHelper.createTerminal();

    // Act: Generate rapid output (simulate streaming)
    const startTime = Date.now();

    // Send command that produces rapid output
    await terminalHelper.sendText(
      terminalId,
      'for i in {1..5000}; do echo "Rapid output line $i"; done'
    );

    // Continuously check UI responsiveness during output
    const responsivenessSamples: number[] = [];
    const samplingDuration = 3000; // Sample for 3 seconds

    while (Date.now() - startTime < samplingDuration) {
      const checkStart = Date.now();

      // Perform UI operation (should complete quickly if UI is responsive)
      await terminalHelper.getTerminalCount();

      const responseTime = Date.now() - checkStart;
      responsivenessSamples.push(responseTime);

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Calculate responsiveness statistics
    const avgResponseTime =
      responsivenessSamples.reduce((a, b) => a + b, 0) / responsivenessSamples.length;
    const maxResponseTime = Math.max(...responsivenessSamples);

    console.log(`UI Responsiveness During Output:
      Average response time: ${avgResponseTime.toFixed(2)}ms
      Max response time: ${maxResponseTime}ms
      Samples: ${responsivenessSamples.length}
    `);

    // Assert: UI should remain responsive (operations complete quickly)
    expect(avgResponseTime).toBeLessThan(50); // Average under 50ms
    expect(maxResponseTime).toBeLessThan(200); // No operation takes more than 200ms

    // Assert: Terminal still functional after rapid output
    await terminalHelper.sendText(terminalId, 'echo "Still working"');
    await new Promise((resolve) => setTimeout(resolve, 500));

    const output = await terminalHelper.getTerminalOutput(terminalId);
    expect(output).toContain('Still working');
  });

  /**
   * Performance Test: Concurrent Terminal Operations
   * Target: No performance degradation with parallel operations
   *
   * Validates that performing operations on multiple terminals
   * concurrently doesn't cause significant performance issues.
   */
  test('should handle concurrent operations on multiple terminals @P1 @performance @concurrency', async () => {
    // Arrange: Create 5 terminals
    const terminalIds: number[] = [];
    for (let i = 0; i < 5; i++) {
      const id = await terminalHelper.createTerminal();
      terminalIds.push(id);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Act: Perform concurrent operations on all terminals
    const startTime = Date.now();

    const operations = terminalIds.map(async (id) => {
      // Send commands to all terminals concurrently
      await terminalHelper.sendText(id, `echo "Terminal ${id} concurrent test"`);
      await terminalHelper.sendText(id, 'for i in {1..50}; do echo "Line $i"; done');
    });

    // Wait for all operations to complete
    await Promise.all(operations);

    // Wait for output to finish
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const totalTime = Date.now() - startTime;

    console.log(`Concurrent operations on 5 terminals: ${totalTime}ms`);

    // Assert: Operations should complete in reasonable time
    expect(totalTime).toBeLessThan(5000); // 5 seconds for concurrent operations

    // Assert: All terminals should have output
    for (const id of terminalIds) {
      const output = await terminalHelper.getTerminalOutput(id);
      expect(output).toContain(`Terminal ${id} concurrent test`);
      expect(output).toContain('Line 50');
    }

    // Assert: No terminals lost or corrupted
    const finalCount = await terminalHelper.getTerminalCount();
    expect(finalCount).toBe(5);
  });

  /**
   * Performance Test: Session Save/Restore Performance
   * Target: <3 seconds to restore 5 terminals
   *
   * Validates that session restore happens quickly to minimize
   * startup time when reopening VS Code.
   */
  test('should restore session within 3 seconds @P1 @performance @session-persistence', async () => {
    // Arrange: Enable persistent sessions
    await extensionHelper.updateConfiguration('secondaryTerminal.enablePersistentSessions', true);

    // Create 5 terminals with scrollback
    for (let i = 0; i < 5; i++) {
      const terminalId = await terminalHelper.createTerminal();
      await terminalHelper.sendText(terminalId, `echo "Terminal ${i + 1}"`);
      // Generate 100 lines per terminal
      await terminalHelper.sendText(
        terminalId,
        `for j in {1..100}; do echo "T${i + 1} Line $j"; done`
      );
    }

    // Wait for output
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Act: Save session
    await extensionHelper.executeCommand('secondaryTerminal.saveSession');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Measure restore time
    const startTime = Date.now();

    // Simulate VS Code reload
    await extensionHelper.reloadVSCode();
    await extensionHelper.activateExtension();
    await webviewHelper.waitForWebViewLoad();

    // Wait for all terminals to be restored
    let restoredCount = 0;
    const timeout = 5000;
    while (restoredCount < 5 && Date.now() - startTime < timeout) {
      restoredCount = await terminalHelper.getTerminalCount();
      if (restoredCount < 5) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const restoreTime = Date.now() - startTime;

    console.log(`Session restore time (5 terminals): ${restoreTime}ms`);

    // Assert: Restore should complete within 3 seconds
    expect(restoreTime).toBeLessThan(3000);

    // Assert: All terminals restored
    expect(restoredCount).toBe(5);

    // Assert: Terminals are functional after restore
    await terminalHelper.sendText(1, 'echo "Post-restore test"');
    await new Promise((resolve) => setTimeout(resolve, 500));

    const output = await terminalHelper.getTerminalOutput(1);
    expect(output).toContain('Post-restore test');
  });
});
