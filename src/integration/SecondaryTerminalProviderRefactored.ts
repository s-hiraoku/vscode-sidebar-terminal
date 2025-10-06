/**
 * Refactored SecondaryTerminalProvider Integration
 *
 * This file demonstrates how to integrate the UnifiedTerminalPersistenceService
 * and PersistenceMessageHandler into the existing SecondaryTerminalProvider.
 *
 * Key improvements:
 * - Clean separation of concerns between terminal management and persistence
 * - Proper dependency injection for testability
 * - Standardized error handling patterns
 * - Simplified message routing with proper handler registration
 * - Resource lifecycle management
 */

import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { WebviewMessage } from '../types/shared';
import {
  UnifiedTerminalPersistenceService,
  ITerminalPersistenceService,
} from '../services/TerminalPersistenceService';
import {
  // PersistenceMessageHandler,
  createPersistenceMessageHandler,
  IPersistenceMessageHandler,
} from '../handlers/PersistenceMessageHandler';
import { log } from '../utils/logger';

/**
 * Example of how to refactor SecondaryTerminalProvider to use the new architecture
 *
 * Note: This is a demonstration class showing the integration patterns.
 * The actual SecondaryTerminalProvider should be updated following these patterns.
 */
export class SecondaryTerminalProviderRefactoredExample implements vscode.WebviewViewProvider {
  public static readonly viewType = 'secondaryTerminal';

  // Core services
  private readonly terminalManager: TerminalManager;
  private readonly persistenceService: ITerminalPersistenceService;
  private readonly persistenceMessageHandler: IPersistenceMessageHandler;

  // State management
  private readonly disposables: vscode.Disposable[] = [];
  private readonly messageHandlers = new Map<string, (message: WebviewMessage) => Promise<void>>();
  private view?: vscode.WebviewView;
  private isInitialized = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    terminalManager: TerminalManager
  ) {
    this.terminalManager = terminalManager;

    // Initialize persistence service with proper dependency injection
    this.persistenceService = new UnifiedTerminalPersistenceService(
      this.context,
      this.terminalManager
    );

    // Initialize persistence message handler with clean separation
    this.persistenceMessageHandler = createPersistenceMessageHandler(
      this.persistenceService as unknown as import('../services/UnifiedTerminalPersistenceService').UnifiedTerminalPersistenceService
    );

    this.initializeServices();
  }

  /**
   * VS Code WebviewViewProvider implementation
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    try {
      this.configureWebview(webviewView.webview);
      this.setupEventListeners(webviewView);
      this.completeInitialization();
    } catch (error) {
      log(`❌ [PROVIDER] Failed to resolve webview: ${error}`);
      this.handleWebviewSetupError(error);
    }
  }

  /**
   * Initializes core services and sets up message handling
   */
  private initializeServices(): void {
    try {
      // Initialize message handlers with proper separation
      this.initializeMessageHandlers();

      // Register persistence message handlers
      this.persistenceMessageHandler.registerMessageHandlers();

      // Set up configuration change listeners
      this.setupConfigurationListeners();

      log('✅ [PROVIDER] Services initialized successfully');
    } catch (error) {
      log(`❌ [PROVIDER] Failed to initialize services: ${error}`);
      throw error;
    }
  }

  /**
   * Initializes message handlers with clean separation of concerns
   */
  private initializeMessageHandlers(): void {
    // Core terminal operations
    this.messageHandlers.set('webviewReady', (msg) => this.handleWebviewReady(msg));
    this.messageHandlers.set('createTerminal', (msg) => this.handleCreateTerminal(msg));
    this.messageHandlers.set('deleteTerminal', (msg) => this.handleDeleteTerminal(msg));
    this.messageHandlers.set('focusTerminal', (msg) => this.handleFocusTerminal(msg));
    this.messageHandlers.set('killTerminal', (msg) => this.handleKillTerminal(msg));

    // Settings and configuration
    this.messageHandlers.set('getSettings', (msg) => this.handleGetSettings(msg));
    this.messageHandlers.set('updateSettings', (msg) => this.handleUpdateSettings(msg));

    // Terminal I/O
    this.messageHandlers.set('input', (msg) => this.handleTerminalInput(msg));
    this.messageHandlers.set('resize', (msg) => this.handleTerminalResize(msg));

    // State management
    this.messageHandlers.set('stateUpdate', (msg) => this.handleStateUpdate(msg));
    this.messageHandlers.set('reportPanelLocation', (msg) => this.handleReportPanelLocation(msg));

    // Note: Persistence handlers are registered separately by PersistenceMessageHandler

    log('✅ [PROVIDER] Core message handlers initialized');
  }

  /**
   * Handles incoming webview messages with improved error handling
   */
  private async handleWebviewMessage(message: WebviewMessage): Promise<void> {
    log(`📨 [PROVIDER] Handling message: ${message.command}`);

    try {
      // Check if it's a persistence-related message
      if (this.isPersistenceMessage(message)) {
        await this.persistenceMessageHandler.handlePersistenceMessage(message);
        return;
      }

      // Handle other messages through the registered handlers
      const handler = this.messageHandlers.get(message.command);
      if (handler) {
        await handler(message);
        return;
      }

      // Handle legacy or special cases
      await this.handleLegacyMessage(message);
    } catch (error) {
      log(`❌ [PROVIDER] Error handling message ${message.command}: ${error}`);
      await this.sendErrorResponse(message, error);
    }
  }

  /**
   * Checks if a message is persistence-related
   */
  private isPersistenceMessage(message: WebviewMessage): boolean {
    const persistenceCommands = [
      'requestTerminalSerialization',
      'terminalSerializationResponse',
      'restoreTerminalSerialization',
      'terminalSerializationRestoreResponse',
      'requestSessionRestorationData',
      'sessionRestorationData',
      'terminalRestoreInfo',
    ];

    return persistenceCommands.includes(message.command);
  }

  /**
   * Sends messages to webview with proper error handling
   */
  public async sendMessageToWebview(message: WebviewMessage): Promise<void> {
    if (!this.view?.webview) {
      throw new Error('Webview not available for message sending');
    }

    try {
      await this.view.webview.postMessage(message);
      log(`📤 [PROVIDER] Message sent: ${message.command}`);
    } catch (error) {
      log(`❌ [PROVIDER] Failed to send message ${message.command}: ${error}`);
      throw error;
    }
  }

  /**
   * Completes the initialization process after webview is ready
   */
  private completeInitialization(): void {
    if (this.isInitialized) {
      return;
    }

    try {
      // Set up persistence service with webview communication
      (this.persistenceService as UnifiedTerminalPersistenceService).setSidebarProvider({
        sendMessageToWebview: (message) => this.sendMessageToWebview(message),
      });

      // Set up terminal event listeners
      this.setupTerminalEventListeners();

      // Schedule initial terminal creation
      this.scheduleInitialSetup();

      this.isInitialized = true;
      log('✅ [PROVIDER] Initialization completed');
    } catch (error) {
      log(`❌ [PROVIDER] Failed to complete initialization: ${error}`);
      throw error;
    }
  }

  /**
   * Sets up terminal event listeners with proper cleanup
   */
  private setupTerminalEventListeners(): void {
    // Terminal state changes
    const stateListener = this.terminalManager.onStateUpdate((state) => {
      this.sendMessageToWebview({
        command: 'stateUpdate',
        state,
        timestamp: Date.now(),
      }).catch((error) => {
        log(`❌ [PROVIDER] Failed to send state update: ${error}`);
      });
    });

    // Terminal output
    const outputListener = this.terminalManager.onTerminalOutput((data) => {
      this.sendMessageToWebview({
        command: 'output',
        terminalId: data.terminalId,
        data: data.data,
        timestamp: Date.now(),
      }).catch((error) => {
        log(`❌ [PROVIDER] Failed to send terminal output: ${error}`);
      });
    });

    // Store disposables for cleanup
    this.disposables.push(stateListener, outputListener);
  }

  /**
   * Sets up configuration change listeners
   */
  private setupConfigurationListeners(): void {
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('secondaryTerminal')) {
        this.handleConfigurationChange().catch((error) => {
          log(`❌ [PROVIDER] Failed to handle configuration change: ${error}`);
        });
      }
    });

    this.disposables.push(configListener);
  }

  /**
   * Schedules initial setup operations
   */
  private scheduleInitialSetup(): void {
    // Schedule session restoration check
    setTimeout(async () => {
      try {
        await this.checkAndRestoreSession();
      } catch (error) {
        log(`❌ [PROVIDER] Failed to restore session: ${error}`);
      }
    }, 1000); // Delay to allow webview to fully initialize
  }

  /**
   * Checks and restores previous session if available
   */
  private async checkAndRestoreSession(): Promise<void> {
    const sessionInfo = this.persistenceService.getSessionInfo();

    if (sessionInfo && sessionInfo.exists) {
      log(`🔄 [PROVIDER] Previous session found: ${sessionInfo.terminals?.length} terminals`);

      // Send session info to webview
      // Send session info through the message handler instead
      await this.sendMessageToWebview({
        command: 'sessionRestored',
        data: sessionInfo as unknown,
      });

      // Attempt to restore session
      const restoreResult = await this.persistenceService.restoreSession();

      if (restoreResult.success) {
        log(`✅ [PROVIDER] Session restored: ${restoreResult.restoredCount} terminals`);
      } else {
        log(`⚠️ [PROVIDER] Session restore failed: ${restoreResult.error?.message}`);
      }
    } else {
      log('📑 [PROVIDER] No previous session found');
    }
  }

  /**
   * Handles configuration changes
   */
  private async handleConfigurationChange(): Promise<void> {
    // Get current settings and send to webview
    const settings = await this.getCurrentSettings();
    await this.sendMessageToWebview({
      command: 'settingsResponse',
      settings,
      timestamp: Date.now(),
    });
  }

  /**
   * Disposes of the provider and cleans up resources
   */
  public dispose(): void {
    try {
      // Dispose of all event listeners
      this.disposables.forEach((d) => d.dispose());
      this.disposables.length = 0;

      // Dispose of persistence service
      this.persistenceService.dispose();

      // Clear message handlers
      this.messageHandlers.clear();

      // Clear webview reference
      this.view = undefined;
      this.isInitialized = false;

      log('✅ [PROVIDER] Disposed successfully');
    } catch (error) {
      log(`❌ [PROVIDER] Error during disposal: ${error}`);
    }
  }

  // Example handler implementations (simplified for demonstration)

  private async handleWebviewReady(_message: WebviewMessage): Promise<void> {
    log('✅ [PROVIDER] Webview ready');
    await this.sendInitialData();
  }

  private async handleCreateTerminal(_message: WebviewMessage): Promise<void> {
    const terminalId = this.terminalManager.createTerminal();
    if (terminalId) {
      await this.sendMessageToWebview({
        command: 'terminalCreated',
        terminalId,
        timestamp: Date.now(),
      });
    }
  }

  private async handleDeleteTerminal(message: WebviewMessage): Promise<void> {
    if (message.terminalId) {
      const result = await this.terminalManager.deleteTerminal(message.terminalId);
      await this.sendMessageToWebview({
        command: 'deleteTerminalResponse',
        terminalId: message.terminalId,
        success: result.success,
        reason: result.reason,
        timestamp: Date.now(),
      });
    }
  }

  private async handleFocusTerminal(message: WebviewMessage): Promise<void> {
    if (message.terminalId) {
      this.terminalManager.setActiveTerminal(message.terminalId);
    }
  }

  private async handleKillTerminal(_message: WebviewMessage): Promise<void> {
    const activeTerminalId = this.terminalManager.getActiveTerminalId();
    if (activeTerminalId) {
      await this.terminalManager.deleteTerminal(activeTerminalId, { force: true });
    }
  }

  private async handleGetSettings(_message: WebviewMessage): Promise<void> {
    const settings = await this.getCurrentSettings();
    await this.sendMessageToWebview({
      command: 'settingsResponse',
      settings,
      timestamp: Date.now(),
    });
  }

  private async handleUpdateSettings(_message: WebviewMessage): Promise<void> {
    // Handle settings update
    log('🔧 [PROVIDER] Settings updated');
  }

  private async handleTerminalInput(message: WebviewMessage): Promise<void> {
    if (message.terminalId && message.data) {
      this.terminalManager.writeToTerminal(message.terminalId, String(message.data));
    }
  }

  private async handleTerminalResize(message: WebviewMessage): Promise<void> {
    if (message.terminalId && message.cols && message.rows) {
      this.terminalManager.resizeTerminal(message.terminalId, message.cols, message.rows);
    }
  }

  private async handleStateUpdate(_message: WebviewMessage): Promise<void> {
    // Handle state update from webview
    log('🔄 [PROVIDER] State update received');
  }

  private async handleReportPanelLocation(message: WebviewMessage): Promise<void> {
    log(`📍 [PROVIDER] Panel location reported: ${message.location}`);
  }

  private async handleLegacyMessage(message: WebviewMessage): Promise<void> {
    log(`⚠️ [PROVIDER] Unhandled message: ${message.command}`);
  }

  private async sendErrorResponse(message: WebviewMessage, error: unknown): Promise<void> {
    await this.sendMessageToWebview({
      command: 'error',
      type: 'handler',
      message: error instanceof Error ? error.message : String(error),
      context: `Command: ${message.command}`,
      terminalId: message.terminalId,
      timestamp: Date.now(),
    });
  }

  private async sendInitialData(): Promise<void> {
    const settings = await this.getCurrentSettings();
    await this.sendMessageToWebview({
      command: 'settingsResponse',
      settings,
      timestamp: Date.now(),
    });
  }

  private async getCurrentSettings(): Promise<Record<string, unknown>> {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    return {
      // Return relevant settings
      enablePersistentSessions: config.get('enablePersistentSessions', true),
      fontFamily: config.get('fontFamily', 'Consolas, monospace'),
      fontSize: config.get('fontSize', 14),
    };
  }

  private configureWebview(webview: vscode.Webview): void {
    webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webview.html = this.getHtmlForWebview(webview);
  }

  private setupEventListeners(webviewView: vscode.WebviewView): void {
    webviewView.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message),
      undefined,
      this.disposables
    );

    webviewView.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  private getHtmlForWebview(_webview: vscode.Webview): string {
    // Return webview HTML content
    return `<!DOCTYPE html><html><body>Terminal Webview</body></html>`;
  }

  private handleWebviewSetupError(error: unknown): void {
    log(`❌ [PROVIDER] Webview setup error: ${error}`);
    // Handle setup errors appropriately
  }
}
