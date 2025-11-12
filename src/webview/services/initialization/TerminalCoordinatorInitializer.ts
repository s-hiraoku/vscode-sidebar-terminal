/**
 * Terminal Coordinator Initializer
 *
 * Concrete implementation of BaseWebViewInitializer for TerminalCoordinator.
 * Handles the initialization sequence for the terminal coordination service.
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/218
 */

import { BaseWebViewInitializer } from '../../initialization/BaseWebViewInitializer';
import type { TerminalCoordinator } from '../TerminalCoordinator';

/**
 * Context for Terminal Coordinator initialization
 */
export interface TerminalCoordinatorContext {
  coordinator: TerminalCoordinator;
}

/**
 * Initializer for TerminalCoordinator using Template Method pattern
 */
export class TerminalCoordinatorInitializer extends BaseWebViewInitializer<TerminalCoordinatorContext> {
  /**
   * Phase 1: Validate Prerequisites
   *
   * Validates the coordinator configuration and instance.
   */
  protected async validatePrerequisites(): Promise<void> {
    const { coordinator } = this.context;

    if (!coordinator) {
      throw new Error('Coordinator instance is required for initialization');
    }

    // Validate configuration
    const config = (coordinator as any).config;
    if (!config) {
      throw new Error('Coordinator configuration is missing');
    }

    if (!config.maxTerminals || config.maxTerminals <= 0) {
      throw new Error('Invalid maxTerminals configuration');
    }

    this.logger('✅ Prerequisites validated: Coordinator and configuration available');
  }

  /**
   * Phase 2: Configure Webview
   *
   * No webview configuration needed for coordinator (pure service layer).
   */
  protected async configureWebview(): Promise<void> {
    // No webview configuration needed - coordinator is a pure service
    this.logger('✅ Webview configuration skipped (service layer)');
  }

  /**
   * Phase 3: Setup Message Listeners
   *
   * No direct message listeners needed (coordinator communicates via events).
   */
  protected async setupMessageListeners(): Promise<void> {
    // No direct message listeners - coordinator uses event-based communication
    this.logger('✅ Message listeners skipped (event-based communication)');
  }

  /**
   * Phase 4: Initialize Managers
   *
   * Initializes internal data structures (terminals map, counter, etc.).
   */
  protected async initializeManagers(): Promise<void> {
    const { coordinator } = this.context;

    // The coordinator's constructor already initializes:
    // - terminals Map
    // - eventListeners Map
    // - terminalCounter
    // - config

    // Verify initialization
    const terminals = (coordinator as any).terminals;
    const eventListeners = (coordinator as any).eventListeners;

    if (!terminals || !eventListeners) {
      throw new Error('Internal data structures not initialized');
    }

    this.logger('✅ Internal data structures initialized and validated');
  }

  /**
   * Phase 5: Setup Event Handlers
   *
   * Initializes event listener registry for all coordinator events.
   */
  protected async setupEventHandlers(): Promise<void> {
    const { coordinator } = this.context;

    // Event listeners are initialized in initializeEventListeners()
    // This sets up listener maps for:
    // - onTerminalCreated
    // - onTerminalRemoved
    // - onTerminalActivated
    // - onTerminalOutput
    // - onTerminalResize

    const eventListeners = (coordinator as any).eventListeners;
    const expectedEvents = [
      'onTerminalCreated',
      'onTerminalRemoved',
      'onTerminalActivated',
      'onTerminalOutput',
      'onTerminalResize',
    ];

    for (const eventType of expectedEvents) {
      if (!eventListeners.has(eventType)) {
        throw new Error(`Event listener not initialized: ${eventType}`);
      }
    }

    this.logger('✅ Event handlers configured (5 event types registered)');
  }

  /**
   * Phase 6: Load Settings
   *
   * Loads coordinator configuration settings.
   */
  protected async loadSettings(): Promise<void> {
    const { coordinator } = this.context;

    // Configuration is loaded in constructor
    const config = (coordinator as any).config;

    this.logger('✅ Settings loaded:', {
      maxTerminals: config.maxTerminals,
      debugMode: config.debugMode,
      enablePerformanceOptimization: config.enablePerformanceOptimization,
    });
  }

  /**
   * Phase 7: Finalize Initialization (Hook Method)
   *
   * Calls the coordinator's doInitialize method to complete setup.
   */
  protected async finalizeInitialization(): Promise<void> {
    const { coordinator } = this.context;

    // Call doInitialize from BaseManager
    (coordinator as any).doInitialize();

    this.logger('✅ Initialization finalized (coordinator ready)');
  }

  /**
   * Custom error handler for coordinator initialization
   */
  protected handleInitializationError(error: unknown): void {
    super.handleInitializationError(error);

    const { coordinator } = this.context;

    // Log diagnostic information
    try {
      const terminalCount = coordinator.getTerminalCount();
      const hasTerminals = coordinator.hasTerminals();
      const canCreate = coordinator.canCreateTerminal();

      this.logger('❌ Coordinator state at failure:', {
        terminalCount,
        hasTerminals,
        canCreate,
      });
    } catch (diagnosticError) {
      this.logger('❌ Could not retrieve coordinator diagnostics:', diagnosticError);
    }
  }
}
