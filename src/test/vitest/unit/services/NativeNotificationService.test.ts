import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NativeNotificationService } from '../../../../services/NativeNotificationService';

const mockGetConfig = vi.fn();
type ExecFileFn = NonNullable<ConstructorParameters<typeof NativeNotificationService>[0]>;
type NotifyOptions = NonNullable<Parameters<NativeNotificationService['notifyAndActivate']>[3]>;

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: (...args: any[]) => mockGetConfig(...args),
  },
  env: {
    appName: 'Visual Studio Code',
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
    mockExecFile = vi.fn<ExecFileFn>();
    service = new NativeNotificationService(mockExecFile);
  });

  afterEach(() => {
    service.dispose();
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
    vi.useRealTimers();
  });

  describe('notifyAndActivate', () => {
    it('should send OS notification when enabled', () => {
      setPlatform('darwin');
      service.notifyAndActivate('terminal-1', 'Test Title', 'Test message');
      expect(mockExecFile).toHaveBeenCalled();
    });

    it('should not send notification when disabled', () => {
      setDefaultConfig({ 'nativeNotification.enabled': false });
      service.notifyAndActivate('terminal-1', 'Test Title', 'Test message');
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('should not send notification after dispose', () => {
      service.dispose();
      service.notifyAndActivate('terminal-1', 'Test Title', 'Test message');
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    describe('cooldown', () => {
      it('should respect per-terminal cooldown', () => {
        setPlatform('darwin');
        service.notifyAndActivate('terminal-1', 'Title', 'Message');
        expect(mockExecFile).toHaveBeenCalledTimes(1);

        service.notifyAndActivate('terminal-1', 'Title', 'Message 2');
        expect(mockExecFile).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(10000);
        service.notifyAndActivate('terminal-1', 'Title', 'Message 3');
        expect(mockExecFile).toHaveBeenCalledTimes(2);
      });

      it('should enforce global cooldown across terminals', () => {
        setPlatform('darwin');
        service.notifyAndActivate('terminal-1', 'Title', 'Message');
        expect(mockExecFile).toHaveBeenCalledTimes(1);

        service.notifyAndActivate('terminal-2', 'Title', 'Message');
        expect(mockExecFile).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(10000);
        service.notifyAndActivate('terminal-2', 'Title', 'Message');
        expect(mockExecFile).toHaveBeenCalledTimes(2);
      });

      it('should allow notification after clearTerminal resets cooldown', () => {
        setPlatform('darwin');
        service.notifyAndActivate('terminal-1', 'Title', 'Message');
        expect(mockExecFile).toHaveBeenCalledTimes(1);

        service.clearTerminal('terminal-1');
        vi.advanceTimersByTime(10000);
        service.notifyAndActivate('terminal-1', 'Title', 'Message');
        expect(mockExecFile).toHaveBeenCalledTimes(2);
      });

      it('should activate approval waiting only once until waiting state is cleared', () => {
        setPlatform('darwin');
        const options: NotifyOptions = {
          activateOnlyOnce: true,
        };
        service.notifyAndActivate('terminal-1', 'Title', 'Waiting for approval', options);
        expect(mockExecFile).toHaveBeenCalledTimes(1);
        let args = mockExecFile.mock.calls[0][1] as string[];
        let script = args[args.indexOf('-e') + 1];
        expect(script).toContain('activate');

        vi.advanceTimersByTime(10000);
        service.notifyAndActivate('terminal-1', 'Title', 'Waiting for approval again', options);
        expect(mockExecFile).toHaveBeenCalledTimes(2);
        args = mockExecFile.mock.calls[1][1] as string[];
        script = args[args.indexOf('-e') + 1];
        expect(script).not.toContain('activate');

        service.clearWaitingState('terminal-1');
        vi.advanceTimersByTime(10000);
        service.notifyAndActivate(
          'terminal-1',
          'Title',
          'Waiting for approval after clear',
          options
        );
        expect(mockExecFile).toHaveBeenCalledTimes(3);
        args = mockExecFile.mock.calls[2][1] as string[];
        script = args[args.indexOf('-e') + 1];
        expect(script).toContain('activate');
      });

      it('should continue allowing repeated activation when activateOnlyOnce is false', () => {
        setPlatform('darwin');
        service.notifyAndActivate('terminal-1', 'Title', 'Waiting for input');
        expect(mockExecFile).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(10000);
        service.notifyAndActivate('terminal-1', 'Title', 'Waiting for input again');
        expect(mockExecFile).toHaveBeenCalledTimes(2);
      });
    });

    describe('macOS', () => {
      beforeEach(() => setPlatform('darwin'));

      it('should use a single osascript call for notification + activation', () => {
        service.notifyAndActivate('terminal-1', 'Agent Waiting', 'Claude is waiting');
        expect(mockExecFile).toHaveBeenCalledTimes(1);
        expect(mockExecFile).toHaveBeenCalledWith(
          'osascript',
          expect.arrayContaining(['-e']),
          expect.any(Function)
        );
        const args = mockExecFile.mock.calls[0][1] as string[];
        const script = args[args.indexOf('-e') + 1];
        expect(script).toContain('display notification');
        expect(script).toContain('activate');
      });

      it('should include title and message in osascript command', () => {
        service.notifyAndActivate('terminal-1', 'Agent Waiting', 'Claude is waiting for input');
        const args = mockExecFile.mock.calls[0][1] as string[];
        const script = args[args.indexOf('-e') + 1];
        expect(script).toContain('Agent Waiting');
        expect(script).toContain('Claude is waiting for input');
      });

      it('should sanitize special characters', () => {
        service.notifyAndActivate('terminal-1', 'Test "Title"', 'Message with \\ backslash');
        const args = mockExecFile.mock.calls[0][1] as string[];
        const script = args[args.indexOf('-e') + 1];
        expect(script).not.toContain('"Title"');
      });

      it('should skip activation when activateWindow is disabled', () => {
        setDefaultConfig({ 'nativeNotification.activateWindow': false });
        service.notifyAndActivate('terminal-1', 'Title', 'Message');
        const args = mockExecFile.mock.calls[0][1] as string[];
        const script = args[args.indexOf('-e') + 1];
        expect(script).toContain('display notification');
        expect(script).not.toContain('activate');
      });
    });

    describe('Windows', () => {
      beforeEach(() => setPlatform('win32'));

      it('should use a single powershell call', () => {
        service.notifyAndActivate('terminal-1', 'Agent Waiting', 'Claude is waiting');
        expect(mockExecFile).toHaveBeenCalledTimes(1);
        expect(mockExecFile).toHaveBeenCalledWith(
          'powershell',
          expect.arrayContaining(['-Command']),
          expect.any(Function)
        );
      });

      it('should include activation when enabled', () => {
        service.notifyAndActivate('terminal-1', 'Title', 'Message');
        const args = mockExecFile.mock.calls[0][1] as string[];
        const script = args[args.indexOf('-Command') + 1];
        expect(script).toContain('SetForegroundWindow');
      });

      it('should skip activation when disabled', () => {
        setDefaultConfig({ 'nativeNotification.activateWindow': false });
        service.notifyAndActivate('terminal-1', 'Title', 'Message');
        const args = mockExecFile.mock.calls[0][1] as string[];
        const script = args[args.indexOf('-Command') + 1];
        expect(script).not.toContain('SetForegroundWindow');
      });
    });

    describe('Linux', () => {
      beforeEach(() => setPlatform('linux'));

      it('should use notify-send for notification', () => {
        service.notifyAndActivate('terminal-1', 'Agent Waiting', 'Claude is waiting');
        expect(mockExecFile).toHaveBeenCalledWith(
          'notify-send',
          expect.arrayContaining(['Agent Waiting', 'Claude is waiting']),
          expect.any(Function)
        );
      });

      it('should also call wmctrl for activation', () => {
        service.notifyAndActivate('terminal-1', 'Title', 'Message');
        expect(mockExecFile).toHaveBeenCalledTimes(2);
        expect(mockExecFile).toHaveBeenCalledWith(
          'wmctrl',
          expect.arrayContaining(['-a']),
          expect.any(Function)
        );
      });

      it('should skip wmctrl when activation is disabled', () => {
        setDefaultConfig({ 'nativeNotification.activateWindow': false });
        service.notifyAndActivate('terminal-1', 'Title', 'Message');
        expect(mockExecFile).toHaveBeenCalledTimes(1);
        expect(mockExecFile).toHaveBeenCalledWith(
          'notify-send',
          expect.any(Array),
          expect.any(Function)
        );
      });
    });

    describe('unsupported platform', () => {
      beforeEach(() => setPlatform('freebsd'));

      it('should not attempt notification on unsupported platform', () => {
        service.notifyAndActivate('terminal-1', 'Test', 'Test');
        expect(mockExecFile).not.toHaveBeenCalled();
      });
    });
  });

  describe('dispose', () => {
    it('should not throw on double dispose', () => {
      service.dispose();
      expect(() => service.dispose()).not.toThrow();
    });
  });
});
