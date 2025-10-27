import { WebviewMessage } from '../types/common';
import { MessageHandler } from '../types/type-guards';

export type MessageHandlerMap = Record<string, MessageHandler>;

/**
 * Lightweight command router for SecondaryTerminalProvider.
 * Handles registration and dispatch without exposing the underlying map.
 */
export class SecondaryTerminalMessageRouter {
  private readonly handlers = new Map<string, MessageHandler>();

  register(command: string | undefined, handler: MessageHandler): void {
    if (!command) {
      return;
    }
    this.handlers.set(command, handler);
  }

  registerAll(map: MessageHandlerMap): void {
    Object.entries(map).forEach(([command, handler]) => this.register(command, handler));
  }

  reset(): void {
    this.handlers.clear();
  }

  async dispatch(message: WebviewMessage): Promise<boolean> {
    const handler = this.handlers.get(message.command);
    if (!handler) {
      return false;
    }

    await handler(message);
    return true;
  }

  clear(): void {
    this.handlers.clear();
  }
}
