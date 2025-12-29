
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorHandler } from '../../../../../webview/utils/ErrorHandler';
import { terminalLogger } from '../../../../../webview/utils/ManagerLogger';

// Mock logger
vi.mock('../../../../../webview/utils/ManagerLogger', () => ({
  terminalLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('ErrorHandler', () => {
  const op = 'Test Operation';
  const err = new Error('Test Error');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleOperationError', () => {
    it('should log error and return result', () => {
      const result = ErrorHandler.handleOperationError(op, err);
      
      expect(result.handled).toBe(true);
      expect(result.severity).toBe('error');
      expect(result.message).toContain('❌');
      expect(terminalLogger.error).toHaveBeenCalled();
    });

    it('should rethrow error if requested', () => {
      expect(() => {
        ErrorHandler.handleOperationError(op, err, { rethrow: true });
      }).toThrow('Test Error');
    });

    it('should execute recovery callback', () => {
      const recovery = vi.fn();
      ErrorHandler.handleOperationError(op, err, { recovery });
      expect(recovery).toHaveBeenCalled();
    });

    it('should handle async recovery callback', async () => {
      const recovery = vi.fn().mockResolvedValue(undefined);
      ErrorHandler.handleOperationError(op, err, { recovery });
      expect(recovery).toHaveBeenCalled();
    });

    it('should include context in logs', () => {
      const context = { id: 123 };
      
      ErrorHandler.handleOperationError(op, err, { context });
      
      expect(terminalLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('"id":123'),
        err
      );
    });
  });

  describe('Utility methods', () => {
    it('should extract error message correctly', () => {
      expect(ErrorHandler.extractErrorMessage(new Error('msg'))).toBe('msg');
      expect(ErrorHandler.extractErrorMessage('string err')).toBe('string err');
      expect(ErrorHandler.extractErrorMessage(123)).toBe('123');
    });

    it('should format error message', () => {
      expect(ErrorHandler.formatErrorMessage('Op', 'detail')).toBe('Op: detail');
      expect(ErrorHandler.formatErrorMessage('Op')).toBe('Op');
    });

    it('should check error type', () => {
      expect(ErrorHandler.isErrorType(new TypeError(), TypeError)).toBe(true);
      expect(ErrorHandler.isErrorType(new Error(), TypeError)).toBe(false);
    });
  });
});
