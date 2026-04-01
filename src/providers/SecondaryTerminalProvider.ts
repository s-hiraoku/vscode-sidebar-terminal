import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { WebviewMessage } from '../types/common';
import { safeProcessCwd } from '../utils/common';
import { TerminalErrorHandler } from '../utils/feedback';
import { provider as log } from '../utils/logger';
import { PersistenceMessageHandler } from '../handlers/PersistenceMessageHandler';
import { TerminalInitializationCoordinator } from './TerminalInitializationCoordinator';
// hasSettings moved to SettingsMessageHandler
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
import { TerminalInitializationStateMachine } from './services/TerminalInitializationStateMachine';
import { WatchdogOptions } from './services/TerminalInitializationWatchdog';
import { TerminalCommandHandlers } from './services/TerminalCommandHandlers';
import { TerminalKillService } from './services/TerminalKillService';
import { ProviderSessionService } from './services/ProviderSessionService';
import { WatchdogCoordinator } from './services/WatchdogCoordinator';
import { ScrollbackMessageHandler } from './handlers/ScrollbackMessageHandler';
import { DebugMessageHandler } from './handlers/DebugMessageHandler';
import { SettingsMessageHandler } from './handlers/SettingsMessageHandler';
import { PanelLocationHandler } from './handlers/PanelLocationHandler';
import { WebViewInitHandler } from './handlers/WebViewInitHandler';
import { MessageHandlerRegistrar } from './handlers/MessageHandlerRegistrar';
import { TerminalInitLifecycleHandler } from './handlers/TerminalInitLifecycleHandler';

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
    FOCUS: 'secondaryTerminalFocus',
  } as const;

  private _terminalIdMapping?: Map<string, string>;
  private _webviewMessageListenerDisposable: vscode.Disposable | null = null;
  private _webviewMessageListenerView: vscode.WebviewView | null = null;

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
  private readonly _killService: TerminalKillService;
  private readonly _sessionService: ProviderSessionService;
  private readonly _watchdogCoordinator: WatchdogCoordinator;
  private readonly _scrollbackMessageHandler: ScrollbackMessageHandler;
  private readonly _debugMessageHandler: DebugMessageHandler;
  private readonly _settingsMessageHandler: SettingsMessageHandler;
  private readonly _panelLocationHandler: PanelLocationHandler;
  private readonly _webViewInitHandler: WebViewInitHandler;
  private readonly _messageHandlerRegistrar: MessageHandlerRegistrar;
  private readonly _terminalInitLifecycleHandler: TerminalInitLifecycleHandler;

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
    this._panelLocationService = new PanelLocationService((message: unknown) =>
      this._communicationService.sendMessage(message as WebviewMessage)
    );
    this._linkResolver = new TerminalLinkResolver((terminalId: string) =>
      this._terminalManager.getTerminal(terminalId)
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
    this._settingsService = new SettingsSyncService(async () => await this._initializeTerminal());

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

    // Initialize extracted services (Phase 3 refactoring)
    this._killService = new TerminalKillService({
      getActiveTerminalId: () => this._terminalManager.getActiveTerminalId(),
      getTerminal: (id) => this._terminalManager.getTerminal(id),
      killTerminal: (id) => this._terminalManager.killTerminal(id),
      getCurrentState: () => this._terminalManager.getCurrentState(),
      sendMessage: (msg) => this._sendMessage(msg),
    });

    this._sessionService = new ProviderSessionService({
      extensionPersistenceService: this._extensionPersistenceService ?? null,
      getTerminals: () => this._terminalManager.getTerminals(),
      getActiveTerminalId: () => this._terminalManager.getActiveTerminalId(),
      createTerminal: () => this._terminalManager.createTerminal(),
      sendMessage: (msg) => this._sendMessage(msg),
      getCurrentFontSettings: () => this._settingsService.getCurrentFontSettings(),
    });

    this._watchdogCoordinator = new WatchdogCoordinator(
      {
        getTerminal: (id) => this._terminalManager.getTerminal(id),
        initializeShellForTerminal: (id, pty, safe) =>
          this._terminalManager.initializeShellForTerminal(
            id,
            pty as import('node-pty').IPty,
            safe
          ),
        telemetryService: this._telemetryService,
      },
      SecondaryTerminalProvider.ACK_WATCHDOG_OPTIONS,
      SecondaryTerminalProvider.PROMPT_WATCHDOG_OPTIONS
    );

    // Initialize extracted message handlers (Phase 3A refactoring)
    this._scrollbackMessageHandler = new ScrollbackMessageHandler({
      getExtensionPersistenceService: () => this._extensionPersistenceService ?? null,
    });

    this._debugMessageHandler = new DebugMessageHandler({
      isDebugEnabled: () => {
        try {
          const { isDebugEnabled } = require('../utils/logger');
          return isDebugEnabled ? isDebugEnabled() : false;
        } catch {
          return false;
        }
      },
    });

    this._settingsMessageHandler = new SettingsMessageHandler({
      getSettingsService: () => this._settingsService,
      sendMessage: (msg) => this._sendMessage(msg),
    });

    this._panelLocationHandler = new PanelLocationHandler({
      panelLocationService: this._panelLocationService,
      sendMessage: (msg) => this._sendMessage(msg),
    });

    this._webViewInitHandler = new WebViewInitHandler({
      sendMessage: (msg) => this._communicationService.sendMessage(msg),
      sendVersionInfo: () => void this._communicationService.sendVersionInfo(),
      getCurrentSettings: () => this._settingsService.getCurrentSettings(),
      getCurrentFontSettings: () => this._settingsService.getCurrentFontSettings(),
      orchestratorInitialize: () => this._orchestrator.initialize(),
      sendFullCliAgentStateSync: () => this.sendFullCliAgentStateSync(),
      initializeTerminal: () => this._initializeTerminal(),
      startPendingWatchdogs: (isInit) => this._watchdogCoordinator.startPendingWatchdogs(isInit),
      panelLocationHandlerHandleWebviewVisible: () =>
        this._panelLocationHandler.handleWebviewVisible(),
    });

    this._messageHandlerRegistrar = new MessageHandlerRegistrar({
      handleWebviewReady: (msg) => this._handleWebviewReady(msg),
      handleWebviewInitialized: (msg) => this._handleWebviewInitialized(msg),
      handleReportPanelLocation: (msg) => this._handleReportPanelLocation(msg),
      handleTerminalInitializationComplete: (msg) =>
        this._handleTerminalInitializationComplete(msg),
      handleTerminalReady: (msg) => this._handleTerminalReady(msg),
      handlePersistenceMessage: (msg) => this._handlePersistenceMessage(msg),
      handleLegacyPersistenceMessage: (msg) => this._handleLegacyPersistenceMessage(msg),
      terminalCommandHandlers: this._terminalCommandHandlers,
      settingsMessageHandler: this._settingsMessageHandler,
      scrollbackMessageHandler: this._scrollbackMessageHandler,
      debugMessageHandler: this._debugMessageHandler,
      onTerminalFocusChanged: (focused) => this._terminalManager.setTerminalFocused(focused),
    });

    // Initialize terminal init lifecycle handler
    this._terminalInitLifecycleHandler = new TerminalInitLifecycleHandler({
      getTerminal: (id) => this._terminalManager.getTerminal(id),
      getTerminals: () => this._terminalManager.getTerminals(),
      getActiveTerminalId: () => this._terminalManager.getActiveTerminalId(),
      createTerminal: () => this._terminalManager.createTerminal(),
      setActiveTerminal: (id) => this._terminalManager.setActiveTerminal(id),
      initializeShellForTerminal: (id, pty, safe) =>
        this._terminalManager.initializeShellForTerminal(id, pty as import('node-pty').IPty, safe),
      startPtyOutput: (id) => this._terminalManager.startPtyOutput(id),
      consumeCreationDisplayModeOverride: (id) =>
        this._terminalManager.consumeCreationDisplayModeOverride(id),
      getCurrentState: () => this._terminalManager.getCurrentState(),
      onTerminalCreated: (cb) => this._terminalManager.onTerminalCreated(cb),
      onTerminalRemoved: (cb) => this._terminalManager.onTerminalRemoved(cb),
      sendMessage: (msg) => this._sendMessage(msg),
      getCurrentFontSettings: () => this._settingsService.getCurrentFontSettings(),
      sendFullCliAgentStateSync: () => this.sendFullCliAgentStateSync(),
      addDisposable: (d) => this._cleanupService.addDisposable(d),
      isWebViewInitialized: () => this._webViewInitHandler.isInitialized,
      watchdogCoordinator: this._watchdogCoordinator,
      terminalInitStateMachine: this._terminalInitStateMachine,
      eventCoordinator: null, // Set later when event coordinator is initialized
      safeProcessCwd,
    });

    log('🎨 [PROVIDER] NEW Facade pattern services initialized (Issue #214)');
    log('✅ [PROVIDER] SecondaryTerminalProvider constructed with all services');

    this._terminalInitLifecycleHandler.registerInitializationWatchdogs();

    // 🎨 Auto theme synchronization: Listen for VS Code theme changes
    this._registerThemeChangeListener();
  }

  /**
   * Register listener for VS Code theme changes
   * When theme setting is 'auto', automatically sync terminal theme with VS Code
   */
  private _registerThemeChangeListener(): void {
    const disposable = vscode.window.onDidChangeActiveColorTheme((colorTheme) => {
      const currentSettings = this._settingsService.getCurrentSettings();
      const themeMode = currentSettings.theme as 'light' | 'dark' | 'auto' | undefined;

      // Only react when theme is set to 'auto'
      if (themeMode !== 'auto') {
        log(`🎨 [THEME] Theme change detected but mode is '${themeMode}', ignoring`);
        return;
      }

      const isDark =
        colorTheme.kind === vscode.ColorThemeKind.Dark ||
        colorTheme.kind === vscode.ColorThemeKind.HighContrast;

      const newTheme = isDark ? 'dark' : 'light';
      log(`🎨 [THEME] VS Code theme changed to ${newTheme}, syncing to WebView`);

      // Send theme change message to WebView
      const view = this._lifecycleManager.getView();
      if (view) {
        void view.webview.postMessage({
          command: 'themeChanged',
          theme: newTheme,
        });
        log(`🎨 [THEME] Sent themeChanged message to WebView: ${newTheme}`);
      } else {
        log(
          '⚠️ [THEME] WebView not available, theme change will be applied on next initialization'
        );
      }
    });

    this._cleanupService.addDisposable(disposable);
    log('🎨 [PROVIDER] Theme change listener registered');
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    const startTime = this._lifecycleManager.trackResolveStart();

    log('🚀 [PROVIDER] === RESOLVING WEBVIEW VIEW ===');
    log(
      `📊 [METRICS] resolveWebviewView call #${this._lifecycleManager.getPerformanceMetrics().resolveWebviewViewCallCount}`
    );

    // Check if body already rendered (VS Code ViewPane pattern)
    if (this._lifecycleManager.isBodyRendered()) {
      log('⏭️ [PROVIDER] Body already rendered - checking if WebView needs reinitialization');
      this._lifecycleManager.trackPanelMovement(startTime);

      // Update view references for panel movements
      this._lifecycleManager.setView(webviewView);
      this._communicationService.setView(webviewView);

      // 🔧 FIX: Panel movement recreates the WebView content; restart handshake for the new instance
      this._webViewInitHandler.reset();
      this._webViewInitHandler.setPendingPanelMoveReinit(true);

      // 🔧 FIX: Panel movement creates new WebView instance - must reinitialize HTML
      // VS Code destroys WebView content when moving between panel locations
      log('🔄 [PROVIDER] Panel moved - reinitializing WebView content');
      this._lifecycleManager.configureWebview(webviewView);
      this._registerWebviewMessageListener(webviewView);
      this._initializeWebviewContent(webviewView);

      // Note: secondaryTerminalFocus context is driven solely by terminalFocused/terminalBlurred
      // WebView messages. We do not set it here because the panel may be visible but not focused.

      return;
    }

    try {
      this._resetForNewView(webviewView);
      log('🔧 [PROVIDER] Step 1: Configuring webview options...');
      this._lifecycleManager.configureWebview(webviewView);

      // Register all handlers BEFORE wiring the message listener to avoid early unrouted messages
      this._initializeMessageHandlers();

      // Message listener after handlers are ready
      this._registerWebviewMessageListener(webviewView);

      this._registerVisibilityListener(webviewView);
      this._initializeWebviewContent(webviewView);
      this._setupPanelLocationChangeListener(webviewView);

      // Mark body as rendered (VS Code ViewPane pattern)
      this._lifecycleManager.setBodyRendered(true);
      log('✅ [PROVIDER] Body rendering complete, _bodyRendered flag set to true');

      // Track initialization completion
      this._lifecycleManager.trackInitializationComplete(startTime);
      this._lifecycleManager.logPerformanceMetrics();

      // Note: secondaryTerminalFocus context is driven solely by terminalFocused/terminalBlurred
      // WebView messages from the actual DOM focus state. We do not set it unconditionally here.

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
      () => this.sendFullCliAgentStateSync(),
      this._terminalIdMapping,
      this._terminalInitStateMachine
    );
    this._eventCoordinator.initialize();

    // Update the terminal init lifecycle handler's event coordinator reference
    this._terminalInitLifecycleHandler.setEventCoordinator(this._eventCoordinator);

    log('✅ [PROVIDER] Event coordinator initialized');
  }

  private _registerWebviewMessageListener(webviewView: vscode.WebviewView): void {
    // If this is a new WebView instance (panel movement), dispose old listener and re-register
    if (this._webviewMessageListenerView !== webviewView) {
      this._webviewMessageListenerDisposable?.dispose();
      this._webviewMessageListenerDisposable = null;
      this._webviewMessageListenerView = webviewView;
      this._lifecycleManager.setMessageListenerRegistered(false);
    }

    // Prevent duplicate message listener registration
    if (this._lifecycleManager.isMessageListenerRegistered()) {
      log('⏭️ [PROVIDER] Message listener already registered for current WebView');
      return;
    }

    log('🔧 [PROVIDER] Step 2: Setting up message listeners (BEFORE HTML)...');

    // Track listener registration
    this._lifecycleManager.trackListenerRegistration();

    const disposable = webviewView.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        log('📨 [PROVIDER] ✅ MESSAGE RECEIVED FROM WEBVIEW!');
        log('📨 [PROVIDER] Message command:', message.command);

        // 🎯 HANDSHAKE: Special logging for critical handshake messages
        if (message.command === 'webviewReady') {
          log('🤝 [HANDSHAKE] <<<< webviewReady received from WebView');
        }
        if (message.command === 'webviewInitialized') {
          log('🤝 [HANDSHAKE] <<<< webviewInitialized received from WebView');
        }

        try {
          const { isDebugEnabled } = require('../utils/logger');
          if (isDebugEnabled && isDebugEnabled()) {
            log('📨 [PROVIDER] Message data:', message);
          }
        } catch {
          // Silently ignore logger loading errors - debug logging is non-critical
        }

        // Handle message using MessageRoutingFacade, with fallback for critical commands
        this._messageRouter
          .handleMessage(message)
          .then((handled) => {
            if (!handled) {
              this._handleUnroutedMessage(message);
            }
          })
          .catch((error) => {
            log('❌ [PROVIDER] Error handling message:', error);
          });
      },
      undefined,
      this._extensionContext.subscriptions
    );

    this._cleanupService.addDisposable(disposable);
    this._webviewMessageListenerDisposable = disposable;
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
    this._webViewInitHandler.handleWebviewVisible();
  }

  private _handleWebviewHidden(): void {
    this._webViewInitHandler.handleWebviewHidden();
  }

  private _initializeWebviewContent(webviewView: vscode.WebviewView): void {
    log('🔧 [PROVIDER] Step 4: Setting webview HTML...');

    // Get initial theme from settings to prevent flash of wrong theme
    const settings = this._settingsService.getCurrentSettings();
    const settingsTheme = settings.theme as 'light' | 'dark' | 'auto' | undefined;
    const initialTheme = this._webViewInitHandler.resolveInitialTheme(settingsTheme);
    log(`🎨 [PROVIDER] Initial theme for HTML: ${initialTheme} (settings: ${settingsTheme})`);

    // Generate HTML content with initial theme
    const htmlContent = this._htmlGenerationService.generateMainHtml({
      webview: webviewView.webview,
      extensionUri: this._extensionContext.extensionUri,
      includeSplitStyles: true,
      includeCliAgentStyles: true,
      initialTheme,
    });

    // Set HTML using lifecycle manager
    this._lifecycleManager.setWebviewHtml(webviewView, htmlContent, false);

    log('🤝 [HANDSHAKE] HTML set, waiting for webviewReady from WebView');
  }

  private _initializeMessageHandlers(): void {
    this._messageHandlerRegistrar.registerAll(this._messageRouter);
  }

  // Scrollback message handlers delegated to ScrollbackMessageHandler

  private async _handleTerminalReady(message: WebviewMessage): Promise<void> {
    await this._terminalInitLifecycleHandler.handleTerminalReady(message);

    // Forward to persistence service for terminal ready event handling
    const terminalId = message.terminalId as string;
    if (terminalId && this._extensionPersistenceService) {
      const handler = (this._extensionPersistenceService as any).handleTerminalReady;
      if (typeof handler === 'function') {
        handler.call(this._extensionPersistenceService, terminalId);
      }
    }
  }

  private _handleWebviewReady(message: WebviewMessage): void {
    this._webViewInitHandler.handleWebviewReady(message);
  }

  /**
   * Handle webviewInitialized message from WebView
   * This is sent AFTER WebView's message handlers are fully set up
   */
  private async _handleWebviewInitialized(message: WebviewMessage): Promise<void> {
    await this._webViewInitHandler.handleWebviewInitialized(message);
  }

  private async _handleGetSettings(): Promise<void> {
    // Delegate settings + font settings to SettingsMessageHandler
    await this._settingsMessageHandler.handleGetSettings();

    // Send initial panel location (provider-specific, not part of settings handler)
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

  // Debug message handlers delegated to DebugMessageHandler

  /**
   * Fallback handler for critical messages that failed normal routing.
   * Prevents terminal initialization from getting stuck if a handler was not registered in time.
   */
  private _handleUnroutedMessage(message: WebviewMessage): void {
    log(`⚠️ [PROVIDER] No handler registered for command '${message.command}', invoking fallback`);

    switch (message.command) {
      case 'terminalInitializationComplete':
        void this._handleTerminalInitializationComplete(message);
        break;
      case 'terminalReady':
        void this._handleTerminalReady(message);
        break;
      default:
        log(`⚠️ [PROVIDER] No fallback available for command: ${message.command}`);
        break;
    }
  }

  private async _sendInitializationComplete(terminalCount: number): Promise<void> {
    await this._terminalInitLifecycleHandler.sendInitializationComplete(terminalCount);
  }

  private async _handleTerminalInitializationComplete(message: WebviewMessage): Promise<void> {
    await this._terminalInitLifecycleHandler.handleTerminalInitializationComplete(message);
  }

  private async _handleUpdateSettings(message: WebviewMessage): Promise<void> {
    await this._settingsMessageHandler.handleUpdateSettings(message);
  }

  private async _handleReportPanelLocation(message: WebviewMessage): Promise<void> {
    await this._panelLocationHandler.handleReportPanelLocation(message);
  }

  private _requestPanelLocationDetection(): void {
    this._panelLocationHandler.requestPanelLocationDetection();
  }

  private _clearPanelLocationDetectionPending(reason: string): void {
    this._panelLocationHandler.clearPanelLocationDetectionPending(reason);
  }

  private _determineSplitDirection(): SplitDirection {
    return this._panelLocationService.determineSplitDirection();
  }

  private _getCurrentPanelLocation(): PanelLocation {
    return this._panelLocationService.getCurrentPanelLocation();
  }

  private _setupPanelLocationChangeListener(_webviewView: vscode.WebviewView): void {
    log('🔧 [PROVIDER] Setting up panel location change listener...');

    // Panel location config changes delegated to PanelLocationHandler
    const panelDisposable = this._panelLocationHandler.setupPanelLocationChangeListener();
    this._cleanupService.addDisposable(panelDisposable);

    // Settings and font changes remain as a separate listener
    const settingsDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
      // Handle settings changes that affect WebView (delegated to SettingsMessageHandler)
      if (this._settingsMessageHandler.isSettingsChangeAffectingWebView(event)) {
        log('⚙️ [PROVIDER] Settings changed, sending updated settings to WebView...');
        void this._settingsMessageHandler.sendSettingsUpdateToWebView();
      }

      // Handle font settings changes (delegated to SettingsMessageHandler)
      if (this._settingsMessageHandler.isFontSettingsChange(event)) {
        log('🎨 [PROVIDER] Font settings changed, sending update to WebView...');
        void this._settingsMessageHandler.sendFontSettingsUpdateToWebView();
      }
    });

    this._cleanupService.addDisposable(settingsDisposable);
    log('✅ [PROVIDER] Panel location change listener registered');
  }

  // Settings change detection, WebView sync, and font settings sync
  // are delegated to SettingsMessageHandler

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
    return this._killService.killTerminal();
  }

  public async killSpecificTerminal(terminalId: string): Promise<void> {
    return this._killService.killSpecificTerminal(terminalId);
  }

  public async _initializeTerminal(): Promise<void> {
    await this._terminalInitLifecycleHandler.initializeTerminal();
  }

  /**
   * Sync terminal state to WebView after panel movement
   * This is needed because VS Code destroys WebView content when moving panels
   */
  private _syncTerminalStateToWebView(): void {
    this._terminalInitLifecycleHandler.syncTerminalStateToWebView();
  }

  public async sendMessageToWebview(message: WebviewMessage): Promise<void> {
    await this._sendMessage(message);
  }

  private async _sendMessage(message: WebviewMessage): Promise<void> {
    await this._webViewInitHandler.sendMessage(message);
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
    } catch {
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

      const terminalStates: { [terminalId: string]: { status: string; agentType: string | null } } =
        {};
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
    this._terminalInitLifecycleHandler.ensureMultipleTerminals();
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
    const convertedCommand =
      message.command === 'terminalSerializationRequest'
        ? 'persistenceSaveSession'
        : 'persistenceRestoreSession';

    await this._handlePersistenceMessage({
      ...message,
      command: convertedCommand,
    });
  }

  public async saveCurrentSession(): Promise<boolean> {
    return this._sessionService.saveCurrentSession();
  }

  public async restoreLastSession(): Promise<boolean> {
    return this._sessionService.restoreLastSession();
  }

  public getPerformanceMetrics() {
    return this._lifecycleManager.getPerformanceMetrics();
  }

  dispose(): void {
    log('🔧 [DEBUG] SecondaryTerminalProvider disposing resources...');

    // Clear context keys
    void vscode.commands.executeCommand('setContext', 'secondaryTerminalFocus', false);

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
    this._watchdogCoordinator.dispose();

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
    this._webViewInitHandler.reset();
    this._panelLocationHandler.resetDetectionState();
    this._panelLocationHandler.dispose();

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
