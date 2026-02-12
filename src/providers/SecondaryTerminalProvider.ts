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
import { WatchdogOptions } from './services/TerminalInitializationWatchdog';
import { TerminalCommandHandlers } from './services/TerminalCommandHandlers';
import { TerminalKillService } from './services/TerminalKillService';
import { ProviderSessionService } from './services/ProviderSessionService';
import { WatchdogCoordinator } from './services/WatchdogCoordinator';

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
  private _webviewMessageListenerDisposable: vscode.Disposable | null = null;
  private _webviewMessageListenerView: vscode.WebviewView | null = null;
  private _pendingPanelMoveReinit = false;
  private _hasDetectedPanelLocation = false;
  private _panelLocationDetectionPending = false;
  private _panelLocationDetectionTimeout: NodeJS.Timeout | null = null;

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

  private static readonly PANEL_LOCATION_RESPONSE_TIMEOUT_MS = 2000;

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
          this._terminalManager.initializeShellForTerminal(id, pty as import('node-pty').IPty, safe),
        telemetryService: this._telemetryService,
      },
      SecondaryTerminalProvider.ACK_WATCHDOG_OPTIONS,
      SecondaryTerminalProvider.PROMPT_WATCHDOG_OPTIONS
    );

    log('🎨 [PROVIDER] NEW Facade pattern services initialized (Issue #214)');
    log('✅ [PROVIDER] SecondaryTerminalProvider constructed with all services');

    this._registerInitializationWatchdogs();

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
        log('⚠️ [THEME] WebView not available, theme change will be applied on next initialization');
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
      this._isInitialized = false;
      this._pendingPanelMoveReinit = true;

      // 🔧 FIX: Panel movement creates new WebView instance - must reinitialize HTML
      // VS Code destroys WebView content when moving between panel locations
      log('🔄 [PROVIDER] Panel moved - reinitializing WebView content');
      this._lifecycleManager.configureWebview(webviewView);
      this._registerWebviewMessageListener(webviewView);
      this._initializeWebviewContent(webviewView);

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
    log('🔄 [VISIBILITY] Handling WebView visible event');

    // Guard: Skip panel location detection on simple visibility restore.
    // Only detect on first visibility to prevent unnecessary setContext calls
    // that can cancel VS Code's secondary sidebar maximize state.
    if (this._hasDetectedPanelLocation) {
      log('⏭️ [VISIBILITY] Panel location already detected, skipping redundant detection');
      return;
    }

    // Set flag BEFORE setTimeout to prevent race condition:
    // Multiple visibility events within 200ms would otherwise bypass the guard
    // and queue multiple detection timers, each triggering setContext.
    this._hasDetectedPanelLocation = true;

    // First visibility: trigger detection after layout stabilizes
    setTimeout(() => {
      log('📍 [VISIBILITY] Requesting initial panel location detection');
      this._requestPanelLocationDetection();
    }, 200);
  }

  private _handleWebviewHidden(): void {
    log('🔄 [VISIBILITY] Handling WebView hidden event');
    // Future: Implement state saving if needed
  }

  private _initializeWebviewContent(webviewView: vscode.WebviewView): void {
    log('🔧 [PROVIDER] Step 4: Setting webview HTML...');

    // Get initial theme from settings to prevent flash of wrong theme
    const settings = this._settingsService.getCurrentSettings();
    const settingsTheme = settings.theme as 'light' | 'dark' | 'auto' | undefined;
    const initialTheme = this._resolveInitialTheme(settingsTheme);
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

  private _resolveInitialTheme(
    settingsTheme: 'light' | 'dark' | 'auto' | undefined
  ): 'light' | 'dark' | 'auto' | undefined {
    const normalizedTheme = settingsTheme ?? 'auto';
    if (normalizedTheme !== 'auto') {
      return normalizedTheme;
    }

    const activeThemeKind = vscode.window?.activeColorTheme?.kind;
    const hasThemeKind =
      typeof vscode.ColorThemeKind !== 'undefined' && typeof activeThemeKind === 'number';

    if (!hasThemeKind) {
      return normalizedTheme;
    }

    if (
      activeThemeKind === vscode.ColorThemeKind.Light ||
      activeThemeKind === vscode.ColorThemeKind.HighContrastLight
    ) {
      return 'light';
    }

    if (
      activeThemeKind === vscode.ColorThemeKind.Dark ||
      activeThemeKind === vscode.ColorThemeKind.HighContrast
    ) {
      return 'dark';
    }

    return normalizedTheme;
  }

  private _initializeMessageHandlers(): void {
    // Reset router to avoid duplicate registrations across reinitializations
    this._messageRouter.reset();

    const handlers = [
      // UI handlers
      {
        command: 'webviewReady',
        handler: (msg: WebviewMessage) => this._handleWebviewReady(msg),
        category: 'ui' as const,
      },
      {
        command: TERMINAL_CONSTANTS?.COMMANDS?.READY,
        handler: (msg: WebviewMessage) => this._handleWebviewReady(msg),
        category: 'ui' as const,
      },
      {
        // 🎯 HANDSHAKE: webviewInitialized is sent AFTER WebView's message handlers are set up
        command: 'webviewInitialized',
        handler: (msg: WebviewMessage) => this._handleWebviewInitialized(msg),
        category: 'ui' as const,
      },
      {
        command: 'reportPanelLocation',
        handler: async (msg: WebviewMessage) => await this._handleReportPanelLocation(msg),
        category: 'ui' as const,
      },

      // Settings handlers
      {
        command: 'getSettings',
        handler: async () => await this._handleGetSettings(),
        category: 'settings' as const,
      },
      {
        command: 'updateSettings',
        handler: async (msg: WebviewMessage) => await this._handleUpdateSettings(msg),
        category: 'settings' as const,
      },

      // Terminal handlers (delegated to TerminalCommandHandlers)
      {
        command: 'focusTerminal',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleFocusTerminal(msg),
        category: 'terminal' as const,
      },
      {
        command: TERMINAL_CONSTANTS?.COMMANDS?.FOCUS_TERMINAL,
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleFocusTerminal(msg),
        category: 'terminal' as const,
      },
      {
        command: 'splitTerminal',
        handler: (msg: WebviewMessage) => this._terminalCommandHandlers.handleSplitTerminal(msg),
        category: 'terminal' as const,
      },
      {
        command: 'createTerminal',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleCreateTerminal(msg),
        category: 'terminal' as const,
      },
      {
        command: TERMINAL_CONSTANTS?.COMMANDS?.CREATE_TERMINAL,
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleCreateTerminal(msg),
        category: 'terminal' as const,
      },
      {
        command: TERMINAL_CONSTANTS?.COMMANDS?.INPUT,
        handler: (msg: WebviewMessage) => this._terminalCommandHandlers.handleTerminalInput(msg),
        category: 'terminal' as const,
      },
      {
        command: TERMINAL_CONSTANTS?.COMMANDS?.RESIZE,
        handler: (msg: WebviewMessage) => this._terminalCommandHandlers.handleTerminalResize(msg),
        category: 'terminal' as const,
      },
      {
        command: 'getTerminalProfiles',
        handler: async () => await this._terminalCommandHandlers.handleGetTerminalProfiles(),
        category: 'terminal' as const,
      },
      {
        command: 'killTerminal',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleKillTerminal(msg),
        category: 'terminal' as const,
      },
      {
        command: 'deleteTerminal',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleDeleteTerminal(msg),
        category: 'terminal' as const,
      },
      {
        command: 'terminalClosed',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleTerminalClosed(msg),
        category: 'terminal' as const,
      },
      {
        command: 'openTerminalLink',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleOpenTerminalLink(msg),
        category: 'terminal' as const,
      },
      {
        command: 'reorderTerminals',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleReorderTerminals(msg),
        category: 'terminal' as const,
      },
      {
        command: 'renameTerminal',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleRenameTerminal(msg),
        category: 'terminal' as const,
      },
      {
        command: 'updateTerminalHeader',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleUpdateTerminalHeader(msg),
        category: 'terminal' as const,
      },
      {
        command: 'requestInitialTerminal',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleRequestInitialTerminal(msg),
        category: 'terminal' as const,
      },
      {
        command: 'terminalInitializationComplete',
        handler: async (msg: WebviewMessage) =>
          await this._handleTerminalInitializationComplete(msg),
        category: 'terminal' as const,
      },
      {
        command: 'terminalReady',
        handler: async (msg: WebviewMessage) => await this._handleTerminalReady(msg),
        category: 'terminal' as const,
      },
      {
        command: 'requestClipboardContent',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleClipboardRequest(msg),
        category: 'terminal' as const,
      },
      {
        command: 'copyToClipboard',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleCopyToClipboard(msg),
        category: 'terminal' as const,
      },
      {
        command: 'pasteImage',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handlePasteImage(msg),
        category: 'terminal' as const,
      },
      {
        command: 'pasteText',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handlePasteText(msg),
        category: 'terminal' as const,
      },
      {
        command: 'switchAiAgent',
        handler: async (msg: WebviewMessage) =>
          await this._terminalCommandHandlers.handleSwitchAiAgent(msg),
        category: 'terminal' as const,
      },

      // Persistence handlers
      {
        command: 'persistenceSaveSession',
        handler: async (msg: WebviewMessage) => await this._handlePersistenceMessage(msg),
        category: 'persistence' as const,
      },
      {
        command: 'persistenceRestoreSession',
        handler: async (msg: WebviewMessage) => await this._handlePersistenceMessage(msg),
        category: 'persistence' as const,
      },
      {
        command: 'persistenceClearSession',
        handler: async (msg: WebviewMessage) => await this._handlePersistenceMessage(msg),
        category: 'persistence' as const,
      },
      {
        command: 'terminalSerializationRequest',
        handler: async (msg: WebviewMessage) => await this._handleLegacyPersistenceMessage(msg),
        category: 'persistence' as const,
      },
      {
        command: 'terminalSerializationRestoreRequest',
        handler: async (msg: WebviewMessage) => await this._handleLegacyPersistenceMessage(msg),
        category: 'persistence' as const,
      },
      {
        command: 'pushScrollbackData',
        handler: async (msg: WebviewMessage) => await this._handlePushScrollbackData(msg),
        category: 'persistence' as const,
      },
      {
        command: 'scrollbackDataCollected',
        handler: async (msg: WebviewMessage) => await this._handleScrollbackDataCollected(msg),
        category: 'persistence' as const,
      },
      {
        command: 'scrollbackExtracted',
        handler: async (msg: WebviewMessage) => await this._handleScrollbackDataCollected(msg),
        category: 'persistence' as const,
      },
      {
        command: 'requestScrollbackRefresh',
        handler: async (msg: WebviewMessage) => await this._handleScrollbackRefreshRequest(msg),
        category: 'persistence' as const,
      },

      // Debug handlers
      {
        command: 'htmlScriptTest',
        handler: (msg: WebviewMessage) => this._handleHtmlScriptTest(msg),
        category: 'debug' as const,
      },
      {
        command: 'timeoutTest',
        handler: (msg: WebviewMessage) => this._handleTimeoutTest(msg),
        category: 'debug' as const,
      },
      {
        command: 'test',
        handler: (msg: WebviewMessage) => this._handleDebugTest(msg),
        category: 'debug' as const,
      },
    ];

    this._messageRouter.registerHandlers(handlers);

    // Ensure critical handlers exist to avoid losing init/resize messages
    this._messageRouter.validateHandlers([
      'terminalInitializationComplete',
      'terminalReady',
      TERMINAL_CONSTANTS?.COMMANDS?.READY,
      TERMINAL_CONSTANTS?.COMMANDS?.RESIZE,
      TERMINAL_CONSTANTS?.COMMANDS?.FOCUS_TERMINAL,
    ]);

    // Emit registry snapshot for diagnostics (matches VS Code terminal tracing style)
    this._messageRouter.logRegisteredHandlers();

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
    const scrollbackData = (message as any)?.scrollbackData ?? (message as any)?.scrollbackContent;
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
        log(
          `✅ [PROVIDER] scrollbackDataCollected forwarded to persistence service (requestId=${requestId || 'none'})`
        );
        return;
      }
    }

    // Fallback: treat as pushScrollbackData for cache update
    (message as any).command = 'pushScrollbackData';
    await this._handlePushScrollbackData(message);
  }

  /**
   * 🔧 FIX: Handle scrollback refresh request from WebView after sleep/wake
   */
  private async _handleScrollbackRefreshRequest(message: WebviewMessage): Promise<void> {
    if (!this._extensionPersistenceService) {
      log('⚠️ [PROVIDER] Received requestScrollbackRefresh but persistence service is unavailable');
      return;
    }

    const handler = (this._extensionPersistenceService as any).handleScrollbackRefreshRequest;
    if (typeof handler !== 'function') {
      log('⚠️ [PROVIDER] Persistence service does not support handleScrollbackRefreshRequest');
      return;
    }

    try {
      await handler.call(this._extensionPersistenceService, message);
      log('✅ [PROVIDER] Scrollback refresh request handled');
    } catch (error) {
      log('❌ [PROVIDER] Failed to process scrollback refresh request:', error);
    }
  }

  private async _handleTerminalReady(message: WebviewMessage): Promise<void> {
    const terminalId = message.terminalId as string;
    if (!terminalId) {
      log('⚠️ [PROVIDER] terminalReady missing terminalId');
      return;
    }

    log(`✅ [PROVIDER] Terminal ready: ${terminalId}`);

    // If the state machine hasn't seen the init-complete yet, advance to ViewReady to unblock shell init
    const currentState = this._terminalInitStateMachine.getState(terminalId);
    if (currentState < TerminalInitializationState.ViewReady) {
      this._terminalInitStateMachine.markViewReady(terminalId, 'terminalReady');
      this._watchdogCoordinator.startForTerminal(terminalId, 'prompt', 'terminalReady');
      log(`🔄 [PROVIDER] terminalReady promoted state to ViewReady for ${terminalId}`);
    }

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

    // Mark as initialized (allows messages to be sent)
    this._isInitialized = true;
    // Flush any messages queued before the webview was ready
    if (this._pendingMessages.length > 0) {
      const queued = [...this._pendingMessages];
      this._pendingMessages = [];
      queued.forEach((message) => {
        void this._communicationService.sendMessage(message);
      });
    }
    this._watchdogCoordinator.startPendingWatchdogs(this._isInitialized);

    // Send version information
    void this._communicationService.sendVersionInfo();

    // 🎯 HANDSHAKE: Do NOT start terminal initialization here!
    // We must wait for webviewInitialized message to ensure WebView's
    // message handlers are fully set up before sending terminalCreated messages.
    // The orchestrator.initialize() will be called in _handleWebviewInitialized().
    log('⏳ [HANDSHAKE] Waiting for webviewInitialized before starting terminal initialization');
  }

  /**
   * Handle webviewInitialized message from WebView
   * This is sent AFTER WebView's message handlers are fully set up
   */
  private async _handleWebviewInitialized(_message: WebviewMessage): Promise<void> {
    log('🎯 [TERMINAL-INIT] === _handleWebviewInitialized CALLED ===');
    log('🎯 [TERMINAL-INIT] WebView fully initialized - starting terminal initialization');
    log(`🔍 [TERMINAL-INIT] _pendingPanelMoveReinit: ${this._pendingPanelMoveReinit}`);

    // Handle panel move reinit first
    if (this._pendingPanelMoveReinit) {
      this._pendingPanelMoveReinit = false;
      void this._reinitializeWebviewAfterPanelMove();
      return;
    }

    // 🔧 CRITICAL FIX: Send settings BEFORE creating terminals
    // This ensures WebView has correct theme before first terminal is created
    // Previously, terminals were created with default dark theme before settings arrived
    const settings = this._settingsService.getCurrentSettings();
    const fontSettings = this._settingsService.getCurrentFontSettings();

    log(`📤 [TERMINAL-INIT] Sending settings to WebView FIRST (theme: ${settings.theme})`);
    await this._sendMessage({
      command: 'settingsResponse',
      settings,
    });

    await this._sendMessage({
      command: 'fontSettingsUpdate',
      fontSettings,
    });
    log('✅ [TERMINAL-INIT] Settings sent to WebView before terminal creation');

    // 🔤 FIX: Send init message and font settings BEFORE creating terminals
    // This ensures fonts are applied during terminal creation, not after
    // ⚠️ IMPORTANT: Must await to ensure settings are processed before terminal creation
    await this._initializeWithFontSettings();
  }

  private async _reinitializeWebviewAfterPanelMove(): Promise<void> {
    try {
      log('🔄 [PANEL-MOVE] Reinitializing WebView after panel move');

      await this._sendMessage({
        command: 'init',
        timestamp: Date.now(),
      });

      const fontSettings = this._settingsService.getCurrentFontSettings();
      await this._sendMessage({
        command: 'fontSettingsUpdate',
        fontSettings,
      });

      await this._initializeTerminal();
      this.sendFullCliAgentStateSync();

      log('✅ [PANEL-MOVE] WebView reinitialization complete');
    } catch (error) {
      log('❌ [PANEL-MOVE] Failed to reinitialize WebView after panel move:', error);
      try {
        await this._initializeTerminal();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Initialize WebView with font settings before creating terminals
   * This ensures font settings are available when terminals are created
   */
  private async _initializeWithFontSettings(): Promise<void> {
    try {
      // Step 1: Send init message
      log('📤 [TERMINAL-INIT] Step 1: Sending init message to WebView...');
      await this._sendMessage({
        command: 'init',
        timestamp: Date.now(),
      });
      log('✅ [TERMINAL-INIT] init message sent');

      // Step 2: Send font settings BEFORE terminal creation
      const fontSettings = this._settingsService.getCurrentFontSettings();
      log('📤 [TERMINAL-INIT] Step 2: Sending font settings BEFORE terminal creation');
      await this._sendMessage({
        command: 'fontSettingsUpdate',
        fontSettings,
      });
      log('✅ [TERMINAL-INIT] Font settings sent');

      // Step 3: Now create terminals - they will use the font settings we just sent
      log('📤 [TERMINAL-INIT] Step 3: Starting terminal initialization with font settings ready');
      await this._orchestrator.initialize();
      log('✅ [TERMINAL-INIT] Terminal initialization complete');
    } catch (error) {
      log('❌ [TERMINAL-INIT] Error during initialization:', error);
      // Still try to initialize terminals even if font settings failed
      void this._orchestrator.initialize();
    }
  }

  private async _handleGetSettings(): Promise<void> {
    // Use SettingsSyncService for settings
    const settings = this._settingsService.getCurrentSettings();
    const fontSettings = this._settingsService.getCurrentFontSettings();
    log(`📤 [SETTINGS] _handleGetSettings sending (theme: ${settings.theme})`);

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
      } catch {
        // Silently ignore logger loading errors - debug logging is non-critical
      }
    }
  }

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
    const phase = this._watchdogCoordinator.getPhase(terminalId);
    if (
      phase === 'prompt' &&
      currentState >= TerminalInitializationState.ViewReady &&
      !this._watchdogCoordinator.isInSafeMode(terminalId)
    ) {
      log(`⏭️ [PROVIDER] Ignoring duplicate terminalInitializationComplete for ${terminalId}`);
      return;
    }

    log(`✅ [PROVIDER] Terminal ${terminalId} initialization confirmed by WebView`);
    this._watchdogCoordinator.stopForTerminal(terminalId, 'webviewAck');
    this._terminalInitStateMachine.markViewReady(terminalId, 'webviewAck');
    this._watchdogCoordinator.startForTerminal(terminalId, 'prompt', 'awaitPrompt');

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
      this._watchdogCoordinator.startForTerminal(terminalId, 'prompt', 'shellInitRetry');
      return;
    }

    try {
      this._terminalManager.startPtyOutput(terminalId);
      this._terminalInitStateMachine.markOutputStreaming(terminalId, 'startPtyOutput');
    } catch (error) {
      log(`❌ [PROVIDER] PTY output start failed for ${terminalId}:`, error);
      this._terminalInitStateMachine.markFailed(terminalId, 'startPtyOutput');
      this._watchdogCoordinator.startForTerminal(terminalId, 'prompt', 'ptyRetry');
      return;
    }

    await this._sendMessage({
      command: TERMINAL_CONSTANTS.COMMANDS.START_OUTPUT,
      terminalId,
      timestamp: Date.now(),
    });
    this._eventCoordinator?.flushBufferedOutput(terminalId);
    this._terminalInitStateMachine.markPromptReady(terminalId, 'startOutput');
    this._watchdogCoordinator.stopForTerminal(terminalId, 'promptReady');
    this._watchdogCoordinator.clearSafeMode(terminalId);
    this._watchdogCoordinator.markInitSuccess(terminalId);
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
    // Accept panel location reports only as responses to explicit detection requests.
    // Autonomous reports can trigger setContext and cause VS Code to recalculate layout,
    // which cancels the secondary sidebar's maximized state.
    if (!this._panelLocationDetectionPending) {
      log('⏭️ [PROVIDER] Ignoring unsolicited panel location report');
      return;
    }

    const reportedLocation = message.location as PanelLocation;
    if (!reportedLocation) {
      log('⚠️ [PROVIDER] Panel location report missing location');
      return;
    }

    this._clearPanelLocationDetectionPending('panel location report received');

    log(`📍 [PROVIDER] WebView reports panel location: ${reportedLocation}`);
    await this._panelLocationService.handlePanelLocationReport(reportedLocation);
  }

  private _requestPanelLocationDetection(): void {
    const manualPanelLocation = vscode.workspace
      .getConfiguration('secondaryTerminal')
      .get<'sidebar' | 'panel' | 'auto'>('panelLocation', 'auto');

    if (manualPanelLocation !== 'auto') {
      log(
        `📍 [PROVIDER] Manual panelLocation=${manualPanelLocation}; skipping panel location detection request`
      );
      this._clearPanelLocationDetectionPending('manual panelLocation mode');
      return;
    }

    this._panelLocationDetectionPending = true;
    if (this._panelLocationDetectionTimeout) {
      clearTimeout(this._panelLocationDetectionTimeout);
    }
    this._panelLocationDetectionTimeout = setTimeout(() => {
      this._clearPanelLocationDetectionPending('panel location response timeout');
    }, SecondaryTerminalProvider.PANEL_LOCATION_RESPONSE_TIMEOUT_MS);

    this._panelLocationService.requestPanelLocationDetection();
  }

  private _clearPanelLocationDetectionPending(reason: string): void {
    if (!this._panelLocationDetectionPending && !this._panelLocationDetectionTimeout) {
      return;
    }

    log(`📍 [PROVIDER] Clearing panel location detection pending state (${reason})`);
    this._panelLocationDetectionPending = false;
    if (this._panelLocationDetectionTimeout) {
      clearTimeout(this._panelLocationDetectionTimeout);
      this._panelLocationDetectionTimeout = null;
    }
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
      if (event.affectsConfiguration('secondaryTerminal.panelLocation')) {
        log('📍 [PROVIDER] Panel location configuration changed');

        // Get the new location from configuration
        const newLocation = vscode.workspace
          .getConfiguration('secondaryTerminal')
          .get<PanelLocation>('panelLocation', 'sidebar');

        log(`📍 [PROVIDER] New panel location: ${newLocation}`);
        this._panelLocationService.handlePanelLocationReport(newLocation).catch((error) => {
          log(`❌ [PROVIDER] Failed to handle panel location change: ${error}`);
        });
      }

      // Handle settings changes that affect WebView (e.g., activeBorderMode)
      if (this._isSettingsChangeAffectingWebView(event)) {
        log('⚙️ [PROVIDER] Settings changed, sending updated settings to WebView...');
        void this._sendSettingsUpdateToWebView();
      }

      // Handle font settings changes
      if (this._isFontSettingsChange(event)) {
        log('🎨 [PROVIDER] Font settings changed, sending update to WebView...');
        void this._sendFontSettingsUpdateToWebView();
      }
    });

    this._cleanupService.addDisposable(disposable);
    log('✅ [PROVIDER] Panel location change listener registered');
  }

  /**
   * Check if configuration change affects WebView settings
   */
  private _isSettingsChangeAffectingWebView(event: vscode.ConfigurationChangeEvent): boolean {
    return (
      event.affectsConfiguration('secondaryTerminal.activeBorderMode') ||
      event.affectsConfiguration('secondaryTerminal.theme') ||
      event.affectsConfiguration('secondaryTerminal.cursorBlink') ||
      event.affectsConfiguration('secondaryTerminal.enableCliAgentIntegration') ||
      event.affectsConfiguration('secondaryTerminal.enableTerminalHeaderEnhancements') ||
      event.affectsConfiguration('secondaryTerminal.dynamicSplitDirection') ||
      event.affectsConfiguration('secondaryTerminal.panelLocation') ||
      event.affectsConfiguration('editor.multiCursorModifier') ||
      event.affectsConfiguration('terminal.integrated.altClickMovesCursor') ||
      event.affectsConfiguration('secondaryTerminal.altClickMovesCursor')
    );
  }

  /**
   * Check if configuration change affects font settings
   */
  private _isFontSettingsChange(event: vscode.ConfigurationChangeEvent): boolean {
    return (
      event.affectsConfiguration('secondaryTerminal.fontFamily') ||
      event.affectsConfiguration('secondaryTerminal.fontSize') ||
      event.affectsConfiguration('secondaryTerminal.fontWeight') ||
      event.affectsConfiguration('secondaryTerminal.fontWeightBold') ||
      event.affectsConfiguration('secondaryTerminal.lineHeight') ||
      event.affectsConfiguration('secondaryTerminal.letterSpacing') ||
      event.affectsConfiguration('terminal.integrated.fontSize') ||
      event.affectsConfiguration('terminal.integrated.fontFamily') ||
      event.affectsConfiguration('terminal.integrated.fontWeight') ||
      event.affectsConfiguration('terminal.integrated.fontWeightBold') ||
      event.affectsConfiguration('terminal.integrated.lineHeight') ||
      event.affectsConfiguration('terminal.integrated.letterSpacing') ||
      event.affectsConfiguration('editor.fontSize') ||
      event.affectsConfiguration('editor.fontFamily')
    );
  }

  /**
   * Send updated settings to WebView
   */
  private async _sendSettingsUpdateToWebView(): Promise<void> {
    const settings = this._settingsService.getCurrentSettings();
    log(`📤 [PROVIDER] Sending settings update to WebView: activeBorderMode=${settings.activeBorderMode}`);
    await this._sendMessage({
      command: 'settingsResponse',
      settings,
    });
  }

  /**
   * Send updated font settings to WebView
   */
  private async _sendFontSettingsUpdateToWebView(): Promise<void> {
    const fontSettings = this._settingsService.getCurrentFontSettings();
    log('📤 [PROVIDER] Sending font settings update to WebView');
    await this._sendMessage({
      command: 'fontSettingsUpdate',
      fontSettings,
    });
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
    return this._killService.killTerminal();
  }

  public async killSpecificTerminal(terminalId: string): Promise<void> {
    return this._killService.killSpecificTerminal(terminalId);
  }

  public async _initializeTerminal(): Promise<void> {
    log('🔧 [PROVIDER] Initializing terminal...');

    // 🔧 CRITICAL FIX: Include font settings in terminalCreated message
    // This ensures font settings are available when WebView creates terminals
    const fontSettings = this._settingsService.getCurrentFontSettings();
    log('🔤 [PROVIDER] Font settings for terminal creation:', fontSettings);

    const terminals = this._terminalManager.getTerminals();
    for (const terminal of terminals) {
      const displayModeOverride = this._terminalManager.consumeCreationDisplayModeOverride(
        terminal.id
      );
      await this._sendMessage({
        command: 'terminalCreated',
        terminal: {
          id: terminal.id,
          name: terminal.name,
          cwd: terminal.cwd || safeProcessCwd(),
          isActive: terminal.id === this._terminalManager.getActiveTerminalId(),
        },
        // 🔧 Include font settings directly in the message
        config: {
          fontSettings,
          ...(displayModeOverride ? { displayModeOverride } : {}),
        },
      });
    }

    await this._sendMessage({
      command: 'stateUpdate',
      state: this._terminalManager.getCurrentState(),
    });

    log('✅ [PROVIDER] Terminal initialization complete');
  }

  /**
   * Sync terminal state to WebView after panel movement
   * This is needed because VS Code destroys WebView content when moving panels
   */
  private _syncTerminalStateToWebView(): void {
    log('🔄 [PROVIDER] Syncing terminal state to WebView after panel move');

    // Re-initialize terminals in WebView
    void this._initializeTerminal();

    // Sync CLI agent state
    this.sendFullCliAgentStateSync();

    log('✅ [PROVIDER] Terminal state sync complete');
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
    log('🔥 [ENSURE] _ensureMultipleTerminals called');
    try {
      const currentTerminals = this._terminalManager.getTerminals().length;
      log(`🔍 [ENSURE] Current terminal count: ${currentTerminals}`);

      if (currentTerminals < 1) {
        log('🎯 [ENSURE] Creating minimum terminal (1)');
        const terminalId = this._terminalManager.createTerminal();
        log(`✅ [ENSURE] Created terminal: ${terminalId}`);

        if (!terminalId) {
          log('❌ [ENSURE] createTerminal() returned null/undefined!');
          return;
        }

        this._terminalManager.setActiveTerminal(terminalId);
        log(`🎯 [ENSURE] Set terminal as active: ${terminalId}`);

        // 🎯 FIX: Notify WebView about the newly created terminal
        log('🎯 [ENSURE] About to call _initializeTerminal...');
        void this._initializeTerminal().then(() => {
          log('🎯 [ENSURE] _initializeTerminal completed');
        }).catch((err) => {
          log(`❌ [ENSURE] _initializeTerminal failed: ${err}`);
        });
        log('🎯 [ENSURE] Called _initializeTerminal (async)');
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

  private _registerInitializationWatchdogs(): void {
    try {
      const createdDisposable = this._terminalManager.onTerminalCreated((terminal) => {
        if (!terminal?.id) {
          return;
        }

        this._watchdogCoordinator.recordInitStart(terminal.id);
        this._terminalInitStateMachine.markViewPending(terminal.id, 'terminalCreated');
        this._terminalInitStateMachine.markPtySpawned(terminal.id, 'terminalCreated');

        if (this._isInitialized) {
          this._watchdogCoordinator.startForTerminal(terminal.id, 'ack', 'terminalCreated');
        } else {
          this._watchdogCoordinator.addPendingTerminal(terminal.id);
        }
      });

      const removedDisposable = this._terminalManager.onTerminalRemoved((terminalId) => {
        this._watchdogCoordinator.stopForTerminal(terminalId, 'terminalRemoved');
        this._terminalInitStateMachine.reset(terminalId);
      });

      this._cleanupService.addDisposable(createdDisposable);
      this._cleanupService.addDisposable(removedDisposable);

      const existingTerminals = this._terminalManager.getTerminals();
      for (const terminal of existingTerminals) {
        if (!terminal.id) {
          continue;
        }

        this._watchdogCoordinator.recordInitStart(terminal.id);
        if (this._isInitialized) {
          this._watchdogCoordinator.startForTerminal(terminal.id, 'ack', 'existingTerminal');
        } else {
          this._watchdogCoordinator.addPendingTerminal(terminal.id);
        }
      }
    } catch (error) {
      log('⚠️ [PROVIDER] Failed to register initialization watchdogs:', error);
    }
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
    this._isInitialized = false;
    this._hasDetectedPanelLocation = false;
    this._clearPanelLocationDetectionPending('provider disposed');

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
