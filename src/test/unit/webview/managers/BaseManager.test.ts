/**
 * BaseManager Test Suite
 * Tests the base functionality for all WebView managers
 */

import { expect } from 'chai';
import sinon from 'sinon';
import { setupTestEnvironment, cleanupTestEnvironment } from '../../../utils/CommonTestSetup';
import { BaseManager } from '../../../../webview/managers/BaseManager';
import { IManagerCoordinator } from '../../../../webview/interfaces/ManagerInterfaces';

// Test implementation of BaseManager
class TestManager extends BaseManager {
  private _testProperty = 'initial';

  constructor(options: any = {}) {
    super('TestManager', options);
  }

  public async initialize(): Promise<void> {
    this.log('Initializing TestManager');
    this.isInitialized = true;
  }

  public override dispose(): void {
    this.log('Disposing TestManager');
    this.isDisposed = true;
  }

  // Test methods to expose protected functionality
  public testLog(message: string, level?: 'info' | 'warn' | 'error'): void {
    this.log(message, level);
  }

  public testDebounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    return this.debounce(func, wait);
  }

  public testSafeDOMOperation(operation: () => void): boolean {
    return this.safeDOMOperation(operation);
  }

  public getTestProperty(): string {
    return this._testProperty;
  }

  public setTestProperty(value: string): void {
    this._testProperty = value;
  }

  // Expose protected properties for testing
  public get testIsInitialized(): boolean { return this.isInitialized; }
  public get testIsDisposed(): boolean { return this.isDisposed; }
  public get testLoggingEnabled(): boolean { return this.loggingEnabled; }
  public set testLoggingEnabled(value: boolean) { this.loggingEnabled = value; }
}

describe('BaseManager', () => {
  let testEnv: any;
  let mockCoordinator: sinon.SinonStubbedInstance<IManagerCoordinator>;
  let testManager: TestManager;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    testEnv = setupTestEnvironment();

    // Create mock coordinator
    mockCoordinator = {
      postMessage: sandbox.stub(),
      getSettings: sandbox.stub(),
      updateSetting: sandbox.stub(),
      showNotification: sandbox.stub(),
      hideNotification: sandbox.stub(),
      log: sandbox.stub(),
      reportError: sandbox.stub(),
      isVSCodeReady: sandbox.stub().returns(true),
      getTheme: sandbox.stub().returns('dark'),
    } as any;

    testManager = new TestManager();
  });

  afterEach(() => {
    if (testManager && !testManager.testIsDisposed) {
      testManager.dispose();
    }
    cleanupTestEnvironment(testEnv);
    sandbox.restore();
  });

  describe('Initialization', () => {
    it('should initialize with correct default state', () => {
      expect(testManager.testIsInitialized).to.be.false;
      expect(testManager.testIsDisposed).to.be.false;
      expect(testManager.testLoggingEnabled).to.be.true;
    });

    it('should become initialized after initialize() call', async () => {
      await testManager.initialize();
      expect(testManager.testIsInitialized).to.be.true;
      expect(testManager.testIsDisposed).to.be.false;
    });

    it('should not allow double initialization', async () => {
      await testManager.initialize();
      expect(testManager.testIsInitialized).to.be.true;

      // Second initialization should not change state
      await testManager.initialize();
      expect(testManager.testIsInitialized).to.be.true;
    });
  });

  describe('Disposal', () => {
    it('should dispose correctly', async () => {
      await testManager.initialize();
      testManager.dispose();

      expect(testManager.testIsDisposed).to.be.true;
      expect(testManager.testIsInitialized).to.be.false;
    });

    it('should be safe to dispose multiple times', async () => {
      await testManager.initialize();
      testManager.dispose();
      testManager.dispose(); // Should not throw

      expect(testManager.testIsDisposed).to.be.true;
    });

    it('should dispose uninitialized manager safely', () => {
      testManager.dispose(); // Should not throw
      expect(testManager.testIsDisposed).to.be.true;
    });
  });

  describe('Logging', () => {
    it('should log info messages by default', () => {
      const consoleSpy = sandbox.spy(console, 'log');
      testManager.testLog('Test message');

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[TestManager]');
      expect(consoleSpy.firstCall.args[0]).to.include('Test message');
    });

    it('should log warn messages with warning prefix', () => {
      const consoleSpy = sandbox.spy(console, 'log');
      testManager.testLog('Warning message', 'warn');

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('⚠️');
      expect(consoleSpy.firstCall.args[0]).to.include('Warning message');
    });

    it('should log error messages with error prefix', () => {
      const consoleSpy = sandbox.spy(console, 'log');
      testManager.testLog('Error message', 'error');

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('❌');
      expect(consoleSpy.firstCall.args[0]).to.include('Error message');
    });

    it('should not log when logging is disabled', () => {
      const consoleSpy = sandbox.spy(console, 'log');
      testManager.testLoggingEnabled = false;
      testManager.testLog('Should not be logged');

      expect(consoleSpy.called).to.be.false;
    });
  });

  describe('Debounce Utility', () => {
    it('should debounce function calls', (done) => {
      const testFunction = sandbox.spy();
      const debouncedFunction = testManager.testDebounce(testFunction, 50);

      // Call multiple times quickly
      debouncedFunction('arg1');
      debouncedFunction('arg2');
      debouncedFunction('arg3');

      // Should not be called immediately
      expect(testFunction.called).to.be.false;

      // Should be called once after delay with last arguments
      setTimeout(() => {
        expect(testFunction.calledOnce).to.be.true;
        expect(testFunction.firstCall.args[0]).to.equal('arg3');
        done();
      }, 100);
    });

    it('should handle rapid successive calls correctly', (done) => {
      let callCount = 0;
      const testFunction = () => {
        callCount++;
      };
      const debouncedFunction = testManager.testDebounce(testFunction, 30);

      // Call multiple times with delays
      debouncedFunction();
      setTimeout(() => debouncedFunction(), 10);
      setTimeout(() => debouncedFunction(), 20);

      setTimeout(() => {
        expect(callCount).to.equal(1);
        done();
      }, 80);
    });
  });

  describe('Safe DOM Operations', () => {
    it('should execute DOM operation safely when successful', () => {
      const operation = sandbox.spy();
      const result = testManager.testSafeDOMOperation(operation);

      expect(result).to.be.true;
      expect(operation.calledOnce).to.be.true;
    });

    it('should handle DOM operation errors gracefully', () => {
      const operation = sandbox.stub().throws(new Error('DOM Error'));
      const consoleSpy = sandbox.spy(console, 'log');
      const result = testManager.testSafeDOMOperation(operation);

      expect(result).to.be.false;
      expect(operation.calledOnce).to.be.true;
      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('❌');
      expect(consoleSpy.firstCall.args[0]).to.include('DOM Error');
    });
  });

  describe('Status and Debugging', () => {
    it('should provide accurate status information', async () => {
      const initialStatus = testManager.getStatus();
      expect(initialStatus.isInitialized).to.be.false;
      expect(initialStatus.isDisposed).to.be.false;
      expect(initialStatus.managerName).to.equal('[TestManager]');
      expect(initialStatus.loggingEnabled).to.be.true;

      await testManager.initialize();
      const initializedStatus = testManager.getStatus();
      expect(initializedStatus.isInitialized).to.be.true;
      expect(initializedStatus.isDisposed).to.be.false;

      testManager.dispose();
      const disposedStatus = testManager.getStatus();
      expect(disposedStatus.isInitialized).to.be.false;
      expect(disposedStatus.isDisposed).to.be.true;
    });

    it('should update logging state correctly', () => {
      testManager.testLoggingEnabled = false;
      const status = testManager.getStatus();
      expect(status.loggingEnabled).to.be.false;

      testManager.testLoggingEnabled = true;
      const updatedStatus = testManager.getStatus();
      expect(updatedStatus.loggingEnabled).to.be.true;
    });
  });

  describe('Lifecycle Integration', () => {
    it('should maintain state consistency through full lifecycle', async () => {
      // Initial state
      expect(testManager.testIsInitialized).to.be.false;
      expect(testManager.isDisposed).to.be.false;

      // Initialize
      await testManager.initialize();
      expect(testManager.testIsInitialized).to.be.true;
      expect(testManager.isDisposed).to.be.false;

      // Use functionality
      testManager.setTestProperty('updated');
      expect(testManager.getTestProperty()).to.equal('updated');

      // Dispose
      testManager.dispose();
      expect(testManager.testIsInitialized).to.be.false;
      expect(testManager.testIsDisposed).to.be.true;

      // Should still be able to access properties after disposal
      expect(testManager.getTestProperty()).to.equal('updated');
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      class FailingManager extends BaseManager {
        public testIsInitialized = false;
        public testIsDisposed = false;
        
        constructor() {
          super('FailingManager');
        }

        public async initialize(): Promise<void> {
          throw new Error('Initialization failed');
        }

        public override dispose(): void {
          this.testIsDisposed = true;
        }
      }

      const failingManager = new FailingManager();

      try {
        await failingManager.initialize();
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal('Initialization failed');
        expect(failingManager.testIsInitialized).to.be.false;
      } finally {
        failingManager.dispose();
      }
    });
  });
});
