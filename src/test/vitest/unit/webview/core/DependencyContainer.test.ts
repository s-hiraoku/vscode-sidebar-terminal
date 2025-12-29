/**
 * DependencyContainer Unit Tests
 *
 * Tests for dependency injection container including:
 * - Service registration (factory and instance)
 * - Dependency resolution
 * - Lifecycle management
 * - Circular dependency detection
 * - LIFO disposal pattern
 * - Scoped containers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DependencyContainer,
  ServiceType,
  ServiceLifecycle,
} from '../../../../../webview/core/DependencyContainer';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

// Helper to create mock services
function createMockService(options: {
  initializeImpl?: (deps: any) => void | Promise<void>;
  disposeImpl?: () => void;
  getHealthStatusImpl?: () => { healthy: boolean };
} = {}): any {
  return {
    initialize: options.initializeImpl ?? vi.fn(),
    dispose: options.disposeImpl ?? vi.fn(),
    getHealthStatus: options.getHealthStatusImpl ?? vi.fn(() => ({ healthy: true })),
  };
}

// Simple mock service without IEnhancedBaseManager interface
function createSimpleService(): any {
  return {
    doSomething: vi.fn(),
  };
}

describe('DependencyContainer', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    container = new DependencyContainer();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a service with factory', () => {
      const factory = () => createMockService();

      container.register(ServiceType.UI_MANAGER, factory);

      expect(container.isRegistered(ServiceType.UI_MANAGER)).toBe(true);
    });

    it('should throw when registering duplicate service', () => {
      container.register(ServiceType.UI_MANAGER, () => createMockService());

      expect(() => {
        container.register(ServiceType.UI_MANAGER, () => createMockService());
      }).toThrow('Service ui_manager is already registered');
    });

    it('should register service with dependencies', () => {
      container.register(
        ServiceType.UI_MANAGER,
        () => createMockService(),
        [ServiceType.SETTINGS_COORDINATOR]
      );

      const graph = container.getDependencyGraph();
      expect(graph.get(ServiceType.UI_MANAGER)).toContain(ServiceType.SETTINGS_COORDINATOR);
    });
  });

  describe('registerInstance', () => {
    it('should register an existing instance', () => {
      const instance = createMockService();

      container.registerInstance(ServiceType.UI_MANAGER, instance);

      expect(container.isRegistered(ServiceType.UI_MANAGER)).toBe(true);
      expect(container.isResolved(ServiceType.UI_MANAGER)).toBe(true);
    });

    it('should immediately mark instance as initialized', async () => {
      const instance = createMockService();

      container.registerInstance(ServiceType.UI_MANAGER, instance);
      const resolved = await container.resolve(ServiceType.UI_MANAGER);

      expect(resolved).toBe(instance);
    });
  });

  describe('resolve', () => {
    it('should resolve a registered service', async () => {
      const mockService = createMockService();
      container.register(ServiceType.UI_MANAGER, () => mockService);

      const resolved = await container.resolve(ServiceType.UI_MANAGER);

      expect(resolved).toBe(mockService);
    });

    it('should return same instance on multiple resolves', async () => {
      const mockService = createMockService();
      container.register(ServiceType.UI_MANAGER, () => mockService);

      const resolved1 = await container.resolve(ServiceType.UI_MANAGER);
      const resolved2 = await container.resolve(ServiceType.UI_MANAGER);

      expect(resolved1).toBe(resolved2);
    });

    it('should throw for unregistered service', async () => {
      await expect(container.resolve(ServiceType.UI_MANAGER)).rejects.toThrow(
        'Service ui_manager is not registered'
      );
    });

    it('should resolve dependencies before service', async () => {
      const order: string[] = [];

      container.register(ServiceType.SETTINGS_COORDINATOR, () => {
        order.push('settings');
        return createSimpleService();
      });

      container.register(
        ServiceType.UI_MANAGER,
        () => {
          order.push('ui');
          return createSimpleService();
        },
        [ServiceType.SETTINGS_COORDINATOR]
      );

      await container.resolve(ServiceType.UI_MANAGER);

      expect(order).toEqual(['settings', 'ui']);
    });

    it('should handle async factory functions', async () => {
      const asyncService = createMockService();
      container.register(ServiceType.UI_MANAGER, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return asyncService;
      });

      const resolved = await container.resolve(ServiceType.UI_MANAGER);

      expect(resolved).toBe(asyncService);
    });

    it('should throw when resolving during disposal', async () => {
      container.register(ServiceType.UI_MANAGER, () => createMockService());
      await container.resolve(ServiceType.UI_MANAGER);

      // Start disposal
      const disposePromise = container.dispose();

      await disposePromise;

      await expect(container.resolve(ServiceType.UI_MANAGER)).rejects.toThrow(
        'Container is disposing, cannot resolve services'
      );
    });

    it('should handle concurrent resolution of same service', async () => {
      let callCount = 0;
      container.register(ServiceType.UI_MANAGER, async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return createMockService();
      });

      // Resolve concurrently
      const [result1, result2, result3] = await Promise.all([
        container.resolve(ServiceType.UI_MANAGER),
        container.resolve(ServiceType.UI_MANAGER),
        container.resolve(ServiceType.UI_MANAGER),
      ]);

      // Factory should only be called once
      expect(callCount).toBe(1);
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered service', () => {
      container.register(ServiceType.UI_MANAGER, () => createMockService());

      expect(container.isRegistered(ServiceType.UI_MANAGER)).toBe(true);
    });

    it('should return false for unregistered service', () => {
      expect(container.isRegistered(ServiceType.UI_MANAGER)).toBe(false);
    });
  });

  describe('isResolved', () => {
    it('should return true for resolved service', async () => {
      container.register(ServiceType.UI_MANAGER, () => createMockService());
      await container.resolve(ServiceType.UI_MANAGER);

      expect(container.isResolved(ServiceType.UI_MANAGER)).toBe(true);
    });

    it('should return false for registered but not resolved service', () => {
      container.register(ServiceType.UI_MANAGER, () => createMockService());

      expect(container.isResolved(ServiceType.UI_MANAGER)).toBe(false);
    });

    it('should return false for unregistered service', () => {
      expect(container.isResolved(ServiceType.UI_MANAGER)).toBe(false);
    });
  });

  describe('getResolvedServices', () => {
    it('should return all resolved services', async () => {
      container.register(ServiceType.UI_MANAGER, () => createMockService());
      container.register(ServiceType.INPUT_MANAGER, () => createMockService());

      await container.resolve(ServiceType.UI_MANAGER);

      const resolved = container.getResolvedServices();

      expect(resolved.size).toBe(1);
      expect(resolved.has(ServiceType.UI_MANAGER)).toBe(true);
      expect(resolved.has(ServiceType.INPUT_MANAGER)).toBe(false);
    });

    it('should return empty map when no services resolved', () => {
      container.register(ServiceType.UI_MANAGER, () => createMockService());

      const resolved = container.getResolvedServices();

      expect(resolved.size).toBe(0);
    });
  });

  describe('getServiceHealth', () => {
    it('should return health status for all registered services', async () => {
      container.register(ServiceType.UI_MANAGER, () => createMockService());
      container.register(ServiceType.INPUT_MANAGER, () => createMockService());

      await container.resolve(ServiceType.UI_MANAGER);

      const health = container.getServiceHealth();

      expect(health.get(ServiceType.UI_MANAGER)?.lifecycle).toBe(ServiceLifecycle.INITIALIZED);
      expect(health.get(ServiceType.INPUT_MANAGER)?.lifecycle).toBe(ServiceLifecycle.REGISTERED);
    });

    it('should include error message for failed services', async () => {
      const error = new Error('Initialization failed');
      container.register(ServiceType.UI_MANAGER, () => {
        throw error;
      });

      try {
        await container.resolve(ServiceType.UI_MANAGER);
      } catch {
        // Expected to fail
      }

      const health = container.getServiceHealth();

      expect(health.get(ServiceType.UI_MANAGER)?.lifecycle).toBe(ServiceLifecycle.ERROR);
      expect(health.get(ServiceType.UI_MANAGER)?.error).toBe('Initialization failed');
    });
  });

  describe('getDependencyGraph', () => {
    it('should return complete dependency graph', () => {
      container.register(ServiceType.SETTINGS_COORDINATOR, () => createSimpleService());
      container.register(
        ServiceType.UI_MANAGER,
        () => createSimpleService(),
        [ServiceType.SETTINGS_COORDINATOR]
      );
      container.register(
        ServiceType.INPUT_MANAGER,
        () => createSimpleService(),
        [ServiceType.UI_MANAGER, ServiceType.SETTINGS_COORDINATOR]
      );

      const graph = container.getDependencyGraph();

      expect(graph.get(ServiceType.SETTINGS_COORDINATOR)).toEqual([]);
      expect(graph.get(ServiceType.UI_MANAGER)).toEqual([ServiceType.SETTINGS_COORDINATOR]);
      expect(graph.get(ServiceType.INPUT_MANAGER)).toContain(ServiceType.UI_MANAGER);
      expect(graph.get(ServiceType.INPUT_MANAGER)).toContain(ServiceType.SETTINGS_COORDINATOR);
    });
  });

  describe('validateDependencyGraph', () => {
    it('should validate correct dependency graph', () => {
      container.register(ServiceType.SETTINGS_COORDINATOR, () => createSimpleService());
      container.register(
        ServiceType.UI_MANAGER,
        () => createSimpleService(),
        [ServiceType.SETTINGS_COORDINATOR]
      );

      const result = container.validateDependencyGraph();

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect circular dependencies', () => {
      container.register(
        ServiceType.UI_MANAGER,
        () => createSimpleService(),
        [ServiceType.INPUT_MANAGER]
      );
      container.register(
        ServiceType.INPUT_MANAGER,
        () => createSimpleService(),
        [ServiceType.UI_MANAGER]
      );

      const result = container.validateDependencyGraph();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Circular dependency'))).toBe(true);
    });

    it('should detect missing dependencies', () => {
      container.register(
        ServiceType.UI_MANAGER,
        () => createSimpleService(),
        [ServiceType.SETTINGS_COORDINATOR]
      );
      // Note: SETTINGS_COORDINATOR is not registered

      const result = container.validateDependencyGraph();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Missing dependency'))).toBe(true);
    });

    it('should detect complex circular chains', () => {
      container.register(
        ServiceType.UI_MANAGER,
        () => createSimpleService(),
        [ServiceType.INPUT_MANAGER]
      );
      container.register(
        ServiceType.INPUT_MANAGER,
        () => createSimpleService(),
        [ServiceType.CONFIG_MANAGER]
      );
      container.register(
        ServiceType.CONFIG_MANAGER,
        () => createSimpleService(),
        [ServiceType.UI_MANAGER]
      );

      const result = container.validateDependencyGraph();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Circular dependency'))).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should dispose all resolved services', async () => {
      const disposeFn1 = vi.fn();
      const disposeFn2 = vi.fn();

      container.register(ServiceType.UI_MANAGER, () =>
        createMockService({ disposeImpl: disposeFn1 })
      );
      container.register(ServiceType.INPUT_MANAGER, () =>
        createMockService({ disposeImpl: disposeFn2 })
      );

      await container.resolve(ServiceType.UI_MANAGER);
      await container.resolve(ServiceType.INPUT_MANAGER);
      await container.dispose();

      expect(disposeFn1).toHaveBeenCalled();
      expect(disposeFn2).toHaveBeenCalled();
    });

    it('should dispose in reverse initialization order (LIFO)', async () => {
      const order: string[] = [];

      container.register(ServiceType.SETTINGS_COORDINATOR, () =>
        createMockService({
          disposeImpl: () => order.push('settings'),
        })
      );

      container.register(ServiceType.UI_MANAGER, () =>
        createMockService({
          disposeImpl: () => order.push('ui'),
        })
      );

      container.register(ServiceType.INPUT_MANAGER, () =>
        createMockService({
          disposeImpl: () => order.push('input'),
        })
      );

      // Resolve in order: settings, ui, input
      await container.resolve(ServiceType.SETTINGS_COORDINATOR);
      await container.resolve(ServiceType.UI_MANAGER);
      await container.resolve(ServiceType.INPUT_MANAGER);

      await container.dispose();

      // Should dispose in reverse order: input, ui, settings
      expect(order).toEqual(['input', 'ui', 'settings']);
    });

    it('should clear all registrations after disposal', async () => {
      container.register(ServiceType.UI_MANAGER, () => createMockService());
      await container.resolve(ServiceType.UI_MANAGER);

      await container.dispose();

      expect(container.isRegistered(ServiceType.UI_MANAGER)).toBe(false);
    });

    it('should handle multiple dispose calls gracefully', async () => {
      const disposeFn = vi.fn();
      container.register(ServiceType.UI_MANAGER, () =>
        createMockService({ disposeImpl: disposeFn })
      );
      await container.resolve(ServiceType.UI_MANAGER);

      await container.dispose();
      await container.dispose();

      // First dispose clears services, second does nothing
      expect(disposeFn).toHaveBeenCalledTimes(1);
    });

    it('should handle disposal errors gracefully', async () => {
      container.register(ServiceType.UI_MANAGER, () =>
        createMockService({
          disposeImpl: () => {
            throw new Error('Dispose failed');
          },
        })
      );

      await container.resolve(ServiceType.UI_MANAGER);

      // Should not throw
      await expect(container.dispose()).resolves.not.toThrow();
    });

    it('should not dispose services without IEnhancedBaseManager interface', async () => {
      const simpleService = createSimpleService();
      container.register(ServiceType.UI_MANAGER, () => simpleService);

      await container.resolve(ServiceType.UI_MANAGER);

      // Should not throw even without dispose method
      await expect(container.dispose()).resolves.not.toThrow();
    });
  });

  describe('createScope', () => {
    it('should create a new container with copied registrations', () => {
      container.register(ServiceType.UI_MANAGER, () => createMockService());
      container.register(ServiceType.INPUT_MANAGER, () => createMockService());

      const scope = container.createScope();

      expect(scope.isRegistered(ServiceType.UI_MANAGER)).toBe(true);
      expect(scope.isRegistered(ServiceType.INPUT_MANAGER)).toBe(true);
    });

    it('should not share instances with parent container', async () => {
      container.register(ServiceType.UI_MANAGER, () => createMockService());

      const scope = container.createScope();

      const parentInstance = await container.resolve(ServiceType.UI_MANAGER);
      const scopeInstance = await scope.resolve(ServiceType.UI_MANAGER);

      expect(parentInstance).not.toBe(scopeInstance);
    });

    it('should copy dependencies', () => {
      container.register(ServiceType.SETTINGS_COORDINATOR, () => createSimpleService());
      container.register(
        ServiceType.UI_MANAGER,
        () => createSimpleService(),
        [ServiceType.SETTINGS_COORDINATOR]
      );

      const scope = container.createScope();
      const graph = scope.getDependencyGraph();

      expect(graph.get(ServiceType.UI_MANAGER)).toEqual([ServiceType.SETTINGS_COORDINATOR]);
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', async () => {
      container.register(ServiceType.UI_MANAGER, () => createMockService());
      container.register(ServiceType.INPUT_MANAGER, () => createMockService());
      container.register(ServiceType.CONFIG_MANAGER, () => {
        throw new Error('Failed');
      });

      await container.resolve(ServiceType.UI_MANAGER);
      try {
        await container.resolve(ServiceType.CONFIG_MANAGER);
      } catch {
        // Expected
      }

      const stats = container.getStatistics();

      expect(stats.totalServices).toBe(3);
      expect(stats.registeredServices).toBe(3);
      expect(stats.initializedServices).toBe(1);
      expect(stats.errorServices).toBe(1);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should return empty statistics for empty container', () => {
      const stats = container.getStatistics();

      expect(stats.totalServices).toBe(0);
      expect(stats.registeredServices).toBe(0);
      expect(stats.initializedServices).toBe(0);
      expect(stats.errorServices).toBe(0);
    });
  });

  describe('IEnhancedBaseManager initialization', () => {
    it('should call initialize on enhanced managers', async () => {
      const initializeFn = vi.fn();
      const mockManager = createMockService({ initializeImpl: initializeFn });

      container.register(ServiceType.UI_MANAGER, () => mockManager);
      await container.resolve(ServiceType.UI_MANAGER);

      expect(initializeFn).toHaveBeenCalled();
    });

    it('should pass resolved dependencies to initialize', async () => {
      let passedDeps: any = null;
      const mockManager = {
        initialize: vi.fn((deps) => {
          passedDeps = deps;
        }),
        dispose: vi.fn(),
        getHealthStatus: vi.fn(() => ({ healthy: true })),
      };

      const settingsService = createSimpleService();
      container.register(ServiceType.SETTINGS_COORDINATOR, () => settingsService);
      container.register(
        ServiceType.UI_MANAGER,
        () => mockManager,
        [ServiceType.SETTINGS_COORDINATOR]
      );

      await container.resolve(ServiceType.UI_MANAGER);

      expect(passedDeps).toBeDefined();
      expect(passedDeps.settingsCoordinator).toBe(settingsService);
    });
  });

  describe('Error handling', () => {
    it('should track error state on initialization failure', async () => {
      const error = new Error('Init failed');
      container.register(ServiceType.UI_MANAGER, () => {
        throw error;
      });

      try {
        await container.resolve(ServiceType.UI_MANAGER);
      } catch {
        // Expected
      }

      const health = container.getServiceHealth();
      expect(health.get(ServiceType.UI_MANAGER)?.lifecycle).toBe(ServiceLifecycle.ERROR);
    });

    it('should propagate errors from factory', async () => {
      container.register(ServiceType.UI_MANAGER, () => {
        throw new Error('Factory error');
      });

      await expect(container.resolve(ServiceType.UI_MANAGER)).rejects.toThrow('Factory error');
    });

    it('should propagate errors from async factory', async () => {
      container.register(ServiceType.UI_MANAGER, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('Async factory error');
      });

      await expect(container.resolve(ServiceType.UI_MANAGER)).rejects.toThrow(
        'Async factory error'
      );
    });
  });
});
