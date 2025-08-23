/**
 * Refactored Notification Manager Test Suite
 *
 * Demonstrates the enhanced testing patterns using the new test utilities.
 * This eliminates the code duplication found across all manager test files.
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { EnhancedTestHelper } from '../../../utils/EnhancedTestHelper';
import { RefactoredNotificationManager } from '../../../../webview/managers/RefactoredNotificationManager';

describe('RefactoredNotificationManager', () => {
  let testHelper: EnhancedTestHelper;
  let notificationManager: RefactoredNotificationManager;

  beforeEach(async () => {
    // Setup test environment with enhanced helper (eliminates 20+ lines of setup code)
    testHelper = new EnhancedTestHelper({
      enableJSDOM: true,
      enableFakeTimers: true,
      enablePerformanceMonitoring: true,
    });

    await testHelper.setup();

    // Create test manager with dependency injection (eliminates mock creation boilerplate)
    notificationManager = await testHelper.createTestManager(RefactoredNotificationManager, {
      enablePerformanceMonitoring: true,
    });
  });

  afterEach(async () => {
    // Enhanced cleanup (automatically disposes managers, clears timers, closes JSDOM)
    await testHelper.cleanup();
  });

  describe('Enhanced Base Manager Integration', () => {
    it('should properly initialize with enhanced base manager features', () => {
      // Use helper assertion methods
      testHelper.assertManagerInitialized(notificationManager);

      // Verify health status
      const health = notificationManager.getHealthStatus();
      expect(health.isHealthy).to.be.true;
      expect(health.errorCount).to.equal(0);
      expect(health.performanceMetrics).to.exist;
    });

    it('should handle initialization scenarios', async () => {
      // Test multiple initialization scenarios with helper method
      await testHelper.testManagerInitialization(RefactoredNotificationManager, [
        {
          name: 'successful initialization with all dependencies',
          shouldSucceed: true,
        },
        {
          name: 'initialization without logging coordinator',
          dependencies: { loggingCoordinator: undefined },
          shouldSucceed: true, // Should succeed but log warning
        },
        {
          name: 'initialization with invalid dependencies',
          dependencies: { terminalCoordinator: null as any },
          shouldSucceed: true, // Enhanced manager should handle gracefully
        },
      ]);
    });

    it('should properly dispose with enhanced cleanup', () => {
      notificationManager.dispose();
      testHelper.assertManagerDisposed(notificationManager);
    });
  });

  describe('Core Notification Functionality', () => {
    it('should show terminal notifications with performance monitoring', () => {
      const message = 'Test notification';

      // Method call with performance measurement
      notificationManager.showNotificationInTerminal(message, 'info');

      // Verify notification was created
      const stats = notificationManager.getStats();
      expect(stats.activeCount).to.equal(1);
      expect(stats.totalCreated).to.equal(1);

      // Verify DOM element was created
      const notifications = document.querySelectorAll('.enhanced-notification');
      expect(notifications).to.have.length(1);
      expect(notifications[0].textContent).to.include(message);
    });

    it('should handle different notification types with proper styling', () => {
      const types: Array<'info' | 'success' | 'warning' | 'error'> = [
        'info',
        'success',
        'warning',
        'error',
      ];

      types.forEach((type, index) => {
        notificationManager.showNotificationInTerminal(`Test ${type} message`, type);

        const notification = document.querySelector(`.enhanced-notification-${type}`);
        expect(notification).to.exist;

        // Verify type-specific styling
        const computedStyle = window.getComputedStyle(notification as Element);
        expect(computedStyle.position).to.equal('fixed');
      });

      // Verify all notifications were created
      const stats = notificationManager.getStats();
      expect(stats.activeCount).to.equal(types.length);
      expect(stats.totalCreated).to.equal(types.length);
    });

    it('should handle terminal error notifications', () => {
      const errorMessage = 'Terminal process failed';

      notificationManager.showTerminalKillError(errorMessage);

      const stats = notificationManager.getStats();
      expect(stats.errorNotifications).to.equal(1);

      // Verify error notification styling
      const errorNotification = document.querySelector('.enhanced-notification-error');
      expect(errorNotification).to.exist;
      expect(errorNotification?.textContent).to.include('Kill Error');
      expect(errorNotification?.textContent).to.include(errorMessage);
    });

    it('should show terminal close error with context', () => {
      const minTerminals = 2;

      notificationManager.showTerminalCloseError(minTerminals);

      const stats = notificationManager.getStats();
      expect(stats.errorNotifications).to.equal(1);

      const warningNotification = document.querySelector('.enhanced-notification-warning');
      expect(warningNotification).to.exist;
      expect(warningNotification?.textContent).to.include('Cannot close');
      expect(warningNotification?.textContent).to.include(`${minTerminals} terminals`);
    });
  });

  describe('Alt+Click Feedback System', () => {
    it('should show Alt+Click feedback with enhanced animation', () => {
      const x = 100;
      const y = 200;

      notificationManager.showAltClickFeedback(x, y);

      // Verify feedback element was created
      const feedback = document.querySelector('.enhanced-alt-click-feedback');
      expect(feedback).to.exist;

      // Verify positioning
      const style = (feedback as HTMLElement).style;
      expect(style.left).to.equal(`${x - 6}px`);
      expect(style.top).to.equal(`${y - 6}px`);

      // Verify animation is applied
      expect(style.animation).to.include('enhanced-alt-click-pulse');
    });

    it('should automatically clean up Alt+Click feedback', () => {
      notificationManager.showAltClickFeedback(100, 200);

      // Verify feedback exists
      expect(document.querySelector('.enhanced-alt-click-feedback')).to.exist;

      // Advance timers to trigger cleanup
      testHelper.advanceTimers(800);

      // Verify feedback was cleaned up
      expect(document.querySelector('.enhanced-alt-click-feedback')).to.not.exist;
    });
  });

  describe('Notification Lifecycle Management', () => {
    it('should auto-remove temporary notifications', () => {
      const duration = 1000;
      const notificationId = notificationManager.showTemporaryNotification(
        'Temporary message',
        duration
      );

      // Verify notification exists
      expect(notificationManager.getStats().activeCount).to.equal(1);

      // Advance timers to trigger auto-removal
      testHelper.advanceTimers(duration);

      // Verify notification was removed
      expect(notificationManager.getStats().activeCount).to.equal(0);
      expect(notificationManager.getStats().dismissedCount).to.equal(1);
    });

    it('should manually hide notifications by ID', () => {
      const notificationId = notificationManager.showTemporaryNotification('Test message', 5000);

      expect(notificationManager.getStats().activeCount).to.equal(1);

      notificationManager.hideNotification(notificationId);

      expect(notificationManager.getStats().activeCount).to.equal(0);
      expect(notificationManager.getStats().dismissedCount).to.equal(1);
    });

    it('should clear all notifications', () => {
      // Create multiple notifications
      for (let i = 0; i < 3; i++) {
        notificationManager.showTemporaryNotification(`Message ${i}`, 5000);
      }

      expect(notificationManager.getStats().activeCount).to.equal(3);

      notificationManager.clearNotifications();

      // Advance timers to complete staggered removal
      testHelper.advanceTimers(1000);

      expect(notificationManager.getStats().activeCount).to.equal(0);
      expect(notificationManager.getStats().dismissedCount).to.equal(3);
    });

    it('should enforce notification limits', () => {
      const maxNotifications = 5; // As defined in RefactoredNotificationManager

      // Create more notifications than the limit
      for (let i = 0; i < maxNotifications + 2; i++) {
        notificationManager.showTemporaryNotification(`Message ${i}`, 10000);
      }

      // Should only have max notifications active
      expect(notificationManager.getStats().activeCount).to.equal(maxNotifications);
      expect(notificationManager.getStats().totalCreated).to.equal(maxNotifications + 2);
    });
  });

  describe('Enhanced Styling and Animation', () => {
    it('should setup notification styles', () => {
      // Verify styles were injected
      const styleElement = document.querySelector('#enhanced-notification-styles');
      expect(styleElement).to.exist;

      const styleContent = styleElement?.textContent || '';
      expect(styleContent).to.include('enhanced-notification-entrance');
      expect(styleContent).to.include('enhanced-alt-click-pulse');
    });

    it('should create notification container with proper styling', () => {
      notificationManager.showNotificationInTerminal('Test message');

      const container = document.getElementById('enhanced-notification-container');
      expect(container).to.exist;

      const style = window.getComputedStyle(container!);
      expect(style.position).to.equal('fixed');
      expect(style.zIndex).to.equal('10000');
    });

    it('should apply VS Code theme colors', () => {
      notificationManager.showNotificationInTerminal('Test message', 'error');

      const errorNotification = document.querySelector(
        '.enhanced-notification-error'
      ) as HTMLElement;
      expect(errorNotification).to.exist;

      // Verify CSS custom properties are used
      const style = errorNotification.style;
      expect(style.background).to.include('var(--vscode-');
      expect(style.border).to.include('var(--vscode-');
    });
  });

  describe('Event Handling', () => {
    it('should handle page visibility changes', () => {
      notificationManager.showNotificationInTerminal('Test message');

      const notification = document.querySelector('.enhanced-notification') as HTMLElement;
      expect(notification).to.exist;

      // Simulate page hidden
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(notification.style.animationPlayState).to.equal('paused');

      // Simulate page visible
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(notification.style.animationPlayState).to.equal('running');
    });

    it('should handle notification close button clicks', () => {
      notificationManager.showNotificationInTerminal('Test message');

      const closeButton = document.querySelector('.enhanced-notification button') as HTMLElement;
      expect(closeButton).to.exist;

      // Verify initial state
      expect(notificationManager.getStats().activeCount).to.equal(1);

      // Click close button
      closeButton.click();

      // Advance timers for exit animation
      testHelper.advanceTimers(300);

      // Verify notification was removed
      expect(notificationManager.getStats().activeCount).to.equal(0);
      expect(notificationManager.getStats().dismissedCount).to.equal(1);
    });
  });

  describe('Performance and Statistics', () => {
    it('should track notification statistics', () => {
      // Initial stats
      let stats = notificationManager.getStats();
      expect(stats.activeCount).to.equal(0);
      expect(stats.totalCreated).to.equal(0);
      expect(stats.dismissedCount).to.equal(0);
      expect(stats.errorNotifications).to.equal(0);

      // Create various notifications
      notificationManager.showNotificationInTerminal('Info message', 'info');
      notificationManager.showTerminalKillError('Error message');
      notificationManager.showTerminalCloseError(2);

      stats = notificationManager.getStats();
      expect(stats.activeCount).to.equal(3);
      expect(stats.totalCreated).to.equal(3);
      expect(stats.errorNotifications).to.equal(2); // Kill error + close error

      // Clear notifications
      notificationManager.clearNotifications();
      testHelper.advanceTimers(1000);

      stats = notificationManager.getStats();
      expect(stats.activeCount).to.equal(0);
      expect(stats.dismissedCount).to.equal(3);
      expect(stats.errorNotifications).to.equal(2); // Cumulative count
    });

    it('should measure performance of notification operations', () => {
      const health = notificationManager.getHealthStatus();
      const initialMetrics = health.performanceMetrics;
      expect(initialMetrics).to.exist;

      // Perform operations
      for (let i = 0; i < 5; i++) {
        notificationManager.showNotificationInTerminal(`Message ${i}`);
      }

      const updatedHealth = notificationManager.getHealthStatus();
      const updatedMetrics = updatedHealth.performanceMetrics!;

      expect(updatedMetrics.totalOperations).to.be.greaterThan(initialMetrics!.totalOperations);
      expect(updatedMetrics.averageResponseTime).to.be.a('number');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle DOM errors gracefully', () => {
      notificationManager.showNotificationInTerminal('Test message');

      // Simulate DOM error by removing notification container
      const container = document.getElementById('enhanced-notification-container');
      container?.remove();

      // Should not throw when trying to update positions
      expect(() => {
        notificationManager.showNotificationInTerminal('Another message');
      }).to.not.throw();
    });

    it('should maintain health status during errors', () => {
      const initialHealth = notificationManager.getHealthStatus();
      expect(initialHealth.isHealthy).to.be.true;

      // Health should remain stable during normal operations
      notificationManager.showNotificationInTerminal('Test message');

      const health = notificationManager.getHealthStatus();
      expect(health.isHealthy).to.be.true;
      expect(health.errorCount).to.equal(0);
    });
  });
});
