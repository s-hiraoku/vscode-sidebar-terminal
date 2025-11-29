/**
 * ErrorHandler Utility
 *
 * Generic utility for standardized error handling across all WebView operations.
 *
 * Eliminates code duplication by providing a consistent error handling pattern
 * with logging, notifications, recovery, and rethrow capabilities.
 *
 * @see openspec/changes/refactor-terminal-foundation/specs/standardize-error-handling/spec.md
 */

import { terminalLogger } from './ManagerLogger';

/**
 * Severity levels for error handling
 */
export type ErrorSeverity = 'error' | 'warn' | 'info';

/**
 * Options for error handling behavior
 */
export interface ErrorHandlerOptions {
  /**
   * Severity level (determines emoji and logging level)
   */
  severity?: ErrorSeverity;

  /**
   * Whether to notify the user via UI
   */
  notify?: boolean;

  /**
   * Whether to rethrow the error after handling
   */
  rethrow?: boolean;

  /**
   * Recovery callback to execute after error handling
   */
  recovery?: () => void | Promise<void>;

  /**
   * Custom context information to include in logs
   */
  context?: Record<string, unknown>;
}

/**
 * Result of error handling operation
 */
export interface ErrorHandlingResult {
  handled: boolean;
  severity: ErrorSeverity;
  message: string;
  error?: unknown;
}

/**
 * Generic error handler with consistent pattern across all operations
 */
export class ErrorHandler {
  /**
   * Handle operation error with consistent logging and optional recovery
   *
   * @param operation - Name of the operation that failed (e.g., "Terminal creation", "Addon loading")
   * @param error - The error that occurred
   * @param options - Error handling options (severity, notify, rethrow, recovery)
   * @returns Error handling result for testing/debugging
   *
   * @example
   * // Basic error handling
   * try {
   *   await dangerousOperation();
   * } catch (error) {
   *   ErrorHandler.handleOperationError('Terminal creation', error);
   * }
   *
   * @example
   * // With notification and recovery
   * try {
   *   await criticalOperation();
   * } catch (error) {
   *   ErrorHandler.handleOperationError('Critical operation', error, {
   *     severity: 'error',
   *     notify: true,
   *     recovery: () => fallbackOperation()
   *   });
   * }
   *
   * @example
   * // Warning level with rethrow
   * try {
   *   await optionalOperation();
   * } catch (error) {
   *   ErrorHandler.handleOperationError('Optional operation', error, {
   *     severity: 'warn',
   *     rethrow: false
   *   });
   * }
   */
  public static handleOperationError(
    operation: string,
    error: unknown,
    options: ErrorHandlerOptions = {}
  ): ErrorHandlingResult {
    const severity = options.severity || 'error';
    const emoji = this.getSeverityEmoji(severity);
    const message = `${emoji} ${operation} failed`;

    // Log error with appropriate severity
    this.logError(severity, message, error, options.context);

    // Execute recovery callback if provided
    if (options.recovery) {
      try {
        const recoveryResult = options.recovery();
        if (recoveryResult instanceof Promise) {
          recoveryResult.catch((recoveryError) => {
            terminalLogger.error('❌ Recovery callback failed:', recoveryError);
          });
        }
      } catch (recoveryError) {
        terminalLogger.error('❌ Recovery callback failed:', recoveryError);
      }
    }

    // Notify user if requested
    if (options.notify) {
      this.notifyUser(message, severity);
    }

    // Rethrow if requested
    if (options.rethrow) {
      throw error;
    }

    return {
      handled: true,
      severity,
      message,
      error,
    };
  }

  /**
   * Get emoji for severity level
   */
  private static getSeverityEmoji(severity: ErrorSeverity): string {
    switch (severity) {
      case 'error':
        return '❌';
      case 'warn':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '❌';
    }
  }

  /**
   * Log error with appropriate severity level
   */
  private static logError(
    severity: ErrorSeverity,
    message: string,
    error: unknown,
    context?: Record<string, unknown>
  ): void {
    const contextStr = context ? JSON.stringify(context) : '';
    const contextInfo = contextStr ? ` [Context: ${contextStr}]` : '';
    const fullMessage = `${message}${contextInfo}`;

    switch (severity) {
      case 'error':
        terminalLogger.error(fullMessage, error);
        break;
      case 'warn':
        terminalLogger.warn(fullMessage, error);
        break;
      case 'info':
        terminalLogger.info(fullMessage, error);
        break;
    }
  }

  /**
   * Notify user via UI (placeholder for actual notification system)
   * This should be integrated with the actual NotificationManager
   */
  private static notifyUser(message: string, severity: ErrorSeverity): void {
    // Log notification intent (actual notification would go through NotificationManager)
    terminalLogger.debug(`[User Notification] ${severity.toUpperCase()}: ${message}`);

    // TODO: Integrate with NotificationManager when available
    // coordinator.notificationManager?.showNotification(message, severity);
  }

  /**
   * Create formatted error message with operation context
   */
  public static formatErrorMessage(operation: string, details?: string): string {
    return details ? `${operation}: ${details}` : operation;
  }

  /**
   * Extract error message from unknown error type
   */
  public static extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return String(error);
  }

  /**
   * Check if error is a specific type
   */
  public static isErrorType<T extends Error>(
    error: unknown,
    errorType: new (...args: any[]) => T
  ): error is T {
    return error instanceof errorType;
  }
}
