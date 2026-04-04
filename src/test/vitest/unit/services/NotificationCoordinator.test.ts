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
  let mockAudio: {
    playNotification: ReturnType<typeof vi.fn>;
    clearTerminal: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };
  let mockToast: {
    showWaitingNotification: ReturnType<typeof vi.fn>;
    showCompletedNotification: ReturnType<typeof vi.fn>;
    clearTerminal: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };
  let mockNative: {
    notifyWaiting: ReturnType<typeof vi.fn>;
    notifyIdle: ReturnType<typeof vi.fn>;
    notifyCompleted: ReturnType<typeof vi.fn>;
    clearTerminal: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAudio = {
      playNotification: vi.fn(),
      clearTerminal: vi.fn(),
      dispose: vi.fn(),
    };
    mockToast = {
      showWaitingNotification: vi.fn(),
      showCompletedNotification: vi.fn(),
      clearTerminal: vi.fn(),
      dispose: vi.fn(),
    };
    mockNative = {
      notifyWaiting: vi.fn(),
      notifyIdle: vi.fn(),
      notifyCompleted: vi.fn(),
      clearTerminal: vi.fn(),
      dispose: vi.fn(),
    };
    coordinator = new NotificationCoordinator(
      mockAudio as any,
      mockToast as any,
      mockNative as any
    );
  });

  afterEach(() => {
    coordinator.dispose();
  });

  describe('notifyWaiting', () => {
    it('should call all three services for waiting notification', () => {
      coordinator.notifyWaiting('terminal-1', 'input');

      expect(mockAudio.playNotification).toHaveBeenCalledWith('terminal-1');
      expect(mockToast.showWaitingNotification).toHaveBeenCalledWith('terminal-1', 'input');
      expect(mockNative.notifyWaiting).toHaveBeenCalledWith(
        'terminal-1',
        'Sidebar Terminal',
        expect.stringContaining('waiting for input')
      );
    });

    it('should use correct label for approval waiting type', () => {
      coordinator.notifyWaiting('terminal-1', 'approval');

      expect(mockNative.notifyWaiting).toHaveBeenCalledWith(
        'terminal-1',
        'Sidebar Terminal',
        expect.stringContaining('waiting for approval')
      );
    });

    it('should delegate input waiting notifications to native waiting API', () => {
      coordinator.notifyWaiting('terminal-1', 'input');

      expect(mockNative.notifyWaiting).toHaveBeenCalledWith(
        'terminal-1',
        'Sidebar Terminal',
        expect.stringContaining('waiting for input')
      );
    });

    it('should use correct label for idle waiting type', () => {
      coordinator.notifyWaiting('terminal-1', 'idle');

      expect(mockNative.notifyIdle).toHaveBeenCalledWith(
        'terminal-1',
        'Sidebar Terminal',
        expect.stringContaining('idle')
      );
      expect(mockNative.notifyWaiting).not.toHaveBeenCalled();
    });

    it('should NOT play audio notification for idle waiting type', () => {
      coordinator.notifyWaiting('terminal-1', 'idle');

      expect(mockAudio.playNotification).not.toHaveBeenCalled();
    });

    it('should play audio notification for input waiting type', () => {
      coordinator.notifyWaiting('terminal-1', 'input');

      expect(mockAudio.playNotification).toHaveBeenCalledWith('terminal-1');
    });

    it('should play audio notification for approval waiting type', () => {
      coordinator.notifyWaiting('terminal-1', 'approval');

      expect(mockAudio.playNotification).toHaveBeenCalledWith('terminal-1');
    });

    it('should not call services after dispose', () => {
      coordinator.dispose();
      coordinator.notifyWaiting('terminal-1', 'input');

      expect(mockAudio.playNotification).not.toHaveBeenCalled();
      expect(mockToast.showWaitingNotification).not.toHaveBeenCalled();
      expect(mockNative.notifyWaiting).not.toHaveBeenCalled();
    });
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

    it('should not call audio for completion', () => {
      coordinator.notifyCompleted('terminal-1', 'claude');

      expect(mockAudio.playNotification).not.toHaveBeenCalled();
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

      expect(mockAudio.clearTerminal).toHaveBeenCalledWith('terminal-1');
      expect(mockToast.clearTerminal).toHaveBeenCalledWith('terminal-1');
      expect(mockNative.clearTerminal).toHaveBeenCalledWith('terminal-1');
    });

    it('should not call services after dispose', () => {
      coordinator.dispose();
      coordinator.clearTerminal('terminal-1');

      expect(mockAudio.clearTerminal).not.toHaveBeenCalled();
      expect(mockToast.clearTerminal).not.toHaveBeenCalled();
      expect(mockNative.clearTerminal).not.toHaveBeenCalled();
    });
  });

  describe('error isolation', () => {
    it('should continue notifying other services if one throws', () => {
      mockAudio.playNotification.mockImplementation(() => {
        throw new Error('audio failed');
      });

      coordinator.notifyWaiting('terminal-1', 'input');

      expect(mockToast.showWaitingNotification).toHaveBeenCalled();
      expect(mockNative.notifyWaiting).toHaveBeenCalled();
      expect(mockNative.notifyIdle).not.toHaveBeenCalled();
    });

    it('should continue disposing other services if one throws', () => {
      mockAudio.dispose.mockImplementation(() => {
        throw new Error('dispose failed');
      });

      expect(() => coordinator.dispose()).not.toThrow();
      expect(mockToast.dispose).toHaveBeenCalled();
      expect(mockNative.dispose).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should dispose all three services', () => {
      coordinator.dispose();

      expect(mockAudio.dispose).toHaveBeenCalled();
      expect(mockToast.dispose).toHaveBeenCalled();
      expect(mockNative.dispose).toHaveBeenCalled();
    });

    it('should not throw on double dispose', () => {
      coordinator.dispose();
      expect(() => coordinator.dispose()).not.toThrow();
    });
  });
});
