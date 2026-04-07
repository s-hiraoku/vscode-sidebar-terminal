import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioNotificationService } from '../../../../services/AudioNotificationService';

const mockGetConfig = vi.fn();

// Mock vscode
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: (...args: any[]) => mockGetConfig(...args),
  },
  EventEmitter: vi.fn().mockImplementation(function (this: any) {
    this.event = vi.fn();
    this.fire = vi.fn();
    this.dispose = vi.fn();
  }),
  Disposable: {
    from: vi.fn(),
  },
}));

function setDefaultConfig(overrides: Record<string, any> = {}) {
  const settings: Record<string, any> = {
    'agentWaitingNotification.enabled': true,
    'agentWaitingNotification.soundFile': '/test/sound.aiff',
    'agentWaitingNotification.volume': 50,
    'agentWaitingNotification.cooldownMs': 5000,
    ...overrides,
  };
  mockGetConfig.mockReturnValue({
    get: vi.fn().mockImplementation((key: string, defaultValue?: any) => {
      return settings[key] ?? defaultValue;
    }),
  });
}

describe('AudioNotificationService', () => {
  let service: AudioNotificationService;
  let mockExecFile: ReturnType<typeof vi.fn>;
  let mockKill: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    setDefaultConfig();

    mockKill = vi.fn();
    mockExecFile = vi.fn((_cmd: string, _args: string[], _opts: any, callback?: Function) => {
      if (callback) {
        callback(null, '', '');
      }
      return { kill: mockKill, pid: 123 };
    });

    service = new AudioNotificationService();
    (service as any)._execFile = mockExecFile;
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });

  describe('playNotification', () => {
    it('should play sound when enabled', () => {
      service.playNotification('terminal-1');
      expect(mockExecFile).toHaveBeenCalled();
    });

    it('should not play sound when disabled', () => {
      setDefaultConfig({ 'agentWaitingNotification.enabled': false });

      mockExecFile.mockClear();
      service.playNotification('terminal-1');
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('should respect per-terminal cooldown period', () => {
      service.playNotification('terminal-1');
      expect(mockExecFile).toHaveBeenCalledTimes(1);

      // Second call within cooldown should be suppressed
      service.playNotification('terminal-1');
      expect(mockExecFile).toHaveBeenCalledTimes(1);

      // After cooldown expires
      vi.advanceTimersByTime(5000);
      service.playNotification('terminal-1');
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('should enforce global cooldown across terminals', () => {
      service.playNotification('terminal-1');
      expect(mockExecFile).toHaveBeenCalledTimes(1);

      // Different terminal within global cooldown should be suppressed
      service.playNotification('terminal-2');
      expect(mockExecFile).toHaveBeenCalledTimes(1);

      // After cooldown expires, different terminal should play
      vi.advanceTimersByTime(5000);
      service.playNotification('terminal-2');
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it('should pass volume as first arg on macOS', () => {
      service.playNotification('terminal-1');

      if (process.platform === 'darwin') {
        const call = mockExecFile.mock.calls[0];
        expect(call![0]).toBe('afplay');
        expect(call![1]).toEqual(['-v', '0.5', '/test/sound.aiff']);
      }
    });

    it('should pass Windows sound path as a separate PowerShell argument', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });

      mockExecFile.mockClear();
      service.playNotification('terminal-1');

      const call = mockExecFile.mock.calls[0];
      expect(call![0]).toBe('powershell');
      expect(call![1]).toContain('/test/sound.aiff');
      expect(call![1].join(' ')).not.toContain("'/test/sound.aiff'");

      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    });

    it('should not play when sound file resolves to empty', () => {
      setDefaultConfig({ 'agentWaitingNotification.soundFile': '' });

      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'freebsd', writable: true });

      mockExecFile.mockClear();
      service.playNotification('terminal-1');
      expect(mockExecFile).not.toHaveBeenCalled();

      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    });

    it('should reject relative sound file paths', () => {
      setDefaultConfig({ 'agentWaitingNotification.soundFile': 'relative/path.wav' });

      mockExecFile.mockClear();
      service.playNotification('terminal-1');
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('should reject non-audio file extensions', () => {
      setDefaultConfig({ 'agentWaitingNotification.soundFile': '/etc/passwd' });

      mockExecFile.mockClear();
      service.playNotification('terminal-1');
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('should not play after dispose', () => {
      service.dispose();
      mockExecFile.mockClear();
      service.playNotification('terminal-1');
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('should set timeout on exec options', () => {
      service.playNotification('terminal-1');

      const call = mockExecFile.mock.calls[0];
      expect(call![2]).toEqual(expect.objectContaining({ timeout: 5000 }));
    });
  });

  describe('dispose', () => {
    it('should kill active processes on dispose', () => {
      // Simulate a long-running process (callback not called immediately)
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any) => {
        return { kill: mockKill, pid: 456 };
      });

      service.playNotification('terminal-1');
      service.dispose();

      expect(mockKill).toHaveBeenCalled();
    });

    it('should clear all cooldown state', () => {
      service.playNotification('terminal-1');
      service.dispose();
      expect(() => service.dispose()).not.toThrow();
    });
  });
});
