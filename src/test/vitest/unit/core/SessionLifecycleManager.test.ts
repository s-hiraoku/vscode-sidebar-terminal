import { describe, it, expect, vi } from 'vitest';
import { SessionLifecycleManager } from '../../../../core/SessionLifecycleManager';

const debugSpy = vi.hoisted(() => vi.fn());

vi.mock('../../../../utils/logger', () => ({
  logger: {
    debug: debugSpy,
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('SessionLifecycleManager - scrollback extraction logging', () => {
  it('logs debug details when scrollback extraction fails', async () => {
    const error = new Error('scrollback failed');

    const mockTerminalManager = {
      getTerminals: () => [{ id: 'term-1' }],
    };

    const mockSidebarProvider = {
      _sendMessage: vi.fn().mockRejectedValue(error),
    };

    const manager = new SessionLifecycleManager({
      getTerminalManager: () => mockTerminalManager as any,
      getSidebarProvider: () => mockSidebarProvider as any,
      getExtensionPersistenceService: () => undefined,
      getExtensionContext: () => undefined,
    });

    await (manager as any).extractScrollbackFromAllTerminals();

    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('Scrollback extraction failed for terminal term-1: scrollback failed')
    );
  });
});
