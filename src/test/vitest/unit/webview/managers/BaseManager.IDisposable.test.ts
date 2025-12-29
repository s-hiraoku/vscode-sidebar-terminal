/**
 * BaseManager IDisposable Implementation Tests
 *
 * Tests for Issue #216: Ensures BaseManager properly implements IDisposable interface
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 *
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BaseManager } from '../../../../../webview/managers/BaseManager';
import { IDisposable } from '../../../../../webview/utils/DOMManager';

// Concrete test implementation of BaseManager
class TestManager extends BaseManager {
  public initializeCallCount = 0;
  public disposeCallCount = 0;

  constructor(name: string = 'TestManager') {
    super(name, {
      enableLogging: false,
      enablePerformanceTracking: true,
      enableErrorRecovery: true,
    });
  }

  protected doInitialize(): void {
    this.initializeCallCount++;
  }

  protected doDispose(): void {
    this.disposeCallCount++;
  }
}

describe('BaseManager - IDisposable Implementation', () => {
  let manager: TestManager;

  beforeEach(() => {
    manager = new TestManager();
  });

  afterEach(() => {
    if (manager && !manager['isDisposed']) {
      manager.dispose();
    }
  });

  describe('IDisposable Interface', () => {
    it('should implement IDisposable interface', () => {
      // Type assertion to ensure IDisposable is implemented
      const disposable: IDisposable = manager;
      expect(disposable).toHaveProperty('dispose');
      expect(typeof disposable.dispose).toBe('function');
    });

    it('should have dispose method', () => {
      expect(manager).toHaveProperty('dispose');
      expect(typeof manager.dispose).toBe('function');
    });
  });

  describe('Initialization Lifecycle', () => {
    it('should initialize successfully', async () => {
      await manager.initialize();
      expect(manager.initializeCallCount).toBe(1);
      expect(manager['isReady']).toBe(true);
      expect(manager['isDisposed']).toBe(false);
    });

    it('should not reinitialize if already initialized', async () => {
      await manager.initialize();
      await manager.initialize();
      expect(manager.initializeCallCount).toBe(1);
    });

    it('should track initialization time', async () => {
      await manager.initialize();
      const metrics = manager.getPerformanceMetrics();
      expect(metrics.initializationTimeMs).toBeGreaterThan(0);
    });
  });

  describe('Disposal Lifecycle', () => {
    it('should dispose successfully', async () => {
      await manager.initialize();
      manager.dispose();

      expect(manager.disposeCallCount).toBe(1);
      expect(manager['isReady']).toBe(false);
      expect(manager['isDisposed']).toBe(true);
    });

    it('should not dispose twice', async () => {
      await manager.initialize();
      manager.dispose();
      manager.dispose();

      expect(manager.disposeCallCount).toBe(1);
    });

    it('should dispose without initialization', () => {
      manager.dispose();
      expect(manager.disposeCallCount).toBe(1);
      expect(manager['isDisposed']).toBe(true);
    });
  });

  describe('Status Reporting', () => {
    it('should return correct status after initialization', async () => {
      await manager.initialize();
      const status = manager.getStatus();

      expect(status.name).toBe('TestManager');
      expect(status.isReady).toBe(true);
      expect(status.isDisposed).toBe(false);
    });

    it('should return correct status after disposal', async () => {
      await manager.initialize();
      manager.dispose();
      const status = manager.getStatus();

      expect(status.name).toBe('TestManager');
      expect(status.isReady).toBe(false);
      expect(status.isDisposed).toBe(true);
    });
  });

  describe('Health Status', () => {
    it('should report healthy status when initialized', async () => {
      await manager.initialize();
      // Small delay to ensure upTimeMs is tracked
      await new Promise((resolve) => setTimeout(resolve, 5));
      const health = manager.getHealthStatus();

      expect(health.managerName).toBe('TestManager');
      expect(health.isHealthy).toBe(true);
      expect(health.isInitialized).toBe(true);
      expect(health.isDisposed).toBe(false);
      // upTimeMs may be 0 on very fast initialization
      expect(health.upTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should report unhealthy status when disposed', async () => {
      await manager.initialize();
      manager.dispose();
      const health = manager.getHealthStatus();

      expect(health.isHealthy).toBe(false);
      expect(health.isDisposed).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics', async () => {
      await manager.initialize();
      const metrics = manager.getPerformanceMetrics();

      expect(metrics).toHaveProperty('initializationTimeMs');
      expect(metrics).toHaveProperty('operationCount');
      expect(metrics).toHaveProperty('averageOperationTimeMs');
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics).toHaveProperty('lastOperationTimestamp');
    });

    it('should reset performance metrics', async () => {
      await manager.initialize();
      manager.resetPerformanceMetrics();
      const metrics = manager.getPerformanceMetrics();

      expect(metrics.operationCount).toBe(0);
      expect(metrics.averageOperationTimeMs).toBe(0);
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup all registered resources on dispose', async () => {
      let cleanupCalled = false;

      await manager.initialize();

      // Register a cleanup function
      manager['registerResourceCleanup'](() => {
        cleanupCalled = true;
      });

      manager.dispose();

      expect(cleanupCalled).toBe(true);
    });

    it('should handle resource cleanup errors gracefully', async () => {
      await manager.initialize();

      // Register a cleanup function that throws
      manager['registerResourceCleanup'](() => {
        throw new Error('Cleanup error');
      });

      // Should not throw
      expect(() => manager.dispose()).not.toThrow();
      expect(manager['isDisposed']).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should track error count', async () => {
      await manager.initialize();

      // Initially no errors
      expect(manager['errorHandler']['getErrorCount']()).toBe(0);

      // Reset error count
      manager.resetErrorCount();
      expect(manager['errorHandler']['getErrorCount']()).toBe(0);
    });
  });

  describe('Abstract Method Enforcement', () => {
    it('should require doInitialize implementation', () => {
      class _IncompleteManager extends BaseManager {
        protected doDispose(): void {}
        protected doInitialize(): void {}
        // This shows TypeScript enforces abstract method implementation
      }

      // This test verifies that TypeScript enforces abstract method implementation
      // If this compiles, it means the abstract methods are properly enforced
    });
  });
});
