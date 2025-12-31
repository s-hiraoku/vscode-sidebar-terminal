/**
 * BaseCoordinator Unit Tests
 *
 * Tests for the abstract BaseCoordinator class and its utility classes:
 * - ResourceTracker
 * - TimeoutManager
 * - StateTracker
 * - createCleanupGuard
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ResourceTracker,
  TimeoutManager,
  StateTracker,
  BaseCoordinator,
  createCleanupGuard,
} from '../../../../terminals/BaseCoordinator';

// Mock vscode module
vi.mock('vscode', () => ({
  default: {},
}));

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

describe('BaseCoordinator Utilities', () => {
  describe('ResourceTracker', () => {
    let tracker: ResourceTracker<{ dispose: () => void }>;
    let disposeFn: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      tracker = new ResourceTracker();
      disposeFn = vi.fn();
    });

    describe('track', () => {
      it('should track a disposable resource', () => {
        const resource = { dispose: disposeFn };
        tracker.track('resource-1', resource);

        expect(tracker.has('resource-1')).toBe(true);
        expect(tracker.size).toBe(1);
      });

      it('should replace existing resource with same id', () => {
        const resource1 = { dispose: vi.fn() };
        const resource2 = { dispose: vi.fn() };

        tracker.track('resource-1', resource1);
        tracker.track('resource-1', resource2);

        expect(tracker.size).toBe(1);
        expect(resource1.dispose).toHaveBeenCalled();
        expect(tracker.get('resource-1')).toBe(resource2);
      });

      it('should track multiple resources', () => {
        tracker.track('r1', { dispose: vi.fn() });
        tracker.track('r2', { dispose: vi.fn() });
        tracker.track('r3', { dispose: vi.fn() });

        expect(tracker.size).toBe(3);
      });
    });

    describe('untrack', () => {
      it('should untrack and dispose a resource', () => {
        const resource = { dispose: disposeFn };
        tracker.track('resource-1', resource);

        const result = tracker.untrack('resource-1');

        expect(result).toBe(true);
        expect(disposeFn).toHaveBeenCalled();
        expect(tracker.has('resource-1')).toBe(false);
      });

      it('should return false for non-existent resource', () => {
        const result = tracker.untrack('non-existent');
        expect(result).toBe(false);
      });
    });

    describe('has', () => {
      it('should return true for tracked resource', () => {
        tracker.track('resource-1', { dispose: vi.fn() });
        expect(tracker.has('resource-1')).toBe(true);
      });

      it('should return false for untracked resource', () => {
        expect(tracker.has('non-existent')).toBe(false);
      });
    });

    describe('get', () => {
      it('should return tracked resource', () => {
        const resource = { dispose: vi.fn() };
        tracker.track('resource-1', resource);
        expect(tracker.get('resource-1')).toBe(resource);
      });

      it('should return undefined for non-existent resource', () => {
        expect(tracker.get('non-existent')).toBeUndefined();
      });
    });

    describe('keys', () => {
      it('should return all tracked resource ids', () => {
        tracker.track('r1', { dispose: vi.fn() });
        tracker.track('r2', { dispose: vi.fn() });
        tracker.track('r3', { dispose: vi.fn() });

        const keys = tracker.keys();
        expect(keys).toContain('r1');
        expect(keys).toContain('r2');
        expect(keys).toContain('r3');
        expect(keys.length).toBe(3);
      });

      it('should return empty array when no resources tracked', () => {
        expect(tracker.keys()).toEqual([]);
      });
    });

    describe('disposeAll', () => {
      it('should dispose all tracked resources', () => {
        const dispose1 = vi.fn();
        const dispose2 = vi.fn();
        const dispose3 = vi.fn();

        tracker.track('r1', { dispose: dispose1 });
        tracker.track('r2', { dispose: dispose2 });
        tracker.track('r3', { dispose: dispose3 });

        tracker.disposeAll();

        expect(dispose1).toHaveBeenCalled();
        expect(dispose2).toHaveBeenCalled();
        expect(dispose3).toHaveBeenCalled();
        expect(tracker.size).toBe(0);
      });

      it('should handle dispose errors gracefully', () => {
        tracker.track('r1', {
          dispose: () => {
            throw new Error('Dispose error');
          },
        });
        tracker.track('r2', { dispose: vi.fn() });

        expect(() => tracker.disposeAll()).not.toThrow();
        expect(tracker.size).toBe(0);
      });
    });

    describe('function resources', () => {
      it('should handle function resources', () => {
        const funcTracker = new ResourceTracker<() => void>();
        const cleanupFn = vi.fn();

        funcTracker.track('cleanup-1', cleanupFn);
        funcTracker.untrack('cleanup-1');

        expect(cleanupFn).toHaveBeenCalled();
      });
    });
  });

  describe('TimeoutManager', () => {
    let manager: TimeoutManager;

    beforeEach(() => {
      vi.useFakeTimers();
      manager = new TimeoutManager();
    });

    afterEach(() => {
      manager.clearAll();
      vi.useRealTimers();
    });

    describe('set', () => {
      it('should set a timeout', () => {
        const callback = vi.fn();
        manager.set('timeout-1', callback, 100);

        expect(manager.has('timeout-1')).toBe(true);
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(callback).toHaveBeenCalled();
      });

      it('should replace existing timeout with same id', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        manager.set('timeout-1', callback1, 100);
        manager.set('timeout-1', callback2, 200);

        vi.advanceTimersByTime(100);
        expect(callback1).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(callback2).toHaveBeenCalled();
      });

      it('should remove timeout after execution', () => {
        const callback = vi.fn();
        manager.set('timeout-1', callback, 100);

        vi.advanceTimersByTime(100);

        expect(manager.has('timeout-1')).toBe(false);
      });
    });

    describe('clear', () => {
      it('should clear a specific timeout', () => {
        const callback = vi.fn();
        manager.set('timeout-1', callback, 100);

        const result = manager.clear('timeout-1');

        expect(result).toBe(true);
        expect(manager.has('timeout-1')).toBe(false);

        vi.advanceTimersByTime(100);
        expect(callback).not.toHaveBeenCalled();
      });

      it('should return false for non-existent timeout', () => {
        const result = manager.clear('non-existent');
        expect(result).toBe(false);
      });
    });

    describe('has', () => {
      it('should return true for pending timeout', () => {
        manager.set('timeout-1', vi.fn(), 100);
        expect(manager.has('timeout-1')).toBe(true);
      });

      it('should return false for non-existent timeout', () => {
        expect(manager.has('non-existent')).toBe(false);
      });
    });

    describe('clearAll', () => {
      it('should clear all timeouts', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        manager.set('timeout-1', callback1, 100);
        manager.set('timeout-2', callback2, 200);

        manager.clearAll();

        expect(manager.size).toBe(0);

        vi.advanceTimersByTime(200);
        expect(callback1).not.toHaveBeenCalled();
        expect(callback2).not.toHaveBeenCalled();
      });
    });

    describe('size', () => {
      it('should return number of pending timeouts', () => {
        manager.set('t1', vi.fn(), 100);
        manager.set('t2', vi.fn(), 200);
        manager.set('t3', vi.fn(), 300);

        expect(manager.size).toBe(3);
      });
    });
  });

  describe('StateTracker', () => {
    let tracker: StateTracker;

    beforeEach(() => {
      tracker = new StateTracker();
    });

    describe('add', () => {
      it('should add a state', () => {
        tracker.add('state-1');
        expect(tracker.has('state-1')).toBe(true);
      });

      it('should handle duplicate adds', () => {
        tracker.add('state-1');
        tracker.add('state-1');
        expect(tracker.size).toBe(1);
      });
    });

    describe('remove', () => {
      it('should remove a state', () => {
        tracker.add('state-1');
        const result = tracker.remove('state-1');

        expect(result).toBe(true);
        expect(tracker.has('state-1')).toBe(false);
      });

      it('should return false for non-existent state', () => {
        const result = tracker.remove('non-existent');
        expect(result).toBe(false);
      });
    });

    describe('has', () => {
      it('should return true for existing state', () => {
        tracker.add('state-1');
        expect(tracker.has('state-1')).toBe(true);
      });

      it('should return false for non-existent state', () => {
        expect(tracker.has('non-existent')).toBe(false);
      });
    });

    describe('clear', () => {
      it('should clear all states', () => {
        tracker.add('s1');
        tracker.add('s2');
        tracker.add('s3');

        tracker.clear();

        expect(tracker.size).toBe(0);
      });
    });

    describe('values', () => {
      it('should return all state ids', () => {
        tracker.add('s1');
        tracker.add('s2');
        tracker.add('s3');

        const values = tracker.values();
        expect(values).toContain('s1');
        expect(values).toContain('s2');
        expect(values).toContain('s3');
        expect(values.length).toBe(3);
      });
    });

    describe('size', () => {
      it('should return number of states', () => {
        tracker.add('s1');
        tracker.add('s2');
        expect(tracker.size).toBe(2);
      });
    });
  });

  describe('createCleanupGuard', () => {
    it('should execute cleanup on dispose', () => {
      const cleanup = vi.fn();
      const guard = createCleanupGuard(cleanup);

      guard.dispose();

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should only execute cleanup once', () => {
      const cleanup = vi.fn();
      const guard = createCleanupGuard(cleanup);

      guard.dispose();
      guard.dispose();
      guard.dispose();

      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('BaseCoordinator (concrete implementation)', () => {
    // Create a concrete implementation for testing
    class TestCoordinator extends BaseCoordinator {
      public disposeResourcesCalled = false;

      constructor(name: string = 'TestCoordinator', debug: boolean = false) {
        super(name, debug);
      }

      protected disposeResources(): void {
        this.disposeResourcesCalled = true;
      }

      // Expose protected methods for testing
      public testLog(...args: unknown[]): void {
        this.log(...args);
      }

      public testDebugLog(...args: unknown[]): void {
        this.debugLog(...args);
      }

      public testWarn(...args: unknown[]): void {
        this.warn(...args);
      }

      public testError(...args: unknown[]): void {
        this.error(...args);
      }

      public testSafeExecute<T>(
        operation: () => T,
        operationName: string,
        fallback?: T
      ): T | undefined {
        return this.safeExecute(operation, operationName, fallback);
      }

      public testSafeExecuteAsync<T>(
        operation: () => Promise<T>,
        operationName: string,
        fallback?: T
      ): Promise<T | undefined> {
        return this.safeExecuteAsync(operation, operationName, fallback);
      }

      public testCheckDisposed(): void {
        this.checkDisposed();
      }

      public getDisposables(): ResourceTracker<any> {
        return this.disposables;
      }

      public getTimeouts(): TimeoutManager {
        return this.timeouts;
      }

      public getIsDisposed(): boolean {
        return this.isDisposed;
      }
    }

    let coordinator: TestCoordinator;

    beforeEach(() => {
      vi.useFakeTimers();
      coordinator = new TestCoordinator();
    });

    afterEach(() => {
      coordinator.dispose();
      vi.useRealTimers();
    });

    describe('Initialization', () => {
      it('should initialize with name', () => {
        const namedCoordinator = new TestCoordinator('MyCoordinator');
        expect(namedCoordinator).toBeDefined();
        namedCoordinator.dispose();
      });

      it('should initialize with debug mode', () => {
        const debugCoordinator = new TestCoordinator('DebugCoord', true);
        expect(debugCoordinator).toBeDefined();
        debugCoordinator.dispose();
      });

      it('should start not disposed', () => {
        expect(coordinator.getIsDisposed()).toBe(false);
      });
    });

    describe('Logging', () => {
      it('should log messages', () => {
        expect(() => coordinator.testLog('test message')).not.toThrow();
      });

      it('should log debug messages when debug enabled', () => {
        const debugCoord = new TestCoordinator('Debug', true);
        expect(() => debugCoord.testDebugLog('debug message')).not.toThrow();
        debugCoord.dispose();
      });

      it('should not log debug messages when debug disabled', () => {
        expect(() => coordinator.testDebugLog('debug message')).not.toThrow();
      });

      it('should log warnings', () => {
        expect(() => coordinator.testWarn('warning message')).not.toThrow();
      });

      it('should log errors', () => {
        expect(() => coordinator.testError('error message')).not.toThrow();
      });
    });

    describe('Safe Execution', () => {
      it('should execute operation successfully', () => {
        const result = coordinator.testSafeExecute(() => 42, 'test-op');
        expect(result).toBe(42);
      });

      it('should return fallback on error', () => {
        const result = coordinator.testSafeExecute(
          () => {
            throw new Error('test error');
          },
          'test-op',
          99
        );
        expect(result).toBe(99);
      });

      it('should return undefined on error without fallback', () => {
        const result = coordinator.testSafeExecute(
          () => {
            throw new Error('test error');
          },
          'test-op'
        );
        expect(result).toBeUndefined();
      });
    });

    describe('Async Safe Execution', () => {
      it('should execute async operation successfully', async () => {
        const result = await coordinator.testSafeExecuteAsync(
          async () => 42,
          'async-op'
        );
        expect(result).toBe(42);
      });

      it('should return fallback on async error', async () => {
        const result = await coordinator.testSafeExecuteAsync(
          async () => {
            throw new Error('async error');
          },
          'async-op',
          99
        );
        expect(result).toBe(99);
      });
    });

    describe('Dispose Check', () => {
      it('should not throw when not disposed', () => {
        expect(() => coordinator.testCheckDisposed()).not.toThrow();
      });

      it('should throw when disposed', () => {
        coordinator.dispose();
        expect(() => coordinator.testCheckDisposed()).toThrow('has been disposed');
      });
    });

    describe('Disposal', () => {
      it('should call disposeResources on dispose', () => {
        coordinator.dispose();
        expect(coordinator.disposeResourcesCalled).toBe(true);
      });

      it('should clear all timeouts on dispose', () => {
        const callback = vi.fn();
        coordinator.getTimeouts().set('test', callback, 100);

        coordinator.dispose();

        vi.advanceTimersByTime(100);
        expect(callback).not.toHaveBeenCalled();
      });

      it('should dispose all tracked disposables', () => {
        const dispose = vi.fn();
        coordinator.getDisposables().track('test', { dispose });

        coordinator.dispose();

        expect(dispose).toHaveBeenCalled();
      });

      it('should only dispose once', () => {
        coordinator.dispose();
        const callCount = coordinator.disposeResourcesCalled;

        coordinator.dispose();
        coordinator.dispose();

        // disposeResourcesCalled should still be true (set only once)
        expect(coordinator.disposeResourcesCalled).toBe(callCount);
      });

      it('should set isDisposed flag', () => {
        coordinator.dispose();
        expect(coordinator.getIsDisposed()).toBe(true);
      });

      it('should handle errors in disposeResources gracefully', () => {
        class ErrorCoordinator extends BaseCoordinator {
          constructor() {
            super('ErrorCoord');
          }

          protected disposeResources(): void {
            throw new Error('Dispose error');
          }
        }

        const errorCoord = new ErrorCoordinator();
        expect(() => errorCoord.dispose()).not.toThrow();
      });
    });
  });
});
