/**
 * Refactored Webview Coordinator
 * Demonstrates the simplified architecture using extracted services
 */

import { ITerminalCoordinator, TerminalCoordinatorFactory } from './services/TerminalCoordinator';
import { IUIController, UIControllerFactory } from './services/UIController';
import { MessageRouter, MessageRouterFactory } from '../services/MessageRouter';
import {
  TerminalMessageHandlerFactory,
  TerminalMessageHandlerDependencies
} from '../services/handlers/TerminalMessageHandlers';

/**
 * Simplified webview coordinator using service architecture
 * Replaces the complex RefactoredTerminalWebviewManager
 */
export class RefactoredWebviewCoordinator {
  private readonly terminalCoordinator: ITerminalCoordinator;
  private readonly uiController: IUIController;
  private readonly messageRouter: MessageRouter;
  private isInitialized = false;

  constructor() {
    // Create service instances with default configurations
    this.terminalCoordinator = TerminalCoordinatorFactory.createDefault();
    this.uiController = UIControllerFactory.createDefault();
    this.messageRouter = MessageRouterFactory.createDefault();
  }

  /**
   * Initialize the coordinator and all services
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('RefactoredWebviewCoordinator is already initialized');
    }

    try {
      // Initialize services
      await this.terminalCoordinator.initialize();
      await this.uiController.initialize();

      // Setup event handlers
      this.setupTerminalCoordinatorEvents();
      this.setupUIControllerEvents();
      this.setupMessageHandlers();

      // Update initial UI state
      this.updateUIState();

      this.isInitialized = true;
      console.log('RefactoredWebviewCoordinator initialized successfully');

    } catch (error) {
      console.error('Failed to initialize RefactoredWebviewCoordinator:', error);
      throw error;
    }
  }

  /**
   * Setup terminal coordinator event handlers
   */
  private setupTerminalCoordinatorEvents(): void {
    this.terminalCoordinator.addEventListener('onTerminalCreated', (terminalInfo) => {
      // Update UI when terminal is created
      this.uiController.showTerminalContainer(terminalInfo.id, terminalInfo.container);
      this.updateUIState();

      // Post message to extension
      this.postMessageToExtension('terminalCreated', {
        terminalId: terminalInfo.id,
        number: terminalInfo.number
      });
    });

    this.terminalCoordinator.addEventListener('onTerminalRemoved', (terminalId) => {
      // Update UI when terminal is removed
      this.uiController.hideTerminalContainer(terminalId);
      this.updateUIState();

      // Post message to extension
      this.postMessageToExtension('terminalRemoved', { terminalId });
    });

    this.terminalCoordinator.addEventListener('onTerminalActivated', (terminalId) => {
      // Update UI when terminal is activated
      this.uiController.updateActiveTerminalIndicator(terminalId);
      this.uiController.highlightActiveTerminal(terminalId);

      // Post message to extension
      this.postMessageToExtension('terminalActivated', { terminalId });
    });

    this.terminalCoordinator.addEventListener('onTerminalOutput', (terminalId, data) => {
      // Post output to extension for processing
      this.postMessageToExtension('terminalOutput', { terminalId, data });
    });
  }

  /**
   * Setup UI controller event handlers
   */
  private setupUIControllerEvents(): void {
    // Listen for terminal switch requests from UI
    document.addEventListener('terminal-switch-requested', (event: any) => {
      const { terminalId } = event.detail;
      this.terminalCoordinator.activateTerminal(terminalId);
    });

    // Listen for terminal close requests from UI
    document.addEventListener('terminal-close-requested', (event: any) => {
      const { terminalId } = event.detail;
      this.terminalCoordinator.removeTerminal(terminalId);
    });

    // Listen for settings open requests
    document.addEventListener('settings-open-requested', () => {
      this.postMessageToExtension('openSettings', {});
    });
  }

  /**
   * Setup message handlers for Extension ↔ WebView communication
   */
  private setupMessageHandlers(): void {
    // Create dependencies for message handlers
    const dependencies: TerminalMessageHandlerDependencies = {
      terminalManager: this.createTerminalManagerAdapter(),
      persistenceService: this.createPersistenceAdapter(),
      configService: this.createConfigAdapter(),
      notificationService: this.createNotificationAdapter()
    };

    // Register all terminal message handlers
    TerminalMessageHandlerFactory.registerAllHandlers(this.messageRouter, dependencies);

    // Setup message listener for extension messages
    window.addEventListener('message', async (event) => {
      const { command, data } = event.data;

      if (command && this.messageRouter.hasHandler(command)) {
        try {
          const result = await this.messageRouter.routeMessage(command, data);

          // Send response back to extension
          this.postMessageToExtension('messageResponse', {
            originalCommand: command,
            success: result.success,
            data: result.data,
            error: result.error
          });

        } catch (error) {
          console.error(`Message handling error for command ${command}:`, error);

          this.postMessageToExtension('messageResponse', {
            originalCommand: command,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    });
  }

  /**
   * Create adapter for terminal manager interface
   */
  private createTerminalManagerAdapter() {
    return {
      createTerminal: async (options: any) => {
        return await this.terminalCoordinator.createTerminal(options);
      },

      deleteTerminal: async (terminalId: string, force: boolean) => {
        return await this.terminalCoordinator.removeTerminal(terminalId);
      },

      sendInput: (terminalId: string, input: string) => {
        this.postMessageToExtension('terminalInput', { terminalId, input });
      },

      resize: (terminalId: string, cols: number, rows: number) => {
        this.terminalCoordinator.resizeTerminal(terminalId, cols, rows);
      },

      focusTerminal: (terminalId: string) => {
        this.terminalCoordinator.activateTerminal(terminalId);
      },

      getActiveTerminalId: () => {
        return this.terminalCoordinator.getActiveTerminalId();
      },

      getWorkingDirectory: async (terminalId: string) => {
        // This would need to be implemented based on actual requirements
        return process.cwd();
      }
    };
  }

  /**
   * Create adapter for persistence service interface
   */
  private createPersistenceAdapter() {
    return {
      getLastSession: async () => {
        return new Promise((resolve) => {
          // Request session data from extension
          this.postMessageToExtension('getSessionData', {});

          // Listen for response (simplified - would need proper request/response handling)
          const handler = (event: MessageEvent) => {
            if (event.data.command === 'sessionDataResponse') {
              window.removeEventListener('message', handler);
              resolve(event.data.data);
            }
          };

          window.addEventListener('message', handler);
        });
      }
    };
  }

  /**
   * Create adapter for config service interface
   */
  private createConfigAdapter() {
    return {
      getCurrentSettings: () => {
        // Return cached settings or request from extension
        return {};
      },

      updateSettings: async (settings: any) => {
        this.postMessageToExtension('updateSettings', { settings });
      }
    };
  }

  /**
   * Create adapter for notification service interface
   */
  private createNotificationAdapter() {
    return {
      showNotification: (message: string, type: string) => {
        this.uiController.showNotification({
          type: type as any,
          message,
          duration: 5000
        });
      }
    };
  }

  /**
   * Update UI state based on current terminal state
   */
  private updateUIState(): void {
    const terminalInfos = this.terminalCoordinator.getAllTerminalInfos();
    const activeTerminalId = this.terminalCoordinator.getActiveTerminalId();
    const terminalCount = this.terminalCoordinator.getTerminalCount();
    const availableSlots = this.terminalCoordinator.getAvailableSlots();

    // Update terminal tabs
    this.uiController.updateTerminalTabs(
      terminalInfos.map(info => ({
        id: info.id,
        number: info.number,
        isActive: info.isActive
      }))
    );

    // Update terminal count display
    this.uiController.updateTerminalCountDisplay(terminalCount, terminalCount + availableSlots);

    // Update create button state
    this.uiController.setCreateButtonEnabled(this.terminalCoordinator.canCreateTerminal());

    // Update system status
    this.uiController.updateSystemStatus('READY');
  }

  /**
   * Post message to extension
   */
  private postMessageToExtension(command: string, data: any): void {
    const vscode = (window as any).acquireVsCodeApi();
    if (vscode) {
      vscode.postMessage({ command, data });
    }
  }

  /**
   * Handle incoming messages from extension
   */
  public async handleExtensionMessage(command: string, data: any): Promise<void> {
    if (this.messageRouter.hasHandler(command)) {
      const result = await this.messageRouter.routeMessage(command, data);

      if (!result.success) {
        console.error(`Message handling failed for ${command}:`, result.error);

        this.uiController.showNotification({
          type: 'error',
          message: `Operation failed: ${result.error}`,
          duration: 5000
        });
      }
    } else {
      console.warn(`No handler for command: ${command}`);
    }
  }

  /**
   * Create a new terminal
   */
  public async createTerminal(options?: any): Promise<string> {
    if (!this.terminalCoordinator.canCreateTerminal()) {
      this.uiController.showTerminalLimitMessage(
        this.terminalCoordinator.getTerminalCount(),
        5 // Max terminals - should come from config
      );
      throw new Error('Cannot create terminal: limit reached');
    }

    const terminalId = await this.terminalCoordinator.createTerminal(options);
    this.updateUIState();
    return terminalId;
  }

  /**
   * Switch to a specific terminal
   */
  public async switchToTerminal(terminalId: string): Promise<void> {
    await this.terminalCoordinator.switchToTerminal(terminalId);
    this.updateUIState();
  }

  /**
   * Remove a terminal
   */
  public async removeTerminal(terminalId: string): Promise<boolean> {
    const success = await this.terminalCoordinator.removeTerminal(terminalId);
    if (success) {
      this.updateUIState();
    }
    return success;
  }

  /**
   * Get current state for debugging
   */
  public getDebugInfo(): any {
    return {
      terminalCount: this.terminalCoordinator.getTerminalCount(),
      availableSlots: this.terminalCoordinator.getAvailableSlots(),
      activeTerminalId: this.terminalCoordinator.getActiveTerminalId(),
      registeredCommands: this.messageRouter.getRegisteredCommands(),
      activeHandlers: this.messageRouter.getActiveHandlerCount(),
      isInitialized: this.isInitialized
    };
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    if (this.isInitialized) {
      this.terminalCoordinator.dispose();
      this.uiController.dispose();
      this.messageRouter.dispose();
      this.isInitialized = false;
      console.log('RefactoredWebviewCoordinator disposed');
    }
  }
}