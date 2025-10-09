/**
 * Message Handler Interface
 *
 * All message handlers must implement this interface for consistent behavior
 */

import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';

/**
 * Base interface for message handlers
 */
export interface IMessageHandler {
  /**
   * Handle a message command
   * @param msg - The message command to handle
   * @param coordinator - The manager coordinator
   */
  handleMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void | Promise<void>;

  /**
   * Get the command types that this handler supports
   */
  getSupportedCommands(): string[];

  /**
   * Clean up resources
   */
  dispose(): void;
}
