import * as vscode from 'vscode';
import { WebviewMessage } from '../types/common';
import { getTerminalConfig } from '../utils/common';
import { TERMINAL_CONSTANTS } from '../constants';
import { provider as log } from '../utils/logger';
import { 
  ITerminalManagerForEvents,
  ITerminalEventData,
  ITerminalInstanceForEvents,
  ITerminalStateForEvents
} from '../types/type-guards';

/**
 * Terminal Event Handler Service
 * 
 * Extracted from SecondaryTerminalProvider to handle:
 * - Terminal data output events
 * - Terminal creation and removal events
 * - Terminal state change events
 * - Terminal focus events
 * - Event listener lifecycle management
 */

export interface ITerminalEventHandlerService {
  setupTerminalEventListeners(): void;
  clearTerminalEventListeners(): void;
  validateEventHandlerHealth(): { isHealthy: boolean; issues: string[] };
  dispose(): void;
}

export class TerminalEventHandlerService implements ITerminalEventHandlerService {
  private terminalEventDisposables: vscode.Disposable[] = [];
  private terminalIdMapping?: Map<string, string>;

  constructor(
    private terminalManager: ITerminalManagerForEvents,
    private sendMessage: (message: WebviewMessage) => Promise<void>,
    private extensionContext: vscode.ExtensionContext
  ) {}

  public setupTerminalEventListeners(): void {
    // Clear existing listeners to prevent duplicates during panel moves
    this.clearTerminalEventListeners();

    log('🔧 [EVENT-HANDLER] Setting up terminal event listeners...');

    try {
      this.setupDataEventListener();
      this.setupExitEventListener();
      this.setupCreatedEventListener();
      this.setupRemovedEventListener();
      this.setupStateUpdateEventListener();
      this.setupFocusEventListener();

      log('✅ [EVENT-HANDLER] All terminal event listeners setup complete');
    } catch (error) {
      log('❌ [EVENT-HANDLER] Failed to setup terminal event listeners:', error);
      throw error;
    }
  }

  public clearTerminalEventListeners(): void {
    log('🧹 [EVENT-HANDLER] Clearing terminal event listeners...');
    
    this.terminalEventDisposables.forEach((disposable) => {
      disposable.dispose();
    });
    this.terminalEventDisposables = [];
    
    log('✅ [EVENT-HANDLER] Terminal event listeners cleared');
  }

  private setupDataEventListener(): void {
    // Handle terminal output
    const dataDisposable = this.terminalManager.onData((event: ITerminalEventData) => {
      if (event.data !== undefined) {
        this.handleTerminalDataEvent({ terminalId: event.terminalId, data: event.data });
      }
    });

    this.terminalEventDisposables.push(dataDisposable);
    log('✅ [EVENT-HANDLER] Data event listener setup complete');
  }

  private setupExitEventListener(): void {
    // Handle terminal exit
    const exitDisposable = this.terminalManager.onExit((event: ITerminalEventData) => {
      if (event.exitCode !== undefined) {
        this.handleTerminalExitEvent({ terminalId: event.terminalId, exitCode: event.exitCode });
      }
    });

    this.terminalEventDisposables.push(exitDisposable);
    log('✅ [EVENT-HANDLER] Exit event listener setup complete');
  }

  private setupCreatedEventListener(): void {
    // Handle terminal creation
    const createdDisposable = this.terminalManager.onTerminalCreated((terminal: ITerminalInstanceForEvents) => {
      this.handleTerminalCreatedEvent(terminal);
    });

    this.terminalEventDisposables.push(createdDisposable);
    log('✅ [EVENT-HANDLER] Created event listener setup complete');
  }

  private setupRemovedEventListener(): void {
    // Handle terminal removal
    const removedDisposable = this.terminalManager.onTerminalRemoved((terminalId: string) => {
      this.handleTerminalRemovedEvent(terminalId);
    });

    this.terminalEventDisposables.push(removedDisposable);
    log('✅ [EVENT-HANDLER] Removed event listener setup complete');
  }

  private setupStateUpdateEventListener(): void {
    // Handle terminal state updates
    const stateUpdateDisposable = this.terminalManager.onStateUpdate((state: ITerminalStateForEvents) => {
      this.handleTerminalStateUpdateEvent(state);
    });

    this.terminalEventDisposables.push(stateUpdateDisposable);
    log('✅ [EVENT-HANDLER] State update event listener setup complete');
  }

  private setupFocusEventListener(): void {
    // Handle terminal focus events
    const focusDisposable = this.terminalManager.onTerminalFocus((terminal: ITerminalInstanceForEvents) => {
      this.handleTerminalFocusEvent(terminal.id);
    });

    this.terminalEventDisposables.push(focusDisposable);
    log('✅ [EVENT-HANDLER] Focus event listener setup complete');
  }

  private handleTerminalDataEvent(event: { terminalId: string; data: string }): void {
    if (!event.data) {
      log('⚠️ [EVENT-HANDLER] Empty data received from terminal:', event.terminalId);
      return;
    }

    try {
      // Map Extension terminal ID to WebView terminal ID if mapping exists
      const webviewTerminalId = this.terminalIdMapping?.get(event.terminalId) || event.terminalId;
      
      log(
        '🔍 [EVENT-HANDLER] Terminal output received:',
        event.data.length,
        'chars, Extension ID:',
        event.terminalId,
        '→ WebView ID:',
        webviewTerminalId,
        'data preview:',
        JSON.stringify(event.data.substring(0, 50))
      );

      const outputMessage: WebviewMessage = {
        command: TERMINAL_CONSTANTS.COMMANDS.OUTPUT,
        data: event.data,
        terminalId: webviewTerminalId, // Use mapped WebView terminal ID
      };

      log('📤 [EVENT-HANDLER] Sending OUTPUT to WebView terminal:', webviewTerminalId);
      void this.sendMessage(outputMessage);
    } catch (error) {
      log('❌ [EVENT-HANDLER] Error handling terminal data event:', error);
    }
  }

  private handleTerminalExitEvent(event: { terminalId: string; exitCode: number }): void {
    try {
      log('💀 [EVENT-HANDLER] Terminal exit event:', event.terminalId, 'exit code:', event.exitCode);

      void this.sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.EXIT,
        exitCode: event.exitCode,
        terminalId: event.terminalId,
      });
    } catch (error) {
      log('❌ [EVENT-HANDLER] Error handling terminal exit event:', error);
    }
  }

  private handleTerminalCreatedEvent(terminal: ITerminalInstanceForEvents): void {
    try {
      log('🆕 [EVENT-HANDLER] Terminal created:', terminal.id, terminal.name);

      // Build terminal creation message with terminal number information
      const message: WebviewMessage = {
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED,
        terminalId: terminal.id,
        terminalName: terminal.name,
        terminalNumber: terminal.number, // Include terminal number
        config: getTerminalConfig(),
      };

      // Handle session restored terminals - Currently disabled for debugging
      // if ((terminal as any).isSessionRestored) {
      //   log('🔄 [EVENT-HANDLER] Terminal is session restored, sending session data');
      //   message.command = 'sessionRestore';
      //   message.sessionRestoreMessage = (terminal as any).sessionRestoreMessage;
      //   message.sessionScrollback = (terminal as any).sessionScrollback || [];
      // }

      void this.sendMessage(message);
      log('✅ [EVENT-HANDLER] Terminal created message sent:', terminal.id);
    } catch (error) {
      log('❌ [EVENT-HANDLER] Error handling terminal created event:', error);
    }
  }

  private handleTerminalRemovedEvent(terminalId: string): void {
    try {
      log('🗑️ [EVENT-HANDLER] Terminal removed:', terminalId);

      void this.sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_REMOVED,
        terminalId,
      });

      // Clean up terminal ID mapping if it exists
      if (this.terminalIdMapping?.has(terminalId)) {
        this.terminalIdMapping.delete(terminalId);
        log('🔗 [EVENT-HANDLER] Cleaned up terminal ID mapping for:', terminalId);
      }

      log('✅ [EVENT-HANDLER] Terminal removed message sent:', terminalId);
    } catch (error) {
      log('❌ [EVENT-HANDLER] Error handling terminal removed event:', error);
    }
  }

  private handleTerminalStateUpdateEvent(state: ITerminalStateForEvents): void {
    try {
      log('🔄 [EVENT-HANDLER] Terminal state update:', Object.keys(state || {}));

      void this.sendMessage({
        command: 'stateUpdate',
        state: state as any, // Cast for compatibility with WebviewMessage
      });

      log('✅ [EVENT-HANDLER] State update message sent');
    } catch (error) {
      log('❌ [EVENT-HANDLER] Error handling terminal state update event:', error);
    }
  }

  private handleTerminalFocusEvent(terminalId: string): void {
    try {
      log('🎯 [EVENT-HANDLER] Terminal focus:', terminalId);

      void this.sendMessage({
        command: 'focusTerminal',
        terminalId,
      });

      log('✅ [EVENT-HANDLER] Focus message sent:', terminalId);
    } catch (error) {
      log('❌ [EVENT-HANDLER] Error handling terminal focus event:', error);
    }
  }

  /**
   * Set terminal ID mapping for VS Code pattern compliance
   */
  public setTerminalIdMapping(mapping: Map<string, string>): void {
    this.terminalIdMapping = mapping;
    log('🔗 [EVENT-HANDLER] Terminal ID mapping updated');
  }

  /**
   * Add a terminal ID mapping
   */
  public addTerminalIdMapping(extensionId: string, webViewId: string): void {
    this.terminalIdMapping = this.terminalIdMapping || new Map();
    this.terminalIdMapping.set(extensionId, webViewId);
    log(`🔗 [EVENT-HANDLER] Added terminal ID mapping: ${extensionId} → ${webViewId}`);
  }

  /**
   * Remove a terminal ID mapping
   */
  public removeTerminalIdMapping(extensionId: string): boolean {
    if (this.terminalIdMapping?.has(extensionId)) {
      const webViewId = this.terminalIdMapping.get(extensionId);
      this.terminalIdMapping.delete(extensionId);
      log(`🔗 [EVENT-HANDLER] Removed terminal ID mapping: ${extensionId} → ${webViewId}`);
      return true;
    }
    return false;
  }

  /**
   * Get current terminal ID mappings
   */
  public getTerminalIdMappings(): Map<string, string> | undefined {
    return this.terminalIdMapping;
  }

  /**
   * Handle custom terminal events (for future extensibility)
   */
  public handleCustomEvent(eventType: string, eventData: unknown): void {
    try {
      log(`🔥 [EVENT-HANDLER] Custom event received: ${eventType}`, eventData);

      // Send custom event to WebView
      void this.sendMessage({
        command: 'customEvent',
        eventType,
        eventData,
        timestamp: Date.now(),
      });

      log(`✅ [EVENT-HANDLER] Custom event forwarded to WebView: ${eventType}`);
    } catch (error) {
      log(`❌ [EVENT-HANDLER] Error handling custom event ${eventType}:`, error);
    }
  }

  /**
   * Get event listener statistics
   */
  public getEventListenerStats(): {
    activeListeners: number;
    terminalMappings: number;
  } {
    return {
      activeListeners: this.terminalEventDisposables.length,
      terminalMappings: this.terminalIdMapping?.size || 0,
    };
  }

  /**
   * Validate event handler health
   */
  public validateEventHandlerHealth(): {
    isHealthy: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (this.terminalEventDisposables.length === 0) {
      issues.push('No terminal event listeners are active');
    }

    if (this.terminalEventDisposables.length < 6) {
      issues.push(`Expected 6 event listeners, but only ${this.terminalEventDisposables.length} are active`);
    }

    return {
      isHealthy: issues.length === 0,
      issues,
    };
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    log('🔧 [EVENT-HANDLER] Disposing terminal event handler service...');
    
    // Clear all event listeners
    this.clearTerminalEventListeners();
    
    // Clean up terminal ID mapping
    this.terminalIdMapping?.clear();
    this.terminalIdMapping = undefined;
    
    log('✅ [EVENT-HANDLER] Terminal event handler service disposed');
  }
}