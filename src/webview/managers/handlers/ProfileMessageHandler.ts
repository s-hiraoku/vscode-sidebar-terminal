/**
 * Profile Message Handler
 *
 * Handles terminal profile management messages
 *
 * Refactored to extend RegistryBasedMessageHandler for consistent patterns.
 */

import { RegistryBasedMessageHandler } from './BaseMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { MessageQueue } from '../../utils/MessageQueue';
import { ManagerLogger } from '../../utils/ManagerLogger';

/**
 * Profile Message Handler
 *
 * Responsibilities:
 * - Forward profile update messages to ProfileManager
 * - Handle default profile change notifications
 */
export class ProfileMessageHandler extends RegistryBasedMessageHandler {
  constructor(messageQueue: MessageQueue, logger: ManagerLogger) {
    super(messageQueue, logger);
  }

  /**
   * Register all handlers using the base class pattern
   */
  protected registerHandlers(): void {
    this.registerCommands({
      showProfileSelector: (msg, coord) => this.handleShowProfileSelector(msg, coord),
      profilesUpdated: (msg, coord) => this.handleProfilesUpdated(msg, coord),
      defaultProfileChanged: (msg, coord) => this.handleDefaultProfileChanged(msg, coord),
    }, { category: 'profile' });
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
}
