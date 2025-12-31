import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageLogger, LogLevel, createMessageLogger } from '../../../../../../messaging/patterns/core/MessageLogger';

describe('MessageLogger', () => {
  let logger: MessageLogger;
  let outputFn: any;

  beforeEach(() => {
    outputFn = vi.fn();
    logger = new MessageLogger({
      minLevel: LogLevel.DEBUG,
      outputFn,
      includeTimestamp: false, // Simplify assertion
      includeSource: true
    });
  });

  it('should log messages', () => {
    logger.info('Test', 'Info message');
    expect(outputFn).toHaveBeenCalledWith(expect.objectContaining({
      level: LogLevel.INFO,
      source: 'Test',
      message: 'Info message'
    }));
  });

  it('should respect min level', () => {
    logger = new MessageLogger({ minLevel: LogLevel.WARN, outputFn });
    logger.info('Test', 'Info');
    logger.warn('Test', 'Warn');

    expect(outputFn).toHaveBeenCalledTimes(1);
    expect(outputFn).toHaveBeenCalledWith(expect.objectContaining({ level: LogLevel.WARN }));
  });

  it('should maintain history', () => {
    logger.info('Test', '1');
    logger.info('Test', '2');

    const history = logger.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].message).toBe('1');
    expect(history[1].message).toBe('2');
  });

  it('should clear history', () => {
    logger.info('Test', '1');
    logger.clearHistory();
    expect(logger.getHistory()).toHaveLength(0);
  });

  it('should create child logger', () => {
    const child = logger.createChild('Child');
    child.info('Message');

    expect(outputFn).toHaveBeenCalledWith(expect.objectContaining({
      source: 'Child',
      message: 'Message'
    }));
  });

  describe('Specialized methods', () => {
    it('logMessageReceived', () => {
      logger.logMessageReceived('Test', { command: 'cmd' });
      expect(outputFn).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.DEBUG,
        message: 'Message received: cmd'
      }));
    });

    it('logHandlingFailed', () => {
      logger.logHandlingFailed('Test', { command: 'cmd' }, 'Handler', new Error('Fail'));
      expect(outputFn).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.ERROR,
        message: 'Handler \'Handler\' failed for cmd: Fail'
      }));
    });
  });

  describe('createMessageLogger', () => {
    it('should create default instance', () => {
      const logger = createMessageLogger();
      expect(logger).toBeInstanceOf(MessageLogger);
    });
  });
});
