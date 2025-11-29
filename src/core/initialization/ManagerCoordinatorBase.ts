/**
 * Manager Coordinator Base
 *
 * Abstract base class for coordinating multiple managers/services.
 * Consolidates manager initialization patterns from:
 * - LightweightTerminalWebviewManager (15+ specialized managers)
 * - SecondaryTerminalProvider (event coordinator, services)
 *
 * Provides:
 * - Centralized manager lifecycle management
 * - Coordinator relationship setup
 * - Manager initialization ordering
 * - Manager disposal coordination
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/218
 */

import { info as logInfo, warn as logWarn, error as logError } from '../../utils/logger';

export interface IManager {
  /** Set coordinator reference (optional) */
  setCoordinator?(coordinator: unknown): void;

  /** Initialize manager (optional) */
  initialize?(): void | Promise<void>;

  /** Dispose manager resources (optional) */
  dispose?(): void;
}

export interface ManagerMetrics {
  totalManagers: number;
  initializedManagers: number;
  failedInitializations: number;
  initializationTime: number;
}

/**
 * Abstract base class for manager coordination
 */
export abstract class ManagerCoordinatorBase<TManagerKey extends string = string> {
  protected readonly managers = new Map<TManagerKey, IManager>();
  private _initializationMetrics: ManagerMetrics = {
    totalManagers: 0,
    initializedManagers: 0,
    failedInitializations: 0,
    initializationTime: 0,
  };

  /**
   * Template Method - Initialize all managers
   *
   * This method should NOT be overridden by subclasses.
   * Instead, implement createCoreManagers() and createSpecializedManagers().
   */
  public async initializeAllManagers(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logInitialization('Starting manager initialization...');

      // Step 1: Create core managers (required)
      await this.createCoreManagers();

      // Step 2: Create specialized managers (optional)
      await this.createSpecializedManagers();

      // Step 3: Set coordinator references
      this.setCoordinatorReferences();

      // Step 4: Initialize manager instances
      await this.initializeManagerInstances();

      // Update metrics
      this._initializationMetrics.totalManagers = this.managers.size;
      this._initializationMetrics.initializationTime = Date.now() - startTime;

      this.logInitialization(
        `Manager initialization complete: ${this._initializationMetrics.initializedManagers}/${this._initializationMetrics.totalManagers} managers in ${this._initializationMetrics.initializationTime}ms`
      );
    } catch (error) {
      this.logError('Manager initialization failed', error);
      throw error;
    }
  }

  /**
   * Dispose all managers
   */
  public disposeAllManagers(): void {
    this.logInitialization('Disposing managers...');

    let disposedCount = 0;
    this.managers.forEach((manager, key) => {
      try {
        if (manager.dispose) {
          manager.dispose();
          disposedCount++;
        }
      } catch (error) {
        this.logError(`Failed to dispose manager '${String(key)}'`, error);
      }
    });

    this.managers.clear();
    this.logInitialization(`Disposed ${disposedCount} managers`);
  }

  /**
   * Get a manager by key
   */
  public getManager<T extends IManager>(key: TManagerKey): T | undefined {
    return this.managers.get(key) as T | undefined;
  }

  /**
   * Check if a manager exists
   */
  public hasManager(key: TManagerKey): boolean {
    return this.managers.has(key);
  }

  /**
   * Get all manager keys
   */
  public getManagerKeys(): TManagerKey[] {
    return Array.from(this.managers.keys());
  }

  /**
   * Get manager metrics
   */
  public getMetrics(): ManagerMetrics {
    return { ...this._initializationMetrics };
  }

  // ============================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ============================================================================

  /**
   * Create core managers (required)
   *
   * Examples:
   * - LightweightTerminalWebviewManager: Create WebViewApiManager, SplitManager, etc.
   * - SecondaryTerminalProvider: Create WebViewCommunicationService, PanelLocationService
   */
  protected abstract createCoreManagers(): Promise<void>;

  // ============================================================================
  // HOOK METHODS - Optional overrides with default implementations
  // ============================================================================

  /**
   * Create specialized managers (optional)
   *
   * Override to add context-specific managers.
   *
   * Example:
   * - LightweightTerminalWebviewManager: Create FindInTerminalManager, ProfileManager
   */
  protected async createSpecializedManagers(): Promise<void> {
    // Default: No-op
  }

  /**
   * Set coordinator references on all managers
   *
   * Override to customize coordinator setup.
   *
   * Default behavior: Call setCoordinator(this) on all managers that support it.
   */
  protected setCoordinatorReferences(): void {
    this.managers.forEach((manager, key) => {
      try {
        if (manager.setCoordinator) {
          manager.setCoordinator(this);
          this.logInitialization(`Set coordinator for '${String(key)}'`);
        }
      } catch (error) {
        this.logError(`Failed to set coordinator for '${String(key)}'`, error);
      }
    });
  }

  /**
   * Initialize all manager instances
   *
   * Override to customize initialization order or logic.
   *
   * Default behavior: Call initialize() on all managers that support it.
   */
  protected async initializeManagerInstances(): Promise<void> {
    for (const [key, manager] of this.managers.entries()) {
      try {
        if (manager.initialize) {
          await manager.initialize();
          this._initializationMetrics.initializedManagers++;
          this.logInitialization(`Initialized '${String(key)}'`);
        }
      } catch (error) {
        this._initializationMetrics.failedInitializations++;
        this.handleManagerInitializationError(key, manager, error);
      }
    }
  }

  /**
   * Handle manager initialization error
   *
   * Override to implement custom error handling (e.g., fallback managers).
   *
   * Example:
   * - LightweightTerminalWebviewManager: Use NOOP_SHELL_INTEGRATION_MANAGER on error
   */
  protected handleManagerInitializationError(
    key: TManagerKey,
    manager: IManager,
    error: unknown
  ): void {
    this.logError(`Failed to initialize manager '${String(key)}'`, error);
    throw error;
  }

  // ============================================================================
  // CONCRETE UTILITY METHODS - Reusable (DO NOT override)
  // ============================================================================

  /**
   * Register a manager
   */
  protected registerManager(key: TManagerKey, manager: IManager): void {
    if (this.managers.has(key)) {
      this.logWarning(`Manager '${String(key)}' already registered (overwriting)`);
    }

    this.managers.set(key, manager);
    this.logInitialization(`Registered manager '${String(key)}'`);
  }

  /**
   * Register multiple managers at once
   */
  protected registerManagers(managers: Record<string, IManager>): void {
    Object.entries(managers).forEach(([key, manager]) => {
      this.registerManager(key as TManagerKey, manager);
    });
  }

  /**
   * Unregister a manager
   */
  protected unregisterManager(key: TManagerKey): boolean {
    const manager = this.managers.get(key);

    if (manager) {
      try {
        if (manager.dispose) {
          manager.dispose();
        }
      } catch (error) {
        this.logError(`Error disposing manager '${String(key)}'`, error);
      }

      return this.managers.delete(key);
    }

    return false;
  }

  /**
   * Log initialization information
   */
  protected logInitialization(message: string): void {
    logInfo(`[ManagerCoordinator] ${message}`);
  }

  /**
   * Log warning
   */
  protected logWarning(message: string): void {
    logWarn(`[ManagerCoordinator] ${message}`);
  }

  /**
   * Log error
   */
  protected logError(message: string, error: unknown): void {
    logError(`[ManagerCoordinator] ${message}:`, error);
  }
}
