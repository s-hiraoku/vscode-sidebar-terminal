/**
 * TerminalInitializationWatchdog Unit Tests
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { TerminalInitializationWatchdog } from '../../../../../providers/services/TerminalInitializationWatchdog';

describe('TerminalInitializationWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('invokes callback for each attempt until maxAttempts is reached', () => {
    const callback = vi.fn();
    const watchdog = new TerminalInitializationWatchdog(callback, {
      initialDelayMs: 100,
      maxAttempts: 3,
      backoffFactor: 2,
    });

    watchdog.start('terminal-1', 'unit');

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('terminal-1', {
      attempt: 1,
      isFinalAttempt: false,
    });

    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(400);
    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenLastCalledWith('terminal-1', { attempt: 3, isFinalAttempt: true });
  });

  it('stops timers when stop() is invoked', () => {
    const callback = vi.fn();
    const watchdog = new TerminalInitializationWatchdog(callback, {
      initialDelayMs: 100,
      maxAttempts: 2,
      backoffFactor: 2,
    });

    watchdog.start('terminal-2', 'pre-stop');
    watchdog.stop('terminal-2', 'manual');

    vi.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();
  });

  it('applies per-start override options', () => {
    const callback = vi.fn();
    const watchdog = new TerminalInitializationWatchdog(callback);

    watchdog.start('terminal-3', 'override', {
      initialDelayMs: 50,
      maxAttempts: 1,
    });

    vi.advanceTimersByTime(50);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('terminal-3', {
      attempt: 1,
      isFinalAttempt: true,
    });
  });
});
