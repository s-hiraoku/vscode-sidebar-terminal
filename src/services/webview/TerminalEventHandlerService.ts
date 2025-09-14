import * as vscode from 'vscode';
import { ITerminalEventHandler, IMessageHandlerContext } from './interfaces';
import { provider as log } from '../../utils/logger';
import { getTerminalConfig, normalizeTerminalInfo } from '../../utils/common';
import { TERMINAL_CONSTANTS } from '../../constants';

/**
 * Manages terminal event handling for WebView
 *
 * This service extracts terminal event handling logic from SecondaryTerminalProvider
 * to provide focused, testable terminal event management.
 */
export class TerminalEventHandlerService implements ITerminalEventHandler {
  private _eventDisposables: vscode.Disposable[] = [];

  constructor() {
    log('🎧 [TerminalEvents] Terminal event handler service initialized');
  }

  /**
   * Set up all terminal event listeners
   */
  setupEventListeners(context: IMessageHandlerContext): vscode.Disposable[] {
    log('🎧 [TerminalEvents] Setting up terminal event listeners');

    // Clear existing listeners to prevent duplicates during panel moves
    this.clearEventListeners();

    try {
      // Terminal data output events
      const dataDisposable = this.setupDataEventListener(context);

      // Terminal exit events
      const exitDisposable = this.setupExitEventListener(context);

      // Terminal creation events
      const createdDisposable = this.setupTerminalCreatedEventListener(context);

      // Terminal removal events
      const removedDisposable = this.setupTerminalRemovedEventListener(context);

      // Terminal state update events
      const stateUpdateDisposable = this.setupStateUpdateEventListener(context);

      // Terminal focus events
      const focusDisposable = this.setupTerminalFocusEventListener(context);

      // Store all disposables
      this._eventDisposables.push(
        dataDisposable,
        exitDisposable,
        createdDisposable,
        removedDisposable,
        stateUpdateDisposable,
        focusDisposable
      );

      log(
        `✅ [TerminalEvents] Successfully set up ${this._eventDisposables.length} terminal event listeners`
      );
      return this._eventDisposables;
    } catch (error) {
      log('❌ [TerminalEvents] Error setting up terminal event listeners:', error);
      this.clearEventListeners();
      return [];
    }
  }

  /**
   * Clear all terminal event listeners
   */
  clearEventListeners(): void {
    try {
      for (const disposable of this._eventDisposables) {
        disposable.dispose();
      }
      this._eventDisposables = [];
      log('🧹 [TerminalEvents] All terminal event listeners cleared');
    } catch (error) {
      log('❌ [TerminalEvents] Error clearing event listeners:', error);
    }
  }

  /**
   * Set up terminal data output event listener
   */
  private setupDataEventListener(context: IMessageHandlerContext): vscode.Disposable {
    return context.terminalManager.onData((event) => {
      if (event.data) {
        // Map Extension terminal ID to WebView terminal ID if mapping exists
        const webviewTerminalId =
          context.terminalIdMapping?.get(event.terminalId) || event.terminalId;

        log(
          '📤 [TerminalEvents] Terminal output:',
          event.data.length,
          'chars, Extension ID:',
          event.terminalId,
          '→ WebView ID:',
          webviewTerminalId
        );

        const outputMessage = {
          command: TERMINAL_CONSTANTS.COMMANDS.OUTPUT,
          data: event.data,
          terminalId: webviewTerminalId, // Use mapped WebView terminal ID
        };

        // Send output to WebView
        context.sendMessage(outputMessage).catch((error) => {
          log('❌ [TerminalEvents] Failed to send terminal output:', error);
        });
      } else {
        log('⚠️ [TerminalEvents] Empty data received from terminal:', event.terminalId);
      }
    });
  }

  /**
   * Set up terminal exit event listener
   */
  private setupExitEventListener(context: IMessageHandlerContext): vscode.Disposable {
    return context.terminalManager.onExit((event) => {
      log(
        '🚪 [TerminalEvents] Terminal exit event:',
        event.terminalId,
        'exit code:',
        event.exitCode
      );

      const exitMessage = {
        command: TERMINAL_CONSTANTS.COMMANDS.EXIT,
        exitCode: event.exitCode,
        terminalId: event.terminalId,
      };

      context.sendMessage(exitMessage).catch((error) => {
        log('❌ [TerminalEvents] Failed to send terminal exit event:', error);
      });
    });
  }

  /**
   * Set up terminal created event listener
   */
  private setupTerminalCreatedEventListener(context: IMessageHandlerContext): vscode.Disposable {
    return context.terminalManager.onTerminalCreated((terminal) => {
      log('🆕 [TerminalEvents] Terminal created:', terminal.id, terminal.name);

      try {
        // Basic terminal creation message with number information
        const message = {
          command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED,
          terminalId: terminal.id,
          terminalName: terminal.name,
          terminalNumber: terminal.number, // Include terminal number
          config: getTerminalConfig(),
        };

        // Handle session restored terminals (if applicable)
        // Note: Currently disabled for debugging - can be re-enabled if needed
        /*
        if ((terminal as any).isSessionRestored) {
          log('🔄 [TerminalEvents] Terminal is session restored, sending session data');
          message.command = 'sessionRestore';
          message.sessionRestoreMessage = (terminal as any).sessionRestoreMessage;
          message.sessionScrollback = (terminal as any).sessionScrollback || [];
        }
        */

        context.sendMessage(message).catch((error) => {
          log('❌ [TerminalEvents] Failed to send terminal created event:', error);
        });
      } catch (error) {
        log('❌ [TerminalEvents] Error processing terminal created event:', error);
      }
    });
  }

  /**
   * Set up terminal removed event listener
   */
  private setupTerminalRemovedEventListener(context: IMessageHandlerContext): vscode.Disposable {
    return context.terminalManager.onTerminalRemoved((terminalId) => {
      log('🗑️ [TerminalEvents] Terminal removed:', terminalId);

      const removedMessage = {
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_REMOVED,
        terminalId,
      };

      context.sendMessage(removedMessage).catch((error) => {
        log('❌ [TerminalEvents] Failed to send terminal removed event:', error);
      });
    });
  }

  /**
   * Set up terminal state update event listener
   */
  private setupStateUpdateEventListener(context: IMessageHandlerContext): vscode.Disposable {
    return context.terminalManager.onStateUpdate((state) => {
      log('🔄 [TerminalEvents] Terminal state update received');

      try {
        const stateMessage = {
          command: 'stateUpdate' as const,
          state,
        };

        context.sendMessage(stateMessage).catch((error) => {
          log('❌ [TerminalEvents] Failed to send state update:', error);
        });
      } catch (error) {
        log('❌ [TerminalEvents] Error processing state update event:', error);
      }
    });
  }

  /**
   * Set up terminal focus event listener
   */
  private setupTerminalFocusEventListener(context: IMessageHandlerContext): vscode.Disposable {
    return context.terminalManager.onTerminalFocus((terminalId) => {
      log('🎯 [TerminalEvents] Terminal focus event:', terminalId);

      const focusMessage = {
        command: 'focusTerminal' as const,
        terminalId,
      };

      context.sendMessage(focusMessage).catch((error) => {
        log('❌ [TerminalEvents] Failed to send focus event:', error);
      });
    });
  }

  /**
   * Get event listener statistics for debugging
   */
  getEventListenerStats(): object {
    return {
      activeListeners: this._eventDisposables.length,
      listenerTypes: [
        'data',
        'exit',
        'terminalCreated',
        'terminalRemoved',
        'stateUpdate',
        'terminalFocus',
      ],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get debug information about terminal events
   */
  getDebugInfo(context: IMessageHandlerContext): object {
    try {
      return {
        eventListenerStats: this.getEventListenerStats(),
        terminalManager: {
          terminalCount: context.terminalManager.getTerminals().length,
          activeTerminalId: context.terminalManager.getActiveTerminalId(),
          terminals: context.terminalManager.getTerminals().map(normalizeTerminalInfo),
        },
        terminalIdMapping: context.terminalIdMapping
          ? Array.from(context.terminalIdMapping.entries())
          : [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      log('❌ [TerminalEvents] Error getting debug info:', error);
      return {
        error: String(error),
        eventListenerStats: this.getEventListenerStats(),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    log('🧹 [TerminalEvents] Disposing terminal event handler service');
    this.clearEventListeners();
  }
}
