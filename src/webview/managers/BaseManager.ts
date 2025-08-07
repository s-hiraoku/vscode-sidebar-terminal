/**
 * Base Manager - Common functionality for all webview managers
 * Provides shared logging, lifecycle management, and common utilities
 * Enhanced with validation, error handling, and message processing patterns
 */

import { webview as log } from '../../utils/logger';
import { ValidationUtils, ValidationResult } from '../utils/ValidationUtils';
import type { IManagerCoordinator } from '../interfaces/ManagerInterfaces';

export interface BaseManagerOptions {
  logPrefix?: string;
  enableLogging?: boolean;
  enableValidation?: boolean;
  enableErrorRecovery?: boolean;
}

/**
 * Abstract base class for all webview managers
 * Enhanced with validation, error handling, and common patterns
 */
export abstract class BaseManager {
  protected readonly logPrefix: string;
  protected loggingEnabled: boolean;
  protected validationEnabled: boolean;
  protected errorRecoveryEnabled: boolean;
  protected isDisposed = false;

  // Manager lifecycle state
  protected initializationPromise?: Promise<void>;
  protected isInitialized = false;

  // Common state management
  protected coordinator?: IManagerCoordinator;
  protected errorCount = 0;
  protected readonly maxErrors = 10;

  // Common timers cache
  protected timers = new Map<string, NodeJS.Timeout>();

  constructor(managerName: string, options: BaseManagerOptions = {}) {
    this.logPrefix = options.logPrefix || `[${managerName}]`;
    this.loggingEnabled = options.enableLogging !== false;
    this.validationEnabled = options.enableValidation !== false;
    this.errorRecoveryEnabled = options.enableErrorRecovery !== false;
  }

  /**
   * Protected logging method with consistent formatting
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this.loggingEnabled) return;

    const formattedMessage = `${this.logPrefix} ${message}`;

    switch (level) {
      case 'warn':
        // Note: webview logger is a simple function, not a full logger interface
        log(`⚠️ ${formattedMessage}`);
        break;
      case 'error':
        log(`❌ ${formattedMessage}`);
        break;
      default:
        log(formattedMessage);
    }
  }

  /**
   * Initialize the manager - enhanced with coordinator validation
   */
  protected initialize(coordinator?: IManagerCoordinator): Promise<void> {
    this.log('Initializing manager');

    if (coordinator) {
      const validation = ValidationUtils.validateCoordinator(coordinator);
      if (!validation.isValid) {
        throw new Error(`Manager initialization failed: ${validation.error}`);
      }
      this.coordinator = coordinator;
    }

    this.isInitialized = true;
    this.errorCount = 0;
    return Promise.resolve();
  }

  /**
   * Ensure manager is initialized before performing operations
   */
  protected async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;

    if (!this.initializationPromise) {
      this.initializationPromise = this.initialize();
    }

    await this.initializationPromise;
  }

  /**
   * Dispose of resources - enhanced with timer cleanup
   */
  public dispose(): void {
    this.log('Disposing manager');

    // Clear all timers
    this.clearAllTimers();

    this.isDisposed = true;
    this.isInitialized = false;
    this.coordinator = undefined;
    this.errorCount = 0;
  }

  /**
   * Check if manager is disposed
   */
  protected checkDisposed(): void {
    if (this.isDisposed) {
      throw new Error(`${this.logPrefix} Manager has been disposed`);
    }
  }

  /**
   * Common debounce utility for managers
   */
  protected debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
        func.apply(this, args);
      }, wait);
    };
  }

  /**
   * Safe DOM operation wrapper
   */
  protected safeDOMOperation<T>(
    operation: () => T,
    fallback?: T,
    errorMessage?: string
  ): T | undefined {
    try {
      return operation();
    } catch (error) {
      const message = errorMessage || 'DOM operation failed';
      this.log(`${message}: ${String(error)}`, 'error');
      return fallback;
    }
  }

  /**
   * Common cache management utility
   */
  protected createCache<K, V>(): Map<K, V> {
    return new Map<K, V>();
  }

  /**
   * Enhanced validation wrapper for common operations
   */
  protected validateAndExecute<T>(
    operation: () => T,
    validations: Array<() => ValidationResult> = [],
    errorMessage?: string
  ): T {
    this.checkDisposed();

    if (this.validationEnabled && validations.length > 0) {
      const batchResult = ValidationUtils.validateBatch(validations);
      if (!batchResult.isValid) {
        const message = errorMessage || `Validation failed: ${batchResult.error}`;
        this.log(message, 'error');
        throw new Error(message);
      }
    }

    try {
      return operation();
    } catch (error) {
      this.handleError(error, errorMessage);
      throw error;
    }
  }

  /**
   * Common error handling with recovery
   */
  protected handleError(error: unknown, context?: string): void {
    this.errorCount++;
    const message = context ? `${context}: ${String(error)}` : String(error);
    this.log(message, 'error');

    if (this.errorRecoveryEnabled && this.errorCount > this.maxErrors) {
      this.log(`Maximum error count (${this.maxErrors}) exceeded, disposing manager`, 'error');
      this.dispose();
    }
  }

  /**
   * Timer management utilities
   */
  protected setTimer(key: string, callback: () => void, delay: number): void {
    this.clearTimer(key);
    this.timers.set(key, setTimeout(callback, delay));
  }

  protected clearTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  protected clearAllTimers(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * Common message validation
   */
  protected validateMessage(message: unknown): ValidationResult {
    if (!message || typeof message !== 'object') {
      return { isValid: false, error: 'Message must be an object' };
    }

    const msg = message as Record<string, unknown>;
    if (!msg.command) {
      return { isValid: false, error: 'Message must have a command' };
    }

    return ValidationUtils.validateMessageCommand(msg.command);
  }

  /**
   * Safe coordinator operation
   */
  protected safeCoordinatorOperation<T>(
    operation: (coordinator: IManagerCoordinator) => T,
    fallback?: T
  ): T | undefined {
    if (!this.coordinator) {
      this.log('No coordinator available for operation', 'warn');
      return fallback;
    }

    try {
      return operation(this.coordinator);
    } catch (error) {
      this.handleError(error, 'Coordinator operation failed');
      return fallback;
    }
  }

  /**
   * Get manager status for debugging - enhanced
   */
  public getStatus(): {
    managerName: string;
    isInitialized: boolean;
    isDisposed: boolean;
    loggingEnabled: boolean;
    validationEnabled: boolean;
    errorRecoveryEnabled: boolean;
    errorCount: number;
    hasCoordinator: boolean;
    activeTimers: number;
  } {
    return {
      managerName: this.logPrefix,
      isInitialized: this.isInitialized,
      isDisposed: this.isDisposed,
      loggingEnabled: this.loggingEnabled,
      validationEnabled: this.validationEnabled,
      errorRecoveryEnabled: this.errorRecoveryEnabled,
      errorCount: this.errorCount,
      hasCoordinator: !!this.coordinator,
      activeTimers: this.timers.size,
    };
  }
}
