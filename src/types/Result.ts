/**
 * Standardized Result Pattern for Error Handling
 *
 * This module provides a type-safe Result pattern for explicit error handling
 * across the codebase. It ensures that all operations return either a success
 * or failure state, making error handling predictable and type-safe.
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) {
 *     return failure('Division by zero');
 *   }
 *   return success(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (result.success) {
 *   console.log('Value:', result.value);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */

// =============================================================================
// Core Result Type
// =============================================================================

/**
 * Represents a successful operation result
 */
export interface Success<T> {
  readonly success: true;
  readonly value: T;
}

/**
 * Represents a failed operation result
 */
export interface Failure<E> {
  readonly success: false;
  readonly error: E;
}

/**
 * Result type that represents either success or failure
 * @template T - The type of the success value
 * @template E - The type of the error (defaults to Error)
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

// =============================================================================
// Error Code Enums
// =============================================================================

/**
 * Standard error codes for common failure scenarios
 */
export enum ErrorCode {
  // Terminal errors
  TERMINAL_NOT_FOUND = 'TERMINAL_NOT_FOUND',
  TERMINAL_CREATION_FAILED = 'TERMINAL_CREATION_FAILED',
  TERMINAL_ALREADY_EXISTS = 'TERMINAL_ALREADY_EXISTS',
  TERMINAL_DISPOSED = 'TERMINAL_DISPOSED',
  TERMINAL_PROCESS_ERROR = 'TERMINAL_PROCESS_ERROR',

  // Session errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_RESTORE_FAILED = 'SESSION_RESTORE_FAILED',
  SESSION_SAVE_FAILED = 'SESSION_SAVE_FAILED',
  SESSION_INVALID_STATE = 'SESSION_INVALID_STATE',

  // Configuration errors
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_LOAD_FAILED = 'CONFIG_LOAD_FAILED',
  CONFIG_SAVE_FAILED = 'CONFIG_SAVE_FAILED',
  CONFIG_MIGRATION_FAILED = 'CONFIG_MIGRATION_FAILED',

  // WebView errors
  WEBVIEW_NOT_INITIALIZED = 'WEBVIEW_NOT_INITIALIZED',
  WEBVIEW_MESSAGE_FAILED = 'WEBVIEW_MESSAGE_FAILED',
  WEBVIEW_RENDER_FAILED = 'WEBVIEW_RENDER_FAILED',

  // Communication errors
  MESSAGE_INVALID = 'MESSAGE_INVALID',
  MESSAGE_HANDLER_NOT_FOUND = 'MESSAGE_HANDLER_NOT_FOUND',
  MESSAGE_PROCESSING_FAILED = 'MESSAGE_PROCESSING_FAILED',

  // Resource errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ACCESS_DENIED = 'RESOURCE_ACCESS_DENIED',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',

  // Generic errors
  UNKNOWN = 'UNKNOWN',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED'
}

/**
 * Standard error structure with code and context
 */
export interface ErrorDetail {
  readonly code: ErrorCode;
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly cause?: Error;
  readonly recoverable?: boolean;
}

// =============================================================================
// Constructor Functions
// =============================================================================

/**
 * Creates a successful result
 * @param value - The success value
 * @returns A Success result
 */
export function success<T>(value: T): Success<T> {
  return {
    success: true,
    value
  };
}

/**
 * Creates a failed result
 * @param error - The error
 * @returns A Failure result
 */
export function failure<E>(error: E): Failure<E> {
  return {
    success: false,
    error
  };
}

/**
 * Creates a failed result with an error code and message
 * @param code - The error code
 * @param message - The error message
 * @param context - Optional context information
 * @param cause - Optional underlying cause
 * @returns A Failure result with ErrorDetail
 */
export function failureWithCode(
  code: ErrorCode,
  message: string,
  context?: Record<string, unknown>,
  cause?: Error,
  recoverable?: boolean
): Failure<ErrorDetail> {
  return failure({
    code,
    message,
    context,
    cause,
    recoverable
  });
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a result is successful
 * @param result - The result to check
 * @returns true if the result is successful
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.success === true;
}

/**
 * Type guard to check if a result is a failure
 * @param result - The result to check
 * @returns true if the result is a failure
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.success === false;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Maps a successful result to a new value
 * @param result - The result to map
 * @param fn - The mapping function
 * @returns A new Result with the mapped value or the original failure
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isSuccess(result)) {
    return success(fn(result.value));
  }
  return result;
}

/**
 * Maps a failed result to a new error
 * @param result - The result to map
 * @param fn - The mapping function
 * @returns A new Result with the original value or the mapped error
 */
export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (isFailure(result)) {
    return failure(fn(result.error));
  }
  return result;
}

/**
 * Chains a result with a function that returns a new result
 * @param result - The result to chain
 * @param fn - The function that returns a new result
 * @returns The new result or the original failure
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isSuccess(result)) {
    return fn(result.value);
  }
  return result;
}

/**
 * Unwraps a successful result or returns a default value
 * @param result - The result to unwrap
 * @param defaultValue - The default value to return on failure
 * @returns The success value or the default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return isSuccess(result) ? result.value : defaultValue;
}

/**
 * Unwraps a successful result or throws an error
 * @param result - The result to unwrap
 * @returns The success value
 * @throws The error if the result is a failure
 */
export function unwrapOrThrow<T, E>(result: Result<T, E>): T {
  if (isSuccess(result)) {
    return result.value;
  }

  const error = result.error;
  if (error instanceof Error) {
    throw error;
  }

  if (isErrorDetail(error)) {
    const err = new Error(error.message);
    if (error.cause) {
      (err as any).cause = error.cause;
    }
    throw err;
  }

  throw new Error(String(error));
}

/**
 * Executes a callback if the result is successful
 * @param result - The result to check
 * @param fn - The callback to execute
 * @returns The original result for chaining
 */
export function onSuccess<T, E>(
  result: Result<T, E>,
  fn: (value: T) => void
): Result<T, E> {
  if (isSuccess(result)) {
    fn(result.value);
  }
  return result;
}

/**
 * Executes a callback if the result is a failure
 * @param result - The result to check
 * @param fn - The callback to execute
 * @returns The original result for chaining
 */
export function onFailure<T, E>(
  result: Result<T, E>,
  fn: (error: E) => void
): Result<T, E> {
  if (isFailure(result)) {
    fn(result.error);
  }
  return result;
}

/**
 * Combines multiple results into a single result
 * Returns success with an array of all values if all results are successful
 * Returns the first failure if any result fails
 * @param results - The results to combine
 * @returns A single result containing all values or the first error
 */
export function combine<T, E>(results: Array<Result<T, E>>): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (isFailure(result)) {
      return result;
    }
    values.push(result.value);
  }

  return success(values);
}

/**
 * Wraps a function that may throw into a Result
 * @param fn - The function to wrap
 * @returns A Result with the function's return value or the error
 */
export function tryCatch<T>(fn: () => T): Result<T, Error> {
  try {
    return success(fn());
  } catch (error) {
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Wraps an async function that may throw into a Result
 * @param fn - The async function to wrap
 * @returns A Promise of Result with the function's return value or the error
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    const value = await fn();
    return success(value);
  } catch (error) {
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Converts a Promise to a Result
 * @param promise - The promise to convert
 * @returns A Promise of Result
 */
export async function fromPromise<T>(
  promise: Promise<T>
): Promise<Result<T, Error>> {
  return tryCatchAsync(() => promise);
}

// =============================================================================
// Type Guards for ErrorDetail
// =============================================================================

/**
 * Type guard to check if an error is an ErrorDetail
 * @param error - The error to check
 * @returns true if the error is an ErrorDetail
 */
export function isErrorDetail(error: unknown): error is ErrorDetail {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as any).code === 'string' &&
    typeof (error as any).message === 'string'
  );
}

// =============================================================================
// Logging Helper
// =============================================================================

/**
 * Formats an error for logging
 * @param error - The error to format
 * @returns A formatted error string
 */
export function formatError<E>(error: E): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (isErrorDetail(error)) {
    const parts = [`[${error.code}] ${error.message}`];

    if (error.context) {
      parts.push(`Context: ${JSON.stringify(error.context)}`);
    }

    if (error.cause) {
      parts.push(`Caused by: ${error.cause.message}`);
    }

    return parts.join(' | ');
  }

  return String(error);
}
