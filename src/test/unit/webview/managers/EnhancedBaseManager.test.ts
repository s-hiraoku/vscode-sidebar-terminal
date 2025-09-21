/**
 * EnhancedBaseManager 完全テストスイート
 * - ライフサイクル管理とエラーハンドリングの検証
 * - パフォーマンス監視とリソース管理のテスト
 * - 実際のマネージャー実装シナリオの包括的カバレッジ
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  EnhancedBaseManager,
  ManagerErrorHandler,
  ManagerPerformanceTracker,
  ManagerFactory,
  ManagerInitializationOptions,
  ManagerHealthStatus,
  ResourceCleanupResult
} from '../../../../webview/managers/EnhancedBaseManager';
import { LoggerFunction } from '../../../../webview/utils/TypedMessageHandling';

describe('EnhancedBaseManager - 強化された基底マネージャー', () => {

  // =============================================================================
  // テストセットアップとモックマネージャー
  // =============================================================================

  class TestManager extends EnhancedBaseManager {
    public initializeCalled = false;
    public disposeCalled = false;
    public shouldFailInitialization = false;
    public shouldFailDisposal = false;
    public initializationDelay = 0;

    protected async doInitializeManager(): Promise<void> {
      this.initializeCalled = true;

      if (this.shouldFailInitialization) {
        throw new Error('Initialization failed');
      }

      if (this.initializationDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.initializationDelay));
      }
    }

    protected async doDisposeManager(): Promise<void> {
      this.disposeCalled = true;

      if (this.shouldFailDisposal) {
        throw new Error('Disposal failed');
      }
    }

    public testExecuteOperationSafely<T>(
      operation: () => Promise<T>,
      operationName: string,
      fallbackValue?: T
    ): Promise<T | null> {
      return this.executeOperationSafely(operation, operationName, fallbackValue);
    }

    public testEnsureManagerReady(): void {
      return this.ensureManagerReady();
    }

    public testRegisterResourceCleanup(cleanupFn: () => void): void {
      return this.registerResourceCleanup(cleanupFn);
    }
  }

  let mockLogger: sinon.SinonStub<Parameters<LoggerFunction>, void>;
  let defaultOptions: ManagerInitializationOptions;

  beforeEach(() => {
    mockLogger = sinon.stub();
    defaultOptions = {
      enableLogging: true,
      enablePerformanceTracking: true,
      enableErrorRecovery: true,
      initializationTimeoutMs: 1000,
      customLogger: mockLogger
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  // =============================================================================
  // ManagerErrorHandler テスト
  // =============================================================================

  describe('ManagerErrorHandler - エラー処理', () => {

    let errorHandler: ManagerErrorHandler;

    beforeEach(() => {
      errorHandler = new ManagerErrorHandler('test-manager', mockLogger, true);
    });

    describe('基本的なエラーハンドリング', () => {

      it('should execute successful operations correctly', async () => {
        const successfulOperation = async () => 'success result';

        const result = await errorHandler.executeWithErrorHandling(
          successfulOperation,
          'test-operation'
        );

        expect(result).to.equal('success result');
        expect(errorHandler.getErrorCount()).to.equal(0);
        expect(mockLogger).to.have.been.calledWith(
          sinon.match(/completed successfully/)
        );
      });

      it('should handle operation failures with recovery', async () => {
        const failingOperation = async () => {
          throw new Error('Operation failed');
        };

        const result = await errorHandler.executeWithErrorHandling(
          failingOperation,
          'failing-operation',
          'fallback-value'
        );

        expect(result).to.equal('fallback-value');
        expect(errorHandler.getErrorCount()).to.equal(1);
        expect(errorHandler.getLastError()?.message).to.equal('Operation failed');
      });

      it('should return null when no fallback is provided', async () => {
        const failingOperation = async () => {
          throw new Error('Operation failed');
        };

        const result = await errorHandler.executeWithErrorHandling(
          failingOperation,
          'failing-operation'
        );

        expect(result).to.be.null;
        expect(errorHandler.getErrorCount()).to.equal(1);
      });

    });

    describe('エラー統計管理', () => {

      it('should track error count correctly', async () => {
        const failingOperation = async () => {
          throw new Error('Repeated failure');
        };

        // Execute multiple failing operations
        for (let i = 0; i < 3; i++) {
          await errorHandler.executeWithErrorHandling(failingOperation, 'test');
        }

        expect(errorHandler.getErrorCount()).to.equal(3);
      });

      it('should reset error count and last error', async () => {
        const failingOperation = async () => {
          throw new Error('Test error');
        };

        await errorHandler.executeWithErrorHandling(failingOperation, 'test');
        expect(errorHandler.getErrorCount()).to.equal(1);
        expect(errorHandler.getLastError()).to.not.be.undefined;

        errorHandler.resetErrorCount();

        expect(errorHandler.getErrorCount()).to.equal(0);
        expect(errorHandler.getLastError()).to.be.undefined;
      });

    });

  });

  // =============================================================================
  // ManagerPerformanceTracker テスト
  // =============================================================================

  describe('ManagerPerformanceTracker - パフォーマンス監視', () => {

    let performanceTracker: ManagerPerformanceTracker;

    beforeEach(() => {
      performanceTracker = new ManagerPerformanceTracker();
    });

    describe('メトリクス記録', () => {

      it('should record initialization time', () => {
        const initTime = 150.5;
        performanceTracker.recordInitialization(initTime);

        const metrics = performanceTracker.getMetrics();
        expect(metrics.initializationTimeMs).to.equal(initTime);
      });

      it('should record operation metrics', () => {
        performanceTracker.recordOperation(100);
        performanceTracker.recordOperation(200);
        performanceTracker.recordOperation(300);

        const metrics = performanceTracker.getMetrics();
        expect(metrics.operationCount).to.equal(3);
        expect(metrics.averageOperationTimeMs).to.equal(200);
        expect(metrics.lastOperationTimestamp).to.be.a('number');
      });

      it('should handle zero operations gracefully', () => {
        const metrics = performanceTracker.getMetrics();
        expect(metrics.operationCount).to.equal(0);
        expect(metrics.averageOperationTimeMs).to.equal(0);
      });

    });

    describe('メトリクスリセット', () => {

      it('should reset all operation metrics', () => {
        performanceTracker.recordInitialization(100);
        performanceTracker.recordOperation(50);

        performanceTracker.reset();

        const metrics = performanceTracker.getMetrics();
        expect(metrics.operationCount).to.equal(0);
        expect(metrics.averageOperationTimeMs).to.equal(0);
        expect(metrics.lastOperationTimestamp).to.equal(0);
        // Note: initialization time is preserved
        expect(metrics.initializationTimeMs).to.equal(100);
      });

    });

  });

  // =============================================================================
  // EnhancedBaseManager ライフサイクルテスト
  // =============================================================================

  describe('EnhancedBaseManager - ライフサイクル管理', () => {

    let manager: TestManager;

    beforeEach(() => {
      manager = new TestManager('test-manager', defaultOptions);
    });

    afterEach(async () => {
      if (!manager.getHealthStatus().isDisposed) {
        await manager.disposeManager();
      }
    });

    describe('初期化プロセス', () => {

      it('should initialize successfully', async () => {
        await manager.initializeManager();

        expect(manager.initializeCalled).to.be.true;
        expect(manager.getHealthStatus().isInitialized).to.be.true;
        expect(manager.getHealthStatus().isHealthy).to.be.true;
        expect(mockLogger).to.have.been.calledWith(
          sinon.match(/initialized successfully/)
        );
      });

      it('should handle initialization failure', async () => {
        manager.shouldFailInitialization = true;

        try {
          await manager.initializeManager();
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).to.be.instanceOf(Error);
          expect(manager.getHealthStatus().isInitialized).to.be.false;
        }
      });

      it('should respect initialization timeout', async () => {
        manager.initializationDelay = 1500; // Longer than timeout

        try {
          await manager.initializeManager();
          expect.fail('Should have timed out');
        } catch (error) {
          expect(error).to.be.instanceOf(Error);
          expect((error as Error).message).to.include('timed out');
        }
      });

      it('should skip re-initialization', async () => {
        await manager.initializeManager();
        manager.initializeCalled = false; // Reset flag

        await manager.initializeManager(); // Second call

        expect(manager.initializeCalled).to.be.false; // Should not be called again
      });

      it('should prevent initialization of disposed manager', async () => {
        await manager.initializeManager();
        await manager.disposeManager();

        try {
          await manager.initializeManager();
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect((error as Error).message).to.include('disposed manager');
        }
      });

    });

    describe('破棄プロセス', () => {

      it('should dispose successfully', async () => {
        await manager.initializeManager();
        await manager.disposeManager();

        expect(manager.disposeCalled).to.be.true;
        expect(manager.getHealthStatus().isDisposed).to.be.true;
        expect(manager.getHealthStatus().isInitialized).to.be.false;
      });

      it('should handle disposal failure', async () => {
        await manager.initializeManager();
        manager.shouldFailDisposal = true;

        try {
          await manager.disposeManager();
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).to.be.instanceOf(Error);
        }
      });

      it('should skip re-disposal', async () => {
        await manager.initializeManager();
        await manager.disposeManager();
        manager.disposeCalled = false; // Reset flag

        await manager.disposeManager(); // Second call

        expect(manager.disposeCalled).to.be.false; // Should not be called again
      });

    });

    describe('ヘルス監視', () => {

      it('should provide accurate health status', async () => {
        // Initial state
        let status = manager.getHealthStatus();
        expect(status.isHealthy).to.be.false;
        expect(status.isInitialized).to.be.false;
        expect(status.isDisposed).to.be.false;

        // After initialization
        await manager.initializeManager();
        status = manager.getHealthStatus();
        expect(status.isHealthy).to.be.true;
        expect(status.isInitialized).to.be.true;
        expect(status.upTimeMs).to.be.greaterThan(0);

        // After disposal
        await manager.disposeManager();
        status = manager.getHealthStatus();
        expect(status.isHealthy).to.be.false;
        expect(status.isDisposed).to.be.true;
      });

      it('should include performance metrics in health status', async () => {
        await manager.initializeManager();

        // Simulate some operations
        await manager.testExecuteOperationSafely(
          async () => 'result',
          'test-operation'
        );

        const status = manager.getHealthStatus();
        expect(status.performanceMetrics.operationCount).to.equal(1);
        expect(status.performanceMetrics.initializationTimeMs).to.be.greaterThan(0);
      });

    });

  });

  // =============================================================================
  // 安全な操作実行テスト
  // =============================================================================

  describe('Safe Operation Execution', () => {

    let manager: TestManager;

    beforeEach(async () => {
      manager = new TestManager('test-manager', defaultOptions);
      await manager.initializeManager();
    });

    afterEach(async () => {
      await manager.disposeManager();
    });

    describe('executeOperationSafely', () => {

      it('should execute successful operations', async () => {
        const operation = async () => 'operation result';

        const result = await manager.testExecuteOperationSafely(
          operation,
          'test-operation'
        );

        expect(result).to.equal('operation result');
      });

      it('should handle operation failures with fallback', async () => {
        const failingOperation = async () => {
          throw new Error('Operation failed');
        };

        const result = await manager.testExecuteOperationSafely(
          failingOperation,
          'failing-operation',
          'fallback-result'
        );

        expect(result).to.equal('fallback-result');
      });

      it('should require manager to be ready', async () => {
        await manager.disposeManager();

        try {
          await manager.testExecuteOperationSafely(
            async () => 'result',
            'test'
          );
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect((error as Error).message).to.include('disposed');
        }
      });

    });

    describe('ensureManagerReady', () => {

      it('should pass when manager is ready', () => {
        expect(() => manager.testEnsureManagerReady()).to.not.throw();
      });

      it('should throw when manager is not initialized', () => {
        const uninitializedManager = new TestManager('uninitialized', defaultOptions);

        expect(() => uninitializedManager.testEnsureManagerReady()).to.throw(
          /not initialized/
        );
      });

    });

  });

  // =============================================================================
  // リソース管理テスト
  // =============================================================================

  describe('Resource Management', () => {

    let manager: TestManager;

    beforeEach(async () => {
      manager = new TestManager('test-manager', defaultOptions);
      await manager.initializeManager();
    });

    afterEach(async () => {
      await manager.disposeManager();
    });

    describe('リソースクリーンアップ', () => {

      it('should register and cleanup resources', async () => {
        const cleanupSpy1 = sinon.spy();
        const cleanupSpy2 = sinon.spy();

        manager.testRegisterResourceCleanup(cleanupSpy1);
        manager.testRegisterResourceCleanup(cleanupSpy2);

        await manager.disposeManager();

        expect(cleanupSpy1).to.have.been.calledOnce;
        expect(cleanupSpy2).to.have.been.calledOnce;
      });

      it('should handle cleanup failures gracefully', async () => {
        const failingCleanup = sinon.stub().throws(new Error('Cleanup failed'));
        const successfulCleanup = sinon.spy();

        manager.testRegisterResourceCleanup(failingCleanup);
        manager.testRegisterResourceCleanup(successfulCleanup);

        // Should not throw despite cleanup failure
        await manager.disposeManager();

        expect(failingCleanup).to.have.been.calledOnce;
        expect(successfulCleanup).to.have.been.calledOnce;
      });

    });

  });

  // =============================================================================
  // ManagerFactory テスト
  // =============================================================================

  describe('ManagerFactory - ファクトリーパターン', () => {

    describe('マネージャー作成', () => {

      it('should create manager with factory', () => {
        const manager = ManagerFactory.createManager(
          TestManager,
          defaultOptions,
          'factory-created'
        );

        expect(manager).to.be.instanceOf(TestManager);
        expect(manager.getHealthStatus().managerName).to.equal('factory-created');
      });

      it('should create and initialize manager', async () => {
        const manager = await ManagerFactory.createAndInitializeManager(
          TestManager,
          defaultOptions,
          'auto-initialized'
        );

        expect(manager.getHealthStatus().isInitialized).to.be.true;

        await manager.disposeManager();
      });

    });

  });

  // =============================================================================
  // パフォーマンステスト
  // =============================================================================

  describe('Performance Tests', () => {

    let manager: TestManager;

    beforeEach(async () => {
      manager = new TestManager('perf-test', {
        ...defaultOptions,
        enablePerformanceTracking: true
      });
      await manager.initializeManager();
    });

    afterEach(async () => {
      await manager.disposeManager();
    });

    it('should handle high-frequency operations efficiently', async () => {
      const operationCount = 1000;
      const operations: Promise<string | null>[] = [];

      const startTime = performance.now();

      for (let i = 0; i < operationCount; i++) {
        operations.push(
          manager.testExecuteOperationSafely(
            async () => `result-${i}`,
            `operation-${i}`
          )
        );
      }

      const results = await Promise.all(operations);
      const endTime = performance.now();

      expect(results).to.have.length(operationCount);
      expect(results.every(r => r !== null)).to.be.true;
      expect(endTime - startTime).to.be.lessThan(2000); // Should complete in under 2 seconds

      const status = manager.getHealthStatus();
      expect(status.performanceMetrics.operationCount).to.equal(operationCount);
    });

    it('should track initialization performance', async () => {
      const status = manager.getHealthStatus();
      expect(status.performanceMetrics.initializationTimeMs).to.be.greaterThan(0);
    });

  });

  // =============================================================================
  // 統合テスト
  // =============================================================================

  describe('Integration Tests', () => {

    it('should handle complete manager lifecycle', async () => {
      const manager = new TestManager('integration-test', {
        enableLogging: true,
        enablePerformanceTracking: true,
        enableErrorRecovery: true,
        initializationTimeoutMs: 5000
      });

      // Initialization
      await manager.initializeManager();
      expect(manager.getHealthStatus().isHealthy).to.be.true;

      // Resource registration
      const cleanupSpy = sinon.spy();
      manager.testRegisterResourceCleanup(cleanupSpy);

      // Operation execution
      const result = await manager.testExecuteOperationSafely(
        async () => 'integration-result',
        'integration-operation'
      );
      expect(result).to.equal('integration-result');

      // Health monitoring
      const healthStatus = manager.getHealthStatus();
      expect(healthStatus.isHealthy).to.be.true;
      expect(healthStatus.performanceMetrics.operationCount).to.equal(1);

      // Disposal
      await manager.disposeManager();
      expect(cleanupSpy).to.have.been.calledOnce;
      expect(manager.getHealthStatus().isDisposed).to.be.true;
    });

    it('should handle error scenarios gracefully', async () => {
      const manager = new TestManager('error-test', defaultOptions);
      await manager.initializeManager();

      // Test operation with error and recovery
      let attempts = 0;
      const flakyOperation = async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error('First attempt fails');
        }
        return 'success on retry';
      };

      // First attempt (will fail)
      const firstResult = await manager.testExecuteOperationSafely(
        flakyOperation,
        'flaky-operation',
        'fallback'
      );
      expect(firstResult).to.equal('fallback');

      // Second attempt (will succeed)
      const secondResult = await manager.testExecuteOperationSafely(
        flakyOperation,
        'flaky-operation'
      );
      expect(secondResult).to.equal('success on retry');

      await manager.disposeManager();
    });

  });

});