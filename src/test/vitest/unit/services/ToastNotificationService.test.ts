import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToastNotificationService } from '../../../../services/ToastNotificationService';

const mockGetConfig = vi.fn();
const mockShowInformationMessage = vi.fn();

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: (...args: any[]) => mockGetConfig(...args),
  },
  window: {
    showInformationMessage: (...args: any[]) => mockShowInformationMessage(...args),
  },
}));

function setDefaultConfig(overrides: Record<string, any> = {}) {
  const settings: Record<string, any> = {
    'agentToastNotification.enabled': true,
    'agentToastNotification.cooldownMs': 10000,
    ...overrides,
  };
  mockGetConfig.mockReturnValue({
    get: vi.fn().mockImplementation((key: string, defaultValue?: any) => {
      return settings[key] ?? defaultValue;
    }),
  });
}

describe('ToastNotificationService', () => {
  let service: ToastNotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    setDefaultConfig();
    mockShowInformationMessage.mockClear();
    service = new ToastNotificationService();
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });

  describe('showWaitingNotification', () => {
    it('should show notification when enabled', () => {
      service.showWaitingNotification('terminal-1');
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);
      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('waiting for input')
      );
    });

    it('should not show notification when disabled', () => {
      setDefaultConfig({ 'agentToastNotification.enabled': false });
      service.showWaitingNotification('terminal-1');
      expect(mockShowInformationMessage).not.toHaveBeenCalled();
    });

    it('should respect per-terminal cooldown', () => {
      service.showWaitingNotification('terminal-1');
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);

      service.showWaitingNotification('terminal-1');
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(10000);
      service.showWaitingNotification('terminal-1');
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(2);
    });

    it('should enforce global cooldown across terminals', () => {
      service.showWaitingNotification('terminal-1');
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);

      service.showWaitingNotification('terminal-2');
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(10000);
      service.showWaitingNotification('terminal-2');
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(2);
    });

    it('should show input-specific message for waitingType=input', () => {
      service.showWaitingNotification('terminal-1', 'input');
      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('waiting for input')
      );
    });

    it('should show approval-specific message for waitingType=approval', () => {
      service.showWaitingNotification('terminal-1', 'approval');
      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('waiting for approval')
      );
    });

    it('should not show notification after dispose', () => {
      service.dispose();
      service.showWaitingNotification('terminal-1');
      expect(mockShowInformationMessage).not.toHaveBeenCalled();
    });
  });

  describe('showCompletedNotification', () => {
    it('should show completion notification', () => {
      service.showCompletedNotification('terminal-1');
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);
      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('completed')
      );
    });

    it('should include agent type in completion message', () => {
      service.showCompletedNotification('terminal-1', 'claude');
      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('Claude')
      );
    });

    it('should not show when disabled', () => {
      setDefaultConfig({ 'agentToastNotification.enabled': false });
      service.showCompletedNotification('terminal-1');
      expect(mockShowInformationMessage).not.toHaveBeenCalled();
    });

    it('should respect cooldown', () => {
      service.showCompletedNotification('terminal-1');
      service.showCompletedNotification('terminal-1');
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(10000);
      service.showCompletedNotification('terminal-1');
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(2);
    });

    it('should not show after dispose', () => {
      service.dispose();
      service.showCompletedNotification('terminal-1');
      expect(mockShowInformationMessage).not.toHaveBeenCalled();
    });
  });

  describe('clearTerminal', () => {
    it('should allow notification after clearTerminal resets cooldown', () => {
      service.showWaitingNotification('terminal-1');
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);

      service.clearTerminal('terminal-1');

      // Global cooldown still applies, advance past it
      vi.advanceTimersByTime(10000);
      service.showWaitingNotification('terminal-1');
      expect(mockShowInformationMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('dispose', () => {
    it('should not throw on double dispose', () => {
      service.dispose();
      expect(() => service.dispose()).not.toThrow();
    });
  });
});
