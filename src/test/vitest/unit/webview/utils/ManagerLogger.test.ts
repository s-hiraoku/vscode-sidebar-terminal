/**
 * ManagerLogger Utility Tests
 * Tests for standardized logging across managers with emoji prefixes
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ManagerLogger, inputLogger, splitLogger, terminalLogger, messageLogger, uiLogger } from '../../../../../webview/utils/ManagerLogger';

describe('ManagerLogger', () => {
  let logSpy: any;
  let warnSpy: any;
  let errorSpy: any;
  let infoSpy: any;
  let debugSpy: any;

  beforeEach(() => {
    // Clear history before spying to avoid interference
    ManagerLogger.clearHistory();

    // Mock console methods
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('should create logger with default emoji', () => {
      const logger = ManagerLogger.createLogger('TestManager');

      expect(logger).not.toBeNull();
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('error');
      expect(logger).toHaveProperty('debug');
      expect(logger).toHaveProperty('lifecycle');
    });

    it('should create logger with custom emoji', () => {
      const logger = ManagerLogger.createLogger('TestManager', '🔧');

      expect(logger).not.toBeNull();

      // Test that the emoji is used in logging
      logger.info('Test message');

      // Should have been called
      expect(logSpy).toHaveBeenCalled();
    });

    it('should handle empty manager name', () => {
      const logger = ManagerLogger.createLogger('');

      expect(logger).not.toBeNull();

      logger.info('Test message');
      expect(logSpy).toHaveBeenCalled();
    });

    it('should handle special characters in manager name', () => {
      const logger = ManagerLogger.createLogger('Test-Manager_123');

      expect(logger).not.toBeNull();

      logger.info('Test message');
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('pre-configured loggers', () => {
    it('should provide inputLogger', () => {
      expect(inputLogger).not.toBeNull();
      expect(inputLogger).toHaveProperty('info');

      inputLogger.info('Input test');
      expect(logSpy).toHaveBeenCalled();
    });

    it('should provide splitLogger', () => {
      expect(splitLogger).not.toBeNull();
      expect(splitLogger).toHaveProperty('info');

      splitLogger.info('Split test');
      expect(logSpy).toHaveBeenCalled();
    });

    it('should provide terminalLogger', () => {
      expect(terminalLogger).not.toBeNull();
      expect(terminalLogger).toHaveProperty('info');

      terminalLogger.info('Terminal test');
      expect(logSpy).toHaveBeenCalled();
    });

    it('should provide messageLogger', () => {
      expect(messageLogger).not.toBeNull();
      expect(messageLogger).toHaveProperty('info');

      messageLogger.info('Message test');
      expect(logSpy).toHaveBeenCalled();
    });

    it('should provide uiLogger', () => {
      expect(uiLogger).not.toBeNull();
      expect(uiLogger).toHaveProperty('info');

      uiLogger.info('UI test');
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('logging methods', () => {
    let logger: any;

    beforeEach(() => {
      logger = ManagerLogger.createLogger('TestManager', '🧪');
    });

    it('should log info messages with correct format', () => {
      logger.info('Test info message');

      expect(logSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringMatching(/🧪.*TestManager.*Test info message/)
      );
    });

    it('should log info messages with data', () => {
      const testData = { key: 'value', number: 42 };
      logger.info('Test info with data', testData);

      // 1 call for message, 1 call for data prefix, 1 for data itself? 
      // Actually baseLog is called twice in ManagerLogger.log:
      // 1. baseLog(formattedMessage)
      // 2. baseLog(`🔍 [${this.managerName}] Data:`, data)
      expect(logSpy).toHaveBeenCalledTimes(2);
    });

    it('should log warn messages with correct format', () => {
      logger.warn('Test warning message');

      expect(logSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringMatching(/WARN.*🧪.*TestManager.*Test warning message/)
      );
    });

    it('should log error messages with correct format', () => {
      logger.error('Test error message');

      expect(logSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringMatching(/ERROR.*🧪.*TestManager.*Test error message/)
      );
    });

    it('should log debug messages with correct format', () => {
      logger.debug('Test debug message');

      expect(logSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringMatching(/DEBUG.*🧪.*TestManager.*Test debug message/)
      );
    });
  });

  describe('lifecycle logging', () => {
    let logger: any;

    beforeEach(() => {
      logger = ManagerLogger.createLogger('LifecycleManager', '♻️');
    });

    it('should log lifecycle events with correct format', () => {
      logger.lifecycle('initialization', 'starting');

      expect(logSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringMatching(/♻️.*LifecycleManager.*initialization.*starting/)
      );
    });

    it('should handle different lifecycle phases', () => {
      logger.lifecycle('startup', 'completed');
      logger.lifecycle('shutdown', 'in_progress');
      logger.lifecycle('cleanup', 'failed');

      expect(logSpy).toHaveBeenCalledTimes(3);
    });

    it('should handle empty lifecycle parameters', () => {
      expect(() => {
        logger.lifecycle('', '' as any);
      }).not.toThrow();

      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    let logger: any;

    beforeEach(() => {
      logger = ManagerLogger.createLogger('ErrorTestManager', '💥');
    });

    it('should handle null/undefined messages', () => {
      expect(() => {
        logger.info(null as any);
        logger.warn(undefined as any);
        logger.error(null as any);
        logger.debug(undefined as any);
      }).not.toThrow();

      expect(logSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should handle circular reference objects', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      expect(() => {
        logger.info('Circular object test', circularObj);
      }).not.toThrow();

      expect(logSpy).toHaveBeenCalled();
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);

      expect(() => {
        logger.info(longMessage);
      }).not.toThrow();

      expect(logSpy).toHaveBeenCalled();
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Test\n\t\r\x00\uD83D\uDE00特殊字符';

      expect(() => {
        logger.info(specialMessage);
      }).not.toThrow();

      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('performance', () => {
    it('should handle rapid logging calls', () => {
      const logger = ManagerLogger.createLogger('PerfTestManager', '⚡');

      expect(() => {
        for (let i = 0; i < 1000; i++) {
          logger.info(`Message ${i}`);
        }
      }).not.toThrow();

      expect(logSpy).toHaveBeenCalledTimes(1000);
    });

    it('should handle logging with large data objects', () => {
      const logger = ManagerLogger.createLogger('DataTestManager', '📊');
      const largeData = {
        array: new Array(1000).fill(0).map((_, i) => ({ id: i, name: `Item ${i}` })),
        nested: {
          deep: {
            value: 'test',
            moreData: new Array(100).fill('data'),
          },
        },
      };

      expect(() => {
        logger.info('Large data test', largeData);
      }).not.toThrow();

      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('integration with webview logger', () => {
    it('should use webview logger for actual output', () => {
      const logger = ManagerLogger.createLogger('WebviewTestManager', '🌐');

      logger.info('Integration test');

      // Should call console.log (which is mocked via Logger.webview)
      expect(logSpy).toHaveBeenCalled();
    });
  });
});
