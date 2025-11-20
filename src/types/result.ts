/**
 * Result Pattern - Type-safe error handling
 *
 * This module provides a standardized way to handle errors throughout the codebase.
 * It replaces inconsistent error handling patterns (try-catch with void/boolean returns,
 * silent error swallowing) with explicit, type-safe Result objects.
 */

/**
 * Result type using discriminated unions
 * @template T - Type of the success value
 * @template E - Type of the error (defaults to Error)
 */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Standardized error codes for consistent error classification
 */
export enum ErrorCode {
  // Terminal operation errors
  TERMINAL_NOT_FOUND = 'TERMINAL_NOT_FOUND',
  TERMINAL_CREATION_FAILED = 'TERMINAL_CREATION_FAILED',
  TERMINAL_PROCESS_FAILED = 'TERMINAL_PROCESS_FAILED',
  TERMINAL_ALREADY_EXISTS = 'TERMINAL_ALREADY_EXISTS',

  // Configuration errors
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_LOAD_FAILED = 'CONFIG_LOAD_FAILED',

  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_FAILED = 'FILE_READ_FAILED',
  FILE_WRITE_FAILED = 'FILE_WRITE_FAILED',
  FILE_PERMISSION_DENIED = 'FILE_PERMISSION_DENIED',

  // Network/IPC errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  IPC_COMMUNICATION_FAILED = 'IPC_COMMUNICATION_FAILED',

  // State management errors
  INVALID_STATE = 'INVALID_STATE',
  STATE_TRANSITION_FAILED = 'STATE_TRANSITION_FAILED',

  // Validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  VALIDATION_FAILED = 'VALIDATION_FAILED',

  // Resource errors
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',

  // Persistence errors
  PERSISTENCE_LOAD_FAILED = 'PERSISTENCE_LOAD_FAILED',
  PERSISTENCE_SAVE_FAILED = 'PERSISTENCE_SAVE_FAILED',
  SERIALIZATION_FAILED = 'SERIALIZATION_FAILED',
  DESERIALIZATION_FAILED = 'DESERIALIZATION_FAILED',

  // Session errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_RESTORE_FAILED = 'SESSION_RESTORE_FAILED',
  SESSION_CORRUPTED = 'SESSION_CORRUPTED',

  // CLI Agent errors
  CLI_AGENT_NOT_DETECTED = 'CLI_AGENT_NOT_DETECTED',
  CLI_AGENT_CONNECTION_FAILED = 'CLI_AGENT_CONNECTION_FAILED',
  CLI_AGENT_DISCONNECTED = 'CLI_AGENT_DISCONNECTED',

  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  TIMEOUT = 'TIMEOUT',
}

/**
 * Structured error details with code and metadata
 */
export interface ErrorDetails {
  /** Error code for classification */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** Additional context about the error */
  context?: Record<string, unknown>;
  /** Original error if this wraps another error */
  cause?: Error;
  /** Stack trace for debugging */
  stack?: string;
}

/**
 * Custom error class that includes structured error details
 */
export class ResultError extends Error implements ErrorDetails {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, unknown>;
  public override readonly cause?: Error;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.name = 'ResultError';
    this.code = details.code;
    this.context = details.context;
    this.cause = details.cause;

    // Preserve stack trace
    if (details.stack) {
      this.stack = details.stack;
    } else if (details.cause?.stack) {
      this.stack = details.cause.stack;
    } else if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ResultError);
    }
  }

  /**
   * Convert to a plain object for serialization
   */
  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Helper function to create a successful Result
 * @param value - The success value
 * @returns Result with success: true
 */
export function success<T>(value: T): Result<T, never> {
  return { success: true, value };
}

/**
 * Helper function to create a failed Result
 * @param error - The error value
 * @returns Result with success: false
 */
export function failure<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Helper function to create a failed Result from ErrorDetails
 * @param details - Structured error details
 * @returns Result with ResultError
 */
export function failureFromDetails(details: ErrorDetails): Result<never, ResultError> {
  return failure(new ResultError(details));
}

/**
 * Helper function to wrap a native Error into a Result
 * @param error - Native Error object
 * @param code - Error code to classify the error
 * @param context - Additional context
 * @returns Result with ResultError
 */
export function failureFromError(
  error: Error,
  code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
  context?: Record<string, unknown>
): Result<never, ResultError> {
  return failure(
    new ResultError({
      code,
      message: error.message,
      context,
      cause: error,
      stack: error.stack,
    })
  );
}

/**
 * Type guard to check if a Result is successful
 * @param result - Result to check
 * @returns true if result is successful
 */
export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; value: T } {
  return result.success === true;
}

/**
 * Type guard to check if a Result is a failure
 * @param result - Result to check
 * @returns true if result is a failure
 */
export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

/**
 * Unwrap a Result, throwing an error if it's a failure
 * @param result - Result to unwrap
 * @returns The success value
 * @throws The error if result is a failure
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isSuccess(result)) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwrap a Result, returning a default value if it's a failure
 * @param result - Result to unwrap
 * @param defaultValue - Default value to return on failure
 * @returns The success value or default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return isSuccess(result) ? result.value : defaultValue;
}

/**
 * Map a successful Result value to a new value
 * @param result - Result to map
 * @param fn - Mapping function
 * @returns New Result with mapped value
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return isSuccess(result) ? success(fn(result.value)) : result;
}

/**
 * Chain Result operations (flatMap)
 * @param result - Result to chain from
 * @param fn - Function that returns a new Result
 * @returns New Result
 */
export function chain<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return isSuccess(result) ? fn(result.value) : result;
}

/**
 * Map error in a Result
 * @param result - Result to map error
 * @param fn - Error mapping function
 * @returns New Result with mapped error
 */
export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  return isFailure(result) ? failure(fn(result.error)) : result;
}

/**
 * Execute a function on the error if Result is a failure
 * @param result - Result to check
 * @param fn - Function to execute on error
 * @returns Original result
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
 * Execute a function on the value if Result is successful
 * @param result - Result to check
 * @param fn - Function to execute on value
 * @returns Original result
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
 * Convert a Promise to a Result
 * Useful for wrapping async operations
 * @param promise - Promise to convert
 * @param errorHandler - Optional function to convert error to ErrorDetails
 * @returns Promise that resolves to Result
 */
export async function fromPromise<T>(
  promise: Promise<T>,
  errorHandler?: (error: unknown) => ErrorDetails
): Promise<Result<T, ResultError>> {
  try {
    const value = await promise;
    return success(value);
  } catch (error) {
    if (errorHandler) {
      return failureFromDetails(errorHandler(error));
    }

    if (error instanceof Error) {
      return failureFromError(error);
    }

    return failureFromDetails({
      code: ErrorCode.UNKNOWN_ERROR,
      message: String(error),
    });
  }
}

/**
 * Execute a function and wrap the result in a Result
 * Catches any thrown errors
 * @param fn - Function to execute
 * @param errorHandler - Optional function to convert error to ErrorDetails
 * @returns Result
 */
export function tryCatch<T>(
  fn: () => T,
  errorHandler?: (error: unknown) => ErrorDetails
): Result<T, ResultError> {
  try {
    return success(fn());
  } catch (error) {
    if (errorHandler) {
      return failureFromDetails(errorHandler(error));
    }

    if (error instanceof Error) {
      return failureFromError(error);
    }

    return failureFromDetails({
      code: ErrorCode.UNKNOWN_ERROR,
      message: String(error),
    });
  }
}

/**
 * Combine multiple Results into a single Result
 * Returns success only if all Results are successful
 * @param results - Array of Results to combine
 * @returns Result with array of values or first error
 */
export function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (isFailure(result)) {
      return result;
    }
    values.push(result.value);
  }

  return success(values);
}
