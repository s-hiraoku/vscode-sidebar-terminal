/**
 * Settings and Config Message Handler
 *
 * Handles settings, configuration, and state updates
 *
 * Uses registry-based dispatch pattern instead of switch-case
 * for better maintainability and extensibility.
 */

import { IMessageHandler } from './IMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { ManagerLogger } from '../../utils/ManagerLogger';
import { WebViewFontSettings } from '../../../types/shared';

/**
 * Handler function type
 */
type CommandHandler = (msg: MessageCommand, coordinator: IManagerCoordinator) => void;

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
  private readonly handlers: Map<string, CommandHandler>;

  constructor(private readonly logger: ManagerLogger) {
    this.handlers = this.buildHandlerRegistry();
  }

  /**
   * Build handler registry - replaces switch-case pattern
   */
  private buildHandlerRegistry(): Map<string, CommandHandler> {
    const registry = new Map<string, CommandHandler>();

    registry.set('fontSettingsUpdate', (msg, coord) => this.handleFontSettingsUpdate(msg, coord));
    registry.set('settingsResponse', (msg, coord) => this.handleSettingsResponse(msg, coord));
    registry.set('openSettings', (_msg, coord) => coord.openSettings());
    registry.set('versionInfo', (msg, coord) => this.handleVersionInfo(msg, coord));
    registry.set('stateUpdate', (msg, coord) => this.handleStateUpdate(msg, coord));

    return registry;
  }

  /**
   * Handle settings and config related messages using registry dispatch
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
      this.logger.warn(`Unknown settings/config command: ${command}`);
    }
  }

  /**
   * Get supported command types
   */
  public getSupportedCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Handle font settings update from extension
   */
  private handleFontSettingsUpdate(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const fontSettings = msg.fontSettings as WebViewFontSettings;

    // 🔍 DEBUG: Log the entire message to see what's being received
    this.logger.info('🔤 [FONT-DEBUG] Raw message received:', JSON.stringify(msg));
    this.logger.info('🔤 [FONT-DEBUG] fontSettings extracted:', JSON.stringify(fontSettings));

    if (fontSettings) {
      this.logger.info('🔤 [FONT-DEBUG] Applying font settings:', {
        fontFamily: fontSettings.fontFamily,
        fontSize: fontSettings.fontSize,
        fontWeight: fontSettings.fontWeight,
        lineHeight: fontSettings.lineHeight,
      });
      coordinator.applyFontSettings(fontSettings);
      this.emitTerminalInteractionEvent('font-settings-update', '', fontSettings, coordinator);
    } else {
      this.logger.warn('🔤 [FONT-DEBUG] No fontSettings in message!');
    }
  }

  /**
   * Handle settings response from extension
   */
  private handleSettingsResponse(msg: MessageCommand, coordinator: IManagerCoordinator): void {
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
    if (
      version &&
      typeof version === 'string' &&
      typeof coordinator.setVersionInfo === 'function'
    ) {
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
    this.handlers.clear();
  }
}
