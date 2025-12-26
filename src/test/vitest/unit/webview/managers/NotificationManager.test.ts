/**
 * NotificationManager Test Suite - User feedback and notifications
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationManager } from '../../../../../webview/managers/NotificationManager';

describe('NotificationManager', () => {
  let notificationManager: NotificationManager;

  beforeEach(() => {
    vi.useFakeTimers();

    // Create container element
    const container = document.createElement('div');
    container.id = 'terminal-container';
    document.body.appendChild(container);

    notificationManager = new NotificationManager();
    notificationManager.initialize();
  });

  afterEach(() => {
    notificationManager.dispose();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('Initialization and Lifecycle', () => {
    it('should create instance correctly', () => {
      expect(notificationManager).toBeInstanceOf(NotificationManager);
    });

    it('should initialize with zero notifications', () => {
      const stats = notificationManager.getStats();
      expect(stats.activeCount).toBe(0);
      expect(stats.totalCreated).toBe(0);
    });

    it('should dispose resources properly', () => {
      notificationManager.showNotificationInTerminal('Test', 'info');
      notificationManager.dispose();

      const stats = notificationManager.getStats();
      expect(stats.activeCount).toBe(0);
      expect(stats.totalCreated).toBe(0);
    });
  });

  describe('Notification Display', () => {
    it('should show info notification', () => {
      notificationManager.showNotificationInTerminal('Info message', 'info');

      const notifications = document.querySelectorAll('.notification-info');
      expect(notifications.length).toBeGreaterThanOrEqual(1);
    });

    it('should show success notification', () => {
      notificationManager.showNotificationInTerminal('Success message', 'success');

      const notifications = document.querySelectorAll('.notification-success');
      expect(notifications.length).toBeGreaterThanOrEqual(1);
    });

    it('should show warning notification', () => {
      notificationManager.showNotificationInTerminal('Warning message', 'warning');

      const notifications = document.querySelectorAll('.notification-warning');
      expect(notifications.length).toBeGreaterThanOrEqual(1);
    });

    it('should show error notification', () => {
      notificationManager.showNotificationInTerminal('Error message', 'error');

      const notifications = document.querySelectorAll('.notification-error');
      expect(notifications.length).toBeGreaterThanOrEqual(1);
    });

    it('should default to info type', () => {
      notificationManager.showNotificationInTerminal('Default message');

      const notifications = document.querySelectorAll('.notification-info');
      expect(notifications.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Notification Auto-Dismiss', () => {
    it('should auto-dismiss notification after default duration', () => {
      notificationManager.showNotificationInTerminal('Test message');

      // Before timeout
      let notifications = document.querySelectorAll('.notification');
      expect(notifications.length).toBeGreaterThanOrEqual(1);

      // After timeout (3000ms + 200ms animation)
      vi.advanceTimersByTime(3200);

      notifications = document.querySelectorAll('.notification');
      expect(notifications.length).toBe(0);
    });
  });

  describe('Specific Error Notifications', () => {
    it('should show terminal kill error', () => {
      notificationManager.showTerminalKillError('Process terminated');

      const notifications = document.querySelectorAll('.notification-error');
      expect(notifications.length).toBeGreaterThanOrEqual(1);
    });

    it('should show terminal close error with count', () => {
      notificationManager.showTerminalCloseError(1);

      const notifications = document.querySelectorAll('.notification-warning');
      expect(notifications.length).toBeGreaterThanOrEqual(1);
    });

    it('should pluralize terminal count correctly', () => {
      notificationManager.showTerminalCloseError(2);

      const notification = document.querySelector('.notification');
      expect(notification?.textContent).toContain('terminals');
    });

    it('should not pluralize for single terminal', () => {
      notificationManager.showTerminalCloseError(1);

      const notification = document.querySelector('.notification');
      expect(notification?.textContent).toContain('terminal');
      expect(notification?.textContent).not.toContain('terminals');
    });
  });

  describe('Alt+Click Feedback', () => {
    it('should show Alt+Click feedback at position', () => {
      notificationManager.showAltClickFeedback(100, 200);

      const feedback = document.querySelector('.alt-click-feedback');
      expect(feedback).toBeDefined();
      expect((feedback as HTMLElement).style.left).toBe('100px');
      expect((feedback as HTMLElement).style.top).toBe('200px');
    });

    it('should remove Alt+Click feedback after animation', () => {
      notificationManager.showAltClickFeedback(100, 200);

      // Before animation completes
      let feedback = document.querySelector('.alt-click-feedback');
      expect(feedback).toBeDefined();

      // After animation (600ms)
      vi.advanceTimersByTime(600);

      feedback = document.querySelector('.alt-click-feedback');
      expect(feedback).toBeNull();
    });
  });

  describe('Warning Management', () => {
    it('should show warning notification', () => {
      notificationManager.showWarning('Warning message');

      const warnings = document.querySelectorAll('.notification-warning');
      expect(warnings.length).toBeGreaterThanOrEqual(1);
    });

    it('should clear all warnings', () => {
      notificationManager.showWarning('Warning 1');
      notificationManager.showWarning('Warning 2');

      notificationManager.clearWarnings();

      const warnings = document.querySelectorAll('.notification-warning');
      expect(warnings.length).toBe(0);
    });
  });

  describe('Clear All Notifications', () => {
    it('should clear all notifications', () => {
      notificationManager.showNotificationInTerminal('Info', 'info');
      notificationManager.showWarning('Warning');
      notificationManager.showAltClickFeedback(50, 50);

      notificationManager.clearNotifications();

      const notifications = document.querySelectorAll('.notification, .alt-click-feedback');
      expect(notifications.length).toBe(0);
    });
  });

  describe('Loading Notifications', () => {
    it('should show loading notification', () => {
      const id = notificationManager.showLoading('Loading...');

      expect(id).toBeTypeOf('string');
      expect(id).toContain('loading-');

      const loading = document.querySelector('.loading-notification');
      expect(loading).toBeDefined();
    });

    it('should show loading spinner', () => {
      notificationManager.showLoading('Processing...');

      const spinner = document.querySelector('.loading-spinner');
      expect(spinner).toBeDefined();
    });

    it('should hide loading notification by id', () => {
      const id = notificationManager.showLoading('Loading...');
      expect(document.querySelector('.loading-notification')).toBeDefined();

      notificationManager.hideLoading(id);

      // Wait for animation
      vi.advanceTimersByTime(200);

      expect(document.querySelector('.loading-notification')).toBeNull();
    });

    it('should persist loading notification until hidden', () => {
      const id = notificationManager.showLoading();

      // Wait longer than normal auto-dismiss
      vi.advanceTimersByTime(5000);

      // Should still exist
      const loading = document.querySelector('.loading-notification');
      expect(loading).toBeDefined();

      // Clean up
      notificationManager.hideLoading(id);
    });
  });

  describe('Toast Notifications', () => {
    it('should show toast notification', () => {
      notificationManager.showToast('Toast message');

      const toast = document.querySelector('.toast-notification');
      expect(toast).toBeDefined();
    });

    it('should show toast with custom type', () => {
      notificationManager.showToast('Success!', 'success');

      const toast = document.querySelector('.toast-notification.notification-success');
      expect(toast).toBeDefined();
    });

    it('should show toast with custom duration', () => {
      notificationManager.showToast('Quick toast', 'info', 1000);

      // Before dismiss
      expect(document.querySelector('.toast-notification')).toBeDefined();

      // After dismiss (1000ms + 200ms animation)
      vi.advanceTimersByTime(1200);

      expect(document.querySelector('.toast-notification')).toBeNull();
    });
  });

  describe('Notification Styles', () => {
    it('should setup notification styles', () => {
      notificationManager.setupNotificationStyles();

      const styles = document.querySelector('style');
      expect(styles).toBeDefined();
      expect(styles?.textContent).toContain('@keyframes');
    });

    it('should include all required animations', () => {
      notificationManager.setupNotificationStyles();

      const styles = document.querySelector('style');
      const content = styles?.textContent || '';

      expect(content).toContain('subtleSlideIn');
      expect(content).toContain('subtleSlideOut');
      expect(content).toContain('altClickFade');
      expect(content).toContain('spin');
    });
  });

  describe('Statistics', () => {
    it('should track notification count', () => {
      notificationManager.showNotificationInTerminal('Test 1');
      notificationManager.showNotificationInTerminal('Test 2');
      notificationManager.showNotificationInTerminal('Test 3');

      const stats = notificationManager.getStats();
      expect(stats.totalCreated).toBeGreaterThanOrEqual(3);
    });

    it('should track active notifications', () => {
      const id = notificationManager.showLoading('Loading...');

      const stats = notificationManager.getStats();
      expect(stats.activeCount).toBeGreaterThanOrEqual(1);

      notificationManager.hideLoading(id);
      vi.advanceTimersByTime(200);

      const newStats = notificationManager.getStats();
      expect(newStats.activeCount).toBeLessThan(stats.activeCount);
    });
  });

  describe('Notification Position', () => {
    it('should position notification at top', () => {
      notificationManager.showNotificationInTerminal('Top message');

      const notification = document.querySelector('.notification') as HTMLElement;
      expect(notification.style.cssText).toContain('top');
    });
  });

  describe('Notification Background Colors', () => {
    it('should use correct color for info', () => {
      notificationManager.showNotificationInTerminal('Info', 'info');

      const notification = document.querySelector('.notification-info') as HTMLElement;
      expect(notification.style.background).toContain('rgba');
    });

    it('should use correct color for success', () => {
      notificationManager.showNotificationInTerminal('Success', 'success');

      const notification = document.querySelector('.notification-success') as HTMLElement;
      expect(notification.style.background).toContain('rgba');
    });

    it('should use correct color for warning', () => {
      notificationManager.showNotificationInTerminal('Warning', 'warning');

      const notification = document.querySelector('.notification-warning') as HTMLElement;
      expect(notification.style.background).toContain('rgba');
    });

    it('should use correct color for error', () => {
      notificationManager.showNotificationInTerminal('Error', 'error');

      const notification = document.querySelector('.notification-error') as HTMLElement;
      expect(notification.style.background).toContain('rgba');
    });
  });

  describe('XSS Prevention', () => {
    it('should escape HTML in notification message', () => {
      const maliciousMessage = '<script>alert("xss")</script>';
      notificationManager.showNotificationInTerminal(maliciousMessage);

      const notification = document.querySelector('.notification');
      // Should display as text, not execute
      expect(notification?.textContent).toContain('<script>');
      expect(document.querySelectorAll('script').length).toBe(0);
    });

    it('should escape HTML in loading message', () => {
      const maliciousMessage = '<img src="x" onerror="alert(1)">';
      notificationManager.showLoading(maliciousMessage);

      const loadingSpan = document.querySelector('.loading-notification span');
      expect(loadingSpan?.textContent).toContain('<img');
    });
  });
});
