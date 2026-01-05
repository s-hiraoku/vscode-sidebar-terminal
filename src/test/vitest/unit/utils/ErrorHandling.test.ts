import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ErrorSeverity,
  ErrorCategory,
  TerminalError,
  SessionError,
  ConfigurationError,
  CommunicationError,
  ResourceError,
  ErrorHandlingManager,
  errorToString,
  getStackTrace,
  isRecoverableError,
  withErrorHandling,
} from '../../../../utils/ErrorHandling';

// Mock vscode module
vi.mock('vscode', () => ({
  window: {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  log: vi.fn(),
}));

import * as vscode from 'vscode';

describe('ErrorHandling', () => {
  describe('ErrorSeverity enum', () => {
    it('should have INFO value', () => {
      expect(ErrorSeverity.INFO).toBe('info');
    });

    it('should have WARNING value', () => {
      expect(ErrorSeverity.WARNING).toBe('warning');
    });

    it('should have ERROR value', () => {
      expect(ErrorSeverity.ERROR).toBe('error');
    });

    it('should have CRITICAL value', () => {
      expect(ErrorSeverity.CRITICAL).toBe('critical');
    });
  });

  describe('ErrorCategory enum', () => {
    it('should have TERMINAL value', () => {
      expect(ErrorCategory.TERMINAL).toBe('terminal');
    });

    it('should have SESSION value', () => {
      expect(ErrorCategory.SESSION).toBe('session');
    });

    it('should have CONFIGURATION value', () => {
      expect(ErrorCategory.CONFIGURATION).toBe('config');
    });

    it('should have WEBVIEW value', () => {
      expect(ErrorCategory.WEBVIEW).toBe('webview');
    });

    it('should have COMMUNICATION value', () => {
      expect(ErrorCategory.COMMUNICATION).toBe('communication');
    });

    it('should have RESOURCE value', () => {
      expect(ErrorCategory.RESOURCE).toBe('resource');
    });

    it('should have UNKNOWN value', () => {
      expect(ErrorCategory.UNKNOWN).toBe('unknown');
    });
  });

  describe('TerminalError', () => {
    it('should create error with correct category', () => {
      const error = new TerminalError('Test message', 'TestComponent');

      expect(error.message).toBe('Test message');
      expect(error.context.category).toBe(ErrorCategory.TERMINAL);
      expect(error.context.component).toBe('TestComponent');
      expect(error.context.severity).toBe(ErrorSeverity.ERROR);
      expect(error.recoverable).toBe(true);
    });

    it('should create error with operation', () => {
      const error = new TerminalError('Test message', 'TestComponent', 'testOperation');

      expect(error.context.operation).toBe('testOperation');
    });

    it('should create non-recoverable error', () => {
      const error = new TerminalError('Test message', 'TestComponent', 'testOp', false);

      expect(error.recoverable).toBe(false);
    });

    it('should have correct name', () => {
      const error = new TerminalError('Test message', 'TestComponent');

      expect(error.name).toBe('TerminalError');
    });

    it('should generate error report', () => {
      const error = new TerminalError('Test message', 'TestComponent', 'testOp');
      const report = error.toReport();

      expect(report.message).toBe('Test message');
      expect(report.context.category).toBe(ErrorCategory.TERMINAL);
      expect(report.error).toBe(error);
      expect(report.recoverable).toBe(true);
    });
  });

  describe('SessionError', () => {
    it('should create error with correct category', () => {
      const error = new SessionError('Session failed', 'SessionManager');

      expect(error.message).toBe('Session failed');
      expect(error.context.category).toBe(ErrorCategory.SESSION);
      expect(error.context.component).toBe('SessionManager');
      expect(error.recoverable).toBe(true);
    });

    it('should create non-recoverable session error', () => {
      const error = new SessionError('Session failed', 'SessionManager', 'save', false);

      expect(error.recoverable).toBe(false);
      expect(error.context.operation).toBe('save');
    });
  });

  describe('ConfigurationError', () => {
    it('should create error with WARNING severity', () => {
      const error = new ConfigurationError('Config invalid', 'ConfigManager');

      expect(error.context.category).toBe(ErrorCategory.CONFIGURATION);
      expect(error.context.severity).toBe(ErrorSeverity.WARNING);
      expect(error.recoverable).toBe(true);
    });
  });

  describe('CommunicationError', () => {
    it('should create error with default non-recoverable', () => {
      const error = new CommunicationError('Connection failed', 'MessageHandler');

      expect(error.context.category).toBe(ErrorCategory.COMMUNICATION);
      expect(error.recoverable).toBe(false);
    });

    it('should create recoverable communication error', () => {
      const error = new CommunicationError('Retry needed', 'MessageHandler', 'send', true);

      expect(error.recoverable).toBe(true);
    });
  });

  describe('ResourceError', () => {
    it('should create error with CRITICAL severity and non-recoverable', () => {
      const error = new ResourceError('Resource exhausted', 'ResourceManager');

      expect(error.context.category).toBe(ErrorCategory.RESOURCE);
      expect(error.context.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.recoverable).toBe(false);
    });
  });

  describe('ErrorHandlingManager', () => {
    let manager: ErrorHandlingManager;

    beforeEach(() => {
      manager = ErrorHandlingManager.getInstance();
      manager.clearErrorLog();
      vi.clearAllMocks();
    });

    describe('getInstance', () => {
      it('should return singleton instance', () => {
        const instance1 = ErrorHandlingManager.getInstance();
        const instance2 = ErrorHandlingManager.getInstance();

        expect(instance1).toBe(instance2);
      });
    });

    describe('handleError', () => {
      it('should handle BaseError correctly', () => {
        const error = new TerminalError('Terminal error', 'TestComponent');
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const report = manager.handleError(error);

        expect(report.message).toBe('Terminal error');
        expect(report.context.category).toBe(ErrorCategory.TERMINAL);
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Terminal error');
      });

      it('should handle standard Error', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const error = new Error('Standard error');

        const report = manager.handleError(error, {
          category: ErrorCategory.UNKNOWN,
          component: 'TestComponent',
        });

        expect(report.message).toBe('Standard error');
        expect(report.error).toBe(error);
      });

      it('should handle string error', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const report = manager.handleError('String error', {
          component: 'TestComponent',
        });

        expect(report.message).toBe('String error');
      });

      it('should show information message for INFO severity', () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});

        manager.handleError('Info message', {
          severity: ErrorSeverity.INFO,
          component: 'TestComponent',
        });

        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Info message');
      });

      it('should show warning message for WARNING severity', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        manager.handleError('Warning message', {
          severity: ErrorSeverity.WARNING,
          component: 'TestComponent',
        });

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('Warning message');
      });
    });

    describe('executeWithErrorHandling', () => {
      it('should return result on success', async () => {
        const result = await manager.executeWithErrorHandling(
          async () => 'success',
          { component: 'TestComponent' }
        );

        expect(result).toBe('success');
      });

      it('should return fallback on recoverable error', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await manager.executeWithErrorHandling(
          async () => {
            throw new TerminalError('Failed', 'TestComponent');
          },
          { component: 'TestComponent' },
          'fallback'
        );

        expect(result).toBe('fallback');
      });

      it('should return null on non-recoverable error without fallback', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await manager.executeWithErrorHandling(
          async () => {
            throw new ResourceError('Critical failure', 'TestComponent');
          },
          { component: 'TestComponent' }
        );

        expect(result).toBeNull();
      });
    });

    describe('error handlers', () => {
      it('should register and call global handler', () => {
        const handler = vi.fn();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        manager.registerErrorHandler(handler);

        manager.handleError('Test error', {
          component: 'TestComponent',
        });

        expect(handler).toHaveBeenCalled();

        manager.unregisterErrorHandler(handler);
      });

      it('should register and call category handler', () => {
        const handler = vi.fn();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        manager.registerErrorHandler(handler, ErrorCategory.TERMINAL);

        const error = new TerminalError('Terminal error', 'TestComponent');
        manager.handleError(error);

        expect(handler).toHaveBeenCalled();

        manager.unregisterErrorHandler(handler, ErrorCategory.TERMINAL);
      });

      it('should not call category handler for different category', () => {
        const handler = vi.fn();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        manager.registerErrorHandler(handler, ErrorCategory.TERMINAL);

        const error = new SessionError('Session error', 'TestComponent');
        manager.handleError(error);

        expect(handler).not.toHaveBeenCalled();

        manager.unregisterErrorHandler(handler, ErrorCategory.TERMINAL);
      });

      it('should unregister handler', () => {
        const handler = vi.fn();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        manager.registerErrorHandler(handler);
        manager.unregisterErrorHandler(handler);

        manager.handleError('Test error', { component: 'TestComponent' });

        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('getErrorLog', () => {
      it('should return empty log initially', () => {
        const log = manager.getErrorLog();

        expect(log).toEqual([]);
      });

      it('should return error log', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        manager.handleError('Error 1', { component: 'TestComponent' });
        manager.handleError('Error 2', { component: 'TestComponent' });

        const log = manager.getErrorLog();

        expect(log).toHaveLength(2);
        expect(log[0].message).toBe('Error 1');
        expect(log[1].message).toBe('Error 2');
      });

      it('should filter by category', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        manager.handleError(new TerminalError('Terminal error', 'TestComponent'));
        manager.handleError(new SessionError('Session error', 'TestComponent'));

        const terminalLog = manager.getErrorLog(ErrorCategory.TERMINAL);

        expect(terminalLog).toHaveLength(1);
        expect(terminalLog[0].context.category).toBe(ErrorCategory.TERMINAL);
      });

      it('should respect limit', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        for (let i = 0; i < 10; i++) {
          manager.handleError(`Error ${i}`, { component: 'TestComponent' });
        }

        const log = manager.getErrorLog(undefined, 5);

        expect(log).toHaveLength(5);
        expect(log[0].message).toBe('Error 5');
        expect(log[4].message).toBe('Error 9');
      });
    });

    describe('getErrorStatistics', () => {
      it('should return empty statistics initially', () => {
        const stats = manager.getErrorStatistics();

        expect(stats.total).toBe(0);
        expect(stats.recoverable).toBe(0);
        expect(stats.unrecoverable).toBe(0);
      });

      it('should calculate statistics correctly', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        manager.handleError(new TerminalError('Error 1', 'TestComponent'));
        manager.handleError(new SessionError('Error 2', 'TestComponent'));
        manager.handleError(new ResourceError('Error 3', 'TestComponent'));

        const stats = manager.getErrorStatistics();

        expect(stats.total).toBe(3);
        expect(stats.byCategory[ErrorCategory.TERMINAL]).toBe(1);
        expect(stats.byCategory[ErrorCategory.SESSION]).toBe(1);
        expect(stats.byCategory[ErrorCategory.RESOURCE]).toBe(1);
        expect(stats.recoverable).toBe(2);
        expect(stats.unrecoverable).toBe(1);
      });

      it('should track severity counts', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        manager.handleError(new TerminalError('Error 1', 'TestComponent'));
        manager.handleError(new ConfigurationError('Warning 1', 'TestComponent'));
        manager.handleError(new ResourceError('Critical 1', 'TestComponent'));

        const stats = manager.getErrorStatistics();

        expect(stats.bySeverity[ErrorSeverity.ERROR]).toBe(1);
        expect(stats.bySeverity[ErrorSeverity.WARNING]).toBe(1);
        expect(stats.bySeverity[ErrorSeverity.CRITICAL]).toBe(1);
      });
    });

    describe('clearErrorLog', () => {
      it('should clear error log', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        manager.handleError('Error 1', { component: 'TestComponent' });
        manager.handleError('Error 2', { component: 'TestComponent' });

        manager.clearErrorLog();

        expect(manager.getErrorLog()).toHaveLength(0);
      });
    });
  });

  describe('Utility functions', () => {
    describe('errorToString', () => {
      it('should convert Error to string', () => {
        const error = new Error('Test message');

        expect(errorToString(error)).toBe('Test message');
      });

      it('should convert string to string', () => {
        expect(errorToString('String error')).toBe('String error');
      });

      it('should convert number to string', () => {
        expect(errorToString(42)).toBe('42');
      });

      it('should convert object to string', () => {
        expect(errorToString({ key: 'value' })).toBe('[object Object]');
      });

      it('should convert null to string', () => {
        expect(errorToString(null)).toBe('null');
      });

      it('should convert undefined to string', () => {
        expect(errorToString(undefined)).toBe('undefined');
      });
    });

    describe('getStackTrace', () => {
      it('should return stack from Error', () => {
        const error = new Error('Test');

        expect(getStackTrace(error)).toBeDefined();
        expect(getStackTrace(error)).toContain('Error: Test');
      });

      it('should return undefined for non-Error', () => {
        expect(getStackTrace('string')).toBeUndefined();
        expect(getStackTrace(42)).toBeUndefined();
        expect(getStackTrace(null)).toBeUndefined();
      });
    });

    describe('isRecoverableError', () => {
      it('should return true for recoverable BaseError', () => {
        const error = new TerminalError('Test', 'Component');

        expect(isRecoverableError(error)).toBe(true);
      });

      it('should return false for non-recoverable BaseError', () => {
        const error = new ResourceError('Test', 'Component');

        expect(isRecoverableError(error)).toBe(false);
      });

      it('should return false for standard Error', () => {
        const error = new Error('Test');

        expect(isRecoverableError(error)).toBe(false);
      });

      it('should return false for non-error values', () => {
        expect(isRecoverableError('string')).toBe(false);
        expect(isRecoverableError(42)).toBe(false);
        expect(isRecoverableError(null)).toBe(false);
      });
    });
  });

  describe('withErrorHandling decorator', () => {
    it('should return a decorator function', () => {
      const decorator = withErrorHandling(ErrorCategory.TERMINAL, 'TestClass');

      expect(typeof decorator).toBe('function');
    });

    it('should modify property descriptor', () => {
      const decorator = withErrorHandling(ErrorCategory.TERMINAL, 'TestClass', true);
      const originalMethod = async () => 'original';
      const descriptor: PropertyDescriptor = {
        value: originalMethod,
        writable: true,
        enumerable: false,
        configurable: true,
      };

      const result = decorator({}, 'testMethod', descriptor);

      expect(result.value).not.toBe(originalMethod);
      expect(typeof result.value).toBe('function');
    });

    it('should execute wrapped method successfully', async () => {
      const decorator = withErrorHandling(ErrorCategory.TERMINAL, 'TestClass');
      const originalMethod = async () => 'success';
      const descriptor: PropertyDescriptor = {
        value: originalMethod,
        writable: true,
        enumerable: false,
        configurable: true,
      };

      const result = decorator({}, 'testMethod', descriptor);
      const wrappedResult = await result.value();

      expect(wrappedResult).toBe('success');
    });

    it('should handle errors in wrapped method', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const decorator = withErrorHandling(ErrorCategory.TERMINAL, 'TestClass', true);
      const originalMethod = async () => {
        throw new Error('Method failed');
      };
      const descriptor: PropertyDescriptor = {
        value: originalMethod,
        writable: true,
        enumerable: false,
        configurable: true,
      };

      const result = decorator({}, 'testMethod', descriptor);
      const wrappedResult = await result.value();

      expect(wrappedResult).toBeNull();
    });
  });
});
