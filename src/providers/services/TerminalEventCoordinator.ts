/**
 * Terminal Event Coordinator
 *
 * Manages terminal event listeners and forwards events to WebView
 * Extracted from SecondaryTerminalProvider for better separation of concerns
 */

import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';
import { TerminalManager } from '../../terminals/TerminalManager';
import { TERMINAL_CONSTANTS } from '../../constants';
import { getTerminalConfig } from '../../utils/common';
import { WebviewMessage } from '../../types/common';
import { WebViewFontSettings } from '../../types/shared';
import { TerminalInitializationStateMachine } from './TerminalInitializationStateMachine';
import { getUnifiedConfigurationService } from '../../config/UnifiedConfigurationService';

/**
 * Terminal Event Coordinator
 *
 * Responsibilities:
 * - Setting up terminal event listeners (data, exit, creation, removal, focus)
 * - Forwarding terminal events to WebView
 * - CLI Agent status monitoring
 * - Configuration change monitoring
 * - Cleanup of event listeners
 */
export class TerminalEventCoordinator implements vscode.Disposable {
  private readonly _terminalEventDisposables: vscode.Disposable[] = [];
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _outputBuffers = new Map<string, string[]>();

  constructor(
    private readonly _terminalManager: TerminalManager,
    private readonly _sendMessage: (message: WebviewMessage) => Promise<void>,
    private readonly _sendFullCliAgentStateSync: () => void,
    private readonly _terminalIdMapping?: Map<string, string>,
    private readonly _initializationState?: TerminalInitializationStateMachine
  ) {}

  /**
   * Initialize event listeners
   */
  public initialize(): void {
    this.setupTerminalEventListeners();
    this.setupCliAgentStatusListeners();
    this.setupConfigurationChangeListeners();
    log('✅ [EVENT-COORDINATOR] All event listeners initialized');
  }

  /**
   * Set up terminal event listeners
   */
  public setupTerminalEventListeners(): void {
    // Clear existing listeners to prevent duplicates
    this.clearTerminalEventListeners();

    // Handle terminal output
    const dataDisposable = this._terminalManager.onData((event) => {
      if (!event.data) {
        log('⚠️ [EVENT-COORDINATOR] Empty data received from terminal:', event.terminalId);
        return;
      }

      const webviewTerminalId = this._resolveWebviewTerminalId(event.terminalId);
      const outputAllowed =
        !this._initializationState || this._initializationState.isOutputAllowed(event.terminalId);

      log(
        '🔍 [EVENT-COORDINATOR] Terminal output received:',
        event.data.length,
        'chars, Extension ID:',
        event.terminalId,
        '→ WebView ID:',
        webviewTerminalId,
        'ready:',
        outputAllowed,
        'preview:',
        JSON.stringify(event.data.substring(0, 50))
      );

      if (!outputAllowed) {
        this._bufferOutput(webviewTerminalId, event.data);
        return;
      }

      this._sendOutput(webviewTerminalId, event.data);
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
      log('🆕 [EVENT-COORDINATOR] Terminal created:', terminal.id, terminal.name);

      const message: WebviewMessage = {
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED,
        terminalId: terminal.id,
        terminalName: terminal.name,
        terminalNumber: terminal.number,
        config: getTerminalConfig(),
      };

      void this._sendMessage(message);
    });

    // Handle terminal removal
    const removedDisposable = this._terminalManager.onTerminalRemoved((terminalId) => {
      this._outputBuffers.delete(this._resolveWebviewTerminalId(terminalId));
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_REMOVED,
        terminalId,
      });
    });

    // Handle state updates
    const stateUpdateDisposable = this._terminalManager.onStateUpdate((state) => {
      void this._sendMessage({
        command: 'stateUpdate',
        state,
      });
    });

    // Handle terminal focus
    const focusDisposable = this._terminalManager.onTerminalFocus((terminalId) => {
      void this._sendMessage({
        command: 'focusTerminal',
        terminalId,
      });
    });

    // Store disposables for cleanup
    this._terminalEventDisposables.push(
      dataDisposable,
      exitDisposable,
      createdDisposable,
      removedDisposable,
      stateUpdateDisposable,
      focusDisposable
    );

    log('✅ [EVENT-COORDINATOR] Terminal event listeners setup complete');
  }

  /**
   * Clear terminal event listeners
   */
  public clearTerminalEventListeners(): void {
    this._terminalEventDisposables.forEach((disposable) => {
      disposable.dispose();
    });
    this._terminalEventDisposables.length = 0;
    this._outputBuffers.clear();
    log('🧹 [EVENT-COORDINATOR] Terminal event listeners cleared');
  }

  public flushBufferedOutput(extensionTerminalId: string): void {
    const webviewTerminalId = this._resolveWebviewTerminalId(extensionTerminalId);
    const buffer = this._outputBuffers.get(webviewTerminalId);
    if (!buffer || buffer.length === 0) {
      return;
    }

    const combined = buffer.join('');
    this._outputBuffers.delete(webviewTerminalId);
    log(
      `📤 [EVENT-COORDINATOR] Flushing buffered output for ${webviewTerminalId}: ${combined.length} chars (${buffer.length} chunks)`
    );
    this._sendOutput(webviewTerminalId, combined);
  }

  private _bufferOutput(webviewTerminalId: string, chunk: string): void {
    const existing = this._outputBuffers.get(webviewTerminalId) ?? [];
    existing.push(chunk);
    this._outputBuffers.set(webviewTerminalId, existing);
    log(
      `⏸️ [EVENT-COORDINATOR] Buffering output for ${webviewTerminalId} (chunks=${existing.length}, length=${chunk.length})`
    );
  }

  private _sendOutput(webviewTerminalId: string, data: string): void {
    void this._sendMessage({
      command: TERMINAL_CONSTANTS.COMMANDS.OUTPUT,
      data,
      terminalId: webviewTerminalId,
    });
  }

  private _resolveWebviewTerminalId(extensionTerminalId: string): string {
    return this._terminalIdMapping?.get(extensionTerminalId) || extensionTerminalId;
  }

  /**
   * Set up CLI Agent status listeners
   */
  private setupCliAgentStatusListeners(): void {
    log('🎯 [EVENT-COORDINATOR] Setting up CLI Agent status listeners');

    const claudeStatusDisposable = this._terminalManager.onCliAgentStatusChange((event) => {
      try {
        log('📡 [EVENT-COORDINATOR] Received CLI Agent status change:', event);
        log('🔄 [EVENT-COORDINATOR] Triggering full CLI Agent state sync');
        this._sendFullCliAgentStateSync();
      } catch (error) {
        log('❌ [EVENT-COORDINATOR] CLI Agent status change processing failed:', error);
      }
    });

    this._disposables.push(claudeStatusDisposable);
    log('✅ [EVENT-COORDINATOR] CLI Agent status listeners setup complete');
  }

  // Debounce timer for config change events
  private _configChangeDebounceTimer: NodeJS.Timeout | null = null;
  private _lastSentTheme: string | null = null;
  // 🔧 FIX: Persistent flags to accumulate update intent across debounce window
  // This prevents stale closure values when multiple config events fire rapidly
  private _pendingSettingsUpdate = false;
  private _pendingFontSettingsUpdate = false;

  /**
   * Set up configuration change listeners
   *
   * 🔧 FIX: Uses persistent instance flags (_pendingSettingsUpdate, _pendingFontSettingsUpdate)
   * to accumulate update intent across debounce window. This ensures all config changes
   * within the 100ms debounce window are honored, avoiding stale closure values.
   */
  private setupConfigurationChangeListeners(): void {
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
      // Check for general settings changes - use OR to accumulate intent
      if (
        event.affectsConfiguration('editor.multiCursorModifier') ||
        event.affectsConfiguration('terminal.integrated.altClickMovesCursor') ||
        event.affectsConfiguration('secondaryTerminal.altClickMovesCursor') ||
        event.affectsConfiguration('secondaryTerminal.theme') ||
        event.affectsConfiguration('secondaryTerminal.cursorBlink')
      ) {
        this._pendingSettingsUpdate = true;
      }

      // Check for font settings changes - use OR to accumulate intent
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
        this._pendingFontSettingsUpdate = true;
      }

      // Send updated settings to WebView when configuration changes
      // Use debounce to prevent rapid-fire updates
      if (this._pendingSettingsUpdate || this._pendingFontSettingsUpdate) {
        // Clear any pending debounce timer
        if (this._configChangeDebounceTimer) {
          clearTimeout(this._configChangeDebounceTimer);
        }

        // Debounce: wait 100ms for config to settle before sending update
        this._configChangeDebounceTimer = setTimeout(() => {
          // Read and reset the flags atomically
          const shouldUpdateSettings = this._pendingSettingsUpdate;
          const shouldUpdateFontSettings = this._pendingFontSettingsUpdate;
          this._pendingSettingsUpdate = false;
          this._pendingFontSettingsUpdate = false;

          log(
            '⚙️ [EVENT-COORDINATOR] Configuration changed (settings:',
            shouldUpdateSettings,
            ', fonts:',
            shouldUpdateFontSettings,
            ')'
          );

          // Send updated settings to WebView
          if (shouldUpdateSettings) {
            const settings = this._getCurrentSettings();
            const currentTheme = settings.theme as string;

            // Only send if theme actually changed (prevents stale value spam)
            if (currentTheme !== this._lastSentTheme) {
              log(`📤 [EVENT-COORDINATOR] Sending settings (theme: ${currentTheme}, prev: ${this._lastSentTheme})`);
              this._lastSentTheme = currentTheme;
              this._sendMessage({
                command: 'settingsResponse',
                settings,
              }).catch((err) => log('❌ [EVENT-COORDINATOR] Failed to send settings update:', err));
              log('⚙️ [EVENT-COORDINATOR] Sent settings update to WebView');
            } else {
              log(`⏭️ [EVENT-COORDINATOR] Skipping duplicate theme update (${currentTheme})`);
            }
          }

          if (shouldUpdateFontSettings) {
            const fontSettings = this._getCurrentFontSettings();
            this._sendMessage({
              command: 'fontSettingsUpdate',
              fontSettings,
            }).catch((err) =>
              log('❌ [EVENT-COORDINATOR] Failed to send font settings update:', err)
            );
            log('⚙️ [EVENT-COORDINATOR] Sent font settings update to WebView');
          }
        }, 100); // 100ms debounce
      }
    });

    this._disposables.push(configChangeDisposable);
    log('✅ [EVENT-COORDINATOR] Configuration change listeners setup complete');
  }

  /**
   * Get terminal ID mapping
   */
  public getTerminalIdMapping(): Map<string, string> | undefined {
    return this._terminalIdMapping;
  }

  /**
   * Get current settings from VS Code configuration
   * Uses UnifiedConfigurationService for consistency with other settings sources
   */
  private _getCurrentSettings(): Record<string, unknown> {
    const configService = getUnifiedConfigurationService();
    const settings = configService.getCompleteTerminalSettings();
    const altClickSettings = configService.getAltClickSettings();

    return {
      cursorBlink: settings.cursorBlink,
      theme: settings.theme || 'auto',
      altClickMovesCursor: altClickSettings.altClickMovesCursor,
      multiCursorModifier: altClickSettings.multiCursorModifier,
      enableCliAgentIntegration: configService.isFeatureEnabled('cliAgentIntegration'),
      highlightActiveBorder: configService.get('sidebarTerminal', 'highlightActiveBorder', true),
      dynamicSplitDirection: configService.isFeatureEnabled('dynamicSplitDirection'),
      panelLocation: configService.get('sidebarTerminal', 'panelLocation', 'auto'),
    };
  }

  /**
   * Get current font settings from VS Code configuration
   * Uses UnifiedConfigurationService for consistency with other settings sources
   */
  private _getCurrentFontSettings(): WebViewFontSettings {
    const configService = getUnifiedConfigurationService();
    return configService.getWebViewFontSettings();
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // Clear config change debounce timer to prevent leak
    if (this._configChangeDebounceTimer) {
      clearTimeout(this._configChangeDebounceTimer);
      this._configChangeDebounceTimer = null;
    }

    this.clearTerminalEventListeners();
    this._disposables.forEach((d) => d.dispose());
    log('🧹 [EVENT-COORDINATOR] Disposed');
  }
}
