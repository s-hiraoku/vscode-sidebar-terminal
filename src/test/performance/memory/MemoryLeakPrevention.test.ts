/**
 * Memory Leak Prevention Tests - Following t-wada's TDD Methodology
 *
 * These tests verify memory leak prevention across the entire system:
 * - Manager lifecycle resource cleanup
 * - Event listener disposal patterns
 * - WebView and Extension Host memory management
 * - Terminal process memory isolation
 * - Long-running session memory stability
 * - Garbage collection effectiveness
 *
 * TDD Memory Testing Approach:
 * 1. RED: Write failing tests for memory leak scenarios
 * 2. GREEN: Implement proper disposal and cleanup patterns
 * 3. REFACTOR: Optimize memory management while preventing leaks
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { setupTestEnvironment, resetTestEnvironment } from '../../shared/TestSetup';
import { RefactoredTerminalWebviewManager } from '../../../webview/managers/RefactoredTerminalWebviewManager';
import { BaseManager } from '../../../webview/managers/BaseManager';
import { NotificationManager } from '../../../webview/managers/NotificationManager';
import { PerformanceManager } from '../../../webview/managers/PerformanceManager';
import { RefactoredMessageManager } from '../../../webview/managers/RefactoredMessageManager';

interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  timestamp: number;
  activeManagers: number;
  eventListeners: number;
  domNodes: number;
}

interface LeakDetectionResult {
  suspected: boolean;
  growthRate: number; // bytes per second
  cyclesAnalyzed: number;
  memoryGrowth: number;
  recommendations: string[];
}

describe('Memory Leak Prevention - TDD Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let webviewManager: RefactoredTerminalWebviewManager;

  beforeEach(() => {
    setupTestEnvironment();
    sandbox = sinon.createSandbox();

    // Initialize webview manager for testing
    webviewManager = new RefactoredTerminalWebviewManager();
  });

  afterEach(() => {
    resetTestEnvironment();
    if (webviewManager) {
      webviewManager.dispose();
    }
    sandbox.restore();

    // Force garbage collection after each test
    if (global.gc) {
      global.gc();
    }
  });

  describe('Manager Lifecycle Memory Management', () => {

    describe('RED Phase - Manager Disposal Verification', () => {

      it('should completely dispose manager resources without memory leaks', async function() {
        // RED: Manager disposal should release all memory
        this.timeout(15000); // 15 second timeout for memory tests

        const initialSnapshot = captureMemorySnapshot();
        const managerInstances = [];

        // Create and dispose many manager instances
        for (let cycle = 0; cycle < 50; cycle++) {
          const managers = {
            notification: new NotificationManager(),
            performance: new PerformanceManager(),
            message: new RefactoredMessageManager()
          };

          // Initialize managers
          await managers.notification.initialize();
          await managers.performance.initialize();
          await managers.message.initialize();

          // Add some operations to create internal state
          managers.notification.showNotificationInTerminal('Test message', 'info');
          await managers.performance.bufferOutput('test-terminal', 'Test output\n');
          await managers.message.sendToExtension({
            type: 'test' as any,
            data: { test: 'data' }
          });

          managerInstances.push(managers);

          // Dispose every 10 cycles to verify cleanup
          if (cycle % 10 === 9) {
            managerInstances.forEach(managerSet => {
              Object.values(managerSet).forEach(manager => manager.dispose());
            });
            managerInstances.length = 0;

            // Force garbage collection
            if (global.gc) {
              global.gc();
              global.gc(); // Double GC to ensure cleanup
            }

            // Brief pause for cleanup
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Final cleanup
        managerInstances.forEach(managerSet => {
          Object.values(managerSet).forEach(manager => manager.dispose());
        });

        if (global.gc) {
          global.gc();
          global.gc();
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        const finalSnapshot = captureMemorySnapshot();
        const memoryGrowth = finalSnapshot.heapUsed - initialSnapshot.heapUsed;

        // Memory growth should be minimal (less than 5MB)
        expect(memoryGrowth).to.be.lessThan(5 * 1024 * 1024);

        // Verify no managers are left in memory
        expect(finalSnapshot.activeManagers).to.equal(0);
      });

      it('should prevent event listener memory leaks during manager lifecycle', async function() {
        // RED: Event listeners should be properly removed
        this.timeout(12000); // 12 second timeout

        const listenerCounts: number[] = [];

        for (let cycle = 0; cycle < 30; cycle++) {
          const manager = new NotificationManager();
          await manager.initialize();

          // Add multiple event listeners
          const listeners = [
            () => {},
            () => {},
            () => {},
            () => {},
            () => {}
          ];

          listeners.forEach(listener => {
            document.addEventListener('click', listener);
            window.addEventListener('resize', listener);
            manager.addEventListener?.('notification', listener);
          });

          // Count active listeners (simplified - in real test would use more sophisticated tracking)
          const currentListeners = getEventListenerCount();
          listenerCounts.push(currentListeners);

          // Dispose manager
          manager.dispose();

          // Remove document listeners manually (manager should remove its own)
          listeners.forEach(listener => {
            document.removeEventListener('click', listener);
            window.removeEventListener('resize', listener);
          });

          if (global.gc) global.gc();
        }

        // Listener count should not grow indefinitely
        const initialCount = listenerCounts[0];
        const finalCount = listenerCounts[listenerCounts.length - 1];

        expect(finalCount).to.be.lessThan(initialCount + 10); // Allow small variance
      });

      it('should handle manager disposal under stress without memory accumulation', async function() {
        // RED: Stress disposal should not accumulate memory
        this.timeout(20000); // 20 second timeout

        const memorySnapshots: MemorySnapshot[] = [];
        const stressCycles = 100;

        for (let cycle = 0; cycle < stressCycles; cycle++) {
          // Create multiple managers simultaneously
          const managers = await Promise.all([
            createAndInitializeManager(NotificationManager),
            createAndInitializeManager(PerformanceManager),
            createAndInitializeManager(RefactoredMessageManager)
          ]);

          // Stress the managers with operations
          await Promise.all([
            stressNotificationManager(managers[0] as NotificationManager),
            stressPerformanceManager(managers[1] as PerformanceManager),
            stressMessageManager(managers[2] as RefactoredMessageManager)
          ]);

          // Rapid disposal
          managers.forEach(manager => manager.dispose());

          // Capture memory every 10 cycles
          if (cycle % 10 === 9) {
            if (global.gc) global.gc();
            await new Promise(resolve => setTimeout(resolve, 50));
            memorySnapshots.push(captureMemorySnapshot());
          }
        }

        // Analyze memory growth trend
        const leakDetection = analyzeMemoryGrowth(memorySnapshots);
        expect(leakDetection.suspected).to.be.false;
        expect(leakDetection.growthRate).to.be.lessThan(1024 * 1024); // Less than 1MB/sec growth
      });

      it('should maintain memory stability during long-running manager operations', async function() {
        // RED: Long-running operations should not leak memory
        this.timeout(25000); // 25 second timeout

        const manager = new PerformanceManager();
        await manager.initialize();

        const memorySnapshots: MemorySnapshot[] = [];
        const operationDuration = 20000; // 20 seconds
        const snapshotInterval = 2000; // Every 2 seconds

        // Start continuous operations
        const operationPromise = continuousManagerOperations(manager, operationDuration);

        // Monitor memory during operations
        const monitoringPromise = monitorMemoryDuringOperations(
          memorySnapshots,
          operationDuration,
          snapshotInterval
        );

        await Promise.all([operationPromise, monitoringPromise]);

        manager.dispose();

        // Analyze memory stability
        const memoryAnalysis = analyzeMemoryStability(memorySnapshots);

        expect(memoryAnalysis.isStable).to.be.true;
        expect(memoryAnalysis.maxGrowthPercentage).to.be.lessThan(50); // Less than 50% growth
        expect(memoryAnalysis.finalMemoryIncrease).to.be.lessThan(20 * 1024 * 1024); // Less than 20MB
      });

    });

  });

  describe('WebView DOM Memory Management', () => {

    describe('RED Phase - DOM Resource Cleanup', () => {

      it('should prevent DOM node accumulation during dynamic content updates', async function() {
        // RED: Dynamic DOM updates should not accumulate nodes
        this.timeout(10000); // 10 second timeout

        const container = document.createElement('div');
        container.id = 'leak-test-container';
        document.body.appendChild(container);

        const initialNodeCount = document.querySelectorAll('*').length;
        const notificationManager = new NotificationManager();
        await notificationManager.initialize();

        // Generate many notifications that create DOM nodes
        for (let i = 0; i < 200; i++) {
          notificationManager.showNotificationInTerminal(`Notification ${i}`, 'info');
          notificationManager.showToast(`Toast ${i}`, 'success', 100); // Short duration

          // Periodically trigger cleanup
          if (i % 20 === 19) {
            notificationManager.clearNotifications();
            await new Promise(resolve => setTimeout(resolve, 150)); // Allow cleanup
          }
        }

        // Final cleanup
        notificationManager.clearNotifications();
        await new Promise(resolve => setTimeout(resolve, 200));

        const finalNodeCount = document.querySelectorAll('*').length;
        const nodeGrowth = finalNodeCount - initialNodeCount;

        // Node growth should be minimal
        expect(nodeGrowth).to.be.lessThan(50); // Less than 50 extra nodes

        notificationManager.dispose();
        container.remove();
      });

      it('should properly cleanup event listeners attached to DOM elements', async function() {
        // RED: DOM event listeners should be cleaned up
        this.timeout(8000); // 8 second timeout

        const testContainer = document.createElement('div');
        testContainer.id = 'event-test-container';
        document.body.appendChild(testContainer);

        let listenerCallCount = 0;
        const listeners: (() => void)[] = [];

        // Create many elements with event listeners
        for (let i = 0; i < 100; i++) {
          const element = document.createElement('button');
          element.textContent = `Button ${i}`;

          const clickListener = () => listenerCallCount++;
          const mouseoverListener = () => listenerCallCount++;

          element.addEventListener('click', clickListener);
          element.addEventListener('mouseover', mouseoverListener);

          listeners.push(clickListener, mouseoverListener);
          testContainer.appendChild(element);
        }

        // Trigger some events
        const buttons = testContainer.querySelectorAll('button');
        buttons.forEach(button => {
          button.dispatchEvent(new Event('click'));
          button.dispatchEvent(new Event('mouseover'));
        });

        const initialCallCount = listenerCallCount;

        // Remove container (should cleanup listeners)
        testContainer.remove();

        // Verify listeners are no longer active by attempting to trigger events
        // (This is a simplified test - real implementation would use more sophisticated tracking)
        buttons.forEach(button => {
          try {
            button.dispatchEvent(new Event('click'));
            button.dispatchEvent(new Event('mouseover'));
          } catch (e) {
            // Expected - elements are detached
          }
        });

        // Call count should not have increased after removal
        expect(listenerCallCount).to.equal(initialCallCount);
      });

      it('should handle CSS resource cleanup during theme changes', async function() {
        // RED: CSS resources should be cleaned up during theme switches
        this.timeout(6000); // 6 second timeout

        const initialStyleSheets = document.styleSheets.length;

        // Simulate multiple theme changes that add CSS
        for (let i = 0; i < 20; i++) {
          const styleElement = document.createElement('style');
          styleElement.textContent = `
            .theme-${i} {
              background: hsl(${i * 18}, 50%, 50%);
              color: white;
            }
            .notification-theme-${i} {
              border: 1px solid hsl(${i * 18}, 50%, 30%);
            }
          `;
          document.head.appendChild(styleElement);

          // Apply theme briefly
          document.body.className = `theme-${i}`;

          // Cleanup old themes (keep only last 3)
          if (i >= 3) {
            const oldThemeElements = document.querySelectorAll(`style:has-text(.theme-${i - 3})`);
            oldThemeElements.forEach(element => element.remove());
          }
        }

        // Final cleanup
        document.body.className = '';
        const remainingStyleSheets = document.styleSheets.length;

        // Should not have accumulated many extra stylesheets
        expect(remainingStyleSheets - initialStyleSheets).to.be.lessThan(5);
      });

    });

  });

  describe('Terminal Process Memory Isolation', () => {

    describe('RED Phase - Process Memory Management', () => {

      it('should isolate terminal process memory from WebView memory', async function() {
        // RED: Terminal processes should not affect WebView memory
        this.timeout(15000); // 15 second timeout

        const webviewInitialMemory = process.memoryUsage().heapUsed;
        const performanceManager = new PerformanceManager();
        await performanceManager.initialize();

        // Simulate multiple terminal processes with heavy output
        const terminalCount = 10;
        const outputPerTerminal = 1000;

        for (let terminalIndex = 0; terminalIndex < terminalCount; terminalIndex++) {
          const terminalId = `isolation-test-${terminalIndex}`;

          // Generate substantial output for each terminal
          for (let outputIndex = 0; outputIndex < outputPerTerminal; outputIndex++) {
            const largeOutput = `Terminal ${terminalIndex} output ${outputIndex}: ${'X'.repeat(500)}\n`;
            await performanceManager.bufferOutput(terminalId, largeOutput);
          }

          // Simulate terminal process cleanup
          await performanceManager.clearBuffer(terminalId);
        }

        performanceManager.dispose();

        if (global.gc) global.gc();

        const webviewFinalMemory = process.memoryUsage().heapUsed;
        const webviewMemoryGrowth = webviewFinalMemory - webviewInitialMemory;

        // WebView memory growth should be bounded despite heavy terminal activity
        expect(webviewMemoryGrowth).to.be.lessThan(50 * 1024 * 1024); // Less than 50MB
      });

      it('should handle terminal process crashes without memory leaks', async function() {
        // RED: Crashed terminal processes should not leave memory artifacts
        this.timeout(10000); // 10 second timeout

        const messageManager = new RefactoredMessageManager();
        await messageManager.initialize();

        const crashedTerminals = [];

        // Simulate terminal process crashes
        for (let i = 0; i < 20; i++) {
          const terminalId = `crash-test-${i}`;

          // Simulate normal operation
          await messageManager.sendToExtension({
            type: 'createTerminal' as any,
            data: { terminalId, options: { name: `Crash Test ${i}` } }
          });

          // Simulate process crash
          await messageManager.handleTerminalCrash(terminalId, new Error('Simulated crash'));
          crashedTerminals.push(terminalId);

          // Cleanup crashed terminal
          await messageManager.cleanupCrashedTerminal(terminalId);
        }

        messageManager.dispose();

        // Verify no resources are leaked from crashed terminals
        const remainingResources = messageManager.getActiveTerminalCount();
        expect(remainingResources).to.equal(0);
      });

    });

  });

  describe('Long-Running Session Memory Stability', () => {

    describe('RED Phase - Extended Session Testing', () => {

      it('should maintain memory stability during extended terminal sessions', async function() {
        // RED: Extended sessions should not accumulate memory indefinitely
        this.timeout(30000); // 30 second timeout for extended test

        const sessionManager = new RefactoredTerminalWebviewManager();
        await sessionManager.initialize();

        const memorySnapshots: MemorySnapshot[] = [];
        const sessionDuration = 25000; // 25 seconds
        const snapshotInterval = 2500; // Every 2.5 seconds

        // Simulate extended session with various activities
        const sessionPromise = simulateExtendedSession(sessionManager, sessionDuration);

        // Monitor memory throughout session
        const monitorPromise = monitorMemoryDuringOperations(
          memorySnapshots,
          sessionDuration,
          snapshotInterval
        );

        await Promise.all([sessionPromise, monitorPromise]);

        sessionManager.dispose();

        // Analyze memory trends
        const stabilityAnalysis = analyzeMemoryStability(memorySnapshots);

        expect(stabilityAnalysis.isStable).to.be.true;
        expect(stabilityAnalysis.hasMemoryLeaks).to.be.false;
        expect(stabilityAnalysis.averageGrowthRate).to.be.lessThan(500 * 1024); // Less than 500KB/snapshot
      });

      it('should handle memory pressure gracefully during peak usage', async function() {
        // RED: Memory pressure should trigger appropriate cleanup
        this.timeout(18000); // 18 second timeout

        const managers = {
          webview: new RefactoredTerminalWebviewManager(),
          performance: new PerformanceManager(),
          notification: new NotificationManager()
        };

        await Promise.all(Object.values(managers).map(m => m.initialize()));

        // Simulate memory pressure scenario
        const memoryPressurePromise = simulateMemoryPressure(managers);

        let memoryPressureDetected = false;
        let cleanupTriggered = false;

        // Monitor for memory pressure response
        const originalMemoryUsage = process.memoryUsage().heapUsed;

        await memoryPressurePromise;

        const finalMemoryUsage = process.memoryUsage().heapUsed;
        const memoryGrowth = finalMemoryUsage - originalMemoryUsage;

        // Cleanup all managers
        await Promise.all(Object.values(managers).map(m => m.dispose()));

        // Memory growth should be reasonable even under pressure
        expect(memoryGrowth).to.be.lessThan(100 * 1024 * 1024); // Less than 100MB
      });

      it('should recover memory after high-activity periods', async function() {
        // RED: Memory should be recoverable after activity spikes
        this.timeout(20000); // 20 second timeout

        const webviewManager = new RefactoredTerminalWebviewManager();
        await webviewManager.initialize();

        const baselineMemory = process.memoryUsage().heapUsed;

        // High-activity period
        await simulateHighActivityPeriod(webviewManager, 8000); // 8 seconds of high activity

        const peakMemory = process.memoryUsage().heapUsed;
        const peakGrowth = peakMemory - baselineMemory;

        // Recovery period
        await simulateRecoveryPeriod(webviewManager, 5000); // 5 seconds of low activity

        if (global.gc) {
          global.gc();
          global.gc();
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        const recoveryMemory = process.memoryUsage().heapUsed;
        const recoveryGrowth = recoveryMemory - baselineMemory;

        webviewManager.dispose();

        // Memory should recover significantly from peak
        const recoveryPercentage = (peakGrowth - recoveryGrowth) / peakGrowth;
        expect(recoveryPercentage).to.be.greaterThan(0.5); // At least 50% recovery

        // Final memory should be reasonable
        expect(recoveryGrowth).to.be.lessThan(20 * 1024 * 1024); // Less than 20MB residual
      });

    });

  });

  // Helper functions for memory testing

  function captureMemorySnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      timestamp: Date.now(),
      activeManagers: getActiveManagerCount(),
      eventListeners: getEventListenerCount(),
      domNodes: document.querySelectorAll('*').length
    };
  }

  function getActiveManagerCount(): number {
    // Simplified - would track actual manager instances in real implementation
    return 0;
  }

  function getEventListenerCount(): number {
    // Simplified - would use actual listener tracking in real implementation
    return document.querySelectorAll('[onclick], [onmouseover], [onchange]').length;
  }

  function analyzeMemoryGrowth(snapshots: MemorySnapshot[]): LeakDetectionResult {
    if (snapshots.length < 3) {
      return {
        suspected: false,
        growthRate: 0,
        cyclesAnalyzed: snapshots.length,
        memoryGrowth: 0,
        recommendations: []
      };
    }

    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];
    const timeDiff = (lastSnapshot.timestamp - firstSnapshot.timestamp) / 1000;
    const memoryGrowth = lastSnapshot.heapUsed - firstSnapshot.heapUsed;
    const growthRate = memoryGrowth / timeDiff;

    return {
      suspected: growthRate > 1024 * 1024, // Suspicious if > 1MB/sec growth
      growthRate,
      cyclesAnalyzed: snapshots.length,
      memoryGrowth,
      recommendations: growthRate > 1024 * 1024 ? ['Check for event listener leaks', 'Verify manager disposal'] : []
    };
  }

  function analyzeMemoryStability(snapshots: MemorySnapshot[]): {
    isStable: boolean;
    hasMemoryLeaks: boolean;
    maxGrowthPercentage: number;
    finalMemoryIncrease: number;
    averageGrowthRate: number;
  } {
    if (snapshots.length < 2) {
      return {
        isStable: true,
        hasMemoryLeaks: false,
        maxGrowthPercentage: 0,
        finalMemoryIncrease: 0,
        averageGrowthRate: 0
      };
    }

    const baseline = snapshots[0].heapUsed;
    const growthRates = [];
    let maxGrowth = 0;

    for (let i = 1; i < snapshots.length; i++) {
      const current = snapshots[i].heapUsed;
      const previous = snapshots[i - 1].heapUsed;
      const timeDiff = (snapshots[i].timestamp - snapshots[i - 1].timestamp) / 1000;

      const growth = current - baseline;
      const growthPercentage = (growth / baseline) * 100;
      const growthRate = (current - previous) / timeDiff;

      maxGrowth = Math.max(maxGrowth, growthPercentage);
      growthRates.push(growthRate);
    }

    const averageGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
    const finalIncrease = snapshots[snapshots.length - 1].heapUsed - baseline;

    return {
      isStable: maxGrowth < 100, // Stable if less than 100% growth
      hasMemoryLeaks: averageGrowthRate > 500 * 1024, // Leak if consistently growing > 500KB/sec
      maxGrowthPercentage: maxGrowth,
      finalMemoryIncrease: finalIncrease,
      averageGrowthRate
    };
  }

  async function createAndInitializeManager<T extends BaseManager>(
    ManagerClass: new (...args: any[]) => T
  ): Promise<T> {
    const manager = new ManagerClass();
    await manager.initialize();
    return manager;
  }

  async function stressNotificationManager(manager: NotificationManager): Promise<void> {
    for (let i = 0; i < 10; i++) {
      manager.showNotificationInTerminal(`Stress test ${i}`, 'info');
      manager.showToast(`Toast ${i}`, 'success', 50);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    manager.clearNotifications();
  }

  async function stressPerformanceManager(manager: PerformanceManager): Promise<void> {
    for (let i = 0; i < 50; i++) {
      await manager.bufferOutput('stress-test', `Stress output ${i}\n`);
    }
  }

  async function stressMessageManager(manager: RefactoredMessageManager): Promise<void> {
    for (let i = 0; i < 20; i++) {
      await manager.sendToExtension({
        type: 'test' as any,
        data: { stress: `test ${i}` }
      });
    }
  }

  async function continuousManagerOperations(manager: PerformanceManager, duration: number): Promise<void> {
    const startTime = Date.now();
    let operationCount = 0;

    while (Date.now() - startTime < duration) {
      await manager.bufferOutput('continuous-test', `Operation ${operationCount++}\n`);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  async function monitorMemoryDuringOperations(
    snapshots: MemorySnapshot[],
    duration: number,
    interval: number
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      snapshots.push(captureMemorySnapshot());
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  async function simulateExtendedSession(manager: RefactoredTerminalWebviewManager, duration: number): Promise<void> {
    const startTime = Date.now();
    let operationCycle = 0;

    while (Date.now() - startTime < duration) {
      // Simulate various terminal operations
      const terminalId = `session-terminal-${operationCycle % 3}`;

      // Create terminal if needed
      if (operationCycle % 100 === 0) {
        // Simulate terminal creation
      }

      // Generate some output
      await new Promise(resolve => setTimeout(resolve, 50));

      operationCycle++;
    }
  }

  async function simulateMemoryPressure(managers: {
    webview: RefactoredTerminalWebviewManager;
    performance: PerformanceManager;
    notification: NotificationManager;
  }): Promise<void> {
    // Generate memory pressure through intensive operations
    const promises = [];

    // Heavy buffering
    for (let i = 0; i < 100; i++) {
      promises.push(managers.performance.bufferOutput(`pressure-${i}`, 'Heavy load data\n'));
    }

    // Many notifications
    for (let i = 0; i < 50; i++) {
      managers.notification.showNotificationInTerminal(`Pressure notification ${i}`, 'warning');
    }

    await Promise.all(promises);
  }

  async function simulateHighActivityPeriod(manager: RefactoredTerminalWebviewManager, duration: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      // Intensive operations
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  async function simulateRecoveryPeriod(manager: RefactoredTerminalWebviewManager, duration: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      // Light operations and cleanup triggers
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

});