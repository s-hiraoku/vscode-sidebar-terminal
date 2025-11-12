import * as vscode from 'vscode';
import { WebviewMessage } from '../types/common';
import { provider as log } from '../utils/logger';
import { TerminalErrorHandler } from '../utils/feedback';
import { getTerminalConfig, normalizeTerminalInfo } from '../utils/common';
import { TERMINAL_CONSTANTS } from '../constants';

/**
 * WebView State Manager Service
 *
 * Extracted from SecondaryTerminalProvider to handle:
 * - WebView initialization state
 * - Terminal state synchronization
 * - Session restoration management
 * - WebView visibility and lifecycle
 */

export interface IWebViewStateManager {
  isInitialized(): boolean;
  initializeWebView(): Promise<void>;
  ensureMinimumTerminals(): Promise<void>;
  handleVisibilityChange(visible: boolean): Promise<void>;
  getInitializationMessage(): Promise<WebviewMessage>;
  requestPanelLocationDetection(): void;
  dispose(): void;
}

export class WebViewStateManager implements IWebViewStateManager {
  private _isInitialized = false;
  private _terminalIdMapping?: Map<string, string>;

  constructor(
    private readonly terminalManager: any, // TODO: Replace with proper interface
    private readonly standardSessionManager?: any, // TODO: Replace with proper interface
    private readonly sendMessage?: (message: WebviewMessage) => Promise<void>
  ) {}

  public isInitialized(): boolean {
    return this._isInitialized;
  }

  public async initializeWebView(): Promise<void> {
    if (this._isInitialized) {
      log('🔄 [STATE-MANAGER] WebView already initialized, skipping duplicate initialization');
      return;
    }

    log('🎯 [STATE-MANAGER] WebView ready - initializing terminal immediately');
    this._isInitialized = true;

    try {
      await this._initializeTerminal();
      log('✅ [STATE-MANAGER] Terminal initialization completed immediately');

      // Ensure terminals exist after a short delay
      setTimeout(() => {
        if (this.terminalManager.getTerminals().length === 0) {
          log('🎯 [STATE-MANAGER] No terminals exist - creating minimum set');
          void this.ensureMinimumTerminals();
        } else {
          log('🎯 [STATE-MANAGER] Terminals already exist - skipping creation');
        }
      }, 100);
    } catch (error) {
      log('❌ [STATE-MANAGER] Terminal initialization failed:', error);
      TerminalErrorHandler.handleTerminalCreationError(error);
      // Reset flag on error to allow retry
      this._isInitialized = false;
      throw error;
    }
  }

  public async ensureMinimumTerminals(): Promise<void> {
    try {
      const currentTerminals = this.terminalManager.getTerminals().length;
      log(`🔍 [STATE-MANAGER] Current terminal count: ${currentTerminals}`);

      if (currentTerminals < 1) {
        log('🎯 [STATE-MANAGER] Creating minimum terminal (1)');

        // Create at least one terminal
        const terminalId = this.terminalManager.createTerminal();
        log(`✅ [STATE-MANAGER] Created terminal: ${terminalId}`);

        // Set terminal as active
        this.terminalManager.setActiveTerminal(terminalId);
        log(`🎯 [STATE-MANAGER] Set terminal as active: ${terminalId}`);

        // Send state update to WebView
        if (this.sendMessage) {
          await this.sendMessage({
            command: 'stateUpdate',
            state: this.terminalManager.getCurrentState(),
          });
        }
      } else {
        log(`✅ [STATE-MANAGER] Sufficient terminals already exist: ${currentTerminals}`);
      }
    } catch (error) {
      log(`❌ [STATE-MANAGER] Failed to ensure terminals: ${String(error)}`);
      throw error;
    }
  }

  public async handleVisibilityChange(visible: boolean): Promise<void> {
    if (visible) {
      log('👁️ [STATE-MANAGER] WebView became visible');

      // Trigger panel location detection when WebView becomes visible
      setTimeout(() => {
        this.requestPanelLocationDetection();
      }, 500);
    } else {
      log('👁️ [STATE-MANAGER] WebView became hidden');
    }
  }

  public async getInitializationMessage(): Promise<WebviewMessage> {
    const config = getTerminalConfig();
    const terminals = this.terminalManager.getTerminals().map(normalizeTerminalInfo);
    const activeTerminalId = this.terminalManager.getActiveTerminalId();

    return {
      command: TERMINAL_CONSTANTS.COMMANDS.INIT,
      config,
      terminals,
      activeTerminalId,
    };
  }

  public requestPanelLocationDetection(): void {
    try {
      log('📍 [STATE-MANAGER] Requesting panel location detection from WebView');

      if (!this.sendMessage) {
        log('⚠️ [STATE-MANAGER] No sendMessage function available');
        return;
      }

      // Send a message to WebView to analyze its dimensions and report back
      void this.sendMessage({
        command: 'requestPanelLocationDetection',
      });
    } catch (error) {
      log('⚠️ [STATE-MANAGER] Error requesting panel location detection:', error);

      // Fallback to sidebar assumption
      if (this.sendMessage) {
        void this.sendMessage({
          command: 'panelLocationUpdate',
          location: 'sidebar',
        });
      }

      // Set fallback context key
      void vscode.commands.executeCommand(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );
    }
  }

  public getTerminalIdMapping(): Map<string, string> | undefined {
    return this._terminalIdMapping;
  }

  public setTerminalIdMapping(extensionId: string, webViewId: string): void {
    this._terminalIdMapping = this._terminalIdMapping || new Map();
    this._terminalIdMapping.set(extensionId, webViewId);
    log(`🔗 [STATE-MANAGER] Mapped Extension ID ${extensionId} → WebView ID ${webViewId}`);
  }

  private async _initializeTerminal(): Promise<void> {
    log('🔧 [STATE-MANAGER] Initializing terminal');

    try {
      const config = getTerminalConfig();
      const existingTerminals = this.terminalManager.getTerminals();

      log('🔧 [STATE-MANAGER] Current terminals:', existingTerminals.length);
      existingTerminals.forEach((terminal: any) => {
        log(`🔧 [STATE-MANAGER] - Terminal: ${terminal.name} (${terminal.id})`);
      });

      let terminalId: string | undefined;

      if (existingTerminals.length > 0) {
        // Terminals exist - use active one or first one
        const activeId = this.terminalManager.getActiveTerminalId();
        terminalId = activeId || existingTerminals[0]?.id;
        log('🔧 [STATE-MANAGER] Using existing terminal:', terminalId);

        // For existing terminals, send terminalCreated messages
        // to ensure WebView recreates them (panel move scenario)
        for (const terminal of existingTerminals) {
          log('📤 [STATE-MANAGER] Sending terminalCreated for existing terminal:', terminal.id);

          if (this.sendMessage) {
            await this.sendMessage({
              command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED,
              terminalId: terminal.id,
              terminalName: terminal.name,
              config: config,
            });
          }
        }
      } else {
        log(
          '📝 [STATE-MANAGER] No existing terminals - will handle via session restore or user action'
        );
        terminalId = undefined;
      }

      // Send INIT message with all terminal info
      const initMessage = await this.getInitializationMessage();

      if (this.sendMessage) {
        await this.sendMessage(initMessage);
      }

      // Send font settings
      if (this.sendMessage) {
        await this.sendMessage({
          command: 'fontSettingsUpdate',
          fontSettings: this.getCurrentFontSettings(),
        });
      }

      // Handle session restore if needed
      await this._handleSessionRestore(existingTerminals.length === 0);

      log('✅ [STATE-MANAGER] Terminal initialization completed');
    } catch (error) {
      log('❌ [STATE-MANAGER] Failed to initialize terminal:', error);
      TerminalErrorHandler.handleTerminalCreationError(error);
      throw error;
    }
  }

  private async _handleSessionRestore(noExistingTerminals: boolean): Promise<void> {
    if (!this.standardSessionManager || !noExistingTerminals) {
      return;
    }

    log('🔄 [STATE-MANAGER] Checking for session data to restore...');

    try {
      // Check if session data exists without blocking
      const sessionInfo = this.standardSessionManager.getSessionInfo();

      if (
        sessionInfo?.exists &&
        sessionInfo.terminals &&
        sessionInfo.terminals.length > 0
      ) {
        log(
          `🔄 [STATE-MANAGER] Found session data with ${sessionInfo.terminals.length} terminals, initiating restore...`
        );

        // VS Code standard: Immediate but async restore
        setImmediate(() => {
          void this._performAsyncSessionRestore();
        });
      } else {
        log('📭 [STATE-MANAGER] No session data found, will create initial terminal on first view');
        this._scheduleInitialTerminalCreation();
      }
    } catch (error) {
      log('❌ [STATE-MANAGER] Error checking session data:', error);
      this._scheduleInitialTerminalCreation();
    }
  }

  private async _performAsyncSessionRestore(): Promise<void> {
    try {
      if (!this.standardSessionManager) {
        log('⚠️ [STATE-MANAGER] StandardSessionManager not available');
        return;
      }

      log('🔄 [STATE-MANAGER] Starting VS Code standard session restore...');

      // Direct session restore - VS Code handles this immediately
      const result = await this.standardSessionManager.restoreSession(true);

      if (result.success && result.restoredCount && result.restoredCount > 0) {
        log(`✅ [STATE-MANAGER] Successfully restored ${result.restoredCount} terminals`);

        // VS Code standard: Show success notification
        void vscode.window.showInformationMessage(
          `🔄 Terminal session restored: ${result.restoredCount} terminal${result.restoredCount > 1 ? 's' : ''}`
        );
      } else {
        log('📭 [STATE-MANAGER] No session data found or restored');
        // If restore failed, create initial terminal
        this._scheduleInitialTerminalCreation();
      }
    } catch (error) {
      log(`❌ [STATE-MANAGER] Session restore failed: ${String(error)}`);
      // On restore failure, create initial terminal
      this._scheduleInitialTerminalCreation();
    }
  }

  private _scheduleInitialTerminalCreation(): void {
    log('🚀 [STATE-MANAGER] Scheduling initial terminal creation');

    // Schedule creation for when user actually views the terminal
    // This mimics VS Code's behavior of creating terminals on-demand
    setTimeout(() => {
      log('⏰ [STATE-MANAGER] Executing initial terminal creation');
      const currentTerminalCount = this.terminalManager.getTerminals().length;
      log(`📊 [STATE-MANAGER] Current terminal count: ${currentTerminalCount}`);

      if (currentTerminalCount === 0) {
        log('🎆 [STATE-MANAGER] Creating initial terminals (no session data)');
        void this.ensureMinimumTerminals();
      } else {
        log(
          `🔍 [STATE-MANAGER] Terminals already exist (${currentTerminalCount}), skipping initial creation`
        );
      }
    }, 100); // Very short delay to ensure WebView is ready
  }

  // TODO: Move this to SettingsManager when created
  private getCurrentFontSettings(): any {
    // Placeholder - this should be moved to SettingsManager
    return {
      fontSize: 14,
      fontFamily: 'monospace',
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      lineHeight: 1.2,
      letterSpacing: 0,
    };
  }

  public dispose(): void {
    log('🔧 [STATE-MANAGER] Disposing WebView state manager...');

    // Reset state
    this._isInitialized = false;
    this._terminalIdMapping?.clear();
    this._terminalIdMapping = undefined;

    log('✅ [STATE-MANAGER] WebView state manager disposed');
  }
}
