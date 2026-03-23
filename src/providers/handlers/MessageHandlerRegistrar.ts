/**
 * MessageHandlerRegistrar
 *
 * Builds and registers all WebView message handler definitions for the
 * MessageRoutingFacade. Extracted from SecondaryTerminalProvider._initializeMessageHandlers().
 */

import * as vscode from 'vscode';
import { WebviewMessage } from '../../types/common';
import { TERMINAL_CONSTANTS } from '../../constants';
import { provider as log } from '../../utils/logger';
import { TerminalCommandHandlers } from '../services/TerminalCommandHandlers';
import { ScrollbackMessageHandler } from './ScrollbackMessageHandler';
import { DebugMessageHandler } from './DebugMessageHandler';
import { SettingsMessageHandler } from './SettingsMessageHandler';
import { MessageRoutingFacade } from '../services/MessageRoutingFacade';

/**
 * Handler definition for message routing
 */
export interface HandlerDefinition {
  command: string;
  handler: (msg: WebviewMessage) => void | Promise<void>;
  category: 'ui' | 'settings' | 'terminal' | 'persistence' | 'debug';
}

/**
 * Dependencies required by MessageHandlerRegistrar
 */
export interface IMessageHandlerRegistrarDependencies {
  handleWebviewReady: (msg: WebviewMessage) => void;
  handleWebviewInitialized: (msg: WebviewMessage) => Promise<void>;
  handleReportPanelLocation: (msg: WebviewMessage) => Promise<void>;
  handleTerminalInitializationComplete: (msg: WebviewMessage) => Promise<void>;
  handleTerminalReady: (msg: WebviewMessage) => Promise<void>;
  handlePersistenceMessage: (msg: WebviewMessage) => Promise<void>;
  handleLegacyPersistenceMessage: (msg: WebviewMessage) => Promise<void>;
  terminalCommandHandlers: TerminalCommandHandlers;
  settingsMessageHandler: SettingsMessageHandler;
  scrollbackMessageHandler: ScrollbackMessageHandler;
  debugMessageHandler: DebugMessageHandler;
}

/**
 * Critical handler commands that must be validated after registration
 */
const CRITICAL_HANDLERS = [
  'terminalInitializationComplete',
  'terminalReady',
  TERMINAL_CONSTANTS?.COMMANDS?.READY,
  TERMINAL_CONSTANTS?.COMMANDS?.RESIZE,
  TERMINAL_CONSTANTS?.COMMANDS?.FOCUS_TERMINAL,
];

export class MessageHandlerRegistrar {
  constructor(private readonly deps: IMessageHandlerRegistrarDependencies) {}

  /**
   * Build all handler definitions, register them on the router, and validate critical handlers.
   */
  public registerAll(router: MessageRoutingFacade): void {
    router.reset();

    const handlers = this._buildHandlerDefinitions();
    router.registerHandlers(handlers);

    router.validateHandlers(CRITICAL_HANDLERS);
    router.logRegisteredHandlers();

    log('✅ [PROVIDER] Message handlers initialized via MessageRoutingFacade');
  }

  /**
   * Build the complete list of handler definitions.
   */
  private _buildHandlerDefinitions(): HandlerDefinition[] {
    return [
      ...this._buildUiHandlers(),
      ...this._buildSettingsHandlers(),
      ...this._buildTerminalHandlers(),
      ...this._buildPersistenceHandlers(),
      ...this._buildDebugHandlers(),
    ];
  }

  private _buildUiHandlers(): HandlerDefinition[] {
    return [
      {
        command: 'webviewReady',
        handler: (msg) => this.deps.handleWebviewReady(msg),
        category: 'ui',
      },
      {
        command: TERMINAL_CONSTANTS?.COMMANDS?.READY,
        handler: (msg) => this.deps.handleWebviewReady(msg),
        category: 'ui',
      },
      {
        command: 'webviewInitialized',
        handler: (msg) => this.deps.handleWebviewInitialized(msg),
        category: 'ui',
      },
      {
        command: 'reportPanelLocation',
        handler: async (msg) => await this.deps.handleReportPanelLocation(msg),
        category: 'ui',
      },
    ];
  }

  private _buildSettingsHandlers(): HandlerDefinition[] {
    return [
      {
        command: 'getSettings',
        handler: async () => await this.deps.settingsMessageHandler.handleGetSettings(),
        category: 'settings',
      },
      {
        command: 'updateSettings',
        handler: async (msg) => await this.deps.settingsMessageHandler.handleUpdateSettings(msg),
        category: 'settings',
      },
    ];
  }

  private _buildTerminalHandlers(): HandlerDefinition[] {
    const tch = this.deps.terminalCommandHandlers;
    return [
      {
        command: 'focusTerminal',
        handler: async (msg) => await tch.handleFocusTerminal(msg),
        category: 'terminal',
      },
      {
        command: TERMINAL_CONSTANTS?.COMMANDS?.FOCUS_TERMINAL,
        handler: async (msg) => await tch.handleFocusTerminal(msg),
        category: 'terminal',
      },
      {
        command: 'splitTerminal',
        handler: (msg) => tch.handleSplitTerminal(msg),
        category: 'terminal',
      },
      {
        command: 'createTerminal',
        handler: async (msg) => await tch.handleCreateTerminal(msg),
        category: 'terminal',
      },
      {
        command: TERMINAL_CONSTANTS?.COMMANDS?.CREATE_TERMINAL,
        handler: async (msg) => await tch.handleCreateTerminal(msg),
        category: 'terminal',
      },
      {
        command: TERMINAL_CONSTANTS?.COMMANDS?.INPUT,
        handler: (msg) => tch.handleTerminalInput(msg),
        category: 'terminal',
      },
      {
        command: TERMINAL_CONSTANTS?.COMMANDS?.RESIZE,
        handler: (msg) => tch.handleTerminalResize(msg),
        category: 'terminal',
      },
      {
        command: 'getTerminalProfiles',
        handler: async () => await tch.handleGetTerminalProfiles(),
        category: 'terminal',
      },
      {
        command: 'killTerminal',
        handler: async (msg) => await tch.handleKillTerminal(msg),
        category: 'terminal',
      },
      {
        command: 'deleteTerminal',
        handler: async (msg) => await tch.handleDeleteTerminal(msg),
        category: 'terminal',
      },
      {
        command: 'terminalClosed',
        handler: async (msg) => await tch.handleTerminalClosed(msg),
        category: 'terminal',
      },
      {
        command: 'openTerminalLink',
        handler: async (msg) => await tch.handleOpenTerminalLink(msg),
        category: 'terminal',
      },
      {
        command: 'reorderTerminals',
        handler: async (msg) => await tch.handleReorderTerminals(msg),
        category: 'terminal',
      },
      {
        command: 'renameTerminal',
        handler: async (msg) => await tch.handleRenameTerminal(msg),
        category: 'terminal',
      },
      {
        command: 'updateTerminalHeader',
        handler: async (msg) => await tch.handleUpdateTerminalHeader(msg),
        category: 'terminal',
      },
      {
        command: 'requestInitialTerminal',
        handler: async (msg) => await tch.handleRequestInitialTerminal(msg),
        category: 'terminal',
      },
      {
        command: 'terminalInteraction',
        handler: async (msg) => await tch.handleTerminalInteraction(msg),
        category: 'terminal',
      },
      {
        command: 'terminalFocused',
        handler: async (msg) => {
          log(`🎯 [PROVIDER] Terminal focused: ${msg.terminalId}`);
          await vscode.commands.executeCommand('setContext', 'secondaryTerminalFocus', true);
        },
        category: 'terminal',
      },
      {
        command: 'terminalBlurred',
        handler: async (msg) => {
          log(`🎯 [PROVIDER] Terminal blurred: ${msg.terminalId}`);
          await vscode.commands.executeCommand('setContext', 'secondaryTerminalFocus', false);
        },
        category: 'terminal',
      },
      {
        command: 'terminalInitializationComplete',
        handler: async (msg) => await this.deps.handleTerminalInitializationComplete(msg),
        category: 'terminal',
      },
      {
        command: 'terminalReady',
        handler: async (msg) => await this.deps.handleTerminalReady(msg),
        category: 'terminal',
      },
      {
        command: 'requestClipboardContent',
        handler: async (msg) => await tch.handleClipboardRequest(msg),
        category: 'terminal',
      },
      {
        command: 'copyToClipboard',
        handler: async (msg) => await tch.handleCopyToClipboard(msg),
        category: 'terminal',
      },
      {
        command: 'pasteImage',
        handler: async (msg) => await tch.handlePasteImage(msg),
        category: 'terminal',
      },
      {
        command: 'pasteText',
        handler: async (msg) => await tch.handlePasteText(msg),
        category: 'terminal',
      },
      {
        command: 'switchAiAgent',
        handler: async (msg) => await tch.handleSwitchAiAgent(msg),
        category: 'terminal',
      },
    ];
  }

  private _buildPersistenceHandlers(): HandlerDefinition[] {
    const sbh = this.deps.scrollbackMessageHandler;
    return [
      {
        command: 'persistenceSaveSession',
        handler: async (msg) => await this.deps.handlePersistenceMessage(msg),
        category: 'persistence',
      },
      {
        command: 'persistenceRestoreSession',
        handler: async (msg) => await this.deps.handlePersistenceMessage(msg),
        category: 'persistence',
      },
      {
        command: 'persistenceClearSession',
        handler: async (msg) => await this.deps.handlePersistenceMessage(msg),
        category: 'persistence',
      },
      {
        command: 'terminalSerializationRequest',
        handler: async (msg) => await this.deps.handleLegacyPersistenceMessage(msg),
        category: 'persistence',
      },
      {
        command: 'terminalSerializationRestoreRequest',
        handler: async (msg) => await this.deps.handleLegacyPersistenceMessage(msg),
        category: 'persistence',
      },
      {
        command: 'pushScrollbackData',
        handler: async (msg) => await sbh.handlePushScrollbackData(msg),
        category: 'persistence',
      },
      {
        command: 'scrollbackDataCollected',
        handler: async (msg) => await sbh.handleScrollbackDataCollected(msg),
        category: 'persistence',
      },
      {
        command: 'scrollbackExtracted',
        handler: async (msg) => await sbh.handleScrollbackDataCollected(msg),
        category: 'persistence',
      },
      {
        command: 'requestScrollbackRefresh',
        handler: async (msg) => await sbh.handleScrollbackRefreshRequest(msg),
        category: 'persistence',
      },
    ];
  }

  private _buildDebugHandlers(): HandlerDefinition[] {
    const dbg = this.deps.debugMessageHandler;
    return [
      {
        command: 'htmlScriptTest',
        handler: (msg) => dbg.handleHtmlScriptTest(msg),
        category: 'debug',
      },
      {
        command: 'timeoutTest',
        handler: (msg) => dbg.handleTimeoutTest(msg),
        category: 'debug',
      },
      {
        command: 'test',
        handler: (msg) => dbg.handleDebugTest(msg),
        category: 'debug',
      },
    ];
  }
}
