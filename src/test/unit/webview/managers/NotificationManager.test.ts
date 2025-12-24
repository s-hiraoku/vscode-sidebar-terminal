/**
 * NotificationManager Test Suite - User feedback and notifications
 *
 * TDD Pattern: Covers notification creation, display, and lifecycle
 *
 * CRITICAL FIX: JSDOM is now created in beforeEach and cleaned up in afterEach
 * to prevent test pollution between test files.
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';

import { NotificationManager } from '../../../../webview/managers/NotificationManager';

describe('NotificationManager', () => {
  let notificationManager: NotificationManager;
  let clock: sinon.SinonFakeTimers;
  let dom: JSDOM;

  beforeEach(() => {
    // CRITICAL: Create JSDOM in beforeEach to prevent test pollution
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="terminal-container"></div></body></html>', {
      url: 'http://localhost',
    });

    // Set up global DOM
    (global as any).document = dom.window.document;
    (global as any).window = dom.window;
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).CustomEvent = dom.window.CustomEvent;

    clock = sinon.useFakeTimers();
    notificationManager = new NotificationManager();
    notificationManager.initialize();
  });

  afterEach(() => {
    // CRITICAL: Use try-finally to ensure all cleanup happens
    try {
      notificationManager.dispose();
    } finally {
      try {
        clock.restore();
      } finally {
        try {
          sinon.restore();
        } finally {
          try {
            // CRITICAL: Close JSDOM window to prevent memory leaks
            dom.window.close();
          } finally {
            // CRITICAL: Clean up global DOM state to prevent test pollution
            delete (global as any).document;
            delete (global as any).window;
            delete (global as any).HTMLElement;
            delete (global as any).CustomEvent;
          }
        }
      }
    }
  });

  describe('Initialization and Lifecycle', () => {
    it('should create instance correctly', () => {
      expect(notificationManager).to.be.instanceOf(NotificationManager);
    });

    it('should initialize with zero notifications', () => {
      const stats = notificationManager.getStats();
      expect(stats.activeCount).to.equal(0);
      expect(stats.totalCreated).to.equal(0);
    });

    it('should dispose resources properly', () => {
      notificationManager.showNotificationInTerminal('Test', 'info');
      notificationManager.dispose();

      const stats = notificationManager.getStats();
      expect(stats.activeCount).to.equal(0);
      expect(stats.totalCreated).to.equal(0);
    });
  });

  describe('Notification Display', () => {
    it('should show info notification', () => {
      notificationManager.showNotificationInTerminal('Info message', 'info');

      const notifications = document.querySelectorAll('.notification-info');
      expect(notifications.length).to.be.at.least(1);
    });

    it('should show success notification', () => {
      notificationManager.showNotificationInTerminal('Success message', 'success');

      const notifications = document.querySelectorAll('.notification-success');
      expect(notifications.length).to.be.at.least(1);
    });

    it('should show warning notification', () => {
      notificationManager.showNotificationInTerminal('Warning message', 'warning');

      const notifications = document.querySelectorAll('.notification-warning');
      expect(notifications.length).to.be.at.least(1);
    });

    it('should show error notification', () => {
      notificationManager.showNotificationInTerminal('Error message', 'error');

      const notifications = document.querySelectorAll('.notification-error');
      expect(notifications.length).to.be.at.least(1);
    });

    it('should default to info type', () => {
      notificationManager.showNotificationInTerminal('Default message');

      const notifications = document.querySelectorAll('.notification-info');
      expect(notifications.length).to.be.at.least(1);
    });
  });

  describe('Notification Auto-Dismiss', () => {
    it('should auto-dismiss notification after default duration', () => {
      notificationManager.showNotificationInTerminal('Test message');

      // Before timeout
      let notifications = document.querySelectorAll('.notification');
      expect(notifications.length).to.be.at.least(1);

      // After timeout (3000ms + 200ms animation)
      clock.tick(3200);

      notifications = document.querySelectorAll('.notification');
      expect(notifications.length).to.equal(0);
    });
  });

  describe('Specific Error Notifications', () => {
    it('should show terminal kill error', () => {
      notificationManager.showTerminalKillError('Process terminated');

      const notifications = document.querySelectorAll('.notification-error');
      expect(notifications.length).to.be.at.least(1);
    });

    it('should show terminal close error with count', () => {
      notificationManager.showTerminalCloseError(1);

      const notifications = document.querySelectorAll('.notification-warning');
      expect(notifications.length).to.be.at.least(1);
    });

    it('should pluralize terminal count correctly', () => {
      notificationManager.showTerminalCloseError(2);

      const notification = document.querySelector('.notification');
      expect(notification?.textContent).to.include('terminals');
    });

    it('should not pluralize for single terminal', () => {
      notificationManager.showTerminalCloseError(1);

      const notification = document.querySelector('.notification');
      expect(notification?.textContent).to.include('terminal');
      expect(notification?.textContent).to.not.include('terminals');
    });
  });

  describe('Alt+Click Feedback', () => {
    it('should show Alt+Click feedback at position', () => {
      notificationManager.showAltClickFeedback(100, 200);

      const feedback = document.querySelector('.alt-click-feedback');
      expect(feedback).to.exist;
      expect((feedback as HTMLElement).style.left).to.equal('100px');
      expect((feedback as HTMLElement).style.top).to.equal('200px');
    });

    it('should remove Alt+Click feedback after animation', () => {
      notificationManager.showAltClickFeedback(100, 200);

      // Before animation completes
      let feedback = document.querySelector('.alt-click-feedback');
      expect(feedback).to.exist;

      // After animation (600ms)
      clock.tick(600);

      feedback = document.querySelector('.alt-click-feedback');
      expect(feedback).to.be.null;
    });
  });

  describe('Warning Management', () => {
    it('should show warning notification', () => {
      notificationManager.showWarning('Warning message');

      const warnings = document.querySelectorAll('.notification-warning');
      expect(warnings.length).to.be.at.least(1);
    });

    it('should clear all warnings', () => {
      notificationManager.showWarning('Warning 1');
      notificationManager.showWarning('Warning 2');

      notificationManager.clearWarnings();

      const warnings = document.querySelectorAll('.notification-warning');
      expect(warnings.length).to.equal(0);
    });
  });

  describe('Clear All Notifications', () => {
    it('should clear all notifications', () => {
      notificationManager.showNotificationInTerminal('Info', 'info');
      notificationManager.showWarning('Warning');
      notificationManager.showAltClickFeedback(50, 50);

      notificationManager.clearNotifications();

      const notifications = document.querySelectorAll('.notification, .alt-click-feedback');
      expect(notifications.length).to.equal(0);
    });
  });

  describe('Loading Notifications', () => {
    it('should show loading notification', () => {
      const id = notificationManager.showLoading('Loading...');

      expect(id).to.be.a('string');
      expect(id).to.include('loading-');

      const loading = document.querySelector('.loading-notification');
      expect(loading).to.exist;
    });

    it('should show loading spinner', () => {
      notificationManager.showLoading('Processing...');

      const spinner = document.querySelector('.loading-spinner');
      expect(spinner).to.exist;
    });

    it('should hide loading notification by id', () => {
      const id = notificationManager.showLoading('Loading...');
      expect(document.querySelector('.loading-notification')).to.exist;

      notificationManager.hideLoading(id);

      // Wait for animation
      clock.tick(200);

      expect(document.querySelector('.loading-notification')).to.be.null;
    });

    it('should persist loading notification until hidden', () => {
      const id = notificationManager.showLoading();

      // Wait longer than normal auto-dismiss
      clock.tick(5000);

      // Should still exist
      const loading = document.querySelector('.loading-notification');
      expect(loading).to.exist;

      // Clean up
      notificationManager.hideLoading(id);
    });
  });

  describe('Toast Notifications', () => {
    it('should show toast notification', () => {
      notificationManager.showToast('Toast message');

      const toast = document.querySelector('.toast-notification');
      expect(toast).to.exist;
    });

    it('should show toast with custom type', () => {
      notificationManager.showToast('Success!', 'success');

      const toast = document.querySelector('.toast-notification.notification-success');
      expect(toast).to.exist;
    });

    it('should show toast with custom duration', () => {
      notificationManager.showToast('Quick toast', 'info', 1000);

      // Before dismiss
      expect(document.querySelector('.toast-notification')).to.exist;

      // After dismiss (1000ms + 200ms animation)
      clock.tick(1200);

      expect(document.querySelector('.toast-notification')).to.be.null;
    });
  });

  describe('Notification Styles', () => {
    it('should setup notification styles', () => {
      notificationManager.setupNotificationStyles();

      const styles = document.querySelector('style');
      expect(styles).to.exist;
      expect(styles?.textContent).to.include('@keyframes');
    });

    it('should include all required animations', () => {
      notificationManager.setupNotificationStyles();

      const styles = document.querySelector('style');
      const content = styles?.textContent || '';

      expect(content).to.include('subtleSlideIn');
      expect(content).to.include('subtleSlideOut');
      expect(content).to.include('altClickFade');
      expect(content).to.include('spin');
    });
  });

  describe('Statistics', () => {
    it('should track notification count', () => {
      notificationManager.showNotificationInTerminal('Test 1');
      notificationManager.showNotificationInTerminal('Test 2');
      notificationManager.showNotificationInTerminal('Test 3');

      const stats = notificationManager.getStats();
      expect(stats.totalCreated).to.be.at.least(3);
    });

    it('should track active notifications', () => {
      const id = notificationManager.showLoading('Loading...');

      const stats = notificationManager.getStats();
      expect(stats.activeCount).to.be.at.least(1);

      notificationManager.hideLoading(id);
      clock.tick(200);

      const newStats = notificationManager.getStats();
      expect(newStats.activeCount).to.be.lessThan(stats.activeCount);
    });
  });

  describe('Notification Position', () => {
    it('should position notification at top', () => {
      notificationManager.showNotificationInTerminal('Top message');

      const notification = document.querySelector('.notification') as HTMLElement;
      expect(notification.style.cssText).to.include('top');
    });
  });

  describe('Notification Background Colors', () => {
    it('should use correct color for info', () => {
      notificationManager.showNotificationInTerminal('Info', 'info');

      const notification = document.querySelector('.notification-info') as HTMLElement;
      expect(notification.style.background).to.include('rgba');
    });

    it('should use correct color for success', () => {
      notificationManager.showNotificationInTerminal('Success', 'success');

      const notification = document.querySelector('.notification-success') as HTMLElement;
      expect(notification.style.background).to.include('rgba');
    });

    it('should use correct color for warning', () => {
      notificationManager.showNotificationInTerminal('Warning', 'warning');

      const notification = document.querySelector('.notification-warning') as HTMLElement;
      expect(notification.style.background).to.include('rgba');
    });

    it('should use correct color for error', () => {
      notificationManager.showNotificationInTerminal('Error', 'error');

      const notification = document.querySelector('.notification-error') as HTMLElement;
      expect(notification.style.background).to.include('rgba');
    });
  });

  describe('XSS Prevention', () => {
    it('should escape HTML in notification message', () => {
      const maliciousMessage = '<script>alert("xss")</script>';
      notificationManager.showNotificationInTerminal(maliciousMessage);

      const notification = document.querySelector('.notification');
      // Should display as text, not execute
      expect(notification?.textContent).to.include('<script>');
      expect(document.querySelectorAll('script').length).to.equal(0);
    });

    it('should escape HTML in loading message', () => {
      const maliciousMessage = '<img src="x" onerror="alert(1)">';
      notificationManager.showLoading(maliciousMessage);

      const loadingSpan = document.querySelector('.loading-notification span');
      expect(loadingSpan?.textContent).to.include('<img');
    });
  });
});
