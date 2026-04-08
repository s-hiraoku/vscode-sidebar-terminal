import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NativeNotificationService } from '../../../../services/NativeNotificationService';

const mockGetConfig = vi.fn();
type ExecFileFn = NonNullable<ConstructorParameters<typeof NativeNotificationService>[0]>;

const { mockWindowState } = vi.hoisted(() => {
  const mockWindowState = { focused: false };
  return { mockWindowState };
});

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: (...args: any[]) => mockGetConfig(...args),
  },
  env: {
    appName: 'Visual Studio Code',
  },
  window: {
    state: mockWindowState,
  },
}));

function setDefaultConfig(overrides: Record<string, any> = {}) {
  const settings: Record<string, any> = {
    'nativeNotification.enabled': true,
    'nativeNotification.activateWindow': true,
    'nativeNotification.cooldownMs': 10000,
    ...overrides,
  };
  mockGetConfig.mockReturnValue({
    get: vi.fn().mockImplementation((key: string, defaultValue?: any) => {
      return settings[key] ?? defaultValue;
    }),
  });
}

describe('NativeNotificationService', () => {
  let service: NativeNotificationService;
  let mockExecFile: ReturnType<typeof vi.fn<ExecFileFn>>;
  const originalPlatform = process.platform;

  function setPlatform(platform: string) {
    Object.defineProperty(process, 'platform', { value: platform, writable: true });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    setDefaultConfig();
    mockWindowState.focused = false;
    mockExecFile = vi.fn<ExecFileFn>();
    service = new NativeNotificationService(mockExecFile);
  });

  afterEach(() => {
    service.dispose();
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
    vi.useRealTimers();
  });

  describe('notifyCompleted', () => {
    it('sends an OS notification when enabled', () => {
      setPlatform('darwin');

      service.notifyCompleted('terminal-1', 'Title', 'Completed');

      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('does not send a notification when disabled', () => {
      setDefaultConfig({ 'nativeNotification.enabled': false });

      service.notifyCompleted('terminal-1', 'Title', 'Completed');

      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('respects per-terminal cooldown', () => {
      setPlatform('darwin');

      service.notifyCompleted('terminal-1', 'Title', 'Completed');
      service.notifyCompleted('terminal-1', 'Title', 'Completed again');

      expect(mockExecFile).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(10000);
      service.notifyCompleted('terminal-1', 'Title', 'Completed later');

      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('resets per-terminal cooldown when the terminal is cleared', () => {
      setPlatform('darwin');

      service.notifyCompleted('terminal-1', 'Title', 'Completed');
      expect(mockExecFile).toHaveBeenCalledTimes(1);

      service.clearTerminal('terminal-1');
      vi.advanceTimersByTime(10000);
      service.notifyCompleted('terminal-1', 'Title', 'Completed after clear');

      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('skips native notifications while VS Code is already focused', () => {
      setPlatform('darwin');
      mockWindowState.focused = true;

      service.notifyCompleted('terminal-1', 'Title', 'Completed');

      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('activates the window when VS Code is not focused', () => {
      setPlatform('darwin');

      service.notifyCompleted('terminal-1', 'Title', 'Completed');

      expect(mockExecFile).toHaveBeenCalledTimes(1);
      const args = mockExecFile.mock.calls[0]![1] as string[];
      const script = args[args.indexOf('-e') + 1];
      expect(script).toContain('activate');
    });
  });

  describe('dispose', () => {
    it('does not send notifications after dispose', () => {
      setPlatform('darwin');
      service.dispose();

      service.notifyCompleted('terminal-1', 'Title', 'Completed');

      expect(mockExecFile).not.toHaveBeenCalled();
    });
  });
});
