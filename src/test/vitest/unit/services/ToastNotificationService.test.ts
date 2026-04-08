import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToastNotificationService } from '../../../../services/ToastNotificationService';

const mockGetConfig = vi.fn();
const mockShowInformationMessage = vi.fn();
const mockSetStatusBarMessage = vi.fn();

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: (...args: any[]) => mockGetConfig(...args),
  },
  window: {
    showInformationMessage: (...args: any[]) => mockShowInformationMessage(...args),
    setStatusBarMessage: (...args: any[]) => mockSetStatusBarMessage(...args),
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
    mockSetStatusBarMessage.mockClear();
    service = new ToastNotificationService();
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });

  describe('showCompletedNotification', () => {
    it('should show completion notification', () => {
      service.showCompletedNotification('terminal-1');
      expect(mockSetStatusBarMessage).toHaveBeenCalledTimes(1);
      expect(mockSetStatusBarMessage).toHaveBeenCalledWith(
        expect.stringContaining('completed'),
        expect.any(Number)
      );
    });

    it('should include agent type in completion message', () => {
      service.showCompletedNotification('terminal-1', 'claude');
      expect(mockSetStatusBarMessage).toHaveBeenCalledWith(
        expect.stringContaining('Claude'),
        expect.any(Number)
      );
    });

    it('should not show when disabled', () => {
      setDefaultConfig({ 'agentToastNotification.enabled': false });
      service.showCompletedNotification('terminal-1');
      expect(mockSetStatusBarMessage).not.toHaveBeenCalled();
    });

    it('should respect cooldown', () => {
      service.showCompletedNotification('terminal-1');
      service.showCompletedNotification('terminal-1');
      expect(mockSetStatusBarMessage).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(10000);
      service.showCompletedNotification('terminal-1');
      expect(mockSetStatusBarMessage).toHaveBeenCalledTimes(2);
    });

    it('should not show after dispose', () => {
      service.dispose();
      service.showCompletedNotification('terminal-1');
      expect(mockSetStatusBarMessage).not.toHaveBeenCalled();
    });
  });

  describe('clearTerminal', () => {
    it('should allow notification after clearTerminal resets cooldown', () => {
      service.showCompletedNotification('terminal-1', 'claude');
      expect(mockSetStatusBarMessage).toHaveBeenCalledTimes(1);

      service.clearTerminal('terminal-1');

      // Global cooldown still applies, advance past it
      vi.advanceTimersByTime(10000);
      service.showCompletedNotification('terminal-1', 'claude');
      expect(mockSetStatusBarMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('focus safety', () => {
    it('should never call showInformationMessage to avoid stealing focus', () => {
      service.showCompletedNotification('terminal-1', 'claude');
      expect(mockShowInformationMessage).not.toHaveBeenCalled();
    });

    it('should use setStatusBarMessage with auto-dismiss duration', () => {
      service.showCompletedNotification('terminal-1', 'claude');
      expect(mockSetStatusBarMessage).toHaveBeenCalledWith(
        expect.stringContaining('Claude'),
        expect.any(Number)
      );
    });
  });

  describe('dispose', () => {
    it('should not throw on double dispose', () => {
      service.dispose();
      expect(() => service.dispose()).not.toThrow();
    });
  });
});
