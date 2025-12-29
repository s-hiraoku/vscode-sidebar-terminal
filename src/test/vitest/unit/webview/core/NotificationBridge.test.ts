/**
 * NotificationBridge Unit Tests
 *
 * Tests for notification bridge functionality including:
 * - Singleton instance management
 * - Migration mode switching (legacy/hybrid/unified)
 * - Notification display methods
 * - Legacy system compatibility
 * - Specialized notification helpers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  NotificationBridge,
  getNotificationBridge,
  enableHybridNotifications,
  enableUnifiedNotificationsOnly,
  revertToLegacyNotifications,
} from '../../../../../webview/core/NotificationBridge';

// Mock NotificationSystem
const mockNotificationSystem = {
  getInstance: vi.fn(),
  notify: vi.fn().mockReturnValue('notification-id'),
  setEnabled: vi.fn(),
  setFallbackMode: vi.fn(),
  clearAll: vi.fn(),
  isEnabled: vi.fn().mockReturnValue(false),
  getStats: vi.fn().mockReturnValue({
    totalNotifications: 0,
    activeNotifications: 0,
    filteredNotifications: 0,
  }),
};

vi.mock('../../../../../webview/core/NotificationSystem', () => ({
  NotificationSystem: {
    getInstance: () => mockNotificationSystem,
  },
}));

describe('NotificationBridge', () => {
  let bridge: NotificationBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton for each test
    (NotificationBridge as any)._instance = null;
    bridge = NotificationBridge.getInstance();
  });

  afterEach(() => {
    // Clean up singleton
    (NotificationBridge as any)._instance = null;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = NotificationBridge.getInstance();
      const instance2 = NotificationBridge.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create instance via getNotificationBridge helper', () => {
      const instance = getNotificationBridge();

      expect(instance).toBe(bridge);
    });
  });

  describe('Migration Mode', () => {
    it('should default to legacy mode', () => {
      expect(bridge.getMigrationMode()).toBe('legacy');
    });

    it('should switch to legacy mode', () => {
      bridge.setMigrationMode('legacy');

      expect(bridge.getMigrationMode()).toBe('legacy');
      expect(mockNotificationSystem.setEnabled).toHaveBeenCalledWith(false);
      expect(mockNotificationSystem.setFallbackMode).toHaveBeenCalledWith(true);
    });

    it('should switch to hybrid mode', () => {
      bridge.setMigrationMode('hybrid');

      expect(bridge.getMigrationMode()).toBe('hybrid');
      expect(mockNotificationSystem.setEnabled).toHaveBeenCalledWith(true);
      expect(mockNotificationSystem.setFallbackMode).toHaveBeenCalledWith(true);
    });

    it('should switch to unified mode', () => {
      bridge.setMigrationMode('unified');

      expect(bridge.getMigrationMode()).toBe('unified');
      expect(mockNotificationSystem.setEnabled).toHaveBeenCalledWith(true);
      expect(mockNotificationSystem.setFallbackMode).toHaveBeenCalledWith(false);
    });
  });

  describe('Helper Functions', () => {
    it('should enable hybrid notifications', () => {
      enableHybridNotifications();

      expect(bridge.getMigrationMode()).toBe('hybrid');
    });

    it('should enable unified notifications only', () => {
      enableUnifiedNotificationsOnly();

      expect(bridge.getMigrationMode()).toBe('unified');
    });

    it('should revert to legacy notifications', () => {
      bridge.setMigrationMode('unified');
      revertToLegacyNotifications();

      expect(bridge.getMigrationMode()).toBe('legacy');
    });
  });

  describe('showNotification', () => {
    it('should call legacy system in legacy mode', () => {
      const mockLegacyShow = vi.fn();
      (globalThis as any).showNotification = mockLegacyShow;

      bridge.setMigrationMode('legacy');
      bridge.showNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      expect(mockLegacyShow).toHaveBeenCalled();
      expect(mockNotificationSystem.notify).not.toHaveBeenCalled();

      delete (globalThis as any).showNotification;
    });

    it('should call both systems in hybrid mode', () => {
      const mockLegacyShow = vi.fn();
      (globalThis as any).showNotification = mockLegacyShow;

      bridge.setMigrationMode('hybrid');
      const result = bridge.showNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      expect(mockLegacyShow).toHaveBeenCalled();
      expect(mockNotificationSystem.notify).toHaveBeenCalled();
      expect(result).toBe('notification-id');

      delete (globalThis as any).showNotification;
    });

    it('should call only unified system in unified mode', () => {
      const mockLegacyShow = vi.fn();
      (globalThis as any).showNotification = mockLegacyShow;

      bridge.setMigrationMode('unified');
      const result = bridge.showNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      expect(mockLegacyShow).not.toHaveBeenCalled();
      expect(mockNotificationSystem.notify).toHaveBeenCalled();
      expect(result).toBe('notification-id');

      delete (globalThis as any).showNotification;
    });
  });

  describe('Specialized Notification Methods', () => {
    beforeEach(() => {
      bridge.setMigrationMode('unified');
    });

    it('should show terminal close error', () => {
      bridge.showTerminalCloseError(1);

      expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          title: 'Cannot close terminal',
          message: 'Must keep at least 1 terminal open',
          icon: '⚠️',
        })
      );
    });

    it('should show terminal close error with plural', () => {
      bridge.showTerminalCloseError(2);

      expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Must keep at least 2 terminals open',
        })
      );
    });

    it('should show terminal kill error', () => {
      bridge.showTerminalKillError('Process not found');

      expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Terminal kill failed',
          message: 'Process not found',
          icon: '❌',
        })
      );
    });

    it('should show split limit warning', () => {
      bridge.showSplitLimitWarning('Maximum 5 terminals allowed');

      expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          title: 'Split Limit Reached',
          message: 'Maximum 5 terminals allowed',
          icon: '⚠️',
        })
      );
    });

    it('should show CLI agent detected notification', () => {
      bridge.showCliAgentDetected();

      expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'CLI Agent Detected',
          icon: '🤖',
          duration: 6000,
        })
      );
    });

    it('should show CLI agent ended notification', () => {
      bridge.showCliAgentEnded();

      expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: 'CLI Agent Session Ended',
          icon: '✅',
          duration: 3000,
        })
      );
    });

    it('should show Alt+Click disabled warning', () => {
      bridge.showAltClickDisabledWarning('Test reason');

      expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          title: 'Alt+Click Disabled',
          message: 'Test reason',
          icon: '🚫',
          duration: 4000,
        })
      );
    });

    it('should show Alt+Click disabled warning with default message', () => {
      bridge.showAltClickDisabledWarning();

      expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Alt+Click cursor positioning is currently disabled',
        })
      );
    });

    it('should show Alt+Click setting error', () => {
      bridge.showAltClickSettingError();

      expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          title: 'Alt+Click Configuration',
          icon: '⚙️',
          duration: 6000,
        })
      );
    });

    it('should show terminal interaction issue', () => {
      bridge.showTerminalInteractionIssue('Connection lost');

      expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          title: 'Terminal Interaction Issue',
          message: 'Connection lost',
          icon: '⚡',
          duration: 5000,
        })
      );
    });
  });

  describe('clearAllNotifications', () => {
    it('should clear only unified system in unified mode', () => {
      const mockLegacyClear = vi.fn();
      (globalThis as any).clearAllNotifications = mockLegacyClear;

      bridge.setMigrationMode('unified');
      bridge.clearAllNotifications();

      expect(mockNotificationSystem.clearAll).toHaveBeenCalled();
      expect(mockLegacyClear).not.toHaveBeenCalled();

      delete (globalThis as any).clearAllNotifications;
    });

    it('should clear only legacy system in legacy mode', () => {
      const mockLegacyShow = vi.fn();
      const mockLegacyClear = vi.fn();
      (globalThis as any).showNotification = mockLegacyShow;
      (globalThis as any).clearAllNotifications = mockLegacyClear;

      bridge.setMigrationMode('legacy');
      bridge.clearAllNotifications();

      expect(mockNotificationSystem.clearAll).not.toHaveBeenCalled();
      expect(mockLegacyClear).toHaveBeenCalled();

      delete (globalThis as any).showNotification;
      delete (globalThis as any).clearAllNotifications;
    });

    it('should clear both systems in hybrid mode', () => {
      const mockLegacyShow = vi.fn();
      const mockLegacyClear = vi.fn();
      (globalThis as any).showNotification = mockLegacyShow;
      (globalThis as any).clearAllNotifications = mockLegacyClear;

      bridge.setMigrationMode('hybrid');
      bridge.clearAllNotifications();

      expect(mockNotificationSystem.clearAll).toHaveBeenCalled();
      expect(mockLegacyClear).toHaveBeenCalled();

      delete (globalThis as any).showNotification;
      delete (globalThis as any).clearAllNotifications;
    });
  });

  describe('getMigrationStats', () => {
    it('should return migration statistics', () => {
      mockNotificationSystem.isEnabled.mockReturnValue(true);

      bridge.setMigrationMode('hybrid');
      const stats = bridge.getMigrationStats();

      expect(stats).toEqual({
        mode: 'hybrid',
        unifiedSystemActive: true,
        legacySystemAvailable: false, // No global function defined
        unifiedStats: expect.any(Object),
      });
    });

    it('should detect legacy system availability', () => {
      (globalThis as any).showNotification = vi.fn();

      const stats = bridge.getMigrationStats();

      expect(stats.legacySystemAvailable).toBe(true);

      delete (globalThis as any).showNotification;
    });
  });

  describe('Error Handling', () => {
    it('should handle legacy show notification errors gracefully', () => {
      (globalThis as any).showNotification = vi.fn().mockImplementation(() => {
        throw new Error('Legacy error');
      });

      bridge.setMigrationMode('legacy');

      expect(() => {
        bridge.showNotification({ type: 'info', title: 'Test', message: 'Test' });
      }).not.toThrow();

      delete (globalThis as any).showNotification;
    });

    it('should handle legacy clear all errors gracefully', () => {
      (globalThis as any).clearAllNotifications = vi.fn().mockImplementation(() => {
        throw new Error('Legacy error');
      });

      bridge.setMigrationMode('legacy');

      expect(() => {
        bridge.clearAllNotifications();
      }).not.toThrow();

      delete (globalThis as any).clearAllNotifications;
    });

    it('should handle missing legacy system gracefully', () => {
      // Ensure no global functions
      delete (globalThis as any).showNotification;
      delete (globalThis as any).clearAllNotifications;

      bridge.setMigrationMode('legacy');

      expect(() => {
        bridge.showNotification({ type: 'info', title: 'Test', message: 'Test' });
        bridge.clearAllNotifications();
      }).not.toThrow();
    });
  });

  describe('Source Detection', () => {
    it('should include source in unified mode notifications', () => {
      bridge.setMigrationMode('unified');
      bridge.showNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          source: expect.any(String),
        })
      );
    });
  });
});

describe('Notification Duration Constants', () => {
  let bridge: NotificationBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    (NotificationBridge as any)._instance = null;
    bridge = NotificationBridge.getInstance();
    bridge.setMigrationMode('unified');
  });

  afterEach(() => {
    (NotificationBridge as any)._instance = null;
  });

  it('should use 6000ms for CLI agent detected', () => {
    bridge.showCliAgentDetected();

    expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 6000 })
    );
  });

  it('should use 3000ms for CLI agent ended', () => {
    bridge.showCliAgentEnded();

    expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 3000 })
    );
  });

  it('should use 4000ms for Alt+Click disabled', () => {
    bridge.showAltClickDisabledWarning();

    expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 4000 })
    );
  });

  it('should use 6000ms for Alt+Click setting error', () => {
    bridge.showAltClickSettingError();

    expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 6000 })
    );
  });

  it('should use 5000ms for terminal interaction issue', () => {
    bridge.showTerminalInteractionIssue('test');

    expect(mockNotificationSystem.notify).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 5000 })
    );
  });
});
