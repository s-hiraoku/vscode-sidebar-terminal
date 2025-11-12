/**
 * Extension Message Handlers
 *
 * Collection of all Extension-side message handlers.
 */

import * as vscode from 'vscode';
import { WebviewMessage } from '../../types/common';
import {
  BaseExtensionMessageHandler,
  IExtensionMessageHandlerContext,
  ExtensionMessagePriority,
} from '../ExtensionMessageDispatcher';
import { TERMINAL_CONSTANTS } from '../../constants';
import { getUnifiedConfigurationService } from '../../config/UnifiedConfigurationService';

export { ExtensionTerminalInputHandler } from './ExtensionTerminalInputHandler';
export { ExtensionTerminalResizeHandler } from './ExtensionTerminalResizeHandler';
export { ExtensionTerminalCreationHandler } from './ExtensionTerminalCreationHandler';

/**
 * Extension Terminal Deletion Handler
 */
export class ExtensionTerminalDeletionHandler extends BaseExtensionMessageHandler {
  constructor() {
    super(['killTerminal', 'deleteTerminal', 'terminalClosed'], ExtensionMessagePriority.HIGH);
  }

  async handle(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    switch (message.command) {
      case 'killTerminal':
        await this.handleKillTerminal(message, context);
        break;
      case 'deleteTerminal':
        await this.handleDeleteTerminal(message, context);
        break;
      case 'terminalClosed':
        await this.handleTerminalClosed(message, context);
        break;
    }
  }

  private async handleKillTerminal(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    const terminalId = message.terminalId as string;

    this.log(`Kill terminal request: ${terminalId || 'active terminal'}`);

    if (terminalId) {
      await this.deleteSpecificTerminal(terminalId, 'panel', context);
    } else {
      const activeTerminalId = context.terminalManager.getActiveTerminalId();
      if (activeTerminalId) {
        await this.deleteSpecificTerminal(activeTerminalId, 'panel', context);
      }
    }
  }

  private async handleDeleteTerminal(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    const terminalId = message.terminalId as string;
    const requestSource = ((message as any).requestSource as 'header' | 'panel') || 'panel';

    if (!terminalId) {
      this.log('No terminal ID provided for delete');
      return;
    }

    this.log(`Delete terminal request: ${terminalId} (source: ${requestSource})`);
    await this.deleteSpecificTerminal(terminalId, requestSource, context);
  }

  private async handleTerminalClosed(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    const terminalId = message.terminalId as string;

    if (!terminalId) {
      return;
    }

    this.log(`Terminal closed from webview: ${terminalId}`);

    const terminals = context.terminalManager.getTerminals();
    const terminalExists = terminals.some((t: { id: string }) => t.id === terminalId);

    if (terminalExists) {
      this.log(`Removing terminal from extension side: ${terminalId}`);
      context.terminalManager.removeTerminal(terminalId);
    } else {
      this.log(`Terminal already removed from extension side: ${terminalId}`);
    }
  }

  private async deleteSpecificTerminal(
    terminalId: string,
    source: 'header' | 'panel',
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    try {
      const result = await context.terminalManager.deleteTerminal(terminalId, { source });

      await context.sendMessage({
        command: 'deleteTerminalResponse',
        terminalId,
        success: result.success,
        reason: result.reason,
      });

      if (result.success) {
        this.log(`Terminal deletion succeeded: ${terminalId}`);
      } else {
        this.log(`Terminal deletion failed: ${terminalId}, reason: ${result.reason}`);
      }
    } catch (error) {
      this.logError(`Error deleting terminal ${terminalId}`, error);

      await context.sendMessage({
        command: 'deleteTerminalResponse',
        terminalId,
        success: false,
        reason: `Delete failed: ${String(error)}`,
      });
    }
  }
}

/**
 * Extension WebView Ready Handler
 */
export class ExtensionWebViewReadyHandler extends BaseExtensionMessageHandler {
  constructor() {
    super(['webviewReady', TERMINAL_CONSTANTS.COMMANDS.READY], ExtensionMessagePriority.CRITICAL);
  }

  async handle(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    this.log('WebView ready - initialization started');

    // WebView is ready, Extension can now send initialization data
    // This is handled by the Provider's initialization logic
  }
}

/**
 * Extension Focus Terminal Handler
 */
export class ExtensionFocusTerminalHandler extends BaseExtensionMessageHandler {
  constructor() {
    super(
      ['focusTerminal', TERMINAL_CONSTANTS.COMMANDS.FOCUS_TERMINAL],
      ExtensionMessagePriority.NORMAL
    );
  }

  async handle(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    const terminalId = message.terminalId as string;

    if (!terminalId) {
      this.log('No terminal ID provided for focus');
      return;
    }

    this.log(`Setting active terminal: ${terminalId}`);
    context.terminalManager.setActiveTerminal(terminalId);
  }
}

/**
 * Extension Settings Handler
 */
export class ExtensionSettingsHandler extends BaseExtensionMessageHandler {
  constructor() {
    super(['getSettings', 'updateSettings'], ExtensionMessagePriority.NORMAL);
  }

  async handle(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    switch (message.command) {
      case 'getSettings':
        await this.handleGetSettings(context);
        break;
      case 'updateSettings':
        await this.handleUpdateSettings(message, context);
        break;
    }
  }

  private async handleGetSettings(context: IExtensionMessageHandlerContext): Promise<void> {
    this.log('Getting settings from webview');

    const configService = getUnifiedConfigurationService();
    const settings = configService.getAllSettings();
    const fontSettings = configService.getFontSettings();

    await context.sendMessage({
      command: 'settingsResponse',
      settings,
    });

    await context.sendMessage({
      command: 'fontSettingsUpdate',
      fontSettings,
    });

    const panelLocation = context.getView()?.viewColumn;
    await context.sendMessage({
      command: 'panelLocationUpdate',
      location: panelLocation || 'sidebar',
    });
  }

  private async handleUpdateSettings(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    const settings = (message as any).settings;

    if (!settings) {
      this.log('No settings provided in updateSettings message');
      return;
    }

    this.log('Updating settings from webview:', settings);

    const configService = getUnifiedConfigurationService();
    await configService.updateSettings(settings);
  }
}

/**
 * Extension Panel Location Handler
 */
export class ExtensionPanelLocationHandler extends BaseExtensionMessageHandler {
  constructor() {
    super(['reportPanelLocation'], ExtensionMessagePriority.LOW);
  }

  async handle(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    const location = (message as any).location;

    if (!location) {
      return;
    }

    this.log('Panel location reported from WebView:', location);

    // Update context key for VS Code when clause
    await vscode.commands.executeCommand(
      'setContext',
      'secondaryTerminal.panelLocation',
      location
    );

    // Echo back to WebView
    await context.sendMessage({
      command: 'panelLocationUpdate',
      location,
    });
  }
}

/**
 * Extension AI Agent Handler
 */
export class ExtensionAIAgentHandler extends BaseExtensionMessageHandler {
  constructor() {
    super(['switchAiAgent'], ExtensionMessagePriority.NORMAL);
  }

  async handle(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    const terminalId = message.terminalId as string;
    const action = (message as any).action as string;
    const forceReconnect = (message as any).forceReconnect as boolean;
    const agentType = (message as any).agentType as 'claude' | 'gemini' | 'codex';

    if (!terminalId) {
      this.log('switchAiAgent: terminalId missing');
      return;
    }

    this.log(
      `Switching AI Agent for terminal: ${terminalId} (action: ${action}, forceReconnect: ${forceReconnect})`
    );

    try {
      let result: any;

      if (forceReconnect) {
        this.log(`Force reconnecting AI Agent for terminal: ${terminalId}`);
        const success = context.terminalManager.forceReconnectAiAgent(
          terminalId,
          agentType || 'claude'
        );

        result = {
          success,
          newStatus: success ? 'connected' : 'none',
          agentType: success ? agentType : null,
          reason: success ? 'Force reconnected successfully' : 'Force reconnect failed',
        };
      } else {
        result = context.terminalManager.switchAiAgentConnection(terminalId);
      }

      await context.sendMessage({
        command: 'switchAiAgentResponse',
        terminalId,
        success: result.success,
        newStatus: result.newStatus,
        agentType: result.agentType,
        forceReconnect,
        reason: result.reason,
      });

      if (result.success) {
        this.log(`AI Agent operation succeeded: ${terminalId}, new status: ${result.newStatus}`);
      } else {
        this.log(`AI Agent operation failed: ${terminalId}, reason: ${result.reason}`);
      }
    } catch (error) {
      this.logError('Error with AI Agent operation', error);

      await context.sendMessage({
        command: 'switchAiAgentResponse',
        terminalId,
        success: false,
        reason: 'Internal error occurred',
        forceReconnect,
      });
    }
  }
}

/**
 * Extension Serialization Handler
 */
export class ExtensionSerializationHandler extends BaseExtensionMessageHandler {
  constructor() {
    super(
      ['terminalSerializationResponse', 'terminalSerializationRestoreResponse'],
      ExtensionMessagePriority.HIGH
    );
  }

  async handle(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    switch (message.command) {
      case 'terminalSerializationResponse':
        await this.handleSerializationResponse(message, context);
        break;
      case 'terminalSerializationRestoreResponse':
        await this.handleRestoreResponse(message, context);
        break;
    }
  }

  private async handleSerializationResponse(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    this.log('Terminal serialization response received');

    const serializationData = (message as any).serializationData || {};
    const error = (message as any).error;

    if (error) {
      this.logError('Serialization error', error);
    } else {
      this.log(`Received serialization data for ${Object.keys(serializationData).length} terminals`);

      // Forward to StandardTerminalSessionManager
      const sessionManager = context.getStandardSessionManager?.();
      if (sessionManager) {
        sessionManager.handleSerializationResponse(serializationData);
      }
    }
  }

  private async handleRestoreResponse(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    this.log('Terminal serialization restore response received');

    const restoredCount = (message as any).restoredCount || 0;
    const totalCount = (message as any).totalCount || 0;
    const error = (message as any).error;

    if (error) {
      this.logError('Restore error', error);
    } else {
      this.log(`Restored ${restoredCount}/${totalCount} terminals`);
    }
  }
}

/**
 * Extension Persistence Handler
 */
export class ExtensionPersistenceHandler extends BaseExtensionMessageHandler {
  constructor() {
    super(
      ['persistenceSaveSession', 'persistenceRestoreSession', 'persistenceClearSession'],
      ExtensionMessagePriority.NORMAL
    );
  }

  async handle(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    const persistenceService = context.getPersistenceService?.();
    if (!persistenceService) {
      this.log('Persistence service not available');
      return;
    }

    switch (message.command) {
      case 'persistenceSaveSession':
        await this.handleSave(message, persistenceService);
        break;
      case 'persistenceRestoreSession':
        await this.handleRestore(persistenceService, context);
        break;
      case 'persistenceClearSession':
        await this.handleClear(persistenceService);
        break;
    }
  }

  private async handleSave(message: WebviewMessage, persistenceService: any): Promise<void> {
    const terminalData = (message as any).terminalData;
    await persistenceService.handlePersistenceMessage({ command: 'saveSession', data: terminalData });
    this.log('Session saved');
  }

  private async handleRestore(persistenceService: any, context: IExtensionMessageHandlerContext): Promise<void> {
    await persistenceService.handlePersistenceMessage({ command: 'restoreSession' });
    this.log('Session restored');
  }

  private async handleClear(persistenceService: any): Promise<void> {
    await persistenceService.handlePersistenceMessage({ command: 'clearSession' });
    this.log('Session cleared');
  }
}

/**
 * Extension Scrollback Handler
 */
export class ExtensionScrollbackHandler extends BaseExtensionMessageHandler {
  private pendingScrollbackRequests = new Map<
    string,
    (data: { terminalId: string; scrollbackContent: string[] }) => void
  >();

  constructor() {
    super(['scrollbackDataCollected'], ExtensionMessagePriority.NORMAL);
  }

  async handle(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<void> {
    const terminalId = message.terminalId as string;
    const scrollbackContent = (message as any).scrollbackContent as string[];

    if (!terminalId) {
      this.log('No terminal ID in scrollback response');
      return;
    }

    this.log(
      `Scrollback data received for terminal ${terminalId}: ${scrollbackContent?.length || 0} lines`
    );

    const resolver = this.pendingScrollbackRequests.get(terminalId);
    if (resolver) {
      resolver({ terminalId, scrollbackContent: scrollbackContent || [] });
      this.pendingScrollbackRequests.delete(terminalId);
      this.log(`Resolved pending scrollback request for terminal ${terminalId}`);
    }
  }

  public registerScrollbackRequest(
    terminalId: string,
    resolver: (data: { terminalId: string; scrollbackContent: string[] }) => void
  ): void {
    this.pendingScrollbackRequests.set(terminalId, resolver);
  }
}
