/**
 * Webview Coordinator Initializer
 *
 * Concrete implementation of BaseWebViewInitializer for RefactoredWebviewCoordinator.
 * Handles the initialization sequence for the main webview coordinator.
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/218
 */

import { BaseWebViewInitializer } from './BaseWebViewInitializer';
import type { RefactoredWebviewCoordinator } from '../RefactoredWebviewCoordinator';

/**
 * Context for Webview Coordinator initialization
 */
export interface WebviewCoordinatorContext {
  coordinator: RefactoredWebviewCoordinator;
}

/**
 * Initializer for RefactoredWebviewCoordinator using Template Method pattern
 */
export class WebviewCoordinatorInitializer extends BaseWebViewInitializer<WebviewCoordinatorContext> {
  /**
   * Phase 1: Validate Prerequisites
   *
   * Ensures the coordinator is not already initialized and all services are available.
   */
  protected async validatePrerequisites(): Promise<void> {
    const { coordinator } = this.context;

    if (!coordinator) {
      throw new Error('Coordinator instance is required for initialization');
    }

    // Check if already initialized
    const isInitialized = (coordinator as any).isInitialized;
    if (isInitialized) {
      throw new Error('RefactoredWebviewCoordinator is already initialized');
    }

    // Verify service instances exist
    const terminalCoordinator = (coordinator as any).terminalCoordinator;
    const uiController = (coordinator as any).uiController;
    const messageRouter = (coordinator as any).messageRouter;

    if (!terminalCoordinator || !uiController || !messageRouter) {
      throw new Error('Service instances not created');
    }

    this.logger('✅ Prerequisites validated: Coordinator and services available');
  }

  /**
   * Phase 2: Configure Webview
   *
   * No direct webview configuration needed (delegates to child services).
   */
  protected async configureWebview(): Promise<void> {
    // No direct webview configuration - handled by child services
    this.logger('✅ Webview configuration skipped (delegated to services)');
  }

  /**
   * Phase 3: Setup Message Listeners
   *
   * Configures the message routing system for Extension ↔ WebView communication.
   */
  protected async setupMessageListeners(): Promise<void> {
    const { coordinator } = this.context;

    // Setup message handlers via the coordinator's private method
    (coordinator as any).setupMessageHandlers();

    this.logger('✅ Message listeners configured (message router + window listener)');
  }

  /**
   * Phase 4: Initialize Managers
   *
   * Initializes the terminal coordinator and UI controller services.
   */
  protected async initializeManagers(): Promise<void> {
    const { coordinator } = this.context;

    // Initialize terminal coordinator
    const terminalCoordinator = (coordinator as any).terminalCoordinator;
    await terminalCoordinator.initialize();
    this.logger('✅ Terminal coordinator initialized');

    // Initialize UI controller
    const uiController = (coordinator as any).uiController;
    await uiController.initialize();
    this.logger('✅ UI controller initialized');
  }

  /**
   * Phase 5: Setup Event Handlers
   *
   * Configures event handlers for terminal coordinator and UI controller events.
   */
  protected async setupEventHandlers(): Promise<void> {
    const { coordinator } = this.context;

    // Setup terminal coordinator events
    // Handles: onTerminalCreated, onTerminalRemoved, onTerminalActivated, onTerminalOutput
    (coordinator as any).setupTerminalCoordinatorEvents();
    this.logger('✅ Terminal coordinator events configured');

    // Setup UI controller events
    // Handles: terminal-switch-requested, terminal-close-requested, settings-open-requested
    (coordinator as any).setupUIControllerEvents();
    this.logger('✅ UI controller events configured');
  }

  /**
   * Phase 6: Load Settings
   *
   * Loads initial configuration and settings.
   */
  protected async loadSettings(): Promise<void> {
    // Settings are managed by child services (terminal coordinator, UI controller)
    // No central settings loading needed at coordinator level

    this.logger('✅ Settings loaded (delegated to services)');
  }

  /**
   * Phase 7: Finalize Initialization (Hook Method)
   *
   * Updates initial UI state and marks coordinator as initialized.
   */
  protected async finalizeInitialization(): Promise<void> {
    const { coordinator } = this.context;

    // Update initial UI state
    (coordinator as any).updateUIState();

    // Mark as initialized
    (coordinator as any).isInitialized = true;

    this.logger('✅ Initialization finalized (UI state updated)');
  }

  /**
   * Custom error handler for coordinator initialization
   */
  protected handleInitializationError(error: unknown): void {
    super.handleInitializationError(error);

    const { coordinator } = this.context;

    // Reset initialization flag on error
    (coordinator as any).isInitialized = false;

    // Log diagnostic information
    try {
      const debugInfo = coordinator.getDebugInfo();
      this.logger('❌ Coordinator state at failure:', debugInfo);
    } catch (diagnosticError) {
      this.logger('❌ Could not retrieve coordinator diagnostics:', diagnosticError);
    }

    // Attempt cleanup
    try {
      coordinator.dispose();
      this.logger('✅ Coordinator disposed after initialization failure');
    } catch (disposeError) {
      this.logger('❌ Failed to dispose coordinator:', disposeError);
    }
  }
}
