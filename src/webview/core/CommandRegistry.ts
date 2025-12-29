/**
 * Command Registry - Unified Message/Command Routing
 *
 * Provides centralized command handler registration and dispatch.
 * Eliminates duplicate switch-case routing across 8+ message handlers.
 *
 * Key Features:
 * - Type-safe command registration
 * - Priority-based handler execution
 * - Category grouping for related commands
 * - Middleware support for cross-cutting concerns
 * - Bulk registration for cleaner code
 *
 * @example
 * ```typescript
 * const registry = new CommandRegistry();
 *
 * // Register single handler
 * registry.register('terminalCreated', async (msg) => {
 *   await handleTerminalCreated(msg);
 * }, { priority: 'high', category: 'lifecycle' });
 *
 * // Bulk registration
 * registry.registerBulk({
 *   'terminalCreated': handleTerminalCreated,
 *   'terminalDeleted': handleTerminalDeleted,
 *   'terminalOutput': handleTerminalOutput,
 * });
 *
 * // Dispatch
 * const handled = await registry.dispatch(message);
 * ```
 */

import { webview as log } from '../../utils/logger';
import { COMMAND_REGISTRY_CONSTANTS } from '../constants/webview';

/**
 * Message structure that commands receive
 */
export interface CommandMessage {
  command: string;
  [key: string]: unknown;
}

/**
 * Command handler function signature
 */
export type CommandHandler<T extends CommandMessage = CommandMessage> = (
  message: T,
  context?: CommandContext
) => void | Promise<void>;

/**
 * Context passed to command handlers
 */
export interface CommandContext {
  /** Registry instance for sub-dispatching */
  registry: CommandRegistry;
  /** Additional data from middleware */
  data?: Record<string, unknown>;
}

/**
 * Handler registration options
 */
export interface HandlerOptions {
  /** Execution priority: high (0), normal (50), low (100) */
  priority?: 'high' | 'normal' | 'low';
  /** Category for grouping related commands */
  category?: string;
  /** Description for documentation */
  description?: string;
  /** If true, handler runs even if previous handlers fail */
  continueOnError?: boolean;
}

/**
 * Middleware function for cross-cutting concerns
 */
export type CommandMiddleware = (
  message: CommandMessage,
  context: CommandContext,
  next: () => Promise<void>
) => Promise<void>;

interface RegisteredHandler {
  handler: CommandHandler;
  options: HandlerOptions;
  priorityValue: number;
}

/**
 * Priority value mapping
 */
const PRIORITY_VALUES: Record<'high' | 'normal' | 'low', number> = {
  high: 0,
  normal: 50,
  low: 100,
};

/**
 * Command Registry for unified message routing
 */
export class CommandRegistry {
  private readonly handlers = new Map<string, RegisteredHandler[]>();
  private readonly middlewares: CommandMiddleware[] = [];
  private readonly categories = new Map<string, Set<string>>();

  /**
   * Register a command handler
   *
   * @param command Command name to handle
   * @param handler Handler function
   * @param options Registration options
   */
  public register<T extends CommandMessage = CommandMessage>(
    command: string,
    handler: CommandHandler<T>,
    options: HandlerOptions = {}
  ): void {
    const priorityValue: number = PRIORITY_VALUES[options.priority ?? 'normal'] ?? PRIORITY_VALUES.normal;

    const registered: RegisteredHandler = {
      handler: handler as CommandHandler,
      options,
      priorityValue,
    };

    // Get or create handlers array for this command
    let commandHandlers = this.handlers.get(command);
    if (!commandHandlers) {
      commandHandlers = [];
      this.handlers.set(command, commandHandlers);
    }

    // Insert in priority order
    const insertIndex = commandHandlers.findIndex((h) => h.priorityValue > priorityValue);
    if (insertIndex === -1) {
      commandHandlers.push(registered);
    } else {
      commandHandlers.splice(insertIndex, 0, registered);
    }

    // Track category
    if (options.category) {
      let categoryCommands = this.categories.get(options.category);
      if (!categoryCommands) {
        categoryCommands = new Set();
        this.categories.set(options.category, categoryCommands);
      }
      categoryCommands.add(command);
    }

    log(`[CommandRegistry] ✅ Registered: ${command}${options.category ? ` [${options.category}]` : ''}`);
  }

  /**
   * Register multiple handlers at once
   *
   * @param handlers Object mapping command names to handlers
   * @param commonOptions Options applied to all handlers
   */
  public registerBulk(
    handlers: Record<string, CommandHandler>,
    commonOptions: HandlerOptions = {}
  ): void {
    for (const [command, handler] of Object.entries(handlers)) {
      this.register(command, handler, commonOptions);
    }

    log(`[CommandRegistry] ✅ Bulk registered ${Object.keys(handlers).length} handlers`);
  }

  /**
   * Unregister a command handler
   */
  public unregister(command: string): boolean {
    const existed = this.handlers.has(command);
    this.handlers.delete(command);

    // Remove from categories
    for (const categoryCommands of this.categories.values()) {
      categoryCommands.delete(command);
    }

    if (existed) {
      log(`[CommandRegistry] 🗑️ Unregistered: ${command}`);
    }

    return existed;
  }

  /**
   * Add middleware for cross-cutting concerns
   *
   * @param middleware Middleware function
   */
  public use(middleware: CommandMiddleware): void {
    this.middlewares.push(middleware);
    log(`[CommandRegistry] ✅ Added middleware (total: ${this.middlewares.length})`);
  }

  /**
   * Dispatch a message to registered handlers
   *
   * @param message Message to dispatch
   * @returns true if handled, false if no handler found
   */
  public async dispatch(message: CommandMessage): Promise<boolean> {
    const handlers = this.handlers.get(message.command);

    if (!handlers || handlers.length === 0) {
      return false;
    }

    const context: CommandContext = {
      registry: this,
      data: {},
    };

    // Build middleware chain
    const executeHandlers = async (): Promise<void> => {
      for (const registered of handlers) {
        try {
          await registered.handler(message, context);
        } catch (error) {
          log(`[CommandRegistry] ❌ Handler error for ${message.command}:`, error);

          if (!registered.options.continueOnError) {
            throw error;
          }
        }
      }
    };

    // Execute with middleware
    try {
      await this.executeWithMiddleware(message, context, executeHandlers);
      return true;
    } catch (error) {
      log(`[CommandRegistry] ❌ Dispatch failed for ${message.command}:`, error);
      throw error;
    }
  }

  /**
   * Execute handler chain with middleware
   */
  private async executeWithMiddleware(
    message: CommandMessage,
    context: CommandContext,
    handlers: () => Promise<void>
  ): Promise<void> {
    if (this.middlewares.length === 0) {
      await handlers();
      return;
    }

    // Build middleware chain
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        if (middleware) {
          await middleware(message, context, next);
        }
      } else {
        await handlers();
      }
    };

    await next();
  }

  /**
   * Check if a command has registered handlers
   */
  public has(command: string): boolean {
    return this.handlers.has(command) && (this.handlers.get(command)?.length ?? 0) > 0;
  }

  /**
   * Get all commands in a category
   */
  public getByCategory(category: string): string[] {
    return Array.from(this.categories.get(category) ?? []);
  }

  /**
   * Get all registered commands
   */
  public getCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get statistics about registered handlers
   */
  public getStats(): {
    totalCommands: number;
    totalHandlers: number;
    categories: string[];
    middlewareCount: number;
  } {
    let totalHandlers = 0;
    for (const handlers of this.handlers.values()) {
      totalHandlers += handlers.length;
    }

    return {
      totalCommands: this.handlers.size,
      totalHandlers,
      categories: Array.from(this.categories.keys()),
      middlewareCount: this.middlewares.length,
    };
  }

  /**
   * Clear all registrations
   */
  public clear(): void {
    this.handlers.clear();
    this.categories.clear();
    this.middlewares.length = 0;
    log('[CommandRegistry] 🧹 Cleared all registrations');
  }
}

/**
 * Create common middleware for logging
 */
export function createLoggingMiddleware(
  logger: (msg: string, ...args: unknown[]) => void = log
): CommandMiddleware {
  return async (message, context, next) => {
    const startTime = performance.now();
    logger(`[Command] → ${message.command}`);

    try {
      await next();
      const elapsed = performance.now() - startTime;
      logger(`[Command] ✅ ${message.command} (${elapsed.toFixed(2)}ms)`);
    } catch (error) {
      const elapsed = performance.now() - startTime;
      logger(`[Command] ❌ ${message.command} failed (${elapsed.toFixed(2)}ms):`, error);
      throw error;
    }
  };
}

/**
 * Create common middleware for performance tracking
 */
export function createPerformanceMiddleware(
  threshold: number = COMMAND_REGISTRY_CONSTANTS.SLOW_COMMAND_THRESHOLD_MS
): CommandMiddleware {
  return async (message, context, next) => {
    const startTime = performance.now();

    await next();

    const elapsed = performance.now() - startTime;
    if (elapsed > threshold) {
      log(`[Command] ⚠️ Slow command: ${message.command} (${elapsed.toFixed(2)}ms)`);
    }
  };
}
