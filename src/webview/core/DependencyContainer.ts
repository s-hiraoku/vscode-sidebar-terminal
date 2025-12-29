/**
 * Dependency Injection Container
 *
 * Addresses the tight coupling issues identified in the analysis by providing
 * a centralized dependency management system with lifecycle support.
 */

import { webview as log } from '../../utils/logger';
import { DEPENDENCY_CONTAINER_CONSTANTS } from '../constants/webview';
import {
  IEnhancedBaseManager,
  ManagerDependencies,
  ITerminalCoordinator,
  IExtensionCommunicator,
  ISettingsCoordinator,
  ICliAgentCoordinator,
  ISessionCoordinator,
  ILoggingCoordinator,
  IManagerProvider,
} from '../interfaces/SegregatedManagerInterfaces';

/**
 * Service registration types
 */
export enum ServiceType {
  // Coordinator services
  TERMINAL_COORDINATOR = 'terminal_coordinator',
  EXTENSION_COMMUNICATOR = 'extension_communicator',
  SETTINGS_COORDINATOR = 'settings_coordinator',
  CLI_AGENT_COORDINATOR = 'cli_agent_coordinator',
  SESSION_COORDINATOR = 'session_coordinator',
  LOGGING_COORDINATOR = 'logging_coordinator',
  MANAGER_PROVIDER = 'manager_provider',

  // Manager services
  UI_MANAGER = 'ui_manager',
  INPUT_MANAGER = 'input_manager',
  PERFORMANCE_MANAGER = 'performance_manager',
  CONFIG_MANAGER = 'config_manager',
  MESSAGE_MANAGER = 'message_manager',
  NOTIFICATION_MANAGER = 'notification_manager',
  SPLIT_MANAGER = 'split_manager',

  // Utility services
  ERROR_MANAGER = 'error_manager',
  PERFORMANCE_MONITOR = 'performance_monitor',
  VALIDATION_SERVICE = 'validation_service',
}

/**
 * Service lifecycle states
 */
export enum ServiceLifecycle {
  REGISTERED = 'registered',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  DISPOSING = 'disposing',
  DISPOSED = 'disposed',
  ERROR = 'error',
}

/**
 * Service registration interface
 */
export interface ServiceRegistration<T = any> {
  factory: () => T | Promise<T>;
  lifecycle: ServiceLifecycle;
  dependencies: ServiceType[];
  instance?: T;
  error?: Error;
  initializationPromise?: Promise<T>;
}

/**
 * Dependency injection container with lifecycle management
 */
export class DependencyContainer {
  private services = new Map<ServiceType, ServiceRegistration>();
  private initializationOrder: ServiceType[] = [];
  private disposalOrder: ServiceType[] = [];
  private isDisposing = false;

  /**
   * Register a service with its factory and dependencies
   */
  public register<T>(
    serviceType: ServiceType,
    factory: () => T | Promise<T>,
    dependencies: ServiceType[] = []
  ): void {
    if (this.services.has(serviceType)) {
      throw new Error(`Service ${serviceType} is already registered`);
    }

    this.services.set(serviceType, {
      factory,
      lifecycle: ServiceLifecycle.REGISTERED,
      dependencies,
    });

    log(`🔧 [DI] Registered service: ${serviceType}`);
  }

  /**
   * Register a service with an existing instance
   */
  public registerInstance<T>(
    serviceType: ServiceType,
    instance: T,
    dependencies: ServiceType[] = []
  ): void {
    this.services.set(serviceType, {
      factory: () => instance,
      lifecycle: ServiceLifecycle.INITIALIZED,
      dependencies,
      instance,
    });

    log(`🔧 [DI] Registered instance: ${serviceType}`);
  }

  /**
   * Resolve a service and its dependencies
   */
  public async resolve<T>(serviceType: ServiceType): Promise<T> {
    if (this.isDisposing) {
      throw new Error('Container is disposing, cannot resolve services');
    }

    const registration = this.services.get(serviceType);
    if (!registration) {
      throw new Error(`Service ${serviceType} is not registered`);
    }

    // Return existing instance if available
    if (registration.instance) {
      return registration.instance as T;
    }

    // Return existing initialization promise if in progress
    if (registration.initializationPromise) {
      return registration.initializationPromise as Promise<T>;
    }

    // Start initialization
    registration.lifecycle = ServiceLifecycle.INITIALIZING;
    registration.initializationPromise = this.initializeService<T>(serviceType, registration);

    try {
      const instance = await registration.initializationPromise;
      registration.instance = instance;
      registration.lifecycle = ServiceLifecycle.INITIALIZED;

      // Track initialization order for proper disposal
      if (!this.initializationOrder.includes(serviceType)) {
        this.initializationOrder.push(serviceType);
      }

      log(`✅ [DI] Resolved service: ${serviceType}`);
      return instance;
    } catch (error) {
      registration.lifecycle = ServiceLifecycle.ERROR;
      registration.error = error as Error;
      throw error;
    }
  }

  /**
   * Initialize a service and its dependencies
   */
  private async initializeService<T>(
    serviceType: ServiceType,
    registration: ServiceRegistration<T>
  ): Promise<T> {
    // Resolve dependencies first
    const resolvedDependencies: any[] = [];
    for (const depType of registration.dependencies) {
      const dependency = await this.resolve(depType);
      resolvedDependencies.push(dependency);
    }

    // Create the service instance
    const instance = await registration.factory();

    // If it's an enhanced base manager, initialize it with dependencies
    if (this.isEnhancedBaseManager(instance)) {
      const managerDeps = this.buildManagerDependencies(
        resolvedDependencies,
        registration.dependencies
      );
      await (instance as any).initialize(managerDeps);
    }

    return instance;
  }

  /**
   * Build manager dependencies object from resolved dependencies
   */
  private buildManagerDependencies(
    resolvedDeps: any[],
    depTypes: ServiceType[]
  ): ManagerDependencies {
    const dependencies: ManagerDependencies = {};

    depTypes.forEach((depType, index) => {
      const resolvedDep = resolvedDeps[index];

      switch (depType) {
        case ServiceType.TERMINAL_COORDINATOR:
          dependencies.terminalCoordinator = resolvedDep as ITerminalCoordinator;
          break;
        case ServiceType.EXTENSION_COMMUNICATOR:
          dependencies.extensionCommunicator = resolvedDep as IExtensionCommunicator;
          break;
        case ServiceType.SETTINGS_COORDINATOR:
          dependencies.settingsCoordinator = resolvedDep as ISettingsCoordinator;
          break;
        case ServiceType.CLI_AGENT_COORDINATOR:
          dependencies.cliAgentCoordinator = resolvedDep as ICliAgentCoordinator;
          break;
        case ServiceType.SESSION_COORDINATOR:
          dependencies.sessionCoordinator = resolvedDep as ISessionCoordinator;
          break;
        case ServiceType.LOGGING_COORDINATOR:
          dependencies.loggingCoordinator = resolvedDep as ILoggingCoordinator;
          break;
        case ServiceType.MANAGER_PROVIDER:
          dependencies.managerProvider = resolvedDep as IManagerProvider;
          break;
        default:
          // Add to custom dependencies
          dependencies[depType] = resolvedDep;
          break;
      }
    });

    return dependencies;
  }

  /**
   * Check if an instance is an enhanced base manager
   */
  private isEnhancedBaseManager(instance: any): instance is IEnhancedBaseManager {
    return (
      instance &&
      typeof instance.initialize === 'function' &&
      typeof instance.dispose === 'function' &&
      typeof instance.getHealthStatus === 'function'
    );
  }

  /**
   * Get all resolved services of a specific type
   */
  public getResolvedServices(): Map<ServiceType, any> {
    const resolved = new Map<ServiceType, any>();

    for (const [type, registration] of this.services) {
      if (registration.instance) {
        resolved.set(type, registration.instance);
      }
    }

    return resolved;
  }

  /**
   * Check if a service is registered
   */
  public isRegistered(serviceType: ServiceType): boolean {
    return this.services.has(serviceType);
  }

  /**
   * Check if a service is resolved
   */
  public isResolved(serviceType: ServiceType): boolean {
    const registration = this.services.get(serviceType);
    return registration?.instance !== undefined;
  }

  /**
   * Get service health status
   */
  public getServiceHealth(): Map<ServiceType, { lifecycle: ServiceLifecycle; error?: string }> {
    const health = new Map<ServiceType, { lifecycle: ServiceLifecycle; error?: string }>();

    for (const [type, registration] of this.services) {
      health.set(type, {
        lifecycle: registration.lifecycle,
        error: registration.error?.message,
      });
    }

    return health;
  }

  /**
   * Get dependency graph for debugging
   */
  public getDependencyGraph(): Map<ServiceType, ServiceType[]> {
    const graph = new Map<ServiceType, ServiceType[]>();

    for (const [type, registration] of this.services) {
      graph.set(type, [...registration.dependencies]);
    }

    return graph;
  }

  /**
   * Validate dependency graph for circular dependencies
   */
  public validateDependencyGraph(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const visited = new Set<ServiceType>();
    const visiting = new Set<ServiceType>();

    const detectCycles = (serviceType: ServiceType): boolean => {
      if (visiting.has(serviceType)) {
        errors.push(`Circular dependency detected involving ${serviceType}`);
        return false;
      }

      if (visited.has(serviceType)) {
        return true;
      }

      visiting.add(serviceType);

      const registration = this.services.get(serviceType);
      if (registration) {
        for (const dependency of registration.dependencies) {
          if (!this.services.has(dependency)) {
            errors.push(`Missing dependency: ${serviceType} depends on unregistered ${dependency}`);
            continue;
          }

          if (!detectCycles(dependency)) {
            return false;
          }
        }
      }

      visiting.delete(serviceType);
      visited.add(serviceType);
      return true;
    };

    for (const serviceType of this.services.keys()) {
      if (!visited.has(serviceType)) {
        detectCycles(serviceType);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Dispose all services in reverse initialization order
   */
  public async dispose(): Promise<void> {
    if (this.isDisposing) {
      return;
    }

    this.isDisposing = true;
    log('🧹 [DI] Starting container disposal...');

    // Dispose in reverse initialization order
    const disposalOrder = [...this.initializationOrder].reverse();

    for (const serviceType of disposalOrder) {
      const registration = this.services.get(serviceType);
      if (registration?.instance) {
        try {
          registration.lifecycle = ServiceLifecycle.DISPOSING;

          if (this.isEnhancedBaseManager(registration.instance)) {
            registration.instance.dispose();
          }

          registration.lifecycle = ServiceLifecycle.DISPOSED;
          registration.instance = undefined;

          log(`🧹 [DI] Disposed service: ${serviceType}`);
        } catch (error) {
          log(`❌ [DI] Error disposing service ${serviceType}: ${error}`);
          registration.lifecycle = ServiceLifecycle.ERROR;
          registration.error = error as Error;
        }
      }
    }

    // Clear all registrations
    this.services.clear();
    this.initializationOrder.length = 0;
    this.disposalOrder.length = 0;

    log('✅ [DI] Container disposal completed');
  }

  /**
   * Create a scoped container for testing
   */
  public createScope(): DependencyContainer {
    const scope = new DependencyContainer();

    // Copy registrations but not instances
    for (const [type, registration] of this.services) {
      scope.register(type, registration.factory, [...registration.dependencies]);
    }

    return scope;
  }

  /**
   * Get container statistics
   */
  public getStatistics(): {
    totalServices: number;
    registeredServices: number;
    initializedServices: number;
    errorServices: number;
    memoryUsage: number;
  } {
    let initialized = 0;
    let errors = 0;

    for (const registration of this.services.values()) {
      if (registration.instance) {
        initialized++;
      }
      if (registration.error) {
        errors++;
      }
    }

    return {
      totalServices: this.services.size,
      registeredServices: this.services.size,
      initializedServices: initialized,
      errorServices: errors,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Estimate memory usage of the container
   */
  private estimateMemoryUsage(): number {
    // Rough estimation using named constants
    return (
      this.services.size * DEPENDENCY_CONTAINER_CONSTANTS.SERVICE_MEMORY_OVERHEAD_BYTES +
      this.initializationOrder.length * DEPENDENCY_CONTAINER_CONSTANTS.ORDER_TRACKING_OVERHEAD_BYTES +
      this.getResolvedServices().size * DEPENDENCY_CONTAINER_CONSTANTS.INSTANCE_OVERHEAD_BYTES
    );
  }
}
