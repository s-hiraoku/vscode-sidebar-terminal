import * as vscode from 'vscode';
import { WebviewMessage } from '../types/common';
import { provider as log } from '../utils/logger';
import { TerminalErrorHandler } from '../utils/feedback';

/**
 * Centralized WebView Message Handler Service
 *
 * Extracted from SecondaryTerminalProvider to improve:
 * - Single Responsibility Principle compliance
 * - Testability through dependency injection
 * - Code maintainability and readability
 * - Error handling consistency
 */

export interface IMessageHandler {
  canHandle(command: string): boolean;
  handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void>;
  getHandledCommands?(): string[];
}

export interface IMessageHandlerContext {
  terminalManager: any; // TODO: Replace with proper interface
  webViewStateManager: any; // TODO: Replace with proper interface
  settingsManager: any; // TODO: Replace with proper interface
  sendMessage: (message: WebviewMessage) => Promise<void>;
}

export class WebViewMessageHandlerService {
  private handlers = new Map<string, IMessageHandler>();
  private defaultHandler: IMessageHandler;

  constructor(
    private context: IMessageHandlerContext,
    private extensionContext: vscode.ExtensionContext
  ) {
    this.defaultHandler = new UnknownMessageHandler();
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    // Register specific message handlers
    this.registerHandler(new TestMessageHandler());
    this.registerHandler(new WebViewReadyHandler());
    this.registerHandler(new TerminalInputHandler());
    this.registerHandler(new TerminalResizeHandler());
    this.registerHandler(new FocusTerminalHandler());
    this.registerHandler(new CreateTerminalHandler());
    this.registerHandler(new DeleteTerminalHandler());
    this.registerHandler(new SettingsHandler());
    this.registerHandler(new PanelLocationHandler());
    this.registerHandler(new CliAgentHandler());
  }

  public registerHandler(handler: IMessageHandler): void {
    // Each handler can handle multiple commands
    const commands = handler.getHandledCommands?.() || [];
    commands.forEach((command: string) => {
      this.handlers.set(command, handler);
    });
  }

  public async handleMessage(message: WebviewMessage): Promise<void> {
    log('📨 [MESSAGE-HANDLER] Processing message:', message.command);

    try {
      const handler = this.handlers.get(message.command) || this.defaultHandler;

      if (handler.canHandle(message.command)) {
        await handler.handle(message, this.context);
        log(`✅ [MESSAGE-HANDLER] Message handled successfully: ${message.command}`);
      } else {
        log(`⚠️ [MESSAGE-HANDLER] No handler available for: ${message.command}`);
      }
    } catch (error) {
      log(`❌ [MESSAGE-HANDLER] Error handling message ${message.command}:`, error);
      TerminalErrorHandler.handleWebviewError(error);
      throw error;
    }
  }
}

// Base handler class for common functionality
abstract class BaseMessageHandler implements IMessageHandler {
  abstract getHandledCommands(): string[];
  abstract canHandle(command: string): boolean;
  abstract handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void>;

  protected log(message: string, ...args: any[]): void {
    log(`[${this.constructor.name}] ${message}`, ...args);
  }
}

// Test message handler
class TestMessageHandler extends BaseMessageHandler {
  getHandledCommands(): string[] {
    return ['test', 'htmlScriptTest', 'timeoutTest'];
  }

  canHandle(command: string): boolean {
    return this.getHandledCommands().includes(command);
  }

  async handle(message: WebviewMessage, _context: IMessageHandlerContext): Promise<void> {
    this.log('Test message received:', message.command);

    if (message.command === 'test' && (message as any).type === 'initComplete') {
      this.log('🎆 WebView confirms initialization complete!');
    }

    // Test messages don't require further processing
  }
}

// WebView ready handler
class WebViewReadyHandler extends BaseMessageHandler {
  getHandledCommands(): string[] {
    return ['webviewReady', 'ready'];
  }

  canHandle(command: string): boolean {
    return this.getHandledCommands().includes(command);
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.log('WebView ready - initializing terminal');

    // Delegate to WebView state manager for initialization
    await context.webViewStateManager.initializeWebView();

    // Ensure terminals exist
    if (context.terminalManager.getTerminals().length === 0) {
      await context.webViewStateManager.ensureMinimumTerminals();
    }
  }
}

// Terminal input handler
class TerminalInputHandler extends BaseMessageHandler {
  getHandledCommands(): string[] {
    return ['input'];
  }

  canHandle(command: string): boolean {
    return command === 'input';
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    if (!message.data) {
      this.log('No input data provided');
      return;
    }

    this.log(`Terminal input: ${message.data.length} chars, terminalId: ${message.terminalId}`);
    context.terminalManager.sendInput(message.data, message.terminalId);
  }
}

// Terminal resize handler
class TerminalResizeHandler extends BaseMessageHandler {
  getHandledCommands(): string[] {
    return ['resize'];
  }

  canHandle(command: string): boolean {
    return command === 'resize';
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    if (!message.cols || !message.rows) {
      this.log('Invalid resize parameters');
      return;
    }

    this.log(`Terminal resize: ${message.cols}x${message.rows}`);
    context.terminalManager.resize(message.cols, message.rows, message.terminalId);
  }
}

// Focus terminal handler
class FocusTerminalHandler extends BaseMessageHandler {
  getHandledCommands(): string[] {
    return ['focusTerminal'];
  }

  canHandle(command: string): boolean {
    return command === 'focusTerminal';
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    if (!message.terminalId) {
      this.log('No terminal ID provided for focus');
      return;
    }

    this.log(`Setting active terminal: ${message.terminalId}`);
    context.terminalManager.setActiveTerminal(message.terminalId);
  }
}

// Create terminal handler
class CreateTerminalHandler extends BaseMessageHandler {
  getHandledCommands(): string[] {
    return ['createTerminal'];
  }

  canHandle(command: string): boolean {
    return command === 'createTerminal';
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    if (!message.terminalId || !message.terminalName) {
      this.log('Invalid terminal creation parameters');
      return;
    }

    this.log(`Creating terminal: ${message.terminalId} (${message.terminalName})`);

    // Check if terminal already exists
    const existingTerminal = context.terminalManager.getTerminal(message.terminalId);
    if (existingTerminal) {
      this.log(`Terminal ${message.terminalId} already exists, skipping creation`);
      return;
    }

    // Create new terminal
    const newTerminalId = context.terminalManager.createTerminal();
    this.log(`PTY terminal created: ${newTerminalId}`);
  }
}

// Delete terminal handler
class DeleteTerminalHandler extends BaseMessageHandler {
  getHandledCommands(): string[] {
    return ['deleteTerminal', 'killTerminal'];
  }

  canHandle(command: string): boolean {
    return this.getHandledCommands().includes(command);
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    const terminalId = message.terminalId as string;
    const requestSource = (message.requestSource as 'header' | 'panel') || 'panel';

    if (message.command === 'killTerminal') {
      // Kill terminal command - handle active terminal deletion
      if (terminalId) {
        this.log(`Killing specific terminal: ${terminalId}`);
        await this.deleteSpecificTerminal(terminalId, 'panel', context);
      } else {
        this.log('Killing active terminal (panel trash button)');
        const activeTerminalId = context.terminalManager.getActiveTerminalId();
        if (activeTerminalId) {
          await this.deleteSpecificTerminal(activeTerminalId, 'panel', context);
        }
      }
    } else {
      // Delete terminal command
      if (terminalId) {
        this.log(`Deleting terminal: ${terminalId} (source: ${requestSource})`);
        await this.deleteSpecificTerminal(terminalId, requestSource, context);
      } else {
        this.log('No terminal ID provided for deletion');
      }
    }
  }

  private async deleteSpecificTerminal(
    terminalId: string,
    source: 'header' | 'panel',
    context: IMessageHandlerContext
  ): Promise<void> {
    try {
      const result = await context.terminalManager.deleteTerminal(terminalId, { source });

      // Send response to WebView
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
      this.log(`Error deleting terminal ${terminalId}:`, error);

      // Send error response
      await context.sendMessage({
        command: 'deleteTerminalResponse',
        terminalId,
        success: false,
        reason: `Delete failed: ${String(error)}`,
      });
    }
  }
}

// Settings handler
class SettingsHandler extends BaseMessageHandler {
  getHandledCommands(): string[] {
    return ['getSettings', 'updateSettings'];
  }

  canHandle(command: string): boolean {
    return this.getHandledCommands().includes(command);
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    if (message.command === 'getSettings') {
      await this.handleGetSettings(context);
    } else if (message.command === 'updateSettings') {
      await this.handleUpdateSettings(message, context);
    }
  }

  private async handleGetSettings(context: IMessageHandlerContext): Promise<void> {
    this.log('Getting settings from webview');

    const settings = await context.settingsManager.getCurrentSettings();
    const fontSettings = await context.settingsManager.getCurrentFontSettings();

    await context.sendMessage({
      command: 'settingsResponse',
      settings,
    });

    await context.sendMessage({
      command: 'fontSettingsUpdate',
      fontSettings,
    });

    // Send initial panel location
    const panelLocation = await context.settingsManager.getCurrentPanelLocation();
    await context.sendMessage({
      command: 'panelLocationUpdate',
      location: panelLocation,
    });
  }

  private async handleUpdateSettings(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    this.log('Updating settings from webview:', message.settings);

    if (message.settings) {
      await context.settingsManager.updateSettings(message.settings);
    }
  }
}

// Panel location handler
class PanelLocationHandler extends BaseMessageHandler {
  getHandledCommands(): string[] {
    return ['reportPanelLocation'];
  }

  canHandle(command: string): boolean {
    return command === 'reportPanelLocation';
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.log('Panel location reported from WebView:', message.location);

    if (message.location) {
      // Update VS Code context key
      await vscode.commands.executeCommand(
        'setContext',
        'secondaryTerminal.panelLocation',
        message.location
      );

      // Notify WebView of the updated location
      await context.sendMessage({
        command: 'panelLocationUpdate',
        location: message.location,
      });
    }
  }
}

// CLI Agent handler
class CliAgentHandler extends BaseMessageHandler {
  getHandledCommands(): string[] {
    return ['switchAiAgent'];
  }

  canHandle(command: string): boolean {
    return command === 'switchAiAgent';
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    const terminalId = message.terminalId as string;
    const action = message.action as string;

    if (!terminalId) {
      this.log('switchAiAgent: terminalId missing');
      return;
    }

    this.log(`Switching AI Agent for terminal: ${terminalId} (action: ${action})`);

    try {
      const result = context.terminalManager.switchAiAgentConnection(terminalId);

      await context.sendMessage({
        command: 'switchAiAgentResponse',
        terminalId,
        success: result.success,
        newStatus: result.newStatus,
        agentType: result.agentType,
        reason: result.reason,
      });

      if (result.success) {
        this.log(`AI Agent switch succeeded: ${terminalId}, new status: ${result.newStatus}`);
      } else {
        this.log(`AI Agent switch failed: ${terminalId}, reason: ${result.reason}`);
      }
    } catch (error) {
      this.log('Error switching AI Agent:', error);

      await context.sendMessage({
        command: 'switchAiAgentResponse',
        terminalId,
        success: false,
        reason: 'Internal error occurred',
      });
    }
  }
}

// Unknown message handler (default)
class UnknownMessageHandler implements IMessageHandler {
  canHandle(_command: string): boolean {
    return true; // Default handler accepts any command
  }

  async handle(message: WebviewMessage, _context: IMessageHandlerContext): Promise<void> {
    log(`⚠️ [UNKNOWN-HANDLER] Unknown webview message command: ${message.command}`);
  }
}
