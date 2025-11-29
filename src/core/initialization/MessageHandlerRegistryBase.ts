/**
 * Message Handler Registry Base
 *
 * Abstract base class for registering and managing message handlers.
 * Consolidates message handling patterns across:
 * - SecondaryTerminalProvider (webview message listener)
 * - WebviewCoordinator (command-to-handler mappings)
 * - LightweightTerminalWebviewManager (event handler setup)
 *
 * Provides:
 * - Centralized handler registration
 * - Command-to-handler mapping
 * - Handler validation
 * - Duplicate handler detection
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/218
 */

import { info as logInfo, warn as logWarn, error as logError } from '../../utils/logger';

export type MessageHandler<TMessage = unknown, TContext = unknown> = (
  message: TMessage,
  context?: TContext
) => void | Promise<void>;

export interface HandlerRegistrationOptions {
  /** Allow replacing existing handlers */
  allowOverride?: boolean;
  /** Validate handler before registration */
  validate?: boolean;
  /** Log handler registration */
  logRegistration?: boolean;
}

export interface HandlerMetrics {
  totalHandlers: number;
  commandCount: number;
  duplicateAttempts: number;
  validationFailures: number;
}

/**
 * Abstract base class for message handler registration
 */
export abstract class MessageHandlerRegistryBase<
  TMessage = unknown,
  TContext = unknown,
  TCommandKey extends string = string,
> {
  protected readonly handlers = new Map<TCommandKey, MessageHandler<TMessage, TContext>>();
  private _registrationMetrics: HandlerMetrics = {
    totalHandlers: 0,
    commandCount: 0,
    duplicateAttempts: 0,
    validationFailures: 0,
  };

  /**
   * Template Method - Register all handlers
   *
   * This method should NOT be overridden by subclasses.
   * Instead, implement registerCoreHandlers() and registerSpecializedHandlers().
   */
  public registerAllHandlers(options?: HandlerRegistrationOptions): void {
    const opts: Required<HandlerRegistrationOptions> = {
      allowOverride: false,
      validate: true,
      logRegistration: false,
      ...options,
    };

    try {
      this.logRegistration('Starting handler registration...');

      // Register core handlers (required)
      this.registerCoreHandlers();

      // Register specialized handlers (optional)
      this.registerSpecializedHandlers();

      // Validate registered handlers
      if (opts.validate) {
        this.validateHandlers();
      }

      this._registrationMetrics.totalHandlers = this.handlers.size;
      this.logRegistration(
        `Registration complete: ${this.handlers.size} handlers for ${this._registrationMetrics.commandCount} commands`
      );
    } catch (error) {
      this.logError('Handler registration failed', error);
      throw error;
    }
  }

  /**
   * Dispatch a message to the appropriate handler
   */
  public async dispatch(
    message: TMessage,
    context?: TContext,
    commandExtractor?: (msg: TMessage) => TCommandKey
  ): Promise<void> {
    const command = commandExtractor ? commandExtractor(message) : this.extractCommand(message);

    const handler = this.handlers.get(command);

    if (!handler) {
      this.handleUnknownCommand(command, message);
      return;
    }

    try {
      await handler(message, context);
    } catch (error) {
      this.handleDispatchError(command, message, error);
    }
  }

  /**
   * Get registered command list
   */
  public getRegisteredCommands(): TCommandKey[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if a command is registered
   */
  public hasHandler(command: TCommandKey): boolean {
    return this.handlers.has(command);
  }

  /**
   * Get handler metrics
   */
  public getMetrics(): HandlerMetrics {
    return { ...this._registrationMetrics };
  }

  // ============================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ============================================================================

  /**
   * Register core handlers (required)
   *
   * Examples:
   * - SecondaryTerminalProvider: Register terminal lifecycle, settings handlers
   * - WebviewCoordinator: Register lifecycle, serialization, session handlers
   */
  protected abstract registerCoreHandlers(): void;

  /**
   * Extract command key from message
   *
   * Examples:
   * - Extract 'command' field from WebviewMessage
   * - Extract 'type' field from custom message type
   */
  protected abstract extractCommand(message: TMessage): TCommandKey;

  // ============================================================================
  // HOOK METHODS - Optional overrides with default implementations
  // ============================================================================

  /**
   * Register specialized handlers (optional)
   *
   * Override to add context-specific handlers.
   *
   * Example:
   * - WebviewCoordinator: Register CLI agent, profile handlers
   */
  protected registerSpecializedHandlers(): void {
    // Default: No-op
  }

  /**
   * Validate registered handlers
   *
   * Override to implement custom validation logic.
   *
   * Example:
   * - Check that all required commands have handlers
   * - Verify handler function signatures
   */
  protected validateHandlers(): void {
    // Default: Basic validation (at least one handler registered)
    if (this.handlers.size === 0) {
      throw new Error('No handlers registered');
    }
  }

  /**
   * Handle unknown command
   *
   * Override to implement custom unknown command handling.
   *
   * Example:
   * - Log warning
   * - Send error message back to sender
   */
  protected handleUnknownCommand(command: TCommandKey, _message: TMessage): void {
    this.logWarning(`Unknown command: ${String(command)}`);
  }

  /**
   * Handle dispatch error
   *
   * Override to implement custom error handling.
   *
   * Example:
   * - Log error with context
   * - Send error notification
   * - Retry with fallback handler
   */
  protected handleDispatchError(command: TCommandKey, message: TMessage, error: unknown): void {
    this.logError(`Error dispatching command '${String(command)}'`, error);
  }

  // ============================================================================
  // CONCRETE UTILITY METHODS - Reusable (DO NOT override)
  // ============================================================================

  /**
   * Register a single handler for one command
   */
  protected registerHandler(
    command: TCommandKey,
    handler: MessageHandler<TMessage, TContext>,
    options?: HandlerRegistrationOptions
  ): void {
    const opts: Required<HandlerRegistrationOptions> = {
      allowOverride: false,
      validate: true,
      logRegistration: false,
      ...options,
    };

    // Check for duplicate registration
    if (this.handlers.has(command) && !opts.allowOverride) {
      this._registrationMetrics.duplicateAttempts++;
      this.logWarning(`Handler already registered for command '${String(command)}' (skipped)`);
      return;
    }

    // Validate handler
    if (opts.validate && !this.isValidHandler(handler)) {
      this._registrationMetrics.validationFailures++;
      throw new Error(`Invalid handler for command '${String(command)}'`);
    }

    // Register handler
    this.handlers.set(command, handler);
    this._registrationMetrics.commandCount++;

    if (opts.logRegistration) {
      this.logRegistration(`Registered handler for command '${String(command)}'`);
    }
  }

  /**
   * Register a handler for multiple commands
   *
   * Convenience method for registering the same handler for multiple commands.
   *
   * Example:
   * ```typescript
   * this.register(
   *   ['init', 'output', 'terminalCreated'],
   *   (message, context) => this.lifecycleHandler.handleMessage(message, context)
   * );
   * ```
   */
  protected register(
    commands: TCommandKey[],
    handler: MessageHandler<TMessage, TContext>,
    options?: HandlerRegistrationOptions
  ): void {
    commands.forEach((command) => this.registerHandler(command, handler, options));
  }

  /**
   * Unregister a handler
   */
  protected unregisterHandler(command: TCommandKey): boolean {
    const deleted = this.handlers.delete(command);

    if (deleted) {
      this._registrationMetrics.commandCount--;
    }

    return deleted;
  }

  /**
   * Clear all handlers
   */
  protected clearHandlers(): void {
    this.handlers.clear();
    this._registrationMetrics.commandCount = 0;
    this._registrationMetrics.totalHandlers = 0;
  }

  /**
   * Validate handler function
   */
  private isValidHandler(handler: MessageHandler<TMessage, TContext>): boolean {
    return typeof handler === 'function';
  }

  /**
   * Log registration information
   */
  protected logRegistration(message: string): void {
    logInfo(`[HandlerRegistry] ${message}`);
  }

  /**
   * Log warning
   */
  protected logWarning(message: string): void {
    logWarn(`[HandlerRegistry] ${message}`);
  }

  /**
   * Log error
   */
  protected logError(message: string, error: unknown): void {
    logError(`[HandlerRegistry] ${message}:`, error);
  }
}
