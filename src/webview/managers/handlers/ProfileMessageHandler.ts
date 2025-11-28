/**
 * Profile Message Handler
 *
 * Handles terminal profile management messages
 */

import { IMessageHandler } from './IMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { ManagerLogger } from '../../utils/ManagerLogger';

/**
 * Profile Message Handler
 *
 * Responsibilities:
 * - Forward profile update messages to ProfileManager
 * - Handle default profile change notifications
 */
export class ProfileMessageHandler implements IMessageHandler {
  constructor(private readonly logger: ManagerLogger) {}

  /**
   * Handle profile related messages
   */
  public handleMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const command = (msg as { command?: string }).command;

    switch (command) {
      case 'showProfileSelector':
        this.handleShowProfileSelector(msg, coordinator);
        break;
      case 'profilesUpdated':
        this.handleProfilesUpdated(msg, coordinator);
        break;
      case 'defaultProfileChanged':
        this.handleDefaultProfileChanged(msg, coordinator);
        break;
      default:
        this.logger.warn(`Unknown profile command: ${command}`);
    }
  }

  /**
   * Get supported command types
   */
  public getSupportedCommands(): string[] {
    return ['showProfileSelector', 'profilesUpdated', 'defaultProfileChanged'];
  }

  /**
   * Handle show profile selector message
   */
  private handleShowProfileSelector(msg: MessageCommand, coordinator: IManagerCoordinator): void {
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
  private handleDefaultProfileChanged(msg: MessageCommand, coordinator: IManagerCoordinator): void {
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
    // No resources to clean up
  }
}
