/**
 * UnifiedMessageDispatcher Unit Tests
 *
 * Tests for Bug #14: window.removeEventListener missing in dispose()
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedMessageDispatcher } from '../../../../messaging/UnifiedMessageDispatcher';

// Mock ManagerLogger
vi.mock('../../../../webview/utils/ManagerLogger', () => ({
  messageLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock MessageQueue
vi.mock('../../../../webview/utils/MessageQueue', () => ({
  MessageQueue: vi.fn().mockImplementation(function (this: any) {
    this.enqueue = vi.fn();
    this.dispose = vi.fn();
    this.clear = vi.fn();
    this.flush = vi.fn();
    this.getQueueStats = vi.fn().mockReturnValue({
      normal: 0,
      highPriority: 0,
      isProcessing: false,
    });
  }),
}));

describe('UnifiedMessageDispatcher', () => {
  let dispatcher: UnifiedMessageDispatcher;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    dispatcher = new UnifiedMessageDispatcher();
  });

  afterEach(() => {
    dispatcher.dispose();
    vi.restoreAllMocks();
  });

  describe('dispose - event listener cleanup', () => {
    it('should remove the message event listener on dispose', async () => {
      // Initialize to register the event listener
      await dispatcher.initialize();

      // Verify addEventListener was called with 'message'
      expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));

      // Get the handler that was registered
      const registeredHandler = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      // Dispose should remove the event listener
      dispatcher.dispose();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('message', registeredHandler);
    });

    it('should not process messages after dispose', async () => {
      const mockCoordinator = {
        postMessageToExtension: vi.fn(),
        getActiveTerminalId: vi.fn().mockReturnValue('term-1'),
      } as any;

      await dispatcher.initialize(mockCoordinator);
      dispatcher.dispose();

      // Processing messages after dispose should return failure
      const result = await dispatcher.processMessage({ command: 'test' } as any);
      expect(result.success).toBe(false);
    });

    it('should handle dispose when initialize was not called', () => {
      // dispose without initialize should not throw
      expect(() => dispatcher.dispose()).not.toThrow();

      // removeEventListener should not be called since no listener was registered
      const messageRemoveCalls = removeEventListenerSpy.mock.calls.filter(
        (call) => call[0] === 'message'
      );
      expect(messageRemoveCalls.length).toBe(0);
    });

    it('should not call removeEventListener twice on double dispose', async () => {
      await dispatcher.initialize();
      dispatcher.dispose();

      const removeCallCount = removeEventListenerSpy.mock.calls.filter(
        (call) => call[0] === 'message'
      ).length;

      // Second dispose should not add more removeEventListener calls
      dispatcher.dispose();

      const newRemoveCallCount = removeEventListenerSpy.mock.calls.filter(
        (call) => call[0] === 'message'
      ).length;

      expect(newRemoveCallCount).toBe(removeCallCount);
    });
  });
});
