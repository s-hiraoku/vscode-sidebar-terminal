/**
 * BaseManager Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseManager } from '../../../../../webview/managers/BaseManager';

// Concrete implementation for testing
class TestManager extends BaseManager {
  public doInitCalled = 0;
  public doDisposeCalled = 0;

  constructor() {
    super('TestManager');
  }

  protected async doInitialize(): Promise<void> {
    this.doInitCalled++;
  }

  protected doDispose(): void {
    this.doDisposeCalled++;
  }

  // Expose protected methods for testing
  public testSafeExecute<T>(op: () => Promise<T>, name: string) {
    return this.safeExecute(op, name);
  }

  public testRegisterCleanup(fn: () => void) {
    this.registerResourceCleanup(fn);
  }
}

// Mock logger
vi.mock('../../../../../webview/utils/logger', () => ({
  webview: vi.fn(),
}));

describe('BaseManager', () => {
  let manager: TestManager;

  beforeEach(() => {
    manager = new TestManager();
    vi.clearAllMocks();
  });

  describe('Lifecycle', () => {
    it('should initialize successfully', async () => {
      await manager.initialize();
      expect(manager.doInitCalled).toBe(1);
      expect(manager.getStatus().isReady).toBe(true);
    });

    it('should not initialize twice', async () => {
      await manager.initialize();
      await manager.initialize();
      expect(manager.doInitCalled).toBe(1);
    });

    it('should handle initialization failure', async () => {
      const failingManager = new (class extends BaseManager {
        protected async doInitialize() { throw new Error('Init fail'); }
        protected doDispose() {}
      })('Failing');
      
      await expect(failingManager.initialize()).rejects.toThrow('Init fail');
      expect(failingManager.getStatus().isReady).toBe(false);
    });

    it('should dispose successfully', async () => {
      await manager.initialize();
      manager.dispose();
      expect(manager.doDisposeCalled).toBe(1);
      expect(manager.getStatus().isDisposed).toBe(true);
      expect(manager.getStatus().isReady).toBe(false);
    });

    it('should not dispose twice', () => {
      manager.dispose();
      manager.dispose();
      expect(manager.doDisposeCalled).toBe(1);
    });
  });

  describe('Safe Execution', () => {
    it('should return null if executing before init', async () => {
      const result = await manager.testSafeExecute(async () => 'ok', 'op');
      expect(result).toBeNull();
    });

    it('should execute successfully after init', async () => {
      await manager.initialize();
      const result = await manager.testSafeExecute(async () => 'success', 'op');
      expect(result).toBe('success');
    });

    it('should return null and log error if operation fails', async () => {
      await manager.initialize();
      const result = await manager.testSafeExecute(async () => { throw new Error('Fail'); }, 'op');
      expect(result).toBeNull();
    });
  });

  describe('Resource Management', () => {
    it('should run registered cleanup functions on dispose', () => {
      const cleanup = vi.fn();
      manager.testRegisterCleanup(cleanup);
      
      manager.dispose();
      expect(cleanup).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', () => {
      const cleanup = () => { throw new Error('Cleanup fail'); };
      manager.testRegisterCleanup(cleanup);
      
      // Should not throw
      expect(() => manager.dispose()).not.toThrow();
    });
  });

  describe('Health and Metrics', () => {
    it('should provide health status', async () => {
      await manager.initialize();
      const status = manager.getHealthStatus();
      expect(status.managerName).toBe('TestManager');
      expect(status.isHealthy).toBe(true);
    });

    it('should track performance metrics', async () => {
      await manager.initialize();
      const metrics = manager.getPerformanceMetrics();
      expect(metrics.initializationTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
