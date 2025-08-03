/**
 * Base Manager - Common functionality for all webview managers
 * Provides shared logging, lifecycle management, and common utilities
 */

import { webview as log } from '../../utils/logger';

export interface BaseManagerOptions {
  logPrefix?: string;
  enableLogging?: boolean;
}

/**
 * Abstract base class for all webview managers
 * Provides common functionality like logging, lifecycle management, and utility methods
 */
export abstract class BaseManager {
  protected readonly logPrefix: string;
  protected loggingEnabled: boolean;
  protected isDisposed = false;

  // Manager lifecycle state
  protected initializationPromise?: Promise<void>;
  protected isInitialized = false;

  constructor(managerName: string, options: BaseManagerOptions = {}) {
    this.logPrefix = options.logPrefix || `[${managerName}]`;
    this.loggingEnabled = options.enableLogging !== false;
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
   * Initialize the manager - should be overridden by subclasses
   */
  protected async initialize(): Promise<void> {
    this.log('Initializing manager');
    this.isInitialized = true;
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
   * Dispose of resources - should be overridden by subclasses
   */
  public dispose(): void {
    this.log('Disposing manager');
    this.isDisposed = true;
    this.isInitialized = false;
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
  protected debounce<T extends (...args: any[]) => any>(
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
      this.log(`${message}: ${error}`, 'error');
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
   * Get manager status for debugging
   */
  public getStatus(): {
    managerName: string;
    isInitialized: boolean;
    isDisposed: boolean;
    loggingEnabled: boolean;
  } {
    return {
      managerName: this.logPrefix,
      isInitialized: this.isInitialized,
      isDisposed: this.isDisposed,
      loggingEnabled: this.loggingEnabled,
    };
  }
}
