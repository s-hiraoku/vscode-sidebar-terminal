import * as sinon from 'sinon';
import { VSCodeMockFactory, VSCodeMocks } from '../fixtures/vscode-mocks';

/**
 * Base test class providing common test infrastructure
 *
 * Features:
 * - Automatic sinon sandbox creation and cleanup
 * - VS Code mock setup and teardown
 * - Common assertion helpers
 * - Lifecycle hooks for setup and teardown
 *
 * Usage:
 * ```typescript
 * class MyTest extends BaseTest {
 *   protected setup(): void {
 *     // Custom setup logic
 *   }
 *
 *   protected teardown(): void {
 *     // Custom teardown logic
 *   }
 * }
 *
 * describe('My Feature', () => {
 *   const test = new MyTest();
 *
 *   beforeEach(() => test.beforeEach());
 *   afterEach(() => test.afterEach());
 *
 *   it('should work', () => {
 *     // Use test.sandbox, test.vscode
 *   });
 * });
 * ```
 */
export abstract class BaseTest {
  public sandbox!: sinon.SinonSandbox;
  public vscode!: VSCodeMocks;
  public logSpy!: sinon.SinonStub;

  /**
   * Called before each test
   * Sets up sandbox and VS Code mocks
   */
  public beforeEach(): void {
    this.sandbox = sinon.createSandbox();
    this.vscode = VSCodeMockFactory.setupGlobalMock(this.sandbox);
    this.logSpy = this.sandbox.stub(console, 'log');

    // Call custom setup hook
    this.setup();
  }

  /**
   * Called after each test
   * Restores all stubs and clears state
   */
  public afterEach(): void {
    // Call custom teardown hook
    this.teardown();

    // Restore sandbox
    this.sandbox.restore();
  }

  /**
   * Custom setup logic - override in subclasses
   */
  protected setup(): void {
    // Override in subclasses
  }

  /**
   * Custom teardown logic - override in subclasses
   */
  protected teardown(): void {
    // Override in subclasses
  }

  /**
   * Configure VS Code configuration defaults
   */
  protected configureDefaults<T extends Record<string, unknown>>(defaults: T): void {
    VSCodeMockFactory.configureDefaults(this.vscode.configuration, defaults);
  }

  /**
   * Stub a method on an object
   */
  protected stub<T extends object, K extends keyof T>(object: T, method: K): sinon.SinonStub {
    return this.sandbox.stub(object, method as keyof T);
  }

  /**
   * Create a spy on a method
   */
  protected spy<T extends object, K extends keyof T>(object: T, method: K): sinon.SinonSpy {
    return this.sandbox.spy(object, method as keyof T);
  }

  /**
   * Create a fake object with partial implementation
   */
  protected fake<T>(partial: Partial<T> = {}): T {
    return partial as T;
  }

  /**
   * Wait for a condition to be true
   */
  protected async waitFor(
    condition: () => boolean,
    timeout: number = 1000,
    interval: number = 10
  ): Promise<void> {
    const startTime = Date.now();

    while (!condition()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for condition');
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  /**
   * Wait for an async operation to complete
   */
  protected async waitForAsync<T>(operation: () => Promise<T>, timeout: number = 1000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Async operation timeout'));
      }, timeout);

      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Assert that a stub was called with specific arguments
   */
  protected assertCalledWith<T extends sinon.SinonStub>(stub: T, ...args: unknown[]): void {
    if (!stub.calledWith(...args)) {
      throw new Error(
        `Expected stub to be called with ${JSON.stringify(args)}, ` +
          `but it was called with ${JSON.stringify(stub.args)}`
      );
    }
  }

  /**
   * Assert that a stub was called exactly N times
   */
  protected assertCallCount<T extends sinon.SinonStub>(stub: T, count: number): void {
    if (stub.callCount !== count) {
      throw new Error(
        `Expected stub to be called ${count} times, ` + `but it was called ${stub.callCount} times`
      );
    }
  }

  /**
   * Reset a specific stub
   */
  protected resetStub<T extends sinon.SinonStub>(stub: T): void {
    stub.resetHistory();
    stub.resetBehavior();
  }

  /**
   * Reset all stubs in sandbox
   */
  protected resetAllStubs(): void {
    this.sandbox.resetHistory();
    this.sandbox.resetBehavior();
  }
}
