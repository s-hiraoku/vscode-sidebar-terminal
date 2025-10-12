/**
 * Settings and Config Message Handler
 *
 * Handles settings, configuration, and state updates
 */

import { IMessageHandler } from './IMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { ManagerLogger } from '../../utils/ManagerLogger';
import { WebViewFontSettings } from '../../../types/shared';

/**
 * Settings and Config Message Handler
 *
 * Responsibilities:
 * - Font settings updates
 * - General settings configuration
 * - Version information management
 * - State updates from extension
 */
export class SettingsAndConfigMessageHandler implements IMessageHandler {
  constructor(private readonly logger: ManagerLogger) {}

  /**
   * Handle settings and config related messages
   */
  public handleMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const command = (msg as { command?: string }).command;

    switch (command) {
      case 'fontSettingsUpdate':
        this.handleFontSettingsUpdate(msg, coordinator);
        break;
      case 'settingsResponse':
        this.handleSettingsResponse(msg, coordinator);
        break;
      case 'openSettings':
        coordinator.openSettings();
        break;
      case 'versionInfo':
        this.handleVersionInfo(msg, coordinator);
        break;
      case 'stateUpdate':
        this.handleStateUpdate(msg, coordinator);
        break;
      default:
        this.logger.warn(`Unknown settings/config command: ${command}`);
    }
  }

  /**
   * Get supported command types
   */
  public getSupportedCommands(): string[] {
    return ['fontSettingsUpdate', 'settingsResponse', 'openSettings', 'versionInfo', 'stateUpdate'];
  }

  /**
   * Handle font settings update from extension
   */
  private handleFontSettingsUpdate(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    const fontSettings = msg.fontSettings as WebViewFontSettings;
    if (fontSettings) {
      this.logger.info('Font settings update received', fontSettings);
      coordinator.applyFontSettings(fontSettings);
      this.emitTerminalInteractionEvent('font-settings-update', '', fontSettings, coordinator);
    }
  }

  /**
   * Handle settings response from extension
   */
  private handleSettingsResponse(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    const settings = msg.settings;
    if (settings) {
      this.logger.info('Settings response received');
      if (typeof coordinator.applySettings === 'function') {
        coordinator.applySettings(settings);
      }
      this.emitTerminalInteractionEvent('settings-update', '', settings, coordinator);
    }
  }

  /**
   * Handle version info message from Extension
   */
  private handleVersionInfo(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const version = msg.version;
    if (version && typeof version === 'string' && typeof coordinator.setVersionInfo === 'function') {
      coordinator.setVersionInfo(version);
      this.logger.info(`Version info received: ${version}`);
    }
  }

  /**
   * Handle state update message
   */
  private handleStateUpdate(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const state = msg.state;
    if (state) {
      this.logger.info('State update received');

      if ('updateState' in coordinator && typeof coordinator.updateState === 'function') {
        coordinator.updateState(state);
      } else {
        this.logger.warn('updateState method not found on coordinator');
      }
    }
  }

  /**
   * Emit terminal interaction event
   */
  private emitTerminalInteractionEvent(
    eventType: string,
    terminalId: string,
    data: unknown,
    coordinator: IManagerCoordinator
  ): void {
    if (
      'emitTerminalInteractionEvent' in coordinator &&
      typeof coordinator.emitTerminalInteractionEvent === 'function'
    ) {
      coordinator.emitTerminalInteractionEvent(eventType, terminalId, data);
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // No resources to clean up
  }
}
