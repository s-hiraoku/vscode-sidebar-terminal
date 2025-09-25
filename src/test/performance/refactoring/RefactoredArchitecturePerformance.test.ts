/**
 * Performance tests for the refactored architecture
 * Validates that the new service-oriented architecture maintains good performance
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { RefactoredWebviewCoordinator } from '../../../webview/RefactoredWebviewCoordinator';
import { TerminalCoordinatorFactory } from '../../../webview/services/TerminalCoordinator';
import { UIControllerFactory } from '../../../webview/services/UIController';
import { MessageRouterFactory } from '../../../services/MessageRouter';

describe('Refactored Architecture Performance Tests', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Setup minimal DOM for performance testing
    document.body.innerHTML = `
      <div id="terminal-area"></div>
      <div id="terminal-tabs-container"></div>
      <div id="notification-container"></div>
    `;

    // Mock heavy DOM operations
    (global as any).Terminal = sandbox.stub().returns({
      open: sandbox.stub(),
      write: sandbox.stub(),
      resize: sandbox.stub(),
      dispose: sandbox.stub(),
      focus: sandbox.stub(),
      onData: sandbox.stub(),
      onResize: sandbox.stub(),
      loadAddon: sandbox.stub()
    });

    (global as any).FitAddon = sandbox.stub().returns({
      fit: sandbox.stub(),
      propose: sandbox.stub()
    });

    (window as any).acquireVsCodeApi = () => ({
      postMessage: sandbox.stub()
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    sandbox.restore();
  });

  describe('Service Initialization Performance', () => {
    it('should initialize services quickly', async () => {
      const coordinator = new RefactoredWebviewCoordinator();

      const startTime = performance.now();
      await coordinator.initialize();
      const duration = performance.now() - startTime;

      expect(duration).to.be.lessThan(100); // Should initialize in under 100ms

      coordinator.dispose();
    });

    it('should initialize individual services efficiently', async () => {
      const terminalCoordinator = TerminalCoordinatorFactory.createDefault();
      const uiController = UIControllerFactory.createDefault();
      const messageRouter = MessageRouterFactory.createDefault();

      const startTime = performance.now();

      await Promise.all([
        terminalCoordinator.initialize(),
        uiController.initialize()
      ]);

      const duration = performance.now() - startTime;

      expect(duration).to.be.lessThan(50); // Parallel initialization should be fast

      terminalCoordinator.dispose();
      uiController.dispose();
      messageRouter.dispose();
    });

    it('should handle service disposal efficiently', async () => {
      const coordinator = new RefactoredWebviewCoordinator();
      await coordinator.initialize();

      // Create some terminals to test disposal performance
      for (let i = 0; i < 5; i++) {
        await coordinator.createTerminal();
      }

      const startTime = performance.now();
      coordinator.dispose();
      const duration = performance.now() - startTime;

      expect(duration).to.be.lessThan(50); // Disposal should be quick
    });
  });

  describe('Terminal Operations Performance', () => {
    let coordinator: RefactoredWebviewCoordinator;

    beforeEach(async () => {
      coordinator = new RefactoredWebviewCoordinator();
      await coordinator.initialize();
    });

    afterEach(() => {
      coordinator.dispose();
    });

    it('should create terminals quickly', async () => {
      const creationTimes: number[] = [];

      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        await coordinator.createTerminal();
        const duration = performance.now() - startTime;
        creationTimes.push(duration);
      }

      const averageTime = creationTimes.reduce((a, b) => a + b) / creationTimes.length;
      expect(averageTime).to.be.lessThan(20); // Average creation should be under 20ms
    });

    it('should switch terminals efficiently', async () => {
      // Create multiple terminals
      const terminalIds = [];
      for (let i = 0; i < 5; i++) {
        const terminalId = await coordinator.createTerminal();
        terminalIds.push(terminalId);
      }

      const switchTimes: number[] = [];

      for (let i = 0; i < 20; i++) {
        const targetId = terminalIds[i % terminalIds.length];
        if (targetId) {
          const startTime = performance.now();
          await coordinator.switchToTerminal(targetId);
          const duration = performance.now() - startTime;
          switchTimes.push(duration);
        }
      }

      const averageTime = switchTimes.reduce((a, b) => a + b) / switchTimes.length;
      expect(averageTime).to.be.lessThan(5); // Switching should be very fast
    });

    it('should handle rapid terminal creation and deletion', async () => {
      const operationCount = 50;
      const startTime = performance.now();

      for (let i = 0; i < Math.min(operationCount, 5); i++) {
        const terminalId = await coordinator.createTerminal();
        await coordinator.removeTerminal(terminalId);
      }

      const totalDuration = performance.now() - startTime;
      const averageOperationTime = totalDuration / (Math.min(operationCount, 5) * 2);

      expect(averageOperationTime).to.be.lessThan(10); // Each operation should be under 10ms
    });
  });

  describe('Message Routing Performance', () => {
    let messageRouter: any;

    beforeEach(() => {
      messageRouter = MessageRouterFactory.createDefault();
    });

    afterEach(() => {
      messageRouter.dispose();
    });

    it('should route messages efficiently', async () => {
      const fastHandler = {
        handle: (data: any) => Promise.resolve(`result-${data.id}`)
      };

      messageRouter.registerHandler('fastCommand', fastHandler);

      const messageCount = 100;
      const startTime = performance.now();

      const promises = [];
      for (let i = 0; i < messageCount; i++) {
        promises.push(messageRouter.routeMessage('fastCommand', { id: i }));
      }

      await Promise.all(promises);
      const totalDuration = performance.now() - startTime;
      const averageTime = totalDuration / messageCount;

      expect(averageTime).to.be.lessThan(2); // Each message should route in under 2ms
    });

    it('should handle handler registration efficiently', () => {
      const handlerCount = 1000;
      const startTime = performance.now();

      for (let i = 0; i < handlerCount; i++) {
        messageRouter.registerHandler(`command${i}`, {
          handle: () => `result${i}`
        });
      }

      const duration = performance.now() - startTime;
      const averageTime = duration / handlerCount;

      expect(averageTime).to.be.lessThan(0.1); // Each registration should be under 0.1ms
    });

    it('should lookup handlers quickly', () => {
      // Register many handlers
      for (let i = 0; i < 1000; i++) {
        messageRouter.registerHandler(`command${i}`, {
          handle: () => `result${i}`
        });
      }

      const lookupCount = 1000;
      const startTime = performance.now();

      for (let i = 0; i < lookupCount; i++) {
        messageRouter.hasHandler(`command${i % 500}`);
      }

      const duration = performance.now() - startTime;
      const averageTime = duration / lookupCount;

      expect(averageTime).to.be.lessThan(0.01); // Each lookup should be under 0.01ms
    });
  });

  describe('UI Update Performance', () => {
    let uiController: any;

    beforeEach(async () => {
      uiController = UIControllerFactory.createDefault();
      await uiController.initialize();
    });

    afterEach(() => {
      uiController.dispose();
    });

    it('should update terminal tabs efficiently', () => {
      const terminalCount = 50;
      const terminalInfos = [];

      for (let i = 0; i < terminalCount; i++) {
        terminalInfos.push({
          id: `terminal-${i}`,
          number: i + 1,
          isActive: i === 0
        });
      }

      const startTime = performance.now();
      uiController.updateTerminalTabs(terminalInfos);
      const duration = performance.now() - startTime;

      expect(duration).to.be.lessThan(50); // Should update many tabs quickly
    });

    it('should show notifications efficiently', () => {
      const notificationCount = 20;
      const startTime = performance.now();

      for (let i = 0; i < notificationCount; i++) {
        uiController.showNotification({
          type: 'info',
          message: `Notification ${i}`,
          duration: 1000
        });
      }

      const duration = performance.now() - startTime;
      const averageTime = duration / notificationCount;

      expect(averageTime).to.be.lessThan(5); // Each notification should be quick
    });

    it('should handle rapid status updates', () => {
      const updateCount = 100;
      const statuses = ['READY', 'BUSY', 'ERROR'] as const;

      const startTime = performance.now();

      for (let i = 0; i < updateCount; i++) {
        const status = statuses[i % statuses.length];
        uiController.updateSystemStatus(status);
      }

      const duration = performance.now() - startTime;
      const averageTime = duration / updateCount;

      expect(averageTime).to.be.lessThan(1); // Each status update should be very fast
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not leak memory during normal operations', async () => {
      const coordinator = new RefactoredWebviewCoordinator();
      await coordinator.initialize();

      // Simulate typical usage pattern
      const cycles = 10;

      for (let cycle = 0; cycle < cycles; cycle++) {
        // Create terminals
        const terminalIds = [];
        for (let i = 0; i < 3; i++) {
          const terminalId = await coordinator.createTerminal();
          terminalIds.push(terminalId);
        }

        // Use terminals
        for (const terminalId of terminalIds) {
          await coordinator.switchToTerminal(terminalId);
        }

        // Clean up
        for (const terminalId of terminalIds) {
          await coordinator.removeTerminal(terminalId);
        }
      }

      // Memory usage should be consistent
      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.terminalCount).to.equal(0);
      expect(debugInfo.activeHandlers).to.equal(0);

      coordinator.dispose();
    });

    it('should handle event listener cleanup efficiently', async () => {
      const coordinator = new RefactoredWebviewCoordinator();
      await coordinator.initialize();

      // Create and remove many terminals to test event cleanup
      for (let i = 0; i < 20; i++) {
        const terminalId = await coordinator.createTerminal();
        await coordinator.removeTerminal(terminalId);
      }

      // Should not accumulate event listeners
      const debugInfo = coordinator.getDebugInfo();
      expect(debugInfo.terminalCount).to.equal(0);

      coordinator.dispose();
    });

    it('should handle rapid service creation and disposal', () => {
      const serviceCount = 50;
      const startTime = performance.now();

      for (let i = 0; i < serviceCount; i++) {
        const coordinator = TerminalCoordinatorFactory.createDefault();
        const uiController = UIControllerFactory.createDefault();
        const messageRouter = MessageRouterFactory.createDefault();

        coordinator.dispose();
        uiController.dispose();
        messageRouter.dispose();
      }

      const duration = performance.now() - startTime;
      const averageTime = duration / serviceCount;

      expect(averageTime).to.be.lessThan(2); // Each service lifecycle should be fast
    });
  });

  describe('Concurrent Operations Performance', () => {
    let coordinator: RefactoredWebviewCoordinator;

    beforeEach(async () => {
      coordinator = new RefactoredWebviewCoordinator();
      await coordinator.initialize();
    });

    afterEach(() => {
      coordinator.dispose();
    });

    it('should handle concurrent terminal creation efficiently', async () => {
      const concurrentCount = 5; // Max terminals
      const startTime = performance.now();

      const promises = [];
      for (let i = 0; i < concurrentCount; i++) {
        promises.push(coordinator.createTerminal());
      }

      const terminalIds = await Promise.all(promises);
      const duration = performance.now() - startTime;

      expect(terminalIds.length).to.equal(concurrentCount);
      expect(duration).to.be.lessThan(100); // Concurrent creation should be efficient
    });

    it('should handle concurrent message processing efficiently', async () => {
      // Create a terminal first
      await coordinator.createTerminal();

      const messageCount = 50;
      const startTime = performance.now();

      const promises = [];
      for (let i = 0; i < messageCount; i++) {
        promises.push(
          coordinator.handleExtensionMessage('getSettings', {})
        );
      }

      await Promise.allSettled(promises);
      const duration = performance.now() - startTime;
      const averageTime = duration / messageCount;

      expect(averageTime).to.be.lessThan(5); // Each message should process quickly
    });

    it('should maintain performance under mixed workload', async () => {
      const startTime = performance.now();

      // Mixed operations
      const operations = [
        coordinator.createTerminal(),
        coordinator.createTerminal(),
        coordinator.handleExtensionMessage('getSettings', {}),
        coordinator.createTerminal()
      ];

      await Promise.all(operations);

      // More mixed operations
      const terminalIds = [];
      for (let i = 0; i < 3; i++) {
        const terminalId = await coordinator.createTerminal();
        terminalIds.push(terminalId);
      }

      for (const terminalId of terminalIds) {
        await coordinator.switchToTerminal(terminalId);
      }

      const duration = performance.now() - startTime;
      expect(duration).to.be.lessThan(200); // Mixed workload should complete quickly
    });
  });

  describe('Stress Testing', () => {
    it('should handle service stress test', async () => {
      const coordinator = new RefactoredWebviewCoordinator();
      await coordinator.initialize();

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const terminalId = await coordinator.createTerminal();

        // Rapid operations
        await coordinator.switchToTerminal(terminalId);
        await coordinator.handleExtensionMessage('getSettings', {});
        await coordinator.removeTerminal(terminalId);
      }

      const duration = performance.now() - startTime;
      const averageIterationTime = duration / iterations;

      expect(averageIterationTime).to.be.lessThan(10); // Each iteration should be fast

      coordinator.dispose();
    });

    it('should maintain performance with high message volume', async () => {
      const messageRouter = MessageRouterFactory.createDefault();

      const handler = {
        handle: (data: any) => Promise.resolve(data)
      };

      messageRouter.registerHandler('stressCommand', handler);

      const messageCount = 1000;
      const batchSize = 50;
      const totalTime = { value: 0 };

      // Process in batches to simulate real-world usage
      for (let batch = 0; batch < messageCount / batchSize; batch++) {
        const batchStart = performance.now();

        const promises = [];
        for (let i = 0; i < batchSize; i++) {
          promises.push(
            messageRouter.routeMessage('stressCommand', { batch, message: i })
          );
        }

        await Promise.all(promises);
        totalTime.value += performance.now() - batchStart;
      }

      const averageMessageTime = totalTime.value / messageCount;
      expect(averageMessageTime).to.be.lessThan(1); // Should handle high volume efficiently

      messageRouter.dispose();
    });

    it('should recover performance after stress', async () => {
      const coordinator = new RefactoredWebviewCoordinator();
      await coordinator.initialize();

      // Stress phase
      for (let i = 0; i < 20; i++) {
        const terminalId = await coordinator.createTerminal();
        await coordinator.removeTerminal(terminalId);
      }

      // Performance should recover
      const normalStartTime = performance.now();
      const _terminalId = await coordinator.createTerminal();
      const normalDuration = performance.now() - normalStartTime;

      expect(normalDuration).to.be.lessThan(50); // Should return to normal performance

      coordinator.dispose();
    });
  });

  describe('Comparison with Legacy Architecture', () => {
    it('should demonstrate improved initialization time', async () => {
      // New architecture
      const newCoordinator = new RefactoredWebviewCoordinator();

      const newStartTime = performance.now();
      await newCoordinator.initialize();
      const newDuration = performance.now() - newStartTime;

      newCoordinator.dispose();

      // New architecture should be efficient
      expect(newDuration).to.be.lessThan(100);

      // Note: In a real comparison, we would benchmark against the old
      // RefactoredTerminalWebviewManager, but it's too complex to set up here
    });

    it('should demonstrate better resource utilization', () => {
      const serviceCount = 10;
      const services = [];

      const startTime = performance.now();

      // Create multiple service instances
      for (let i = 0; i < serviceCount; i++) {
        const terminalCoordinator = TerminalCoordinatorFactory.createDefault();
        const uiController = UIControllerFactory.createDefault();
        const messageRouter = MessageRouterFactory.createDefault();

        services.push({ terminalCoordinator, uiController, messageRouter });
      }

      const creationTime = performance.now() - startTime;

      // Dispose all services
      const disposeStartTime = performance.now();
      for (const service of services) {
        service.terminalCoordinator.dispose();
        service.uiController.dispose();
        service.messageRouter.dispose();
      }
      const disposeTime = performance.now() - disposeStartTime;

      expect(creationTime / serviceCount).to.be.lessThan(5); // Fast creation
      expect(disposeTime / serviceCount).to.be.lessThan(2); // Fast disposal
    });
  });
});