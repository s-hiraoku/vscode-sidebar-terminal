/**
 * Test Helper Utilities
 *
 * Common utilities and helpers for writing tests
 */

import * as sinon from 'sinon';

/**
 * Creates a typed stub for better IntelliSense support
 */
export function createTypedStub<T extends object, K extends keyof T>(
  sandbox: sinon.SinonSandbox,
  object: T,
  method: K
): sinon.SinonStub {
  return sandbox.stub(object, method as any);
}

/**
 * Creates a partial mock object with type safety
 */
export function createMock<T>(partial: Partial<T> = {}): T {
  return partial as T;
}

/**
 * Creates a stub that resolves to a value
 */
export function createResolveStub<T>(sandbox: sinon.SinonSandbox, value: T): sinon.SinonStub {
  return sandbox.stub().resolves(value);
}

/**
 * Creates a stub that rejects with an error
 */
export function createRejectStub(sandbox: sinon.SinonSandbox, error: Error): sinon.SinonStub {
  return sandbox.stub().rejects(error);
}

/**
 * Waits for a condition to be true with timeout
 */
export async function waitFor(
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
 * Creates a delay promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Captures all calls to a stub and returns the arguments
 */
export function captureStubCalls<T extends any[]>(stub: sinon.SinonStub): T[] {
  return stub.getCalls().map((call) => call.args as T);
}

/**
 * Resets all stubs in an object
 */
export function resetAllStubs(obj: any): void {
  Object.values(obj).forEach((value) => {
    if (
      value &&
      typeof value === 'object' &&
      'reset' in value &&
      typeof value.reset === 'function'
    ) {
      value.reset();
    }
  });
}

/**
 * Creates a spy that tracks calls but doesn't replace the original function
 */
export function createSpy<T extends (...args: any[]) => any>(
  sandbox: sinon.SinonSandbox,
  fn: T
): sinon.SinonSpy<Parameters<T>, ReturnType<T>> {
  return sandbox.spy(fn);
}

/**
 * Asserts that a stub was called with specific arguments
 */
export function assertStubCalledWith(stub: sinon.SinonStub, ...args: any[]): void {
  const calls = stub.getCalls();
  const found = calls.some((call) => args.every((arg, index) => call.args[index] === arg));

  if (!found) {
    throw new Error(
      `Expected stub to be called with ${JSON.stringify(args)}, but it was called with: ${calls.map((c) => JSON.stringify(c.args)).join(', ')}`
    );
  }
}

/**
 * Asserts that a stub was called a specific number of times
 */
export function assertStubCallCount(stub: sinon.SinonStub, expectedCount: number): void {
  const actualCount = stub.callCount;
  if (actualCount !== expectedCount) {
    throw new Error(
      `Expected stub to be called ${expectedCount} times, but was called ${actualCount} times`
    );
  }
}
