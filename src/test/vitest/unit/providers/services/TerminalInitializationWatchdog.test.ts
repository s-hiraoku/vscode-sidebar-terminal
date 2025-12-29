/**
 * TerminalInitializationWatchdog Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalInitializationWatchdog } from '../../../../../providers/services/TerminalInitializationWatchdog';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

describe('TerminalInitializationWatchdog', () => {
  let watchdog: TerminalInitializationWatchdog;
  let mockCallback: any;
  const terminalId = 'term-123';

  beforeEach(() => {
    mockCallback = vi.fn();
    vi.useFakeTimers();
    watchdog = new TerminalInitializationWatchdog(mockCallback, {
      initialDelayMs: 100,
      maxAttempts: 3,
      backoffFactor: 2,
    });
  });

  afterEach(() => {
    watchdog.dispose();
    vi.useRealTimers();
  });

  it('should trigger callback after initial delay', () => {
    watchdog.start(terminalId, 'test');
    
    vi.advanceTimersByTime(100);
    expect(mockCallback).toHaveBeenCalledWith(terminalId, { attempt: 1, isFinalAttempt: false });
  });

  it('should use backoff for subsequent attempts', () => {
    watchdog.start(terminalId, 'test');
    
    // 1st attempt at 100ms
    vi.advanceTimersByTime(100);
    expect(mockCallback).toHaveBeenCalledTimes(1);
    
    // 2nd attempt at +200ms (100 * 2)
    vi.advanceTimersByTime(200);
    expect(mockCallback).toHaveBeenCalledTimes(2);
    expect(mockCallback).toHaveBeenLastCalledWith(terminalId, { attempt: 2, isFinalAttempt: false });
  });

  it('should stop after max attempts', () => {
    watchdog.start(terminalId, 'test');
    
    vi.advanceTimersByTime(100 + 200 + 400); // 1st, 2nd, 3rd (final)
    expect(mockCallback).toHaveBeenCalledTimes(3);
    expect(mockCallback).toHaveBeenLastCalledWith(terminalId, { attempt: 3, isFinalAttempt: true });
    
    // Should not trigger again
    vi.advanceTimersByTime(1000);
    expect(mockCallback).toHaveBeenCalledTimes(3);
  });

  it('should not trigger callback if stopped', () => {
    watchdog.start(terminalId, 'test');
    vi.advanceTimersByTime(50);
    
    watchdog.stop(terminalId, 'done');
    vi.advanceTimersByTime(100);
    
    expect(mockCallback).not.toHaveBeenCalled();
  });

  it('should handle multiple terminals independently', () => {
    const term2 = 'term-456';
    watchdog.start(terminalId, 'test1');
    vi.advanceTimersByTime(50);
    watchdog.start(term2, 'test2');
    
    vi.advanceTimersByTime(50);
    expect(mockCallback).toHaveBeenCalledWith(terminalId, expect.anything());
    expect(mockCallback).not.toHaveBeenCalledWith(term2, expect.anything());
    
    vi.advanceTimersByTime(50);
    expect(mockCallback).toHaveBeenCalledWith(term2, expect.anything());
  });

  it('should clean up on dispose', () => {
    watchdog.start(terminalId, 'test');
    watchdog.dispose();
    
    vi.advanceTimersByTime(1000);
    expect(mockCallback).not.toHaveBeenCalled();
  });
});