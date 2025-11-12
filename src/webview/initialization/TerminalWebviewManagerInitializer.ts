/**
 * Terminal Webview Manager Initializer
 *
 * Concrete implementation of BaseWebViewInitializer for RefactoredTerminalWebviewManager.
 * Handles the initialization sequence for the terminal webview manager in the browser context.
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/218
 */

import { BaseWebViewInitializer } from './BaseWebViewInitializer';
import type { RefactoredTerminalWebviewManager } from '../managers/RefactoredTerminalWebviewManager';

/**
 * Context for Terminal Webview Manager initialization
 */
export interface TerminalWebviewManagerContext {
  manager: RefactoredTerminalWebviewManager;
}

/**
 * Initializer for RefactoredTerminalWebviewManager using Template Method pattern
 */
export class TerminalWebviewManagerInitializer extends BaseWebViewInitializer<TerminalWebviewManagerContext> {
  /**
   * Phase 1: Validate Prerequisites
   *
   * Ensures the manager instance is valid and not already initialized.
   */
  protected async validatePrerequisites(): Promise<void> {
    const { manager } = this.context;

    if (!manager) {
      throw new Error('Manager instance is required for initialization');
    }

    // Check if already initialized (accessing private field via bracket notation)
    const isInitialized = (manager as any).isInitialized;
    if (isInitialized) {
      throw new Error('Manager is already initialized');
    }

    this.logger('✅ Prerequisites validated: Manager instance available');
  }

  /**
   * Phase 2: Configure Webview
   *
   * No direct webview configuration needed for manager (runs in browser context).
   */
  protected async configureWebview(): Promise<void> {
    // No webview configuration needed for manager - it runs in browser context
    this.logger('✅ Webview configuration skipped (browser context)');
  }

  /**
   * Phase 3: Setup Message Listeners
   *
   * Configures scrollback message listener for terminal data extraction.
   */
  protected async setupMessageListeners(): Promise<void> {
    const { manager } = this.context;

    // Setup scrollback extraction message listener
    (manager as any).setupScrollbackMessageListener();

    this.logger('✅ Message listeners configured (scrollback extraction)');
  }

  /**
   * Phase 4: Initialize Managers
   *
   * Initializes all specialized managers and services.
   * Note: Most managers are already created in the constructor,
   * this phase validates and completes their initialization.
   */
  protected async initializeManagers(): Promise<void> {
    const { manager } = this.context;

    // Specialized managers are already initialized in constructor:
    // - webViewApiManager
    // - splitManager
    // - terminalLifecycleManager
    // - cliAgentStateManager
    // - eventHandlerManager
    // - findInTerminalManager
    // - profileManager
    // - shellIntegrationManager

    // Existing managers are initialized via initializeExistingManagers():
    // - settingsPanel
    // - notificationManager
    // - performanceManager
    // - uiManager
    // - inputManager
    // - configManager
    // - persistence managers
    // - messageManager

    // Verify critical managers are initialized
    const webViewApiManager = (manager as any).webViewApiManager;
    const terminalLifecycleManager = (manager as any).terminalLifecycleManager;

    if (!webViewApiManager || !terminalLifecycleManager) {
      throw new Error('Critical managers failed to initialize');
    }

    this.logger('✅ All managers initialized and validated');
  }

  /**
   * Phase 5: Setup Event Handlers
   *
   * Configures event handlers for message events, page lifecycle, etc.
   */
  protected async setupEventHandlers(): Promise<void> {
    const { manager } = this.context;

    // Event handlers are set up via setupEventHandlers() method
    // This includes:
    // - Message event handler (delegated to messageManager)
    // - Page unload handler
    // - ResizeObserver pattern for terminal resizing

    // Verify event handler manager is configured
    const eventHandlerManager = (manager as any).eventHandlerManager;
    if (!eventHandlerManager) {
      throw new Error('Event handler manager not initialized');
    }

    this.logger('✅ Event handlers configured (message, lifecycle)');
  }

  /**
   * Phase 6: Load Settings
   *
   * Loads user settings from WebView state.
   */
  protected async loadSettings(): Promise<void> {
    const { manager } = this.context;

    // Load settings from WebView state
    // This is done in the constructor via loadSettings() method
    manager.loadSettings();

    this.logger('✅ Settings loaded from WebView state');
  }

  /**
   * Phase 7: Finalize Initialization (Hook Method)
   *
   * Completes final setup including input manager configuration.
   */
  protected async finalizeInitialization(): Promise<void> {
    const { manager } = this.context;

    // Setup input manager (Alt+Click, IME, keyboard shortcuts)
    (manager as any).setupInputManager();

    // Mark as initialized
    (manager as any).isInitialized = true;

    this.logger('✅ Initialization finalized (input manager configured)');
  }

  /**
   * Custom error handler for manager initialization
   */
  protected handleInitializationError(error: unknown): void {
    super.handleInitializationError(error);

    const { manager } = this.context;

    // Reset initialization flag on error
    (manager as any).isInitialized = false;

    // Log diagnostic information
    try {
      const stats = manager.getManagerStats();
      this.logger('❌ Manager stats at failure:', stats);
    } catch (statsError) {
      this.logger('❌ Could not retrieve manager stats:', statsError);
    }
  }
}
