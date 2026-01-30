import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoggerService, LogLevel } from '../../../../../src/services/LoggerService';
import * as vscode from 'vscode';

describe('LoggerService', () => {
  let mockOutputChannel: any;
  let mockConfig: any;
  let onDidChangeConfigurationCallbacks: Function[] = [];

  beforeEach(() => {
    // Reset singleton
    (LoggerService as any).instance = null;

    // Mock OutputChannel
    mockOutputChannel = {
      appendLine: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    };

    // Mock Configuration
    mockConfig = {
      get: vi.fn((key: string, defaultValue: any) => defaultValue),
    };

    // Setup VS Code mocks
    (vscode.window.createOutputChannel as any).mockReturnValue(mockOutputChannel);
    (vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig);
    
    // Reset callbacks
    onDidChangeConfigurationCallbacks = [];
    (vscode.workspace.onDidChangeConfiguration as any).mockImplementation((callback: Function) => {
      onDidChangeConfigurationCallbacks.push(callback);
      return { dispose: vi.fn() };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = LoggerService.getInstance();
      const instance2 = LoggerService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create output channel on initialization', () => {
      LoggerService.getInstance();
      expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('Secondary Terminal');
    });
  });

  describe('Log Levels', () => {
    let logger: LoggerService;

    beforeEach(() => {
      logger = LoggerService.getInstance();
      logger.setLogLevel(LogLevel.INFO);
    });

    it('should log messages at or above the configured level', () => {
      logger.info('Info message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalled();
    });

    it('should not log messages below the configured level', () => {
      logger.debug('Debug message');
      expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    });

    it('should log warn and error messages when level is INFO', () => {
      logger.warn('Warn message');
      logger.error('Error message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(2);
    });
  });

  describe('Message Formatting', () => {
    let logger: LoggerService;

    beforeEach(() => {
      logger = LoggerService.getInstance();
      // Configure for predictable testing
      mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'level') return 'info';
        if (key === 'enableTimestamp') return false;
        if (key === 'enableContext') return true;
        return defaultValue;
      });
      
      // Force reload config by simulating change or just creating new instance if mocking works right
      // Since we mock getConfiguration, we need to make sure loadConfig is called.
      // But loadConfig is called in constructor.
    });

    it('should format message with context', () => {
      // Re-create to pick up mock config
      (LoggerService as any).instance = null;
      logger = LoggerService.getInstance();
      // Force settings via private access or public setter if available?
      // The class has setLogLevel but not others.
      // We rely on constructor calling loadConfig which calls mocked getConfiguration.

      logger.info('Test message', 'TestContext');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [TestContext] Test message')
      );
    });

    it('should handle data objects', () => {
      (LoggerService as any).instance = null;
      logger = LoggerService.getInstance();

      const data = { key: 'value' };
      logger.info('Data message', undefined, data);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(data, null, 2))
      );
    });
  });

  describe('Configuration', () => {
    it('should load configuration from VS Code settings', () => {
      mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'level') return 'debug';
        return defaultValue;
      });

      const logger = LoggerService.getInstance();
      expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
    });

    it('should update configuration when changed', () => {
      const logger = LoggerService.getInstance();
      
      // Change mock to return new value
      mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'level') return 'error';
        return defaultValue;
      });

      // Simulate change event
      const event = {
        affectsConfiguration: (section: string) => section === 'secondaryTerminal.logging'
      };
      
      onDidChangeConfigurationCallbacks.forEach(cb => cb(event));

      expect(logger.getLogLevel()).toBe(LogLevel.ERROR);
    });
  });

  describe('Disposal', () => {
    it('should dispose output channel and listeners', () => {
      const logger = LoggerService.getInstance();
      logger.dispose();

      expect(mockOutputChannel.dispose).toHaveBeenCalled();
    });
  });
});
