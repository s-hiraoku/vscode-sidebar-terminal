/**
 * Enhanced Base Manager - Consolidates common patterns found across all managers
 *
 * This enhanced base class addresses the code duplication identified in the analysis:
 * - Standardized initialization and lifecycle management
 * - Common debouncing and throttling patterns
 * - Unified error handling and recovery mechanisms
 * - Consistent event listener management
 * - Performance monitoring and health tracking
 */

import { webview as log } from '../../utils/logger';
import {
  IEnhancedBaseManager,
  IManagerState,
  ManagerDependencies,
  ManagerHealthStatus,
  ValidationResult,
} from '../interfaces/SegregatedManagerInterfaces';

/**
 * Enhanced base manager options
 */
export interface EnhancedManagerOptions {
  logPrefix?: string;
  enableLogging?: boolean;
  enableValidation?: boolean;
  enableErrorRecovery?: boolean;
  enablePerformanceMonitoring?: boolean;
  maxErrors?: number;
  healthCheckInterval?: number;
}

/**
 * Event listener registration for automatic cleanup
 */
interface ManagedEventListener {
  element: EventTarget;
  event: string;
  listener: EventListener;
  options?: boolean | AddEventListenerOptions;
}

/**
 * Performance metrics tracking
 */
interface PerformanceMetrics {
  operationsPerSecond: number;
  averageResponseTime: number;
  memoryUsage: number;
  lastOperationTime: number;
  totalOperations: number;
}

/**
 * Enhanced abstract base class for all webview managers
 * Implements common patterns identified in similarity analysis
 */
export abstract class EnhancedBaseManager implements IEnhancedBaseManager {
  // Enhanced manager interface implementation
  readonly state: IManagerState = {
    isInitialized: false,
    isDisposed: false
  };
  // Core properties
  public readonly name: string;
  protected readonly logPrefix: string;
  protected readonly options: Required<EnhancedManagerOptions>;

  // Lifecycle state
  protected _isInitialized = false;
  protected _isDisposed = false;
  protected dependencies: ManagerDependencies = {};

  // Error tracking and recovery
  protected errorCount = 0;
  protected lastError?: string;
  protected readonly maxErrors: number;

  // Timer management (consolidated pattern from multiple managers)
  protected timers = new Map<string, number>();
  protected debounceTimers = new Map<string, number>();

  // Event listener management (extracted from InputManager, UIManager patterns)
  protected eventListeners = new Map<string, ManagedEventListener>();

  // Performance monitoring
  protected performanceMetrics: PerformanceMetrics = {
    operationsPerSecond: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    lastOperationTime: 0,
    totalOperations: 0,
  };

  // Health monitoring
  protected healthCheckTimer?: number;

  constructor(managerName: string, options: EnhancedManagerOptions = {}) {
    this.name = managerName;
    this.logPrefix = options.logPrefix || `[${managerName}]`;

    // Apply defaults to all options
    this.options = {
      enableLogging: options.enableLogging ?? true,
      enableValidation: options.enableValidation ?? true,
      enableErrorRecovery: options.enableErrorRecovery ?? true,
      enablePerformanceMonitoring: options.enablePerformanceMonitoring ?? false,
      maxErrors: options.maxErrors ?? 10,
      healthCheckInterval: options.healthCheckInterval ?? 30000, // 30 seconds
      logPrefix: this.logPrefix,
    };

    this.maxErrors = this.options.maxErrors;
  }

  // Required interface methods
  getState(): IManagerState {
    return {
      isInitialized: this._isInitialized,
      isDisposed: this._isDisposed,
      lastError: this.lastError ? new Error(this.lastError) : undefined
    };
  }

  isReady(): boolean {
    return this._isInitialized && !this._isDisposed;
  }

  getLastError(): Error | undefined {
    return this.lastError ? new Error(this.lastError) : undefined;
  }

  // ============================================================================
  // CORE LIFECYCLE METHODS
  // ============================================================================

  public get isInitialized(): boolean {
    return this._isInitialized;
  }

  public async initialize(dependencies: ManagerDependencies): Promise<void> {
    if (this._isInitialized) {
      this.log('Manager already initialized', 'warn');
      return;
    }

    if (this._isDisposed) {
      throw new Error(`${this.logPrefix} Cannot initialize disposed manager`);
    }

    try {
      this.log('Initializing manager...');

      // Store dependencies
      this.dependencies = { ...dependencies };

      // Validate dependencies if validation is enabled
      if (this.options.enableValidation) {
        await this.validateDependencies(dependencies);
      }

      // Call derived class initialization
      await this.onInitialize(dependencies);

      // Setup health monitoring if enabled
      if (this.options.enablePerformanceMonitoring) {
        this.startHealthMonitoring();
      }

      this._isInitialized = true;
      this.log('Manager initialized successfully');
    } catch (error) {
      this.handleError(error, 'Initialization failed');
      throw error;
    }
  }

  public dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this.log('Disposing manager...');

    try {
      // Stop health monitoring
      this.stopHealthMonitoring();

      // Call derived class cleanup
      this.onDispose();

      // Clear all timers
      this.clearAllTimers();
      this.clearAllDebounceTimers();

      // Remove all event listeners
      this.removeAllEventListeners();

      // Reset state
      this._isInitialized = false;
      this._isDisposed = true;
      this.dependencies = {};
      this.errorCount = 0;

      this.log('Manager disposed successfully');
    } catch (error) {
      this.handleError(error, 'Disposal failed');
    }
  }

  // ============================================================================
  // ABSTRACT METHODS FOR DERIVED CLASSES
  // ============================================================================

  /**
   * Override in derived classes for specific initialization logic
   */
  protected async onInitialize(_dependencies: ManagerDependencies): Promise<void> {
    // Default implementation - no specific initialization
  }

  /**
   * Override in derived classes for specific cleanup logic
   */
  protected onDispose(): void {
    // Default implementation - no specific cleanup
  }

  /**
   * Override in derived classes to validate required dependencies
   */
  protected async validateDependencies(_dependencies: ManagerDependencies): Promise<void> {
    // Default implementation - no validation
  }

  // ============================================================================
  // COMMON UTILITY METHODS (extracted from multiple managers)
  // ============================================================================

  /**
   * Protected logging method with consistent formatting
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this.options.enableLogging) return;

    const formattedMessage = `${this.logPrefix} ${message}`;

    switch (level) {
      case 'warn':
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
   * Enhanced debounce utility with automatic cleanup
   * Consolidated pattern from InputManager, UIManager, PerformanceManager
   */
  protected debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
    key?: string
  ): (...args: Parameters<T>) => void {
    const debounceKey = key || `debounce_${func.name}_${Math.random()}`;

    return (...args: Parameters<T>) => {
      // Clear existing timer
      this.clearDebounceTimer(debounceKey);

      // Set new timer
      const timerId = window.setTimeout(() => {
        this.measurePerformance(() => {
          func.apply(this, args);
        }, `debounced_${func.name}`);
        this.debounceTimers.delete(debounceKey);
      }, delay);

      this.debounceTimers.set(debounceKey, timerId);
    };
  }

  /**
   * Throttle utility for high-frequency operations
   * Pattern found in PerformanceManager
   */
  protected throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number,
    _key?: string
  ): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        inThrottle = true;
        this.measurePerformance(() => {
          func.apply(this, args);
        }, `throttled_${func.name}`);

        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  }

  /**
   * Managed event listener registration with automatic cleanup
   * Pattern extracted from InputManager
   */
  protected addEventListenerManaged(
    element: EventTarget,
    event: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
    key?: string
  ): string {
    const listenerKey = key || `${event}_${Date.now()}_${Math.random()}`;

    element.addEventListener(event, listener, options);

    this.eventListeners.set(listenerKey, {
      element,
      event,
      listener,
      options,
    });

    return listenerKey;
  }

  /**
   * Remove specific managed event listener
   */
  protected removeEventListenerManaged(key: string): void {
    const managed = this.eventListeners.get(key);
    if (managed) {
      managed.element.removeEventListener(managed.event, managed.listener, managed.options);
      this.eventListeners.delete(key);
    }
  }

  /**
   * Remove all managed event listeners
   */
  protected removeAllEventListeners(): void {
    for (const [, managed] of this.eventListeners) {
      managed.element.removeEventListener(managed.event, managed.listener, managed.options);
    }
    this.eventListeners.clear();
  }

  /**
   * Timer management utilities (consolidated from multiple managers)
   */
  protected setTimer(key: string, callback: () => void, delay: number): void {
    this.clearTimer(key);
    const timerId = window.setTimeout(callback, delay);
    this.timers.set(key, timerId);
  }

  protected clearTimer(key: string): void {
    const timerId = this.timers.get(key);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      this.timers.delete(key);
    }
  }

  protected clearAllTimers(): void {
    for (const timerId of this.timers.values()) {
      window.clearTimeout(timerId);
    }
    this.timers.clear();
  }

  protected clearDebounceTimer(key: string): void {
    const timerId = this.debounceTimers.get(key);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      this.debounceTimers.delete(key);
    }
  }

  protected clearAllDebounceTimers(): void {
    for (const timerId of this.debounceTimers.values()) {
      window.clearTimeout(timerId);
    }
    this.debounceTimers.clear();
  }

  // ============================================================================
  // ERROR HANDLING AND RECOVERY (enhanced pattern from BaseManager)
  // ============================================================================

  /**
   * Enhanced error handling with recovery mechanisms
   */
  protected handleError(error: unknown, context?: string): void {
    this.errorCount++;
    this.lastError = String(error);

    const message = context ? `${context}: ${String(error)}` : String(error);
    this.log(message, 'error');

    // Error recovery if enabled and threshold exceeded
    if (this.options.enableErrorRecovery && this.errorCount > this.maxErrors) {
      this.log(`Maximum error count (${this.maxErrors}) exceeded, disposing manager`, 'error');
      this.dispose();
    }
  }

  /**
   * Safe operation wrapper with error handling
   */
  protected async safeExecute<T>(
    operation: () => T | Promise<T>,
    fallback?: T,
    context?: string
  ): Promise<T | undefined> {
    try {
      return await this.measurePerformance(async () => {
        return await operation();
      }, context || 'safe_operation');
    } catch (error) {
      this.handleError(error, context);
      return fallback;
    }
  }

  /**
   * Validation wrapper for operations
   */
  protected validateAndExecute<T>(
    operation: () => T,
    validations: Array<() => ValidationResult> = [],
    context?: string
  ): T {
    this.checkNotDisposed();

    if (this.options.enableValidation && validations.length > 0) {
      const errors: string[] = [];
      for (const validation of validations) {
        const result = validation();
        if (!result.isValid && result.errors) {
          errors.push(...result.errors);
        }
      }

      if (errors.length > 0) {
        const message = `Validation failed: ${errors.join('; ')}`;
        this.log(message, 'error');
        throw new Error(message);
      }
    }

    return this.measurePerformance(operation, context || 'validated_operation');
  }

  // ============================================================================
  // PERFORMANCE MONITORING
  // ============================================================================

  /**
   * Measure performance of operations
   */
  protected measurePerformance<T>(operation: () => T, operationName?: string): T {
    if (!this.options.enablePerformanceMonitoring) {
      return operation();
    }

    const startTime = performance.now();
    const result = operation();
    const endTime = performance.now();
    const duration = endTime - startTime;

    this.updatePerformanceMetrics(duration);

    if (operationName && duration > 10) {
      // Log slow operations
      this.log(`Operation ${operationName} took ${duration.toFixed(2)}ms`);
    }

    return result;
  }

  /**
   * Update performance metrics
   */
  protected updatePerformanceMetrics(operationDuration: number): void {
    this.performanceMetrics.totalOperations++;
    this.performanceMetrics.lastOperationTime = operationDuration;

    // Update rolling average
    const alpha = 0.1; // Smoothing factor
    this.performanceMetrics.averageResponseTime =
      alpha * operationDuration + (1 - alpha) * this.performanceMetrics.averageResponseTime;

    // Calculate operations per second (sliding window)
    const windowSize = 5000; // 5 seconds
    this.performanceMetrics.operationsPerSecond =
      this.performanceMetrics.totalOperations / (windowSize / 1000);
  }

  // ============================================================================
  // HEALTH MONITORING
  // ============================================================================

  /**
   * Get manager health status
   */
  public getHealthStatus(): ManagerHealthStatus {
    return {
      isHealthy: this.errorCount < this.maxErrors && this._isInitialized && !this._isDisposed,
      errorCount: this.errorCount,
      lastError: this.lastError ? new Error(this.lastError) : undefined,
      errors: [],
      warnings: [],
      lastCheck: new Date(),
    };
  }

  /**
   * Start health monitoring
   */
  protected startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = window.setInterval(() => {
      const health = this.getHealthStatus();
      if (!health.isHealthy) {
        this.log(`Health check failed: ${health.lastError || 'Unknown error'}`, 'warn');
      }
    }, this.options.healthCheckInterval);
  }

  /**
   * Stop health monitoring
   */
  protected stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      window.clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Get estimated memory usage (rough approximation)
   */
  protected getMemoryUsage(): number {
    // Rough estimation based on manager state
    return (
      this.timers.size * 50 +
      this.debounceTimers.size * 50 +
      this.eventListeners.size * 100 +
      Object.keys(this.dependencies).length * 25
    );
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if manager is disposed and throw if it is
   */
  protected checkNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error(`${this.logPrefix} Manager has been disposed`);
    }
  }

  /**
   * Get dependency with type safety
   */
  protected getDependency<T>(key: keyof ManagerDependencies): T | undefined {
    return this.dependencies[key] as T | undefined;
  }

  /**
   * Require dependency (throws if not available)
   */
  protected requireDependency<T>(key: keyof ManagerDependencies, errorMessage?: string): T {
    const dependency = this.getDependency<T>(key);
    if (!dependency) {
      const message = errorMessage || `Required dependency '${String(key)}' not available`;
      throw new Error(`${this.logPrefix} ${message}`);
    }
    return dependency;
  }

  /**
   * Create a managed promise that respects disposal
   */
  protected createManagedPromise<T>(
    executor: (resolve: (value: T) => void, reject: (reason?: any) => void) => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this._isDisposed) {
        reject(new Error(`${this.logPrefix} Manager is disposed`));
        return;
      }

      executor(
        (value) => {
          if (!this._isDisposed) {
            resolve(value);
          }
        },
        (reason) => {
          if (!this._isDisposed) {
            reject(reason);
          }
        }
      );
    });
  }
}
