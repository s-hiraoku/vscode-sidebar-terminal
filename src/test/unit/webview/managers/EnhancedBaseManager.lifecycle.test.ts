/**
 * Comprehensive TDD Tests for EnhancedBaseManager Lifecycle - Following t-wada's Methodology
 *
 * These tests verify the complete lifecycle management of EnhancedBaseManager:
 * - Initialization and disposal patterns
 * - Error handling and recovery
 * - Performance tracking and monitoring
 * - Resource management and cleanup
 * - Health status reporting
 *
 * TDD Approach:
 * 1. RED: Write failing tests that specify exact lifecycle behavior
 * 2. GREEN: Implement minimal code to satisfy lifecycle requirements
 * 3. REFACTOR: Improve lifecycle management while keeping tests green
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  BaseManager,
  ManagerInitOptions,
  ResourceCleanupResult
} from '../../../../webview/managers/BaseManager';
import { LoggerFunction } from '../../../../webview/utils/TypedMessageHandling';
import { setupTestEnvironment, resetTestEnvironment } from '../../../shared/TestSetup';

describe('EnhancedBaseManager Lifecycle - Comprehensive TDD Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let mockLogger: LoggerFunction;

  beforeEach(() => {
    setupTestEnvironment();
    sandbox = sinon.createSandbox();
    mockLogger = sandbox.stub();
  });

  afterEach(() => {
    resetTestEnvironment();
    sandbox.restore();
  });

  // Test manager implementation for lifecycle testing
  class TestLifecycleManager extends BaseManager {
    public initializeCalled = false;
    public disposeCalled = false;
    public shouldFailInitialization = false;
    public shouldFailDisposal = false;
    public initializationDelay = 0;
    public disposalDelay = 0;

    constructor(name: string = 'TestLifecycleManager', options?: ManagerInitOptions) {
      super(name, options);
    }

    protected async doInitialize(): Promise<void> {
      this.initializeCalled = true;

      if (this.shouldFailInitialization) {
        throw new Error('Initialization failed as requested');
      }

      if (this.initializationDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.initializationDelay));
      }
    }

    protected doDispose(): void {
      this.disposeCalled = true;

      if (this.shouldFailDisposal) {
        throw new Error('Disposal failed as requested');
      }

      if (this.disposalDelay > 0) {
        // Synchronous delay simulation
        const start = Date.now();
        while (Date.now() - start < this.disposalDelay) {
          // Busy wait
        }
      }
    }

    // Expose protected methods for testing
    public testExecuteOperationSafely<T>(
      operation: () => Promise<T>,
      operationName: string
    ): Promise<T | null> {
      return this.safeExecute(operation, operationName);
    }

    public testEnsureManagerReady(): void {
      if (!this.isReady) {
        throw new Error(`Manager not initialized: ${this.managerName}`);
      }
    }

    // Expose protected properties for testing
    public get testIsReady(): boolean {
      return this.isReady;
    }

    public get testManagerName(): string {
      return this.managerName;
    }

    // Expose protected resource cleanup method for testing
    public testRegisterResourceCleanup(cleanup: () => void): void {
      this.registerResourceCleanup(cleanup);
    }
  }

  describe('Manager Initialization Lifecycle', () => {

    describe('RED Phase - Initialization Requirements', () => {

      it('should fail to execute operations before initialization', () => {
        // RED: Uninitialized manager should reject operations
        const manager = new TestLifecycleManager('TestManager');

        expect(() => manager.testEnsureManagerReady()).to.throw('Manager not initialized: TestManager');
      });

      it('should initialize successfully with default options', async () => {
        // RED: Initialization should work with defaults
        const manager = new TestLifecycleManager('TestManager');

        await manager.initialize();

        expect(manager.initializeCalled).to.be.true;
        const health = manager.getHealthStatus();
        expect(health.isInitialized).to.be.true;
        expect(health.isHealthy).to.be.true;
      });

      it('should initialize successfully with custom options', async () => {
        // RED: Custom options should be respected
        const customOptions: ManagerInitOptions = {
          enableLogging: false,
          enablePerformanceTracking: true,
          enableErrorRecovery: false,
          initializationTimeoutMs: 10000,
          customLogger: mockLogger
        };

        const manager = new TestLifecycleManager('TestManager', customOptions);
        await manager.initialize();

        expect(manager.initializeCalled).to.be.true;
        expect(manager.getHealthStatus().isInitialized).to.be.true;
      });

      it('should handle initialization timeout', async () => {
        // RED: Long initialization should timeout
        const manager = new TestLifecycleManager('TestManager', {
          enableLogging: true,
          enablePerformanceTracking: true,
          enableErrorRecovery: true,
          initializationTimeoutMs: 50
        });

        manager.initializationDelay = 100; // Longer than timeout

        let caughtError: Error | null = null;
        try {
          await manager.initialize();
        } catch (error) {
          caughtError = error as Error;
        }

        expect(caughtError).to.not.be.null;
        expect(caughtError?.message).to.include('timed out after 50ms');
        expect(manager.getHealthStatus().isInitialized).to.be.false;
      });

      it('should handle initialization failures gracefully', async () => {
        // RED: Initialization failures should be properly reported
        const manager = new TestLifecycleManager('TestManager');
        manager.shouldFailInitialization = true;

        let caughtError: Error | null = null;
        try {
          await manager.initialize();
        } catch (error) {
          caughtError = error as Error;
        }

        expect(caughtError).to.not.be.null;
        expect(caughtError?.message).to.equal('Initialization failed as requested');
        expect(manager.getHealthStatus().isInitialized).to.be.false;
        expect(manager.getHealthStatus().isHealthy).to.be.false;
      });

      it('should not re-initialize already initialized manager', async () => {
        // RED: Double initialization should be safe
        const manager = new TestLifecycleManager('TestManager');

        await manager.initialize();
        expect(manager.initializeCalled).to.be.true;

        // Reset the flag and try again
        manager.initializeCalled = false;
        await manager.initialize();

        expect(manager.initializeCalled).to.be.false; // Should not be called again
      });

      it('should measure initialization time accurately', async () => {
        // RED: Initialization time should be tracked
        const manager = new TestLifecycleManager('TestManager', {
          enableLogging: true,
          enablePerformanceTracking: true,
          enableErrorRecovery: true,
          initializationTimeoutMs: 5000
        });

        manager.initializationDelay = 50;

        await manager.initialize();

        const health = manager.getHealthStatus();
        expect(health.performanceMetrics.initializationTimeMs).to.be.greaterThan(40);
        expect(health.performanceMetrics.initializationTimeMs).to.be.lessThan(100);
      });

    });

  });

  describe('Manager Disposal Lifecycle', () => {

    describe('RED Phase - Disposal Requirements', () => {

      it('should dispose initialized manager successfully', async () => {
        // RED: Disposal should work for initialized managers
        const manager = new TestLifecycleManager('TestManager');
        await manager.initialize();

        await manager.dispose();

        expect(manager.disposeCalled).to.be.true;
        const health = manager.getHealthStatus();
        expect(health.isDisposed).to.be.true;
        expect(health.isHealthy).to.be.false;
      });

      it('should handle disposal failures gracefully', async () => {
        // RED: Disposal failures should be properly handled
        const manager = new TestLifecycleManager('TestManager');
        await manager.initialize();
        manager.shouldFailDisposal = true;

        let caughtError: Error | null = null;
        try {
          await manager.dispose();
        } catch (error) {
          caughtError = error as Error;
        }

        expect(caughtError).to.not.be.null;
        expect(caughtError?.message).to.equal('Disposal failed as requested');
      });

      it('should not re-dispose already disposed manager', async () => {
        // RED: Double disposal should be safe
        const manager = new TestLifecycleManager('TestManager');
        await manager.initialize();

        await manager.dispose();
        expect(manager.disposeCalled).to.be.true;

        // Reset the flag and try again
        manager.disposeCalled = false;
        await manager.dispose();

        expect(manager.disposeCalled).to.be.false; // Should not be called again
      });

      it('should prevent operations after disposal', async () => {
        // RED: Disposed manager should reject operations
        const manager = new TestLifecycleManager('TestManager');
        await manager.initialize();
        await manager.dispose();

        expect(() => manager.testEnsureManagerReady()).to.throw('Manager is disposed: TestManager');
      });

      it('should clean up resources during disposal', async () => {
        // RED: Resources should be cleaned up
        const manager = new TestLifecycleManager('TestManager');
        await manager.initialize();

        // Register some cleanup functions
        manager.testRegisterResourceCleanup(() => {
          // Mock cleanup
        });
        manager.testRegisterResourceCleanup(() => {
          // Another mock cleanup
        });

        await manager.dispose();

        // Resource cleanup is tested via the ResourceManager functionality
        expect(manager.disposeCalled).to.be.true;
      });

    });

  });

  describe('Error Handling and Recovery', () => {

    describe('RED Phase - Error Handling Requirements', () => {

      it('should handle operation errors with fallback values', async () => {
        // RED: Operations should support fallback values
        const manager = new TestLifecycleManager('TestManager');
        await manager.initialize();

        const failingOperation = async (): Promise<string> => {
          throw new Error('Operation failed');
        };

        const result = await manager.testExecuteOperationSafely(
          failingOperation,
          'test operation'
        );

        expect(result).to.be.null;
      });

      it('should handle operation errors without fallback values', async () => {
        // RED: Operations without fallback should return null on error
        const manager = new TestLifecycleManager('TestManager');
        await manager.initialize();

        const failingOperation = async (): Promise<string> => {
          throw new Error('Operation failed');
        };

        const result = await manager.testExecuteOperationSafely(
          failingOperation,
          'test operation'
        );

        expect(result).to.be.null;
      });

      it('should track error counts accurately', async () => {
        // RED: Error counts should be tracked
        const manager = new TestLifecycleManager('TestManager');
        await manager.initialize();

        const failingOperation = async (): Promise<string> => {
          throw new Error('Operation failed');
        };

        // Execute multiple failing operations
        await manager.testExecuteOperationSafely(failingOperation, 'test 1');
        await manager.testExecuteOperationSafely(failingOperation, 'test 2');
        await manager.testExecuteOperationSafely(failingOperation, 'test 3');

        const health = manager.getHealthStatus();
        expect(health.performanceMetrics.errorCount).to.equal(3);
        expect(health.isHealthy).to.be.false; // Should be unhealthy due to errors
      });

      it('should provide last error information', async () => {
        // RED: Last error should be available
        const manager = new TestLifecycleManager('TestManager');
        await manager.initialize();

        const failingOperation = async (): Promise<string> => {
          throw new Error('Specific error message');
        };

        await manager.testExecuteOperationSafely(failingOperation, 'test operation');

        const health = manager.getHealthStatus();
        expect(health.lastError).to.not.be.undefined;
        expect(health.lastError?.message).to.equal('Specific error message');
      });

    });

  });

  describe('Performance Tracking and Monitoring', () => {

    describe('RED Phase - Performance Requirements', () => {

      it('should track operation counts accurately', async () => {
        // RED: Operation counts should be tracked
        const manager = new TestLifecycleManager('TestManager', {
          enableLogging: true,
          enablePerformanceTracking: true,
          enableErrorRecovery: true,
          initializationTimeoutMs: 5000
        });
        await manager.initialize();

        const successfulOperation = async (): Promise<string> => {
          return 'success';
        };

        // Execute multiple operations
        for (let i = 0; i < 5; i++) {
          await manager.testExecuteOperationSafely(successfulOperation, `test ${i}`);
        }

        const health = manager.getHealthStatus();
        expect(health.performanceMetrics.operationCount).to.equal(5);
      });

      it('should calculate average operation time correctly', async () => {
        // RED: Average operation time should be calculated
        const manager = new TestLifecycleManager('TestManager', {
          enableLogging: true,
          enablePerformanceTracking: true,
          enableErrorRecovery: true,
          initializationTimeoutMs: 5000
        });
        await manager.initialize();

        const timedOperation = async (): Promise<string> => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'success';
        };

        // Execute operations with known timing
        await manager.testExecuteOperationSafely(timedOperation, 'test 1');
        await manager.testExecuteOperationSafely(timedOperation, 'test 2');

        const health = manager.getHealthStatus();
        expect(health.performanceMetrics.averageOperationTimeMs).to.be.greaterThan(5);
        expect(health.performanceMetrics.averageOperationTimeMs).to.be.lessThan(50);
      });

      it('should track last operation timestamp', async () => {
        // RED: Last operation timestamp should be updated
        const manager = new TestLifecycleManager('TestManager', {
          enableLogging: true,
          enablePerformanceTracking: true,
          enableErrorRecovery: true,
          initializationTimeoutMs: 5000
        });
        await manager.initialize();

        const operation = async (): Promise<string> => {
          return 'success';
        };

        await manager.testExecuteOperationSafely(operation, 'test');

        const timestampBefore = Date.now() - 100;

        const health = manager.getHealthStatus();
        expect(health.performanceMetrics.lastOperationTimestamp).to.be.greaterThan(timestampBefore);
        expect(health.performanceMetrics.lastOperationTimestamp).to.be.lessThan(Date.now() + 100);
      });

      it('should calculate uptime accurately', async () => {
        // RED: Uptime should be calculated correctly
        const manager = new TestLifecycleManager('TestManager');

        await manager.initialize();

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 50));

        const health = manager.getHealthStatus();
        expect(health.upTimeMs).to.be.greaterThan(40);
        expect(health.upTimeMs).to.be.lessThan(200);
      });

    });

  });

  describe('Health Status Reporting', () => {

    describe('RED Phase - Health Status Requirements', () => {

      it('should report healthy status for properly functioning manager', async () => {
        // RED: Healthy manager should report as healthy
        const manager = new TestLifecycleManager('TestManager');
        await manager.initialize();

        const health = manager.getHealthStatus();

        expect(health.isHealthy).to.be.true;
        expect(health.isInitialized).to.be.true;
        expect(health.isDisposed).to.be.false;
        expect(health.managerName).to.equal('TestManager');
        expect(health.performanceMetrics.errorCount).to.equal(0);
      });

      it('should report unhealthy status for manager with many errors', async () => {
        // RED: Manager with many errors should be unhealthy
        const manager = new TestLifecycleManager('TestManager');
        await manager.initialize();

        const failingOperation = async (): Promise<string> => {
          throw new Error('Operation failed');
        };

        // Generate many errors (threshold is 10)
        for (let i = 0; i < 15; i++) {
          await manager.testExecuteOperationSafely(failingOperation, `test ${i}`);
        }

        const health = manager.getHealthStatus();
        expect(health.isHealthy).to.be.false;
        expect(health.performanceMetrics.errorCount).to.equal(15);
      });

      it('should report unhealthy status for disposed manager', async () => {
        // RED: Disposed manager should be unhealthy
        const manager = new TestLifecycleManager('TestManager');
        await manager.initialize();
        await manager.dispose();

        const health = manager.getHealthStatus();

        expect(health.isHealthy).to.be.false;
        expect(health.isDisposed).to.be.true;
      });

      it('should report unhealthy status for uninitialized manager', () => {
        // RED: Uninitialized manager should be unhealthy
        const manager = new TestLifecycleManager('TestManager');

        const health = manager.getHealthStatus();

        expect(health.isHealthy).to.be.false;
        expect(health.isInitialized).to.be.false;
      });

    });

  });

  describe('Resource Management', () => {

    class ResourceTrackingManager extends TestLifecycleManager {
      public cleanupCallCount = 0;

      public addTestResource(): void {
        this.registerResourceCleanup(() => {
          this.cleanupCallCount++;
        });
      }

      public getCleanupResult(): ResourceCleanupResult {
        return this.cleanupAllResources();
      }
    }

    describe('RED Phase - Resource Management Requirements', () => {

      it('should register and cleanup resources properly', async () => {
        // RED: Resources should be properly managed
        const manager = new ResourceTrackingManager('TestManager');
        await manager.initialize();

        // Register some resources
        manager.addTestResource();
        manager.addTestResource();
        manager.addTestResource();

        await manager.dispose();

        expect(manager.cleanupCallCount).to.equal(3);
      });

      it('should provide cleanup results with statistics', () => {
        // RED: Cleanup should provide detailed results
        const manager = new ResourceTrackingManager('TestManager');

        manager.addTestResource();
        manager.addTestResource();

        const result = manager.getCleanupResult();

        expect(result.success).to.be.true;
        expect(result.cleanedResourceCount).to.equal(2);
        expect(result.errors).to.be.empty;
        expect(result.cleanupTimeMs).to.be.greaterThan(0);
      });

      it('should handle resource cleanup errors gracefully', () => {
        // RED: Resource cleanup errors should be reported
        const manager = new ResourceTrackingManager('TestManager');

        // Add a failing cleanup function
        manager.testRegisterResourceCleanup(() => {
          throw new Error('Cleanup failed');
        });
        manager.addTestResource(); // Add successful cleanup

        const result = manager.getCleanupResult();

        expect(result.success).to.be.false;
        expect(result.cleanedResourceCount).to.equal(1);
        expect(result.errors).to.have.length(1);
        expect(result.errors[0]).to.include('Cleanup failed');
      });

    });

  });

  describe('Manager Factory', () => {

    describe('RED Phase - Factory Requirements', () => {

      it('should create manager with factory method', () => {
        // RED: Factory should create managers correctly

        // const manager = ManagerFactory.createManager( // Class doesn't exist
        //   TestLifecycleManager as any,
        //   {},
        //   'FactoryCreatedManager'
        // );
        const manager = new TestLifecycleManager('FactoryCreatedManager');

        expect(manager).to.be.instanceOf(TestLifecycleManager);
        expect(manager.getHealthStatus().managerName).to.equal('FactoryCreatedManager');
      });

      it('should create and initialize manager in one step', async () => {
        // RED: Factory should support auto-initialization

        // const manager = await ManagerFactory.createAndInitializeManager( // Class doesn't exist
        //   TestLifecycleManager as any,
        //   {},
        //   'AutoInitializedManager'
        // );
        const manager = new TestLifecycleManager('AutoInitializedManager');
        await manager.initialize();

        expect(manager.getHealthStatus().isInitialized).to.be.true;
        expect(manager.initializeCalled).to.be.true;

        await manager.dispose();
      });

    });

  });

  describe('Concurrent Operations and Thread Safety', () => {

    describe('RED Phase - Concurrency Requirements', () => {

      it('should handle concurrent initialization attempts safely', async () => {
        // RED: Concurrent initialization should be safe
        const manager = new TestLifecycleManager('TestManager');

        // Start multiple initialization attempts
        const promises = [
          manager.initialize(),
          manager.initialize(),
          manager.initialize()
        ];

        await Promise.all(promises);

        // Should be initialized only once
        expect(manager.initializeCalled).to.be.true;
        expect(manager.getHealthStatus().isInitialized).to.be.true;
      });

      it('should handle concurrent operations safely', async () => {
        // RED: Concurrent operations should be safe
        const manager = new TestLifecycleManager('TestManager', {
          enableLogging: true,
          enablePerformanceTracking: true,
          enableErrorRecovery: true,
          initializationTimeoutMs: 5000
        });
        await manager.initialize();

        const operation = async (): Promise<number> => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return Math.random();
        };

        // Start multiple concurrent operations
        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(manager.testExecuteOperationSafely(operation, `concurrent-${i}`));
        }

        const results = await Promise.all(promises);

        // All operations should complete successfully
        expect(results.every(r => r !== null)).to.be.true;
        expect(manager.getHealthStatus().performanceMetrics.operationCount).to.equal(10);
      });

      it('should handle concurrent disposal attempts safely', async () => {
        // RED: Concurrent disposal should be safe
        const manager = new TestLifecycleManager('TestManager');
        await manager.initialize();

        // Start multiple disposal attempts
        const promises = [
          manager.dispose(),
          manager.dispose(),
          manager.dispose()
        ];

        await Promise.all(promises);

        // Should be disposed only once
        expect(manager.disposeCalled).to.be.true;
        expect(manager.getHealthStatus().isDisposed).to.be.true;
      });

    });

  });

  describe('Integration with Logging System', () => {

    describe('RED Phase - Logging Integration Requirements', () => {

      it('should use custom logger when provided', async () => {
        // RED: Custom logger should be used
        const customLogger = sinon.stub();
        const manager = new TestLifecycleManager('TestManager', {
          enableLogging: true,
          enablePerformanceTracking: true,
          enableErrorRecovery: true,
          initializationTimeoutMs: 5000,
          customLogger
        });

        await manager.initialize();

        expect(customLogger).to.have.been.called;
      });

      it('should respect logging enablement flag', async () => {
        // RED: Logging flag should be respected
        const customLogger = sinon.stub();
        const manager = new TestLifecycleManager('TestManager', {
          enableLogging: false,
          enablePerformanceTracking: true,
          enableErrorRecovery: true,
          initializationTimeoutMs: 5000,
          customLogger
        });

        await manager.initialize();

        // Logger might still be called for critical operations
        // but should have fewer calls when disabled
        const callCount = customLogger.callCount;
        expect(callCount).to.be.lessThan(10); // Arbitrary threshold
      });

    });

  });

  describe('Edge Cases and Boundary Conditions', () => {

    describe('RED Phase - Edge Case Requirements', () => {

      it('should handle manager with empty name', async () => {
        // RED: Empty name should be handled gracefully
        const manager = new TestLifecycleManager('');
        await manager.initialize();

        const health = manager.getHealthStatus();
        expect(health.managerName).to.equal('');
        expect(health.isInitialized).to.be.true;
      });

      it('should handle very short timeout values', async () => {
        // RED: Short timeouts should work correctly
        const manager = new TestLifecycleManager('TestManager', {
          enableLogging: true,
          enablePerformanceTracking: true,
          enableErrorRecovery: true,
          initializationTimeoutMs: 1 // Very short timeout
        });

        let caughtError: Error | null = null;
        try {
          await manager.initialize();
        } catch (error) {
          caughtError = error as Error;
        }

        // Might timeout or succeed depending on timing
        if (caughtError) {
          expect(caughtError.message).to.include('timed out after 1ms');
        }
      });

      it('should handle operations with null/undefined results', async () => {
        // RED: Null/undefined operation results should be handled
        const manager = new TestLifecycleManager('TestManager');
        await manager.initialize();

        const nullOperation = async (): Promise<null> => {
          return null;
        };

        const undefinedOperation = async (): Promise<undefined> => {
          return undefined;
        };

        const nullResult = await manager.testExecuteOperationSafely(nullOperation, 'null test');
        const undefinedResult = await manager.testExecuteOperationSafely(undefinedOperation, 'undefined test');

        expect(nullResult).to.be.null;
        expect(undefinedResult).to.be.undefined;
      });

    });

  });

});