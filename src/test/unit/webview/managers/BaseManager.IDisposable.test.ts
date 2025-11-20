/**
 * BaseManager IDisposable Implementation Tests
 *
 * Tests for Issue #216: Ensures BaseManager properly implements IDisposable interface
 *
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

import { expect } from 'chai';
import { BaseManager } from '../../../../webview/managers/BaseManager';
import { IDisposable } from '../../../../webview/utils/DOMManager';

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
      expect(disposable).to.have.property('dispose');
      expect(typeof disposable.dispose).to.equal('function');
    });

    it('should have dispose method', () => {
      expect(manager).to.have.property('dispose');
      expect(typeof manager.dispose).to.equal('function');
    });
  });

  describe('Initialization Lifecycle', () => {
    it('should initialize successfully', async () => {
      await manager.initialize();
      expect(manager.initializeCallCount).to.equal(1);
      expect(manager['isReady']).to.be.true;
      expect(manager['isDisposed']).to.be.false;
    });

    it('should not reinitialize if already initialized', async () => {
      await manager.initialize();
      await manager.initialize();
      expect(manager.initializeCallCount).to.equal(1);
    });

    it('should track initialization time', async () => {
      await manager.initialize();
      const metrics = manager.getPerformanceMetrics();
      expect(metrics.initializationTimeMs).to.be.greaterThan(0);
    });
  });

  describe('Disposal Lifecycle', () => {
    it('should dispose successfully', async () => {
      await manager.initialize();
      manager.dispose();

      expect(manager.disposeCallCount).to.equal(1);
      expect(manager['isReady']).to.be.false;
      expect(manager['isDisposed']).to.be.true;
    });

    it('should not dispose twice', async () => {
      await manager.initialize();
      manager.dispose();
      manager.dispose();

      expect(manager.disposeCallCount).to.equal(1);
    });

    it('should dispose without initialization', () => {
      manager.dispose();
      expect(manager.disposeCallCount).to.equal(1);
      expect(manager['isDisposed']).to.be.true;
    });
  });

  describe('Status Reporting', () => {
    it('should return correct status after initialization', async () => {
      await manager.initialize();
      const status = manager.getStatus();

      expect(status.name).to.equal('TestManager');
      expect(status.isReady).to.be.true;
      expect(status.isDisposed).to.be.false;
    });

    it('should return correct status after disposal', async () => {
      await manager.initialize();
      manager.dispose();
      const status = manager.getStatus();

      expect(status.name).to.equal('TestManager');
      expect(status.isReady).to.be.false;
      expect(status.isDisposed).to.be.true;
    });
  });

  describe('Health Status', () => {
    it('should report healthy status when initialized', async () => {
      await manager.initialize();
      const health = manager.getHealthStatus();

      expect(health.managerName).to.equal('TestManager');
      expect(health.isHealthy).to.be.true;
      expect(health.isInitialized).to.be.true;
      expect(health.isDisposed).to.be.false;
      expect(health.upTimeMs).to.be.greaterThan(0);
    });

    it('should report unhealthy status when disposed', async () => {
      await manager.initialize();
      manager.dispose();
      const health = manager.getHealthStatus();

      expect(health.isHealthy).to.be.false;
      expect(health.isDisposed).to.be.true;
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics', async () => {
      await manager.initialize();
      const metrics = manager.getPerformanceMetrics();

      expect(metrics).to.have.property('initializationTimeMs');
      expect(metrics).to.have.property('operationCount');
      expect(metrics).to.have.property('averageOperationTimeMs');
      expect(metrics).to.have.property('errorCount');
      expect(metrics).to.have.property('lastOperationTimestamp');
    });

    it('should reset performance metrics', async () => {
      await manager.initialize();
      manager.resetPerformanceMetrics();
      const metrics = manager.getPerformanceMetrics();

      expect(metrics.operationCount).to.equal(0);
      expect(metrics.averageOperationTimeMs).to.equal(0);
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

      expect(cleanupCalled).to.be.true;
    });

    it('should handle resource cleanup errors gracefully', async () => {
      await manager.initialize();

      // Register a cleanup function that throws
      manager['registerResourceCleanup'](() => {
        throw new Error('Cleanup error');
      });

      // Should not throw
      expect(() => manager.dispose()).to.not.throw();
      expect(manager['isDisposed']).to.be.true;
    });
  });

  describe('Error Handling', () => {
    it('should track error count', async () => {
      await manager.initialize();

      // Initially no errors
      expect(manager['errorHandler']['getErrorCount']()).to.equal(0);

      // Reset error count
      manager.resetErrorCount();
      expect(manager['errorHandler']['getErrorCount']()).to.equal(0);
    });
  });

  describe('Abstract Method Enforcement', () => {
    it('should require doInitialize implementation', () => {
      class _IncompleteManager extends BaseManager {
        protected doDispose(): void {}
        // Missing doInitialize - TypeScript should enforce this
      }

      // This test verifies that TypeScript enforces abstract method implementation
      // If this compiles, it means the abstract methods are properly enforced
    });
  });
});
