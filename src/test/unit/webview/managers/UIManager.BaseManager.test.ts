/**
 * UIManager BaseManager Integration Tests - Enhanced test suite using CommonTestHelpers
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { Terminal } from 'xterm';
import { UIManager } from '../../../../webview/managers/UIManager';
import {
  createMockCoordinator,
  setupManagerTest,
  cleanupManagerTest,
  TestPatterns,
  DOMTestUtils,
  AsyncTestUtils,
  PerformanceTestUtils,
} from '../../../../webview/utils/CommonTestHelpers';

describe('UIManager BaseManager Integration', () => {
  let testSetup: ReturnType<typeof setupManagerTest<UIManager>>;

  beforeEach(() => {
    // Setup DOM environment for UI tests
    DOMTestUtils.setupDOM();

    // Setup manager with BaseManager functionality
    testSetup = setupManagerTest(UIManager);
  });

  afterEach(() => {
    cleanupManagerTest(testSetup);
    DOMTestUtils.cleanupDOM();
  });

  describe('BaseManager Inheritance', () => {
    it('should properly initialize with BaseManager functionality', () => {
      const { manager } = testSetup;

      // Test BaseManager initialization
      TestPatterns.testManagerInitialization(manager, testSetup.coordinator);

      // UIManager should have BaseManager methods
      expect(manager).to.have.property('getStatus');
      expect(manager).to.have.property('log');
      expect(manager).to.have.property('dispose');
    });

    it('should use BaseManager logging instead of direct log calls', () => {
      const { manager } = testSetup;

      // Stub the BaseManager log method
      const logSpy = sinon.spy(manager, 'log');

      // Call a method that should use this.log()
      manager.showTerminalPlaceholder();

      // Verify BaseManager log was called
      expect(logSpy.calledOnce).to.be.true;
      expect(logSpy.firstCall.args[0]).to.include('[UI] Terminal placeholder shown');
    });

    it('should properly dispose with BaseManager cleanup', () => {
      const { manager } = testSetup;

      // Test manager disposal
      TestPatterns.testManagerDisposal(manager);
    });

    it('should handle errors with BaseManager error recovery', () => {
      const { manager } = testSetup;

      // Test error handling
      TestPatterns.testErrorHandling(
        manager,
        () => {
          // Force an error condition
          (manager as any).updateSingleTerminalBorder(null, true);
        },
        'Cannot read'
      );
    });
  });

  describe('Enhanced UI Operations', () => {
    it('should create terminal headers with proper BaseManager logging', async () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');

      const header = manager.createTerminalHeader('test-terminal', 'Test Terminal');

      expect(header).to.be.instanceOf(HTMLElement);
      expect(logSpy.calledWith(sinon.match('[UI] Terminal header created'))).to.be.true;
    });

    it('should update terminal borders with performance optimization', () => {
      const { manager } = testSetup;

      // Create mock containers
      const containers = new Map<string, HTMLElement>();
      const container1 = DOMTestUtils.createMockTerminal('terminal-1');
      const container2 = DOMTestUtils.createMockTerminal('terminal-2');

      containers.set('terminal-1', container1);
      containers.set('terminal-2', container2);

      document.body.appendChild(container1);
      document.body.appendChild(container2);

      // Performance test for border updates
      const { duration } = PerformanceTestUtils.measureTime(() => {
        manager.updateTerminalBorders('terminal-1', containers);
      });

      // Should be fast (< 10ms for 2 terminals)
      expect(duration).to.be.lessThan(10);

      // Verify correct border state
      expect(container1.classList.contains('active')).to.be.true;
      expect(container2.classList.contains('active')).to.be.false;
    });

    it('should handle notification creation with proper styling', () => {
      const { manager } = testSetup;

      const notification = manager.createNotificationElement({
        type: 'success',
        title: 'Test Success',
        message: 'Test message',
        duration: 3000,
      });

      expect(notification).to.be.instanceOf(HTMLElement);
      expect(notification.querySelector('strong')?.textContent).to.equal('Test Success');
      expect(notification.className).to.include('terminal-notification');
    });

    it('should apply terminal themes efficiently', () => {
      const { manager } = testSetup;

      const mockTerminal = {
        options: { theme: {} },
      } as Terminal;

      const settings = {
        theme: 'dark',
        fontSize: 14,
        fontFamily: 'monospace',
      };

      // Performance test for theme application
      TestPatterns.testPerformancePattern(
        () => manager.applyTerminalTheme(mockTerminal, settings),
        5, // Apply 5 times
        1, // Should be optimized to only apply once due to caching
        sinon.spy()
      );
    });
  });

  describe('Memory Management', () => {
    it('should properly manage header cache without memory leaks', () => {
      const { manager } = testSetup;

      // Test memory usage patterns
      PerformanceTestUtils.testMemoryUsage(() => {
        const header = manager.createTerminalHeader('test-' + Math.random(), 'Test');
        return {
          dispose: () => manager.removeTerminalHeader('test-' + Math.random()),
        };
      }, 50);

      // Clear cache should reset memory usage
      manager.clearHeaderCache();
      const stats = (manager as any).headerElementsCache.size;
      expect(stats).to.equal(0);
    });

    it('should dispose properly without memory leaks', () => {
      const { manager } = testSetup;

      // Create some UI elements
      manager.showTerminalPlaceholder();
      const indicator = manager.showLoadingIndicator('Testing...');

      // Dispose should clean up everything
      manager.dispose();

      // Verify cleanup
      const placeholder = document.getElementById('terminal-placeholder');
      expect(placeholder?.style.display).to.equal('none');
    });
  });

  describe('Async Operations', () => {
    it('should handle loading indicators asynchronously', async () => {
      const { manager } = testSetup;

      const operation = async () => {
        const indicator = manager.showLoadingIndicator('Processing...');
        await new Promise((resolve) => setTimeout(resolve, 50));
        manager.hideLoadingIndicator(indicator);
        return 'completed';
      };

      const result = await AsyncTestUtils.testAsyncOperation(operation, 500);
      expect(result).to.equal('completed');
    });

    it('should handle focus indicators with timeout', async () => {
      const { manager } = testSetup;

      const container = DOMTestUtils.createMockTerminal('focus-test');
      document.body.appendChild(container);

      manager.addFocusIndicator(container);

      // Wait for focus indicator to be applied and removed
      await AsyncTestUtils.waitFor(() => !container.classList.contains('focused'), 1000, 50);

      expect(container.classList.contains('focused')).to.be.false;
    });
  });

  describe('Integration with Coordinator', () => {
    it('should work properly with coordinator updates', () => {
      const { manager, coordinator } = testSetup;

      // Test CLI Agent status update integration
      manager.updateCliAgentStatusDisplay('terminal-1', 'connected', 'claude');

      // Should not directly call coordinator methods for UI operations
      expect(coordinator.updateActiveTerminal.called).to.be.false;
      expect(coordinator.updateTerminalState.called).to.be.false;
    });

    it('should handle terminal state synchronization', () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');

      // Test status update by terminal ID
      manager.updateCliAgentStatusByTerminalId('test-terminal', 'disconnected', 'gemini');

      // Should log the operation
      expect(logSpy.calledWith(sinon.match('Updating CLI Agent status'))).to.be.true;
    });
  });
});
