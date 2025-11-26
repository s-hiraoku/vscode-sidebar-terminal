import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { WebviewMessage } from '../types/common';
import { TERMINAL_CONSTANTS } from '../constants';
import { safeProcessCwd } from '../utils/common';
import { TerminalErrorHandler } from '../utils/feedback';
import { provider as log } from '../utils/logger';
import { PersistenceMessageHandler } from '../handlers/PersistenceMessageHandler';
import { TerminalInitializationCoordinator } from './TerminalInitializationCoordinator';
import { hasSettings } from '../types/type-guards';
import { WebViewHtmlGenerationService } from '../services/webview/WebViewHtmlGenerationService';
import { TelemetryService } from '../services/TelemetryService';

// New refactored services (existing)
import {
  PanelLocationService,
  PanelLocation,
  SplitDirection,
} from './services/PanelLocationService';
import { TerminalLinkResolver } from './services/TerminalLinkResolver';
import { WebViewCommunicationService } from './services/WebViewCommunicationService';
import { TerminalEventCoordinator } from './services/TerminalEventCoordinator';
import { ScrollbackCoordinator } from './services/ScrollbackCoordinator';

// New Facade pattern services (Issue #214)
import { SettingsSyncService } from './services/SettingsSyncService';
import { ResourceCleanupService } from './services/ResourceCleanupService';
import { WebViewLifecycleManager } from './services/WebViewLifecycleManager';
import { MessageRoutingFacade } from './services/MessageRoutingFacade';
import { InitializationOrchestrator } from './services/InitializationOrchestrator';
import {
  TerminalInitializationStateMachine,
  TerminalInitializationState,
} from './services/TerminalInitializationStateMachine';
import {
  TerminalInitializationWatchdog,
  WatchdogOptions,
} from './services/TerminalInitializationWatchdog';
import { TerminalCommandHandlers } from './services/TerminalCommandHandlers';

export class SecondaryTerminalProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'secondaryTerminal';

  /**
   * Configuration keys for secondary terminal settings
   */
  private static readonly CONFIG_KEYS = {
    DYNAMIC_SPLIT_DIRECTION: 'dynamicSplitDirection',
    PANEL_LOCATION: 'panelLocation',
    ENABLE_SHELL_INTEGRATION: 'enableShellIntegration',
  } as const;

  /**
   * VS Code context keys for when clauses
   */
  private static readonly CONTEXT_KEYS = {
    PANEL_LOCATION: 'secondaryTerminal.panelLocation',
  } as const;

  private _terminalIdMapping?: Map<string, string>;
  private _isInitialized = false;

  // Phase 8 services (typed properly)
  private _decorationsService?: import('../services/TerminalDecorationsService').TerminalDecorationsService;
  private _linksService?: import('../services/TerminalLinksService').TerminalLinksService;

  // Terminal persistence services
  private _persistenceHandler?: PersistenceMessageHandler;
  private readonly _initializationCoordinator: TerminalInitializationCoordinator;

  // Existing refactored services
  private readonly _panelLocationService: PanelLocationService;
  private readonly _linkResolver: TerminalLinkResolver;
  private readonly _communicationService: WebViewCommunicationService;
  private _eventCoordinator?: TerminalEventCoordinator;
  private readonly _scrollbackCoordinator: ScrollbackCoordinator;
  private readonly _htmlGenerationService: WebViewHtmlGenerationService;

  // New Facade pattern services (Issue #214)
  private readonly _settingsService: SettingsSyncService;
  private readonly _cleanupService: ResourceCleanupService;
  private readonly _lifecycleManager: WebViewLifecycleManager;
  private readonly _messageRouter: MessageRoutingFacade;
  private readonly _orchestrator: InitializationOrchestrator;
  private readonly _telemetryService?: TelemetryService;
  private readonly _terminalCommandHandlers: TerminalCommandHandlers;
  private readonly _terminalInitStateMachine = new TerminalInitializationStateMachine();
  private readonly _terminalInitWatchdog = new TerminalInitializationWatchdog((terminalId, info) =>
    this._handleInitializationTimeout(terminalId, info.attempt, info.isFinalAttempt)
  );
  private readonly _pendingWatchdogTerminals = new Set<string>();
  private readonly _safeModeTerminals = new Set<string>();
  private readonly _recordedInitMetrics = new Set<string>();
  private readonly _watchdogPhases = new Map<string, 'ack' | 'prompt'>();
  private readonly _terminalInitStartTimes = new Map<string, number>();
  private readonly _safeModeNotified = new Set<string>();
  private readonly _pendingInitRetries = new Map<string, number>();
  private _pendingMessages: WebviewMessage[] = [];

  private static readonly ACK_WATCHDOG_OPTIONS: WatchdogOptions = {
    initialDelayMs: 700,
    maxAttempts: 4,
    backoffFactor: 2,
  };

  private static readonly PROMPT_WATCHDOG_OPTIONS: WatchdogOptions = {
    initialDelayMs: 1000,
    maxAttempts: 1,
    backoffFactor: 1,
  };

  constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _terminalManager: TerminalManager,
    private readonly _extensionPersistenceService?: import('../services/persistence/ExtensionPersistenceService').ExtensionPersistenceService,
    telemetryService?: TelemetryService
  ) {
    this._htmlGenerationService = new WebViewHtmlGenerationService();
    this._telemetryService = telemetryService;

    // Initialize existing refactored services
    this._communicationService = new WebViewCommunicationService();
    this._panelLocationService = new PanelLocationService(
      (message: unknown) => this._communicationService.sendMessage(message as WebviewMessage)
    );
    this._linkResolver = new TerminalLinkResolver(
      (terminalId: string) => this._terminalManager.getTerminal(terminalId)
    );
    this._scrollbackCoordinator = new ScrollbackCoordinator(
      this._communicationService.sendMessage.bind(this._communicationService)
    );

    log('🎨 [PROVIDER] Existing refactored services initialized');

    // Initialize persistence services
    if (this._extensionPersistenceService) {
      this._persistenceHandler = new PersistenceMessageHandler(this._extensionPersistenceService);
      log('💾 [PROVIDER] Terminal persistence services initialized');
    } else {
      log('⚠️ [PROVIDER] ExtensionPersistenceService not provided, persistence disabled');
    }

    // Initialize terminal initialization coordinator
    this._initializationCoordinator = new TerminalInitializationCoordinator(
      this._terminalManager,
      {
        initializeTerminal: this._initializeTerminal.bind(this),
        ensureMinimumTerminals: this._ensureMultipleTerminals.bind(this),
        sendInitializationComplete: this._sendInitializationComplete.bind(this),
        restoreLastSession: () => this.restoreLastSession(),
      },
      this._extensionPersistenceService
    );

    // Initialize NEW Facade pattern services (Issue #214)
    this._settingsService = new SettingsSyncService(
      async () => await this._initializeTerminal()
    );

    this._cleanupService = new ResourceCleanupService();

    this._lifecycleManager = new WebViewLifecycleManager(
      this._extensionContext,
      this._htmlGenerationService
    );

    this._messageRouter = new MessageRoutingFacade();

    this._orchestrator = new InitializationOrchestrator(
      this._initializationCoordinator,
      this._lifecycleManager,
      this._messageRouter
    );

    // Initialize terminal command handlers
    this._terminalCommandHandlers = new TerminalCommandHandlers({
      terminalManager: this._terminalManager,
      communicationService: this._communicationService,
      linkResolver: this._linkResolver,
      getSplitDirection: () => this._determineSplitDirection(),
    });

    log('🎨 [PROVIDER] NEW Facade pattern services initialized (Issue #214)');
    log('✅ [PROVIDER] SecondaryTerminalProvider constructed with all services');

    this._registerInitializationWatchdogs();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    const startTime = this._lifecycleManager.trackResolveStart();

    log('🚀 [PROVIDER] === RESOLVING WEBVIEW VIEW ===');
    log(`📊 [METRICS] resolveWebviewView call #${this._lifecycleManager.getPerformanceMetrics().resolveWebviewViewCallCount}`);

    // Check if body already rendered (VS Code ViewPane pattern)
    if (this._lifecycleManager.isBodyRendered()) {
      log('⏭️ [PROVIDER] Body already rendered, skipping duplicate initialization (VS Code ViewPane pattern)');
      this._lifecycleManager.trackPanelMovement(startTime);

      // Update view references for panel movements
      this._lifecycleManager.setView(webviewView);
      this._communicationService.setView(webviewView);
      return;
    }

    try {
      this._resetForNewView(webviewView);
      log('🔧 [PROVIDER] Step 1: Configuring webview options...');
      this._lifecycleManager.configureWebview(webviewView);
      this._registerWebviewMessageListener(webviewView);
      this._initializeMessageHandlers();
      this._registerVisibilityListener(webviewView);
      this._initializeWebviewContent(webviewView);
      this._setupPanelLocationChangeListener(webviewView);

      // Mark body as rendered (VS Code ViewPane pattern)
      this._lifecycleManager.setBodyRendered(true);
      log('✅ [PROVIDER] Body rendering complete, _bodyRendered flag set to true');

      // Track initialization completion
      this._lifecycleManager.trackInitializationComplete(startTime);
      this._lifecycleManager.logPerformanceMetrics();

      log('✅ [PROVIDER] WebView setup completed successfully');
      log('🚀 [PROVIDER] === WEBVIEW VIEW RESOLUTION COMPLETE ===');
    } catch (error) {
      log('❌ [CRITICAL] Failed to resolve WebView:', error);
      this._lifecycleManager.handleSetupError(webviewView, error);
    }
  }

  private _resetForNewView(webviewView: vscode.WebviewView): void {
    // Set view references
    this._lifecycleManager.setView(webviewView);
    this._communicationService.setView(webviewView);
    log('✅ [PROVIDER] WebView references set');

    // Initialize event coordinator with new view
    this._eventCoordinator = new TerminalEventCoordinator(
      this._terminalManager,
      this._communicationService.sendMessage.bind(this._communicationService),
      async () => { await this.saveCurrentSession(); },
      () => this.sendFullCliAgentStateSync(),
      this._terminalIdMapping,
      this._terminalInitStateMachine
    );
    this._eventCoordinator.initialize();
    log('✅ [PROVIDER] Event coordinator initialized');
  }

  private _registerWebviewMessageListener(webviewView: vscode.WebviewView): void {
    // Prevent duplicate message listener registration
    if (this._lifecycleManager.isMessageListenerRegistered()) {
      log('⏭️ [PROVIDER] Message listener already registered, skipping duplicate registration');
      return;
    }

    log('🔧 [PROVIDER] Step 2: Setting up message listeners (BEFORE HTML)...');

    // Track listener registration
    this._lifecycleManager.trackListenerRegistration();

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

        // Handle message using MessageRoutingFacade
        this._messageRouter.handleMessage(message).catch((error) => {
          log('❌ [PROVIDER] Error handling message:', error);
        });
      },
      undefined,
      this._extensionContext.subscriptions
    );

    this._cleanupService.addDisposable(disposable);
    this._lifecycleManager.setMessageListenerRegistered(true);
    log('✅ [PROVIDER] Message listener registered');
  }

  /**
   * VS Code ViewPane Pattern: Single consolidated visibility handler
   */
  private _registerVisibilityListener(webviewView: vscode.WebviewView): void {
    log('🔧 [PROVIDER] Step 3: Setting up consolidated visibility listener (VS Code pattern)...');

    const disposable = this._lifecycleManager.registerVisibilityListener(
      webviewView,
      () => this._handleWebviewVisible(),
      () => this._handleWebviewHidden()
    );

    this._cleanupService.addDisposable(disposable);
    log('✅ [PROVIDER] Consolidated visibility listener registered');
  }

  private _handleWebviewVisible(): void {
    log('🔄 [VISIBILITY] Handling WebView visible event');

    // Trigger panel location detection with debounce
    setTimeout(() => {
      log('📍 [VISIBILITY] Requesting panel location detection after visibility change');
      this._requestPanelLocationDetection();
    }, 200);
  }

  private _handleWebviewHidden(): void {
    log('🔄 [VISIBILITY] Handling WebView hidden event');
    // Future: Implement state saving if needed
  }

  private _initializeWebviewContent(webviewView: vscode.WebviewView): void {
    log('🔧 [PROVIDER] Step 4: Setting webview HTML...');

    // Generate HTML content
    const htmlContent = this._htmlGenerationService.generateMainHtml({
      webview: webviewView.webview,
      extensionUri: this._extensionContext.extensionUri,
      includeSplitStyles: true,
      includeCliAgentStyles: true,
    });

    // Set HTML using lifecycle manager
    this._lifecycleManager.setWebviewHtml(webviewView, htmlContent, false);

    log('🤝 [HANDSHAKE] HTML set, waiting for webviewReady from WebView');
  }

  private _initializeMessageHandlers(): void {
    const handlers = [
      // UI handlers
      { command: 'webviewReady', handler: (msg: WebviewMessage) => this._handleWebviewReady(msg), category: 'ui' as const },
      { command: TERMINAL_CONSTANTS?.COMMANDS?.READY, handler: (msg: WebviewMessage) => this._handleWebviewReady(msg), category: 'ui' as const },
      { command: 'reportPanelLocation', handler: async (msg: WebviewMessage) => await this._handleReportPanelLocation(msg), category: 'ui' as const },

      // Settings handlers
      { command: 'getSettings', handler: async () => await this._handleGetSettings(), category: 'settings' as const },
      { command: 'updateSettings', handler: async (msg: WebviewMessage) => await this._handleUpdateSettings(msg), category: 'settings' as const },

      // Terminal handlers (delegated to TerminalCommandHandlers)
      { command: 'focusTerminal', handler: async (msg: WebviewMessage) => await this._terminalCommandHandlers.handleFocusTerminal(msg), category: 'terminal' as const },
      { command: TERMINAL_CONSTANTS?.COMMANDS?.FOCUS_TERMINAL, handler: async (msg: WebviewMessage) => await this._terminalCommandHandlers.handleFocusTerminal(msg), category: 'terminal' as const },
      { command: 'splitTerminal', handler: (msg: WebviewMessage) => this._terminalCommandHandlers.handleSplitTerminal(msg), category: 'terminal' as const },
      { command: 'createTerminal', handler: async (msg: WebviewMessage) => await this._terminalCommandHandlers.handleCreateTerminal(msg), category: 'terminal' as const },
      { command: TERMINAL_CONSTANTS?.COMMANDS?.CREATE_TERMINAL, handler: async (msg: WebviewMessage) => await this._terminalCommandHandlers.handleCreateTerminal(msg), category: 'terminal' as const },
      { command: TERMINAL_CONSTANTS?.COMMANDS?.INPUT, handler: (msg: WebviewMessage) => this._terminalCommandHandlers.handleTerminalInput(msg), category: 'terminal' as const },
      { command: TERMINAL_CONSTANTS?.COMMANDS?.RESIZE, handler: (msg: WebviewMessage) => this._terminalCommandHandlers.handleTerminalResize(msg), category: 'terminal' as const },
      { command: 'getTerminalProfiles', handler: async () => await this._terminalCommandHandlers.handleGetTerminalProfiles(), category: 'terminal' as const },
      { command: 'killTerminal', handler: async (msg: WebviewMessage) => await this._terminalCommandHandlers.handleKillTerminal(msg), category: 'terminal' as const },
      { command: 'deleteTerminal', handler: async (msg: WebviewMessage) => await this._terminalCommandHandlers.handleDeleteTerminal(msg), category: 'terminal' as const },
      { command: 'terminalClosed', handler: async (msg: WebviewMessage) => await this._terminalCommandHandlers.handleTerminalClosed(msg), category: 'terminal' as const },
      { command: 'openTerminalLink', handler: async (msg: WebviewMessage) => await this._terminalCommandHandlers.handleOpenTerminalLink(msg), category: 'terminal' as const },
      { command: 'reorderTerminals', handler: async (msg: WebviewMessage) => await this._terminalCommandHandlers.handleReorderTerminals(msg), category: 'terminal' as const },
      { command: 'requestInitialTerminal', handler: async (msg: WebviewMessage) => await this._terminalCommandHandlers.handleRequestInitialTerminal(msg), category: 'terminal' as const },
      { command: 'terminalInitializationComplete', handler: async (msg: WebviewMessage) => await this._handleTerminalInitializationComplete(msg), category: 'terminal' as const },
      { command: 'terminalReady', handler: async (msg: WebviewMessage) => await this._handleTerminalReady(msg), category: 'terminal' as const },
      { command: 'requestClipboardContent', handler: async (msg: WebviewMessage) => await this._terminalCommandHandlers.handleClipboardRequest(msg), category: 'terminal' as const },
      { command: 'copyToClipboard', handler: async (msg: WebviewMessage) => await this._terminalCommandHandlers.handleCopyToClipboard(msg), category: 'terminal' as const },
      { command: 'switchAiAgent', handler: async (msg: WebviewMessage) => await this._terminalCommandHandlers.handleSwitchAiAgent(msg), category: 'terminal' as const },

      // Persistence handlers
      { command: 'persistenceSaveSession', handler: async (msg: WebviewMessage) => await this._handlePersistenceMessage(msg), category: 'persistence' as const },
      { command: 'persistenceRestoreSession', handler: async (msg: WebviewMessage) => await this._handlePersistenceMessage(msg), category: 'persistence' as const },
      { command: 'persistenceClearSession', handler: async (msg: WebviewMessage) => await this._handlePersistenceMessage(msg), category: 'persistence' as const },
      { command: 'terminalSerializationRequest', handler: async (msg: WebviewMessage) => await this._handleLegacyPersistenceMessage(msg), category: 'persistence' as const },
      { command: 'terminalSerializationRestoreRequest', handler: async (msg: WebviewMessage) => await this._handleLegacyPersistenceMessage(msg), category: 'persistence' as const },
      { command: 'pushScrollbackData', handler: async (msg: WebviewMessage) => await this._handlePushScrollbackData(msg), category: 'persistence' as const },
      { command: 'scrollbackDataCollected', handler: async (msg: WebviewMessage) => await this._handleScrollbackDataCollected(msg), category: 'persistence' as const },

      // Debug handlers
      { command: 'htmlScriptTest', handler: (msg: WebviewMessage) => this._handleHtmlScriptTest(msg), category: 'debug' as const },
      { command: 'timeoutTest', handler: (msg: WebviewMessage) => this._handleTimeoutTest(msg), category: 'debug' as const },
      { command: 'test', handler: (msg: WebviewMessage) => this._handleDebugTest(msg), category: 'debug' as const },
    ];

    this._messageRouter.registerHandlers(handlers);
    log('✅ [PROVIDER] Message handlers initialized via MessageRoutingFacade');
  }

  private async _handlePushScrollbackData(message: WebviewMessage): Promise<void> {
    if (!this._extensionPersistenceService) {
      log('⚠️ [PROVIDER] Received pushScrollbackData but persistence service is unavailable');
      return;
    }

    const handler = (this._extensionPersistenceService as any).handlePushedScrollbackData;
    if (typeof handler !== 'function') {
      log('⚠️ [PROVIDER] Persistence service does not support pushScrollbackData');
      return;
    }

    try {
      handler.call(this._extensionPersistenceService, message);
    } catch (error) {
      log('❌ [PROVIDER] Failed to process pushScrollbackData message:', error);
    }
  }

  private async _handleScrollbackDataCollected(message: WebviewMessage): Promise<void> {
    const scrollbackData = (message as any)?.scrollbackData;
    const requestId = (message as any)?.requestId;
    const terminalId = (message as any)?.terminalId;

    if (!Array.isArray(scrollbackData)) {
      log('⚠️ [PROVIDER] scrollbackDataCollected missing scrollbackData array');
      return;
    }

    // Forward to persistence service for handling (supports both cache update and pending request resolution)
    if (this._extensionPersistenceService) {
      const handler = (this._extensionPersistenceService as any).handleScrollbackDataCollected;
      if (typeof handler === 'function') {
        handler.call(this._extensionPersistenceService, { terminalId, requestId, scrollbackData });
        log(`✅ [PROVIDER] scrollbackDataCollected forwarded to persistence service (requestId=${requestId || 'none'})`);
        return;
      }
    }

    // Fallback: treat as pushScrollbackData for cache update
    (message as any).command = 'pushScrollbackData';
    await this._handlePushScrollbackData(message);
  }

  private async _handleTerminalReady(message: WebviewMessage): Promise<void> {
    const terminalId = message.terminalId as string;
    if (!terminalId) {
      log('⚠️ [PROVIDER] terminalReady missing terminalId');
      return;
    }

    log(`✅ [PROVIDER] Terminal ready: ${terminalId}`);

    // Forward to persistence service for terminal ready event handling
    if (this._extensionPersistenceService) {
      const handler = (this._extensionPersistenceService as any).handleTerminalReady;
      if (typeof handler === 'function') {
        handler.call(this._extensionPersistenceService, terminalId);
      }
    }
  }

  private _handleWebviewReady(_message: WebviewMessage): void {
    log('🔥 [TERMINAL-INIT] === _handleWebviewReady CALLED ===');

    if (this._isInitialized) {
      log('🔄 [TERMINAL-INIT] WebView already initialized, skipping duplicate initialization');
      return;
    }

    log('🎯 [TERMINAL-INIT] WebView ready - sending extensionReady confirmation');

    // Send extensionReady
    log('🤝 [HANDSHAKE] Sending extensionReady in response to webviewReady');
    void this._communicationService.sendMessage({
      command: 'extensionReady' as any,
      timestamp: Date.now(),
    });
    log('✅ [HANDSHAKE] extensionReady sent to WebView');

    // Mark as initialized
    this._isInitialized = true;
    // Flush any messages queued before the webview was ready
    if (this._pendingMessages.length > 0) {
      const queued = [...this._pendingMessages];
      this._pendingMessages = [];
      queued.forEach(message => {
        void this._communicationService.sendMessage(message);
      });
    }
    this._startPendingWatchdogs();

    // Send version information
    void this._communicationService.sendVersionInfo();

    // Start initialization via orchestrator
    void this._orchestrator.initialize();
  }

  private async _handleGetSettings(): Promise<void> {
    log('⚙️ [DEBUG] Getting settings from webview...');

    // Use SettingsSyncService for settings
    const settings = this._settingsService.getCurrentSettings();
    const fontSettings = this._settingsService.getCurrentFontSettings();

    await this._sendMessage({
      command: 'settingsResponse',
      settings,
    });

    await this._sendMessage({
      command: 'fontSettingsUpdate',
      fontSettings,
    });

    // Send initial panel location
    const view = this._lifecycleManager.getView();
    if (view) {
      const panelLocation = this._getCurrentPanelLocation();
      log(`📍 [SETTINGS] Sending initial panel location: ${panelLocation}`);
      await this._sendMessage({
        command: 'panelLocationUpdate',
        location: panelLocation,
      });

      this._requestPanelLocationDetection();
    }
  }

  private _handleHtmlScriptTest(message: WebviewMessage): void {
    log('🔥 [DEBUG] ========== HTML INLINE SCRIPT TEST MESSAGE RECEIVED ==========');
    log('🔥 [DEBUG] HTML script communication is working!');
    log('🔥 [DEBUG] Message content:', message);
  }

  private _handleTimeoutTest(message: WebviewMessage): void {
    log('🔥 [DEBUG] ========== HTML TIMEOUT TEST MESSAGE RECEIVED ==========');
    log('🔥 [DEBUG] Timeout test communication is working!');
    log('🔥 [DEBUG] Message content:', message);
  }

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
    }
  }

  private async _sendInitializationComplete(terminalCount: number): Promise<void> {
    log(`📤 [PROVIDER] Sending initialization complete: ${terminalCount} terminals`);
    await this._sendMessage({
      command: 'initializationComplete',
      terminalCount: terminalCount,
      timestamp: Date.now(),
    });
  }

  private async _handleTerminalInitializationComplete(message: WebviewMessage): Promise<void> {
    const terminalId = message.terminalId as string;
    if (!terminalId) {
      log('⚠️ [PROVIDER] Terminal initialization complete missing terminalId');
      return;
    }

    const currentState = this._terminalInitStateMachine.getState(terminalId);
    const phase = this._watchdogPhases.get(terminalId);
    if (phase === 'prompt' && currentState >= TerminalInitializationState.ViewReady && !this._safeModeTerminals.has(terminalId)) {
      log(`⏭️ [PROVIDER] Ignoring duplicate terminalInitializationComplete for ${terminalId}`);
      return;
    }

    log(`✅ [PROVIDER] Terminal ${terminalId} initialization confirmed by WebView`);
    this._stopWatchdogForTerminal(terminalId, 'webviewAck');
    this._terminalInitStateMachine.markViewReady(terminalId, 'webviewAck');
    this._startWatchdogForTerminal(terminalId, 'prompt', 'awaitPrompt');

    const terminal = this._terminalManager.getTerminal(terminalId);
    if (!terminal || !terminal.ptyProcess) {
      const attempts = (this._pendingInitRetries.get(terminalId) ?? 0) + 1;
      this._pendingInitRetries.set(terminalId, attempts);

      if (attempts > 5) {
        log(`❌ [PROVIDER] Terminal ${terminalId} still unavailable after ${attempts} retries`);
        this._pendingInitRetries.delete(terminalId);
        return;
      }

      log(
        `⏳ [PROVIDER] Terminal ${terminalId} not ready (attempt=${attempts}). Retrying terminalInitializationComplete handler...`
      );
      setTimeout(() => this._handleTerminalInitializationComplete(message), 50 * attempts);
      return;
    }

    this._pendingInitRetries.delete(terminalId);

    try {
      this._terminalInitStateMachine.markShellInitializing(terminalId, 'initializeShell');
      this._terminalManager.initializeShellForTerminal(terminalId, terminal.ptyProcess, false);
      this._terminalInitStateMachine.markShellInitialized(terminalId, 'initializeShell');
    } catch (error) {
      log(`❌ [PROVIDER] Shell initialization failed for ${terminalId}:`, error);
      this._terminalInitStateMachine.markFailed(terminalId, 'initializeShell');
      this._startWatchdogForTerminal(terminalId, 'prompt', 'shellInitRetry');
      return;
    }

    try {
      this._terminalManager.startPtyOutput(terminalId);
      this._terminalInitStateMachine.markOutputStreaming(terminalId, 'startPtyOutput');
    } catch (error) {
      log(`❌ [PROVIDER] PTY output start failed for ${terminalId}:`, error);
      this._terminalInitStateMachine.markFailed(terminalId, 'startPtyOutput');
      this._startWatchdogForTerminal(terminalId, 'prompt', 'ptyRetry');
      return;
    }

    await this._sendMessage({
      command: TERMINAL_CONSTANTS.COMMANDS.START_OUTPUT,
      terminalId,
      timestamp: Date.now(),
    });
    this._eventCoordinator?.flushBufferedOutput(terminalId);
    this._terminalInitStateMachine.markPromptReady(terminalId, 'startOutput');
    this._stopWatchdogForTerminal(terminalId, 'promptReady');
    this._safeModeTerminals.delete(terminalId);
    this._recordInitializationMetric('success', terminalId);
  }

  private async _handleUpdateSettings(message: WebviewMessage): Promise<void> {
    if (!hasSettings(message)) {
      log('⚠️ [PROVIDER] Update settings message missing settings');
      return;
    }

    log('⚙️ [PROVIDER] Updating settings from WebView');
    await this._settingsService.updateSettings(message.settings);
  }

  private async _handleReportPanelLocation(message: WebviewMessage): Promise<void> {
    const reportedLocation = message.location as PanelLocation;
    if (!reportedLocation) {
      log('⚠️ [PROVIDER] Panel location report missing location');
      return;
    }

    log(`📍 [PROVIDER] WebView reports panel location: ${reportedLocation}`);
    await this._panelLocationService.handlePanelLocationReport(reportedLocation);
  }

  private _requestPanelLocationDetection(): void {
    this._panelLocationService.requestPanelLocationDetection();
  }

  private _determineSplitDirection(): SplitDirection {
    return this._panelLocationService.determineSplitDirection();
  }

  private _getCurrentPanelLocation(): PanelLocation {
    return this._panelLocationService.getCurrentPanelLocation();
  }

  private _setupPanelLocationChangeListener(_webviewView: vscode.WebviewView): void {
    log('🔧 [PROVIDER] Setting up panel location change listener...');

    // Use onDidChangeConfiguration instead of non-existent onDidChangePanelLocation
    const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
      // Check if panelLocation setting changed
      if (event.affectsConfiguration('sidebarTerminal.panelLocation')) {
        log('📍 [PROVIDER] Panel location configuration changed');

        // Get the new location from configuration
        const newLocation = vscode.workspace
          .getConfiguration('sidebarTerminal')
          .get<PanelLocation>('panelLocation', 'sidebar');

        log(`📍 [PROVIDER] New panel location: ${newLocation}`);
        this._panelLocationService.handlePanelLocationReport(newLocation).catch((error) => {
          log(`❌ [PROVIDER] Failed to handle panel location change: ${error}`);
        });
      }
    });

    this._cleanupService.addDisposable(disposable);
    log('✅ [PROVIDER] Panel location change listener registered');
  }

  public splitTerminal(direction?: SplitDirection): void {
    try {
      log('🔀 [PROVIDER] Split terminal requested');
      this._performSplit(direction);
    } catch (error) {
      log('❌ [ERROR] Failed to split terminal:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  private _performSplit(direction?: SplitDirection): void {
    const effectiveDirection = direction || this._determineSplitDirection();
    log(`🔀 [PROVIDER] Splitting terminal in direction: ${effectiveDirection}`);

    const newTerminalId = this._terminalManager.createTerminal();
    this._terminalManager.setActiveTerminal(newTerminalId);

    void this._sendMessage({
      command: 'split',
      terminalId: newTerminalId,
      direction: effectiveDirection,
    });

    void this._sendMessage({
      command: 'stateUpdate',
      state: this._terminalManager.getCurrentState(),
    });

    log(`✅ [PROVIDER] Terminal split complete: ${newTerminalId}`);
  }

  public openSettings(): void {
    log('⚙️ [PROVIDER] Opening settings...');
    void vscode.commands.executeCommand(
      'workbench.action.openSettings',
      '@ext:s-hiraoku.vscode-sidebar-terminal'
    );
  }

  public selectProfile(): void {
    log('👤 [PROVIDER] Opening profile selection...');
    void vscode.commands.executeCommand('workbench.action.terminal.selectDefaultProfile');
  }

  public async killTerminal(): Promise<void> {
    const activeTerminalId = this._terminalManager.getActiveTerminalId();
    if (!activeTerminalId) {
      log('⚠️ [PROVIDER] No active terminal to kill');
      return;
    }

    await this._performKillTerminal(activeTerminalId);
  }

  private async _performKillTerminal(terminalId: string): Promise<void> {
    log(`🗑️ [PROVIDER] Killing terminal: ${terminalId}`);

    this._terminalManager.killTerminal(terminalId);

    await this._sendMessage({
      command: 'terminalRemoved',
      terminalId: terminalId,
    });

    await this._sendMessage({
      command: 'stateUpdate',
      state: this._terminalManager.getCurrentState(),
    });

    log(`✅ [PROVIDER] Terminal killed: ${terminalId}`);
  }

  private async _performKillSpecificTerminal(terminalId: string): Promise<void> {
    log(`🗑️ [PROVIDER] Killing specific terminal: ${terminalId}`);
    await this._performKillTerminal(terminalId);
  }

  public async killSpecificTerminal(terminalId: string): Promise<void> {
    await this._performKillSpecificTerminal(terminalId);
  }

  public async _initializeTerminal(): Promise<void> {
    log('🔧 [PROVIDER] Initializing terminal...');

    const terminals = this._terminalManager.getTerminals();
    for (const terminal of terminals) {
      await this._sendMessage({
        command: 'terminalCreated',
        terminal: {
          id: terminal.id,
          name: terminal.name,
          cwd: terminal.cwd || safeProcessCwd(),
          isActive: terminal.id === this._terminalManager.getActiveTerminalId(),
        },
      });
    }

    await this._sendMessage({
      command: 'stateUpdate',
      state: this._terminalManager.getCurrentState(),
    });

    log('✅ [PROVIDER] Terminal initialization complete');
  }

  public async sendMessageToWebview(message: WebviewMessage): Promise<void> {
    await this._sendMessage(message);
  }

  private async _sendMessage(message: WebviewMessage): Promise<void> {
    if (!this._isInitialized && (message.command as string) !== 'extensionReady') {
      // Queue until WebView signals readiness to avoid losing messages during reload
      this._pendingMessages.push(message);
      log(`⏳ [PROVIDER] Queuing message until webviewReady: ${message.command}`);
      return;
    }

    await this._communicationService.sendMessage(message);
  }

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

      log('[DEBUG] Sending message to WebView:', message);
      void this._sendMessage(message);
    } catch (error) {
      // Continue on error
    }
  }

  public sendFullCliAgentStateSync(): void {
    log('🚀 [PROVIDER] sendFullCliAgentStateSync() called');
    try {
      const connectedAgentId = this._terminalManager.getConnectedAgentTerminalId();
      const connectedAgentType = this._terminalManager.getConnectedAgentType();
      const disconnectedAgents = this._terminalManager.getDisconnectedAgents();

      log('🔍 [PROVIDER] Current CLI Agent state:', {
        connected: { id: connectedAgentId, type: connectedAgentType },
        disconnected: Array.from(disconnectedAgents.entries()),
      });

      const terminalStates: { [terminalId: string]: { status: string; agentType: string | null } } = {};
      const allTerminals = this._terminalManager.getTerminals();

      for (const terminal of allTerminals) {
        const terminalId = terminal.id;

        if (connectedAgentId === terminalId && connectedAgentType) {
          terminalStates[terminalId] = {
            status: 'connected',
            agentType: connectedAgentType,
          };
        } else if (disconnectedAgents.has(terminalId)) {
          const agentInfo = disconnectedAgents.get(terminalId);
          if (!agentInfo) {
            continue;
          }
          terminalStates[terminalId] = {
            status: 'disconnected',
            agentType: agentInfo.type,
          };
        } else {
          terminalStates[terminalId] = {
            status: 'none',
            agentType: null,
          };
        }
      }

      const message = {
        command: 'cliAgentFullStateSync',
        terminalStates: terminalStates,
      };

      log('📤 [PROVIDER] Sending full CLI Agent state sync:', message);

      const view = this._lifecycleManager.getView();
      if (view) {
        void view.webview.postMessage(message);
        log('✅ [PROVIDER] Full CLI Agent state sync sent successfully');
      } else {
        log('⚠️ [PROVIDER] WebView not available for full state sync');
      }
    } catch (error) {
      log('❌ [ERROR] Failed to send full CLI Agent state sync:', error);
    }
  }

  private _ensureMultipleTerminals(): void {
    try {
      const currentTerminals = this._terminalManager.getTerminals().length;
      log(`🔍 [ENSURE] Current terminal count: ${currentTerminals}`);

      if (currentTerminals < 1) {
        log('🎯 [ENSURE] Creating minimum terminal (1)');
        const terminalId = this._terminalManager.createTerminal();
        log(`✅ [ENSURE] Created terminal: ${terminalId}`);
        this._terminalManager.setActiveTerminal(terminalId);
        log(`🎯 [ENSURE] Set terminal as active: ${terminalId}`);
      } else {
        log(`✅ [ENSURE] Sufficient terminals already exist: ${currentTerminals}`);
      }
    } catch (error) {
      log(`❌ [ENSURE] Failed to ensure terminals: ${String(error)}`);
    }
  }

  private async _handlePersistenceMessage(message: WebviewMessage): Promise<void> {
    if (!this._persistenceHandler) {
      log('⚠️ [PERSISTENCE] Persistence handler not available');
      return;
    }

    try {
      await this._persistenceHandler.handleMessage(message as any);
    } catch (error) {
      log('❌ [PERSISTENCE] Error handling persistence message:', error);
    }
  }

  private async _handleLegacyPersistenceMessage(message: WebviewMessage): Promise<void> {
    log('⚠️ [PERSISTENCE] Legacy persistence message received - converting to new format');
    const convertedCommand = message.command === 'terminalSerializationRequest'
      ? 'persistenceSaveSession'
      : 'persistenceRestoreSession';

    await this._handlePersistenceMessage({
      ...message,
      command: convertedCommand,
    });
  }

  public async saveCurrentSession(): Promise<boolean> {
    if (!this._extensionPersistenceService) {
      log('⚠️ [PERSISTENCE] Persistence service not available');
      return false;
    }

    try {
      log('💾 [PERSISTENCE] Saving current session...');
      const terminals = this._terminalManager.getTerminals();
      const activeTerminalId = this._terminalManager.getActiveTerminalId();

      const terminalData = terminals.map((terminal) => ({
        id: terminal.id,
        name: terminal.name,
        cwd: terminal.cwd || safeProcessCwd(),
        isActive: terminal.id === activeTerminalId,
        scrollback: [], // Scrollback is managed by WebView
      }));

      const response = await this._extensionPersistenceService.saveCurrentSession();
      // terminalData is used for logging purposes

      if (response.success) {
        log(`✅ [PERSISTENCE] Session saved successfully: ${terminalData.length} terminals`);
        return true;
      } else {
        log(`❌ [PERSISTENCE] Session save failed: ${response.error}`);
        return false;
      }
    } catch (error) {
      log(`❌ [PERSISTENCE] Save session error: ${error}`);
      return false;
    }
  }

  public async restoreLastSession(): Promise<boolean> {
    if (!this._extensionPersistenceService) {
      log('⚠️ [PERSISTENCE] Persistence service not available');
      return false;
    }

    try {
      log('💾 [PERSISTENCE] Restoring last session...');
      const sessionResult = await this._extensionPersistenceService.restoreSession();

      if (sessionResult && sessionResult.terminals && sessionResult.terminals.length > 0) {
        log(`📦 [PERSISTENCE] Found ${sessionResult.terminals.length} terminals to restore`);

        const terminalMappings: Array<{
          oldId: string;
          newId: string;
          terminalData: any;
        }> = [];

        const restoredTerminals = [];
        for (const terminalData of sessionResult.terminals) {
          try {
            const newTerminalId = this._terminalManager.createTerminal();
            restoredTerminals.push(newTerminalId);
            terminalMappings.push({
              oldId: terminalData.id,
              newId: newTerminalId,
              terminalData: terminalData,
            });
            log(`✅ [PERSISTENCE] Restored terminal: ${terminalData.name} (${newTerminalId})`);
          } catch (error) {
            log(`❌ [PERSISTENCE] Failed to restore terminal ${terminalData.name}:`, error);
          }
        }

        if (restoredTerminals.length > 0) {
          // Send terminal creation notifications
          for (const mapping of terminalMappings) {
            await this._sendMessage({
              command: 'terminalCreated',
              terminal: {
                id: mapping.newId,
                name: mapping.terminalData.name || `Terminal ${mapping.newId}`,
                cwd: mapping.terminalData.cwd || safeProcessCwd(),
                isActive: mapping.terminalData.isActive || false,
              },
            });
          }

          await new Promise(resolve => setTimeout(resolve, 200));

          // Restore scrollback
          for (const mapping of terminalMappings) {
            if (
              mapping.terminalData.scrollback &&
              Array.isArray(mapping.terminalData.scrollback) &&
              mapping.terminalData.scrollback.length > 0
            ) {
              log(
                `📜 [RESTORE-DEBUG] Restoring scrollback for ${mapping.newId}: ${mapping.terminalData.scrollback.length} lines`
              );

              await this._sendMessage({
                command: 'restoreScrollback',
                terminalId: mapping.newId,
                scrollback: mapping.terminalData.scrollback,
              });
            }
          }

          log(
            `✅ [PERSISTENCE] Session restored successfully: ${restoredTerminals.length}/${sessionResult.terminals.length} terminals`
          );

          // Set active terminal
          const activeMapping = terminalMappings.find((m) => m.terminalData.isActive);
          if (activeMapping) {
            this._terminalManager.setActiveTerminal(activeMapping.newId);
            await this._sendMessage({
              command: 'setActiveTerminal',
              terminalId: activeMapping.newId,
            });
          }

          // Notify success
          await this._sendMessage({
            command: 'sessionRestored',
            success: true,
            restoredCount: restoredTerminals.length,
            totalCount: sessionResult.terminals.length,
          });

          return true;
        } else {
          log('⚠️ [PERSISTENCE] No terminals were successfully restored');
          return false;
        }
      } else {
        log('📦 [PERSISTENCE] No session to restore');
        return false;
      }
    } catch (error) {
      log(`❌ [PERSISTENCE] Auto-restore failed: ${error}`);
      return false;
    }
  }

  private _registerInitializationWatchdogs(): void {
    try {
      const createdDisposable = this._terminalManager.onTerminalCreated((terminal) => {
        if (!terminal?.id) {
          return;
        }

        this._terminalInitStartTimes.set(terminal.id, Date.now());
        this._terminalInitStateMachine.markViewPending(terminal.id, 'terminalCreated');
        this._terminalInitStateMachine.markPtySpawned(terminal.id, 'terminalCreated');

        if (this._isInitialized) {
          this._startWatchdogForTerminal(terminal.id, 'ack', 'terminalCreated');
        } else {
          this._pendingWatchdogTerminals.add(terminal.id);
        }
      });

      const removedDisposable = this._terminalManager.onTerminalRemoved((terminalId) => {
        this._stopWatchdogForTerminal(terminalId, 'terminalRemoved');
        this._terminalInitStateMachine.reset(terminalId);
        this._pendingWatchdogTerminals.delete(terminalId);
        this._safeModeTerminals.delete(terminalId);
        this._safeModeNotified.delete(terminalId);
        this._terminalInitStartTimes.delete(terminalId);
        this._recordedInitMetrics.delete(`${terminalId}:success`);
        this._recordedInitMetrics.delete(`${terminalId}:timeout`);
      });

      this._cleanupService.addDisposable(createdDisposable);
      this._cleanupService.addDisposable(removedDisposable);

      const existingTerminals = this._terminalManager.getTerminals();
      for (const terminal of existingTerminals) {
        if (!terminal.id) {
          continue;
        }

        this._terminalInitStartTimes.set(terminal.id, Date.now());
        if (this._isInitialized) {
          this._startWatchdogForTerminal(terminal.id, 'ack', 'existingTerminal');
        } else {
          this._pendingWatchdogTerminals.add(terminal.id);
        }
      }
    } catch (error) {
      log('⚠️ [PROVIDER] Failed to register initialization watchdogs:', error);
    }
  }

  private _startWatchdogForTerminal(
    terminalId: string,
    phase: 'ack' | 'prompt',
    source: string,
    overrideOptions?: Partial<WatchdogOptions>
  ): void {
    const baseOptions =
      phase === 'prompt'
        ? SecondaryTerminalProvider.PROMPT_WATCHDOG_OPTIONS
        : SecondaryTerminalProvider.ACK_WATCHDOG_OPTIONS;
    this._watchdogPhases.set(terminalId, phase);
    this._terminalInitWatchdog.start(terminalId, `${phase}:${source}`, {
      ...baseOptions,
      ...overrideOptions,
    });
    log(`⏳ [WATCHDOG] Started for ${terminalId} (phase=${phase}, source=${source})`);
  }

  private _stopWatchdogForTerminal(terminalId: string, reason: string): void {
    this._terminalInitWatchdog.stop(terminalId, reason);
    this._watchdogPhases.delete(terminalId);
  }

  private _startPendingWatchdogs(): void {
    if (!this._isInitialized || this._pendingWatchdogTerminals.size === 0) {
      return;
    }

    for (const terminalId of Array.from(this._pendingWatchdogTerminals.values())) {
      this._startWatchdogForTerminal(terminalId, 'ack', 'pendingQueue');
      this._pendingWatchdogTerminals.delete(terminalId);
    }
  }

  private _handleInitializationTimeout(
    terminalId: string,
    attempt: number,
    isFinalAttempt: boolean
  ): void {
    const terminal = this._terminalManager.getTerminal(terminalId);
    const phase = this._watchdogPhases.get(terminalId) ?? 'ack';
    if (!terminal || !terminal.ptyProcess) {
      this._stopWatchdogForTerminal(terminalId, 'terminalMissing');
      return;
    }

    log(
      `⚠️ [WATCHDOG] Terminal ${terminalId} init timeout (phase=${phase}, attempt=${attempt}, final=${isFinalAttempt})`
    );

    if (phase === 'ack') {
      if (isFinalAttempt) {
        this._stopWatchdogForTerminal(terminalId, 'ackTimeout');
        this._recordInitializationMetric('timeout', terminalId);
        void this._notifyInitializationFailure(terminalId);
      }
      return;
    }

    if (!this._safeModeTerminals.has(terminalId)) {
      this._safeModeTerminals.add(terminalId);
      log(`⚠️ Prompt timeout -> safe mode for ${terminalId}`);
      this._notifySafeMode(terminalId);
      try {
        this._terminalManager.initializeShellForTerminal(terminalId, terminal.ptyProcess, true);
        this._startWatchdogForTerminal(terminalId, 'prompt', 'safeModeMonitor');
        return;
      } catch (error) {
        log(`❌ [FALLBACK] Safe mode initialization failed for ${terminalId}:`, error);
      }
    }

    if (!isFinalAttempt) {
      return;
    }

    this._stopWatchdogForTerminal(terminalId, 'safeModeFailed');
    this._recordInitializationMetric('timeout', terminalId);
    void this._notifyInitializationFailure(terminalId);
  }

  private _recordInitializationMetric(metric: 'success' | 'timeout', terminalId: string): void {
    const key = `${terminalId}:${metric}`;
    if (this._recordedInitMetrics.has(key)) {
      return;
    }

    this._recordedInitMetrics.add(key);
    const startTime = this._terminalInitStartTimes.get(terminalId);
    const duration = startTime ? Date.now() - startTime : 0;
    this._terminalInitStartTimes.delete(terminalId);
    this._safeModeNotified.delete(terminalId);

    log(`📊 [METRIC] terminal.init.${metric} (terminal=${terminalId}, duration=${duration}ms)`);
    this._telemetryService?.trackPerformance({
      operation: 'terminal.init',
      duration,
      success: metric === 'success',
      metadata: {
        result: metric,
      },
    });
  }

  private async _notifyInitializationFailure(terminalId: string): Promise<void> {
    this._recordInitializationMetric('timeout', terminalId);
    await vscode.window.showErrorMessage(
      'Sidebar Terminal failed to initialize its shell. Close the terminal and create a new one.'
    );
  }

  private _notifySafeMode(terminalId: string): void {
    if (this._safeModeNotified.has(terminalId)) {
      return;
    }

    this._safeModeNotified.add(terminalId);
    void vscode.window.showWarningMessage(
      'Sidebar Terminal prompt is taking longer than expected. Retrying in safe mode...'
    );
  }

  public getPerformanceMetrics() {
    return this._lifecycleManager.getPerformanceMetrics();
  }

  dispose(): void {
    log('🔧 [DEBUG] SecondaryTerminalProvider disposing resources...');

    // Send cleanup message to WebView
    const view = this._lifecycleManager.getView();
    if (view) {
      const cleanupMessage = this._cleanupService.createWebViewCleanupMessage();
      void this._sendMessage(cleanupMessage);
    }

    // Dispose services (order matters - dispose in reverse initialization order)
    this._scrollbackCoordinator.dispose();
    this._panelLocationService.dispose();
    if (this._eventCoordinator) {
      this._eventCoordinator.dispose();
    }
    this._terminalInitWatchdog.dispose();
    this._pendingWatchdogTerminals.clear();
    this._safeModeTerminals.clear();
    this._recordedInitMetrics.clear();

    // Dispose new Facade services
    this._lifecycleManager.dispose();

    // Clear message handlers
    this._messageRouter.clear();
    if (this._terminalIdMapping) {
      this._terminalIdMapping.clear();
    }

    // Dispose HTML generation service
    this._htmlGenerationService.dispose();

    // Dispose persistence services
    if (this._extensionPersistenceService) {
      this._extensionPersistenceService
        .cleanupExpiredSessions()
        .catch((error) => log(`⚠️ [PERSISTENCE] Cleanup during dispose failed: ${error}`));
    }
    this._persistenceHandler = undefined;

    // Dispose all tracked resources using ResourceCleanupService
    this._cleanupService.dispose();

    // Reset state
    this._isInitialized = false;

    log('✅ [DEBUG] SecondaryTerminalProvider disposed');
  }

  public setPhase8Services(
    decorationsService: import('../services/TerminalDecorationsService').TerminalDecorationsService,
    linksService: import('../services/TerminalLinksService').TerminalLinksService
  ): void {
    this._decorationsService = decorationsService;
    this._linksService = linksService;

    log('🎨 [PROVIDER] Phase 8 services (Decorations & Links) connected to provider');

    const view = this._lifecycleManager.getView();
    if (view) {
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
