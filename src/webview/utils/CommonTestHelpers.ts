/**
 * Common Test Helpers - Unified testing utilities and patterns
 * Reduces code duplication across test files
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import type { IManagerCoordinator } from '../interfaces/ManagerInterfaces';

/**
 * Standard mock coordinator factory
 */
export function createMockCoordinator(): sinon.SinonStubbedInstance<IManagerCoordinator> {
  return {
    // Terminal management
    updateActiveTerminal: sinon.stub(),
    updateTerminalState: sinon.stub(),
    createNewTerminal: sinon.stub(),
    deleteTerminal: sinon.stub(),
    switchToTerminal: sinon.stub(),
    resizeTerminal: sinon.stub(),
    clearTerminal: sinon.stub(),

    // Terminal data management
    sendInputToTerminal: sinon.stub(),
    sendDataToTerminal: sinon.stub(),
    writeToTerminal: sinon.stub(),

    // Split management
    splitTerminal: sinon.stub(),
    updateSplitLayout: sinon.stub(),
    getSplitDirection: sinon.stub().returns('horizontal'),

    // CLI Agent management
    updateCliAgentStatus: sinon.stub(),
    toggleCliAgentConnection: sinon.stub(),

    // UI management
    showNotification: sinon.stub(),
    hideNotification: sinon.stub(),
    updateUITheme: sinon.stub(),
    updateTerminalBorders: sinon.stub(),
    updateUIControls: sinon.stub(),

    // Configuration
    updateSettings: sinon.stub(),
    saveConfiguration: sinon.stub(),

    // State queries
    getActiveTerminalId: sinon.stub().returns('test-terminal'),
    getAllTerminals: sinon.stub().returns(new Map()),
    getTerminalCount: sinon.stub().returns(1),

    // Performance
    debounceUpdate: sinon.stub(),
    scheduleUpdate: sinon.stub(),

    // Lifecycle
    initialize: sinon.stub().resolves(),
    dispose: sinon.stub(),

    // Additional coordinator methods
    setActiveTerminalId: sinon.stub(),
    getTerminalInstance: sinon.stub(),
    getAllTerminalInstances: sinon.stub().returns(new Map()),
    getAllTerminalContainers: sinon.stub().returns(new Map()),
    postMessageToExtension: sinon.stub(),
    onTerminalOutput: sinon.stub(),
    focusTerminal: sinon.stub(),
    addTerminal: sinon.stub(),
    removeTerminal: sinon.stub(),
    updateTerminalTheme: sinon.stub(),
    updateTerminalFont: sinon.stub(),
  } as sinon.SinonStubbedInstance<IManagerCoordinator>;
}

/**
 * Standard test setup for manager tests
 */
export interface ManagerTestSetup<T> {
  manager: T;
  coordinator: sinon.SinonStubbedInstance<IManagerCoordinator>;
  sandbox: sinon.SinonSandbox;
}

export function setupManagerTest<T extends Record<string, any>>(
  ManagerClass: new () => T,
  initializeManager: (
    manager: T,
    coordinator: sinon.SinonStubbedInstance<IManagerCoordinator>
  ) => Promise<void> = async () => {}
): ManagerTestSetup<T> {
  const sandbox = sinon.createSandbox();
  const coordinator = createMockCoordinator();
  const manager = new ManagerClass();

  // Initialize if the manager has the method
  if ('initialize' in manager && typeof (manager as any).initialize === 'function') {
    initializeManager(manager, coordinator);
  }

  return { manager, coordinator, sandbox };
}

/**
 * Standard cleanup for manager tests
 */
export function cleanupManagerTest<T extends Record<string, any>>(
  setup: ManagerTestSetup<T>
): void {
  if ('dispose' in setup.manager && typeof (setup.manager as any).dispose === 'function') {
    (setup.manager as any).dispose();
  }
  setup.sandbox.restore();
}

/**
 * Common test patterns and assertions
 */
export class TestPatterns {
  /**
   * Test that manager properly initializes
   */
  static testManagerInitialization<T extends Record<string, any>>(
    manager: T,
    coordinator: sinon.SinonStubbedInstance<IManagerCoordinator>
  ): void {
    if ('getStatus' in manager && typeof (manager as any).getStatus === 'function') {
      const status = (manager as any).getStatus();
      expect(status.isInitialized).to.be.true;
      expect(status.hasCoordinator).to.be.true;
    }
  }

  /**
   * Test that manager properly disposes
   */
  static testManagerDisposal<T extends Record<string, any>>(manager: T): void {
    if ('dispose' in manager && typeof (manager as any).dispose === 'function') {
      (manager as any).dispose();

      if ('getStatus' in manager && typeof (manager as any).getStatus === 'function') {
        const status = (manager as any).getStatus();
        expect(status.isDisposed).to.be.true;
        expect(status.activeTimers).to.equal(0);
      }
    }
  }

  /**
   * Test error handling patterns
   */
  static testErrorHandling<T extends Record<string, any>>(
    manager: T,
    errorOperation: () => void,
    expectedErrorMessage?: string
  ): void {
    let errorCaught = false;
    try {
      errorOperation();
    } catch (error) {
      errorCaught = true;
      if (expectedErrorMessage) {
        expect((error as Error).message).to.include(expectedErrorMessage);
      }
    }
    expect(errorCaught).to.be.true;
  }

  /**
   * Test performance patterns (debouncing, caching)
   */
  static testPerformancePattern(
    operation: () => void,
    times: number,
    expectedCallCount: number,
    stub: sinon.SinonStub
  ): void {
    // Reset call count
    stub.resetHistory();

    // Call operation multiple times
    for (let i = 0; i < times; i++) {
      operation();
    }

    // Check if debouncing/caching worked
    expect(stub.callCount).to.equal(expectedCallCount);
  }
}

/**
 * DOM test utilities
 */
export class DOMTestUtils {
  /**
   * Setup DOM environment for testing
   */
  static setupDOM(): void {
    // Create basic DOM structure if not exists
    if (!document.getElementById('terminal-container')) {
      const container = document.createElement('div');
      container.id = 'terminal-container';
      document.body.appendChild(container);
    }

    if (!document.getElementById('terminal-body')) {
      const body = document.createElement('div');
      body.id = 'terminal-body';
      document.body.appendChild(body);
    }
  }

  /**
   * Cleanup DOM after tests
   */
  static cleanupDOM(): void {
    document
      .querySelectorAll('[id^="terminal-"], [class*="terminal"]')
      .forEach((el) => el.remove());
  }

  /**
   * Create mock terminal element
   */
  static createMockTerminal(terminalId: string): HTMLElement {
    const element = document.createElement('div');
    element.className = 'terminal-instance';
    element.id = `terminal-${terminalId}`;
    element.setAttribute('data-terminal-id', terminalId);
    return element;
  }

  /**
   * Create mock message event
   */
  static createMockMessageEvent(data: any): MessageEvent {
    return new MessageEvent('message', {
      data,
      origin: 'vscode-webview',
      source: window,
    });
  }
}

/**
 * Async test utilities
 */
export class AsyncTestUtils {
  /**
   * Wait for condition to be true
   */
  static async waitFor(
    condition: () => boolean,
    timeout: number = 1000,
    interval: number = 10
  ): Promise<void> {
    const start = Date.now();

    while (!condition() && Date.now() - start < timeout) {
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  }

  /**
   * Test async operation with timeout
   */
  static async testAsyncOperation<T>(
    operation: () => Promise<T>,
    timeout: number = 1000
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeout)
      ),
    ]);
  }
}

/**
 * Performance test utilities
 */
export class PerformanceTestUtils {
  /**
   * Measure execution time of operation
   */
  static measureTime<T>(operation: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = operation();
    const duration = performance.now() - start;
    return { result, duration };
  }

  /**
   * Test memory usage patterns
   */
  static testMemoryUsage<T extends { dispose?: () => void }>(
    createInstance: () => T,
    iterations: number = 100
  ): void {
    const instances: T[] = [];

    // Create instances
    for (let i = 0; i < iterations; i++) {
      instances.push(createInstance());
    }

    // Dispose all instances
    instances.forEach((instance) => {
      if (instance.dispose) {
        instance.dispose();
      }
    });

    // Force garbage collection if available
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
  }
}
