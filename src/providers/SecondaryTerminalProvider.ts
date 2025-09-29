import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { WebviewMessage } from '../types/common';
import { TERMINAL_CONSTANTS } from '../constants';
import { getTerminalConfig, normalizeTerminalInfo } from '../utils/common';
import { showSuccess, showError, TerminalErrorHandler } from '../utils/feedback';
import { provider as log } from '../utils/logger';
import { getUnifiedConfigurationService } from '../config/UnifiedConfigurationService';
import { PartialTerminalSettings, WebViewFontSettings } from '../types/shared';
import {
  WebViewHtmlGenerationService,
  HtmlGenerationOptions,
} from '../services/webview/WebViewHtmlGenerationService';
import { UnifiedTerminalPersistenceService } from '../services/UnifiedTerminalPersistenceService';
import { PersistenceMessageHandler } from '../handlers/PersistenceMessageHandler';
import { TerminalInitializationCoordinator } from './TerminalInitializationCoordinator';
import { SecondaryTerminalMessageRouter } from './SecondaryTerminalMessageRouter';
import {
  isWebviewMessage,
  hasTerminalId,
  hasResizeParams,
  hasSettings,
  hasInputData,
  hasDirection,
  hasForceReconnect,
  AIAgentOperationResult,
  MessageHandler,
} from '../types/type-guards';

export class SecondaryTerminalProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'secondaryTerminal';
  private _disposables: vscode.Disposable[] = [];
  private _terminalEventDisposables: vscode.Disposable[] = [];
  private _terminalIdMapping?: Map<string, string>; // VS Code Pattern: Map Extension terminal ID to WebView terminal ID

  private _view?: vscode.WebviewView;
  private _isInitialized = false; // Prevent duplicate initialization
  // Removed all state variables - using simple "fresh start" approach

  // Minimal command router for incoming webview messages
  private readonly _messageRouter: SecondaryTerminalMessageRouter;
  private readonly _htmlGenerationService: WebViewHtmlGenerationService;

  // Phase 8 services (typed properly)
  private _decorationsService?: import('../services/TerminalDecorationsService').TerminalDecorationsService;
  private _linksService?: import('../services/TerminalLinksService').TerminalLinksService;

  // Terminal persistence services
  private _persistenceService?: UnifiedTerminalPersistenceService;
  private _persistenceHandler?: PersistenceMessageHandler;
  private readonly _initializationCoordinator: TerminalInitializationCoordinator;

  constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _terminalManager: TerminalManager,
    private readonly _standardSessionManager?: import('../sessions/StandardTerminalSessionManager').StandardTerminalSessionManager
  ) {
    this._htmlGenerationService = new WebViewHtmlGenerationService();

    // Initialize persistence services
    this._persistenceService = new UnifiedTerminalPersistenceService(
      this._extensionContext,
      this._terminalManager
    );
    this._persistenceHandler = new PersistenceMessageHandler(this._persistenceService);

    this._messageRouter = new SecondaryTerminalMessageRouter();

    log('🎨 [PROVIDER] HTML generation service initialized');
    log('💾 [PROVIDER] Terminal persistence services initialized');

    this._initializationCoordinator = new TerminalInitializationCoordinator(
      this._terminalManager,
      {
        initializeTerminal: this._initializeTerminal.bind(this),
        ensureMinimumTerminals: this._ensureMultipleTerminals.bind(this),
        sendInitializationComplete: this._sendInitializationComplete.bind(this),
        restoreLastSession: () => this.restoreLastSession(),
      },
      this._standardSessionManager
    );
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    log('🚀 [PROVIDER] === RESOLVING WEBVIEW VIEW ===');
    log('🚀 [PROVIDER] WebView object exists:', !!webviewView);
    log('🚀 [PROVIDER] WebView webview exists:', !!webviewView.webview);

    try {
      this._resetForNewView(webviewView);
      log('🔧 [PROVIDER] Step 1: Configuring webview options...');
      this._configureWebview(webviewView);
      this._registerWebviewMessageListener(webviewView);
      this._initializeMessageHandlers();
      this._registerVisibilityListener(webviewView);
      this._initializeWebviewContent(webviewView);
      this._registerCoreListeners();
      this._setupPanelLocationChangeListener(webviewView);

      log('✅ [PROVIDER] WebView setup completed successfully');
      log('🚀 [PROVIDER] === WEBVIEW VIEW RESOLUTION COMPLETE ===');
    } catch (error) {
      log('❌ [CRITICAL] Failed to resolve WebView:', error);
      this._handleWebviewSetupError(webviewView, error);
    }
  }

  private _resetForNewView(webviewView: vscode.WebviewView): void {
    // CRITICAL: Set view reference first
    this._view = webviewView;
    log('✅ [PROVIDER] WebView reference set');

    // Reset initialization flag for new WebView (including panel moves)
    this._isInitialized = false;
    log('✅ [PROVIDER] Initialization flag reset');
  }

  private _registerWebviewMessageListener(webviewView: vscode.WebviewView): void {
    // STEP 2: Set up MESSAGE LISTENERS BEFORE HTML (VS Code standard practice)
    // This is CRITICAL - listeners must be set before HTML is loaded
    log('🔧 [PROVIDER] Step 2: Setting up message listeners (BEFORE HTML)...');
    const disposable = webviewView.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        log('📨 [PROVIDER] ✅ MESSAGE RECEIVED FROM WEBVIEW!');
        log('📨 [PROVIDER] Message command:', message.command);
        try {
          const { isDebugEnabled } = require('../utils/logger');
          if (isDebugEnabled && isDebugEnabled()) {
            log('📨 [PROVIDER] Message data:', message);
          }
        } catch {}
        log('📨 [PROVIDER] WebView visible:', webviewView.visible);

        // Validate message before handling
        if (!this._isValidWebviewMessage(message)) {
          log('⚠️ [PROVIDER] Invalid WebviewMessage received, ignoring');
          return;
        }

        // Handle message immediately
        this._handleWebviewMessage(message).catch((error) => {
          log('❌ [PROVIDER] Error handling message:', error);
        });
      },
      undefined,
      this._extensionContext.subscriptions
    );

    this._extensionContext.subscriptions.push(disposable);
    log('✅ [PROVIDER] Message listener registered and added to subscriptions');
  }

  private _registerVisibilityListener(webviewView: vscode.WebviewView): void {
    // STEP 3: Set up visibility listener
    log('🔧 [PROVIDER] Step 3: Setting up visibility listener...');
    const disposable = webviewView.onDidChangeVisibility(
      () => {
        if (webviewView.visible) {
          log('👁️ [PROVIDER] WebView became visible');
          // Trigger panel location detection when WebView becomes visible
          setTimeout(() => {
            this._requestPanelLocationDetection();
          }, 500);
        } else {
          log('👁️ [PROVIDER] WebView became hidden');
        }
      },
      undefined,
      this._extensionContext.subscriptions
    );
    this._extensionContext.subscriptions.push(disposable);
    log('✅ [PROVIDER] Visibility listener registered');
  }

  private _initializeWebviewContent(webviewView: vscode.WebviewView): void {
    // STEP 4: Set HTML AFTER listeners are ready (VS Code standard)
    log('🔧 [PROVIDER] Step 4: Setting webview HTML...');
    this._setWebviewHtml(webviewView, false);
  }

  private _registerCoreListeners(): void {
    // STEP 5: Set up terminal and other listeners
    log('🔧 [PROVIDER] Step 5: Setting up terminal listeners...');
    this._setupTerminalEventListeners();
    this._setupCliAgentStatusListeners();
    this._setupConfigurationChangeListeners();
  }

  /**
   * Minimal validation for incoming WebviewMessage
   */
  private _isValidWebviewMessage(msg: unknown): msg is WebviewMessage {
    return isWebviewMessage(msg);
  }

  /**
   * Type guard: message has a valid terminalId
   */
  private _hasTerminalId(msg: WebviewMessage): msg is WebviewMessage & { terminalId: string } {
    return hasTerminalId(msg);
  }

  /**
   * Type guard: message has valid resize params
   */
  private _hasResizeParams(
    msg: WebviewMessage
  ): msg is WebviewMessage & { cols: number; rows: number } {
    return hasResizeParams(msg);
  }

  /**
   * Type guard: message has settings payload
   */
  private _hasSettings(
    msg: WebviewMessage
  ): msg is WebviewMessage & { settings: PartialTerminalSettings } {
    return hasSettings(msg);
  }

  /**
   * Type guard: message has non-empty input data
   */
  private _hasInputData(msg: WebviewMessage): msg is WebviewMessage & { data: string } {
    return hasInputData(msg);
  }

  /**
   * Initialize a minimal command→handler map without behavior change
   */
  private _initializeMessageHandlers(): void {
    const entries: Array<[string | undefined, MessageHandler]> = [
      ['webviewReady', (message) => this._handleWebviewReady(message)],
      [
        TERMINAL_CONSTANTS?.COMMANDS?.READY,
        (message) => this._handleWebviewReady(message),
      ],
      ['getSettings', async () => {
        await this._handleGetSettings();
      }],
      ['focusTerminal', async (message) => {
        await this._handleFocusTerminal(message);
      }],
      [
        TERMINAL_CONSTANTS?.COMMANDS?.FOCUS_TERMINAL,
        async (message) => {
          await this._handleFocusTerminal(message);
        },
      ],
      ['splitTerminal', (message) => {
        this._handleSplitTerminal(message);
      }],
      ['createTerminal', async (message) => {
        await this._handleCreateTerminal(message);
      }],
      [
        TERMINAL_CONSTANTS?.COMMANDS?.CREATE_TERMINAL,
        async (message) => {
          await this._handleCreateTerminal(message);
        },
      ],
      [
        TERMINAL_CONSTANTS?.COMMANDS?.INPUT,
        (message) => {
          this._handleTerminalInput(message);
        },
      ],
      [
        TERMINAL_CONSTANTS?.COMMANDS?.RESIZE,
        (message) => {
          this._handleTerminalResize(message);
        },
      ],
      ['killTerminal', async (message) => {
        await this._handleKillTerminal(message);
      }],
      ['deleteTerminal', async (message) => {
        await this._handleDeleteTerminal(message);
      }],
      ['updateSettings', async (message) => {
        await this._handleUpdateSettings(message);
      }],
      ['reportPanelLocation', async (message) => {
        await this._handleReportPanelLocation(message);
      }],
      ['terminalClosed', async (message) => {
        await this._handleTerminalClosed(message);
      }],
      ['requestInitialTerminal', async (message) => {
        await this._handleRequestInitialTerminal(message);
      }],
      ['terminalInitializationComplete', async (message) => {
        await this._handleTerminalInitializationComplete(message);
      }],
      ['persistenceSaveSession', async (message) => {
        await this._handlePersistenceMessage(message);
      }],
      ['persistenceRestoreSession', async (message) => {
        await this._handlePersistenceMessage(message);
      }],
      ['persistenceClearSession', async (message) => {
        await this._handlePersistenceMessage(message);
      }],
      ['terminalSerializationRequest', async (message) => {
        await this._handleLegacyPersistenceMessage(message);
      }],
      ['terminalSerializationRestoreRequest', async (message) => {
        await this._handleLegacyPersistenceMessage(message);
      }],
      ['htmlScriptTest', (message) => this._handleHtmlScriptTest(message)],
      ['timeoutTest', (message) => this._handleTimeoutTest(message)],
      ['test', (message) => this._handleDebugTest(message)],
    ];

    this._messageRouter.reset();
    for (const [command, handler] of entries) {
      this._messageRouter.register(command, handler);
    }
  }

  /**
   * Extracted handler for webview readiness
   */
  private _handleWebviewReady(_message: WebviewMessage): void {
    log('🔥 [TERMINAL-INIT] === _handleWebviewReady CALLED ===');

    if (this._isInitialized) {
      log('🔄 [TERMINAL-INIT] WebView already initialized, skipping duplicate initialization');
      return;
    }

    log('🎯 [TERMINAL-INIT] WebView ready - initializing terminal with coordinated restoration');
    this._isInitialized = true;

    // Send version information to WebView
    this._sendVersionInfo();

    void this._initializationCoordinator.initialize();
  }

  /**
   * Send version information to WebView
   */
  private _sendVersionInfo(): void {
    try {
      const extension = vscode.extensions.getExtension('s-hiraoku.vscode-sidebar-terminal');
      const version = extension?.packageJSON?.version || 'unknown';
      const formattedVersion = version === 'unknown' ? version : `v${version}`;

      if (this._view) {
        void this._view.webview.postMessage({
          command: 'versionInfo',
          version: formattedVersion,
        });
        log(`📤 [VERSION] Sent version info to WebView: ${formattedVersion}`);
      }
    } catch (error) {
      log('❌ [VERSION] Error sending version info:', error);
    }
  }

  /**
   * Extracted handler for getSettings, preserves existing behavior
   */
  private async _handleGetSettings(): Promise<void> {
    log('⚙️ [DEBUG] Getting settings from webview...');
    const settings = this.getCurrentSettings();
    const fontSettings = this.getCurrentFontSettings();

    await this._sendMessage({
      command: 'settingsResponse',
      settings,
    });

    // Send font settings separately
    await this._sendMessage({
      command: 'fontSettingsUpdate',
      fontSettings,
    });

    // Send initial panel location and request detection (Issue #148)
    if (this._view) {
      const panelLocation = this._getCurrentPanelLocation();
      log(`📍 [SETTINGS] Sending initial panel location: ${panelLocation}`);
      await this._sendMessage({
        command: 'panelLocationUpdate',
        location: panelLocation,
      });

      // Also request WebView to detect actual panel location
      this._requestPanelLocationDetection();
    }
  }

  /**
   * Extracted handler for focusing a terminal
   */
  private async _handleFocusTerminal(message: WebviewMessage): Promise<void> {
    log('🎯 [DEBUG] ========== FOCUS TERMINAL COMMAND RECEIVED (router) ==========');
    if (!this._hasTerminalId(message)) {
      log('❌ [DEBUG] No terminal ID provided for focusTerminal');
      return;
    }

    try {
      const currentActive = this._terminalManager.getActiveTerminalId();
      log(`🔍 [DEBUG] Current active terminal: ${currentActive}`);
      log(`🔍 [DEBUG] Requested active terminal: ${message.terminalId}`);
      this._terminalManager.setActiveTerminal(message.terminalId);
      const newActive = this._terminalManager.getActiveTerminalId();
      log(`🔍 [DEBUG] Verified active terminal after update: ${newActive}`);

      if (newActive === message.terminalId) {
        log(`✅ [DEBUG] Active terminal successfully updated to: ${message.terminalId}`);
      } else {
        log(
          `❌ [DEBUG] Active terminal update failed. Expected: ${message.terminalId}, Got: ${newActive}`
        );
      }
    } catch (error) {
      log(`❌ [DEBUG] Error setting active terminal:`, error);
    }
  }

  /**
   * Extracted handler for splitting a terminal
   */
  private _handleSplitTerminal(message: WebviewMessage): void {
    log('🔀 [DEBUG] Splitting terminal from webview (router)...');
    const direction = hasDirection(message) ? message.direction : undefined;
    try {
      // Preserve previous behavior: if no direction provided, use default
      if (direction) {
        this.splitTerminal(direction);
      } else {
        this.splitTerminal();
      }
    } catch (error) {
      log('❌ [ERROR] Failed to split terminal:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  /**
   * Debug: HTML inline script test
   */
  private _handleHtmlScriptTest(message: WebviewMessage): void {
    log('🔥 [DEBUG] ========== HTML INLINE SCRIPT TEST MESSAGE RECEIVED ==========');
    log('🔥 [DEBUG] HTML script communication is working!');
    log('🔥 [DEBUG] Message content:', message);
  }

  /**
   * Debug: HTML timeout test
   */
  private _handleTimeoutTest(message: WebviewMessage): void {
    log('🔥 [DEBUG] ========== HTML TIMEOUT TEST MESSAGE RECEIVED ==========');
    log('🔥 [DEBUG] Timeout test communication is working!');
    log('🔥 [DEBUG] Message content:', message);
  }

  /**
   * Debug: generic test message handler
   */
  private _handleDebugTest(message: WebviewMessage): void {
    if ((message as WebviewMessage & { type?: string }).type === 'initComplete') {
      log('🎆 [TRACE] ===============================');
      log('🎆 [TRACE] WEBVIEW CONFIRMS INIT COMPLETE!');
      try {
        const { isDebugEnabled } = require('../utils/logger');
        if (isDebugEnabled && isDebugEnabled()) {
          log('🎆 [TRACE] Message data:', message);
        }
      } catch {}
      log('🎆 [TRACE] This means WebView successfully processed INIT message');
    } else {
      log('🧪 [DEBUG] ========== TEST MESSAGE RECEIVED FROM WEBVIEW ==========');
      log('🧪 [DEBUG] Test message content:', message);
      log('🧪 [DEBUG] WebView communication is working!');
    }
  }

  private async _sendInitializationComplete(terminalCount: number): Promise<void> {
    await this._sendMessage({
      command: 'initializationComplete',
      terminalCount,
      timestamp: Date.now(),
    });
  }

  /**
   * Extracted handler for creating a terminal from WebView request
   * Mirrors existing behavior: create PTY and map Extension ID → WebView ID
   */
  private async _handleCreateTerminal(message: WebviewMessage): Promise<void> {
    if (!message.terminalId || !message.terminalName) {
      log('⚠️ [DEBUG] Missing terminalId or terminalName for createTerminal');
      return;
    }

    log(
      '🚀 [DEBUG] Creating terminal from WebView request (router):',
      message.terminalId,
      message.terminalName
    );
    try {
      // Avoid duplicates if terminal already exists on extension side
      const existingTerminal = this._terminalManager.getTerminal(message.terminalId);
      if (!existingTerminal) {
        const newTerminalId = this._terminalManager.createTerminal();
        log(`✅ [VS Code Pattern] PTY terminal created: ${newTerminalId}`);

        const terminalInstance = this._terminalManager.getTerminal(newTerminalId);
        if (terminalInstance) {
          this._terminalIdMapping = this._terminalIdMapping || new Map();
          this._terminalIdMapping.set(newTerminalId, message.terminalId);
          log(
            `🔗 [VS Code Pattern] Mapped Extension ID ${newTerminalId} → WebView ID ${message.terminalId}`
          );
        } else {
          log(`❌ [VS Code Pattern] Failed to get terminal instance for ${newTerminalId}`);
        }
      } else {
        log(`⚠️ [DEBUG] Terminal ${message.terminalId} already exists, skipping creation`);
      }
    } catch (error) {
      log(`❌ [DEBUG] Failed to create PTY terminal: ${String(error)}`);
    }
  }

  /**
   * Extracted handler: request initial terminal creation (if none exists)
   */
  private async _handleRequestInitialTerminal(_message: WebviewMessage): Promise<void> {
    log('🚨 [DEBUG] WebView requested initial terminal creation (router)');
    try {
      if (this._terminalManager.getTerminals().length === 0) {
        log('🎯 [INITIAL] Creating initial terminal as requested by WebView');
        const terminalId = this._terminalManager.createTerminal();
        log(`✅ [INITIAL] Initial terminal created: ${terminalId}`);
        this._terminalManager.setActiveTerminal(terminalId);

        // Send terminal update to WebView
        void this._sendMessage({
          command: 'stateUpdate',
          state: this._terminalManager.getCurrentState(),
        });
      } else {
        log(
          `🔍 [INITIAL] Terminals already exist (${this._terminalManager.getTerminals().length}), skipping creation`
        );
      }
    } catch (error) {
      log(`❌ [INITIAL] Failed to create requested initial terminal: ${String(error)}`);
      console.error('❌ [INITIAL] Error details:', error);
    }
  }

  /**
   * 🎯 CRITICAL FIX: Handle terminal initialization completion from WebView
   * Starts shell initialization only after WebView terminal is fully ready
   */
  private async _handleTerminalInitializationComplete(message: WebviewMessage): Promise<void> {
    const terminalId = message.terminalId as string;
    log(`🎯 [INITIALIZATION] WebView terminal initialization complete: ${terminalId}`);

    if (!terminalId) {
      log('❌ [INITIALIZATION] No terminalId provided for initialization completion');
      return;
    }

    try {
      // Get terminal instance to access PTY process
      const terminal = this._terminalManager.getTerminal(terminalId);
      if (!terminal || !terminal.ptyProcess) {
        log(`❌ [INITIALIZATION] Terminal or PTY process not found: ${terminalId}`);
        return;
      }

      log(`✅ [INITIALIZATION] Starting shell initialization for: ${terminalId}`);

      // Call TerminalManager's shell initialization with proper timing (safe mode enabled to skip shell integration)
      this._terminalManager.initializeShellForTerminal(terminalId, terminal.ptyProcess, true);
      log(`🐚 [INITIALIZATION] Shell initialization initiated for: ${terminalId}`);
    } catch (error) {
      log(`❌ [INITIALIZATION] Failed to initialize shell for terminal ${terminalId}:`, error);
    }
  }

  /**
   * Extracted handler: terminal input
   */
  private _handleTerminalInput(message: WebviewMessage): void {
    if (!this._hasInputData(message)) {
      log('⚠️ [DEBUG] Invalid input data');
      return;
    }
    log('⌨️ [DEBUG] Terminal input (router):', message.data.length, 'chars');
    this._terminalManager.sendInput(message.data, message.terminalId);
  }

  /**
   * Extracted handler: terminal resize
   */
  private _handleTerminalResize(message: WebviewMessage): void {
    if (!this._hasResizeParams(message)) {
      log('⚠️ [DEBUG] Invalid resize parameters');
      return;
    }
    log('📏 [DEBUG] Terminal resize (router):', message.cols, 'x', message.rows);
    this._terminalManager.resize(message.cols, message.rows, message.terminalId);
  }

  /**
   * Extracted handler for terminalClosed from WebView
   */
  private async _handleTerminalClosed(message: WebviewMessage): Promise<void> {
    const termId = message.terminalId;
    log('🗑️ [DEBUG] Terminal closed from webview (router):', termId);
    if (!termId) {
      log('⚠️ [DEBUG] No terminalId provided for terminalClosed');
      return;
    }

    // Check if terminal still exists before removing
    const terminals = this._terminalManager.getTerminals();
    const terminalExists = terminals.some((t) => t.id === termId);
    if (terminalExists) {
      log('🗑️ [DEBUG] Removing terminal from extension side:', termId);
      this._terminalManager.removeTerminal(termId);
    } else {
      log('🔄 [DEBUG] Terminal already removed from extension side:', termId);
    }
  }

  /**
   * Extracted handler for killing a terminal (active or specific)
   */
  private async _handleKillTerminal(message: WebviewMessage): Promise<void> {
    log('🗑️ [DEBUG] ========== KILL TERMINAL COMMAND RECEIVED (router) ==========');
    log('🗑️ [DEBUG] Full message:', message);
    log('🗑️ [DEBUG] Message terminalId:', message.terminalId);

    try {
      if (message.terminalId) {
        // Kill specific terminal
        log(`🗑️ [DEBUG] Killing specific terminal: ${message.terminalId}`);
        await this.killSpecificTerminal(message.terminalId);
        log(`🗑️ [DEBUG] killSpecificTerminal completed for: ${message.terminalId}`);
      } else {
        // Kill active terminal (panel trash button behavior)
        log('🗑️ [DEBUG] Killing active terminal (no specific ID provided)');
        await this.killTerminal();
        log('🗑️ [DEBUG] killTerminal (active terminal deletion) completed');
      }
    } catch (error) {
      log('❌ [DEBUG] Error while handling killTerminal:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  /**
   * Extracted handler for deleting a specific terminal (with response)
   */
  private async _handleDeleteTerminal(message: WebviewMessage): Promise<void> {
    log('🗑️ [DEBUG] ========== DELETE TERMINAL COMMAND RECEIVED (router) ==========');
    log('🗑️ [DEBUG] Full message:', message);
    const terminalId = this._hasTerminalId(message) ? message.terminalId : undefined;
    const requestSource = (message.requestSource as 'header' | 'panel') || 'panel';

    if (!terminalId) {
      log('❌ [DEBUG] No terminal ID provided for deleteTerminal');
      return;
    }

    try {
      const result = await this._terminalManager.deleteTerminal(terminalId, {
        source: requestSource,
      });

      if (result.success) {
        log(`✅ [DEBUG] Terminal deletion succeeded: ${terminalId}`);
        await this._sendMessage({
          command: 'deleteTerminalResponse',
          terminalId,
          success: true,
        });
      } else {
        log(`⚠️ [DEBUG] Terminal deletion failed: ${terminalId}, reason: ${result.reason}`);
        await this._sendMessage({
          command: 'deleteTerminalResponse',
          terminalId,
          success: false,
          reason: result.reason,
        });
      }
    } catch (error) {
      log('❌ [DEBUG] Error in deleteTerminal:', error);
      await this._sendMessage({
        command: 'deleteTerminalResponse',
        terminalId,
        success: false,
        reason: `Delete failed: ${String(error)}`,
      });
    }
  }

  /**
   * Extracted handler for updating settings
   */
  private async _handleUpdateSettings(message: WebviewMessage): Promise<void> {
    log('⚙️ [DEBUG] Updating settings from webview (router):', message.settings);
    if (!message || typeof message !== 'object' || !message.settings) {
      log('⚠️ [DEBUG] No settings provided in updateSettings message');
      return;
    }
    try {
      await this.updateSettings(message.settings);
    } catch (error) {
      log('❌ [ERROR] Failed to update settings:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  /**
   * Extracted handler for reporting panel location
   */
  private async _handleReportPanelLocation(message: WebviewMessage): Promise<void> {
    log('📍 [DEBUG] Panel location reported from WebView (router):', message.location);
    const loc = message.location;
    if (loc !== 'sidebar' && loc !== 'panel') {
      log('⚠️ [DEBUG] Invalid or missing panel location');
      return;
    }

    // Update context key for VS Code when clause
    void vscode.commands.executeCommand('setContext', 'secondaryTerminal.panelLocation', loc);
    log('📍 [DEBUG] Context key updated with panel location:', loc);

    // Notify WebView of the panel location (keeps behavior consistent)
    await this._sendMessage({
      command: 'panelLocationUpdate',
      location: loc,
    });
    log('📍 [DEBUG] Panel location update sent to WebView:', loc);
  }

  /**
   * 🆕 Request panel location detection from WebView
   * Issue #148: Dynamic split direction based on panel location
   */
  private _requestPanelLocationDetection(): void {
    try {
      log('📍 [PANEL-DETECTION] Requesting panel location detection from WebView');

      // Send a message to WebView to analyze its dimensions and report back
      this._sendMessage({
        command: 'requestPanelLocationDetection',
      });
    } catch (error) {
      log('⚠️ [PANEL-DETECTION] Error requesting panel location detection:', error);
      // Fallback to sidebar assumption
      this._sendMessage({
        command: 'panelLocationUpdate',
        location: 'sidebar',
      });

      // Set fallback context key
      void vscode.commands.executeCommand(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );
    }
  }

  /**
   * 🆕 Determine current panel location based on VS Code API inspection
   */
  private _getCurrentPanelLocation(): 'sidebar' | 'panel' {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');

    // Check if dynamic split direction feature is enabled
    const isDynamicSplitEnabled = config.get<boolean>('dynamicSplitDirection', true);
    if (!isDynamicSplitEnabled) {
      log('📍 [PANEL-DETECTION] Dynamic split direction is disabled, defaulting to sidebar');
      return 'sidebar';
    }

    // Get manual panel location setting
    const manualPanelLocation = config.get<'sidebar' | 'panel' | 'auto'>('panelLocation', 'auto');

    if (manualPanelLocation !== 'auto') {
      log(`📍 [PANEL-DETECTION] Using manual panel location: ${manualPanelLocation}`);
      return manualPanelLocation;
    }

    // 🔧 For auto-detection, default to sidebar
    // Actual detection will be done asynchronously via WebView
    log('📍 [PANEL-DETECTION] Auto mode - defaulting to sidebar, will detect via WebView');
    return 'sidebar';
  }

  /**
   * 🆕 Set up listener for panel location changes (e.g., drag and drop)
   */
  private _setupPanelLocationChangeListener(webviewView: vscode.WebviewView): void {
    // VS Code doesn't provide direct panel location change events
    // We'll use view state changes as a proxy for potential location changes

    if (webviewView.onDidChangeVisibility) {
      this._addDisposable(
        webviewView.onDidChangeVisibility(() => {
          // When visibility changes, re-detect panel location
          setTimeout(() => {
            log('📍 [PANEL-DETECTION] Panel location change detected - requesting detection');
            this._requestPanelLocationDetection();
          }, 100); // Small delay to ensure layout is settled
        })
      );
    }

    // Also listen for configuration changes
    this._addDisposable(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('secondaryTerminal.panelLocation')) {
          log(`📍 [PANEL-DETECTION] Panel location setting changed - requesting detection`);
          this._requestPanelLocationDetection();
        }
      })
    );
  }

  public splitTerminal(direction?: 'horizontal' | 'vertical'): void {
    // Terminal split operation
    try {
      // Simplified: Let TerminalManager handle the validation
      // Remove complex pre-validation and trust the createTerminal() method
      log('🔍 [SPLIT] Attempting terminal creation - validation delegated to TerminalManager');

      // First send the SPLIT command to prepare the UI
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.SPLIT,
        direction: direction || 'vertical', // Default to vertical if not specified
      });

      // SPINNER FIX: Defer terminal creation for split operations too
      setImmediate(() => {
        try {
          const terminalId = this._terminalManager.createTerminal();
          log('Split terminal created:', terminalId);

          // The terminal creation event will send TERMINAL_CREATED to webview automatically
        } catch (error) {
          log('ERROR: Failed to create split terminal:', error);
          showError('Failed to create split terminal');
        }
      });
    } catch (error) {
      log('❌ [ERROR] Failed to split terminal:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  public openSettings(): void {
    log('⚙️ [DEBUG] Opening settings...');
    try {
      // Send message to webview to open settings panel
      void this._sendMessage({
        command: 'openSettings',
      });
      log('✅ [DEBUG] Settings open command sent');
    } catch (error) {
      log('❌ [ERROR] Failed to open settings:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  public selectProfile(): void {
    log('🎯 [DEBUG] Opening profile selector...');
    try {
      void this._sendMessage({
        command: 'showProfileSelector',
      });
      log('✅ [DEBUG] Profile selector command sent');
    } catch (error) {
      log('❌ [ERROR] Failed to open profile selector:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  public async killTerminal(): Promise<void> {
    // Kill active terminal

    // 🔍 Enhanced debugging for active terminal detection
    log('🔍 [DEBUG] ========== KILL TERMINAL DEBUG START ==========');

    // Get active terminal ID with detailed logging
    const activeTerminalId = this._terminalManager.getActiveTerminalId();
    log(`🔍 [DEBUG] Active terminal ID from manager: ${activeTerminalId}`);

    // Get all terminals for comparison
    const allTerminals = this._terminalManager.getTerminals();
    log(
      `🔍 [DEBUG] All terminals: ${JSON.stringify(allTerminals.map((t) => ({ id: t.id, name: t.name, isActive: t.isActive })))}`
    );

    // Check active terminal manager state
    const activeManager = (
      this._terminalManager as unknown as {
        _activeTerminalManager?: { getActive(): string | null; hasActive(): boolean };
      }
    )._activeTerminalManager;
    if (activeManager) {
      log(`🔍 [DEBUG] ActiveTerminalManager state: ${activeManager.getActive()}`);
      log(`🔍 [DEBUG] Has active: ${activeManager.hasActive()}`);
    }

    if (!activeTerminalId) {
      log('⚠️ [WARN] No active terminal to kill');
      TerminalErrorHandler.handleTerminalNotFound();
      return;
    }

    log(`🎯 [DEBUG] About to kill terminal: ${activeTerminalId}`);

    // Use the same logic as header × button (killSpecificTerminal)
    try {
      await this.killSpecificTerminal(activeTerminalId);
      log(`🗑️ [SUCCESS] Active terminal killed: ${activeTerminalId}`);
    } catch (error) {
      log('ERROR: Failed to kill terminal:', error);
      showError(`Failed to close terminal: ${String(error)}`);
    }

    log('🔍 [DEBUG] ========== KILL TERMINAL DEBUG END ==========');
  }

  private async _performKillTerminal(terminalId: string): Promise<void> {
    try {
      log('🗑️ [PROVIDER] Performing kill for active terminal:', terminalId);

      // 新しいアーキテクチャ: 統一されたdeleteTerminalメソッドを使用
      const result = await this._terminalManager.deleteTerminal(terminalId, { source: 'panel' });

      if (result.success) {
        log('✅ [PROVIDER] Terminal killed successfully:', terminalId);
        showSuccess(`Terminal ${terminalId} closed`);

        // 状態更新はonStateUpdateイベントで自動的に送信される
      } else {
        log('⚠️ [PROVIDER] Failed to kill terminal:', result.reason);
        showError(result.reason || 'Failed to close terminal');
      }
    } catch (error) {
      log('❌ [PROVIDER] Failed to perform kill terminal:', error);
      showError(`Failed to close terminal: ${String(error)}`);
    }
  }

  private async _performKillSpecificTerminal(terminalId: string): Promise<void> {
    try {
      log('🗑️ [PROVIDER] Performing kill for specific terminal:', terminalId);

      // 新しいアーキテクチャ: 統一されたdeleteTerminalメソッドを使用
      const result = await this._terminalManager.deleteTerminal(terminalId, { source: 'header' });

      if (result.success) {
        log('✅ [PROVIDER] Specific terminal killed successfully:', terminalId);
        showSuccess(`Terminal ${terminalId} closed`);

        // 状態更新はonStateUpdateイベントで自動的に送信される
      } else {
        log('⚠️ [PROVIDER] Failed to kill specific terminal:', result.reason);
        showError(result.reason || 'Failed to close terminal');
      }
    } catch (error) {
      log('❌ [PROVIDER] Failed to perform kill specific terminal:', error);
      showError(`Failed to close terminal: ${String(error)}`);
    }
  }

  public async killSpecificTerminal(terminalId: string): Promise<void> {
    // 🎯 UNIFIED: Use same deletion logic as deleteTerminal case (header × button)
    try {
      log(`🗑️ [DEBUG] Unified deletion process started for: ${terminalId} (source: panel)`);

      // Use unified deletion with proper result handling
      const result = await this._terminalManager.deleteTerminal(terminalId, { source: 'panel' });

      if (result.success) {
        log(`✅ [SUCCESS] Terminal deleted via unified process: ${terminalId}`);
        // Send success response to WebView (same as deleteTerminal case)
        await this._sendMessage({
          command: 'deleteTerminalResponse',
          terminalId,
          success: true,
        });
      } else {
        log(`⚠️ [WARN] Terminal deletion failed: ${terminalId}, reason: ${result.reason}`);
        // Send failure response to WebView (unified with deleteTerminal case)
        await this._sendMessage({
          command: 'deleteTerminalResponse',
          terminalId,
          success: false,
          reason: result.reason,
        });
        // Note: Not throwing error to allow graceful handling
      }
    } catch (error) {
      log('❌ [ERROR] Failed to delete terminal via unified process:', error);
      // Send error response to WebView (unified with deleteTerminal case)
      await this._sendMessage({
        command: 'deleteTerminalResponse',
        terminalId,
        success: false,
        reason: `Delete failed: ${String(error)}`,
      });
      // Note: Not throwing error to allow graceful handling
    }
  }

  public async _initializeTerminal(): Promise<void> {
    log('🔧 [DEBUG] Initializing terminal');

    try {
      const config = getTerminalConfig();
      const existingTerminals = this._terminalManager.getTerminals();

      log('🔧 [DEBUG] Current terminals:', existingTerminals.length);
      existingTerminals.forEach((terminal) => {
        log(`🔧 [DEBUG] - Terminal: ${terminal.name} (${terminal.id})`);
      });

      // VS CODE STANDARD: Don't create terminals during initialization
      // Let session restore or first user interaction handle terminal creation
      let terminalId: string | undefined;

      if (existingTerminals.length > 0) {
        // Terminals exist - use active one or first one
        const activeId = this._terminalManager.getActiveTerminalId();
        terminalId = activeId || existingTerminals[0]?.id;
        log('🔧 [DEBUG] Using existing terminal:', terminalId);

        // For existing terminals, send terminalCreated messages
        // to ensure WebView recreates them (panel move scenario)
        for (const terminal of existingTerminals) {
          log('📤 [DEBUG] Sending terminalCreated for existing terminal:', terminal.id);
          await this._sendMessage({
            command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED,
            terminalId: terminal.id,
            terminalName: terminal.name,
            config: config,
          });
        }
      } else {
        log('📝 [DEBUG] No existing terminals - will handle via session restore or user action');
        terminalId = undefined;
      }

      // Send INIT message with all terminal info
      const initMessage = {
        command: TERMINAL_CONSTANTS.COMMANDS.INIT,
        config,
        terminals: this._terminalManager.getTerminals().map(normalizeTerminalInfo),
        activeTerminalId: terminalId,
      };

      await this._sendMessage(initMessage);

      // Send font settings
      const fontSettings = this.getCurrentFontSettings();
      await this._sendMessage({
        command: 'fontSettingsUpdate',
        fontSettings,
      });

      // 🎯 COORDINATED RESTORATION: Remove duplicate session restoration from _initializeTerminal
      // Session restoration is now handled in _handleWebviewReady with proper coordination
      log('🔧 [TERMINAL-INIT] Session restoration coordination moved to _handleWebviewReady')

      log('✅ [DEBUG] Terminal initialization completed');
    } catch (error) {
      log('❌ [ERROR] Failed to initialize terminal:', error);
      TerminalErrorHandler.handleTerminalCreationError(error);
      throw error;
    }
  }

  /**
   * Webviewメッセージを処理する
   */
  private async _handleWebviewMessage(message: WebviewMessage): Promise<void> {
    log('📨 [DEBUG] Handling webview message:', message.command);
    // Avoid expensive stringify unless debug is enabled
    try {
      const { isDebugEnabled } = require('../utils/logger');
      if (isDebugEnabled && isDebugEnabled()) {
        log('📨 [DEBUG] Full message object:', JSON.stringify(message, null, 2));
      }
    } catch {
      // Fallback: skip detailed payload log
    }

    try {
      // Handle scrollback data responses first (special case)
      if (message.command === 'scrollbackDataCollected') {
        this.handleScrollbackDataResponse(message);
        return;
      }

      // Minimal router: if a handler exists, use it and return
      const dispatched = await this._messageRouter.dispatch(message);
      if (dispatched) {
        return;
      }

      switch (message.command) {
        // htmlScriptTest handled by router
        // timeoutTest handled by router
        // test handled by router

        // webviewReady/READY handled by router

        // requestInitialTerminal handled by router

        // input handled by router
        // resize handled by router
        case TERMINAL_CONSTANTS.COMMANDS.FOCUS_TERMINAL:
          if (message.terminalId) {
            log('🔄 [DEBUG] Switching to terminal:', message.terminalId);
            this._terminalManager.setActiveTerminal(message.terminalId);
          }
          break;
        // createTerminal handled by router
        // splitTerminal handled by router
        // getSettings handled by router
        // updateSettings handled by router
        // focusTerminal handled by router
        // reportPanelLocation handled by router
        // terminalClosed handled by router
        // killTerminal handled by router
        // deleteTerminal handled by router
        case 'switchAiAgent': {
          log('📎 [DEBUG] ========== SWITCH AI AGENT COMMAND RECEIVED ==========');
          log('📎 [DEBUG] Full message:', message);

          const terminalId = message.terminalId as string;
          const action = message.action as string;
          const forceReconnect = hasForceReconnect(message) ? message.forceReconnect : false;

          if (terminalId) {
            log(
              `📎 [DEBUG] Switching AI Agent for terminal: ${terminalId} (action: ${action}, forceReconnect: ${forceReconnect})`
            );

            try {
              let result: AIAgentOperationResult;

              // 🆕 MANUAL RESET: Handle force reconnect requests
              if (forceReconnect) {
                log(`🔄 [MANUAL-RESET] Force reconnecting AI Agent for terminal: ${terminalId}`);
                const agentType = (message.agentType as 'claude' | 'gemini' | 'codex') || 'claude';
                const success = this._terminalManager.forceReconnectAiAgent(terminalId, agentType);

                result = {
                  success,
                  newStatus: success ? 'connected' : 'none',
                  agentType: success ? agentType : null,
                  reason: success ? 'Force reconnected successfully' : 'Force reconnect failed',
                };
              } else {
                // Normal switch operation
                result = this._terminalManager.switchAiAgentConnection(terminalId);
              }

              if (result.success) {
                log(
                  `✅ [DEBUG] AI Agent operation succeeded: ${terminalId}, new status: ${result.newStatus}`
                );
                await this._sendMessage({
                  command: 'switchAiAgentResponse',
                  terminalId,
                  success: true,
                  newStatus: result.newStatus,
                  agentType: result.agentType,
                  forceReconnect: forceReconnect,
                });
              } else {
                log(
                  `⚠️ [DEBUG] AI Agent operation failed: ${terminalId}, reason: ${result.reason}`
                );
                await this._sendMessage({
                  command: 'switchAiAgentResponse',
                  terminalId,
                  success: false,
                  reason: result.reason,
                  newStatus: result.newStatus,
                  forceReconnect: forceReconnect,
                });
              }
            } catch (error) {
              log('❌ [ERROR] Error with AI Agent operation:', error);
              await this._sendMessage({
                command: 'switchAiAgentResponse',
                terminalId,
                success: false,
                reason: 'Internal error occurred',
                forceReconnect: forceReconnect,
              });
            }
          } else {
            log('⚠️ [DEBUG] switchAiAgent: terminalId missing');
          }
          break;
        }

        case 'terminalSerializationResponse': {
          log('📋 [PERSISTENCE] Terminal serialization response received');
          try {
            const serializationData = (message as any).serializationData || {};
            const error = (message as any).error;

            if (error) {
              log(`❌ [PERSISTENCE] Serialization error: ${error}`);
            } else {
              log(
                `✅ [PERSISTENCE] Received serialization data for ${Object.keys(serializationData).length} terminals`
              );

              // Forward to StandardTerminalSessionManager
              if (this._standardSessionManager) {
                this._standardSessionManager.handleSerializationResponse(serializationData);
              }
            }
          } catch (persistenceError) {
            log('❌ [PERSISTENCE] Error handling serialization response:', persistenceError);
          }
          break;
        }

        case 'terminalSerializationRestoreResponse': {
          log('📋 [PERSISTENCE] Terminal serialization restore response received');
          try {
            const restoredCount = (message as any).restoredCount || 0;
            const totalCount = (message as any).totalCount || 0;
            const error = (message as any).error;

            if (error) {
              log(`❌ [PERSISTENCE] Restore error: ${error}`);
            } else {
              log(`✅ [PERSISTENCE] Restored ${restoredCount}/${totalCount} terminals`);
            }
          } catch (restoreError) {
            log('❌ [PERSISTENCE] Error handling restore response:', restoreError);
          }
          break;
        }

        default: {
          log('⚠️ [DEBUG] Unknown webview message command:', message.command);
          break;
        }
      }
    } catch (error) {
      log('❌ [ERROR] Error handling webview message:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  /**
   * ターミナルイベントリスナーを設定する
   */
  private _setupTerminalEventListeners(): void {
    // Clear existing listeners to prevent duplicates during panel moves
    this._clearTerminalEventListeners();

    // Handle terminal output
    const dataDisposable = this._terminalManager.onData((event) => {
      if (event.data) {
        // 🔍 VS Code Pattern: Map Extension terminal ID to WebView terminal ID
        const webviewTerminalId =
          this._terminalIdMapping?.get(event.terminalId) || event.terminalId;

        log(
          '🔍 [VS Code Pattern] Terminal output received:',
          event.data.length,
          'chars, Extension ID:',
          event.terminalId,
          '→ WebView ID:',
          webviewTerminalId,
          'data preview:',
          JSON.stringify(event.data.substring(0, 50))
        );

        const outputMessage = {
          command: TERMINAL_CONSTANTS.COMMANDS.OUTPUT,
          data: event.data,
          terminalId: webviewTerminalId, // Use mapped WebView terminal ID
        };

        log('📤 [VS Code Pattern] Sending OUTPUT to WebView terminal:', webviewTerminalId);
        void this._sendMessage(outputMessage);
      } else {
        log('⚠️ [DATA-FLOW] Empty data received from terminal:', event.terminalId);
      }
    });

    // Handle terminal exit
    const exitDisposable = this._terminalManager.onExit((event) => {
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.EXIT,
        exitCode: event.exitCode,
        terminalId: event.terminalId,
      });
    });

    // Handle terminal creation
    const createdDisposable = this._terminalManager.onTerminalCreated((terminal) => {
      log('🆕 [DEBUG] Terminal created:', terminal.id, terminal.name);

      // 基本的なターミナル作成メッセージ（番号情報を含む）
      const message: WebviewMessage = {
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED,
        terminalId: terminal.id,
        terminalName: terminal.name,
        terminalNumber: terminal.number, // ターミナル番号を追加
        config: getTerminalConfig(),
      };

      // セッション復元されたターミナルの場合、追加データを送信 - DISABLED FOR DEBUGGING
      // if ((terminal as any).isSessionRestored) {
      //   log('🔄 [DEBUG] Terminal is session restored, sending session data');
      //   message.command = 'sessionRestore';
      //   message.sessionRestoreMessage = (terminal as any).sessionRestoreMessage;
      //   message.sessionScrollback = (terminal as any).sessionScrollback || [];
      // }

      void this._sendMessage(message);

      // 🆕 NEW: Auto-save session after terminal creation
      setTimeout(async () => {
        try {
          await this.saveCurrentSession();
          log('💾 [PERSISTENCE] Auto-saved session after terminal creation');
        } catch (error) {
          log('❌ [PERSISTENCE] Failed to auto-save session:', error);
        }
      }, 500); // Small delay to ensure terminal is fully initialized
    });

    // Store disposables for cleanup
    this._terminalEventDisposables.push(dataDisposable, exitDisposable, createdDisposable);

    // Handle terminal removal
    const removedDisposable = this._terminalManager.onTerminalRemoved((terminalId) => {
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_REMOVED,
        terminalId,
      });

      // 🆕 NEW: Auto-save session after terminal removal
      setTimeout(async () => {
        try {
          await this.saveCurrentSession();
          log('💾 [PERSISTENCE] Auto-saved session after terminal removal');
        } catch (error) {
          log('❌ [PERSISTENCE] Failed to auto-save session:', error);
        }
      }, 500);
    });

    // 新しいアーキテクチャ: 状態更新イベントの処理
    const stateUpdateDisposable = this._terminalManager.onStateUpdate((state) => {
      void this._sendMessage({
        command: 'stateUpdate',
        state,
      });
    });

    // ターミナルフォーカスイベント処理
    const focusDisposable = this._terminalManager.onTerminalFocus((terminalId) => {
      void this._sendMessage({
        command: 'focusTerminal',
        terminalId,
      });
    });

    // Add remaining disposables
    this._terminalEventDisposables.push(removedDisposable, stateUpdateDisposable, focusDisposable);

    // Note: CLI Agent status change events are handled by _setupCliAgentStatusListeners()
  }

  /**
   * Clear terminal event listeners to prevent duplicates
   */
  private _clearTerminalEventListeners(): void {
    this._terminalEventDisposables.forEach((disposable) => {
      disposable.dispose();
    });
    this._terminalEventDisposables = [];
    log('🧹 [DEBUG] Terminal event listeners cleared');
  }

  /**
   * Set up CLI Agent status change listeners
   */
  private _setupCliAgentStatusListeners(): void {
    console.log('🎯 [PROVIDER] Setting up CLI Agent status listeners');
    // CLI Agent状態変更を監視 - Full State Sync方式で完全同期
    const claudeStatusDisposable = this._terminalManager.onCliAgentStatusChange((event) => {
      try {
        console.log('📡 [PROVIDER] Received CLI Agent status change:', event);

        // Full State Sync: 全ターミナルの状態を完全同期
        console.log('🔄 [PROVIDER] Triggering full CLI Agent state sync');
        this.sendFullCliAgentStateSync();
      } catch (error) {
        log('❌ [ERROR] CLI Agent status change processing failed:', error);
        // エラーがあっても継続
      }
    });

    // disposablesに追加
    this._extensionContext.subscriptions.push(claudeStatusDisposable);
    console.log('✅ [PROVIDER] CLI Agent status listeners setup complete');
  }

  /**
   * Set up configuration change listeners for VS Code standard settings
   */
  private _setupConfigurationChangeListeners(): void {
    // Monitor VS Code settings changes
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
      let shouldUpdateSettings = false;
      let shouldUpdateFontSettings = false;
      let shouldUpdatePanelLocation = false;

      // Check for general settings changes
      if (
        event.affectsConfiguration('editor.multiCursorModifier') ||
        event.affectsConfiguration('terminal.integrated.altClickMovesCursor') ||
        event.affectsConfiguration('secondaryTerminal.altClickMovesCursor') ||
        event.affectsConfiguration('secondaryTerminal.theme') ||
        event.affectsConfiguration('secondaryTerminal.cursorBlink')
      ) {
        shouldUpdateSettings = true;
      }

      // Check for font settings changes
      if (
        event.affectsConfiguration('terminal.integrated.fontSize') ||
        event.affectsConfiguration('terminal.integrated.fontFamily') ||
        event.affectsConfiguration('terminal.integrated.fontWeight') ||
        event.affectsConfiguration('terminal.integrated.fontWeightBold') ||
        event.affectsConfiguration('terminal.integrated.lineHeight') ||
        event.affectsConfiguration('terminal.integrated.letterSpacing') ||
        event.affectsConfiguration('editor.fontSize') ||
        event.affectsConfiguration('editor.fontFamily') ||
        event.affectsConfiguration('secondaryTerminal.fontWeight') ||
        event.affectsConfiguration('secondaryTerminal.fontWeightBold') ||
        event.affectsConfiguration('secondaryTerminal.lineHeight') ||
        event.affectsConfiguration('secondaryTerminal.letterSpacing')
      ) {
        shouldUpdateFontSettings = true;
      }

      // 🆕 Check for dynamic split direction settings changes (Issue #148)
      if (
        event.affectsConfiguration('secondaryTerminal.dynamicSplitDirection') ||
        event.affectsConfiguration('secondaryTerminal.panelLocation')
      ) {
        shouldUpdateSettings = true;
        shouldUpdatePanelLocation = true;
      }

      if (shouldUpdateSettings) {
        log('⚙️ [DEBUG] VS Code settings changed, updating webview...');
        const settings = this.getCurrentSettings();
        void this._sendMessage({
          command: 'settingsResponse',
          settings,
        });
      }

      if (shouldUpdateFontSettings) {
        log('🎨 [DEBUG] VS Code font settings changed, updating webview...');
        const fontSettings = this.getCurrentFontSettings();
        void this._sendMessage({
          command: 'fontSettingsUpdate',
          fontSettings,
        });
      }

      // 🆕 Handle panel location setting changes (Issue #148)
      if (shouldUpdatePanelLocation) {
        log('📍 [DEBUG] Panel location settings changed, re-detecting and updating...');
        setTimeout(() => {
          this._requestPanelLocationDetection();
        }, 100); // Small delay to ensure settings are applied
      }
    });

    // Add to disposables
    this._extensionContext.subscriptions.push(configChangeDisposable);
  }

  /**
   * Handle WebView ready state
   */
  // Removed _handleWebviewReady - not needed with fresh start approach

  /**
   * Public method for StandardTerminalSessionManager to send messages
   */
  public async sendMessageToWebview(message: WebviewMessage): Promise<void> {
    log(`📤 [PROVIDER] Public sendMessageToWebview called: ${message.command}`);
    await this._sendMessage(message);
  }

  /**
   * Webviewにメッセージを送信する
   */
  private async _sendMessage(message: WebviewMessage): Promise<void> {
    // Simple direct sending - no state management needed with fresh start approach
    if (!this._view) {
      log('⚠️ [WARN] No webview available to send message');
      return;
    }

    await this._sendMessageDirect(message);
  }

  private async _sendMessageDirect(message: WebviewMessage): Promise<void> {
    if (!this._view) {
      log('⚠️ [WARN] No webview available to send message');
      return;
    }

    try {
      await this._view.webview.postMessage(message);
      log(`📤 [DEBUG] Sent message: ${message.command}`);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('disposed') || error.message.includes('Webview is disposed'))
      ) {
        log('⚠️ [WARN] Webview disposed during message send');
        return;
      }

      log('❌ [ERROR] Failed to send message to webview:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    try {
      log('🎨 [PROVIDER] Generating WebView HTML using HTML Generation Service');

      const htmlOptions: HtmlGenerationOptions = {
        webview,
        extensionUri: this._extensionContext.extensionUri,
        includeSplitStyles: true,
        includeCliAgentStyles: true,
      };

      const html = this._htmlGenerationService.generateMainHtml(htmlOptions);

      // Validate generated HTML
      const validation = this._htmlGenerationService.validateHtml(html);
      if (!validation.isValid) {
        log('⚠️ [PROVIDER] Generated HTML validation warnings:', validation.errors);
        // Continue anyway - these are usually non-critical issues
      }

      log(`✅ [PROVIDER] HTML generated successfully via service (${html.length} chars)`);
      return html;
    } catch (error) {
      log('❌ [PROVIDER] HTML generation failed, falling back to service fallback HTML:', error);

      // Use service fallback HTML instead of inline fallback
      return this._htmlGenerationService.generateFallbackHtml({
        title: 'Terminal Loading...',
        message: 'HTML generation encountered an error. Retrying...',
        isLoading: true,
      });
    }
  }

  private getCurrentSettings(): PartialTerminalSettings {
    const configService = getUnifiedConfigurationService();
    const settings = configService.getCompleteTerminalSettings();
    const altClickSettings = configService.getAltClickSettings();

    // Use unified service for all configuration access
    return {
      cursorBlink: settings.cursorBlink,
      theme: settings.theme || 'auto',
      // VS Code standard settings for Alt+Click functionality
      altClickMovesCursor: altClickSettings.altClickMovesCursor,
      multiCursorModifier: altClickSettings.multiCursorModifier,
      // CLI Agent Code integration settings
      enableCliAgentIntegration: configService.isFeatureEnabled('cliAgentIntegration'),
      highlightActiveBorder: configService.get('sidebarTerminal', 'highlightActiveBorder', true),
      // Dynamic split direction settings (Issue #148)
      dynamicSplitDirection: configService.isFeatureEnabled('dynamicSplitDirection'),
      panelLocation: configService.get('sidebarTerminal', 'panelLocation', 'auto'),
    };
  }

  private getCurrentFontSettings(): WebViewFontSettings {
    const configService = getUnifiedConfigurationService();

    return configService.getWebViewFontSettings();
  }

  private async updateSettings(settings: PartialTerminalSettings): Promise<void> {
    try {
      const configService = getUnifiedConfigurationService();
      log('⚙️ [PROVIDER] Updating settings via UnifiedConfigurationService:', settings);

      // Update VS Code settings using unified configuration service
      if (settings.cursorBlink !== undefined) {
        await configService.update('sidebarTerminal', 'cursorBlink', settings.cursorBlink);
      }
      if (settings.theme) {
        await configService.update('sidebarTerminal', 'theme', settings.theme);
      }
      if (settings.enableCliAgentIntegration !== undefined) {
        await configService.update(
          'sidebarTerminal',
          'enableCliAgentIntegration',
          settings.enableCliAgentIntegration
        );
      }
      if (settings.highlightActiveBorder !== undefined) {
        await configService.update(
          'sidebarTerminal',
          'highlightActiveBorder',
          settings.highlightActiveBorder
        );
      }
      if (settings.dynamicSplitDirection !== undefined) {
        await configService.update(
          'sidebarTerminal',
          'dynamicSplitDirection',
          settings.dynamicSplitDirection
        );
      }
      if (settings.panelLocation !== undefined) {
        await configService.update('sidebarTerminal', 'panelLocation', settings.panelLocation);
      }
      // Note: Font settings are read directly from VS Code's terminal/editor settings

      log('✅ [DEBUG] Settings updated successfully');
      showSuccess('Settings updated successfully');

      // Reinitialize terminal with new settings to apply changes
      await this._initializeTerminal();
    } catch (error) {
      log('❌ [ERROR] Failed to update settings:', error);
      showError(`Failed to update settings: ${String(error)}`);
    }
  }

  /**
   * CLI Agent状態をWebViewに送信
   */
  public sendCliAgentStatusUpdate(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null = null
  ): void {
    try {
      const message = {
        command: 'cliAgentStatusUpdate' as const,
        cliAgentStatus: {
          activeTerminalName,
          status,
          agentType,
        },
      };

      console.log('[DEBUG] Sending message to WebView:', message);
      void this._sendMessage(message);
    } catch (error) {
      // エラーがあっても継続
    }
  }

  /**
   * 全てのターミナルのCLI Agent状態を完全同期する
   * DISCONNECTED terminals状態保持問題の解決策
   */
  public sendFullCliAgentStateSync(): void {
    console.log('🚀 [PROVIDER] sendFullCliAgentStateSync() called');
    try {
      const connectedAgentId = this._terminalManager.getConnectedAgentTerminalId();
      const connectedAgentType = this._terminalManager.getConnectedAgentType();
      const disconnectedAgents = this._terminalManager.getDisconnectedAgents();

      console.log('🔍 [PROVIDER] Current CLI Agent state:', {
        connected: { id: connectedAgentId, type: connectedAgentType },
        disconnected: Array.from(disconnectedAgents.entries()),
      });

      // Build complete terminal states map
      const terminalStates: { [terminalId: string]: { status: string; agentType: string | null } } =
        {};

      // Get all terminals
      const allTerminals = this._terminalManager.getTerminals();

      // Set status for all terminals
      for (const terminal of allTerminals) {
        const terminalId = terminal.id;

        if (connectedAgentId === terminalId && connectedAgentType) {
          // Connected agent
          terminalStates[terminalId] = {
            status: 'connected',
            agentType: connectedAgentType,
          };
        } else if (disconnectedAgents.has(terminalId)) {
          // Disconnected agent
          const agentInfo = disconnectedAgents.get(terminalId);
          if (!agentInfo) {
            continue;
          }
          terminalStates[terminalId] = {
            status: 'disconnected',
            agentType: agentInfo.type,
          };
        } else {
          // No agent or terminated agent
          terminalStates[terminalId] = {
            status: 'none',
            agentType: null,
          };
        }
      }

      // Send complete state to WebView
      const message = {
        command: 'cliAgentFullStateSync',
        terminalStates: terminalStates,
      };

      console.log('📤 [PROVIDER] Sending full CLI Agent state sync:', message);

      if (this._view) {
        void this._view.webview.postMessage(message);
        console.log('✅ [PROVIDER] Full CLI Agent state sync sent successfully');
      } else {
        console.warn('⚠️ [PROVIDER] WebView not available for full state sync');
      }
    } catch (error) {
      log('❌ [ERROR] Failed to send full CLI Agent state sync:', error);
    }
  }

  /**
   * VS Code standard: Immediate session restore without blocking
   */
  // Removed _performAsyncSessionRestore - integrated into _handleWebviewReady for coordination

  /**
   * VS Code standard: Schedule initial terminal creation when no session data
   */
  private _scheduleInitialTerminalCreation(): void {
    log('🚀 [DEBUG] _scheduleInitialTerminalCreation called');

    // Schedule creation for when user actually views the terminal
    // This mimics VS Code's behavior of creating terminals on-demand
    setTimeout(() => {
      log('⏰ [DEBUG] setTimeout callback executing for initial terminal creation');
      const currentTerminalCount = this._terminalManager.getTerminals().length;
      log(`📊 [DEBUG] Current terminal count: ${currentTerminalCount}`);

      if (currentTerminalCount === 0) {
        log('🎆 [INITIAL] Creating initial terminals (no session data)');
        try {
          // Create 1 terminal by default for cleaner startup
          log('🔧 [DEBUG] Calling _terminalManager.createTerminal()...');
          const terminalId = this._terminalManager.createTerminal();
          log(`✅ [INITIAL] Initial terminal created: ${terminalId}`);

          // Set the terminal as active
          log('🎯 [DEBUG] Setting terminal as active...');
          this._terminalManager.setActiveTerminal(terminalId);
          log(`✅ [DEBUG] Terminal set as active: ${terminalId}`);

          // Send update to WebView
          log('📡 [DEBUG] Sending terminal update to WebView...');
          void this._sendMessage({
            command: 'stateUpdate',
            state: this._terminalManager.getCurrentState(),
          });
        } catch (error) {
          log(`❌ [INITIAL] Failed to create initial terminals: ${String(error)}`);
          console.error('❌ [INITIAL] Terminal creation error details:', error);
          // Fallback: try to create at least one terminal
          try {
            const terminalId = this._terminalManager.createTerminal();
            log(`✅ [INITIAL] Fallback terminal created: ${terminalId}`);
          } catch (fallbackError) {
            log(`❌ [INITIAL] Fallback terminal creation also failed: ${String(fallbackError)}`);
            console.error('❌ [INITIAL] Fallback error details:', fallbackError);
          }
        }
      } else {
        log(
          `🔍 [DEBUG] Terminals already exist (${currentTerminalCount}), skipping initial creation`
        );
      }
    }, 100); // Very short delay to ensure WebView is ready
  }

  /**
   * 複数ターミナルの確実な作成を保証
   */
  private _ensureMultipleTerminals(): void {
    try {
      const currentTerminals = this._terminalManager.getTerminals().length;
      log(`🔍 [ENSURE] Current terminal count: ${currentTerminals}`);

      if (currentTerminals < 1) {
        log('🎯 [ENSURE] Creating minimum terminal (1)');

        // 最低1つのターミナルを確保
        const terminalId = this._terminalManager.createTerminal();
        log(`✅ [ENSURE] Created terminal: ${terminalId}`);

        // ターミナルをアクティブに設定
        this._terminalManager.setActiveTerminal(terminalId);
        log(`🎯 [ENSURE] Set terminal as active: ${terminalId}`);
      } else {
        log(`✅ [ENSURE] Sufficient terminals already exist: ${currentTerminals}`);
      }
    } catch (error) {
      log(`❌ [ENSURE] Failed to ensure terminals: ${String(error)}`);
    }
  }

  /**
   * Send session management message to WebView - DISABLED FOR DEBUGGING
   */
  // public sendSessionMessage(message: WebviewMessage): void {
  //   try {
  //     void this._sendMessage(message);
  //   } catch (error) {
  //     console.error('[SESSION] Error sending session message to WebView:', error);
  //   }
  // }

  /**
   * Restore WebView state after panel move
   */
  /**
   * Configure WebView options and security
   */
  private _configureWebview(webviewView: vscode.WebviewView): void {
    try {
      log('🔧 [DEBUG] Configuring WebView options...');

      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this._extensionContext.extensionUri],
      };

      log('✅ [DEBUG] WebView options configured successfully');
    } catch (error) {
      log('❌ [ERROR] Failed to configure WebView options:', error);
      throw error; // Re-throw to be handled by caller
    }
  }

  /**
   * Set WebView HTML with robust error handling
   */
  private _setWebviewHtml(webviewView: vscode.WebviewView, isPanelMove: boolean): void {
    try {
      log('🎆 [TRACE] ===========================================');
      log('🎆 [TRACE] _setWebviewHtml called');
      log('🎆 [TRACE] isPanelMove:', isPanelMove);
      log('🎆 [TRACE] WebView object exists:', !!webviewView.webview);
      log('🎆 [TRACE] Generating HTML for WebView...');

      const html = this._getHtmlForWebview(webviewView.webview);

      if (!html || html.length === 0) {
        throw new Error('Generated HTML is empty');
      }

      log('🎆 [TRACE] Generated HTML length:', html.length);
      log('🎆 [TRACE] HTML preview (first 300 chars):', html.substring(0, 300));
      log('🎆 [TRACE] Setting webview HTML...');

      webviewView.webview.html = html;

      log('✅ [TRACE] HTML set successfully');
      log('🎆 [TRACE] Verifying HTML was set...');
      log('🎆 [TRACE] WebView HTML length after setting:', webviewView.webview.html.length);
    } catch (error) {
      log('❌ [ERROR] Failed to set WebView HTML:', error);

      // Set fallback HTML to prevent complete failure
      const fallbackHtml = this._getFallbackHtml();
      webviewView.webview.html = fallbackHtml;

      log('🔄 [DEBUG] Fallback HTML set');
      throw error; // Re-throw to be handled by caller
    }
  }

  /**
   * Set up WebView event listeners
   */
  private _setupWebviewEventListeners(webviewView: vscode.WebviewView, isPanelMove: boolean): void {
    try {
      log('🎆 [TRACE] ===========================================');
      log('🎆 [TRACE] _setupWebviewEventListeners called');
      log('🎆 [TRACE] isPanelMove:', isPanelMove);
      log('🎆 [TRACE] WebView exists:', !!webviewView.webview);

      // Message listener is set in resolveWebviewView (before HTML). Avoid duplicate listeners here.
      log('🎆 [TRACE] Message listener already configured in resolveWebviewView');

      // Set up visibility change handler for panel move detection
      webviewView.onDidChangeVisibility(
        () => {
          if (webviewView.visible) {
            log('👁️ [DEBUG] WebView became visible - triggering panel location detection');

            // 🆕 Trigger panel location detection when WebView becomes visible
            // This handles cases where the panel was moved while hidden
            setTimeout(() => {
              log('📍 [DEBUG] Requesting panel location detection after visibility change');
              this._requestPanelLocationDetection();
            }, 500); // Small delay to ensure WebView is fully loaded
          } else {
            log('👁️ [DEBUG] WebView became hidden');
          }
        },
        null,
        this._extensionContext.subscriptions
      );

      log('✅ [DEBUG] WebView event listeners set up successfully');
    } catch (error) {
      log('❌ [ERROR] Failed to set up WebView event listeners:', error);
      throw error; // Re-throw to be handled by caller
    }
  }

  /**
   * Handle WebView setup errors gracefully
   */
  private _handleWebviewSetupError(webviewView: vscode.WebviewView, error: unknown): void {
    try {
      log('🚨 [DEBUG] Handling WebView setup error...');

      // Ensure we have some HTML set, even if it's just an error message
      const errorHtml = this._getErrorHtml(error);
      webviewView.webview.html = errorHtml;

      // Report error through standard channels
      TerminalErrorHandler.handleWebviewError(error);

      log('🔄 [DEBUG] Error HTML set as fallback');
    } catch (fallbackError) {
      log('💥 [CRITICAL] Failed to handle WebView setup error:', fallbackError);

      // Last resort: set minimal HTML
      webviewView.webview.html =
        '<html><body><h3>Terminal initialization failed</h3></body></html>';
    }
  }

  /**
   * Generate fallback HTML when main HTML generation fails
   */
  private _getFallbackHtml(): string {
    return this._htmlGenerationService.generateFallbackHtml({
      title: 'Terminal Loading...',
      message: 'Please wait while the terminal initializes.',
      isLoading: true,
    });
  }

  /**
   * Generate error HTML when setup fails
   */
  private _getErrorHtml(error: unknown): string {
    return this._htmlGenerationService.generateErrorHtml({
      error,
      allowRetry: true,
      customMessage: `Terminal initialization failed. Please try reloading the terminal view or restarting VS Code.`,
    });
  }

  // Removed _restoreWebviewState - not needed with fresh start approach

  /**
   * Get current settings for restoration
   */
  private _getCurrentSettings(): PartialTerminalSettings {
    const configService = getUnifiedConfigurationService();
    const config = configService.getExtensionTerminalConfig();
    const webViewSettings = configService.getWebViewTerminalSettings();

    return {
      shell: config.shell || '',
      shellArgs: config.shellArgs || [],
      fontSize: config.fontSize || 14,
      fontFamily: config.fontFamily || 'monospace',
      theme: webViewSettings.theme || 'dark',
      cursor: config.cursor || {
        style: 'block',
        blink: true,
      },
      maxTerminals: config.maxTerminals || 5,
      enableCliAgentIntegration: config.enableCliAgentIntegration || false,
      // 🆕 Issue #148: Dynamic split direction settings
      dynamicSplitDirection: webViewSettings.dynamicSplitDirection,
      panelLocation: webViewSettings.panelLocation || 'auto',
    };
  }

  /**
   * Get Alt+Click settings for restoration
   */
  private _getAltClickSettings(): { altClickMovesCursor: boolean; multiCursorModifier: string } {
    const vsCodeAltClickSetting = vscode.workspace
      .getConfiguration('terminal.integrated')
      .get<boolean>('altClickMovesCursor', false);

    const vsCodeMultiCursorModifier = vscode.workspace
      .getConfiguration('editor')
      .get<string>('multiCursorModifier', 'alt');

    const extensionAltClickSetting = vscode.workspace
      .getConfiguration('secondaryTerminal')
      .get<boolean>('altClickMovesCursor', vsCodeAltClickSetting);

    return {
      altClickMovesCursor: extensionAltClickSetting,
      multiCursorModifier: vsCodeMultiCursorModifier,
    };
  }

  /**
   * Simple webview availability check (removed complex health check)
   */
  private _isWebviewAvailable(): boolean {
    return !!(this._view && this._view.webview);
  }

  // Removed complex message processing - simplified approach

  /**
   * Handle session restoration data request from WebView (REFACTORED)
   *
   * Extracted from message handler for better maintainability and testability
   * Follows single responsibility principle and reduces code duplication
   */
  private async _handleSessionRestorationDataRequest(message: WebviewMessage): Promise<void> {
    log('🔄 [DEBUG] Session restoration data requested from WebView');
    const terminalId = message.terminalId as string;

    if (!terminalId) {
      log('⚠️ [DEBUG] No terminalId provided for session restoration request');
      return;
    }

    try {
      // Get session data from StandardTerminalSessionManager
      if (!this._standardSessionManager) {
        log('⚠️ [DEBUG] No StandardTerminalSessionManager available for session restoration');
        await this._sendSessionRestorationResponse(terminalId, null);
        return;
      }

      const sessionInfo = this._standardSessionManager.getSessionInfo();

      if (!sessionInfo || !sessionInfo.exists || !sessionInfo.terminals) {
        log('📭 [DEBUG] No session info available');
        await this._sendSessionRestorationResponse(terminalId, null);
        return;
      }

      // Find the terminal in saved session data
      const terminalSession = sessionInfo.terminals.find((t) => t.id === terminalId);

      if (terminalSession) {
        log(`🔄 [DEBUG] Found session data for terminal ${terminalId}`);
        await this._sendSessionRestorationResponse(terminalId, terminalSession);
      } else {
        log(`📭 [DEBUG] No session data found for terminal ${terminalId}`);
        await this._sendSessionRestorationResponse(terminalId, null);
      }
    } catch (error) {
      log(
        `❌ [ERROR] Failed to handle session restoration request for terminal ${terminalId}:`,
        error
      );
      await this._sendSessionRestorationResponse(terminalId, null);
    }
  }

  /**
   * Send session restoration response to WebView (REFACTORED)
   *
   * Centralized response handling for consistent message format
   * and error handling across all session restoration responses
   */
  private async _sendSessionRestorationResponse(
    terminalId: string,
    sessionData: unknown
  ): Promise<void> {
    try {
      await this._sendMessage({
        command: 'sessionRestorationData',
        terminalId: terminalId,
        sessionData: sessionData,
        timestamp: Date.now(),
      });
    } catch (error) {
      log(
        `❌ [ERROR] Failed to send session restoration response for terminal ${terminalId}:`,
        error
      );
    }
  }

  /**
   * Handle terminal persistence messages
   */
  private async _handlePersistenceMessage(message: WebviewMessage): Promise<void> {
    try {
      if (!this._persistenceHandler) {
        log('❌ [PERSISTENCE] Persistence handler not initialized');

        // Determine proper response command
        const responseCommand = message.command.endsWith('Response')
          ? message.command
          : `${message.command}Response`;

        await this._sendMessage({
          command: responseCommand as any,
          success: false,
          error: 'Persistence handler not available',
          messageId: message.messageId,
        });
        return;
      }

      log(`📨 [PERSISTENCE] Handling message: ${message.command}`);

      // Convert webview message to persistence message format
      const persistenceCommand = message.command.replace('persistence', '').toLowerCase();
      const persistenceMessage = {
        command: persistenceCommand as 'saveSession' | 'restoreSession' | 'clearSession',
        data: message.data,
        terminalId: message.terminalId,
      };

      // Process the persistence request
      const response = await this._persistenceHandler.handleMessage(persistenceMessage);

      // Determine proper response command
      const responseCommand = message.command.endsWith('Response')
        ? message.command
        : `${message.command}Response`;

      // Send response back to WebView
      await this._sendMessage({
        command: responseCommand as any,
        success: response.success,
        data: response.data,
        error: response.error,
        terminalCount: response.terminalCount,
        messageId: message.messageId,
      });
    } catch (error) {
      log(`❌ [PERSISTENCE] Message handling failed: ${error}`);

      // Determine proper response command
      const responseCommand = message.command.endsWith('Response')
        ? message.command
        : `${message.command}Response`;

      await this._sendMessage({
        command: responseCommand as any,
        success: false,
        error: `Persistence operation failed: ${(error as Error).message}`,
        messageId: message.messageId,
      });
    }
  }

  /**
   * Handle legacy persistence messages for backward compatibility
   */
  private async _handleLegacyPersistenceMessage(message: WebviewMessage): Promise<void> {
    try {
      log(`📨 [PERSISTENCE-LEGACY] Handling legacy message: ${message.command}`);

      // Convert legacy message to new format
      let newCommand: string;
      switch (message.command) {
        case 'terminalSerializationRequest':
          newCommand = 'persistenceSaveSession';
          break;
        case 'terminalSerializationRestoreRequest':
          newCommand = 'persistenceRestoreSession';
          break;
        default:
          throw new Error(`Unknown legacy persistence command: ${message.command}`);
      }

      // Forward to new handler
      await this._handlePersistenceMessage({
        ...message,
        command: newCommand as any,
      });
    } catch (error) {
      log(`❌ [PERSISTENCE-LEGACY] Legacy message handling failed: ${error}`);

      // Determine proper response command
      const responseCommand = message.command.endsWith('Response')
        ? message.command
        : `${message.command}Response`;

      await this._sendMessage({
        command: responseCommand as any,
        success: false,
        error: `Legacy persistence operation failed: ${(error as Error).message}`,
      });
    }
  }

  /**
   * Trigger automatic session save
   */
  public async saveCurrentSession(): Promise<boolean> {
    log('🔥 [PERSISTENCE-DEBUG] === saveCurrentSession called ===');

    try {
      if (!this._persistenceHandler) {
        log('❌ [PERSISTENCE] Cannot save session - handler not initialized');
        return false;
      }

      log('🔍 [PERSISTENCE-DEBUG] Persistence handler available, getting terminals...');

      // 🆕 NEW: Request scrollback data from WebView before saving
      const terminals = this._terminalManager.getTerminals();
      log(`🔍 [PERSISTENCE-DEBUG] Found ${terminals.length} terminals to save`);

      if (terminals.length === 0) {
        log('⚠️ [PERSISTENCE-DEBUG] No terminals to save');
        return false;
      }

      const terminalData = await Promise.all(
        terminals.map(async (terminal, index) => {
          log(
            `🔍 [PERSISTENCE-DEBUG] Processing terminal ${index + 1}/${terminals.length}: ${terminal.id} (${terminal.name})`
          );

          // Request scrollback data from WebView
          log(`📤 [PERSISTENCE-DEBUG] About to request scrollback for terminal ${terminal.id}`);
          const scrollbackData = await this.requestScrollbackFromWebView(terminal.id);

          log(
            `📦 [PERSISTENCE-DEBUG] Terminal ${terminal.id} scrollback promise resolved: ${scrollbackData.length} lines`
          );

          return {
            id: terminal.id,
            name: terminal.name,
            scrollback: scrollbackData,
            workingDirectory: terminal.cwd || '',
            shellCommand: terminal.shell || '',
            isActive: terminal.isActive || false,
          };
        })
      );

      log('🔍 [PERSISTENCE-DEBUG] All terminal data collected, calling persistence handler...');

      const response = await this._persistenceHandler.handleMessage({
        command: 'saveSession',
        data: terminalData,
      });

      log(`🔍 [PERSISTENCE-DEBUG] Persistence handler response:`, response);

      if (response.success) {
        log(`✅ [PERSISTENCE] Session saved successfully: ${response.terminalCount} terminals`);
        return true;
      } else {
        log(`❌ [PERSISTENCE] Session save failed: ${response.error}`);
        return false;
      }
    } catch (error) {
      log(`❌ [PERSISTENCE] Auto-save failed: ${error}`);
      console.error('Persistence save error:', error);
      return false;
    }
  }

  /**
   * Request scrollback data from WebView for a specific terminal
   */
  /**
   * Request scrollback data from WebView for a specific terminal
   */
  // Map to store pending scrollback requests
  private pendingScrollbackRequests = new Map<
    string,
    {
      resolve: (data: string[]) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  private async requestScrollbackFromWebView(terminalId: string): Promise<string[]> {
    try {
      if (!this._view) {
        log('⚠️ [PERSISTENCE] WebView not available for scrollback request');
        return [];
      }

      // Create a promise to wait for the WebView response
      return new Promise((resolve, reject) => {
        const requestId = `scrollback-${terminalId}-${Date.now()}`;

        const timeout = setTimeout(() => {
          this.pendingScrollbackRequests.delete(requestId);
          log(`⏰ [PERSISTENCE] Scrollback request timeout for terminal ${terminalId}`);
          resolve([]); // Return empty array instead of rejecting to avoid breaking persistence
        }, 10000); // 10 second timeout

        // Store the promise resolvers
        this.pendingScrollbackRequests.set(requestId, {
          resolve,
          reject,
          timeout,
        });

        // Send the request to WebView
        this._view!.webview.postMessage({
          command: 'extractScrollbackData',
          terminalId,
          requestId,
          maxLines: 1000, // Request up to 1000 lines
        });

        log(
          `📤 [PERSISTENCE] Requested scrollback data for terminal ${terminalId} (requestId: ${requestId})`
        );
      });
    } catch (error) {
      log(`❌ [PERSISTENCE] Failed to request scrollback from WebView: ${error}`);
      return [];
    }
  }

  /**
   * Handle scrollback data response from WebView
   * This should be called from the main message handler
   */
  private handleScrollbackDataResponse(message: any): void {
    if (message.command !== 'scrollbackDataCollected' || !message.requestId) {
      return;
    }

    const requestId = message.requestId;
    const pendingRequest = this.pendingScrollbackRequests.get(requestId);

    if (!pendingRequest) {
      log(`⚠️ [PERSISTENCE] No pending request found for scrollback response: ${requestId}`);
      return;
    }

    // Clean up the pending request
    clearTimeout(pendingRequest.timeout);
    this.pendingScrollbackRequests.delete(requestId);

    if (message.error) {
      log(
        `⚠️ [PERSISTENCE] Scrollback extraction error for request ${requestId}: ${message.error}`
      );
      pendingRequest.resolve([]); // Return empty array instead of rejecting
    } else {
      const dataLength = message.scrollbackData?.length || 0;
      log(`✅ [PERSISTENCE] Successfully received ${dataLength} lines for request ${requestId}`);
      log(
        `📦 [PERSISTENCE] About to resolve promise with scrollbackData:`,
        message.scrollbackData ? 'present' : 'missing'
      );
      pendingRequest.resolve(message.scrollbackData || []);
    }
  }

  /**
   * Trigger automatic session restore
   */
  public async restoreLastSession(): Promise<boolean> {
    log('🔥 [RESTORE-DEBUG] === restoreLastSession called ===');

    try {
      if (!this._persistenceHandler) {
        log('❌ [PERSISTENCE] Cannot restore session - handler not initialized');
        return false;
      }

      log('🔍 [RESTORE-DEBUG] Persistence handler available, requesting restore...');

      const response = await this._persistenceHandler.handleMessage({
        command: 'restoreSession',
      });

      log('🔍 [RESTORE-DEBUG] Persistence handler response:', response);

      if (response.success && response.data && Array.isArray(response.data)) {
        log(`🔍 [RESTORE-DEBUG] Restore data available: ${response.data.length} terminals`);
        log('📄 [RESTORE-DEBUG] Restore data sample:', response.data.slice(0, 1));

        // 🎯 IMPROVED: Create terminal processes and coordinate with WebView properly
        const restoredTerminals = [];
        const terminalMappings: Array<{
          oldId: string;
          newId: string;
          terminalData: any;
        }> = [];

        for (const terminalData of response.data) {
          try {
            log(
              `🔧 [RESTORE-DEBUG] Creating terminal process for: ${terminalData.name || terminalData.id}`
            );

            // Create actual terminal process using TerminalManager
            const newTerminalId = this._terminalManager.createTerminal();
            const terminal = this._terminalManager.getTerminal(newTerminalId);

            if (terminal) {
              log(`✅ [RESTORE-DEBUG] Terminal process created: ${terminal.id}`);

              // Store mapping for WebView coordination
              terminalMappings.push({
                oldId: terminalData.id,
                newId: terminal.id,
                terminalData: terminalData,
              });

              restoredTerminals.push(terminal);
            } else {
              log(
                `❌ [RESTORE-DEBUG] Failed to create terminal process for: ${terminalData.name || terminalData.id}`
              );
            }
          } catch (terminalError) {
            log(`❌ [RESTORE-DEBUG] Failed to restore terminal ${terminalData.id}:`, terminalError);
          }
        }

        if (restoredTerminals.length > 0) {
          // 🎯 IMPROVED: Send terminal creation notifications to WebView first
          for (const mapping of terminalMappings) {
            await this._sendMessage({
              command: 'terminalCreated',
              terminal: {
                id: mapping.newId,
                name: mapping.terminalData.name || `Terminal ${mapping.newId}`,
                cwd: mapping.terminalData.cwd || process.cwd(),
                isActive: mapping.terminalData.isActive || false,
              },
            });
          }

          // Wait for WebView to process terminal creation
          await new Promise(resolve => setTimeout(resolve, 200));

          // 🎯 IMPROVED: Then restore content with proper ID mapping
          for (const mapping of terminalMappings) {
            if (
              mapping.terminalData.scrollback &&
              Array.isArray(mapping.terminalData.scrollback) &&
              mapping.terminalData.scrollback.length > 0
            ) {
              log(
                `📜 [RESTORE-DEBUG] Restoring scrollback for ${mapping.newId}: ${mapping.terminalData.scrollback.length} lines`
              );

              // Send scrollback restoration to WebView with NEW terminal ID
              await this._sendMessage({
                command: 'restoreScrollback',
                terminalId: mapping.newId, // Use NEW terminal ID
                scrollback: mapping.terminalData.scrollback,
              });
            }
          }

          log(
            `✅ [PERSISTENCE] Session restored successfully: ${restoredTerminals.length}/${response.data.length} terminals`
          );

          // Set active terminal if specified
          const activeMapping = terminalMappings.find((m) => m.terminalData.isActive);
          if (activeMapping) {
            this._terminalManager.setActiveTerminal(activeMapping.newId);
            await this._sendMessage({
              command: 'setActiveTerminal',
              terminalId: activeMapping.newId, // Use NEW terminal ID
            });
          }

          // Notify WebView of successful restoration completion
          await this._sendMessage({
            command: 'sessionRestored',
            success: true,
            restoredCount: restoredTerminals.length,
            totalCount: response.data.length,
          });

          return true;
        } else {
          log('⚠️ [PERSISTENCE] No terminals were successfully restored');
          return false;
        }
      } else {
        log(`📦 [PERSISTENCE] No session to restore: ${response.error || 'No data'}`);
        return false;
      }
    } catch (error) {
      log(`❌ [PERSISTENCE] Auto-restore failed: ${error}`);
      console.error('Persistence restore error:', error);
      return false;
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    log('🔧 [DEBUG] SecondaryTerminalProvider disposing resources...');

    // WebViewにセッション保存を依頼
    if (this._view) {
      void this._sendMessage({
        command: 'saveAllTerminalSessions',
        timestamp: Date.now(),
      });
    }

    // Clear terminal event listeners
    this._clearTerminalEventListeners();

    // Clear message handlers and ID mappings
    this._messageRouter.clear();
    if (this._terminalIdMapping) {
      this._terminalIdMapping.clear();
    }

    // Clean up any pending scrollback requests
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_requestId, request] of this.pendingScrollbackRequests.entries()) {
      clearTimeout(request.timeout);
      request.resolve([]); // Resolve with empty array to avoid hanging promises
    }
    this.pendingScrollbackRequests.clear();

    // Dispose all registered disposables
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
    this._disposables.length = 0;

    // Dispose HTML generation service
    this._htmlGenerationService.dispose();

    // Dispose persistence services
    if (this._persistenceService) {
      this._persistenceService
        .cleanupExpiredSessions()
        .catch((error) => log(`⚠️ [PERSISTENCE] Cleanup during dispose failed: ${error}`));
    }
    this._persistenceService = undefined;
    this._persistenceHandler = undefined;

    // Clear references and reset state
    this._view = undefined;
    this._isInitialized = false;

    log('✅ [DEBUG] SecondaryTerminalProvider disposed');
  }

  /**
   * Add a disposable to be cleaned up later
   */
  private _addDisposable(disposable: vscode.Disposable): void {
    this._disposables.push(disposable);
  }

  /**
   * Set Phase 8 services for advanced terminal features
   */
  public setPhase8Services(
    decorationsService: import('../services/TerminalDecorationsService').TerminalDecorationsService,
    linksService: import('../services/TerminalLinksService').TerminalLinksService
  ): void {
    // Store services for WebView communication
    this._decorationsService = decorationsService;
    this._linksService = linksService;

    log('🎨 [PROVIDER] Phase 8 services (Decorations & Links) connected to provider');

    // Send Phase 8 capabilities to WebView if initialized
    if (this._view) {
      this._sendMessage({
        command: 'phase8ServicesReady',
        capabilities: {
          decorations: true,
          links: true,
          navigation: true,
          accessibility: true,
        },
      }).catch((error) => log('❌ [PROVIDER] Failed to send Phase 8 capabilities:', error));
    }
  }
}
