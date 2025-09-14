import * as vscode from 'vscode';
import { WebviewMessage } from '../../types/common';
import { TERMINAL_CONSTANTS } from '../../constants';
import { provider as log } from '../../utils/logger';
import { TerminalErrorHandler } from '../../utils/feedback';

/**
 * Interface for message handler context
 * Contains all the dependencies needed by message handlers
 */
export interface MessageHandlerContext {
  terminalManager: any; // Complex TerminalManager interface - using any for flexibility
  sendMessage: (message: any) => Promise<void>;
  isInitialized: boolean;
  setInitialized: (value: boolean) => void;
  initializeTerminal: () => Promise<void>;
  ensureMultipleTerminals: () => void;
  splitTerminal: () => void;
  openSettings: () => void;
  killTerminal: () => Promise<void>;
  killSpecificTerminal: (terminalId: string) => Promise<void>;
  deleteTerminalUnified: (terminalId: string, requestSource: 'header' | 'panel') => Promise<void>;
}

/**
 * Interface for a message handler
 */
export interface MessageHandler {
  readonly supportedCommands: string[];
  handle(command: string, message: WebviewMessage, context: MessageHandlerContext): Promise<void>;
}

/**
 * Service responsible for routing and handling WebView messages
 * 
 * This service extracts message routing logic from SecondaryTerminalProvider to improve:
 * - Single Responsibility: Focus only on message routing and delegation
 * - Testability: Isolated message handling logic with clear interfaces
 * - Extensibility: Easy to add new message handlers without modifying core logic
 * - Maintainability: Organized message handling by category
 * - Performance: Efficient message routing with handler registration
 */
export class WebViewMessageRoutingService {
  private readonly _handlers = new Map<string, MessageHandler>();
  private readonly _debugHandlers = new Set<string>();

  constructor() {
    log('🚦 [MessageRouting] Message routing service initialized');
    this._setupDefaultHandlers();
  }

  /**
   * Register a message handler for specific commands
   */
  registerHandler(handler: MessageHandler): void {
    for (const command of handler.supportedCommands) {
      if (this._handlers.has(command)) {
        log(`⚠️ [MessageRouting] Overwriting existing handler for command: ${command}`);
      }
      this._handlers.set(command, handler);
      log(`✅ [MessageRouting] Registered handler for command: ${command}`);
    }
  }

  /**
   * Unregister a message handler
   */
  unregisterHandler(handler: MessageHandler): void {
    for (const command of handler.supportedCommands) {
      if (this._handlers.get(command) === handler) {
        this._handlers.delete(command);
        log(`🗑️ [MessageRouting] Unregistered handler for command: ${command}`);
      }
    }
  }

  /**
   * Route and handle a webview message
   */
  async routeMessage(message: WebviewMessage, context: MessageHandlerContext): Promise<void> {
    log('📨 [MessageRouting] Routing webview message:', message.command);
    
    if (this._isDebugCommand(message.command)) {
      log('🐛 [MessageRouting] Debug message details:', JSON.stringify(message, null, 2));
    }

    try {
      const handler = this._handlers.get(message.command);
      
      if (handler) {
        log(`🎯 [MessageRouting] Found handler for command: ${message.command}`);
        await handler.handle(message.command, message, context);
        log(`✅ [MessageRouting] Handler completed for command: ${message.command}`);
      } else {
        log(`⚠️ [MessageRouting] No handler found for command: ${message.command}`);
        await this._handleUnknownCommand(message, context);
      }

    } catch (error) {
      log(`❌ [MessageRouting] Error handling command ${message.command}:`, error);
      TerminalErrorHandler.handleWebviewError(error);
      throw error; // Re-throw for caller to handle
    }
  }

  /**
   * Get statistics about registered handlers
   */
  getHandlerStats(): {
    totalHandlers: number;
    registeredCommands: string[];
    debugCommands: string[];
  } {
    return {
      totalHandlers: this._handlers.size,
      registeredCommands: Array.from(this._handlers.keys()).sort(),
      debugCommands: Array.from(this._debugHandlers).sort(),
    };
  }

  /**
   * Check if a command has a registered handler
   */
  hasHandler(command: string): boolean {
    return this._handlers.has(command);
  }

  /**
   * Setup default message handlers
   */
  private _setupDefaultHandlers(): void {
    // Register built-in handlers
    this.registerHandler(new DebugMessageHandler());
    this.registerHandler(new InitializationMessageHandler());
    this.registerHandler(new TerminalControlMessageHandler());
    this.registerHandler(new SettingsMessageHandler());
    this.registerHandler(new TerminalManagementMessageHandler());
    this.registerHandler(new PanelLocationMessageHandler());
    this.registerHandler(new CliAgentMessageHandler());

    // Mark debug commands
    this._debugHandlers.add('htmlScriptTest');
    this._debugHandlers.add('timeoutTest');
    this._debugHandlers.add('test');
  }

  /**
   * Check if command is a debug command
   */
  private _isDebugCommand(command: string): boolean {
    return this._debugHandlers.has(command);
  }

  /**
   * Handle unknown commands
   */
  private async _handleUnknownCommand(message: WebviewMessage, _context: MessageHandlerContext): Promise<void> {
    log(`❓ [MessageRouting] Unknown command received: ${message.command}`);
    
    // For debugging purposes, log full message for unknown commands
    log('📋 [MessageRouting] Unknown message details:', JSON.stringify(message, null, 2));
    
    // Could potentially send an error response back to WebView
    // For now, just log it as this is typically not critical
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    log('🧹 [MessageRouting] Disposing message routing service');
    
    // Clear all handlers
    this._handlers.clear();
    this._debugHandlers.clear();
    
    log('✅ [MessageRouting] Message routing service disposed');
  }
}

/**
 * Handler for debug and test messages
 */
export class DebugMessageHandler implements MessageHandler {
  readonly supportedCommands = ['htmlScriptTest', 'timeoutTest', 'test'];

  async handle(command: string, message: WebviewMessage, _context: MessageHandlerContext): Promise<void> {
    switch (command) {
      case 'htmlScriptTest':
        log('🔥 [DEBUG] ========== HTML INLINE SCRIPT TEST MESSAGE RECEIVED ==========');
        log('🔥 [DEBUG] HTML script communication is working!');
        log('🔥 [DEBUG] Message content:', message);
        break;

      case 'timeoutTest':
        log('🔥 [DEBUG] ========== HTML TIMEOUT TEST MESSAGE RECEIVED ==========');
        log('🔥 [DEBUG] Timeout test communication is working!');
        log('🔥 [DEBUG] Message content:', message);
        break;

      case 'test':
        if ((message as WebviewMessage & { type?: string }).type === 'initComplete') {
          log('🎆 [TRACE] ===============================');
          log('🎆 [TRACE] WEBVIEW CONFIRMS INIT COMPLETE!');
          log('🎆 [TRACE] Message data:', message);
          log('🎆 [TRACE] This means WebView successfully processed INIT message');
        } else {
          log('🧪 [DEBUG] ========== TEST MESSAGE RECEIVED FROM WEBVIEW ==========');
          log('🧪 [DEBUG] Test message content:', message);
          log('🧪 [DEBUG] WebView communication is working!');
        }
        break;
    }
  }
}

/**
 * Handler for initialization messages
 */
export class InitializationMessageHandler implements MessageHandler {
  readonly supportedCommands = ['webviewReady', TERMINAL_CONSTANTS.COMMANDS.READY, 'requestInitialTerminal'];

  async handle(command: string, message: WebviewMessage, context: MessageHandlerContext): Promise<void> {
    switch (command) {
      case 'webviewReady':
      case TERMINAL_CONSTANTS.COMMANDS.READY:
        if (context.isInitialized) {
          log('🔄 [DEBUG] WebView already initialized, skipping duplicate initialization');
          return;
        }

        log('🎯 [DEBUG] WebView ready - initializing terminal immediately');
        context.setInitialized(true);

        // Initialize terminal immediately
        try {
          await context.initializeTerminal();
          log('✅ [DEBUG] Terminal initialization completed immediately');

          // Ensure terminals exist after delay
          setTimeout(() => {
            if (context.terminalManager.getTerminals().length === 0) {
              log('🎯 [ENSURE] No terminals exist - creating minimum set');
              context.ensureMultipleTerminals();
            } else {
              log('🎯 [ENSURE] Terminals already exist - skipping creation');
            }
          }, 100);
        } catch (error) {
          log('❌ [ERROR] Terminal initialization failed:', error);
          TerminalErrorHandler.handleTerminalCreationError(error);
          context.setInitialized(false);
        }
        break;

      case 'requestInitialTerminal':
        log('🚨 [DEBUG] WebView requested initial terminal creation');
        try {
          if (context.terminalManager.getTerminals().length === 0) {
            log('🎯 [INITIAL] Creating initial terminal as requested by WebView');
            const terminalId = context.terminalManager.createTerminal();
            log(`✅ [INITIAL] Initial terminal created: ${terminalId}`);
            context.terminalManager.setActiveTerminal(terminalId);
            
            // Send terminal update to WebView
            await context.sendMessage({
              command: 'stateUpdate',
              state: context.terminalManager.getCurrentState()
            });
          } else {
            log(`🔍 [INITIAL] Terminals already exist (${context.terminalManager.getTerminals().length}), skipping creation`);
          }
        } catch (error) {
          log(`❌ [INITIAL] Failed to create requested initial terminal: ${String(error)}`);
          console.error('❌ [INITIAL] Error details:', error);
        }
        break;

      case 'requestSessionRestore':
        log('🔄 [RESTORATION] WebView requested session restoration');
        try {
          // Note: Session restoration handled via other services
          log('🔄 [RESTORATION] Session restoration delegated to terminal manager');
          
          // Fallback: Create an initial terminal if none exist
          if (context.terminalManager.getTerminals().length === 0) {
            const terminalId = context.terminalManager.createTerminal();
            log(`✅ [RESTORATION] Created fallback terminal: ${terminalId}`);
            context.terminalManager.setActiveTerminal(terminalId);
            
            // Send terminal update to WebView
            await context.sendMessage({
              command: 'stateUpdate',
              state: context.terminalManager.getCurrentState()
            });
          }
        } catch (error) {
          log(`❌ [RESTORATION] Session restoration failed: ${String(error)}`);
          console.error('❌ [RESTORATION] Error details:', error);
          
          // Fallback: Create an initial terminal if none exist
          try {
            if (context.terminalManager.getTerminals().length === 0) {
              const terminalId = context.terminalManager.createTerminal();
              log(`✅ [RESTORATION] Created emergency fallback terminal: ${terminalId}`);
              context.terminalManager.setActiveTerminal(terminalId);
              
              // Send terminal update to WebView
              await context.sendMessage({
                command: 'stateUpdate',
                state: context.terminalManager.getCurrentState()
              });
            }
          } catch (fallbackError) {
            log(`❌ [RESTORATION] Even fallback terminal creation failed: ${String(fallbackError)}`);
          }
        }
        break;
    }
  }
}

/**
 * Handler for terminal control messages (input, resize, etc.)
 */
export class TerminalControlMessageHandler implements MessageHandler {
  readonly supportedCommands = [TERMINAL_CONSTANTS.COMMANDS.INPUT, TERMINAL_CONSTANTS.COMMANDS.RESIZE];

  async handle(command: string, message: WebviewMessage, context: MessageHandlerContext): Promise<void> {
    switch (command) {
      case TERMINAL_CONSTANTS.COMMANDS.INPUT:
        if (message.data) {
          log(
            '⌨️ [DEBUG] Terminal input:',
            message.data.length,
            'chars, data:',
            JSON.stringify(message.data),
            'terminalId:',
            message.terminalId
          );
          context.terminalManager.sendInput(message.terminalId, message.data);
        }
        break;

      case TERMINAL_CONSTANTS.COMMANDS.RESIZE:
        if (message.cols && message.rows) {
          log(`📏 [DEBUG] Terminal resize: ${message.cols}x${message.rows}, terminalId: ${message.terminalId}`);
          context.terminalManager.resizeTerminal(message.terminalId, message.cols, message.rows);
        }
        break;
    }
  }
}

/**
 * Handler for settings-related messages
 */
export class SettingsMessageHandler implements MessageHandler {
  readonly supportedCommands = ['getSettings', 'updateSettings'];

  async handle(command: string, message: WebviewMessage, _context: MessageHandlerContext): Promise<void> {
    switch (command) {
      case 'getSettings':
        log('⚙️ [DEBUG] Getting settings from webview...');
        // This would need to be implemented with actual settings logic
        // For now, delegate back to the provider
        // TODO: Extract settings logic into a dedicated service
        break;

      case 'updateSettings':
        log('⚙️ [DEBUG] Updating settings from webview:', message.settings);
        if (message.settings) {
          // This would need to be implemented with actual settings logic
          // For now, delegate back to the provider  
          // TODO: Extract settings logic into a dedicated service
        }
        break;
    }
  }
}

/**
 * Handler for terminal management messages (create, delete, focus, etc.)
 */
export class TerminalManagementMessageHandler implements MessageHandler {
  readonly supportedCommands = ['createTerminal', 'splitTerminal', 'focusTerminal', 'terminalClosed', 'killTerminal', 'deleteTerminal'];

  async handle(command: string, message: WebviewMessage, context: MessageHandlerContext): Promise<void> {
    switch (command) {
      case 'createTerminal':
        log('🆕 [DEBUG] Creating new terminal from webview...');
        try {
          const newTerminalId = context.terminalManager.createTerminal();
          if (newTerminalId) {
            log(`✅ [DEBUG] Terminal created from webview: ${newTerminalId}`);
            
            const terminalInstance = context.terminalManager.getTerminalById(newTerminalId);
            if (terminalInstance) {
              // VS Code Pattern: Map Extension terminal ID to WebView terminal ID
              log(`🔗 [VS Code Pattern] Mapped Extension ID ${newTerminalId} → WebView ID ${message.terminalId}`);
            }
          } else {
            log(`❌ [DEBUG] Terminal ${message.terminalId} already exists, skipping creation`);
          }
        } catch (error) {
          log(`❌ [DEBUG] Failed to create PTY terminal: ${String(error)}`);
        }
        break;

      case 'splitTerminal':
        log('🔀 [DEBUG] Splitting terminal from webview...');
        context.splitTerminal();
        break;

      case 'focusTerminal':
        log('🎯 [DEBUG] ========== FOCUS TERMINAL COMMAND RECEIVED ==========');
        const terminalId = message.terminalId as string;
        
        const currentActive = context.terminalManager.getActiveTerminalId();
        log(`🔍 [DEBUG] Current active terminal: ${currentActive}`);
        log(`🔍 [DEBUG] Requested active terminal: ${terminalId}`);
        
        if (terminalId) {
          log(`🎯 [DEBUG] Setting active terminal to: ${terminalId}`);
          try {
            context.terminalManager.setActiveTerminal(terminalId);
            
            const newActive = context.terminalManager.getActiveTerminalId();
            log(`🔍 [DEBUG] Verified active terminal after update: ${newActive}`);
            
            if (newActive === terminalId) {
              log(`✅ [DEBUG] Active terminal successfully updated to: ${terminalId}`);
            } else {
              log(`❌ [DEBUG] Active terminal update failed. Expected: ${terminalId}, Got: ${newActive}`);
            }
          } catch (error) {
            log(`❌ [DEBUG] Error setting active terminal:`, error);
          }
        } else {
          log('❌ [DEBUG] No terminal ID provided for focusTerminal');
        }
        break;

      case 'terminalClosed':
        log('🗑️ [DEBUG] Terminal closed from webview:', message.terminalId);
        if (message.terminalId) {
          const terminals = context.terminalManager.getTerminals();
          const terminalExists = terminals.some((t: { id: string }) => t.id === message.terminalId);

          if (terminalExists) {
            log('🗑️ [DEBUG] Removing terminal from extension side:', message.terminalId);
            context.terminalManager.removeTerminal(message.terminalId);
          } else {
            log('🔄 [DEBUG] Terminal already removed from extension side:', message.terminalId);
          }
        }
        break;

      case 'killTerminal':
        log('🗑️ [DEBUG] ========== KILL TERMINAL COMMAND RECEIVED ==========');
        log('🗑️ [DEBUG] Full message:', message);
        log('🗑️ [DEBUG] Message terminalId:', message.terminalId);

        if (message.terminalId) {
          log(`🗑️ [DEBUG] Killing specific terminal: ${message.terminalId}`);
          try {
            await context.killSpecificTerminal(message.terminalId);
            log(`🗑️ [DEBUG] killSpecificTerminal completed for: ${message.terminalId}`);
          } catch (error) {
            log(`❌ [DEBUG] Error in killSpecificTerminal:`, error);
          }
        } else {
          log('🗑️ [DEBUG] Killing active terminal (no specific ID provided) - this is the panel trash button behavior');
          try {
            await context.killTerminal();
            log('🗑️ [DEBUG] killTerminal (active terminal deletion) completed');
          } catch (error) {
            log('❌ [DEBUG] Error in killTerminal (active terminal deletion):', error);
          }
        }
        break;

      case 'deleteTerminal':
        log('🗑️ [DEBUG] ========== DELETE TERMINAL COMMAND RECEIVED ==========');
        log('🗑️ [DEBUG] Full message:', message);

        const deleteTerminalId = message.terminalId as string;
        const requestSource = (message.requestSource as 'header' | 'panel') || 'panel';

        if (deleteTerminalId) {
          log(`🗑️ [DEBUG] Deleting terminal: ${deleteTerminalId} (source: ${requestSource})`);
          try {
            await context.deleteTerminalUnified(deleteTerminalId, requestSource);
          } catch (error) {
            log(`❌ [DEBUG] Error in deleteTerminal:`, error);
            
            // Send error response to WebView
            await context.sendMessage({
              command: 'deleteTerminalResponse',
              terminalId: deleteTerminalId,
              success: false,
              reason: `Delete failed: ${String(error)}`
            });
          }
        } else {
          log('❌ [DEBUG] No terminal ID provided for deleteTerminal');
        }
        break;
    }
  }
}

/**
 * Handler for panel location messages
 */
export class PanelLocationMessageHandler implements MessageHandler {
  readonly supportedCommands = ['reportPanelLocation'];

  async handle(command: string, message: WebviewMessage, context: MessageHandlerContext): Promise<void> {
    if (command === 'reportPanelLocation') {
      log('📍 [DEBUG] Panel location reported from WebView:', message.location);
      if (message.location) {
        // Update context key for VS Code when clause
        await vscode.commands.executeCommand(
          'setContext',
          'secondaryTerminal.panelLocation',
          message.location
        );
        log('📍 [DEBUG] Context key updated with panel location:', message.location);

        // Update panel location and notify WebView
        await context.sendMessage({
          command: 'panelLocationUpdate',
          location: message.location,
        });
        log('📍 [DEBUG] Panel location update sent to WebView:', message.location);
      }
    }
  }
}

/**
 * Handler for CLI Agent messages
 */
export class CliAgentMessageHandler implements MessageHandler {
  readonly supportedCommands = ['switchAiAgent'];

  async handle(command: string, message: WebviewMessage, context: MessageHandlerContext): Promise<void> {
    if (command === 'switchAiAgent') {
      log('📎 [DEBUG] ========== SWITCH AI AGENT COMMAND RECEIVED ==========');
      
      const terminalId = message.terminalId as string;
      log('📎 [DEBUG] Terminal ID:', terminalId);
      log('📎 [DEBUG] Full message:', message);

      if (terminalId) {
        try {
          // This would need to be implemented with actual CLI agent logic
          // For now, just log the request
          log(`📎 [DEBUG] Switching AI Agent for terminal: ${terminalId}`);
          
          // Send success response (placeholder)
          await context.sendMessage({
            command: 'switchAiAgentResponse',
            terminalId,
            success: true,
            newStatus: 'connected',
            agentType: 'claude'
          });
        } catch (error) {
          log('❌ [ERROR] Error switching AI Agent:', error);
          
          // Send error response to WebView
          await context.sendMessage({
            command: 'switchAiAgentResponse',
            terminalId,
            success: false,
            reason: `Switch failed: ${String(error)}`
          });
        }
      }
    }
  }
}