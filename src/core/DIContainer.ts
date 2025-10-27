/**
 * Lightweight Dependency Injection Container
 *
 * Provides service registration, resolution, and lifecycle management without
 * external dependencies. Supports singleton, transient, and scoped lifetimes.
 *
 * @example
 * ```typescript
 * const container = new DIContainer();
 * container.register(IMyService, () => new MyService(), ServiceLifetime.Singleton);
 * const service = container.resolve(IMyService);
 * ```
 */

import * as vscode from 'vscode';

/**
 * Service lifetime options
 */
export enum ServiceLifetime {
  /** Single instance per container */
  Singleton,
  /** New instance per resolve */
  Transient,
  /** Single instance per scope */
  Scoped,
}

/**
 * Service token for type-safe registration and resolution
 */
export class ServiceToken<T> {
  constructor(public readonly id: string) {}
}

/**
 * Factory function for creating service instances
 */
export type Factory<T> = (container: DIContainer) => T;

/**
 * Service registration metadata
 */
interface ServiceRegistration<T> {
  factory: Factory<T>;
  lifetime: ServiceLifetime;
  instance?: T;
}

/**
 * Error thrown when circular dependencies are detected
 */
export class CircularDependencyError extends Error {
  constructor(public readonly dependencyChain: string[]) {
    super(`Circular dependency detected: ${dependencyChain.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

/**
 * Error thrown when a service is not registered
 */
export class ServiceNotRegisteredError extends Error {
  constructor(public readonly serviceId: string) {
    super(`Service not registered: ${serviceId}`);
    this.name = 'ServiceNotRegisteredError';
  }
}

/**
 * Lightweight Dependency Injection Container
 */
export class DIContainer implements vscode.Disposable {
  private readonly _services = new Map<string, ServiceRegistration<unknown>>();
  private readonly _singletons = new Map<string, unknown>();
  private readonly _resolutionStack: string[] = [];
  private readonly _scopes: DIContainer[] = [];
  private readonly _parentContainer?: DIContainer;
  private _isDisposed = false;

  constructor(parentContainer?: DIContainer) {
    this._parentContainer = parentContainer;
  }

  /**
   * Register a service with the container
   *
   * @param token Service token for type-safe resolution
   * @param factory Factory function to create service instances
   * @param lifetime Service lifetime (Singleton, Transient, or Scoped)
   *
   * @example
   * ```typescript
   * container.register(ILogger, () => new ConsoleLogger(), ServiceLifetime.Singleton);
   * ```
   */
  register<T>(
    token: ServiceToken<T>,
    factory: Factory<T>,
    lifetime: ServiceLifetime = ServiceLifetime.Singleton
  ): void {
    this._ensureNotDisposed();

    if (this._services.has(token.id)) {
      throw new Error(`Service already registered: ${token.id}`);
    }

    this._services.set(token.id, { factory, lifetime } as ServiceRegistration<unknown>);
  }

  /**
   * Resolve a service from the container
   *
   * @param token Service token to resolve
   * @returns Service instance
   * @throws {ServiceNotRegisteredError} If service is not registered
   * @throws {CircularDependencyError} If circular dependency is detected
   *
   * @example
   * ```typescript
   * const logger = container.resolve(ILogger);
   * ```
   */
  resolve<T>(token: ServiceToken<T>): T {
    this._ensureNotDisposed();

    // Check if already in resolution stack (circular dependency)
    if (this._resolutionStack.includes(token.id)) {
      throw new CircularDependencyError([...this._resolutionStack, token.id]);
    }

    // Try to resolve from current container
    const registration = this._services.get(token.id) as ServiceRegistration<T> | undefined;

    // If not found in current container, try parent container
    if (!registration && this._parentContainer) {
      return this._parentContainer.resolve(token);
    }

    if (!registration) {
      throw new ServiceNotRegisteredError(token.id);
    }

    // Handle different lifetimes
    switch (registration.lifetime) {
      case ServiceLifetime.Singleton:
        return this._resolveSingleton(token.id, registration);

      case ServiceLifetime.Transient:
        return this._resolveTransient(token.id, registration);

      case ServiceLifetime.Scoped:
        return this._resolveScoped(token.id, registration);

      default:
        throw new Error(`Unknown service lifetime: ${registration.lifetime}`);
    }
  }

  /**
   * Try to resolve a service, returning undefined if not registered
   *
   * @param token Service token to resolve
   * @returns Service instance or undefined
   */
  tryResolve<T>(token: ServiceToken<T>): T | undefined {
    try {
      return this.resolve(token);
    } catch (error) {
      if (error instanceof ServiceNotRegisteredError) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Check if a service is registered
   *
   * @param token Service token to check
   * @returns True if service is registered
   */
  isRegistered<T>(token: ServiceToken<T>): boolean {
    if (this._services.has(token.id)) {
      return true;
    }
    if (this._parentContainer) {
      return this._parentContainer.isRegistered(token);
    }
    return false;
  }

  /**
   * Create a scoped container for scoped service lifetimes
   *
   * @returns New scoped container
   *
   * @example
   * ```typescript
   * const scope = container.createScope();
   * const scopedService = scope.resolve(IScopedService);
   * scope.dispose(); // Cleanup scoped instances
   * ```
   */
  createScope(): DIContainer {
    this._ensureNotDisposed();
    const scope = new DIContainer(this);
    this._scopes.push(scope);
    return scope;
  }

  /**
   * Dispose the container and cleanup all singletons
   * Singletons are disposed in reverse registration order
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }

    // Dispose all scopes first
    for (const scope of this._scopes) {
      scope.dispose();
    }
    this._scopes.length = 0;

    // Dispose all singletons in reverse order
    const singletons = Array.from(this._singletons.entries()).reverse();
    for (const [, instance] of singletons) {
      if (instance && typeof (instance as vscode.Disposable).dispose === 'function') {
        try {
          (instance as vscode.Disposable).dispose();
        } catch (error) {
          console.error('Error disposing singleton:', error);
        }
      }
    }

    this._singletons.clear();
    this._services.clear();
    this._isDisposed = true;
  }

  /**
   * Get the number of registered services
   */
  get serviceCount(): number {
    return this._services.size;
  }

  /**
   * Get all registered service tokens
   */
  getRegisteredTokens(): string[] {
    return Array.from(this._services.keys());
  }

  private _resolveSingleton<T>(id: string, registration: ServiceRegistration<T>): T {
    // Check if singleton already exists
    let instance = this._singletons.get(id) as T | undefined;

    if (!instance) {
      // Create singleton instance
      this._resolutionStack.push(id);
      try {
        instance = registration.factory(this);
        this._singletons.set(id, instance);
      } finally {
        this._resolutionStack.pop();
      }
    }

    return instance;
  }

  private _resolveTransient<T>(id: string, registration: ServiceRegistration<T>): T {
    // Always create new instance
    this._resolutionStack.push(id);
    try {
      return registration.factory(this);
    } finally {
      this._resolutionStack.pop();
    }
  }

  private _resolveScoped<T>(id: string, registration: ServiceRegistration<T>): T {
    // Scoped services are singletons within a scope
    // If this is a root container, treat as singleton
    if (!this._parentContainer) {
      return this._resolveSingleton(id, registration);
    }

    // For scoped containers, create instance if not exists
    let instance = this._singletons.get(id) as T | undefined;

    if (!instance) {
      this._resolutionStack.push(id);
      try {
        instance = registration.factory(this);
        this._singletons.set(id, instance);
      } finally {
        this._resolutionStack.pop();
      }
    }

    return instance;
  }

  private _ensureNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error('Cannot use disposed DIContainer');
    }
  }
}

/**
 * Create a strongly-typed service token
 *
 * @param id Unique identifier for the service
 * @returns Service token
 *
 * @example
 * ```typescript
 * const ILogger = createServiceToken<ILogger>('ILogger');
 * container.register(ILogger, () => new ConsoleLogger(), ServiceLifetime.Singleton);
 * ```
 */
export function createServiceToken<T>(id: string): ServiceToken<T> {
  return new ServiceToken<T>(id);
}
