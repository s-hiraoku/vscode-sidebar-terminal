import { BaseMessageHandler } from './BaseMessageHandler';
import { IMessageHandlerContext } from '../interfaces';
import { WebviewMessage } from '../../../types/common';
import { provider as log } from '../../../utils/logger';

/**
 * Handles terminal kill requests
 */
export class KillTerminalHandler extends BaseMessageHandler {
  protected readonly supportedCommands = ['killTerminal'];

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logMessageHandling(message, 'KillTerminal');

    try {
      const terminalId = (message as any).terminalId;

      if (terminalId) {
        // Kill specific terminal
        log(`🗑️ [KillTerminal] Killing specific terminal: ${terminalId}`);
        await this.killSpecificTerminal(terminalId, context);
        log(`✅ [KillTerminal] Specific terminal killed: ${terminalId}`);
      } else {
        // Kill active terminal (panel trash button behavior)
        log('🗑️ [KillTerminal] Killing active terminal');
        await this.killActiveTerminal(context);
        log('✅ [KillTerminal] Active terminal killed');
      }
    } catch (error) {
      await this.handleError(error, message, 'KillTerminal');
    }
  }

  /**
   * Kill a specific terminal by ID
   */
  private async killSpecificTerminal(
    terminalId: string,
    context: IMessageHandlerContext
  ): Promise<void> {
    const provider = (context as any).provider;
    if (provider && provider.killSpecificTerminal) {
      await provider.killSpecificTerminal(terminalId);
    } else {
      // Fallback implementation
      await context.terminalManager.deleteTerminal(terminalId);
    }
  }

  /**
   * Kill the active terminal
   */
  private async killActiveTerminal(context: IMessageHandlerContext): Promise<void> {
    const provider = (context as any).provider;
    if (provider && provider.killTerminal) {
      await provider.killTerminal();
    } else {
      // Fallback implementation
      const activeTerminalId = context.terminalManager.getActiveTerminalId();
      if (activeTerminalId) {
        await context.terminalManager.deleteTerminal(activeTerminalId);
      }
    }
  }
}
