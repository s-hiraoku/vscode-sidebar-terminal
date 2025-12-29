/**
 * Logger Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger, LogLevel, debug, info, warn, error, terminal, webview } from '../../../../utils/logger';

describe('Logger', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Set to DEBUG level for testing
    logger.setLevel(LogLevel.DEBUG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Levels and Filtering', () => {
    it('should respect DEBUG level', () => {
      logger.setLevel(LogLevel.DEBUG);
      debug('test debug');
      expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG]', 'test debug');
    });

    it('should respect ERROR level and filter others', () => {
      logger.setLevel(LogLevel.ERROR);
      debug('test debug');
      info('test info');
      warn('test warn');
      error('test error');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', 'test error');
    });

    it('should disable all logging when set to NONE', () => {
      logger.setLevel(LogLevel.NONE);
      error('none');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Categorized Logging', () => {
    beforeEach(() => {
      logger.setLevel(LogLevel.DEBUG);
    });

    it('should format terminal logs with emoji', () => {
      terminal('terminal message');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✨ [DEBUG:TERMINAL]'), 
        'terminal message'
      );
    });

    it('should format webview logs with emoji', () => {
      webview('webview message');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🌐 [DEBUG:WEBVIEW]'), 
        'webview message'
      );
    });

    it('should handle object arguments by stringifying them', () => {
      info('data', { a: 1 });
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', 'data', expect.stringContaining('"a": 1'));
    });
  });

  describe('Query Helpers', () => {
    it('should return correct status for enabled levels', () => {
      logger.setLevel(LogLevel.INFO);
      expect(logger.isDebugEnabled()).toBe(false);
      expect(logger.isInfoEnabled()).toBe(true);
    });
  });
});
