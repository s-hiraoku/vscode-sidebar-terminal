import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  InputFlushingService,
  IInputFlushingDependencies,
} from '../../../../../../../webview/managers/input/services/InputFlushingService';

describe('InputFlushingService', () => {
  let dom: JSDOM;
  let service: InputFlushingService;
  let mockLogger: ReturnType<typeof vi.fn>;
  let mockSendInput: ReturnType<typeof vi.fn>;
  let deps: IInputFlushingDependencies;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.useFakeTimers();

    mockLogger = vi.fn();
    mockSendInput = vi.fn();
    deps = { logger: mockLogger, sendInput: mockSendInput };
    service = new InputFlushingService(deps);
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    dom.window.close();
  });

  describe('queueInputData', () => {
    it('should not send input for empty terminalId', () => {
      service.queueInputData('', 'a', true);
      expect(mockSendInput).not.toHaveBeenCalled();
    });

    it('should not send input for empty data', () => {
      service.queueInputData('terminal-1', '', true);
      expect(mockSendInput).not.toHaveBeenCalled();
    });

    it('should flush immediately when flushImmediately is true', () => {
      service.queueInputData('terminal-1', 'a', true);
      expect(mockSendInput).toHaveBeenCalledWith('a', 'terminal-1');
    });

    it('should buffer data and flush after microtask when flushImmediately is false', () => {
      service.queueInputData('terminal-1', 'a', false);
      service.queueInputData('terminal-1', 'b', false);

      // Not flushed yet
      expect(mockSendInput).not.toHaveBeenCalled();

      vi.advanceTimersByTime(10);

      expect(mockSendInput).toHaveBeenCalledWith('ab', 'terminal-1');
      expect(mockSendInput).toHaveBeenCalledTimes(1);
    });

    it('should batch buffered data then flush immediately when a flush-immediate item arrives', () => {
      service.queueInputData('terminal-1', 'ls', false);
      service.queueInputData('terminal-1', '\r', true);

      expect(mockSendInput).toHaveBeenCalledWith('ls\r', 'terminal-1');
      expect(mockSendInput).toHaveBeenCalledTimes(1);
    });

    it('should not schedule multiple timers for the same terminal', () => {
      service.queueInputData('terminal-1', 'a', false);
      service.queueInputData('terminal-1', 'b', false);
      service.queueInputData('terminal-1', 'c', false);

      vi.advanceTimersByTime(10);

      // All should be batched in one call
      expect(mockSendInput).toHaveBeenCalledWith('abc', 'terminal-1');
      expect(mockSendInput).toHaveBeenCalledTimes(1);
    });

    it('should maintain separate buffers for different terminals', () => {
      service.queueInputData('terminal-1', 'a', false);
      service.queueInputData('terminal-2', 'x', false);

      vi.advanceTimersByTime(10);

      expect(mockSendInput).toHaveBeenCalledWith('a', 'terminal-1');
      expect(mockSendInput).toHaveBeenCalledWith('x', 'terminal-2');
      expect(mockSendInput).toHaveBeenCalledTimes(2);
    });
  });

  describe('flushPendingInput', () => {
    it('should be a no-op for an unknown terminal', () => {
      service.flushPendingInput('unknown');
      expect(mockSendInput).not.toHaveBeenCalled();
    });

    it('should be a no-op when buffer is empty', () => {
      service.queueInputData('terminal-1', 'a', true);
      mockSendInput.mockClear();

      // Buffer is now empty after immediate flush
      service.flushPendingInput('terminal-1');
      expect(mockSendInput).not.toHaveBeenCalled();
    });

    it('should cancel pending timer when flushing manually', () => {
      service.queueInputData('terminal-1', 'a', false);

      // Manually flush before timer fires
      service.flushPendingInput('terminal-1');
      expect(mockSendInput).toHaveBeenCalledWith('a', 'terminal-1');
      mockSendInput.mockClear();

      // Timer fires but buffer is empty, no duplicate send
      vi.advanceTimersByTime(10);
      expect(mockSendInput).not.toHaveBeenCalled();
    });
  });

  describe('shouldFlushImmediately', () => {
    const makeKeyboardEvent = (key: string): KeyboardEvent => {
      return new dom.window.KeyboardEvent('keydown', { key }) as unknown as KeyboardEvent;
    };

    it('should return true for empty data', () => {
      expect(service.shouldFlushImmediately('', makeKeyboardEvent('a'))).toBe(true);
    });

    it('should return true for Enter key', () => {
      expect(service.shouldFlushImmediately('\r', makeKeyboardEvent('Enter'))).toBe(true);
    });

    it('should return true for Backspace key', () => {
      expect(service.shouldFlushImmediately('\x7f', makeKeyboardEvent('Backspace'))).toBe(true);
    });

    it('should return true for Delete key', () => {
      expect(service.shouldFlushImmediately('\x1b[3~', makeKeyboardEvent('Delete'))).toBe(true);
    });

    it('should return true for data containing newline', () => {
      expect(service.shouldFlushImmediately('hello\n', makeKeyboardEvent('a'))).toBe(true);
    });

    it('should return true for data containing carriage return', () => {
      expect(service.shouldFlushImmediately('hello\r', makeKeyboardEvent('a'))).toBe(true);
    });

    it('should return false for regular character input', () => {
      expect(service.shouldFlushImmediately('a', makeKeyboardEvent('a'))).toBe(false);
    });

    it('should return false for multi-char non-newline data', () => {
      expect(service.shouldFlushImmediately('abc', makeKeyboardEvent('c'))).toBe(false);
    });
  });

  describe('clearTerminalBuffer', () => {
    it('should clear buffered data and cancel timer for a terminal', () => {
      service.queueInputData('terminal-1', 'a', false);
      service.clearTerminalBuffer('terminal-1');

      vi.advanceTimersByTime(10);

      expect(mockSendInput).not.toHaveBeenCalled();
    });

    it('should be a no-op for an unknown terminal', () => {
      expect(() => service.clearTerminalBuffer('unknown')).not.toThrow();
    });

    it('should not affect other terminals', () => {
      service.queueInputData('terminal-1', 'a', false);
      service.queueInputData('terminal-2', 'b', false);

      service.clearTerminalBuffer('terminal-1');

      vi.advanceTimersByTime(10);

      expect(mockSendInput).not.toHaveBeenCalledWith('a', 'terminal-1');
      expect(mockSendInput).toHaveBeenCalledWith('b', 'terminal-2');
    });
  });

  describe('dispose', () => {
    it('should clear all pending timers and buffers', () => {
      service.queueInputData('terminal-1', 'a', false);
      service.queueInputData('terminal-2', 'b', false);

      service.dispose();

      vi.advanceTimersByTime(10);

      expect(mockSendInput).not.toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      service.dispose();
      expect(() => service.dispose()).not.toThrow();
    });
  });
});
