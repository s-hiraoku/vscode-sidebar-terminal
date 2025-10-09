/**
 * Split Handler
 *
 * Handles terminal split operations
 */

import { IMessageHandler } from './IMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { ManagerLogger } from '../../utils/ManagerLogger';

/**
 * Split Handler
 *
 * Responsibilities:
 * - Handle split terminal commands
 * - Coordinate with SplitManager for terminal splitting
 */
export class SplitHandler implements IMessageHandler {
  constructor(private readonly logger: ManagerLogger) {}

  /**
   * Handle split related messages
   */
  public handleMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const command = (msg as { command?: string }).command;

    if (command === 'split') {
      this.handleSplit(msg, coordinator);
    } else {
      this.logger.warn(`Unknown split command: ${command}`);
    }
  }

  /**
   * Get supported command types
   */
  public getSupportedCommands(): string[] {
    return ['split'];
  }

  /**
   * Handle split command from Extension
   * This sets the split direction before terminal creation
   */
  private handleSplit(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    try {
      const direction = (msg as { direction?: string }).direction as 'horizontal' | 'vertical' | undefined;
      this.logger.info(`🔀 [WEBVIEW] ==================== SPLIT COMMAND ====================`);
      this.logger.info(`🔀 [WEBVIEW] Received split command with direction: ${direction || 'auto'}`);

      // Get split manager from coordinator
      const splitManager = (coordinator as { getSplitManager?: () => unknown }).getSplitManager?.();
      if (!splitManager) {
        this.logger.warn('⚠️ [WEBVIEW] SplitManager not available on coordinator');
        return;
      }

      // Call splitTerminal with the direction
      if (direction) {
        this.logger.info(`🔀 [WEBVIEW] Calling splitTerminal with direction: ${direction}`);
        (splitManager as { splitTerminal: (direction: 'horizontal' | 'vertical') => void }).splitTerminal(direction);
      } else {
        this.logger.info(`🔀 [WEBVIEW] Calling splitTerminal with default direction`);
        (splitManager as { splitTerminal: (direction: 'horizontal' | 'vertical') => void }).splitTerminal('vertical'); // Default
      }

      this.logger.info(`🔀 [WEBVIEW] ===========================================================`);
    } catch (error) {
      this.logger.error('Error handling split message', error);
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // No resources to clean up
  }
}
