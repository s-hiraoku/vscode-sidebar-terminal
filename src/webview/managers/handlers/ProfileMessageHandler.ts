/**
 * Profile Message Handler
 *
 * Handles terminal profile management messages
 *
 * Uses registry-based dispatch pattern instead of switch-case
 * for better maintainability and extensibility.
 */

import { IMessageHandler } from './IMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { ManagerLogger } from '../../utils/ManagerLogger';

/**
 * Handler function type
 */
type CommandHandler = (msg: MessageCommand, coordinator: IManagerCoordinator) => void;

/**
 * Profile Message Handler
 *
 * Responsibilities:
 * - Forward profile update messages to ProfileManager
 * - Handle default profile change notifications
 */
export class ProfileMessageHandler implements IMessageHandler {
  private readonly handlers: Map<string, CommandHandler>;

  constructor(private readonly logger: ManagerLogger) {
    this.handlers = this.buildHandlerRegistry();
  }

  /**
   * Build handler registry - replaces switch-case pattern
   */
  private buildHandlerRegistry(): Map<string, CommandHandler> {
    const registry = new Map<string, CommandHandler>();

    registry.set('showProfileSelector', (msg, coord) => this.handleShowProfileSelector(msg, coord));
    registry.set('profilesUpdated', (msg, coord) => this.handleProfilesUpdated(msg, coord));
    registry.set('defaultProfileChanged', (msg, coord) =>
      this.handleDefaultProfileChanged(msg, coord)
    );

    return registry;
  }

  /**
   * Handle profile related messages using registry dispatch
   */
  public handleMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const command = (msg as { command?: string }).command;

    if (!command) {
      this.logger.warn('Message received without command property');
      return;
    }

    const handler = this.handlers.get(command);
    if (handler) {
      handler(msg, coordinator);
    } else {
      this.logger.warn(`Unknown profile command: ${command}`);
    }
  }

  /**
   * Get supported command types
   */
  public getSupportedCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Handle show profile selector message
   */
  private handleShowProfileSelector(_msg: MessageCommand, coordinator: IManagerCoordinator): void {
    this.logger.info('Show profile selector');

    // Forward to ProfileManager if it exists
    const managers = coordinator.getManagers ? coordinator.getManagers() : ({} as any);
    const profileManager = managers.profile || (coordinator as any).profileManager;
    if (profileManager && typeof profileManager.showProfileSelector === 'function') {
      profileManager.showProfileSelector();
    } else {
      this.logger.warn('Profile manager not available to show selector');
    }
  }

  /**
   * Handle profiles updated message
   */
  private handleProfilesUpdated(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    this.logger.info('Profiles updated');

    // Forward to ProfileManager if it exists
    const managers = coordinator.getManagers();
    if (managers.profile) {
      managers.profile.handleMessage(msg);
    }
  }

  /**
   * Handle default profile changed message
   */
  private handleDefaultProfileChanged(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Default profile changed');

    // Forward to ProfileManager if it exists
    const managers = coordinator.getManagers();
    if (managers.profile) {
      managers.profile.handleMessage(msg);
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.handlers.clear();
  }
}
