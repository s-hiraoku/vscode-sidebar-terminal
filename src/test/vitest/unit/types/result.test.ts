import { describe, it, expect, vi } from 'vitest';
import {
  Result,
  ErrorCode,
  ErrorDetails,
  ResultError,
  success,
  failure,
  failureFromDetails,
  failureFromError,
  isSuccess,
  isFailure,
  unwrap,
  unwrapOr,
  map,
  chain,
  mapError,
  onFailure,
  onSuccess,
  fromPromise,
  tryCatch,
  all,
} from '../../../../types/result';

describe('ResultError', () => {
  describe('constructor', () => {
    it('should create error with basic details', () => {
      const error = new ResultError({
        code: ErrorCode.TERMINAL_NOT_FOUND,
        message: 'Terminal not found',
      });

      expect(error.code).toBe(ErrorCode.TERMINAL_NOT_FOUND);
      expect(error.message).toBe('Terminal not found');
      expect(error.name).toBe('ResultError');
    });

    it('should include context when provided', () => {
      const context = { terminalId: 'term-1' };
      const error = new ResultError({
        code: ErrorCode.TERMINAL_NOT_FOUND,
        message: 'Terminal not found',
        context,
      });

      expect(error.context).toEqual(context);
    });

    it('should include cause when provided', () => {
      const originalError = new Error('Original error');
      const error = new ResultError({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Wrapped error',
        cause: originalError,
      });

      expect(error.cause).toBe(originalError);
    });

    it('should preserve stack from details', () => {
      const customStack = 'Custom stack trace';
      const error = new ResultError({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Error with custom stack',
        stack: customStack,
      });

      expect(error.stack).toBe(customStack);
    });

    it('should use cause stack when no stack provided', () => {
      const originalError = new Error('Original error');
      const error = new ResultError({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Wrapped error',
        cause: originalError,
      });

      expect(error.stack).toBe(originalError.stack);
    });
  });

  describe('toJSON', () => {
    it('should convert to plain object', () => {
      const error = new ResultError({
        code: ErrorCode.TERMINAL_NOT_FOUND,
        message: 'Terminal not found',
        context: { id: 1 },
      });

      const json = error.toJSON();

      expect(json).toEqual({
        code: ErrorCode.TERMINAL_NOT_FOUND,
        message: 'Terminal not found',
        context: { id: 1 },
        stack: error.stack,
      });
    });
  });
});

describe('success', () => {
  it('should create successful result with value', () => {
    const result = success(42);

    expect(result.success).toBe(true);
    expect(result).toHaveProperty('value', 42);
  });

  it('should handle various value types', () => {
    expect(success('string')).toEqual({ success: true, value: 'string' });
    expect(success({ a: 1 })).toEqual({ success: true, value: { a: 1 } });
    expect(success([1, 2, 3])).toEqual({ success: true, value: [1, 2, 3] });
    expect(success(null)).toEqual({ success: true, value: null });
    expect(success(undefined)).toEqual({ success: true, value: undefined });
  });
});

describe('failure', () => {
  it('should create failed result with error', () => {
    const error = new Error('Test error');
    const result = failure(error);

    expect(result.success).toBe(false);
    expect(result).toHaveProperty('error', error);
  });

  it('should handle various error types', () => {
    const stringError = failure('string error');
    expect(stringError).toEqual({ success: false, error: 'string error' });

    const numberError = failure(404);
    expect(numberError).toEqual({ success: false, error: 404 });
  });
});

describe('failureFromDetails', () => {
  it('should create failure with ResultError from details', () => {
    const result = failureFromDetails({
      code: ErrorCode.TERMINAL_CREATION_FAILED,
      message: 'Failed to create terminal',
    });

    expect(result.success).toBe(false);
    expect((result as { error: ResultError }).error).toBeInstanceOf(ResultError);
    expect((result as { error: ResultError }).error.code).toBe(ErrorCode.TERMINAL_CREATION_FAILED);
  });
});

describe('failureFromError', () => {
  it('should wrap native Error into ResultError', () => {
    const originalError = new Error('Original error');
    const result = failureFromError(originalError);

    expect(result.success).toBe(false);
    const error = (result as { error: ResultError }).error;
    expect(error).toBeInstanceOf(ResultError);
    expect(error.message).toBe('Original error');
    expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(error.cause).toBe(originalError);
  });

  it('should use custom error code', () => {
    const originalError = new Error('Network error');
    const result = failureFromError(originalError, ErrorCode.NETWORK_ERROR);

    const error = (result as { error: ResultError }).error;
    expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
  });

  it('should include context', () => {
    const originalError = new Error('Error');
    const context = { url: 'http://example.com' };
    const result = failureFromError(originalError, ErrorCode.NETWORK_ERROR, context);

    const error = (result as { error: ResultError }).error;
    expect(error.context).toEqual(context);
  });
});

describe('isSuccess', () => {
  it('should return true for successful result', () => {
    const result = success(42);
    expect(isSuccess(result)).toBe(true);
  });

  it('should return false for failed result', () => {
    const result = failure(new Error('Error'));
    expect(isSuccess(result)).toBe(false);
  });

  it('should narrow type correctly', () => {
    const result: Result<number, Error> = success(42);
    if (isSuccess(result)) {
      // TypeScript should know result.value exists
      expect(result.value).toBe(42);
    }
  });
});

describe('isFailure', () => {
  it('should return false for successful result', () => {
    const result = success(42);
    expect(isFailure(result)).toBe(false);
  });

  it('should return true for failed result', () => {
    const result = failure(new Error('Error'));
    expect(isFailure(result)).toBe(true);
  });

  it('should narrow type correctly', () => {
    const result: Result<number, Error> = failure(new Error('Error'));
    if (isFailure(result)) {
      // TypeScript should know result.error exists
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});

describe('unwrap', () => {
  it('should return value for successful result', () => {
    const result = success(42);
    expect(unwrap(result)).toBe(42);
  });

  it('should throw error for failed result', () => {
    const error = new Error('Test error');
    const result = failure(error);

    expect(() => unwrap(result)).toThrow(error);
  });
});

describe('unwrapOr', () => {
  it('should return value for successful result', () => {
    const result = success(42);
    expect(unwrapOr(result, 0)).toBe(42);
  });

  it('should return default value for failed result', () => {
    const result = failure(new Error('Error'));
    expect(unwrapOr(result, 0)).toBe(0);
  });
});

describe('map', () => {
  it('should transform successful result value', () => {
    const result = success(42);
    const mapped = map(result, (x) => x * 2);

    expect(isSuccess(mapped)).toBe(true);
    expect((mapped as { value: number }).value).toBe(84);
  });

  it('should pass through failed result unchanged', () => {
    const error = new Error('Error');
    const result = failure(error);
    const mapped = map(result, (x: number) => x * 2);

    expect(isFailure(mapped)).toBe(true);
    expect((mapped as { error: Error }).error).toBe(error);
  });
});

describe('chain', () => {
  it('should chain successful operations', () => {
    const result = success(42);
    const chained = chain(result, (x) => success(x * 2));

    expect(isSuccess(chained)).toBe(true);
    expect((chained as { value: number }).value).toBe(84);
  });

  it('should pass through failure from original result', () => {
    const error = new Error('Error');
    const result = failure<Error>(error);
    const chained = chain(result, (x: number) => success(x * 2));

    expect(isFailure(chained)).toBe(true);
    expect((chained as { error: Error }).error).toBe(error);
  });

  it('should return failure from chained function', () => {
    const result = success(42);
    const chained = chain(result, () => failure(new Error('Chain error')));

    expect(isFailure(chained)).toBe(true);
  });
});

describe('mapError', () => {
  it('should transform error in failed result', () => {
    const result = failure('string error');
    const mapped = mapError(result, (e) => new Error(e));

    expect(isFailure(mapped)).toBe(true);
    expect((mapped as { error: Error }).error).toBeInstanceOf(Error);
    expect((mapped as { error: Error }).error.message).toBe('string error');
  });

  it('should pass through successful result unchanged', () => {
    const result = success(42);
    const mapped = mapError(result, (e: string) => new Error(e));

    expect(isSuccess(mapped)).toBe(true);
    expect((mapped as { value: number }).value).toBe(42);
  });
});

describe('onFailure', () => {
  it('should execute function on failure', () => {
    const error = new Error('Error');
    const result = failure(error);
    const callback = vi.fn();

    const returned = onFailure(result, callback);

    expect(callback).toHaveBeenCalledWith(error);
    expect(returned).toBe(result);
  });

  it('should not execute function on success', () => {
    const result = success(42);
    const callback = vi.fn();

    const returned = onFailure(result, callback);

    expect(callback).not.toHaveBeenCalled();
    expect(returned).toBe(result);
  });
});

describe('onSuccess', () => {
  it('should execute function on success', () => {
    const result = success(42);
    const callback = vi.fn();

    const returned = onSuccess(result, callback);

    expect(callback).toHaveBeenCalledWith(42);
    expect(returned).toBe(result);
  });

  it('should not execute function on failure', () => {
    const result = failure(new Error('Error'));
    const callback = vi.fn();

    const returned = onSuccess(result, callback);

    expect(callback).not.toHaveBeenCalled();
    expect(returned).toBe(result);
  });
});

describe('fromPromise', () => {
  it('should convert resolved promise to success', async () => {
    const promise = Promise.resolve(42);
    const result = await fromPromise(promise);

    expect(isSuccess(result)).toBe(true);
    expect((result as { value: number }).value).toBe(42);
  });

  it('should convert rejected promise with Error to failure', async () => {
    const error = new Error('Async error');
    const promise = Promise.reject(error);
    const result = await fromPromise(promise);

    expect(isFailure(result)).toBe(true);
    const resultError = (result as { error: ResultError }).error;
    expect(resultError).toBeInstanceOf(ResultError);
    expect(resultError.message).toBe('Async error');
  });

  it('should convert rejected promise with non-Error to failure', async () => {
    const promise = Promise.reject('string error');
    const result = await fromPromise(promise);

    expect(isFailure(result)).toBe(true);
    const resultError = (result as { error: ResultError }).error;
    expect(resultError.message).toBe('string error');
    expect(resultError.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });

  it('should use custom error handler', async () => {
    const promise = Promise.reject(new Error('Original'));
    const errorHandler = (): ErrorDetails => ({
      code: ErrorCode.NETWORK_ERROR,
      message: 'Custom error message',
    });

    const result = await fromPromise(promise, errorHandler);

    expect(isFailure(result)).toBe(true);
    const resultError = (result as { error: ResultError }).error;
    expect(resultError.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(resultError.message).toBe('Custom error message');
  });
});

describe('tryCatch', () => {
  it('should return success for non-throwing function', () => {
    const result = tryCatch(() => 42);

    expect(isSuccess(result)).toBe(true);
    expect((result as { value: number }).value).toBe(42);
  });

  it('should return failure for throwing function with Error', () => {
    const error = new Error('Sync error');
    const result = tryCatch(() => {
      throw error;
    });

    expect(isFailure(result)).toBe(true);
    const resultError = (result as { error: ResultError }).error;
    expect(resultError).toBeInstanceOf(ResultError);
    expect(resultError.message).toBe('Sync error');
  });

  it('should return failure for throwing function with non-Error', () => {
    const result = tryCatch(() => {
      throw 'string error';
    });

    expect(isFailure(result)).toBe(true);
    const resultError = (result as { error: ResultError }).error;
    expect(resultError.message).toBe('string error');
    expect(resultError.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });

  it('should use custom error handler', () => {
    const errorHandler = (): ErrorDetails => ({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'Custom validation error',
    });

    const result = tryCatch(() => {
      throw new Error('Original');
    }, errorHandler);

    expect(isFailure(result)).toBe(true);
    const resultError = (result as { error: ResultError }).error;
    expect(resultError.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(resultError.message).toBe('Custom validation error');
  });
});

describe('all', () => {
  it('should return success with array of values for all successful results', () => {
    const results = [success(1), success(2), success(3)];
    const combined = all(results);

    expect(isSuccess(combined)).toBe(true);
    expect((combined as { value: number[] }).value).toEqual([1, 2, 3]);
  });

  it('should return first failure when any result fails', () => {
    const error = new Error('Error');
    const results = [success(1), failure(error), success(3)];
    const combined = all(results);

    expect(isFailure(combined)).toBe(true);
    expect((combined as { error: Error }).error).toBe(error);
  });

  it('should handle empty array', () => {
    const combined = all([]);

    expect(isSuccess(combined)).toBe(true);
    expect((combined as { value: never[] }).value).toEqual([]);
  });

  it('should return first error only', () => {
    const error1 = new Error('Error 1');
    const error2 = new Error('Error 2');
    const results = [failure(error1), failure(error2)];
    const combined = all(results);

    expect(isFailure(combined)).toBe(true);
    expect((combined as { error: Error }).error).toBe(error1);
  });
});

describe('ErrorCode', () => {
  it('should have all expected error codes', () => {
    expect(ErrorCode.TERMINAL_NOT_FOUND).toBe('TERMINAL_NOT_FOUND');
    expect(ErrorCode.TERMINAL_CREATION_FAILED).toBe('TERMINAL_CREATION_FAILED');
    expect(ErrorCode.TERMINAL_PROCESS_FAILED).toBe('TERMINAL_PROCESS_FAILED');
    expect(ErrorCode.TERMINAL_ALREADY_EXISTS).toBe('TERMINAL_ALREADY_EXISTS');
    expect(ErrorCode.CONFIG_NOT_FOUND).toBe('CONFIG_NOT_FOUND');
    expect(ErrorCode.CONFIG_INVALID).toBe('CONFIG_INVALID');
    expect(ErrorCode.CONFIG_LOAD_FAILED).toBe('CONFIG_LOAD_FAILED');
    expect(ErrorCode.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
    expect(ErrorCode.FILE_READ_FAILED).toBe('FILE_READ_FAILED');
    expect(ErrorCode.FILE_WRITE_FAILED).toBe('FILE_WRITE_FAILED');
    expect(ErrorCode.FILE_PERMISSION_DENIED).toBe('FILE_PERMISSION_DENIED');
    expect(ErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(ErrorCode.IPC_COMMUNICATION_FAILED).toBe('IPC_COMMUNICATION_FAILED');
    expect(ErrorCode.INVALID_STATE).toBe('INVALID_STATE');
    expect(ErrorCode.STATE_TRANSITION_FAILED).toBe('STATE_TRANSITION_FAILED');
    expect(ErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
    expect(ErrorCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
    expect(ErrorCode.RESOURCE_EXHAUSTED).toBe('RESOURCE_EXHAUSTED');
    expect(ErrorCode.RESOURCE_LOCKED).toBe('RESOURCE_LOCKED');
    expect(ErrorCode.PERSISTENCE_LOAD_FAILED).toBe('PERSISTENCE_LOAD_FAILED');
    expect(ErrorCode.PERSISTENCE_SAVE_FAILED).toBe('PERSISTENCE_SAVE_FAILED');
    expect(ErrorCode.SERIALIZATION_FAILED).toBe('SERIALIZATION_FAILED');
    expect(ErrorCode.DESERIALIZATION_FAILED).toBe('DESERIALIZATION_FAILED');
    expect(ErrorCode.SESSION_NOT_FOUND).toBe('SESSION_NOT_FOUND');
    expect(ErrorCode.SESSION_RESTORE_FAILED).toBe('SESSION_RESTORE_FAILED');
    expect(ErrorCode.SESSION_CORRUPTED).toBe('SESSION_CORRUPTED');
    expect(ErrorCode.CLI_AGENT_NOT_DETECTED).toBe('CLI_AGENT_NOT_DETECTED');
    expect(ErrorCode.CLI_AGENT_CONNECTION_FAILED).toBe('CLI_AGENT_CONNECTION_FAILED');
    expect(ErrorCode.CLI_AGENT_DISCONNECTED).toBe('CLI_AGENT_DISCONNECTED');
    expect(ErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    expect(ErrorCode.OPERATION_FAILED).toBe('OPERATION_FAILED');
    expect(ErrorCode.NOT_IMPLEMENTED).toBe('NOT_IMPLEMENTED');
    expect(ErrorCode.TIMEOUT).toBe('TIMEOUT');
  });
});
