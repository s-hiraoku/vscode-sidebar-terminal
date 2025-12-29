/**
 * NotificationSystem Unit Tests
 *
 * Tests for unified notification system including:
 * - Singleton pattern
 * - Observer/Publisher-Subscriber pattern
 * - Notification lifecycle (create, remove, clear)
 * - Filtering capabilities
 * - Legacy system fallback
 * - Statistics and monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  NotificationSystem,
  NotificationObserver,
  NotificationData,
  NotificationFilter,
  createNotificationSystem,
  enableUnifiedNotifications,
  disableUnifiedNotifications,
  enableFallbackMode,
  disableFallbackMode,
} from '../../../../../webview/core/NotificationSystem';

describe('NotificationSystem', () => {
  let system: NotificationSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset singleton for each test
    (NotificationSystem as any)._instance = null;
    system = NotificationSystem.getInstance();
    system.setEnabled(true);
    system.setFallbackMode(false);
  });

  afterEach(() => {
    system.clearAll();
    (NotificationSystem as any)._instance = null;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = NotificationSystem.getInstance();
      const instance2 = NotificationSystem.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create instance via createNotificationSystem helper', () => {
      const instance = createNotificationSystem();

      expect(instance).toBe(system);
    });
  });

  describe('Feature Flags', () => {
    it('should be disabled by default', () => {
      (NotificationSystem as any)._instance = null;
      const newSystem = NotificationSystem.getInstance();

      expect(newSystem.isEnabled()).toBe(false);
    });

    it('should enable notifications', () => {
      system.setEnabled(true);

      expect(system.isEnabled()).toBe(true);
    });

    it('should disable notifications', () => {
      system.setEnabled(true);
      system.setEnabled(false);

      expect(system.isEnabled()).toBe(false);
    });
  });

  describe('Helper Functions', () => {
    it('should enable unified notifications via helper', () => {
      system.setEnabled(false);
      enableUnifiedNotifications();

      expect(system.isEnabled()).toBe(true);
    });

    it('should disable unified notifications via helper', () => {
      system.setEnabled(true);
      disableUnifiedNotifications();

      expect(system.isEnabled()).toBe(false);
    });

    it('should enable fallback mode via helper', () => {
      system.setFallbackMode(false);
      enableFallbackMode();

      // Verify by checking legacy call when notify is used
      const mockLegacyShow = vi.fn();
      (globalThis as any).showNotification = mockLegacyShow;

      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      expect(mockLegacyShow).toHaveBeenCalled();

      delete (globalThis as any).showNotification;
    });

    it('should disable fallback mode via helper', () => {
      system.setFallbackMode(true);
      disableFallbackMode();

      const mockLegacyShow = vi.fn();
      (globalThis as any).showNotification = mockLegacyShow;

      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      expect(mockLegacyShow).not.toHaveBeenCalled();

      delete (globalThis as any).showNotification;
    });
  });

  describe('notify', () => {
    it('should create notification with generated id', () => {
      const id = system.notify({
        type: 'info',
        title: 'Test Title',
        message: 'Test message',
      });

      expect(id).toMatch(/^notification_\d+_/);
    });

    it('should store notification when enabled', () => {
      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      const notifications = system.getActiveNotifications();
      expect(notifications).toHaveLength(1);
    });

    it('should not store notification when disabled', () => {
      system.setEnabled(false);

      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      const notifications = system.getActiveNotifications();
      expect(notifications).toHaveLength(0);
    });

    it('should use default duration of 4000ms when not specified', () => {
      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      const notifications = system.getActiveNotifications();
      expect(notifications[0].duration).toBe(4000);
    });

    it('should use custom duration when specified', () => {
      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
        duration: 6000,
      });

      const notifications = system.getActiveNotifications();
      expect(notifications[0].duration).toBe(6000);
    });

    it('should set notification type correctly', () => {
      const types: Array<'error' | 'warning' | 'info' | 'success'> = [
        'error',
        'warning',
        'info',
        'success',
      ];

      types.forEach((type) => {
        system.notify({
          type,
          title: 'Test',
          message: 'Test message',
        });
      });

      const notifications = system.getActiveNotifications();
      expect(notifications.map((n) => n.type)).toEqual(types);
    });

    it('should set source to "unknown" when not specified', () => {
      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      const notifications = system.getActiveNotifications();
      expect(notifications[0].source).toBe('unknown');
    });

    it('should use custom source when specified', () => {
      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
        source: 'test-source',
      });

      const notifications = system.getActiveNotifications();
      expect(notifications[0].source).toBe('test-source');
    });

    it('should auto-remove notification after duration', () => {
      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
        duration: 3000,
      });

      expect(system.getActiveNotifications()).toHaveLength(1);

      vi.advanceTimersByTime(3000);

      expect(system.getActiveNotifications()).toHaveLength(0);
    });

    it('should use default duration when duration is 0 (falsy)', () => {
      // duration: 0 is falsy, so || 4000 applies default duration
      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
        duration: 0,
      });

      const notifications = system.getActiveNotifications();
      expect(notifications[0].duration).toBe(4000);

      // Notification should be auto-removed after default duration
      vi.advanceTimersByTime(4000);

      expect(system.getActiveNotifications()).toHaveLength(0);
    });
  });

  describe('Observer Pattern', () => {
    it('should subscribe observer', () => {
      const observer: NotificationObserver = {
        onNotification: vi.fn(),
      };

      system.subscribe(observer);
      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      expect(observer.onNotification).toHaveBeenCalled();
    });

    it('should unsubscribe observer', () => {
      const observer: NotificationObserver = {
        onNotification: vi.fn(),
      };

      system.subscribe(observer);
      system.unsubscribe(observer);
      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      expect(observer.onNotification).not.toHaveBeenCalled();
    });

    it('should notify multiple observers', () => {
      const observer1: NotificationObserver = {
        onNotification: vi.fn(),
      };
      const observer2: NotificationObserver = {
        onNotification: vi.fn(),
      };

      system.subscribe(observer1);
      system.subscribe(observer2);
      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      expect(observer1.onNotification).toHaveBeenCalled();
      expect(observer2.onNotification).toHaveBeenCalled();
    });

    it('should notify observer on notification removal', () => {
      const observer: NotificationObserver = {
        onNotification: vi.fn(),
        onNotificationRemoved: vi.fn(),
      };

      system.subscribe(observer);
      const id = system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      system.removeNotification(id);

      expect(observer.onNotificationRemoved).toHaveBeenCalledWith(id);
    });

    it('should handle observer errors gracefully', () => {
      const observer: NotificationObserver = {
        onNotification: vi.fn().mockImplementation(() => {
          throw new Error('Observer error');
        }),
      };

      system.subscribe(observer);

      expect(() => {
        system.notify({
          type: 'info',
          title: 'Test',
          message: 'Test message',
        });
      }).not.toThrow();
    });

    it('should return filter id when subscribing with filter', () => {
      const observer: NotificationObserver = {
        onNotification: vi.fn(),
      };

      const filterId = system.subscribe(observer, { type: ['error'] });

      expect(filterId).toMatch(/^filter_\d+_/);
    });

    it('should return "default" when subscribing without filter', () => {
      const observer: NotificationObserver = {
        onNotification: vi.fn(),
      };

      const filterId = system.subscribe(observer);

      expect(filterId).toBe('default');
    });
  });

  describe('removeNotification', () => {
    it('should remove existing notification', () => {
      const id = system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      const result = system.removeNotification(id);

      expect(result).toBe(true);
      expect(system.getActiveNotifications()).toHaveLength(0);
    });

    it('should return false for non-existent notification', () => {
      const result = system.removeNotification('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should remove all notifications', () => {
      system.notify({ type: 'info', title: 'Test 1', message: 'Message 1' });
      system.notify({ type: 'warning', title: 'Test 2', message: 'Message 2' });
      system.notify({ type: 'error', title: 'Test 3', message: 'Message 3' });

      system.clearAll();

      expect(system.getActiveNotifications()).toHaveLength(0);
    });

    it('should notify observers of removal for each notification', () => {
      const observer: NotificationObserver = {
        onNotification: vi.fn(),
        onNotificationRemoved: vi.fn(),
      };

      system.subscribe(observer);
      system.notify({ type: 'info', title: 'Test 1', message: 'Message 1' });
      system.notify({ type: 'info', title: 'Test 2', message: 'Message 2' });

      system.clearAll();

      expect(observer.onNotificationRemoved).toHaveBeenCalledTimes(2);
    });
  });

  describe('getActiveNotifications', () => {
    it('should return all notifications without filter', () => {
      system.notify({ type: 'info', title: 'Test 1', message: 'Message 1' });
      system.notify({ type: 'error', title: 'Test 2', message: 'Message 2' });

      const notifications = system.getActiveNotifications();

      expect(notifications).toHaveLength(2);
    });

    it('should filter by type', () => {
      system.notify({ type: 'info', title: 'Test 1', message: 'Message 1' });
      system.notify({ type: 'error', title: 'Test 2', message: 'Message 2' });
      system.notify({ type: 'warning', title: 'Test 3', message: 'Message 3' });

      const filter: NotificationFilter = { type: ['error', 'warning'] };
      const notifications = system.getActiveNotifications(filter);

      expect(notifications).toHaveLength(2);
      expect(notifications.every((n) => n.type === 'error' || n.type === 'warning')).toBe(true);
    });

    it('should filter by source', () => {
      system.notify({
        type: 'info',
        title: 'Test 1',
        message: 'Message 1',
        source: 'source-a',
      });
      system.notify({
        type: 'info',
        title: 'Test 2',
        message: 'Message 2',
        source: 'source-b',
      });

      const filter: NotificationFilter = { source: ['source-a'] };
      const notifications = system.getActiveNotifications(filter);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].source).toBe('source-a');
    });

    it('should filter by maxAge', () => {
      system.notify({ type: 'info', title: 'Test 1', message: 'Message 1' });

      vi.advanceTimersByTime(5000);

      system.notify({ type: 'info', title: 'Test 2', message: 'Message 2' });

      const filter: NotificationFilter = { maxAge: 3000 };
      const notifications = system.getActiveNotifications(filter);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('Test 2');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      system.notify({
        type: 'info',
        title: 'Test 1',
        message: 'Message 1',
        source: 'source-a',
      });
      system.notify({
        type: 'error',
        title: 'Test 2',
        message: 'Message 2',
        source: 'source-a',
      });
      system.notify({
        type: 'info',
        title: 'Test 3',
        message: 'Message 3',
        source: 'source-b',
      });

      const observer: NotificationObserver = {
        onNotification: vi.fn(),
      };
      system.subscribe(observer);

      const stats = system.getStats();

      expect(stats.totalNotifications).toBe(3);
      expect(stats.activeObservers).toBe(1);
      expect(stats.byType.info).toBe(2);
      expect(stats.byType.error).toBe(1);
      expect(stats.bySource['source-a']).toBe(2);
      expect(stats.bySource['source-b']).toBe(1);
    });

    it('should return empty statistics when no notifications', () => {
      const stats = system.getStats();

      expect(stats.totalNotifications).toBe(0);
      expect(stats.activeObservers).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.bySource).toEqual({});
    });
  });

  describe('Legacy Fallback', () => {
    it('should call legacy system when fallback mode is enabled', () => {
      const mockLegacyShow = vi.fn();
      (globalThis as any).showNotification = mockLegacyShow;

      system.setFallbackMode(true);
      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      expect(mockLegacyShow).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'Test',
          message: 'Test message',
        })
      );

      delete (globalThis as any).showNotification;
    });

    it('should not call legacy system when fallback mode is disabled', () => {
      const mockLegacyShow = vi.fn();
      (globalThis as any).showNotification = mockLegacyShow;

      system.setFallbackMode(false);
      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      expect(mockLegacyShow).not.toHaveBeenCalled();

      delete (globalThis as any).showNotification;
    });

    it('should handle legacy system errors gracefully', () => {
      (globalThis as any).showNotification = vi.fn().mockImplementation(() => {
        throw new Error('Legacy error');
      });

      system.setFallbackMode(true);

      expect(() => {
        system.notify({
          type: 'info',
          title: 'Test',
          message: 'Test message',
        });
      }).not.toThrow();

      delete (globalThis as any).showNotification;
    });

    it('should handle missing legacy system gracefully', () => {
      delete (globalThis as any).showNotification;

      system.setFallbackMode(true);

      expect(() => {
        system.notify({
          type: 'info',
          title: 'Test',
          message: 'Test message',
        });
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle notification with icon', () => {
      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
        icon: '🔔',
      });

      const notifications = system.getActiveNotifications();
      expect(notifications[0].icon).toBe('🔔');
    });

    it('should set timestamp on notification', () => {
      const beforeTime = Date.now();

      system.notify({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      const notifications = system.getActiveNotifications();
      expect(notifications[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should handle rapid notifications', () => {
      for (let i = 0; i < 100; i++) {
        system.notify({
          type: 'info',
          title: `Test ${i}`,
          message: `Message ${i}`,
        });
      }

      expect(system.getActiveNotifications()).toHaveLength(100);
    });

    it('should generate unique notification IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 50; i++) {
        const id = system.notify({
          type: 'info',
          title: `Test ${i}`,
          message: `Message ${i}`,
        });
        ids.add(id);
      }

      expect(ids.size).toBe(50);
    });
  });
});

describe('Default Duration Constant', () => {
  let system: NotificationSystem;

  beforeEach(() => {
    (NotificationSystem as any)._instance = null;
    system = NotificationSystem.getInstance();
    system.setEnabled(true);
    system.setFallbackMode(false);
  });

  afterEach(() => {
    system.clearAll();
    (NotificationSystem as any)._instance = null;
  });

  it('should use 4000ms as default duration', () => {
    system.notify({
      type: 'info',
      title: 'Test',
      message: 'Test message',
    });

    const notifications = system.getActiveNotifications();
    expect(notifications[0].duration).toBe(4000);
  });
});
