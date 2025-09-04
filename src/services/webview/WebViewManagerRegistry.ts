// import { IManagerCoordinator } from '../../webview/interfaces/IManagerCoordinator';
import { terminal as log } from '../../utils/logger';

/**
 * Manager registration interface
 */
export interface ManagerRegistration<T = any> {
  name: string;
  instance: T;
  dependencies: string[];
  priority: number;
  isEnabled: boolean;
}

/**
 * Manager lifecycle events
 */
export interface ManagerLifecycleEvent {
  action: 'register' | 'unregister' | 'enable' | 'disable';
  managerName: string;
  timestamp: number;
}

/**
 * WebView Manager Registry
 * 
 * Centralized registry for managing all WebView managers with:
 * - Dynamic registration and discovery
 * - Dependency management and resolution  
 * - Lifecycle management and coordination
 * - Performance monitoring and optimization
 * - Error isolation and recovery
 * 
 * This service addresses the proliferation of WebView managers by providing
 * a unified registration and coordination system.
 */
export class WebViewManagerRegistry {
  private readonly _managers = new Map<string, ManagerRegistration>();
  private readonly _dependencyGraph = new Map<string, Set<string>>();
  private readonly _initializationOrder: string[] = [];
  
  private _isInitialized = false;
  private _coordinator?: any; // IManagerCoordinator;

  constructor() {
    log('🏗️ [ManagerRegistry] WebView manager registry initialized');
  }

  /**
   * Register a manager with the registry
   */
  registerManager<T>(
    name: string,
    instance: T,
    options: {
      dependencies?: string[];
      priority?: number;
      enabled?: boolean;
    } = {}
  ): void {
    try {
      if (this._managers.has(name)) {
        log(`⚠️ [ManagerRegistry] Manager ${name} already registered, skipping`);
        return;
      }

      const registration: ManagerRegistration<T> = {
        name,
        instance,
        dependencies: options.dependencies || [],
        priority: options.priority || 0,
        isEnabled: options.enabled !== false,
      };

      this._managers.set(name, registration);
      this._updateDependencyGraph(name, registration.dependencies);

      log(`✅ [ManagerRegistry] Registered manager: ${name} (priority: ${registration.priority}, dependencies: [${registration.dependencies.join(', ')}])`);

    } catch (error) {
      log(`❌ [ManagerRegistry] Failed to register manager ${name}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a manager from the registry
   */
  unregisterManager(name: string): void {
    try {
      if (!this._managers.has(name)) {
        log(`⚠️ [ManagerRegistry] Manager ${name} not found for unregistration`);
        return;
      }

      const registration = this._managers.get(name)!;
      
      // Check if other managers depend on this one
      const dependents = this._findDependents(name);
      if (dependents.length > 0) {
        log(`⚠️ [ManagerRegistry] Cannot unregister ${name} - still has dependents: [${dependents.join(', ')}]`);
        throw new Error(`Cannot unregister ${name}: dependencies exist`);
      }

      // Dispose if manager has dispose method
      if (registration.instance && typeof (registration.instance as any).dispose === 'function') {
        try {
          (registration.instance as any).dispose();
          log(`🧹 [ManagerRegistry] Disposed manager: ${name}`);
        } catch (disposeError) {
          log(`⚠️ [ManagerRegistry] Error disposing manager ${name}:`, disposeError);
        }
      }

      this._managers.delete(name);
      this._dependencyGraph.delete(name);
      
      // Remove from initialization order
      const index = this._initializationOrder.indexOf(name);
      if (index !== -1) {
        this._initializationOrder.splice(index, 1);
      }

      log(`✅ [ManagerRegistry] Unregistered manager: ${name}`);

    } catch (error) {
      log(`❌ [ManagerRegistry] Failed to unregister manager ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get a registered manager instance
   */
  getManager<T = any>(name: string): T | undefined {
    const registration = this._managers.get(name);
    if (!registration) {
      log(`⚠️ [ManagerRegistry] Manager ${name} not found`);
      return undefined;
    }

    if (!registration.isEnabled) {
      log(`⚠️ [ManagerRegistry] Manager ${name} is disabled`);
      return undefined;
    }

    return registration.instance as T;
  }

  /**
   * Check if a manager is registered and enabled
   */
  hasManager(name: string): boolean {
    const registration = this._managers.get(name);
    return !!(registration && registration.isEnabled);
  }

  /**
   * Enable or disable a manager
   */
  setManagerEnabled(name: string, enabled: boolean): void {
    try {
      const registration = this._managers.get(name);
      if (!registration) {
        log(`⚠️ [ManagerRegistry] Cannot enable/disable non-existent manager: ${name}`);
        return;
      }

      if (registration.isEnabled === enabled) {
        return; // No change needed
      }

      registration.isEnabled = enabled;
      
      log(`🔄 [ManagerRegistry] Manager ${name} ${enabled ? 'enabled' : 'disabled'}`);

    } catch (error) {
      log(`❌ [ManagerRegistry] Failed to set manager ${name} enabled state:`, error);
      throw error;
    }
  }

  /**
   * Initialize all managers in dependency order
   */
  async initializeManagers(coordinator?: any): Promise<void> {
    if (this._isInitialized) {
      log('⚠️ [ManagerRegistry] Managers already initialized');
      return;
    }

    try {
      this._coordinator = coordinator;
      
      // Resolve initialization order based on dependencies
      const initOrder = this._resolveInitializationOrder();
      this._initializationOrder.push(...initOrder);

      log(`🚀 [ManagerRegistry] Initializing ${initOrder.length} managers in dependency order: [${initOrder.join(' → ')}]`);

      // Initialize managers in order
      for (const managerName of initOrder) {
        await this._initializeManager(managerName);
      }

      this._isInitialized = true;
      log('✅ [ManagerRegistry] All managers initialized successfully');

    } catch (error) {
      log('❌ [ManagerRegistry] Failed to initialize managers:', error);
      throw error;
    }
  }

  /**
   * Dispose all managers in reverse initialization order
   */
  dispose(): void {
    log('🧹 [ManagerRegistry] Disposing all managers');

    try {
      // Dispose in reverse order of initialization
      const disposeOrder = [...this._initializationOrder].reverse();
      
      for (const managerName of disposeOrder) {
        try {
          const registration = this._managers.get(managerName);
          if (registration?.instance && typeof (registration.instance as any).dispose === 'function') {
            (registration.instance as any).dispose();
            log(`🧹 [ManagerRegistry] Disposed manager: ${managerName}`);
          }
        } catch (error) {
          log(`⚠️ [ManagerRegistry] Error disposing manager ${managerName}:`, error);
        }
      }

      // Clear all registrations
      this._managers.clear();
      this._dependencyGraph.clear();
      this._initializationOrder.length = 0;
      
      this._isInitialized = false;
      this._coordinator = undefined;

      log('✅ [ManagerRegistry] Manager registry disposed');

    } catch (error) {
      log('❌ [ManagerRegistry] Error disposing manager registry:', error);
    }
  }

  /**
   * Get registry statistics for debugging
   */
  getRegistryStats(): {
    totalManagers: number;
    enabledManagers: number;
    disabledManagers: number;
    initializationOrder: string[];
    dependencyGraph: Record<string, string[]>;
    isInitialized: boolean;
  } {
    const enabled = Array.from(this._managers.values()).filter(r => r.isEnabled).length;
    const disabled = this._managers.size - enabled;

    const dependencyGraph: Record<string, string[]> = {};
    for (const [name, deps] of this._dependencyGraph) {
      dependencyGraph[name] = Array.from(deps);
    }

    return {
      totalManagers: this._managers.size,
      enabledManagers: enabled,
      disabledManagers: disabled,
      initializationOrder: [...this._initializationOrder],
      dependencyGraph,
      isInitialized: this._isInitialized,
    };
  }

  /**
   * Get all registered manager names
   */
  getManagerNames(): string[] {
    return Array.from(this._managers.keys());
  }

  /**
   * Validate registry state and dependencies
   */
  validateRegistry(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check for circular dependencies
      const cycles = this._detectCircularDependencies();
      if (cycles.length > 0) {
        errors.push(`Circular dependencies detected: ${cycles.map(cycle => cycle.join(' → ')).join(', ')}`);
      }

      // Check for missing dependencies
      for (const [name, registration] of this._managers) {
        for (const dep of registration.dependencies) {
          if (!this._managers.has(dep)) {
            errors.push(`Manager ${name} depends on missing manager: ${dep}`);
          }
        }
      }

      // Check for unreachable managers (no path from root)
      const unreachable = this._findUnreachableManagers();
      if (unreachable.length > 0) {
        warnings.push(`Unreachable managers (no dependency path): [${unreachable.join(', ')}]`);
      }

      log(`✅ [ManagerRegistry] Registry validation: ${errors.length} errors, ${warnings.length} warnings`);

    } catch (error) {
      errors.push(`Registry validation failed: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Update dependency graph for a manager
   */
  private _updateDependencyGraph(name: string, dependencies: string[]): void {
    this._dependencyGraph.set(name, new Set(dependencies));
  }

  /**
   * Resolve initialization order using topological sort
   */
  private _resolveInitializationOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (name: string): void => {
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected involving: ${name}`);
      }
      if (visited.has(name)) {
        return;
      }

      visiting.add(name);
      
      const dependencies = this._dependencyGraph.get(name) || new Set();
      for (const dep of dependencies) {
        visit(dep);
      }
      
      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    // Visit all managers, sorted by priority (higher priority first)
    const managersByPriority = Array.from(this._managers.entries())
      .filter(([_, reg]) => reg.isEnabled)
      .sort(([_a, regA], [_b, regB]) => regB.priority - regA.priority);

    for (const [name] of managersByPriority) {
      if (!visited.has(name)) {
        visit(name);
      }
    }

    return order;
  }

  /**
   * Initialize a specific manager
   */
  private async _initializeManager(name: string): Promise<void> {
    try {
      const registration = this._managers.get(name);
      if (!registration || !registration.isEnabled) {
        return;
      }

      const manager = registration.instance;
      
      // Call initialize method if available
      if (manager && typeof (manager as any).initialize === 'function') {
        await (manager as any).initialize(this._coordinator);
        log(`🚀 [ManagerRegistry] Initialized manager: ${name}`);
      }

      // Set coordinator if manager supports it
      if (manager && typeof (manager as any).setCoordinator === 'function') {
        (manager as any).setCoordinator(this._coordinator);
      }

    } catch (error) {
      log(`❌ [ManagerRegistry] Failed to initialize manager ${name}:`, error);
      throw new Error(`Manager initialization failed: ${name} - ${error}`);
    }
  }

  /**
   * Find managers that depend on a specific manager
   */
  private _findDependents(target: string): string[] {
    const dependents: string[] = [];
    
    for (const [name, deps] of this._dependencyGraph) {
      if (deps.has(target)) {
        dependents.push(name);
      }
    }
    
    return dependents;
  }

  /**
   * Detect circular dependencies in the dependency graph
   */
  private _detectCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const path: string[] = [];

    const visit = (name: string): void => {
      if (visiting.has(name)) {
        // Found cycle - extract the cycle from the path
        const cycleStart = path.indexOf(name);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), name]);
        }
        return;
      }
      if (visited.has(name)) {
        return;
      }

      visiting.add(name);
      path.push(name);
      
      const dependencies = this._dependencyGraph.get(name) || new Set();
      for (const dep of dependencies) {
        visit(dep);
      }
      
      path.pop();
      visiting.delete(name);
      visited.add(name);
    };

    for (const name of this._managers.keys()) {
      if (!visited.has(name)) {
        visit(name);
      }
    }

    return cycles;
  }

  /**
   * Find managers with no dependency path (orphaned managers)
   */
  private _findUnreachableManagers(): string[] {
    const reachable = new Set<string>();
    
    // Find root managers (no dependencies)
    const rootManagers = Array.from(this._managers.keys())
      .filter(name => {
        const deps = this._dependencyGraph.get(name);
        return !deps || deps.size === 0;
      });

    // Mark all reachable managers via DFS
    const markReachable = (name: string): void => {
      if (reachable.has(name)) {
        return;
      }
      reachable.add(name);
      
      // Mark all dependents as reachable
      for (const dependent of this._findDependents(name)) {
        markReachable(dependent);
      }
    };

    for (const root of rootManagers) {
      markReachable(root);
    }

    // Find unreachable managers
    const unreachable = Array.from(this._managers.keys())
      .filter(name => !reachable.has(name));

    return unreachable;
  }
}