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

  constructor(
    private readonly _terminalManager: TerminalManager,
    private readonly _sendMessage: (message: WebviewMessage) => Promise<void>,
    private readonly _saveSession: () => Promise<void>,
    private readonly _sendFullCliAgentStateSync: () => void,
    private readonly _terminalIdMapping?: Map<string, string>
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
      if (event.data) {
        // Map Extension terminal ID to WebView terminal ID if mapping exists
        const webviewTerminalId =
          this._terminalIdMapping?.get(event.terminalId) || event.terminalId;

        log(
          '🔍 [EVENT-COORDINATOR] Terminal output received:',
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
          terminalId: webviewTerminalId,
        };

        log('📤 [EVENT-COORDINATOR] Sending OUTPUT to WebView terminal:', webviewTerminalId);
        void this._sendMessage(outputMessage);
      } else {
        log('⚠️ [EVENT-COORDINATOR] Empty data received from terminal:', event.terminalId);
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
      log('🆕 [EVENT-COORDINATOR] Terminal created:', terminal.id, terminal.name);

      const message: WebviewMessage = {
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED,
        terminalId: terminal.id,
        terminalName: terminal.name,
        terminalNumber: terminal.number,
        config: getTerminalConfig(),
      };

      void this._sendMessage(message);

      // Auto-save session after terminal creation
      setTimeout(async () => {
        try {
          await this._saveSession();
          log('💾 [EVENT-COORDINATOR] Auto-saved session after terminal creation');
        } catch (error) {
          log('❌ [EVENT-COORDINATOR] Failed to auto-save session:', error);
        }
      }, 500);
    });

    // Handle terminal removal
    const removedDisposable = this._terminalManager.onTerminalRemoved((terminalId) => {
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_REMOVED,
        terminalId,
      });

      // Auto-save session after terminal removal
      setTimeout(async () => {
        try {
          await this._saveSession();
          log('💾 [EVENT-COORDINATOR] Auto-saved session after terminal removal');
        } catch (error) {
          log('❌ [EVENT-COORDINATOR] Failed to auto-save session:', error);
        }
      }, 500);
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
    log('🧹 [EVENT-COORDINATOR] Terminal event listeners cleared');
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

  /**
   * Set up configuration change listeners
   */
  private setupConfigurationChangeListeners(): void {
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
      let shouldUpdateSettings = false;
      let shouldUpdateFontSettings = false;

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

      // Configuration updates are handled by specific message handlers
      // (settingsResponse and fontSettingsUpdate) in SecondaryTerminalProvider
      if (shouldUpdateSettings || shouldUpdateFontSettings) {
        log('⚙️ [EVENT-COORDINATOR] Configuration changed (settings:', shouldUpdateSettings, ', fonts:', shouldUpdateFontSettings, ')');
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
   * Clean up resources
   */
  public dispose(): void {
    this.clearTerminalEventListeners();
    this._disposables.forEach((d) => d.dispose());
    log('🧹 [EVENT-COORDINATOR] Disposed');
  }
}
