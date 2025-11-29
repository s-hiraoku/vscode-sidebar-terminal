/**
 * Manager Registry - Unified Lifecycle Management
 *
 * Provides centralized registration, initialization, and disposal of managers.
 * Eliminates duplicate initialization/disposal code across 27+ managers.
 *
 * Key Features:
 * - Dependency-ordered initialization
 * - LIFO (Last-In-First-Out) disposal for safe cleanup
 * - Lazy initialization support
 * - Type-safe manager retrieval
 *
 * @example
 * ```typescript
 * const registry = new ManagerRegistry();
 *
 * // Register managers
 * registry.register('notification', () => new NotificationManager());
 * registry.register('ui', () => new UIManager(), { dependsOn: ['notification'] });
 *
 * // Initialize all
 * await registry.initializeAll();
 *
 * // Get manager
 * const ui = registry.get<UIManager>('ui');
 *
 * // Dispose all (LIFO order)
 * registry.disposeAll();
 * ```
 */

import { webview as log } from '../../utils/logger';

/**
 * Lifecycle interface that all managers should implement
 */
export interface IManagerLifecycle {
  initialize?(): void | Promise<void>;
  dispose(): void;
}

/**
 * Registration options for managers
 */
export interface ManagerRegistrationOptions {
  /** If true, manager is created only when first accessed */
  lazy?: boolean;
  /** Manager IDs that must be initialized before this one */
  dependsOn?: string[];
  /** Priority for initialization order (higher = earlier) */
  priority?: number;
}

interface RegisteredManager {
  factory: () => IManagerLifecycle;
  instance: IManagerLifecycle | null;
  options: ManagerRegistrationOptions;
  initialized: boolean;
}

/**
 * Manager Registry for unified lifecycle management
 */
export class ManagerRegistry {
  private readonly managers = new Map<string, RegisteredManager>();
  private initOrder: string[] = [];
  private isDisposed = false;

  /**
   * Register a manager with optional configuration
   *
   * @param name Unique identifier for the manager
   * @param factory Function that creates the manager instance
   * @param options Registration options (lazy, dependencies, priority)
   * @returns The manager instance (unless lazy)
   */
  public register<T extends IManagerLifecycle>(
    name: string,
    factory: () => T,
    options: ManagerRegistrationOptions = {}
  ): T | null {
    if (this.managers.has(name)) {
      log(`[ManagerRegistry] ⚠️ Manager '${name}' already registered, skipping`);
      return this.get<T>(name) ?? null;
    }

    const registered: RegisteredManager = {
      factory,
      instance: options.lazy ? null : factory(),
      options,
      initialized: false,
    };

    this.managers.set(name, registered);

    if (!options.lazy && registered.instance) {
      this.initOrder.push(name);
    }

    log(`[ManagerRegistry] ✅ Registered manager: ${name}${options.lazy ? ' (lazy)' : ''}`);

    return registered.instance as T | null;
  }

  /**
   * Get a registered manager by name
   *
   * @param name Manager identifier
   * @returns The manager instance or undefined
   */
  public get<T extends IManagerLifecycle>(name: string): T | undefined {
    const registered = this.managers.get(name);

    if (!registered) {
      log(`[ManagerRegistry] ⚠️ Manager '${name}' not found`);
      return undefined;
    }

    // Lazy instantiation
    if (!registered.instance) {
      registered.instance = registered.factory();
      this.initOrder.push(name);
      log(`[ManagerRegistry] 🔧 Lazy-created manager: ${name}`);
    }

    return registered.instance as T;
  }

  /**
   * Check if a manager is registered
   */
  public has(name: string): boolean {
    return this.managers.has(name);
  }

  /**
   * Initialize all registered managers in dependency order
   */
  public async initializeAll(): Promise<void> {
    if (this.isDisposed) {
      throw new Error('[ManagerRegistry] Cannot initialize after disposal');
    }

    log('[ManagerRegistry] 🚀 Initializing all managers...');
    const startTime = performance.now();

    // Sort by priority and dependencies
    const sortedNames = this.getSortedInitOrder();

    for (const name of sortedNames) {
      await this.initializeManager(name);
    }

    const elapsed = performance.now() - startTime;
    log(`[ManagerRegistry] ✅ All managers initialized (${elapsed.toFixed(2)}ms)`);
  }

  /**
   * Initialize a single manager
   */
  private async initializeManager(name: string): Promise<void> {
    const registered = this.managers.get(name);

    if (!registered || registered.initialized) {
      return;
    }

    // Initialize dependencies first
    for (const dep of registered.options.dependsOn || []) {
      await this.initializeManager(dep);
    }

    // Create instance if lazy
    if (!registered.instance) {
      registered.instance = registered.factory();
      this.initOrder.push(name);
    }

    // Call initialize if available
    if (registered.instance.initialize) {
      try {
        await registered.instance.initialize();
        log(`[ManagerRegistry] ✅ Initialized: ${name}`);
      } catch (error) {
        log(`[ManagerRegistry] ❌ Failed to initialize ${name}:`, error);
        throw error;
      }
    }

    registered.initialized = true;
  }

  /**
   * Get initialization order sorted by priority and dependencies
   */
  private getSortedInitOrder(): string[] {
    const entries = Array.from(this.managers.entries());

    // Sort by priority (higher first), then by registration order
    entries.sort((a, b) => {
      const priorityA = a[1].options.priority ?? 0;
      const priorityB = b[1].options.priority ?? 0;
      return priorityB - priorityA;
    });

    // Topological sort for dependencies
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`[ManagerRegistry] Circular dependency detected: ${name}`);
      }

      visiting.add(name);
      const registered = this.managers.get(name);

      for (const dep of registered?.options.dependsOn || []) {
        visit(dep);
      }

      visiting.delete(name);
      visited.add(name);
      result.push(name);
    };

    for (const [name] of entries) {
      visit(name);
    }

    return result;
  }

  /**
   * Dispose all managers in reverse order (LIFO)
   */
  public disposeAll(): void {
    if (this.isDisposed) {
      log('[ManagerRegistry] ⚠️ Already disposed');
      return;
    }

    log('[ManagerRegistry] 🧹 Disposing all managers...');
    const startTime = performance.now();

    // Dispose in reverse order (LIFO)
    const disposeOrder = [...this.initOrder].reverse();

    for (const name of disposeOrder) {
      this.disposeManager(name);
    }

    this.managers.clear();
    this.initOrder = [];
    this.isDisposed = true;

    const elapsed = performance.now() - startTime;
    log(`[ManagerRegistry] ✅ All managers disposed (${elapsed.toFixed(2)}ms)`);
  }

  /**
   * Dispose a single manager
   */
  private disposeManager(name: string): void {
    const registered = this.managers.get(name);

    if (!registered?.instance) {
      return;
    }

    try {
      registered.instance.dispose();
      log(`[ManagerRegistry] 🧹 Disposed: ${name}`);
    } catch (error) {
      log(`[ManagerRegistry] ❌ Error disposing ${name}:`, error);
    }

    registered.instance = null;
    registered.initialized = false;
  }

  /**
   * Get statistics about registered managers
   */
  public getStats(): {
    total: number;
    initialized: number;
    lazy: number;
    names: string[];
  } {
    let initialized = 0;
    let lazy = 0;
    const names: string[] = [];

    for (const [name, registered] of this.managers.entries()) {
      names.push(name);
      if (registered.initialized) initialized++;
      if (registered.options.lazy) lazy++;
    }

    return {
      total: this.managers.size,
      initialized,
      lazy,
      names,
    };
  }
}
