/**
 * ManagerRegistry Unit Tests
 *
 * Tests for unified lifecycle management including:
 * - Manager registration (eager and lazy)
 * - Dependency-ordered initialization
 * - LIFO disposal pattern
 * - Type-safe manager retrieval
 * - Priority-based ordering
 * - Circular dependency detection
 */

import { describe, it, expect } from 'vitest';
import {
  ManagerRegistry,
  IManagerLifecycle,
  _ManagerRegistrationOptions,
} from '../../../../../webview/core/ManagerRegistry';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

// Helper to create mock managers
function createMockManager(options: {
  initializeImpl?: () => void | Promise<void>;
  disposeImpl?: () => void;
} = {}): IManagerLifecycle {
  return {
    initialize: options.initializeImpl ?? vi.fn(),
    dispose: options.disposeImpl ?? vi.fn(),
  };
}

describe('ManagerRegistry', () => {
  let registry: ManagerRegistry;

  beforeEach(() => {
    registry = new ManagerRegistry();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a manager', () => {
      const manager = createMockManager();
      registry.register('test', () => manager);

      expect(registry.has('test')).toBe(true);
    });

    it('should return manager instance on registration', () => {
      const manager = createMockManager();
      const result = registry.register('test', () => manager);

      expect(result).toBe(manager);
    });

    it('should not register duplicate managers', () => {
      const manager1 = createMockManager();
      const manager2 = createMockManager();

      registry.register('test', () => manager1);
      const result = registry.register('test', () => manager2);

      expect(result).toBe(manager1);
    });

    it('should support lazy registration', () => {
      const factory = vi.fn(() => createMockManager());

      const result = registry.register('test', factory, { lazy: true });

      expect(result).toBeNull();
      expect(factory).not.toHaveBeenCalled();
    });

    it('should create lazy manager on first access', () => {
      const manager = createMockManager();
      const factory = vi.fn(() => manager);

      registry.register('test', factory, { lazy: true });
      const result = registry.get('test');

      expect(factory).toHaveBeenCalledTimes(1);
      expect(result).toBe(manager);
    });
  });

  describe('get', () => {
    it('should return registered manager', () => {
      const manager = createMockManager();
      registry.register('test', () => manager);

      expect(registry.get('test')).toBe(manager);
    });

    it('should return undefined for unregistered manager', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should return typed manager', () => {
      interface CustomManager extends IManagerLifecycle {
        customMethod(): void;
      }

      const manager: CustomManager = {
        ...createMockManager(),
        customMethod: vi.fn(),
      };

      registry.register('custom', () => manager);
      const result = registry.get<CustomManager>('custom');

      expect(result?.customMethod).toBeDefined();
    });
  });

  describe('has', () => {
    it('should return true for registered manager', () => {
      registry.register('test', () => createMockManager());

      expect(registry.has('test')).toBe(true);
    });

    it('should return false for unregistered manager', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('initializeAll', () => {
    it('should initialize all registered managers', async () => {
      const initFn1 = vi.fn();
      const initFn2 = vi.fn();

      registry.register('manager1', () =>
        createMockManager({ initializeImpl: initFn1 })
      );
      registry.register('manager2', () =>
        createMockManager({ initializeImpl: initFn2 })
      );

      await registry.initializeAll();

      expect(initFn1).toHaveBeenCalled();
      expect(initFn2).toHaveBeenCalled();
    });

    it('should initialize managers in dependency order', async () => {
      const order: string[] = [];

      registry.register(
        'dependent',
        () =>
          createMockManager({
            initializeImpl: () => {
              order.push('dependent');
            },
          }),
        { dependsOn: ['dependency'] }
      );

      registry.register('dependency', () =>
        createMockManager({
          initializeImpl: () => {
            order.push('dependency');
          },
        })
      );

      await registry.initializeAll();

      expect(order).toEqual(['dependency', 'dependent']);
    });

    it('should initialize managers by priority', async () => {
      const order: string[] = [];

      registry.register(
        'low',
        () =>
          createMockManager({
            initializeImpl: () => {
              order.push('low');
            },
          }),
        { priority: 1 }
      );

      registry.register(
        'high',
        () =>
          createMockManager({
            initializeImpl: () => {
              order.push('high');
            },
          }),
        { priority: 10 }
      );

      registry.register(
        'medium',
        () =>
          createMockManager({
            initializeImpl: () => {
              order.push('medium');
            },
          }),
        { priority: 5 }
      );

      await registry.initializeAll();

      expect(order).toEqual(['high', 'medium', 'low']);
    });

    it('should handle async initialization', async () => {
      const initFn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      registry.register('async', () =>
        createMockManager({ initializeImpl: initFn })
      );

      await registry.initializeAll();

      expect(initFn).toHaveBeenCalled();
    });

    it('should throw on circular dependency', async () => {
      registry.register('a', () => createMockManager(), { dependsOn: ['b'] });
      registry.register('b', () => createMockManager(), { dependsOn: ['a'] });

      await expect(registry.initializeAll()).rejects.toThrow(
        /Circular dependency/
      );
    });

    it('should throw when initializing after disposal', async () => {
      registry.disposeAll();

      await expect(registry.initializeAll()).rejects.toThrow(
        /Cannot initialize after disposal/
      );
    });

    it('should propagate initialization errors', async () => {
      const error = new Error('Init failed');
      registry.register('failing', () =>
        createMockManager({
          initializeImpl: () => {
            throw error;
          },
        })
      );

      await expect(registry.initializeAll()).rejects.toThrow('Init failed');
    });

    it('should handle managers without initialize method', async () => {
      const manager: IManagerLifecycle = {
        dispose: vi.fn(),
      };

      registry.register('noInit', () => manager);

      await expect(registry.initializeAll()).resolves.not.toThrow();
    });

    it('should initialize lazy managers', async () => {
      const initFn = vi.fn();

      registry.register('lazy', () => createMockManager({ initializeImpl: initFn }), {
        lazy: true,
      });

      await registry.initializeAll();

      expect(initFn).toHaveBeenCalled();
    });
  });

  describe('disposeAll', () => {
    it('should dispose all managers', () => {
      const disposeFn1 = vi.fn();
      const disposeFn2 = vi.fn();

      registry.register('manager1', () =>
        createMockManager({ disposeImpl: disposeFn1 })
      );
      registry.register('manager2', () =>
        createMockManager({ disposeImpl: disposeFn2 })
      );

      registry.disposeAll();

      expect(disposeFn1).toHaveBeenCalled();
      expect(disposeFn2).toHaveBeenCalled();
    });

    it('should dispose in reverse order (LIFO)', () => {
      const order: string[] = [];

      registry.register('first', () =>
        createMockManager({
          disposeImpl: () => {
            order.push('first');
          },
        })
      );

      registry.register('second', () =>
        createMockManager({
          disposeImpl: () => {
            order.push('second');
          },
        })
      );

      registry.register('third', () =>
        createMockManager({
          disposeImpl: () => {
            order.push('third');
          },
        })
      );

      registry.disposeAll();

      expect(order).toEqual(['third', 'second', 'first']);
    });

    it('should clear all managers after disposal', () => {
      registry.register('test', () => createMockManager());

      registry.disposeAll();

      expect(registry.has('test')).toBe(false);
    });

    it('should handle multiple dispose calls gracefully', () => {
      const disposeFn = vi.fn();
      registry.register('test', () =>
        createMockManager({ disposeImpl: disposeFn })
      );

      registry.disposeAll();
      registry.disposeAll();

      expect(disposeFn).toHaveBeenCalledTimes(1);
    });

    it('should handle disposal errors gracefully', () => {
      registry.register('failing', () =>
        createMockManager({
          disposeImpl: () => {
            throw new Error('Dispose failed');
          },
        })
      );

      expect(() => registry.disposeAll()).not.toThrow();
    });

    it('should not dispose lazy managers that were never accessed', () => {
      const disposeFn = vi.fn();
      registry.register(
        'lazy',
        () => createMockManager({ disposeImpl: disposeFn }),
        { lazy: true }
      );

      registry.disposeAll();

      expect(disposeFn).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      registry.register('eager1', () => createMockManager());
      registry.register('eager2', () => createMockManager());
      registry.register('lazy1', () => createMockManager(), { lazy: true });

      await registry.initializeAll();

      const stats = registry.getStats();

      expect(stats.total).toBe(3);
      expect(stats.initialized).toBe(3);
      expect(stats.lazy).toBe(1);
      expect(stats.names).toContain('eager1');
      expect(stats.names).toContain('eager2');
      expect(stats.names).toContain('lazy1');
    });

    it('should return empty statistics for empty registry', () => {
      const stats = registry.getStats();

      expect(stats.total).toBe(0);
      expect(stats.initialized).toBe(0);
      expect(stats.lazy).toBe(0);
      expect(stats.names).toEqual([]);
    });
  });

  describe('Complex Dependency Scenarios', () => {
    it('should handle deep dependency chains', async () => {
      const order: string[] = [];

      registry.register(
        'level3',
        () =>
          createMockManager({
            initializeImpl: () => order.push('level3'),
          }),
        { dependsOn: ['level2'] }
      );

      registry.register(
        'level2',
        () =>
          createMockManager({
            initializeImpl: () => order.push('level2'),
          }),
        { dependsOn: ['level1'] }
      );

      registry.register('level1', () =>
        createMockManager({
          initializeImpl: () => order.push('level1'),
        })
      );

      await registry.initializeAll();

      expect(order).toEqual(['level1', 'level2', 'level3']);
    });

    it('should handle multiple dependencies', async () => {
      const order: string[] = [];

      registry.register(
        'final',
        () =>
          createMockManager({
            initializeImpl: () => order.push('final'),
          }),
        { dependsOn: ['dep1', 'dep2'] }
      );

      registry.register('dep1', () =>
        createMockManager({
          initializeImpl: () => order.push('dep1'),
        })
      );

      registry.register('dep2', () =>
        createMockManager({
          initializeImpl: () => order.push('dep2'),
        })
      );

      await registry.initializeAll();

      // dep1 and dep2 should be before final
      expect(order.indexOf('final')).toBeGreaterThan(order.indexOf('dep1'));
      expect(order.indexOf('final')).toBeGreaterThan(order.indexOf('dep2'));
    });

    it('should handle diamond dependency pattern', async () => {
      const order: string[] = [];

      registry.register('base', () =>
        createMockManager({
          initializeImpl: () => order.push('base'),
        })
      );

      registry.register(
        'left',
        () =>
          createMockManager({
            initializeImpl: () => order.push('left'),
          }),
        { dependsOn: ['base'] }
      );

      registry.register(
        'right',
        () =>
          createMockManager({
            initializeImpl: () => order.push('right'),
          }),
        { dependsOn: ['base'] }
      );

      registry.register(
        'top',
        () =>
          createMockManager({
            initializeImpl: () => order.push('top'),
          }),
        { dependsOn: ['left', 'right'] }
      );

      await registry.initializeAll();

      // base should be first, top should be last
      expect(order[0]).toBe('base');
      expect(order[order.length - 1]).toBe('top');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty registry', async () => {
      await expect(registry.initializeAll()).resolves.not.toThrow();
      expect(() => registry.disposeAll()).not.toThrow();
    });

    it('should handle single manager', async () => {
      const initFn = vi.fn();
      const disposeFn = vi.fn();

      registry.register('single', () =>
        createMockManager({
          initializeImpl: initFn,
          disposeImpl: disposeFn,
        })
      );

      await registry.initializeAll();
      registry.disposeAll();

      expect(initFn).toHaveBeenCalledTimes(1);
      expect(disposeFn).toHaveBeenCalledTimes(1);
    });

    it('should handle managers registered after partial initialization', async () => {
      const initFn1 = vi.fn();

      registry.register('first', () =>
        createMockManager({ initializeImpl: initFn1 })
      );

      await registry.initializeAll();

      expect(initFn1).toHaveBeenCalled();

      // Register and initialize new manager
      const initFn2 = vi.fn();
      registry.register('second', () =>
        createMockManager({ initializeImpl: initFn2 })
      );

      await registry.initializeAll();

      expect(initFn2).toHaveBeenCalled();
    });
  });
});
