import { WebviewMessage } from '../../types/common';
import { MessageHandler, isWebviewMessage } from '../../types/type-guards';
import { SecondaryTerminalMessageRouter } from '../SecondaryTerminalMessageRouter';
import { provider as log } from '../../utils/logger';

/**
 * Message handler registry for organizing handlers by category
 */
export interface MessageHandlerRegistry {
  command: string;
  handler: MessageHandler;
  category?: 'terminal' | 'settings' | 'persistence' | 'ui' | 'debug' | 'other';
  description?: string;
}

/**
 * MessageRoutingFacade
 *
 * Provides a high-level interface for managing and routing WebView messages
 * to appropriate handlers. This facade simplifies message handling by providing
 * validation, categorization, and organized handler registration.
 *
 * Responsibilities:
 * - Register message handlers by category
 * - Validate incoming messages
 * - Route messages to appropriate handlers
 * - Provide logging and debugging capabilities
 * - Manage handler lifecycle
 *
 * Part of Issue #214 refactoring to apply Facade pattern
 */
export class MessageRoutingFacade {
  private readonly _router: SecondaryTerminalMessageRouter;
  private readonly _handlerRegistry: MessageHandlerRegistry[] = [];
  private _isInitialized = false;

  constructor() {
    this._router = new SecondaryTerminalMessageRouter();
  }

  /**
   * Register a message handler
   *
   * @param command The command string to handle
   * @param handler The handler function
   * @param category Optional category for organization
   * @param description Optional description for debugging
   */
  public registerHandler(
    command: string,
    handler: MessageHandler,
    category?: MessageHandlerRegistry['category'],
    description?: string
  ): void {
    if (!command) {
      log('⚠️ [ROUTING] Cannot register handler with empty command');
      return;
    }

    // Register with the underlying router
    this._router.register(command, handler);

    // Track in registry for debugging and organization
    this._handlerRegistry.push({
      command,
      handler,
      category,
      description,
    });

    log(`✅ [ROUTING] Registered handler for '${command}'${category ? ` (${category})` : ''}`);
  }

  /**
   * Register multiple handlers at once
   *
   * @param handlers Array of handler registrations
   */
  public registerHandlers(handlers: MessageHandlerRegistry[]): void {
    for (const registration of handlers) {
      this.registerHandler(
        registration.command,
        registration.handler,
        registration.category,
        registration.description
      );
    }
  }

  /**
   * Validate that a message is a proper WebviewMessage
   */
  public isValidMessage(message: unknown): message is WebviewMessage {
    if (!isWebviewMessage(message)) {
      log('⚠️ [ROUTING] Invalid message format:', message);
      return false;
    }
    return true;
  }

  /**
   * Dispatch a message to its handler
   *
   * @param message The message to dispatch
   * @returns Promise<boolean> True if handler was found and executed
   */
  public async dispatch(message: WebviewMessage): Promise<boolean> {
    try {
      log(`📨 [ROUTING] Dispatching message: ${message.command}`);

      const handled = await this._router.dispatch(message);

      if (!handled) {
        log(`⚠️ [ROUTING] No handler found for command: ${message.command}`);
      } else {
        log(`✅ [ROUTING] Message handled successfully: ${message.command}`);
      }

      return handled;
    } catch (error) {
      log(`❌ [ROUTING] Error dispatching message ${message.command}:`, error);
      throw error;
    }
  }

  /**
   * Handle an incoming message with validation
   *
   * @param message The raw message from WebView
   * @returns Promise<boolean> True if message was valid and handled
   */
  public async handleMessage(message: unknown): Promise<boolean> {
    // Validate message format
    if (!this.isValidMessage(message)) {
      return false;
    }

    // Dispatch to handler
    return await this.dispatch(message);
  }

  /**
   * Get all registered handlers by category
   */
  public getHandlersByCategory(
    category: MessageHandlerRegistry['category']
  ): MessageHandlerRegistry[] {
    return this._handlerRegistry.filter((reg) => reg.category === category);
  }

  /**
   * Get all registered commands
   */
  public getRegisteredCommands(): string[] {
    return this._handlerRegistry.map((reg) => reg.command);
  }

  /**
   * Get handler count
   */
  public getHandlerCount(): number {
    return this._handlerRegistry.length;
  }

  /**
   * Check if a handler is registered for a command
   */
  public hasHandler(command: string): boolean {
    return this._router.has(command);
  }

  /**
   * Validate that required handlers are registered; logs any gaps for early detection.
   */
  public validateHandlers(requiredCommands: (string | undefined)[]): void {
    const commands = requiredCommands.filter(Boolean) as string[];
    const missing = commands.filter((cmd) => !this._router.has(cmd));
    if (missing.length > 0) {
      log(`❌ [ROUTING] Missing handlers for critical commands: ${missing.join(', ')}`);
      log('📋 [ROUTING] Currently registered commands:', this._router.getRegisteredCommands());
    } else {
      log('✅ [ROUTING] All critical handlers registered');
    }
  }

  /**
   * Mark facade as initialized
   */
  public setInitialized(initialized: boolean): void {
    this._isInitialized = initialized;
  }

  /**
   * Check if facade is initialized
   */
  public isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Log all registered handlers (useful for debugging)
   */
  public logRegisteredHandlers(): void {
    log('📋 [ROUTING] === Registered Message Handlers ===');
    log(`📋 [ROUTING] Total handlers: ${this._handlerRegistry.length}`);

    // Group by category
    const categories = ['terminal', 'settings', 'persistence', 'ui', 'debug', 'other'] as const;

    for (const category of categories) {
      const handlers = this.getHandlersByCategory(category);
      if (handlers.length > 0) {
        log(`📋 [ROUTING] ${category.toUpperCase()}:`);
        for (const handler of handlers) {
          const desc = handler.description ? ` - ${handler.description}` : '';
          log(`📋 [ROUTING]   - ${handler.command}${desc}`);
        }
      }
    }

    // Handlers without category
    const uncategorized = this._handlerRegistry.filter((reg) => !reg.category);
    if (uncategorized.length > 0) {
      log('📋 [ROUTING] UNCATEGORIZED:');
      for (const handler of uncategorized) {
        log(`📋 [ROUTING]   - ${handler.command}`);
      }
    }
  }

  /**
   * Clear all registered handlers
   */
  public clear(): void {
    log('🧹 [ROUTING] Clearing all message handlers');
    this._router.clear();
    this._handlerRegistry.length = 0;
    this._isInitialized = false;
    log('✅ [ROUTING] All handlers cleared');
  }

  /**
   * Reset the router (same as clear, for backward compatibility)
   */
  public reset(): void {
    this.clear();
  }
}
