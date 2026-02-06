/**
 * ProviderSessionService Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ProviderSessionService,
  IProviderSessionDependencies,
} from '../../../../../providers/services/ProviderSessionService';
import { TIMING_CONSTANTS } from '../../../../../constants/TimingConstants';

function createMockDeps(): IProviderSessionDependencies {
  return {
    extensionPersistenceService: {
      saveCurrentSession: vi.fn().mockResolvedValue({ success: true }),
      restoreSession: vi.fn().mockResolvedValue(null),
    },
    getTerminals: vi.fn().mockReturnValue([
      { id: 'terminal-1', name: 'Terminal 1', cwd: '/home' },
    ]),
    getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
    createTerminal: vi.fn().mockReturnValue('terminal-new'),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    getCurrentFontSettings: vi.fn().mockReturnValue({ fontSize: 14 }),
  };
}

describe('ProviderSessionService', () => {
  let service: ProviderSessionService;
  let deps: IProviderSessionDependencies;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    service = new ProviderSessionService(deps);
  });

  describe('saveCurrentSession', () => {
    it('should save session successfully', async () => {
      const result = await service.saveCurrentSession();

      expect(result).toBe(true);
      expect(deps.extensionPersistenceService!.saveCurrentSession).toHaveBeenCalled();
    });

    it('should return false when persistence service not available', async () => {
      deps.extensionPersistenceService = null;
      service = new ProviderSessionService(deps);

      const result = await service.saveCurrentSession();

      expect(result).toBe(false);
    });

    it('should return false on save failure', async () => {
      vi.mocked(deps.extensionPersistenceService!.saveCurrentSession).mockResolvedValue({
        success: false,
        error: 'Storage full',
      });

      const result = await service.saveCurrentSession();

      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      vi.mocked(deps.extensionPersistenceService!.saveCurrentSession).mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.saveCurrentSession();

      expect(result).toBe(false);
    });
  });

  describe('restoreLastSession', () => {
    it('should return false when persistence service not available', async () => {
      deps.extensionPersistenceService = null;
      service = new ProviderSessionService(deps);

      const result = await service.restoreLastSession();

      expect(result).toBe(false);
    });

    it('should return false when no session data', async () => {
      const result = await service.restoreLastSession();

      expect(result).toBe(false);
    });

    it('should restore terminals from session', async () => {
      vi.mocked(deps.extensionPersistenceService!.restoreSession).mockResolvedValue({
        terminals: [
          { id: 'old-1', name: 'Terminal 1', cwd: '/home', scrollback: ['line1'] },
          { id: 'old-2', name: 'Terminal 2' },
        ],
      });
      let callCount = 0;
      vi.mocked(deps.createTerminal).mockImplementation(() => {
        callCount++;
        return `terminal-${callCount}`;
      });

      const result = await service.restoreLastSession();

      expect(result).toBe(true);
      expect(deps.createTerminal).toHaveBeenCalledTimes(2);
      // Should send terminalCreated messages
      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'terminalCreated' })
      );
      // Should restore scrollback for the first terminal
      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'restoreScrollback' })
      );
    });

    it('should send fontSettings at top level for terminalCreated messages', async () => {
      vi.mocked(deps.extensionPersistenceService!.restoreSession).mockResolvedValue({
        terminals: [{ id: 'old-1', name: 'Terminal 1' }],
      });
      vi.mocked(deps.createTerminal).mockReturnValue('terminal-1');

      await service.restoreLastSession();

      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalCreated',
          fontSettings: { fontSize: 14 },
        })
      );

      const terminalCreatedCalls = vi
        .mocked(deps.sendMessage)
        .mock.calls.filter((call) => call[0]?.command === 'terminalCreated');
      expect(terminalCreatedCalls).toHaveLength(1);
      expect((terminalCreatedCalls[0][0] as { config?: unknown }).config).toBeUndefined();
    });

    it('should wait using TIMING_CONSTANTS.WEBVIEW_INIT_DELAY_MS before restoring scrollback', async () => {
      vi.useFakeTimers();
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      const originalDelay = TIMING_CONSTANTS.WEBVIEW_INIT_DELAY_MS;
      try {
        (TIMING_CONSTANTS as { WEBVIEW_INIT_DELAY_MS: number }).WEBVIEW_INIT_DELAY_MS = 321;
        vi.mocked(deps.extensionPersistenceService!.restoreSession).mockResolvedValue({
          terminals: [{ id: 'old-1', name: 'Terminal 1', scrollback: ['line1'] }],
        });
        vi.mocked(deps.createTerminal).mockReturnValue('terminal-1');

        const restorePromise = service.restoreLastSession();
        await vi.runAllTimersAsync();
        await restorePromise;

        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 321);
      } finally {
        (TIMING_CONSTANTS as { WEBVIEW_INIT_DELAY_MS: number }).WEBVIEW_INIT_DELAY_MS = originalDelay;
        vi.useRealTimers();
      }
    });

    it('should handle individual terminal restore failure gracefully', async () => {
      vi.mocked(deps.extensionPersistenceService!.restoreSession).mockResolvedValue({
        terminals: [{ id: 'old-1', name: 'Terminal 1' }],
      });
      vi.mocked(deps.createTerminal).mockImplementation(() => {
        throw new Error('Create failed');
      });

      const result = await service.restoreLastSession();

      expect(result).toBe(false);
    });
  });
});
