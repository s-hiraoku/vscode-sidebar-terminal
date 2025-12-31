/**
 * BaseCoordinator
 *
 * Abstract base class for all terminal coordinators.
 * Provides common patterns for resource management, logging, and lifecycle handling.
 *
 * Key Features:
 * - Unified resource tracking with automatic cleanup
 * - Consistent logging patterns
 * - Standardized dispose lifecycle
 * - Type-safe timeout management
 * - Debug logging support
 *
 * @example
 * class MyCoordinator extends BaseCoordinator {
 *   constructor() {
 *     super('MyCoordinator');
 *   }
 *
 *   protected disposeResources(): void {
 *     // Custom cleanup logic
 *   }
 * }
 */

import * as vscode from 'vscode';
import { terminal as log } from '../utils/logger';

/**
 * Resource tracker for managing disposables and timeouts
 */
export class ResourceTracker<T extends vscode.Disposable | (() => void)> {
  private readonly resources = new Map<string, T>();

  /**
   * Track a resource with a unique ID
   */
  public track(id: string, resource: T): void {
    // Dispose existing resource if present
    this.untrack(id);
    this.resources.set(id, resource);
  }

  /**
   * Untrack and dispose a resource
   */
  public untrack(id: string): boolean {
    const resource = this.resources.get(id);
    if (resource) {
      this.disposeResource(resource);
      this.resources.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Check if a resource is tracked
   */
  public has(id: string): boolean {
    return this.resources.has(id);
  }

  /**
   * Get a tracked resource
   */
  public get(id: string): T | undefined {
    return this.resources.get(id);
  }

  /**
   * Get all tracked resource IDs
   */
  public keys(): string[] {
    return Array.from(this.resources.keys());
  }

  /**
   * Get the number of tracked resources
   */
  public get size(): number {
    return this.resources.size;
  }

  /**
   * Dispose all tracked resources
   */
  public disposeAll(): void {
    for (const resource of this.resources.values()) {
      this.disposeResource(resource);
    }
    this.resources.clear();
  }

  private disposeResource(resource: T): void {
    try {
      if (typeof resource === 'function') {
        resource();
      } else if (resource && typeof resource.dispose === 'function') {
        resource.dispose();
      }
    } catch (error) {
      log(`⚠️ [ResourceTracker] Error disposing resource:`, error);
    }
  }
}

/**
 * Timeout manager for coordinating delayed operations
 */
export class TimeoutManager {
  private readonly timeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Set a timeout with automatic tracking
   */
  public set(id: string, callback: () => void, delayMs: number): void {
    // Clear existing timeout if present
    this.clear(id);

    const timeoutId = setTimeout(() => {
      this.timeouts.delete(id);
      callback();
    }, delayMs);

    this.timeouts.set(id, timeoutId);
  }

  /**
   * Clear a specific timeout
   */
  public clear(id: string): boolean {
    const timeoutId = this.timeouts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Check if a timeout is pending
   */
  public has(id: string): boolean {
    return this.timeouts.has(id);
  }

  /**
   * Clear all timeouts
   */
  public clearAll(): void {
    for (const timeoutId of this.timeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.timeouts.clear();
  }

  /**
   * Get the number of pending timeouts
   */
  public get size(): number {
    return this.timeouts.size;
  }
}

/**
 * State tracker for managing string flags/markers
 */
export class StateTracker {
  private readonly states = new Set<string>();

  /**
   * Add a state flag
   */
  public add(id: string): void {
    this.states.add(id);
  }

  /**
   * Remove a state flag
   */
  public remove(id: string): boolean {
    return this.states.delete(id);
  }

  /**
   * Check if a state is set
   */
  public has(id: string): boolean {
    return this.states.has(id);
  }

  /**
   * Clear all states
   */
  public clear(): void {
    this.states.clear();
  }

  /**
   * Get all state IDs
   */
  public values(): string[] {
    return Array.from(this.states);
  }

  /**
   * Get the number of states
   */
  public get size(): number {
    return this.states.size;
  }
}

/**
 * Abstract base class for coordinators
 */
export abstract class BaseCoordinator {
  protected readonly name: string;
  protected readonly debugEnabled: boolean;
  protected readonly disposables: ResourceTracker<vscode.Disposable>;
  protected readonly timeouts: TimeoutManager;
  protected isDisposed = false;

  constructor(name: string, debugEnabled: boolean = false) {
    this.name = name;
    this.debugEnabled = debugEnabled;
    this.disposables = new ResourceTracker<vscode.Disposable>();
    this.timeouts = new TimeoutManager();
  }

  /**
   * Log a message with coordinator prefix
   */
  protected log(...args: unknown[]): void {
    log(`[${this.name}]`, ...args);
  }

  /**
   * Log a debug message (only if debug is enabled)
   */
  protected debugLog(...args: unknown[]): void {
    if (this.debugEnabled) {
      log(`[${this.name}:DEBUG]`, ...args);
    }
  }

  /**
   * Log a warning message
   */
  protected warn(...args: unknown[]): void {
    log(`⚠️ [${this.name}]`, ...args);
  }

  /**
   * Log an error message
   */
  protected error(...args: unknown[]): void {
    log(`❌ [${this.name}]`, ...args);
  }

  /**
   * Execute an operation with error handling
   */
  protected safeExecute<T>(
    operation: () => T,
    operationName: string,
    fallback?: T
  ): T | undefined {
    try {
      return operation();
    } catch (error) {
      this.error(`Error in ${operationName}:`, error);
      return fallback;
    }
  }

  /**
   * Execute an async operation with error handling
   */
  protected async safeExecuteAsync<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallback?: T
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      this.error(`Error in ${operationName}:`, error);
      return fallback;
    }
  }

  /**
   * Check if the coordinator has been disposed
   */
  protected checkDisposed(): void {
    if (this.isDisposed) {
      throw new Error(`${this.name} has been disposed`);
    }
  }

  /**
   * Abstract method for subclass-specific cleanup
   * Called before base class cleanup
   */
  protected abstract disposeResources(): void;

  /**
   * Dispose all coordinator resources
   */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;

    // Call subclass cleanup first
    this.safeExecute(
      () => this.disposeResources(),
      'disposeResources'
    );

    // Cleanup base class resources
    this.timeouts.clearAll();
    this.disposables.disposeAll();

    this.log('🧹 Disposed');
  }
}

/**
 * Utility function to create a cleanup guard
 * Ensures cleanup happens even if errors occur
 */
export function createCleanupGuard(cleanup: () => void): { dispose: () => void } {
  let disposed = false;
  return {
    dispose: () => {
      if (!disposed) {
        disposed = true;
        cleanup();
      }
    },
  };
}
