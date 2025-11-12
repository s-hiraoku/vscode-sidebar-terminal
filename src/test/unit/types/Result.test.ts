/**
 * Unit tests for the Result pattern
 *
 * These tests verify the standardized Result type and its helper functions
 * work correctly for explicit, type-safe error handling.
 */

import { expect } from 'chai';
import {
  Result,
  Success,
  Failure,
  ErrorCode,
  ErrorDetail,
  success,
  failure,
  failureWithCode,
  isSuccess,
  isFailure,
  map,
  mapError,
  flatMap,
  unwrapOr,
  unwrapOrThrow,
  onSuccess,
  onFailure,
  combine,
  tryCatch,
  tryCatchAsync,
  fromPromise,
  isErrorDetail,
  formatError,
} from '../../../types/Result';

describe('Result Pattern', () => {
  describe('Constructor Functions', () => {
    describe('success()', () => {
      it('should create a successful result with value', () => {
        const result = success(42);

        expect(result.success).to.be.true;
        expect(result.value).to.equal(42);
      });

      it('should create a successful result with undefined', () => {
        const result = success(undefined);

        expect(result.success).to.be.true;
        expect(result.value).to.be.undefined;
      });

      it('should create a successful result with null', () => {
        const result = success(null);

        expect(result.success).to.be.true;
        expect(result.value).to.be.null;
      });

      it('should create a successful result with complex objects', () => {
        const data = { name: 'test', count: 5 };
        const result = success(data);

        expect(result.success).to.be.true;
        expect(result.value).to.deep.equal(data);
      });
    });

    describe('failure()', () => {
      it('should create a failed result with error', () => {
        const error = new Error('Something went wrong');
        const result = failure(error);

        expect(result.success).to.be.false;
        expect(result.error).to.equal(error);
      });

      it('should create a failed result with string error', () => {
        const result = failure('Error message');

        expect(result.success).to.be.false;
        expect(result.error).to.equal('Error message');
      });
    });

    describe('failureWithCode()', () => {
      it('should create a failed result with error code and message', () => {
        const result = failureWithCode(
          ErrorCode.TERMINAL_NOT_FOUND,
          'Terminal ID xyz not found'
        );

        expect(result.success).to.be.false;
        expect(result.error.code).to.equal(ErrorCode.TERMINAL_NOT_FOUND);
        expect(result.error.message).to.equal('Terminal ID xyz not found');
      });

      it('should create a failed result with context', () => {
        const result = failureWithCode(
          ErrorCode.VALIDATION_FAILED,
          'Invalid input',
          { field: 'email', value: 'invalid' }
        );

        expect(result.success).to.be.false;
        expect(result.error.context).to.deep.equal({ field: 'email', value: 'invalid' });
      });

      it('should create a failed result with cause', () => {
        const cause = new Error('Underlying error');
        const result = failureWithCode(
          ErrorCode.UNKNOWN,
          'Operation failed',
          undefined,
          cause
        );

        expect(result.success).to.be.false;
        expect(result.error.cause).to.equal(cause);
      });

      it('should create a failed result with recoverable flag', () => {
        const result = failureWithCode(
          ErrorCode.TIMEOUT,
          'Request timed out',
          undefined,
          undefined,
          true
        );

        expect(result.success).to.be.false;
        expect(result.error.recoverable).to.be.true;
      });
    });
  });

  describe('Type Guards', () => {
    describe('isSuccess()', () => {
      it('should return true for successful results', () => {
        const result = success(42);
        expect(isSuccess(result)).to.be.true;
      });

      it('should return false for failed results', () => {
        const result = failure('error');
        expect(isSuccess(result)).to.be.false;
      });

      it('should narrow type correctly', () => {
        const result: Result<number, string> = success(42);

        if (isSuccess(result)) {
          // TypeScript should know result.value is number
          const value: number = result.value;
          expect(value).to.equal(42);
        }
      });
    });

    describe('isFailure()', () => {
      it('should return true for failed results', () => {
        const result = failure('error');
        expect(isFailure(result)).to.be.true;
      });

      it('should return false for successful results', () => {
        const result = success(42);
        expect(isFailure(result)).to.be.false;
      });

      it('should narrow type correctly', () => {
        const result: Result<number, string> = failure('error');

        if (isFailure(result)) {
          // TypeScript should know result.error is string
          const error: string = result.error;
          expect(error).to.equal('error');
        }
      });
    });
  });

  describe('Utility Functions', () => {
    describe('map()', () => {
      it('should map successful results', () => {
        const result = success(5);
        const mapped = map(result, (x) => x * 2);

        expect(isSuccess(mapped)).to.be.true;
        if (isSuccess(mapped)) {
          expect(mapped.value).to.equal(10);
        }
      });

      it('should not map failed results', () => {
        const result: Result<number, string> = failure('error');
        const mapped = map(result, (x) => x * 2);

        expect(isFailure(mapped)).to.be.true;
        if (isFailure(mapped)) {
          expect(mapped.error).to.equal('error');
        }
      });

      it('should transform types correctly', () => {
        const result = success(42);
        const mapped = map(result, (x) => x.toString());

        expect(isSuccess(mapped)).to.be.true;
        if (isSuccess(mapped)) {
          expect(mapped.value).to.equal('42');
          expect(typeof mapped.value).to.equal('string');
        }
      });
    });

    describe('mapError()', () => {
      it('should map failed results', () => {
        const result: Result<number, string> = failure('error');
        const mapped = mapError(result, (e) => new Error(e));

        expect(isFailure(mapped)).to.be.true;
        if (isFailure(mapped)) {
          expect(mapped.error).to.be.instanceOf(Error);
          expect(mapped.error.message).to.equal('error');
        }
      });

      it('should not map successful results', () => {
        const result: Result<number, string> = success(42);
        const mapped = mapError(result, (e) => new Error(e));

        expect(isSuccess(mapped)).to.be.true;
        if (isSuccess(mapped)) {
          expect(mapped.value).to.equal(42);
        }
      });
    });

    describe('flatMap()', () => {
      it('should chain successful results', () => {
        const result = success(5);
        const chained = flatMap(result, (x) => success(x * 2));

        expect(isSuccess(chained)).to.be.true;
        if (isSuccess(chained)) {
          expect(chained.value).to.equal(10);
        }
      });

      it('should propagate failures', () => {
        const result: Result<number, string> = failure('error');
        const chained = flatMap(result, (x) => success(x * 2));

        expect(isFailure(chained)).to.be.true;
        if (isFailure(chained)) {
          expect(chained.error).to.equal('error');
        }
      });

      it('should handle operations that return failures', () => {
        const result = success(5);
        const chained = flatMap(result, (x) =>
          x > 3 ? failure('too large') : success(x)
        );

        expect(isFailure(chained)).to.be.true;
        if (isFailure(chained)) {
          expect(chained.error).to.equal('too large');
        }
      });
    });

    describe('unwrapOr()', () => {
      it('should return value for successful results', () => {
        const result = success(42);
        const value = unwrapOr(result, 0);

        expect(value).to.equal(42);
      });

      it('should return default value for failed results', () => {
        const result: Result<number, string> = failure('error');
        const value = unwrapOr(result, 0);

        expect(value).to.equal(0);
      });
    });

    describe('unwrapOrThrow()', () => {
      it('should return value for successful results', () => {
        const result = success(42);
        const value = unwrapOrThrow(result);

        expect(value).to.equal(42);
      });

      it('should throw Error for failed results with Error', () => {
        const error = new Error('Something went wrong');
        const result: Result<number, Error> = failure(error);

        expect(() => unwrapOrThrow(result)).to.throw('Something went wrong');
      });

      it('should throw Error for failed results with ErrorDetail', () => {
        const result = failureWithCode(ErrorCode.TERMINAL_NOT_FOUND, 'Terminal not found');

        expect(() => unwrapOrThrow(result)).to.throw('Terminal not found');
      });

      it('should throw Error for failed results with string', () => {
        const result: Result<number, string> = failure('error message');

        expect(() => unwrapOrThrow(result)).to.throw('error message');
      });
    });

    describe('onSuccess()', () => {
      it('should execute callback for successful results', () => {
        let called = false;
        const result = success(42);

        onSuccess(result, (value) => {
          called = true;
          expect(value).to.equal(42);
        });

        expect(called).to.be.true;
      });

      it('should not execute callback for failed results', () => {
        let called = false;
        const result: Result<number, string> = failure('error');

        onSuccess(result, () => {
          called = true;
        });

        expect(called).to.be.false;
      });

      it('should return the original result', () => {
        const result = success(42);
        const returned = onSuccess(result, () => {});

        expect(returned).to.equal(result);
      });
    });

    describe('onFailure()', () => {
      it('should execute callback for failed results', () => {
        let called = false;
        const result: Result<number, string> = failure('error');

        onFailure(result, (error) => {
          called = true;
          expect(error).to.equal('error');
        });

        expect(called).to.be.true;
      });

      it('should not execute callback for successful results', () => {
        let called = false;
        const result = success(42);

        onFailure(result, () => {
          called = true;
        });

        expect(called).to.be.false;
      });

      it('should return the original result', () => {
        const result: Result<number, string> = failure('error');
        const returned = onFailure(result, () => {});

        expect(returned).to.equal(result);
      });
    });

    describe('combine()', () => {
      it('should combine all successful results', () => {
        const results = [success(1), success(2), success(3)];
        const combined = combine(results);

        expect(isSuccess(combined)).to.be.true;
        if (isSuccess(combined)) {
          expect(combined.value).to.deep.equal([1, 2, 3]);
        }
      });

      it('should return first failure', () => {
        const results: Array<Result<number, string>> = [
          success(1),
          failure('error1'),
          failure('error2'),
        ];
        const combined = combine(results);

        expect(isFailure(combined)).to.be.true;
        if (isFailure(combined)) {
          expect(combined.error).to.equal('error1');
        }
      });

      it('should handle empty array', () => {
        const results: Array<Result<number, string>> = [];
        const combined = combine(results);

        expect(isSuccess(combined)).to.be.true;
        if (isSuccess(combined)) {
          expect(combined.value).to.deep.equal([]);
        }
      });
    });

    describe('tryCatch()', () => {
      it('should return success for functions that succeed', () => {
        const result = tryCatch(() => 42);

        expect(isSuccess(result)).to.be.true;
        if (isSuccess(result)) {
          expect(result.value).to.equal(42);
        }
      });

      it('should return failure for functions that throw', () => {
        const result = tryCatch(() => {
          throw new Error('Something went wrong');
        });

        expect(isFailure(result)).to.be.true;
        if (isFailure(result)) {
          expect(result.error).to.be.instanceOf(Error);
          expect(result.error.message).to.equal('Something went wrong');
        }
      });

      it('should wrap non-Error throws in Error', () => {
        const result = tryCatch(() => {
          throw 'string error';
        });

        expect(isFailure(result)).to.be.true;
        if (isFailure(result)) {
          expect(result.error).to.be.instanceOf(Error);
          expect(result.error.message).to.equal('string error');
        }
      });
    });

    describe('tryCatchAsync()', () => {
      it('should return success for async functions that succeed', async () => {
        const result = await tryCatchAsync(async () => 42);

        expect(isSuccess(result)).to.be.true;
        if (isSuccess(result)) {
          expect(result.value).to.equal(42);
        }
      });

      it('should return failure for async functions that throw', async () => {
        const result = await tryCatchAsync(async () => {
          throw new Error('Async error');
        });

        expect(isFailure(result)).to.be.true;
        if (isFailure(result)) {
          expect(result.error).to.be.instanceOf(Error);
          expect(result.error.message).to.equal('Async error');
        }
      });
    });

    describe('fromPromise()', () => {
      it('should convert resolved promises to success', async () => {
        const promise = Promise.resolve(42);
        const result = await fromPromise(promise);

        expect(isSuccess(result)).to.be.true;
        if (isSuccess(result)) {
          expect(result.value).to.equal(42);
        }
      });

      it('should convert rejected promises to failure', async () => {
        const promise = Promise.reject(new Error('Promise rejected'));
        const result = await fromPromise(promise);

        expect(isFailure(result)).to.be.true;
        if (isFailure(result)) {
          expect(result.error).to.be.instanceOf(Error);
          expect(result.error.message).to.equal('Promise rejected');
        }
      });
    });
  });

  describe('ErrorDetail', () => {
    describe('isErrorDetail()', () => {
      it('should return true for valid ErrorDetail objects', () => {
        const error: ErrorDetail = {
          code: ErrorCode.TERMINAL_NOT_FOUND,
          message: 'Terminal not found',
        };

        expect(isErrorDetail(error)).to.be.true;
      });

      it('should return false for Error objects', () => {
        const error = new Error('test');
        expect(isErrorDetail(error)).to.be.false;
      });

      it('should return false for strings', () => {
        expect(isErrorDetail('error')).to.be.false;
      });

      it('should return false for objects missing required fields', () => {
        expect(isErrorDetail({ message: 'test' })).to.be.false;
        expect(isErrorDetail({ code: ErrorCode.UNKNOWN })).to.be.false;
      });
    });

    describe('formatError()', () => {
      it('should format Error objects', () => {
        const error = new Error('Test error');
        const formatted = formatError(error);

        expect(formatted).to.equal('Error: Test error');
      });

      it('should format ErrorDetail objects', () => {
        const error: ErrorDetail = {
          code: ErrorCode.TERMINAL_NOT_FOUND,
          message: 'Terminal not found',
        };
        const formatted = formatError(error);

        expect(formatted).to.include('[TERMINAL_NOT_FOUND]');
        expect(formatted).to.include('Terminal not found');
      });

      it('should format ErrorDetail with context', () => {
        const error: ErrorDetail = {
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Validation failed',
          context: { field: 'email' },
        };
        const formatted = formatError(error);

        expect(formatted).to.include('Context: {"field":"email"}');
      });

      it('should format ErrorDetail with cause', () => {
        const cause = new Error('Underlying error');
        const error: ErrorDetail = {
          code: ErrorCode.UNKNOWN,
          message: 'Operation failed',
          cause,
        };
        const formatted = formatError(error);

        expect(formatted).to.include('Caused by: Underlying error');
      });

      it('should format strings', () => {
        const formatted = formatError('simple error');
        expect(formatted).to.equal('simple error');
      });
    });
  });

  describe('Error Codes', () => {
    it('should have all expected error codes defined', () => {
      expect(ErrorCode.TERMINAL_NOT_FOUND).to.exist;
      expect(ErrorCode.TERMINAL_CREATION_FAILED).to.exist;
      expect(ErrorCode.SESSION_NOT_FOUND).to.exist;
      expect(ErrorCode.CONFIG_INVALID).to.exist;
      expect(ErrorCode.WEBVIEW_NOT_INITIALIZED).to.exist;
      expect(ErrorCode.MESSAGE_INVALID).to.exist;
      expect(ErrorCode.RESOURCE_NOT_FOUND).to.exist;
      expect(ErrorCode.UNKNOWN).to.exist;
      expect(ErrorCode.VALIDATION_FAILED).to.exist;
      expect(ErrorCode.TIMEOUT).to.exist;
      expect(ErrorCode.CANCELLED).to.exist;
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should handle division by zero example', () => {
      function divide(a: number, b: number): Result<number, string> {
        if (b === 0) {
          return failure('Division by zero');
        }
        return success(a / b);
      }

      const result1 = divide(10, 2);
      expect(isSuccess(result1)).to.be.true;
      if (isSuccess(result1)) {
        expect(result1.value).to.equal(5);
      }

      const result2 = divide(10, 0);
      expect(isFailure(result2)).to.be.true;
      if (isFailure(result2)) {
        expect(result2.error).to.equal('Division by zero');
      }
    });

    it('should handle chaining operations', () => {
      function parseNumber(str: string): Result<number, string> {
        const num = parseInt(str, 10);
        return isNaN(num) ? failure('Invalid number') : success(num);
      }

      function double(n: number): Result<number, string> {
        return success(n * 2);
      }

      const result = flatMap(parseNumber('42'), double);
      expect(isSuccess(result)).to.be.true;
      if (isSuccess(result)) {
        expect(result.value).to.equal(84);
      }

      const invalidResult = flatMap(parseNumber('invalid'), double);
      expect(isFailure(invalidResult)).to.be.true;
    });

    it('should handle terminal operations', () => {
      function findTerminal(id: string): Result<{ id: string; name: string }, ErrorDetail> {
        if (id === 'valid') {
          return success({ id, name: 'Terminal 1' });
        }
        return failureWithCode(
          ErrorCode.TERMINAL_NOT_FOUND,
          `Terminal ${id} not found`,
          { terminalId: id }
        );
      }

      const validResult = findTerminal('valid');
      expect(isSuccess(validResult)).to.be.true;

      const invalidResult = findTerminal('invalid');
      expect(isFailure(invalidResult)).to.be.true;
      if (isFailure(invalidResult)) {
        expect(invalidResult.error.code).to.equal(ErrorCode.TERMINAL_NOT_FOUND);
        expect(invalidResult.error.context?.terminalId).to.equal('invalid');
      }
    });
  });
});
