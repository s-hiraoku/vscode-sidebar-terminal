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
    notifyAndActivate: ReturnType<typeof vi.fn>;
    clearTerminal: ReturnType<typeof vi.fn>;
    clearWaitingState: ReturnType<typeof vi.fn>;
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
      notifyAndActivate: vi.fn(),
      clearTerminal: vi.fn(),
      clearWaitingState: vi.fn(),
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
      expect(mockNative.notifyAndActivate).toHaveBeenCalledWith(
        'terminal-1',
        'Sidebar Terminal',
        expect.stringContaining('waiting for input'),
        undefined
      );
    });

    it('should use correct label for approval waiting type', () => {
      coordinator.notifyWaiting('terminal-1', 'approval');

      expect(mockNative.notifyAndActivate).toHaveBeenCalledWith(
        'terminal-1',
        'Sidebar Terminal',
        expect.stringContaining('waiting for approval'),
        expect.objectContaining({ activateOnlyOnce: true })
      );
    });

    it('should not limit activation to once for input waiting type', () => {
      coordinator.notifyWaiting('terminal-1', 'input');

      expect(mockNative.notifyAndActivate).toHaveBeenCalledWith(
        'terminal-1',
        'Sidebar Terminal',
        expect.stringContaining('waiting for input'),
        expect.not.objectContaining({ activateOnlyOnce: true })
      );
    });

    it('should use correct label for idle waiting type', () => {
      coordinator.notifyWaiting('terminal-1', 'idle');

      expect(mockNative.notifyAndActivate).toHaveBeenCalledWith(
        'terminal-1',
        'Sidebar Terminal',
        expect.stringContaining('idle'),
        undefined
      );
    });

    it('should not call services after dispose', () => {
      coordinator.dispose();
      coordinator.notifyWaiting('terminal-1', 'input');

      expect(mockAudio.playNotification).not.toHaveBeenCalled();
      expect(mockToast.showWaitingNotification).not.toHaveBeenCalled();
      expect(mockNative.notifyAndActivate).not.toHaveBeenCalled();
    });
  });

  describe('notifyCompleted', () => {
    it('should call toast and native for completion notification', () => {
      coordinator.notifyCompleted('terminal-1', 'claude');

      expect(mockToast.showCompletedNotification).toHaveBeenCalledWith('terminal-1', 'claude');
      expect(mockNative.notifyAndActivate).toHaveBeenCalledWith(
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

      expect(mockNative.notifyAndActivate).toHaveBeenCalledWith(
        'terminal-1',
        'Sidebar Terminal',
        expect.stringContaining('CLI Agent has completed')
      );
    });

    it('should not call services after dispose', () => {
      coordinator.dispose();
      coordinator.notifyCompleted('terminal-1', 'claude');

      expect(mockToast.showCompletedNotification).not.toHaveBeenCalled();
      expect(mockNative.notifyAndActivate).not.toHaveBeenCalled();
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

  describe('clearWaitingState', () => {
    it('should clear waiting state only on native service', () => {
      coordinator.clearWaitingState('terminal-1');

      expect(mockNative.clearWaitingState).toHaveBeenCalledWith('terminal-1');
      expect(mockAudio.clearTerminal).not.toHaveBeenCalled();
      expect(mockToast.clearTerminal).not.toHaveBeenCalled();
    });
  });

  describe('error isolation', () => {
    it('should continue notifying other services if one throws', () => {
      mockAudio.playNotification.mockImplementation(() => {
        throw new Error('audio failed');
      });

      coordinator.notifyWaiting('terminal-1', 'input');

      expect(mockToast.showWaitingNotification).toHaveBeenCalled();
      expect(mockNative.notifyAndActivate).toHaveBeenCalled();
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
