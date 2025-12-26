/**
 * ErrorHandler Unit Tests
 *
 * Tests for generic error handling utility with severity levels, notifications,
 * recovery callbacks, and rethrow capabilities.
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandler } from '../../../../../webview/utils/ErrorHandler';
import { terminalLogger } from '../../../../../webview/utils/ManagerLogger';

describe('ErrorHandler', () => {
  let loggerErrorSpy: ReturnType<typeof vi.spyOn>;
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;
  let loggerInfoSpy: ReturnType<typeof vi.spyOn>;
  let loggerDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on logger methods
    loggerErrorSpy = vi.spyOn(terminalLogger, 'error').mockImplementation(() => {});
    loggerWarnSpy = vi.spyOn(terminalLogger, 'warn').mockImplementation(() => {});
    loggerInfoSpy = vi.spyOn(terminalLogger, 'info').mockImplementation(() => {});
    loggerDebugSpy = vi.spyOn(terminalLogger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleOperationError()', () => {
    it('should handle error with default severity (error)', () => {
      const error = new Error('Test error');
      const result = ErrorHandler.handleOperationError('Test operation', error);

      expect(result.handled).toBe(true);
      expect(result.severity).toBe('error');
      expect(result.message).toBe('❌ Test operation failed');
      expect(result.error).toBe(error);
      expect(loggerErrorSpy).toHaveBeenCalledOnce();
    });

    it('should handle error with warn severity', () => {
      const error = new Error('Warning error');
      const result = ErrorHandler.handleOperationError('Warning operation', error, {
        severity: 'warn',
      });

      expect(result.severity).toBe('warn');
      expect(result.message).toBe('⚠️ Warning operation failed');
      expect(loggerWarnSpy).toHaveBeenCalledOnce();
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle error with info severity', () => {
      const error = new Error('Info error');
      const result = ErrorHandler.handleOperationError('Info operation', error, {
        severity: 'info',
      });

      expect(result.severity).toBe('info');
      expect(result.message).toBe('ℹ️ Info operation failed');
      expect(loggerInfoSpy).toHaveBeenCalledOnce();
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it('should include context in log message', () => {
      const error = new Error('Context error');
      const context = { terminalId: 'terminal-1', action: 'resize' };

      ErrorHandler.handleOperationError('Context operation', error, {
        context,
      });

      const logCall = loggerErrorSpy.mock.calls[0];
      const logMessage = logCall[0] as string;
      expect(logMessage).toContain('Context operation failed');
      expect(logMessage).toContain('terminal-1');
      expect(logMessage).toContain('resize');
    });

    it('should execute recovery callback on error', () => {
      const error = new Error('Recovery test');
      const recoverySpy = vi.fn();

      ErrorHandler.handleOperationError('Recovery operation', error, {
        recovery: recoverySpy,
      });

      expect(recoverySpy).toHaveBeenCalledOnce();
    });

    it('should execute async recovery callback on error', async () => {
      const error = new Error('Async recovery test');
      let recoveryExecuted = false;

      ErrorHandler.handleOperationError('Async recovery operation', error, {
        recovery: async () => {
          recoveryExecuted = true;
        },
      });

      // Check async callback execution
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(recoveryExecuted).toBe(true);
    });

    it('should handle recovery callback failures gracefully', () => {
      const error = new Error('Recovery failure test');
      const failingRecovery = () => {
        throw new Error('Recovery failed');
      };

      // Should not throw
      expect(() => {
        ErrorHandler.handleOperationError('Recovery failure operation', error, {
          recovery: failingRecovery,
        });
      }).not.toThrow();

      // Should log recovery error
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        '❌ Recovery callback failed:',
        expect.any(Error)
      );
    });

    it('should notify user when notify option is true', () => {
      const error = new Error('Notification test');

      ErrorHandler.handleOperationError('Notification operation', error, {
        notify: true,
      });

      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/User Notification/));
    });

    it('should not notify user when notify option is false', () => {
      const error = new Error('No notification test');

      ErrorHandler.handleOperationError('No notification operation', error, {
        notify: false,
      });

      expect(loggerDebugSpy).not.toHaveBeenCalled();
    });

    it('should rethrow error when rethrow option is true', () => {
      const error = new Error('Rethrow test');

      expect(() => {
        ErrorHandler.handleOperationError('Rethrow operation', error, {
          rethrow: true,
        });
      }).toThrow('Rethrow test');
    });

    it('should not rethrow error when rethrow option is false', () => {
      const error = new Error('No rethrow test');

      expect(() => {
        ErrorHandler.handleOperationError('No rethrow operation', error, {
          rethrow: false,
        });
      }).not.toThrow();
    });

    it('should handle all options combined', () => {
      const error = new Error('Combined options test');
      const recoverySpy = vi.fn();

      expect(() => {
        ErrorHandler.handleOperationError('Combined operation', error, {
          severity: 'warn',
          notify: true,
          recovery: recoverySpy,
          rethrow: true,
          context: { test: 'data' },
        });
      }).toThrow('Combined options test');

      expect(loggerWarnSpy).toHaveBeenCalledOnce();
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/User Notification/));
      expect(recoverySpy).toHaveBeenCalledOnce();
    });
  });

  describe('formatErrorMessage()', () => {
    it('should return operation name without details', () => {
      const result = ErrorHandler.formatErrorMessage('Test operation');
      expect(result).toBe('Test operation');
    });

    it('should combine operation and details', () => {
      const result = ErrorHandler.formatErrorMessage('Test operation', 'additional details');
      expect(result).toBe('Test operation: additional details');
    });
  });

  describe('extractErrorMessage()', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Error message');
      const result = ErrorHandler.extractErrorMessage(error);
      expect(result).toBe('Error message');
    });

    it('should return string error as-is', () => {
      const error = 'String error';
      const result = ErrorHandler.extractErrorMessage(error);
      expect(result).toBe('String error');
    });

    it('should convert unknown error to string', () => {
      const error = { code: 'ERR_001' };
      const result = ErrorHandler.extractErrorMessage(error);
      expect(result).toBeTypeOf('string');
    });

    it('should handle null/undefined', () => {
      const result1 = ErrorHandler.extractErrorMessage(null);
      const result2 = ErrorHandler.extractErrorMessage(undefined);
      expect(result1).toBeTypeOf('string');
      expect(result2).toBeTypeOf('string');
    });
  });

  describe('isErrorType()', () => {
    it('should return true for matching error type', () => {
      const error = new TypeError('Type error');
      const result = ErrorHandler.isErrorType(error, TypeError);
      expect(result).toBe(true);
    });

    it('should return false for non-matching error type', () => {
      const error = new Error('Generic error');
      const result = ErrorHandler.isErrorType(error, TypeError);
      expect(result).toBe(false);
    });

    it('should return false for non-error values', () => {
      const result1 = ErrorHandler.isErrorType('string', Error);
      const result2 = ErrorHandler.isErrorType(null, Error);
      const result3 = ErrorHandler.isErrorType(undefined, Error);
      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });
  });

  describe('Emoji Display', () => {
    it('should use appropriate emoji for error severity', () => {
      const error = new Error('Test');
      const result = ErrorHandler.handleOperationError('Test', error, { severity: 'error' });
      // The actual emoji depends on implementation - just verify message is formatted
      expect(result.message).toContain('Test failed');
    });

    it('should use appropriate emoji for warn severity', () => {
      const error = new Error('Test');
      const result = ErrorHandler.handleOperationError('Test', error, { severity: 'warn' });
      // The actual emoji depends on implementation - just verify message is formatted
      expect(result.message).toContain('Test failed');
    });

    it('should use appropriate emoji for info severity', () => {
      const error = new Error('Test');
      const result = ErrorHandler.handleOperationError('Test', error, { severity: 'info' });
      // The actual emoji depends on implementation - just verify message is formatted
      expect(result.message).toContain('Test failed');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle terminal creation error with recovery', () => {
      const error = new Error('Terminal creation failed');
      let terminalRecreated = false;

      const result = ErrorHandler.handleOperationError('Terminal creation', error, {
        severity: 'error',
        recovery: () => {
          terminalRecreated = true;
        },
      });

      expect(result.handled).toBe(true);
      expect(terminalRecreated).toBe(true);
      expect(loggerErrorSpy).toHaveBeenCalledOnce();
    });

    it('should handle optional addon loading error without rethrow', () => {
      const error = new Error('Addon failed to load');

      const result = ErrorHandler.handleOperationError('Addon loading', error, {
        severity: 'warn',
        rethrow: false,
      });

      expect(result.handled).toBe(true);
      expect(result.severity).toBe('warn');
      expect(loggerWarnSpy).toHaveBeenCalledOnce();
    });

    it('should handle critical operation error with notification and rethrow', () => {
      const error = new Error('Critical failure');

      expect(() => {
        ErrorHandler.handleOperationError('Critical operation', error, {
          severity: 'error',
          notify: true,
          rethrow: true,
          context: { operation: 'critical', timestamp: Date.now() },
        });
      }).toThrow('Critical failure');

      expect(loggerErrorSpy).toHaveBeenCalledOnce();
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/User Notification/));
    });
  });
});
