/**
 * Logger Unit Tests
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import '../../../shared/TestSetup';
import { logger, LogLevel } from '../../../../utils/logger';

describe('Logger', () => {
  let dom: JSDOM;
  let consoleLogStub: ReturnType<typeof vi.fn>;
  let consoleWarnStub: ReturnType<typeof vi.fn>;
  let consoleErrorStub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock console before JSDOM creation
    consoleLogStub = vi.fn();
    consoleWarnStub = vi.fn();
    consoleErrorStub = vi.fn();

    (global as Record<string, unknown>).console = {
      log: consoleLogStub,
      warn: consoleWarnStub,
      error: consoleErrorStub,
      debug: vi.fn(),
      info: vi.fn(),
      trace: vi.fn(),
      assert: vi.fn(),
      clear: vi.fn(),
      count: vi.fn(),
      countReset: vi.fn(),
      group: vi.fn(),
      groupCollapsed: vi.fn(),
      groupEnd: vi.fn(),
      table: vi.fn(),
      time: vi.fn(),
      timeEnd: vi.fn(),
      timeLog: vi.fn(),
      timeStamp: vi.fn(),
      profile: vi.fn(),
      profileEnd: vi.fn(),
      dir: vi.fn(),
      dirxml: vi.fn(),
    };

    // Mock DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable',
    });

    (global as Record<string, unknown>).window = dom.window;
    (global as Record<string, unknown>).document = dom.window.document;

    // Reset logger to default state
    logger.setLevel(LogLevel.DEBUG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    dom.window.close();
  });

  describe('setLevel method', () => {
    it('should set log level', () => {
      logger.setLevel(LogLevel.ERROR);
      // Test that the level was set by checking logging behavior
      logger.debug('debug message');
      expect(consoleLogStub).not.toHaveBeenCalled();
    });
  });

  describe('debug method', () => {
    it('should log debug message when level is debug', () => {
      logger.setLevel(LogLevel.DEBUG);

      logger.debug('test debug message');

      expect(consoleLogStub).toHaveBeenCalledWith('[DEBUG]', 'test debug message');
    });

    it('should not log debug message when level is info', () => {
      logger.setLevel(LogLevel.INFO);

      logger.debug('test debug message');

      expect(consoleLogStub).not.toHaveBeenCalled();
    });
  });

  describe('info method', () => {
    it('should log info message when level is info', () => {
      logger.setLevel(LogLevel.INFO);

      logger.info('test info message');

      expect(consoleLogStub).toHaveBeenCalledWith('[INFO]', 'test info message');
    });

    it('should not log info message when level is warn', () => {
      logger.setLevel(LogLevel.WARN);

      logger.info('test info message');

      expect(consoleLogStub).not.toHaveBeenCalled();
    });
  });

  describe('warn method', () => {
    it('should log warn message when level is warn', () => {
      logger.setLevel(LogLevel.WARN);

      logger.warn('test warn message');

      expect(consoleWarnStub).toHaveBeenCalledWith('[WARN]', 'test warn message');
    });

    it('should not log warn message when level is error', () => {
      logger.setLevel(LogLevel.ERROR);

      logger.warn('test warn message');

      expect(consoleWarnStub).not.toHaveBeenCalled();
    });
  });

  describe('error method', () => {
    it('should log error message when level is error', () => {
      logger.setLevel(LogLevel.ERROR);

      logger.error('test error message');

      expect(consoleErrorStub).toHaveBeenCalledWith('[ERROR]', 'test error message');
    });

    it('should not log error message when level is none', () => {
      logger.setLevel(LogLevel.NONE);

      logger.error('test error message');

      expect(consoleErrorStub).not.toHaveBeenCalled();
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      logger.setLevel(LogLevel.DEBUG);
    });

    it('should log terminal message with formatted timestamp', () => {
      logger.terminal('terminal test');

      expect(consoleLogStub).toHaveBeenCalled();
      const call = consoleLogStub.mock.calls[0];
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] ✨ \[DEBUG:TERMINAL\]/);
      expect(call[1]).toBe('terminal test');
    });

    it('should log webview message with formatted timestamp', () => {
      logger.webview('webview test');

      expect(consoleLogStub).toHaveBeenCalled();
      const call = consoleLogStub.mock.calls[0];
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] 🌐 \[DEBUG:WEBVIEW\]/);
      expect(call[1]).toBe('webview test');
    });

    it('should log provider message with formatted timestamp', () => {
      logger.provider('provider test');

      expect(consoleLogStub).toHaveBeenCalled();
      const call = consoleLogStub.mock.calls[0];
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] 📡 \[DEBUG:PROVIDER\]/);
      expect(call[1]).toBe('provider test');
    });

    it('should log extension message with formatted timestamp', () => {
      logger.extension('extension test');

      expect(consoleLogStub).toHaveBeenCalled();
      const call = consoleLogStub.mock.calls[0];
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] 🔧 \[DEBUG:EXTENSION\]/);
      expect(call[1]).toBe('extension test');
    });

    it('should log performance message with formatted timestamp', () => {
      logger.performance('performance test');

      expect(consoleLogStub).toHaveBeenCalled();
      const call = consoleLogStub.mock.calls[0];
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] ⚡ \[DEBUG:PERF\]/);
      expect(call[1]).toBe('performance test');
    });

    // Test new categorized methods
    it('should log message category', () => {
      logger.message('message test');

      expect(consoleLogStub).toHaveBeenCalled();
      const call = consoleLogStub.mock.calls[0];
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] 📨 \[DEBUG:MESSAGE\]/);
      expect(call[1]).toBe('message test');
    });

    it('should log ui category', () => {
      logger.ui('ui test');

      expect(consoleLogStub).toHaveBeenCalled();
      const call = consoleLogStub.mock.calls[0];
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] 🎨 \[DEBUG:UI\]/);
      expect(call[1]).toBe('ui test');
    });

    it('should log session category with INFO level', () => {
      logger.setLevel(LogLevel.INFO);
      logger.session('session test');

      expect(consoleLogStub).toHaveBeenCalled();
      const call = consoleLogStub.mock.calls[0];
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] 💾 \[INFO:SESSION\]/);
      expect(call[1]).toBe('session test');
    });

    it('should log agent category with INFO level', () => {
      logger.setLevel(LogLevel.INFO);
      logger.agent('agent test');

      expect(consoleLogStub).toHaveBeenCalled();
      const call = consoleLogStub.mock.calls[0];
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] 🤖 \[INFO:AGENT\]/);
      expect(call[1]).toBe('agent test');
    });

    it('should log success category with INFO level', () => {
      logger.setLevel(LogLevel.INFO);
      logger.success('success test');

      expect(consoleLogStub).toHaveBeenCalled();
      const call = consoleLogStub.mock.calls[0];
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] ✅ \[INFO:SUCCESS\]/);
      expect(call[1]).toBe('success test');
    });

    it('should not log debug category when level is INFO', () => {
      logger.setLevel(LogLevel.INFO);
      logger.debug_category('debug test');

      expect(consoleLogStub).not.toHaveBeenCalled();
    });

    it('should log error category with ERROR level', () => {
      logger.setLevel(LogLevel.ERROR);
      logger.error_category('error test');

      expect(consoleErrorStub).toHaveBeenCalled();
      const call = consoleErrorStub.mock.calls[0];
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] 🚨 \[ERROR:ERROR\]/);
      expect(call[1]).toBe('error test');
    });

    it('should log warning category with WARN level', () => {
      logger.setLevel(LogLevel.WARN);
      logger.warning_category('warning test');

      expect(consoleWarnStub).toHaveBeenCalled();
      const call = consoleWarnStub.mock.calls[0];
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] ⚠️ \[WARN:WARNING\]/);
      expect(call[1]).toBe('warning test');
    });
  });

  describe('object logging', () => {
    beforeEach(() => {
      logger.setLevel(LogLevel.DEBUG);
    });

    it('should safely stringify objects', () => {
      const testObj = { key: 'value', nested: { prop: 'test' } };

      logger.debug('object test', testObj);

      expect(consoleLogStub).toHaveBeenCalledWith(
        '[DEBUG]',
        'object test',
        JSON.stringify(testObj, null, 2)
      );
    });

    it('should handle circular references', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const circularObj: any = { prop: 'value' };
      circularObj.self = circularObj;

      logger.debug('circular test', circularObj);

      expect(consoleLogStub).toHaveBeenCalledWith('[DEBUG]', 'circular test', '[Complex Object]');
    });

    it('should handle primitives', () => {
      logger.debug('string', 'test', 'number', 123, 'boolean', true, 'null', null);

      expect(consoleLogStub).toHaveBeenCalledWith(
        '[DEBUG]',
        'string',
        'test',
        'number',
        123,
        'boolean',
        true,
        'null',
        'null'
      );
    });
  });
});
