import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationCoordinator } from '../../../../services/NotificationCoordinator';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(true),
    }),
  },
  window: {
    setStatusBarMessage: vi.fn(),
  },
  env: {
    appName: 'Visual Studio Code',
  },
}));

describe('NotificationCoordinator', () => {
  let coordinator: NotificationCoordinator;
  let mockToast: {
    showCompletedNotification: ReturnType<typeof vi.fn>;
    clearTerminal: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };
  let mockNative: {
    notifyCompleted: ReturnType<typeof vi.fn>;
    clearTerminal: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockToast = {
      showCompletedNotification: vi.fn(),
      clearTerminal: vi.fn(),
      dispose: vi.fn(),
    };
    mockNative = {
      notifyCompleted: vi.fn(),
      clearTerminal: vi.fn(),
      dispose: vi.fn(),
    };
    coordinator = new NotificationCoordinator(mockToast as any, mockNative as any);
  });

  afterEach(() => {
    coordinator.dispose();
  });

  describe('notifyCompleted', () => {
    it('should call toast and native for completion notification', () => {
      coordinator.notifyCompleted('terminal-1', 'claude');

      expect(mockToast.showCompletedNotification).toHaveBeenCalledWith('terminal-1', 'claude');
      expect(mockNative.notifyCompleted).toHaveBeenCalledWith(
        'terminal-1',
        'Sidebar Terminal',
        expect.stringContaining('Claude has completed')
      );
    });
    it('should use "CLI Agent" when agentType is null', () => {
      coordinator.notifyCompleted('terminal-1', null);

      expect(mockNative.notifyCompleted).toHaveBeenCalledWith(
        'terminal-1',
        'Sidebar Terminal',
        expect.stringContaining('CLI Agent has completed')
      );
    });

    it('should not call services after dispose', () => {
      coordinator.dispose();
      coordinator.notifyCompleted('terminal-1', 'claude');

      expect(mockToast.showCompletedNotification).not.toHaveBeenCalled();
      expect(mockNative.notifyCompleted).not.toHaveBeenCalled();
    });
  });

  describe('clearTerminal', () => {
    it('should clear all three services', () => {
      coordinator.clearTerminal('terminal-1');

      expect(mockToast.clearTerminal).toHaveBeenCalledWith('terminal-1');
      expect(mockNative.clearTerminal).toHaveBeenCalledWith('terminal-1');
    });

    it('should not call services after dispose', () => {
      coordinator.dispose();
      coordinator.clearTerminal('terminal-1');

      expect(mockToast.clearTerminal).not.toHaveBeenCalled();
      expect(mockNative.clearTerminal).not.toHaveBeenCalled();
    });
  });

  describe('error isolation', () => {
    it('should continue notifying other services if one throws', () => {
      mockToast.showCompletedNotification.mockImplementation(() => {
        throw new Error('toast failed');
      });

      coordinator.notifyCompleted('terminal-1', 'claude');

      expect(mockNative.notifyCompleted).toHaveBeenCalled();
    });

    it('should continue disposing other services if one throws', () => {
      mockToast.dispose.mockImplementation(() => {
        throw new Error('dispose failed');
      });

      expect(() => coordinator.dispose()).not.toThrow();
      expect(mockNative.dispose).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should dispose both services', () => {
      coordinator.dispose();

      expect(mockToast.dispose).toHaveBeenCalled();
      expect(mockNative.dispose).toHaveBeenCalled();
    });

    it('should not throw on double dispose', () => {
      coordinator.dispose();
      expect(() => coordinator.dispose()).not.toThrow();
    });
  });
});
