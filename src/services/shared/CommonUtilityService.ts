import { terminal as log } from '../../utils/logger';

/**
 * Common validation result interface
 */
export interface ValidationResult<T = any> {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: T;
}

/**
 * Retry configuration for operations
 */
export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  exponentialBackoff: boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Debounce configuration
 */
export interface DebounceConfig {
  delayMs: number;
  immediate?: boolean;
  maxWait?: number;
}

/**
 * Common Utility Service
 *
 * Extracts common patterns used throughout the codebase:
 * - Async operations with retry logic
 * - Debouncing and throttling utilities
 * - Validation and error handling patterns
 * - Resource cleanup and lifecycle management
 * - Performance monitoring utilities
 * - Type-safe event handling patterns
 *
 * This service reduces code duplication by centralizing frequently
 * used utility functions across terminal services, WebView managers,
 * and configuration management.
 */
export class CommonUtilityService {
  private readonly _debounceTimers = new Map<string, NodeJS.Timeout>();
  private readonly _throttleLastExecution = new Map<string, number>();

  constructor() {
    log('🛠️ [CommonUtility] Common utility service initialized');
  }

  /**
   * Execute operation with retry logic
   */
  async withRetry<T>(operation: () => Promise<T>, config: Partial<RetryConfig> = {}): Promise<T> {
    const { maxAttempts = 3, delayMs = 1000, exponentialBackoff = true, onRetry } = config;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          log(`✅ [CommonUtility] Operation succeeded on attempt ${attempt}/${maxAttempts}`);
        }
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          log(`❌ [CommonUtility] Operation failed after ${maxAttempts} attempts:`, lastError);
          break;
        }

        const delay = exponentialBackoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;
        log(
          `⚠️ [CommonUtility] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms:`,
          lastError.message
        );

        if (onRetry) {
          onRetry(attempt, lastError);
        }

        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Debounce function execution
   */
  debounce<T extends (...args: any[]) => any>(
    key: string,
    func: T,
    config: DebounceConfig
  ): (...args: Parameters<T>) => void {
    const { delayMs, immediate = false, maxWait } = config;

    return (...args: Parameters<T>) => {
      const existingTimer = this._debounceTimers.get(key);
      const callNow = immediate && !existingTimer;

      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this._debounceTimers.delete(key);
        if (!immediate) {
          func.apply(this, args);
        }
      }, delayMs);

      this._debounceTimers.set(key, timer);

      if (callNow) {
        func.apply(this, args);
      }

      // Handle maxWait option
      if (maxWait && !immediate) {
        setTimeout(() => {
          if (this._debounceTimers.has(key)) {
            clearTimeout(this._debounceTimers.get(key)!);
            this._debounceTimers.delete(key);
            func.apply(this, args);
          }
        }, maxWait);
      }
    };
  }

  /**
   * Throttle function execution
   */
  throttle<T extends (...args: any[]) => any>(
    key: string,
    func: T,
    delayMs: number
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const lastExecution = this._throttleLastExecution.get(key) || 0;
      const now = Date.now();

      if (now - lastExecution >= delayMs) {
        this._throttleLastExecution.set(key, now);
        func.apply(this, args);
      }
    };
  }

  /**
   * Safe async execution with error boundaries
   */
  async safeExecute<T>(
    operation: () => Promise<T>,
    errorHandler?: (error: Error) => T | undefined,
    context?: string
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      const err = error as Error;
      log(`❌ [CommonUtility] Safe execution failed${context ? ` in ${context}` : ''}:`, err);

      if (errorHandler) {
        try {
          return errorHandler(err);
        } catch (handlerError) {
          log(`❌ [CommonUtility] Error handler also failed:`, handlerError);
        }
      }

      return undefined;
    }
  }

  /**
   * Generic validation with configurable rules
   */
  validate<T>(
    data: T,
    rules: Array<{
      name: string;
      validator: (data: T) => boolean | string;
      level: 'error' | 'warning';
    }>,
    context?: string
  ): ValidationResult<T> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of rules) {
      try {
        const result = rule.validator(data);

        if (result === false) {
          const message = `Validation failed: ${rule.name}`;
          if (rule.level === 'error') {
            errors.push(message);
          } else {
            warnings.push(message);
          }
        } else if (typeof result === 'string') {
          if (rule.level === 'error') {
            errors.push(result);
          } else {
            warnings.push(result);
          }
        }
      } catch (error) {
        const message = `Validation rule '${rule.name}' threw error: ${error}`;
        errors.push(message);
      }
    }

    const isValid = errors.length === 0;

    if (context && (errors.length > 0 || warnings.length > 0)) {
      log(
        `🔍 [CommonUtility] Validation result for ${context}: ${errors.length} errors, ${warnings.length} warnings`
      );
    }

    return {
      isValid,
      errors,
      warnings,
      data: isValid ? data : undefined,
    };
  }

  /**
   * Resource cleanup with timeout
   */
  async cleanupWithTimeout<T extends { dispose?: () => void | Promise<void> }>(
    resources: T[],
    timeoutMs: number = 5000
  ): Promise<void> {
    const cleanupPromises = resources.map(async (resource, index) => {
      try {
        if (resource && typeof resource.dispose === 'function') {
          await resource.dispose();
          log(`✅ [CommonUtility] Cleaned up resource ${index + 1}/${resources.length}`);
        }
      } catch (error) {
        log(`⚠️ [CommonUtility] Error cleaning up resource ${index + 1}:`, error);
      }
    });

    try {
      await Promise.race([
        Promise.all(cleanupPromises),
        this.timeout(timeoutMs, `Resource cleanup timed out after ${timeoutMs}ms`),
      ]);
      log(`✅ [CommonUtility] All ${resources.length} resources cleaned up successfully`);
    } catch (error) {
      log(`⚠️ [CommonUtility] Resource cleanup completed with warnings:`, error);
    }
  }

  /**
   * Create a timeout promise that rejects after specified time
   */
  timeout(ms: number, message?: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message || `Operation timed out after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Promise-based delay utility
   */
  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a cancelable promise
   */
  createCancelablePromise<T>(promise: Promise<T>): { promise: Promise<T>; cancel: () => void } {
    let isCanceled = false;

    const cancelablePromise = new Promise<T>((resolve, reject) => {
      promise.then(
        (value) => (isCanceled ? reject(new Error('Operation canceled')) : resolve(value)),
        (error) => (isCanceled ? reject(new Error('Operation canceled')) : reject(error))
      );
    });

    return {
      promise: cancelablePromise,
      cancel: () => {
        isCanceled = true;
      },
    };
  }

  /**
   * Measure execution time of operations
   */
  async measureTime<T>(
    operation: () => Promise<T> | T,
    label?: string
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();

    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      if (label) {
        log(`⏱️ [CommonUtility] ${label} completed in ${duration.toFixed(2)}ms`);
      }

      return { result, duration };
    } catch (error) {
      const duration = performance.now() - startTime;
      if (label) {
        log(`⏱️ [CommonUtility] ${label} failed after ${duration.toFixed(2)}ms`);
      }
      throw error;
    }
  }

  /**
   * Deep clone object (simple implementation)
   */
  deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as T;
    }

    if (obj instanceof Array) {
      return obj.map((item) => this.deepClone(item)) as T;
    }

    if (typeof obj === 'object') {
      const cloned = {} as T;
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          (cloned as any)[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }

    return obj;
  }

  /**
   * Check if value is empty (null, undefined, empty string, empty array, empty object)
   */
  isEmpty(value: any): boolean {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  /**
   * Flatten nested arrays
   */
  flatten<T>(arr: (T | T[])[]): T[] {
    return arr.reduce<T[]>((flat, item) => {
      return flat.concat(Array.isArray(item) ? this.flatten(item) : item);
    }, []);
  }

  /**
   * Group array items by a key function
   */
  groupBy<T, K extends string | number>(array: T[], keyFn: (item: T) => K): Record<K, T[]> {
    return array.reduce(
      (groups, item) => {
        const key = keyFn(item);
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(item);
        return groups;
      },
      {} as Record<K, T[]>
    );
  }

  /**
   * Clear all debounce timers for cleanup
   */
  clearAllTimers(): void {
    for (const timer of this._debounceTimers.values()) {
      clearTimeout(timer);
    }
    this._debounceTimers.clear();
    this._throttleLastExecution.clear();

    log('🧹 [CommonUtility] All timers cleared');
  }

  /**
   * Get utility service statistics
   */
  getStats(): {
    activeDebounceTimers: number;
    activeThrottles: number;
  } {
    return {
      activeDebounceTimers: this._debounceTimers.size,
      activeThrottles: this._throttleLastExecution.size,
    };
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    log('🧹 [CommonUtility] Disposing common utility service');

    try {
      this.clearAllTimers();
      log('✅ [CommonUtility] Common utility service disposed');
    } catch (error) {
      log('❌ [CommonUtility] Error disposing common utility service:', error);
    }
  }
}
