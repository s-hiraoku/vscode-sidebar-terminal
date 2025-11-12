/**
 * Extension Message Dispatcher
 *
 * Centralized message handler for Extension-side (SecondaryTerminalProvider).
 * Consolidates all message handling logic into a single, testable component.
 */

import * as vscode from 'vscode';
import { WebviewMessage } from '../types/common';
import { provider as log } from '../utils/logger';
import { TerminalManager } from '../terminals/TerminalManager';

/**
 * Extension-side message handler context
 */
export interface IExtensionMessageHandlerContext {
  terminalManager: TerminalManager;
  extensionContext: vscode.ExtensionContext;
  sendMessage: (message: any) => Promise<void>;
  getStandardSessionManager?: () => any;
  getPersistenceService?: () => any;
  getView: () => vscode.WebviewView | undefined;
}

/**
 * Extension-side message handler interface
 */
export interface IExtensionMessageHandler {
  readonly supportedCommands: string[];
  readonly priority: number;
  canHandle(message: WebviewMessage): boolean;
  handle(message: WebviewMessage, context: IExtensionMessageHandlerContext): Promise<void>;
}

/**
 * Message handler priority levels
 */
export enum ExtensionMessagePriority {
  CRITICAL = 100, // System-critical messages
  HIGH = 75, // User interactions
  NORMAL = 50, // Standard operations
  LOW = 25, // Background tasks
}

/**
 * Base class for Extension message handlers
 */
export abstract class BaseExtensionMessageHandler implements IExtensionMessageHandler {
  constructor(
    public readonly supportedCommands: string[],
    public readonly priority: number = ExtensionMessagePriority.NORMAL
  ) {}

  canHandle(message: WebviewMessage): boolean {
    return this.supportedCommands.includes(message.command);
  }

  abstract handle(message: WebviewMessage, context: IExtensionMessageHandlerContext): Promise<void>;

  protected log(message: string, ...args: any[]): void {
    log(`[${this.constructor.name}] ${message}`, ...args);
  }

  protected logError(message: string, error: unknown): void {
    log(`❌ [${this.constructor.name}] ${message}`, error);
  }
}

/**
 * Extension Message Dispatcher
 *
 * Consolidates all Extension-side message handling into a single registry.
 */
export class ExtensionMessageDispatcher {
  private handlers = new Map<string, IExtensionMessageHandler[]>();
  private disposed = false;

  constructor() {
    log('📨 [ExtensionMessageDispatcher] Initializing');
  }

  /**
   * Register a message handler
   */
  registerHandler(handler: IExtensionMessageHandler): void {
    if (this.disposed) {
      throw new Error('ExtensionMessageDispatcher has been disposed');
    }

    for (const command of handler.supportedCommands) {
      if (!this.handlers.has(command)) {
        this.handlers.set(command, []);
      }

      const commandHandlers = this.handlers.get(command)!;
      commandHandlers.push(handler);

      // Sort by priority (higher first)
      commandHandlers.sort((a, b) => b.priority - a.priority);
    }

    log(`✅ [ExtensionMessageDispatcher] Registered handler: ${handler.constructor.name}`);
  }

  /**
   * Unregister a message handler
   */
  unregisterHandler(handler: IExtensionMessageHandler): void {
    for (const command of handler.supportedCommands) {
      const commandHandlers = this.handlers.get(command);
      if (commandHandlers) {
        const index = commandHandlers.indexOf(handler);
        if (index !== -1) {
          commandHandlers.splice(index, 1);
        }

        if (commandHandlers.length === 0) {
          this.handlers.delete(command);
        }
      }
    }

    log(`🗑️ [ExtensionMessageDispatcher] Unregistered handler: ${handler.constructor.name}`);
  }

  /**
   * Handle a message from WebView
   */
  async handleMessage(
    message: WebviewMessage,
    context: IExtensionMessageHandlerContext
  ): Promise<boolean> {
    if (this.disposed) {
      log('⚠️ [ExtensionMessageDispatcher] Cannot handle message: dispatcher disposed');
      return false;
    }

    log(`📨 [ExtensionMessageDispatcher] Handling message: ${message.command}`);

    const handlers = this.handlers.get(message.command);
    if (!handlers || handlers.length === 0) {
      log(`⚠️ [ExtensionMessageDispatcher] No handler for command: ${message.command}`);
      return false;
    }

    // Try handlers in priority order
    for (const handler of handlers) {
      if (handler.canHandle(message)) {
        try {
          await handler.handle(message, context);
          log(`✅ [ExtensionMessageDispatcher] Handled by: ${handler.constructor.name}`);
          return true;
        } catch (error) {
          log(`❌ [ExtensionMessageDispatcher] Handler failed: ${handler.constructor.name}`, error);
          // Continue to next handler
          continue;
        }
      }
    }

    log(`⚠️ [ExtensionMessageDispatcher] No handler could process: ${message.command}`);
    return false;
  }

  /**
   * Get statistics about registered handlers
   */
  getStats(): {
    totalCommands: number;
    totalHandlers: number;
    commandList: string[];
  } {
    let totalHandlers = 0;
    for (const handlers of this.handlers.values()) {
      totalHandlers += handlers.length;
    }

    return {
      totalCommands: this.handlers.size,
      totalHandlers,
      commandList: Array.from(this.handlers.keys()).sort(),
    };
  }

  /**
   * Check if a command has a handler
   */
  hasHandler(command: string): boolean {
    return this.handlers.has(command);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.disposed) return;

    log('🧹 [ExtensionMessageDispatcher] Disposing');
    this.disposed = true;
    this.handlers.clear();
  }
}
