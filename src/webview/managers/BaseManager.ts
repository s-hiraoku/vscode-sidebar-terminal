/**
 * Base Manager - Common functionality for all webview managers
 * Provides shared logging, lifecycle management, and common utilities
 * Enhanced with validation, error handling, and message processing patterns
 * Implements IBaseManager interface for factory pattern compatibility
 * 
 * Updated to support new utility classes:
 * - ManagerLogger for standardized logging
 * - EventHandlerRegistry for event management
 * - ResizeManager for resize operations
 * - ThemeManager for theming support
 */

import { webview as log } from '../../utils/logger';
import { ValidationUtils, ValidationResult } from '../utils/ValidationUtils';
import { ManagerLogger } from '../utils/ManagerLogger';
import { EventHandlerRegistry } from '../utils/EventHandlerRegistry';
import { ResizeManager } from '../utils/ResizeManager';
import { ThemeManager } from '../utils/ThemeManager';
import type { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import type {
  IBaseManager,
  ManagerInitializationConfig,
} from '../../factories/interfaces/ManagerFactoryInterfaces';

export interface BaseManagerOptions {
  logPrefix?: string;
  enableLogging?: boolean;
  enableValidation?: boolean;
  enableErrorRecovery?: boolean;
  // New utility options
  enableEventRegistry?: boolean;
  enableResizeManager?: boolean;
  enableThemeManager?: boolean;
  managerEmoji?: string;
}

/**
 * Abstract base class for all webview managers
 * Enhanced with validation, error handling, and common patterns
 * Implements IBaseManager interface for unified factory pattern
 */
export abstract class BaseManager implements IBaseManager {
  // IBaseManager interface requirements
  public readonly name: string;
  protected readonly logPrefix: string;
  protected loggingEnabled: boolean;
  protected validationEnabled: boolean;
  protected errorRecoveryEnabled: boolean;
  protected isDisposed = false;

  // Manager lifecycle state
  protected initializationPromise?: Promise<void>;
  protected _isInitialized = false;

  // Common state management
  protected coordinator?: IManagerCoordinator;
  protected errorCount = 0;
  protected readonly maxErrors = 10;

  // Common timers cache
  protected timers = new Map<string, NodeJS.Timeout>();

  // New utility instances
  protected logger?: ManagerLogger;
  protected eventRegistry?: EventHandlerRegistry;
  protected resizeManagerKey?: string;

  constructor(managerName: string, options: BaseManagerOptions = {}) {
    this.name = managerName;
    this.logPrefix = options.logPrefix || `[${managerName}]`;
    this.loggingEnabled = options.enableLogging !== false;
    this.validationEnabled = options.enableValidation !== false;
    this.errorRecoveryEnabled = options.enableErrorRecovery !== false;

    // Initialize utility instances based on options
    this.initializeUtilities(options);
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

  // IBaseManager interface implementation
  public get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Initialize the manager - IBaseManager interface implementation
   */
  public initialize(config: ManagerInitializationConfig): Promise<void> | void {
    this.log('Initializing manager');

    if (config.coordinator) {
      const validation = ValidationUtils.validateCoordinator(config.coordinator);
      if (!validation.isValid) {
        throw new Error(`Manager initialization failed: ${validation.error}`);
      }
      this.coordinator = config.coordinator;
    }

    // Apply configuration
    if (config.enableLogging !== undefined) {
      this.loggingEnabled = config.enableLogging;
    }
    if (config.enableValidation !== undefined) {
      this.validationEnabled = config.enableValidation;
    }
    if (config.enableErrorRecovery !== undefined) {
      this.errorRecoveryEnabled = config.enableErrorRecovery;
    }

    this._isInitialized = true;
    this.errorCount = 0;
    return Promise.resolve();
  }

  /**
   * Legacy initialize method for backward compatibility
   */
  protected initializeLegacy(coordinator?: IManagerCoordinator): Promise<void> {
    return this.initialize({
      managerName: this.name,
      coordinator,
      enableLogging: this.loggingEnabled,
      enableValidation: this.validationEnabled,
      enableErrorRecovery: this.errorRecoveryEnabled,
    }) as Promise<void>;
  }

  /**
   * Ensure manager is initialized before performing operations
   */
  protected async ensureInitialized(): Promise<void> {
    if (this._isInitialized) return;

    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeLegacy();
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

    // Dispose utility instances
    this.disposeUtilities();

    this.isDisposed = true;
    this._isInitialized = false;
    this.coordinator = undefined;
    this.errorCount = 0;
    
    // Clear utility references
    this.logger = undefined;
    this.resizeManagerKey = undefined;
  }

  /**
   * Initialize utility instances based on options
   */
  private initializeUtilities(options: BaseManagerOptions): void {
    // Initialize ManagerLogger if enabled
    if (options.enableLogging !== false) {
      const emoji = options.managerEmoji || '📋';
      this.logger = ManagerLogger.createLogger(this.name, emoji);
    }

    // Initialize EventHandlerRegistry if enabled
    if (options.enableEventRegistry !== false) {
      this.eventRegistry = new EventHandlerRegistry();
    }

    // Initialize ResizeManager key for this manager
    if (options.enableResizeManager !== false) {
      this.resizeManagerKey = `manager-${this.name.toLowerCase()}`;
    }

    // Initialize ThemeManager globally if enabled
    if (options.enableThemeManager !== false) {
      try {
        ThemeManager.initialize();
      } catch (error) {
        this.log('Failed to initialize ThemeManager:', error);
      }
    }
  }

  /**
   * Dispose utility instances
   */
  private disposeUtilities(): void {
    // Dispose EventHandlerRegistry
    if (this.eventRegistry) {
      this.eventRegistry.dispose();
      this.eventRegistry = undefined;
    }

    // Clear ResizeManager operations for this manager
    if (this.resizeManagerKey) {
      ResizeManager.clearResize(this.resizeManagerKey);
      ResizeManager.unobserveResize(this.resizeManagerKey);
    }

    // Note: ManagerLogger and ThemeManager are static utilities
    // and don't require instance-specific disposal
  }

  /**
   * Check if manager is disposed
   */
  protected checkDisposed(): void {
    if (this.isDisposed) {
      throw new Error(`${this.logPrefix} Manager has been disposed`);
    }
  }

  // Utility helper methods for new utilities

  /**
   * Enhanced logging method using ManagerLogger if available
   */
  protected logInfo(message: string, data?: unknown): void {
    if (this.logger) {
      this.logger.info(message, data);
    } else if (this.loggingEnabled) {
      this.log(message);
      if (data) console.log(data);
    }
  }

  protected logError(message: string, error?: unknown): void {
    if (this.logger) {
      this.logger.error(message, error);
    } else if (this.loggingEnabled) {
      this.log(`ERROR: ${message}`, error);
    }
  }

  protected logWarn(message: string, data?: unknown): void {
    if (this.logger) {
      this.logger.warn(message, data);
    } else if (this.loggingEnabled) {
      this.log(`WARN: ${message}`);
      if (data) console.log(data);
    }
  }

  protected logDebug(message: string, data?: unknown): void {
    if (this.logger) {
      this.logger.debug(message, data);
    } else if (this.loggingEnabled) {
      this.log(`DEBUG: ${message}`);
      if (data) console.log(data);
    }
  }

  /**
   * Register event listener using EventHandlerRegistry if available
   */
  protected registerEventListener(
    key: string,
    element: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (this.eventRegistry) {
      this.eventRegistry.register(key, element, type, listener, options);
    } else {
      // Fallback to manual registration
      element.addEventListener(type, listener, options);
      this.logWarn(`Manual event registration for ${key} - EventHandlerRegistry not available`);
    }
  }

  /**
   * Unregister event listener using EventHandlerRegistry if available
   */
  protected unregisterEventListener(key: string): boolean {
    if (this.eventRegistry) {
      return this.eventRegistry.unregister(key);
    } else {
      this.logWarn(`Cannot unregister ${key} - EventHandlerRegistry not available`);
      return false;
    }
  }

  /**
   * Setup resize observation using ResizeManager if available
   */
  protected observeResize(
    element: Element,
    callback: (entry: ResizeObserverEntry) => void,
    options?: { delay?: number }
  ): void {
    if (this.resizeManagerKey) {
      ResizeManager.observeResize(this.resizeManagerKey, element, callback, options);
    } else {
      this.logWarn('Cannot observe resize - ResizeManager not available');
    }
  }

  /**
   * Debounced resize using ResizeManager if available
   */
  protected debounceResize(
    callback: () => void | Promise<void>,
    options?: { delay?: number; immediate?: boolean }
  ): void {
    if (this.resizeManagerKey) {
      ResizeManager.debounceResize(this.resizeManagerKey, callback, options);
    } else {
      // Fallback to manual debounce
      this.debounce(callback, options?.delay || 100)();
    }
  }

  /**
   * Apply theme using ThemeManager if available
   */
  protected applyTheme(element: HTMLElement, theme?: { background?: string; borderColor?: string }): void {
    try {
      if (theme) {
        if (theme.background) {
          element.style.background = theme.background;
        }
        if (theme.borderColor) {
          element.style.borderColor = theme.borderColor;
        }
      } else {
        // Apply default theme from ThemeManager
        ThemeManager.applyTheme(element);
      }
    } catch (error) {
      this.logWarn('Failed to apply theme', error);
    }
  }

  /**
   * Get VS Code theme colors using ThemeManager
   */
  protected getThemeColors(): { background: string; foreground: string; border: string } {
    try {
      return ThemeManager.getThemeColors();
    } catch (error) {
      this.logWarn('Failed to get theme colors, using defaults', error);
      return {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        border: '#454545'
      };
    }
  }

  /**
   * Cleanup resize operations for this manager
   */
  protected cleanupResize(): void {
    if (this.resizeManagerKey) {
      ResizeManager.clearResize(this.resizeManagerKey);
      ResizeManager.unobserveResize(this.resizeManagerKey);
    }
  }

  /**
   * Create and register a debounced operation
   */
  protected createDebouncedOperation(
    key: string,
    operation: () => void | Promise<void>,
    delay: number = 100
  ): () => void {
    const debouncedOp = this.debounce(operation, delay);
    
    // Store timer reference for cleanup
    return () => {
      this.clearTimer(key);
      const timer = setTimeout(() => {
        debouncedOp();
        this.timers.delete(key);
      }, delay);
      this.timers.set(key, timer);
    };
  }

  /**
   * Safe DOM query with error handling
   */
  protected querySelector<T extends HTMLElement = HTMLElement>(
    selector: string,
    container?: HTMLElement | Document
  ): T | null {
    return this.safeDOMOperation(() => {
      const parent = container || document;
      return parent.querySelector(selector) as T;
    }, null, `Failed to query selector: ${selector}`);
  }

  /**
   * Safe DOM query all with error handling
   */
  protected querySelectorAll<T extends HTMLElement = HTMLElement>(
    selector: string,
    container?: HTMLElement | Document
  ): NodeListOf<T> | T[] {
    return this.safeDOMOperation(() => {
      const parent = container || document;
      return parent.querySelectorAll(selector) as NodeListOf<T>;
    }, [] as T[], `Failed to query selector all: ${selector}`) || [] as T[];
  }

  /**
   * Safe element creation with error handling
   */
  protected createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    options?: {
      className?: string;
      id?: string;
      textContent?: string;
      attributes?: Record<string, string>;
      styles?: Partial<CSSStyleDeclaration>;
    }
  ): HTMLElementTagNameMap[K] | null {
    return this.safeDOMOperation(() => {
      const element = document.createElement(tagName);
      
      if (options) {
        if (options.className) element.className = options.className;
        if (options.id) element.id = options.id;
        if (options.textContent) element.textContent = options.textContent;
        
        if (options.attributes) {
          Object.entries(options.attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
          });
        }
        
        if (options.styles) {
          Object.assign(element.style, options.styles);
        }
      }
      
      return element;
    }, null, `Failed to create element: ${tagName}`);
  }

  /**
   * Validate element exists and is of expected type
   */
  protected validateElement<T extends HTMLElement>(
    element: HTMLElement | null,
    expectedTag?: string
  ): element is T {
    if (!element) {
      this.logWarn('Element validation failed: element is null');
      return false;
    }
    
    if (expectedTag && element.tagName.toLowerCase() !== expectedTag.toLowerCase()) {
      this.logWarn(`Element validation failed: expected ${expectedTag}, got ${element.tagName}`);
      return false;
    }
    
    return true;
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
    hasLogger: boolean;
    hasEventRegistry: boolean;
    hasResizeManager: boolean;
  } {
    return {
      managerName: this.logPrefix,
      isInitialized: this._isInitialized,
      isDisposed: this.isDisposed,
      loggingEnabled: this.loggingEnabled,
      validationEnabled: this.validationEnabled,
      errorRecoveryEnabled: this.errorRecoveryEnabled,
      errorCount: this.errorCount,
      hasCoordinator: !!this.coordinator,
      activeTimers: this.timers.size,
      hasLogger: !!this.logger,
      hasEventRegistry: !!this.eventRegistry,
      hasResizeManager: !!this.resizeManagerKey,
    };
  }
}
