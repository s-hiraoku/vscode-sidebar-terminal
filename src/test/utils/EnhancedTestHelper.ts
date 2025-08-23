/**
 * Enhanced Test Helper - Consolidates test setup patterns found across all test files
 *
 * This helper addresses the significant test code duplication identified in the analysis:
 * - Standardized JSDOM environment setup
 * - Common mock creation patterns
 * - Unified timer and event management
 * - Reusable manager testing utilities
 * - Consistent cleanup procedures
 */

import { expect } from 'chai';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import {
  IFullManagerCoordinator,
  IEnhancedBaseManager,
  ManagerDependencies,
  TerminalInstance,
} from '../../webview/interfaces/SegregatedManagerInterfaces';
import { DependencyContainer, ServiceType } from '../../webview/core/DependencyContainer';

/**
 * Test environment configuration
 */
export interface TestEnvironmentConfig {
  enableJSDOM?: boolean;
  enableFakeTimers?: boolean;
  enablePerformanceMonitoring?: boolean;
  jsdomOptions?: {
    url?: string;
    pretendToBeVisual?: boolean;
    resources?: string;
  };
}

/**
 * Mock coordinator configuration
 */
export interface MockCoordinatorConfig {
  activeTerminalId?: string;
  terminalInstances?: Map<string, TerminalInstance>;
  enableLogging?: boolean;
  throwOnMissingMethods?: boolean;
}

/**
 * Test manager creation options
 */
export interface TestManagerOptions<_T> {
  dependencies?: Partial<ManagerDependencies>;
  initializeImmediately?: boolean;
  enableValidation?: boolean;
  enableErrorRecovery?: boolean;
  enablePerformanceMonitoring?: boolean;
}

/**
 * Enhanced test helper that consolidates common testing patterns
 */
export class EnhancedTestHelper {
  private jsdom?: JSDOM;
  private clock?: sinon.SinonFakeTimers;
  private sandbox: sinon.SinonSandbox;
  private dependencyContainer: DependencyContainer;
  private mockCoordinator?: sinon.SinonStubbedInstance<IFullManagerCoordinator>;
  private config: Required<TestEnvironmentConfig>;
  private cleanupTasks: Array<() => void | Promise<void>> = [];

  constructor(config: TestEnvironmentConfig = {}) {
    this.config = {
      enableJSDOM: config.enableJSDOM ?? true,
      enableFakeTimers: config.enableFakeTimers ?? true,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring ?? false,
      jsdomOptions: {
        url: 'http://localhost',
        pretendToBeVisual: true,
        resources: 'usable',
        ...config.jsdomOptions,
      },
    };

    this.sandbox = sinon.createSandbox();
    this.dependencyContainer = new DependencyContainer();
  }

  // ============================================================================
  // ENVIRONMENT SETUP
  // ============================================================================

  /**
   * Setup complete test environment
   */
  public async setup(): Promise<void> {
    if (this.config.enableJSDOM) {
      this.setupJSDOMEnvironment();
    }

    if (this.config.enableFakeTimers) {
      this.setupFakeTimers();
    }

    this.setupMockCoordinator();
    await this.setupDependencyContainer();
  }

  /**
   * Setup JSDOM environment with all necessary globals
   */
  private setupJSDOMEnvironment(): void {
    this.jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      ...this.config.jsdomOptions,
      resources: this.config.jsdomOptions.resources as 'usable' | undefined
    });

    // Setup global DOM
    global.window = this.jsdom.window as any;
    global.document = this.jsdom.window.document;
    global.navigator = this.jsdom.window.navigator;
    global.location = this.jsdom.window.location;

    // Setup event constructors
    global.Event = this.jsdom.window.Event;
    global.CustomEvent = this.jsdom.window.CustomEvent;
    global.CompositionEvent = this.jsdom.window.CompositionEvent;
    global.KeyboardEvent = this.jsdom.window.KeyboardEvent;
    global.MouseEvent = this.jsdom.window.MouseEvent;
    global.FocusEvent = this.jsdom.window.FocusEvent;

    // Setup other APIs commonly used in tests
    global.ResizeObserver = this.createMockResizeObserver();
    global.IntersectionObserver = this.createMockIntersectionObserver();

    // Add cleanup task
    this.addCleanupTask(() => {
      if (this.jsdom) {
        this.jsdom.window.close();
      }
    });
  }

  /**
   * Setup fake timers for deterministic testing
   */
  private setupFakeTimers(): void {
    this.clock = sinon.useFakeTimers({
      shouldAdvanceTime: true,
      shouldClearNativeTimers: true,
    });

    // Add cleanup task
    this.addCleanupTask(() => {
      if (this.clock) {
        this.clock.restore();
      }
    });
  }

  /**
   * Setup mock coordinator with comprehensive stubbing
   */
  private setupMockCoordinator(config: MockCoordinatorConfig = {}): void {
    const defaultConfig: Required<MockCoordinatorConfig> = {
      activeTerminalId: 'terminal-1',
      terminalInstances: new Map(),
      enableLogging: false,
      throwOnMissingMethods: false,
      ...config,
    };

    // Create mock terminal instances if not provided
    if (defaultConfig.terminalInstances.size === 0) {
      for (let i = 1; i <= 3; i++) {
        const terminalId = `terminal-${i}`;
        defaultConfig.terminalInstances.set(
          terminalId,
          this.createMockTerminalInstance(terminalId)
        );
      }
    }

    this.mockCoordinator = {
      // Terminal Coordinator methods
      getActiveTerminalId: this.sandbox.stub().returns(defaultConfig.activeTerminalId),
      setActiveTerminalId: this.sandbox.stub(),
      getTerminalInstance: this.sandbox
        .stub()
        .callsFake((id: string) => defaultConfig.terminalInstances.get(id)),
      getAllTerminalInstances: this.sandbox.stub().returns(defaultConfig.terminalInstances),
      getAllTerminalContainers: this.sandbox.stub().returns(new Map()),
      getTerminalElement: this.sandbox.stub(),
      createTerminal: this.sandbox.stub().resolves(),
      closeTerminal: this.sandbox.stub(),
      writeToTerminal: this.sandbox.stub().returns(true),
      switchToTerminal: this.sandbox.stub().resolves(true),
      ensureTerminalFocus: this.sandbox.stub(),

      // Extension Communicator methods
      postMessageToExtension: this.sandbox.stub(),
      handleTerminalRemovedFromExtension: this.sandbox.stub(),
      updateState: this.sandbox.stub(),

      // Settings Coordinator methods
      applySettings: this.sandbox.stub(),
      applyFontSettings: this.sandbox.stub(),
      openSettings: this.sandbox.stub(),

      // CLI Agent Coordinator methods
      updateCliAgentStatus: this.sandbox.stub(),
      updateClaudeStatus: this.sandbox.stub(),

      // Session Coordinator methods
      createTerminalFromSession: this.sandbox.stub(),

      // Logging Coordinator methods
      log: defaultConfig.enableLogging ? this.sandbox.stub() : this.sandbox.stub(),

      // Manager Provider methods
      getManagers: this.sandbox.stub().returns({
        performance: this.createMockPerformanceManager(),
        input: this.createMockInputManager(),
        ui: this.createMockUIManager(),
        config: this.createMockConfigManager(),
        message: this.createMockMessageManager(),
        notification: this.createMockNotificationManager(),
      }),
    } as sinon.SinonStubbedInstance<IFullManagerCoordinator>;
  }

  /**
   * Setup dependency container with common services
   */
  private async setupDependencyContainer(): Promise<void> {
    // Register coordinator services
    if (this.mockCoordinator) {
      this.dependencyContainer.registerInstance(
        ServiceType.TERMINAL_COORDINATOR,
        this.mockCoordinator
      );
      this.dependencyContainer.registerInstance(
        ServiceType.EXTENSION_COMMUNICATOR,
        this.mockCoordinator
      );
      this.dependencyContainer.registerInstance(
        ServiceType.SETTINGS_COORDINATOR,
        this.mockCoordinator
      );
      this.dependencyContainer.registerInstance(
        ServiceType.CLI_AGENT_COORDINATOR,
        this.mockCoordinator
      );
      this.dependencyContainer.registerInstance(
        ServiceType.SESSION_COORDINATOR,
        this.mockCoordinator
      );
      this.dependencyContainer.registerInstance(
        ServiceType.LOGGING_COORDINATOR,
        this.mockCoordinator
      );
      this.dependencyContainer.registerInstance(ServiceType.MANAGER_PROVIDER, this.mockCoordinator);
    }

    // Add cleanup task
    this.addCleanupTask(() => this.dependencyContainer.dispose());
  }

  // ============================================================================
  // MOCK CREATION UTILITIES
  // ============================================================================

  /**
   * Create a mock terminal instance
   */
  private createMockTerminalInstance(id: string): TerminalInstance {
    const mockTerminal = {
      write: this.sandbox.stub(),
      focus: this.sandbox.stub(),
      blur: this.sandbox.stub(),
      onData: this.sandbox.stub(),
      onFocus: this.sandbox.stub(),
      onBlur: this.sandbox.stub(),
      hasSelection: this.sandbox.stub().returns(false),
      options: {},
    } as any;

    const mockFitAddon = {
      fit: this.sandbox.stub(),
      proposeDimensions: this.sandbox.stub().returns({ cols: 80, rows: 24 }),
    } as any;

    const mockContainer = this.createMockElement('div', { id: `container-${id}` });

    return {
      id,
      name: `Terminal ${id}`,
      number: parseInt(id.replace('terminal-', '')) || 1,
      terminal: mockTerminal,
      fitAddon: mockFitAddon,
      container: mockContainer,
      isActive: id === 'terminal-1',
    };
  }

  /**
   * Create mock DOM element
   */
  public createMockElement(tagName: string, attributes: Record<string, string> = {}): HTMLElement {
    if (this.jsdom) {
      const element = this.jsdom.window.document.createElement(tagName);
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
      return element as HTMLElement;
    }

    // Fallback mock for non-JSDOM environments
    const mockElement = {
      tagName: tagName.toUpperCase(),
      setAttribute: this.sandbox.stub(),
      getAttribute: this.sandbox.stub(),
      appendChild: this.sandbox.stub(),
      removeChild: this.sandbox.stub(),
      addEventListener: this.sandbox.stub(),
      removeEventListener: this.sandbox.stub(),
      style: {},
      classList: {
        add: this.sandbox.stub(),
        remove: this.sandbox.stub(),
        contains: this.sandbox.stub(),
        toggle: this.sandbox.stub(),
      },
      ...attributes,
    } as any;

    return mockElement;
  }

  /**
   * Create mock ResizeObserver
   */
  private createMockResizeObserver(): any {
    return class MockResizeObserver {
      observe = sinon.stub();
      unobserve = sinon.stub();
      disconnect = sinon.stub();
    };
  }

  /**
   * Create mock IntersectionObserver
   */
  private createMockIntersectionObserver(): any {
    return class MockIntersectionObserver {
      observe = sinon.stub();
      unobserve = sinon.stub();
      disconnect = sinon.stub();
    };
  }

  /**
   * Create mock manager implementations
   */
  private createMockPerformanceManager(): any {
    return {
      scheduleOutputBuffer: this.sandbox.stub(),
      bufferedWrite: this.sandbox.stub(),
      flushOutputBuffer: this.sandbox.stub(),
      debouncedResize: this.sandbox.stub(),
      setCliAgentMode: this.sandbox.stub(),
      getCliAgentMode: this.sandbox.stub().returns(false),
      getBufferStats: this.sandbox
        .stub()
        .returns({ bufferSize: 0, isFlushScheduled: false, currentTerminal: true }),
      forceFlush: this.sandbox.stub(),
      initialize: this.sandbox.stub().resolves(),
      dispose: this.sandbox.stub(),
    };
  }

  private createMockInputManager(): any {
    return {
      setupIMEHandling: this.sandbox.stub(),
      setupAltKeyVisualFeedback: this.sandbox.stub(),
      setupKeyboardShortcuts: this.sandbox.stub(),
      addXtermClickHandler: this.sandbox.stub(),
      getAltClickState: this.sandbox
        .stub()
        .returns({ isVSCodeAltClickEnabled: false, isAltKeyPressed: false }),
      isVSCodeAltClickEnabled: this.sandbox.stub().returns(false),
      handleSpecialKeys: this.sandbox.stub().returns(false),
      setNotificationManager: this.sandbox.stub(),
      dispose: this.sandbox.stub(),
    };
  }

  private createMockUIManager(): any {
    return {
      updateTerminalBorders: this.sandbox.stub(),
      updateSplitTerminalBorders: this.sandbox.stub(),
      showTerminalPlaceholder: this.sandbox.stub(),
      hideTerminalPlaceholder: this.sandbox.stub(),
      applyTerminalTheme: this.sandbox.stub(),
      applyFontSettings: this.sandbox.stub(),
      applyAllVisualSettings: this.sandbox.stub(),
      addFocusIndicator: this.sandbox.stub(),
      createTerminalHeader: this.sandbox.stub().returns(this.createMockElement('div')),
      updateTerminalHeader: this.sandbox.stub(),
      updateCliAgentStatusDisplay: this.sandbox.stub(),
      applyVSCodeStyling: this.sandbox.stub(),
      dispose: this.sandbox.stub(),
    };
  }

  private createMockConfigManager(): any {
    return {
      loadSettings: this.sandbox.stub().returns({}),
      saveSettings: this.sandbox.stub(),
      applySettings: this.sandbox.stub(),
      applyFontSettings: this.sandbox.stub(),
      getCurrentSettings: this.sandbox.stub().returns({}),
      getCurrentFontSettings: this.sandbox
        .stub()
        .returns({ fontSize: 14, fontFamily: 'monospace' }),
      updateAltClickSetting: this.sandbox.stub(),
      dispose: this.sandbox.stub(),
    };
  }

  private createMockMessageManager(): any {
    return {
      handleMessage: this.sandbox.stub().resolves(),
      sendReadyMessage: this.sandbox.stub(),
      emitTerminalInteractionEvent: this.sandbox.stub(),
      getQueueStats: this.sandbox.stub().returns({ queueSize: 0, isProcessing: false }),
      sendInput: this.sandbox.stub(),
      sendResize: this.sandbox.stub(),
      sendDeleteTerminalMessage: this.sandbox.stub(),
      dispose: this.sandbox.stub(),
    };
  }

  private createMockNotificationManager(): any {
    return {
      showNotificationInTerminal: this.sandbox.stub(),
      showTerminalKillError: this.sandbox.stub(),
      showTerminalCloseError: this.sandbox.stub(),
      showAltClickFeedback: this.sandbox.stub(),
      clearNotifications: this.sandbox.stub(),
      getStats: this.sandbox.stub().returns({ activeCount: 0, totalCreated: 0 }),
      setupNotificationStyles: this.sandbox.stub(),
      dispose: this.sandbox.stub(),
    };
  }

  // ============================================================================
  // MANAGER TESTING UTILITIES
  // ============================================================================

  /**
   * Create and initialize a test manager with dependency injection
   */
  public async createTestManager<T extends IEnhancedBaseManager>(
    ManagerClass: new (...args: any[]) => T,
    options: TestManagerOptions<T> = {}
  ): Promise<T> {
    const manager = new ManagerClass();

    if (options.initializeImmediately !== false) {
      const dependencies: ManagerDependencies = {
        terminalCoordinator: this.mockCoordinator,
        extensionCommunicator: this.mockCoordinator,
        settingsCoordinator: this.mockCoordinator,
        cliAgentCoordinator: this.mockCoordinator,
        sessionCoordinator: this.mockCoordinator,
        loggingCoordinator: this.mockCoordinator,
        managerProvider: this.mockCoordinator,
        ...options.dependencies,
      };

      await manager.initialize(dependencies);
    }

    // Add automatic cleanup
    this.addCleanupTask(() => {
      if (!manager.isInitialized) {
        return;
      }
      try {
        manager.dispose();
      } catch (error) {
        console.warn('Error disposing test manager:', error);
      }
    });

    return manager;
  }

  /**
   * Test manager initialization with various scenarios
   */
  public async testManagerInitialization<T extends IEnhancedBaseManager>(
    ManagerClass: new (...args: any[]) => T,
    scenarios: Array<{
      name: string;
      dependencies?: Partial<ManagerDependencies>;
      shouldSucceed?: boolean;
      expectedError?: string;
    }>
  ): Promise<void> {
    for (const scenario of scenarios) {
      const manager = new ManagerClass();

      try {
        const deps: ManagerDependencies = {
          terminalCoordinator: this.mockCoordinator,
          extensionCommunicator: this.mockCoordinator,
          settingsCoordinator: this.mockCoordinator,
          cliAgentCoordinator: this.mockCoordinator,
          sessionCoordinator: this.mockCoordinator,
          loggingCoordinator: this.mockCoordinator,
          managerProvider: this.mockCoordinator,
          ...scenario.dependencies,
        };

        await manager.initialize(deps);

        if (scenario.shouldSucceed === false) {
          throw new Error(`Expected ${scenario.name} to fail but it succeeded`);
        }

        expect(manager.isInitialized).to.be.true;
        manager.dispose();
      } catch (error) {
        if (scenario.shouldSucceed !== false) {
          throw error;
        }

        if (scenario.expectedError) {
          expect((error as Error).message).to.include(scenario.expectedError);
        }
      }
    }
  }

  // ============================================================================
  // TIMING UTILITIES
  // ============================================================================

  /**
   * Advance fake timers by specified amount
   */
  public advanceTimers(ms: number): void {
    if (this.clock) {
      this.clock.tick(ms);
    }
  }

  /**
   * Advance timers to next scheduled timer
   */
  public advanceToNextTimer(): void {
    if (this.clock) {
      this.clock.next();
    }
  }

  /**
   * Run all pending timers
   */
  public runAllTimers(): void {
    if (this.clock) {
      this.clock.runAll();
    }
  }

  /**
   * Wait for async operations to complete
   */
  public async waitForAsync(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // ============================================================================
  // ASSERTION UTILITIES
  // ============================================================================

  /**
   * Assert that a manager is properly initialized
   */
  public assertManagerInitialized<T extends IEnhancedBaseManager>(manager: T): void {
    expect(manager.isInitialized).to.be.true;

    const health = manager.getHealthStatus();
    expect(health.isHealthy).to.be.true;
    expect(health.errorCount).to.equal(0);
  }

  /**
   * Assert that a manager is properly disposed
   */
  public assertManagerDisposed<T extends IEnhancedBaseManager>(manager: T): void {
    expect(manager.isInitialized).to.be.false;
  }

  /**
   * Assert that expected methods were called on mock coordinator
   */
  public assertCoordinatorMethodsCalled(methodNames: string[]): void {
    if (!this.mockCoordinator) {
      throw new Error('Mock coordinator not available');
    }

    for (const methodName of methodNames) {
      const method = (this.mockCoordinator as any)[methodName];
      if (method && method.called !== undefined) {
        expect(method.called).to.be.true;
      }
    }
  }

  // ============================================================================
  // CLEANUP AND DISPOSAL
  // ============================================================================

  /**
   * Add a cleanup task to be run during disposal
   */
  public addCleanupTask(task: () => void | Promise<void>): void {
    this.cleanupTasks.push(task);
  }

  /**
   * Cleanup all test resources
   */
  public async cleanup(): Promise<void> {
    // Run all cleanup tasks in reverse order
    for (let i = this.cleanupTasks.length - 1; i >= 0; i--) {
      try {
        await this.cleanupTasks[i]?.();
      } catch (error) {
        console.warn('Error during cleanup task:', error);
      }
    }

    // Reset all arrays
    this.cleanupTasks.length = 0;

    // Restore sandbox
    this.sandbox.restore();
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  public getClock(): sinon.SinonFakeTimers | undefined {
    return this.clock;
  }

  public getSandbox(): sinon.SinonSandbox {
    return this.sandbox;
  }

  public get coordinator(): sinon.SinonStubbedInstance<IFullManagerCoordinator> | undefined {
    return this.mockCoordinator;
  }

  public get container(): DependencyContainer {
    return this.dependencyContainer;
  }

  public get dom(): JSDOM | undefined {
    return this.jsdom;
  }
}
