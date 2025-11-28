import { BaseTest } from './BaseTest';
import * as sinon from 'sinon';

/**
 * Specialized base class for async operation testing
 *
 * Features:
 * - Fake timers for time-based testing
 * - Promise tracking and resolution helpers
 * - Async operation race condition testing
 * - Timeout and retry helpers
 *
 * Usage:
 * ```typescript
 * class MyAsyncTest extends AsyncTest {
 *   protected useFakeTimers = true; // Enable fake timers
 * }
 * ```
 */
export abstract class AsyncTest extends BaseTest {
  protected clock!: sinon.SinonFakeTimers;
  protected useFakeTimers: boolean = false;
  protected pendingPromises: Set<Promise<unknown>> = new Set();

  protected override setup(): void {
    super.setup();

    if (this.useFakeTimers) {
      this.clock = sinon.useFakeTimers();
    }
  }

  protected override teardown(): void {
    if (this.clock) {
      this.clock.restore();
    }
    this.pendingPromises.clear();
    super.teardown();
  }

  /**
   * Advance fake timers by specified milliseconds
   */
  protected async tick(ms: number): Promise<void> {
    if (!this.clock) {
      throw new Error('Fake timers not enabled. Set useFakeTimers = true');
    }

    await this.clock.tickAsync(ms);
  }

  /**
   * Advance fake timers to next scheduled timer
   */
  protected async tickNext(): Promise<void> {
    if (!this.clock) {
      throw new Error('Fake timers not enabled. Set useFakeTimers = true');
    }

    await this.clock.nextAsync();
  }

  /**
   * Run all pending timers
   */
  protected async tickAll(): Promise<void> {
    if (!this.clock) {
      throw new Error('Fake timers not enabled. Set useFakeTimers = true');
    }

    await this.clock.runAllAsync();
  }

  /**
   * Track a promise for later resolution checking
   */
  protected track<T>(promise: Promise<T>): Promise<T> {
    this.pendingPromises.add(promise);

    promise
      .then(() => {
        this.pendingPromises.delete(promise);
      })
      .catch(() => {
        this.pendingPromises.delete(promise);
      });

    return promise;
  }

  /**
   * Check if any tracked promises are still pending
   */
  protected hasPendingPromises(): boolean {
    return this.pendingPromises.size > 0;
  }

  /**
   * Wait for all tracked promises to resolve
   */
  protected async waitForAllPromises(timeout: number = 1000): Promise<void> {
    const startTime = Date.now();

    while (this.pendingPromises.size > 0) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for ${this.pendingPromises.size} pending promises`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /**
   * Create a deferred promise with manual resolution/rejection
   */
  protected createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
  } {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve, reject };
  }

  /**
   * Wait for a promise to be rejected
   */
  protected async expectRejection<T>(
    promise: Promise<T>,
    expectedError?: string | RegExp
  ): Promise<Error> {
    try {
      await promise;
      throw new Error('Expected promise to be rejected, but it resolved');
    } catch (error) {
      if (expectedError) {
        const message = (error as Error).message;
        if (typeof expectedError === 'string') {
          if (!message.includes(expectedError)) {
            throw new Error(
              `Expected error message to include "${expectedError}", ` + `but got "${message}"`
            );
          }
        } else {
          if (!expectedError.test(message)) {
            throw new Error(
              `Expected error message to match ${expectedError}, ` + `but got "${message}"`
            );
          }
        }
      }
      return error as Error;
    }
  }

  /**
   * Wait for a promise to resolve within timeout
   */
  protected async expectResolution<T>(promise: Promise<T>, timeout: number = 1000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Promise did not resolve within ${timeout}ms`));
      }, timeout);

      promise
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
   * Test race condition by running operations concurrently
   */
  protected async testRaceCondition<T>(operations: Array<() => Promise<T>>): Promise<T[]> {
    const promises = operations.map((op) => op());
    return Promise.all(promises);
  }

  /**
   * Simulate network delay
   */
  protected async delay(ms: number): Promise<void> {
    if (this.clock) {
      await this.tick(ms);
    } else {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  /**
   * Stub async method with controlled resolution
   */
  protected stubAsync<T extends object, K extends keyof T>(
    object: T,
    method: K,
    resolveWith?: unknown,
    rejectWith?: Error
  ): sinon.SinonStub {
    const stub = this.stub(object, method);

    if (rejectWith) {
      stub.rejects(rejectWith);
    } else {
      stub.resolves(resolveWith);
    }

    return stub;
  }

  /**
   * Create a stub that resolves after a delay
   */
  protected stubAsyncWithDelay<T extends object, K extends keyof T>(
    object: T,
    method: K,
    delay: number,
    resolveWith?: unknown
  ): sinon.SinonStub {
    const stub = this.stub(object, method);

    stub.callsFake(async () => {
      await this.delay(delay);
      return resolveWith;
    });

    return stub;
  }

  /**
   * Test retry logic
   */
  protected async testRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    expectedFailures: number
  ): Promise<{ result?: T; attempts: number; errors: Error[] }> {
    const errors: Error[] = [];
    let attempts = 0;
    let result: T | undefined;

    for (let i = 0; i <= maxRetries; i++) {
      attempts++;
      try {
        result = await operation();
        break;
      } catch (error) {
        errors.push(error as Error);
        if (i === maxRetries) {
          throw error;
        }
      }
    }

    if (errors.length !== expectedFailures) {
      throw new Error(`Expected ${expectedFailures} failures, but got ${errors.length}`);
    }

    return { result, attempts, errors };
  }

  /**
   * Wait for a specific number of calls to a stub
   */
  protected async waitForCalls(
    stub: sinon.SinonStub,
    count: number,
    timeout: number = 1000
  ): Promise<void> {
    const startTime = Date.now();

    while (stub.callCount < count) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for ${count} calls. Got ${stub.callCount} calls`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}
