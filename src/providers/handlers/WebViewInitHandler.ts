/**
 * WebViewInitHandler
 *
 * WebView initialization/handshake lifecycle handler extracted from SecondaryTerminalProvider.
 * Manages: theme resolution, webviewReady/webviewInitialized handshake, panel move reinit,
 * font settings initialization, visibility handling, and message queuing before init.
 */

import * as vscode from 'vscode';
import { WebviewMessage } from '../../types/common';
import { provider as log } from '../../utils/logger';
import type { WebViewFontSettings, PartialTerminalSettings } from '../../types/shared';

/**
 * Dependencies required by WebViewInitHandler
 */
export interface IWebViewInitHandlerDependencies {
  sendMessage(message: WebviewMessage): Promise<void>;
  sendVersionInfo(): void;
  getCurrentSettings(): PartialTerminalSettings;
  getCurrentFontSettings(): WebViewFontSettings;
  orchestratorInitialize(): Promise<unknown>;
  sendFullCliAgentStateSync(): void;
  initializeTerminal(): Promise<void>;
  startPendingWatchdogs(isInitialized: boolean): void;
  panelLocationHandlerHandleWebviewVisible(): void;
}

export class WebViewInitHandler {
  private _isInitialized = false;
  private _pendingPanelMoveReinit = false;
  private _pendingMessages: WebviewMessage[] = [];

  constructor(private readonly deps: IWebViewInitHandlerDependencies) {}

  /**
   * Whether the WebView handshake is complete and messages can be sent
   */
  get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Whether a panel move reinit is pending
   */
  get isPendingPanelMoveReinit(): boolean {
    return this._pendingPanelMoveReinit;
  }

  /**
   * Set pending panel move reinit flag (used by resolveWebviewView on re-entry)
   */
  public setPendingPanelMoveReinit(value: boolean): void {
    this._pendingPanelMoveReinit = value;
  }

  /**
   * Resolve the initial theme for WebView HTML generation.
   * When 'auto', maps VS Code's active color theme to 'light' or 'dark'.
   */
  public resolveInitialTheme(
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

  /**
   * Handle 'webviewReady' message - Extension side of the handshake.
   * Sends extensionReady, marks initialized, flushes queued messages.
   */
  public handleWebviewReady(_message: WebviewMessage): void {
    log('🔥 [TERMINAL-INIT] === _handleWebviewReady CALLED ===');

    if (this._isInitialized) {
      log('🔄 [TERMINAL-INIT] WebView already initialized, skipping duplicate initialization');
      return;
    }

    log('🎯 [TERMINAL-INIT] WebView ready - sending extensionReady confirmation');

    // Send extensionReady
    log('🤝 [HANDSHAKE] Sending extensionReady in response to webviewReady');
    void this.deps.sendMessage({
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
        void this.deps.sendMessage(message);
      });
    }
    this.deps.startPendingWatchdogs(this._isInitialized);

    // Send version information
    this.deps.sendVersionInfo();

    // HANDSHAKE: Do NOT start terminal initialization here!
    // We must wait for webviewInitialized message to ensure WebView's
    // message handlers are fully set up before sending terminalCreated messages.
    log('⏳ [HANDSHAKE] Waiting for webviewInitialized before starting terminal initialization');
  }

  /**
   * Handle 'webviewInitialized' message - WebView's message handlers are fully set up.
   * Sends settings then starts terminal initialization.
   */
  public async handleWebviewInitialized(_message: WebviewMessage): Promise<void> {
    log('🎯 [TERMINAL-INIT] === _handleWebviewInitialized CALLED ===');
    log('🎯 [TERMINAL-INIT] WebView fully initialized - starting terminal initialization');
    log(`🔍 [TERMINAL-INIT] _pendingPanelMoveReinit: ${this._pendingPanelMoveReinit}`);

    // Handle panel move reinit first
    if (this._pendingPanelMoveReinit) {
      this._pendingPanelMoveReinit = false;
      await this.reinitializeWebviewAfterPanelMove();
      return;
    }

    // CRITICAL FIX: Send settings BEFORE creating terminals
    const settings = this.deps.getCurrentSettings();
    const fontSettings = this.deps.getCurrentFontSettings();

    log(`📤 [TERMINAL-INIT] Sending settings to WebView FIRST (theme: ${settings.theme})`);
    await this.deps.sendMessage({
      command: 'settingsResponse',
      settings,
    });

    await this.deps.sendMessage({
      command: 'fontSettingsUpdate',
      fontSettings,
    });
    log('✅ [TERMINAL-INIT] Settings sent to WebView before terminal creation');

    // Send init message and font settings BEFORE creating terminals
    await this.initializeWithFontSettings();
  }

  /**
   * Reinitialize WebView after a panel move (sidebar <-> auxiliary bar).
   */
  public async reinitializeWebviewAfterPanelMove(): Promise<void> {
    try {
      log('🔄 [PANEL-MOVE] Reinitializing WebView after panel move');

      await this.deps.sendMessage({
        command: 'init',
        timestamp: Date.now(),
      });

      const fontSettings = this.deps.getCurrentFontSettings();
      await this.deps.sendMessage({
        command: 'fontSettingsUpdate',
        fontSettings,
      });

      await this.deps.initializeTerminal();
      this.deps.sendFullCliAgentStateSync();

      log('✅ [PANEL-MOVE] WebView reinitialization complete');
    } catch (error) {
      log('❌ [PANEL-MOVE] Failed to reinitialize WebView after panel move:', error);
      try {
        await this.deps.initializeTerminal();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Initialize WebView with font settings before creating terminals.
   * Sends init -> font settings -> orchestrator.initialize() in sequence.
   */
  public async initializeWithFontSettings(): Promise<void> {
    try {
      // Step 1: Send init message
      log('📤 [TERMINAL-INIT] Step 1: Sending init message to WebView...');
      await this.deps.sendMessage({
        command: 'init',
        timestamp: Date.now(),
      });
      log('✅ [TERMINAL-INIT] init message sent');

      // Step 2: Send font settings BEFORE terminal creation
      const fontSettings = this.deps.getCurrentFontSettings();
      log('📤 [TERMINAL-INIT] Step 2: Sending font settings BEFORE terminal creation');
      await this.deps.sendMessage({
        command: 'fontSettingsUpdate',
        fontSettings,
      });
      log('✅ [TERMINAL-INIT] Font settings sent');

      // Step 3: Now create terminals - they will use the font settings we just sent
      log('📤 [TERMINAL-INIT] Step 3: Starting terminal initialization with font settings ready');
      await this.deps.orchestratorInitialize();
      log('✅ [TERMINAL-INIT] Terminal initialization complete');
    } catch (error) {
      log('❌ [TERMINAL-INIT] Error during initialization:', error);
      // Still try to initialize terminals even if font settings failed
      void this.deps.orchestratorInitialize();
    }
  }

  /**
   * Handle WebView becoming visible
   */
  public handleWebviewVisible(): void {
    log('🔄 [VISIBILITY] Handling WebView visible event');
    // Note: secondaryTerminalFocus context is NOT set here. Visibility does not imply DOM focus.
    this.deps.panelLocationHandlerHandleWebviewVisible();
  }

  /**
   * Handle WebView becoming hidden
   */
  public handleWebviewHidden(): void {
    log('🔄 [VISIBILITY] Handling WebView hidden event');
    // Clear focus context when WebView is hidden
    void vscode.commands.executeCommand('setContext', 'secondaryTerminalFocus', false);
  }

  /**
   * Send a message, queuing it if the WebView handshake is not yet complete.
   * extensionReady messages bypass the queue.
   */
  public async sendMessage(message: WebviewMessage): Promise<void> {
    if (!this._isInitialized && (message.command as string) !== 'extensionReady') {
      this._pendingMessages.push(message);
      log(`⏳ [PROVIDER] Queuing message until webviewReady: ${message.command}`);
      return;
    }

    await this.deps.sendMessage(message);
  }

  /**
   * Queue a message for later flushing (used before init completes)
   */
  public queueMessage(message: WebviewMessage): void {
    this._pendingMessages.push(message);
  }

  /**
   * Reset initialization state (e.g., on panel move or dispose)
   */
  public reset(): void {
    this._isInitialized = false;
    this._pendingPanelMoveReinit = false;
    this._pendingMessages = [];
  }
}
