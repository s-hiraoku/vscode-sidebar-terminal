import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger, LogLevel, isDebugEnabled, isInfoEnabled } from '../../../../utils/logger';

describe('Logger Utility', () => {
  let logSpy: any;
  let warnSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Default to DEBUG for testing
    logger.setLevel(LogLevel.DEBUG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LogLevel Management', () => {
    it('should correctly report enabled levels', () => {
      logger.setLevel(LogLevel.DEBUG);
      expect(isDebugEnabled()).toBe(true);
      expect(isInfoEnabled()).toBe(true);

      logger.setLevel(LogLevel.WARN);
      expect(isDebugEnabled()).toBe(false);
      expect(isInfoEnabled()).toBe(false);
    });
  });

  describe('Basic Logging', () => {
    it('should log info messages when level allows', () => {
      logger.setLevel(LogLevel.INFO);
      logger.info('Test info');
      expect(logSpy).toHaveBeenCalledWith('[INFO]', 'Test info');
    });

    it('should not log debug when level is INFO', () => {
      logger.setLevel(LogLevel.INFO);
      logger.debug('Test debug');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log errors when level allows', () => {
      logger.setLevel(LogLevel.ERROR);
      logger.error('Critical failure');
      expect(errorSpy).toHaveBeenCalledWith('[ERROR]', 'Critical failure');
    });
  });

  describe('Categorized Logging', () => {
    it('should format categorized messages with icons', () => {
      logger.terminal('New terminal');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('✨ [DEBUG:TERMINAL]'),
        'New terminal'
      );
    });

    it('should format webview messages', () => {
      logger.webview('Message received');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('🌐 [DEBUG:WEBVIEW]'),
        'Message received'
      );
    });
  });

  describe('Safe Object Serialization', () => {
    it('should handle circular references gracefully', () => {
      const circular: any = { name: 'circle' };
      circular.self = circular;
      
      logger.info('Circular:', circular);
      
      // Should not crash and should contain indication of complex object
      expect(logSpy).toHaveBeenCalled();
      const call = logSpy.mock.calls[0];
      expect(call[2]).toContain('[Complex Object]');
    });

    it('should pretty print normal objects', () => {
      const obj = { a: 1, b: { c: 2 } };
      logger.info('Obj:', obj);
      
      const call = logSpy.mock.calls[0];
      expect(call[2]).toContain('"a": 1');
      expect(call[2]).toContain('"c": 2');
    });
  });

  describe('Production Buffering', () => {
    it('should flush buffer on dispose', () => {
      // Manually set production mode for this test
      (logger as any).isProduction = true;
      (logger as any).addToBuffer('log', ['Buffered message']);
      
      expect(logSpy).not.toHaveBeenCalled();
      
      logger.dispose();
      // In current impl, flushBuffer doesn't log to console.log in prod path
      // but we verify the buffer is cleared.
      expect((logger as any).logBuffer.length).toBe(0);
      
      // Reset for other tests
      (logger as any).isProduction = false;
    });
  });
});