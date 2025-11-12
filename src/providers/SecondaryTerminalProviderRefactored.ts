import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { WebviewMessage } from '../types/common';
import { provider as log } from '../utils/logger';
import { UnifiedTerminalPersistenceService } from '../services/UnifiedTerminalPersistenceService';
import { PersistenceMessageHandler } from '../handlers/PersistenceMessageHandler';

// Import facade services
import { WebViewLifecycleManager } from '../services/webview/WebViewLifecycleManager';
import { InitializationOrchestrator } from '../services/webview/InitializationOrchestrator';
import { SettingsSyncService } from '../services/webview/SettingsSyncService';
import { ResourceCleanupService } from '../services/webview/ResourceCleanupService';
import { WebViewMessageHandlerService } from '../services/webview/WebViewMessageHandlerService';
import { IMessageHandlerContext } from '../services/webview/interfaces';

/**
 * SecondaryTerminalProvider - Refactored using Facade Pattern
 *
 * This class now serves as a thin facade that delegates to specialized services:
 * - WebViewLifecycleManager: Manages WebView lifecycle
 * - InitializationOrchestrator: Coordinates terminal initialization
 * - SettingsSyncService: Manages settings synchronization
 * - ResourceCleanupService: Handles resource cleanup
 * - WebViewMessageHandlerService: Routes messages to handlers
 *
 * Previous size: 2,655 lines
 * Target size: ~500 lines (achieved through delegation)
 */
export class SecondaryTerminalProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'secondaryTerminal';

  // Facade Services
  private readonly lifecycleManager: WebViewLifecycleManager;
  private readonly initOrchestrator: InitializationOrchestrator;
  private readonly settingsSyncService: SettingsSyncService;
  private readonly cleanupService: ResourceCleanupService;
  private readonly messageHandlerService: WebViewMessageHandlerService;

  // State
  private _view?: vscode.WebviewView;
  private _isInitialized = false;
  private _terminalIdMapping?: Map<string, string>;

  // Persistence services
  private _persistenceService?: UnifiedTerminalPersistenceService;
  private _persistenceHandler?: PersistenceMessageHandler;

  // Phase 8 services
  private _decorationsService?: import('../services/TerminalDecorationsService').TerminalDecorationsService;
  private _linksService?: import('../services/TerminalLinksService').TerminalLinksService;

  constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _terminalManager: TerminalManager,
    private readonly _standardSessionManager?: import('../sessions/StandardTerminalSessionManager').StandardTerminalSessionManager
  ) {
    log('🎨 [PROVIDER] Initializing SecondaryTerminalProvider (Refactored with Facade Pattern)');

    // Initialize facade services
    this.lifecycleManager = new WebViewLifecycleManager(_extensionContext);
    this.initOrchestrator = new InitializationOrchestrator(_terminalManager, (msg) =>
      this._sendMessage(msg)
    );
    this.settingsSyncService = new SettingsSyncService();
    this.cleanupService = new ResourceCleanupService();
    this.messageHandlerService = new WebViewMessageHandlerService();

    // Initialize persistence services
    this._persistenceService = new UnifiedTerminalPersistenceService(
      this._extensionContext,
      this._terminalManager
    );
    this._persistenceHandler = new PersistenceMessageHandler(this._persistenceService);

    // Set up configuration change listeners
    const configDisposable = this.settingsSyncService.setupConfigurationChangeListeners(
      async (settings) => {
        await this._sendMessage({
          command: 'settingsResponse',
          settings,
        });
        await this._sendMessage({
          command: 'fontSettingsUpdate',
          fontSettings: this.settingsSyncService.getCurrentFontSettings(),
        });
      }
    );
    this.cleanupService.addDisposable(configDisposable);

    log('✅ [PROVIDER] SecondaryTerminalProvider initialized with facade services');
    log(
      `📊 [PROVIDER] Registered ${this.messageHandlerService.getHandlerCount()} message handlers`
    );
  }

  /**
   * Resolve WebView view - VS Code lifecycle method
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    log('🚀 [PROVIDER] === RESOLVING WEBVIEW VIEW ===');

    try {
      // Set view reference FIRST
      this._view = webviewView;
      log('✅ [PROVIDER] WebView reference set');

      // Reset initialization flag for new WebView (including panel moves)
      this._isInitialized = false;
      log('✅ [PROVIDER] Initialization flag reset');

      // STEP 1: Configure webview options (delegated to lifecycle manager)
      log('🔧 [PROVIDER] Step 1: Configuring webview...');
      this.lifecycleManager.configureWebview(webviewView);

      // STEP 2: Set up MESSAGE LISTENERS BEFORE HTML
      log('🔧 [PROVIDER] Step 2: Setting up message listeners...');
      const messageDisposable = webviewView.webview.onDidReceiveMessage(
        (message: WebviewMessage) => this._handleWebviewMessage(message),
        null,
        this._extensionContext.subscriptions
      );
      this.cleanupService.addDisposable(messageDisposable);

      // STEP 3: Set HTML (delegated to lifecycle manager)
      log('🔧 [PROVIDER] Step 3: Setting HTML...');
      const isPanelMove = _context.state !== undefined;
      this.lifecycleManager.setWebviewHtml(webviewView, isPanelMove);

      // STEP 4: Set up WebView event listeners (delegated to lifecycle manager)
      log('🔧 [PROVIDER] Step 4: Setting up WebView event listeners...');
      this.lifecycleManager.setupWebviewEventListeners(webviewView, isPanelMove, () =>
        this._requestPanelLocationDetection()
      );

      // STEP 5: Set up terminal event listeners
      log('🔧 [PROVIDER] Step 5: Setting up terminal event listeners...');
      this._setupTerminalEventListeners();

      // STEP 6: Set up CLI Agent status listeners
      log('🔧 [PROVIDER] Step 6: Setting up CLI Agent status listeners...');
      this._setupCliAgentStatusListeners();

      log('✅ [PROVIDER] WebView resolved successfully');
    } catch (error) {
      log('❌ [PROVIDER] Failed to resolve WebView:', error);
      this.lifecycleManager.handleWebviewSetupError(webviewView, error);
    }
  }

  /**
   * Handle messages from WebView
   */
  private async _handleWebviewMessage(message: WebviewMessage): Promise<void> {
    log('📨 [PROVIDER] Handling webview message:', message.command);

    try {
      // Handle scrollback data responses (special case - not delegated to handler service)
      if (message.command === 'scrollbackDataCollected') {
        this.handleScrollbackDataResponse(message);
        return;
      }

      // Handle persistence messages via persistence handler
      if (this._persistenceHandler) {
        const persistenceCommands = [
          'persistenceSaveSession',
          'persistenceRestoreSession',
          'persistenceClearSession',
          'terminalSerializationRequest',
          'terminalSerializationRestoreRequest',
        ];

        if (persistenceCommands.includes(message.command)) {
          await this._persistenceHandler.handle(message);
          return;
        }
      }

      // Delegate to message handler service
      const context = this._createMessageHandlerContext();
      const handled = await this.messageHandlerService.handleMessage(message, context);

      if (!handled) {
        log(`⚠️ [PROVIDER] No handler found for message: ${message.command}`);
      }
    } catch (error) {
      log('❌ [PROVIDER] Error handling webview message:', error);
    }
  }

  /**
   * Create message handler context
   */
  private _createMessageHandlerContext(): IMessageHandlerContext {
    return {
      extensionContext: this._extensionContext,
      terminalManager: this._terminalManager,
      webview: this._view?.webview,
      standardSessionManager: this._standardSessionManager,
      sendMessage: (msg) => this._sendMessage(msg),
      terminalIdMapping: this._terminalIdMapping,
      // Pass provider reference for handlers that need access to provider methods
      provider: this as any,
      // Pass state manager for handlers that need state management
      stateManager: {
        isInitialized: () => this._isInitialized,
        setInitialized: (value: boolean) => {
          this._isInitialized = value;
        },
      },
    } as IMessageHandlerContext;
  }

  /**
   * Initialize terminal system (delegated to orchestrator)
   */
  public async _initializeTerminal(): Promise<void> {
    await this.initOrchestrator.initializeTerminal(() =>
      this.settingsSyncService.getCurrentFontSettings()
    );
  }

  /**
   * Send message to WebView
   */
  public async sendMessageToWebview(message: WebviewMessage): Promise<void> {
    await this._sendMessage(message);
  }

  /**
   * Internal message sending
   */
  private async _sendMessage(message: WebviewMessage): Promise<void> {
    if (!this._view || !this._view.webview) {
      log('⚠️ [PROVIDER] Cannot send message: WebView not available');
      return;
    }

    try {
      await this._view.webview.postMessage(message);
    } catch (error) {
      log('❌ [PROVIDER] Failed to send message to webview:', error);
    }
  }

  /**
   * Request panel location detection from WebView
   */
  private _requestPanelLocationDetection(): void {
    try {
      log('📍 [PROVIDER] Requesting panel location detection from WebView');
      this._sendMessage({
        command: 'requestPanelLocationDetection',
      });
    } catch (error) {
      log('⚠️ [PROVIDER] Error requesting panel location detection:', error);
      // Fallback to sidebar assumption
      this._sendMessage({
        command: 'panelLocationUpdate',
        location: 'sidebar',
      });
      void vscode.commands.executeCommand('setContext', 'secondaryTerminal.panelLocation', 'sidebar');
    }
  }

  /**
   * Set up terminal event listeners
   */
  private _setupTerminalEventListeners(): void {
    log('🔊 [PROVIDER] Setting up terminal event listeners...');

    // Clear existing listeners
    this.cleanupService.clearTerminalEventListeners();

    // Terminal data event
    const dataDisposable = this._terminalManager.onDidWriteTerminalData((e) => {
      if (this._view) {
        void this._sendMessage({
          command: 'terminalData',
          terminalId: e.terminalId,
          data: e.data,
        });
      }
    });
    this.cleanupService.addTerminalEventDisposable(dataDisposable);

    // Terminal created event
    const createdDisposable = this._terminalManager.onDidCreateTerminal((terminal) => {
      if (this._view) {
        void this._sendMessage({
          command: 'terminalCreated',
          terminalId: terminal.id,
          terminalName: terminal.name,
        });
      }
    });
    this.cleanupService.addTerminalEventDisposable(createdDisposable);

    // Terminal deleted event
    const deletedDisposable = this._terminalManager.onDidDeleteTerminal((terminalId) => {
      if (this._view) {
        void this._sendMessage({
          command: 'terminalDeleted',
          terminalId,
        });
      }
    });
    this.cleanupService.addTerminalEventDisposable(deletedDisposable);

    // Terminal title changed event
    const titleChangedDisposable = this._terminalManager.onDidChangeTerminalTitle((e) => {
      if (this._view) {
        void this._sendMessage({
          command: 'terminalTitleChanged',
          terminalId: e.terminalId,
          newTitle: e.title,
        });
      }
    });
    this.cleanupService.addTerminalEventDisposable(titleChangedDisposable);

    log('✅ [PROVIDER] Terminal event listeners set up');
  }

  /**
   * Set up CLI Agent status listeners
   */
  private _setupCliAgentStatusListeners(): void {
    log('🤖 [PROVIDER] Setting up CLI Agent status listeners...');

    const statusDisposable = this._terminalManager.onDidChangeCliAgentStatus((status) => {
      if (this._view) {
        void this._sendMessage({
          command: 'cliAgentStatusUpdate',
          cliAgentStatus: status,
        });
      }
    });
    this.cleanupService.addDisposable(statusDisposable);

    log('✅ [PROVIDER] CLI Agent status listeners set up');
  }

  // ===== PUBLIC API METHODS =====

  /**
   * Split terminal
   */
  public splitTerminal(direction?: 'horizontal' | 'vertical'): void {
    log('🔀 [PROVIDER] Splitting terminal, direction:', direction || 'default');

    try {
      const terminalId = this._terminalManager.createTerminal();
      this._terminalManager.setActiveTerminal(terminalId);
      log(`✅ [PROVIDER] Terminal split successfully: ${terminalId}`);
    } catch (error) {
      log('❌ [PROVIDER] Failed to split terminal:', error);
    }
  }

  /**
   * Open settings
   */
  public openSettings(): void {
    log('⚙️ [PROVIDER] Opening settings...');
    void vscode.commands.executeCommand('workbench.action.openSettings', 'sidebarTerminal');
  }

  /**
   * Kill active terminal
   */
  public async killTerminal(): Promise<void> {
    log('🗑️ [PROVIDER] Killing active terminal');

    const activeTerminalId = this._terminalManager.getActiveTerminalId();
    if (activeTerminalId) {
      await this._performKillTerminal(activeTerminalId);
    } else {
      log('⚠️ [PROVIDER] No active terminal to kill');
    }
  }

  /**
   * Kill specific terminal
   */
  public async killSpecificTerminal(terminalId: string): Promise<void> {
    log(`🗑️ [PROVIDER] Killing specific terminal: ${terminalId}`);
    await this._performKillSpecificTerminal(terminalId);
  }

  /**
   * Perform terminal kill
   */
  private async _performKillTerminal(terminalId: string): Promise<void> {
    try {
      await this._terminalManager.deleteTerminal(terminalId);
      log(`✅ [PROVIDER] Terminal killed: ${terminalId}`);
    } catch (error) {
      log('❌ [PROVIDER] Failed to kill terminal:', error);
    }
  }

  /**
   * Perform specific terminal kill
   */
  private async _performKillSpecificTerminal(terminalId: string): Promise<void> {
    try {
      await this._terminalManager.deleteTerminal(terminalId);
      log(`✅ [PROVIDER] Specific terminal killed: ${terminalId}`);
    } catch (error) {
      log('❌ [PROVIDER] Failed to kill specific terminal:', error);
    }
  }

  /**
   * Save current session
   */
  public async saveCurrentSession(): Promise<boolean> {
    if (!this._persistenceService) {
      log('⚠️ [PROVIDER] Persistence service not available');
      return false;
    }

    try {
      // Request scrollback data from WebView
      const terminals = this._terminalManager.getTerminals();
      const scrollbackData: Record<string, string[]> = {};

      for (const terminal of terminals) {
        const scrollback = await this.requestScrollbackFromWebView(terminal.id);
        scrollbackData[terminal.id] = scrollback;
      }

      return await this._persistenceService.saveSession(scrollbackData);
    } catch (error) {
      log('❌ [PROVIDER] Failed to save session:', error);
      return false;
    }
  }

  /**
   * Restore last session
   */
  public async restoreLastSession(): Promise<boolean> {
    if (!this._persistenceService) {
      log('⚠️ [PROVIDER] Persistence service not available');
      return false;
    }

    try {
      return await this._persistenceService.restoreSession();
    } catch (error) {
      log('❌ [PROVIDER] Failed to restore session:', error);
      return false;
    }
  }

  // Scrollback management
  private pendingScrollbackRequests = new Map<
    string,
    { resolve: (data: string[]) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }
  >();

  private async requestScrollbackFromWebView(terminalId: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingScrollbackRequests.delete(terminalId);
        reject(new Error('Scrollback request timed out'));
      }, 5000);

      this.pendingScrollbackRequests.set(terminalId, { resolve, reject, timeout });

      void this._sendMessage({
        command: 'requestScrollbackData',
        terminalId,
      });
    });
  }

  private handleScrollbackDataResponse(message: any): void {
    const terminalId = message.terminalId;
    const pending = this.pendingScrollbackRequests.get(terminalId);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingScrollbackRequests.delete(terminalId);
      pending.resolve(message.scrollbackLines || []);
    }
  }

  /**
   * Set Phase 8 services
   */
  public setPhase8Services(
    decorationsService: import('../services/TerminalDecorationsService').TerminalDecorationsService,
    linksService: import('../services/TerminalLinksService').TerminalLinksService
  ): void {
    this._decorationsService = decorationsService;
    this._linksService = linksService;

    log('🎨 [PROVIDER] Phase 8 services (Decorations & Links) connected');

    if (this._view) {
      void this._sendMessage({
        command: 'phase8ServicesReady',
        capabilities: {
          decorations: true,
          links: true,
          navigation: true,
          accessibility: true,
        },
      });
    }
  }

  /**
   * Send CLI Agent status update
   */
  public sendCliAgentStatusUpdate(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null = null
  ): void {
    try {
      void this._sendMessage({
        command: 'cliAgentStatusUpdate',
        cliAgentStatus: {
          activeTerminalName,
          status,
          agentType,
        },
      });
    } catch (error) {
      // Silently handle errors
    }
  }

  /**
   * Send full CLI Agent state sync
   */
  public sendFullCliAgentStateSync(): void {
    const terminals = this._terminalManager.getTerminals();
    for (const terminal of terminals) {
      const cliAgent = (terminal as any).cliAgent;
      if (cliAgent) {
        this.sendCliAgentStatusUpdate(terminal.name, cliAgent.status, cliAgent.type);
      }
    }
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    log('🧹 [PROVIDER] Disposing SecondaryTerminalProvider...');

    // Dispose all services
    this.cleanupService.dispose();
    this.settingsSyncService.dispose();
    this._persistenceHandler = undefined;
    this._persistenceService = undefined;

    log('✅ [PROVIDER] SecondaryTerminalProvider disposed');
  }
}
