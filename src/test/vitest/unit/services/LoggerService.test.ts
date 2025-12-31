import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoggerService, LogLevel } from '../../../../services/LoggerService';
import * as vscode from 'vscode';

const mocks = vi.hoisted(() => {
  return {
    outputChannel: {
      appendLine: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    },
    configuration: {
      get: vi.fn(),
    },
    onDidChangeConfiguration: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  };
});

vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn().mockReturnValue(mocks.outputChannel),
  },
  workspace: {
    getConfiguration: vi.fn().mockReturnValue(mocks.configuration),
    onDidChangeConfiguration: mocks.onDidChangeConfiguration,
  },
}));

describe('LoggerService', () => {
  let logger: LoggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default config: DEBUG level
    mocks.configuration.get.mockImplementation((key, def) => {
      if (key === 'level') return 'DEBUG';
      if (key === 'enableTimestamp') return true;
      if (key === 'enableContext') return true;
      return def;
    });
    
    logger = LoggerService.getInstance();
  });

  afterEach(() => {
    logger.dispose();
  });

  it('should be a singleton', () => {
    const logger2 = LoggerService.getInstance();
    expect(logger).toBe(logger2);
  });

  describe('Logging levels', () => {
    it('should log debug messages', () => {
      logger.debug('debug message', 'context');
      expect(mocks.outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] [context] debug message'));
    });

    it('should log info messages', () => {
      logger.info('info message', 'context');
      expect(mocks.outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[INFO] [context] info message'));
    });

    it('should log warning messages', () => {
      logger.warn('warn message', 'context');
      expect(mocks.outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[WARN] [context] warn message'));
    });

    it('should log error messages', () => {
      logger.error('error message', 'context');
      expect(mocks.outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[ERROR] [context] error message'));
    });

    it('should respect log level filter', () => {
      logger.setLogLevel(LogLevel.ERROR);
      logger.info('info message');
      expect(mocks.outputChannel.appendLine).not.toHaveBeenCalled();
      
      logger.error('error message');
      expect(mocks.outputChannel.appendLine).toHaveBeenCalled();
    });
  });

  describe('Formatting', () => {
    it('should include JSON data', () => {
      logger.info('message', 'context', { foo: 'bar' });
      expect(mocks.outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('"foo": "bar"'));
    });

    it('should handle non-serializable data', () => {
      const circular: any = {};
      circular.self = circular;
      logger.info('message', 'context', circular);
      expect(mocks.outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[Circular or non-serializable data]'));
    });
  });

  describe('Lifecycle', () => {
    it('should show output channel', () => {
      logger.show();
      expect(mocks.outputChannel.show).toHaveBeenCalled();
    });

    it('should register configuration change listener', () => {
      expect(mocks.onDidChangeConfiguration).toHaveBeenCalled();
    });
  });
});
