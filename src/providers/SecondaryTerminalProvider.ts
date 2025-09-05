import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { WebviewMessage } from '../types/common';
import { TERMINAL_CONSTANTS } from '../constants';
import { getTerminalConfig, normalizeTerminalInfo } from '../utils/common';
import { showSuccess, showError, TerminalErrorHandler } from '../utils/feedback';
import { provider as log } from '../utils/logger';
import { getConfigManager } from '../config/ConfigManager';
import { PartialTerminalSettings, WebViewFontSettings } from '../types/shared';
import { WebViewHtmlGenerationService, HtmlGenerationOptions } from '../services/webview/WebViewHtmlGenerationService';

export class SecondaryTerminalProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'secondaryTerminal';
  private _disposables: vscode.Disposable[] = [];
  private _terminalEventDisposables: vscode.Disposable[] = [];
  private _terminalIdMapping?: Map<string, string>; // VS Code Pattern: Map Extension terminal ID to WebView terminal ID

  private _view?: vscode.WebviewView;
  private _isInitialized = false; // Prevent duplicate initialization
  // Removed all state variables - using simple "fresh start" approach

  // Minimal command router for incoming webview messages
  private _messageHandlers = new Map<string, (message: WebviewMessage) => Promise<void> | void>();
  private readonly _htmlGenerationService: WebViewHtmlGenerationService;

  constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _terminalManager: TerminalManager,
    private readonly _standardSessionManager?: import('../sessions/StandardTerminalSessionManager').StandardTerminalSessionManager
  ) {
    this._htmlGenerationService = new WebViewHtmlGenerationService();
    log('🎨 [PROVIDER] HTML generation service initialized');
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
      // CRITICAL: Set view reference FIRST
      this._view = webviewView;
      log('✅ [PROVIDER] WebView reference set');
      
      // Reset initialization flag for new WebView (including panel moves)
      this._isInitialized = false;
      log('✅ [PROVIDER] Initialization flag reset');

      // STEP 1: Configure webview options FIRST (VS Code standard)
      log('🔧 [PROVIDER] Step 1: Configuring webview options...');
      this._configureWebview(webviewView);

      // STEP 2: Set up MESSAGE LISTENERS BEFORE HTML (VS Code standard practice)
      // This is CRITICAL - listeners must be set before HTML is loaded
      log('🔧 [PROVIDER] Step 2: Setting up message listeners (BEFORE HTML)...');
      const messageDisposable = webviewView.webview.onDidReceiveMessage(
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
          this._handleWebviewMessage(message).catch(error => {
            log('❌ [PROVIDER] Error handling message:', error);
          });
        },
        undefined,
        this._extensionContext.subscriptions
      );
      
      // Add disposable to subscriptions for cleanup
      this._extensionContext.subscriptions.push(messageDisposable);
      log('✅ [PROVIDER] Message listener registered and added to subscriptions');

      // Initialize minimal router
      this._initializeMessageHandlers();

      // STEP 3: Set up visibility listener
      log('🔧 [PROVIDER] Step 3: Setting up visibility listener...');
      const visibilityDisposable = webviewView.onDidChangeVisibility(
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
      this._extensionContext.subscriptions.push(visibilityDisposable);
      log('✅ [PROVIDER] Visibility listener registered');

      // STEP 4: Set HTML AFTER listeners are ready (VS Code standard)
      log('🔧 [PROVIDER] Step 4: Setting webview HTML...');
      this._setWebviewHtml(webviewView, false);

      // STEP 5: Set up terminal and other listeners
      log('🔧 [PROVIDER] Step 5: Setting up terminal listeners...');
      this._setupTerminalEventListeners();
      this._setupCliAgentStatusListeners();
      this._setupConfigurationChangeListeners();

      // STEP 6: Set up panel location change listener
      log('🔧 [PROVIDER] Step 6: Setting up panel location listener...');
      this._setupPanelLocationChangeListener(webviewView);

      log('✅ [PROVIDER] WebView setup completed successfully');
      log('🚀 [PROVIDER] === WEBVIEW VIEW RESOLUTION COMPLETE ===');
    } catch (error) {
      log('❌ [CRITICAL] Failed to resolve WebView:', error);
      this._handleWebviewSetupError(webviewView, error);
    }
  }

  /**
   * Minimal validation for incoming WebviewMessage
   */
  private _isValidWebviewMessage(msg: unknown): msg is WebviewMessage {
    return !!msg && typeof msg === 'object' && typeof (msg as any).command === 'string';
  }

  /**
   * Type guard: message has a valid terminalId
   */
  private _hasTerminalId(msg: WebviewMessage): msg is WebviewMessage & { terminalId: string } {
    return typeof (msg as any).terminalId === 'string' && (msg as any).terminalId.length > 0;
  }

  /**
   * Type guard: message has valid resize params
   */
  private _hasResizeParams(msg: WebviewMessage): msg is WebviewMessage & { cols: number; rows: number } {
    const { cols, rows } = msg as any;
    return typeof cols === 'number' && typeof rows === 'number' && cols > 0 && rows > 0;
  }

  /**
   * Type guard: message has settings payload
   */
  private _hasSettings(msg: WebviewMessage): msg is WebviewMessage & { settings: PartialTerminalSettings } {
    return !!(msg as any).settings && typeof (msg as any).settings === 'object';
  }

  /**
   * Type guard: message has non-empty input data
   */
  private _hasInputData(msg: WebviewMessage): msg is WebviewMessage & { data: string } {
    return typeof (msg as any).data === 'string' && (msg as any).data.length > 0;
  }

  /**
   * Initialize a minimal command→handler map without behavior change
   */
  private _initializeMessageHandlers(): void {
    // Handle readiness messages via a dedicated handler
    this._messageHandlers.set('webviewReady', (message) => this._handleWebviewReady(message));
    // Alias: support constant-based command name
    if (TERMINAL_CONSTANTS?.COMMANDS?.READY) {
      this._messageHandlers.set(TERMINAL_CONSTANTS.COMMANDS.READY, (message) => this._handleWebviewReady(message));
    }

    // Safe, side-effect-free query: getSettings
    this._messageHandlers.set('getSettings', async () => {
      await this._handleGetSettings();
    });

    // Focus a terminal
    this._messageHandlers.set('focusTerminal', async (message) => {
      await this._handleFocusTerminal(message);
    });
    if (TERMINAL_CONSTANTS?.COMMANDS?.FOCUS_TERMINAL) {
      this._messageHandlers.set(TERMINAL_CONSTANTS.COMMANDS.FOCUS_TERMINAL, async (message) => {
        await this._handleFocusTerminal(message);
      });
    }

    // Split terminal (direction optional)
    this._messageHandlers.set('splitTerminal', (message) => {
      this._handleSplitTerminal(message);
    });

    // Create terminal (maps Extension ID to WebView ID when created)
    this._messageHandlers.set('createTerminal', async (message) => {
      await this._handleCreateTerminal(message);
    });
    if (TERMINAL_CONSTANTS?.COMMANDS?.CREATE_TERMINAL) {
      this._messageHandlers.set(TERMINAL_CONSTANTS.COMMANDS.CREATE_TERMINAL, async (message) => {
        await this._handleCreateTerminal(message);
      });
    }

    // Terminal input
    if (TERMINAL_CONSTANTS?.COMMANDS?.INPUT) {
      this._messageHandlers.set(TERMINAL_CONSTANTS.COMMANDS.INPUT, (message) => {
        this._handleTerminalInput(message);
      });
    }

    // Terminal resize
    if (TERMINAL_CONSTANTS?.COMMANDS?.RESIZE) {
      this._messageHandlers.set(TERMINAL_CONSTANTS.COMMANDS.RESIZE, (message) => {
        this._handleTerminalResize(message);
      });
    }

    // Kill terminal (active or specific)
    this._messageHandlers.set('killTerminal', async (message) => {
      await this._handleKillTerminal(message);
    });

    // Delete terminal (specific, with response)
    this._messageHandlers.set('deleteTerminal', async (message) => {
      await this._handleDeleteTerminal(message);
    });

    // Update settings
    this._messageHandlers.set('updateSettings', async (message) => {
      await this._handleUpdateSettings(message);
    });

    // Report panel location
    this._messageHandlers.set('reportPanelLocation', async (message) => {
      await this._handleReportPanelLocation(message);
    });

    // Terminal closed (from WebView)
    this._messageHandlers.set('terminalClosed', async (message) => {
      await this._handleTerminalClosed(message);
    });

    // Request initial terminal creation (if none exists)
    this._messageHandlers.set('requestInitialTerminal', async (message) => {
      await this._handleRequestInitialTerminal(message);
    });

    // Debug/diagnostic messages
    this._messageHandlers.set('htmlScriptTest', (message) => this._handleHtmlScriptTest(message));
    this._messageHandlers.set('timeoutTest', (message) => this._handleTimeoutTest(message));
    this._messageHandlers.set('test', (message) => this._handleDebugTest(message));
  }

  /**
   * Extracted handler for webview readiness
   */
  private _handleWebviewReady(_message: WebviewMessage): void {
    if (this._isInitialized) {
      log('🔄 [DEBUG] WebView already initialized, skipping duplicate initialization');
      return;
    }

    log('🎯 [DEBUG] WebView ready - initializing terminal immediately');
    this._isInitialized = true;

    void (async () => {
      try {
        await this._initializeTerminal();
        log('✅ [DEBUG] Terminal initialization completed immediately');

        // Avoid duplicate terminal creation; ensure minimum when none exists
        setTimeout(() => {
          if (this._terminalManager.getTerminals().length === 0) {
            log('🎯 [ENSURE] No terminals exist - creating minimum set');
            this._ensureMultipleTerminals();
          }
        }, 100);
      } catch (error) {
        log('❌ [ERROR] Failed during webviewReady handling:', error);
      }
    })();
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
        log(`❌ [DEBUG] Active terminal update failed. Expected: ${message.terminalId}, Got: ${newActive}`);
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
    const direction = (message as any).direction as 'horizontal' | 'vertical' | undefined;
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

  /**
   * Extracted handler for creating a terminal from WebView request
   * Mirrors existing behavior: create PTY and map Extension ID → WebView ID
   */
  private async _handleCreateTerminal(message: WebviewMessage): Promise<void> {
    if (!message.terminalId || !message.terminalName) {
      log('⚠️ [DEBUG] Missing terminalId or terminalName for createTerminal');
      return;
    }

    log('🚀 [DEBUG] Creating terminal from WebView request (router):', message.terminalId, message.terminalName);
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
          log(`🔗 [VS Code Pattern] Mapped Extension ID ${newTerminalId} → WebView ID ${message.terminalId}`);
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
      const result = await this._terminalManager.deleteTerminal(terminalId, { source: requestSource });

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

  public async killTerminal(): Promise<void> {
    // Kill active terminal

    // 🔍 Enhanced debugging for active terminal detection
    log('🔍 [DEBUG] ========== KILL TERMINAL DEBUG START ==========');
    
    // Get active terminal ID with detailed logging
    const activeTerminalId = this._terminalManager.getActiveTerminalId();
    log(`🔍 [DEBUG] Active terminal ID from manager: ${activeTerminalId}`);
    
    // Get all terminals for comparison
    const allTerminals = this._terminalManager.getTerminals();
    log(`🔍 [DEBUG] All terminals: ${JSON.stringify(allTerminals.map(t => ({ id: t.id, name: t.name, isActive: t.isActive })))}`);
    
    // Check active terminal manager state
    const activeManager = (this._terminalManager as any)._activeTerminalManager;
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
          success: true
        });
      } else {
        log(`⚠️ [WARN] Terminal deletion failed: ${terminalId}, reason: ${result.reason}`);
        // Send failure response to WebView (unified with deleteTerminal case)
        await this._sendMessage({
          command: 'deleteTerminalResponse',
          terminalId,
          success: false,
          reason: result.reason
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
        reason: `Delete failed: ${String(error)}`
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

      // VS CODE STANDARD: Session restore after WebView initialization
      if (this._standardSessionManager && existingTerminals.length === 0) {
        log('🔄 [DEBUG] Checking for session data to restore...');

        // Check if session data exists without blocking
        const sessionInfo = this._standardSessionManager.getSessionInfo();

        if (
          sessionInfo &&
          sessionInfo.exists &&
          sessionInfo.terminals &&
          sessionInfo.terminals.length > 0
        ) {
          log(
            `🔄 [DEBUG] Found session data with ${sessionInfo.terminals.length} terminals, initiating restore...`
          );

          // VS Code standard: Immediate but async restore
          setImmediate(() => {
            void this._performAsyncSessionRestore();
          });
        } else {
          log('📭 [DEBUG] No session data found, will create initial terminal on first view');
          log('🎬 [DEBUG] About to call _scheduleInitialTerminalCreation...');
          // VS Code standard: Don't create terminal here, let WebView handle it
          this._scheduleInitialTerminalCreation();
          log('🎬 [DEBUG] _scheduleInitialTerminalCreation call completed');
        }
      }

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
      // Minimal router: if a handler exists, use it and return
      const routed = this._messageHandlers.get(message.command);
      if (routed) {
        await routed(message);
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

          if (terminalId) {
            log(`📎 [DEBUG] Switching AI Agent for terminal: ${terminalId} (action: ${action})`);
            try {
              // Call TerminalManager's switchAiAgentConnection method
              const result = this._terminalManager.switchAiAgentConnection(terminalId);
              
              if (result.success) {
                log(`✅ [DEBUG] AI Agent switch succeeded: ${terminalId}, new status: ${result.newStatus}`);
                // Send success response to WebView (optional)
                await this._sendMessage({
                  command: 'switchAiAgentResponse',
                  terminalId,
                  success: true,
                  newStatus: result.newStatus,
                  agentType: result.agentType
                });
              } else {
                log(`⚠️ [DEBUG] AI Agent switch failed: ${terminalId}, reason: ${result.reason}`);
                // Send failure response to WebView (optional)
                await this._sendMessage({
                  command: 'switchAiAgentResponse',
                  terminalId,
                  success: false,
                  reason: result.reason,
                  newStatus: result.newStatus
                });
              }
            } catch (error) {
              log('❌ [ERROR] Error switching AI Agent:', error);
              // Send error response to WebView
              await this._sendMessage({
                command: 'switchAiAgentResponse',
                terminalId,
                success: false,
                reason: 'Internal error occurred'
              });
            }
          } else {
            log('⚠️ [DEBUG] switchAiAgent: terminalId missing');
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
        const webviewTerminalId = this._terminalIdMapping?.get(event.terminalId) || event.terminalId;
        
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

        log(
          '📤 [VS Code Pattern] Sending OUTPUT to WebView terminal:',
          webviewTerminalId
        );
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
    });

    // Store disposables for cleanup
    this._terminalEventDisposables.push(dataDisposable, exitDisposable, createdDisposable);

    // Handle terminal removal
    const removedDisposable = this._terminalManager.onTerminalRemoved((terminalId) => {
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_REMOVED,
        terminalId,
      });
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
        isLoading: true
      });
    }
  }

  private getCurrentSettings(): PartialTerminalSettings {
    const settings = getConfigManager().getCompleteTerminalSettings();
    const altClickSettings = getConfigManager().getAltClickSettings();

    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    return {
      cursorBlink: settings.cursorBlink,
      theme: settings.theme || 'auto',
      // VS Code standard settings for Alt+Click functionality
      altClickMovesCursor: altClickSettings.altClickMovesCursor,
      multiCursorModifier: altClickSettings.multiCursorModifier,
      // CLI Agent Code integration settings
      enableCliAgentIntegration: config.get<boolean>('enableCliAgentIntegration', true),
    };
  }

  private getCurrentFontSettings(): WebViewFontSettings {
    const configManager = getConfigManager();

    return {
      fontSize: configManager.getFontSize(),
      fontFamily: configManager.getFontFamily(),
      fontWeight: configManager.getFontWeight(),
      fontWeightBold: configManager.getFontWeightBold(),
      lineHeight: configManager.getLineHeight(),
      letterSpacing: configManager.getLetterSpacing(),
    };
  }

  private async updateSettings(settings: PartialTerminalSettings): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('secondaryTerminal');
      // Note: ConfigManager handles reading, but writing must still use VS Code API

      // Update VS Code settings (font settings are managed by VS Code directly)
      if (settings.cursorBlink !== undefined) {
        await config.update('cursorBlink', settings.cursorBlink, vscode.ConfigurationTarget.Global);
      }
      if (settings.theme) {
        await config.update('theme', settings.theme, vscode.ConfigurationTarget.Global);
      }
      if (settings.enableCliAgentIntegration !== undefined) {
        await config.update(
          'enableCliAgentIntegration',
          settings.enableCliAgentIntegration,
          vscode.ConfigurationTarget.Global
        );
        log(
          '🔧 [DEBUG] CLI Agent Code integration setting updated:',
          settings.enableCliAgentIntegration
        );
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
  private async _performAsyncSessionRestore(): Promise<void> {
    try {
      if (!this._standardSessionManager) {
        log('⚠️ [RESTORE] StandardSessionManager not available');
        return;
      }

      log('🔄 [RESTORE] Starting VS Code standard session restore...');

      // Direct session restore - VS Code handles this immediately
      const result = await this._standardSessionManager.restoreSession(true);

      if (result.success && result.restoredCount && result.restoredCount > 0) {
        log(`✅ [RESTORE] Successfully restored ${result.restoredCount} terminals`);

        // VS Code standard: Show success notification
        void vscode.window.showInformationMessage(
          `🔄 Terminal session restored: ${result.restoredCount} terminal${result.restoredCount > 1 ? 's' : ''}`
        );
      } else {
        log('📭 [RESTORE] No session data found or restored');
        // If restore failed, create initial terminal
        this._scheduleInitialTerminalCreation();
      }
    } catch (error) {
      log(`❌ [RESTORE] Session restore failed: ${String(error)}`);
      // On restore failure, create initial terminal
      this._scheduleInitialTerminalCreation();
    }
  }

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
            state: this._terminalManager.getCurrentState()
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
        log(`🔍 [DEBUG] Terminals already exist (${currentTerminalCount}), skipping initial creation`);
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
      isLoading: true
    });
  }

  /**
   * Generate error HTML when setup fails
   */
  private _getErrorHtml(error: unknown): string {
    return this._htmlGenerationService.generateErrorHtml({
      error,
      allowRetry: true,
      customMessage: `Terminal initialization failed. Please try reloading the terminal view or restarting VS Code.`
    });
  }

  // Removed _restoreWebviewState - not needed with fresh start approach

  /**
   * Get current settings for restoration
   */
  private _getCurrentSettings(): PartialTerminalSettings {
    const config = getConfigManager().getExtensionTerminalConfig();
    const vsCodeConfig = vscode.workspace.getConfiguration('secondaryTerminal');

    return {
      shell: config.shell || '',
      shellArgs: config.shellArgs || [],
      fontSize: config.fontSize || 14,
      fontFamily: config.fontFamily || 'monospace',
      theme: config.theme || 'dark',
      cursor: config.cursor || {
        style: 'block',
        blink: true,
      },
      maxTerminals: config.maxTerminals || 5,
      enableCliAgentIntegration: config.enableCliAgentIntegration || false,
      // 🆕 Issue #148: Dynamic split direction settings
      dynamicSplitDirection: vsCodeConfig.get<boolean>('dynamicSplitDirection', true),
      panelLocation: vsCodeConfig.get<'auto' | 'sidebar' | 'panel'>('panelLocation', 'auto'),
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
    this._messageHandlers.clear();
    if (this._terminalIdMapping) {
      this._terminalIdMapping.clear();
    }

    // Dispose all registered disposables
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
    this._disposables.length = 0;

    // Dispose HTML generation service
    this._htmlGenerationService.dispose();

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
    (this as any)._decorationsService = decorationsService;
    (this as any)._linksService = linksService;
    
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
      }).catch(error => log('❌ [PROVIDER] Failed to send Phase 8 capabilities:', error));
    }
  }
}
