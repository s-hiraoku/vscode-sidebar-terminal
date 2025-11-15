/**
 * Settings Command Handler
 *
 * Handles settings and configuration commands.
 * Consolidates logic from:
 * - ConsolidatedMessageManager (settings cases)
 * - SettingsAndConfigMessageHandler
 *
 * Related to: GitHub Issue #219
 */

import { WebviewMessage } from '../../../types/common';
import { BaseCommandHandler, IMessageHandlerContext } from '../core/IMessageHandler';

/**
 * Handler for settings-related commands
 */
export class SettingsCommandHandler extends BaseCommandHandler {
  constructor() {
    super(
      'SettingsCommandHandler',
      [
        'fontSettingsUpdate',
        'settingsResponse',
        'openSettings',
        'versionInfo',
        'stateUpdate',
      ],
      50 // Normal priority for settings operations
    );
  }

  public async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    const { command } = message;
    const coordinator = context.coordinator;

    if (!coordinator) {
      throw new Error('Coordinator not available for settings operations');
    }

    this.log(context, 'info', `Processing settings command: ${command}`);

    switch (command) {
      case 'fontSettingsUpdate':
        await this.handleFontSettingsUpdate(message, coordinator, context);
        break;

      case 'settingsResponse':
        await this.handleSettingsResponse(message, coordinator, context);
        break;

      case 'openSettings':
        await this.handleOpenSettings(coordinator, context);
        break;

      case 'versionInfo':
        await this.handleVersionInfo(message, context);
        break;

      case 'stateUpdate':
        await this.handleStateUpdate(message, coordinator, context);
        break;

      default:
        this.log(context, 'warn', `Unknown settings command: ${command}`);
    }
  }

  /**
   * Handle font settings update
   */
  private async handleFontSettingsUpdate(
    message: WebviewMessage,
    coordinator: any,
    context: IMessageHandlerContext
  ): Promise<void> {
    const { fontSize, fontFamily, lineHeight } = message as any;

    this.log(context, 'info', 'Updating font settings', {
      fontSize,
      fontFamily,
      lineHeight,
    });

    // Apply font settings to all terminals
    const terminals = coordinator.getAllTerminals?.() || [];
    for (const terminal of terminals) {
      if (terminal.terminal) {
        const options: any = {};

        if (fontSize !== undefined) {
          options.fontSize = fontSize;
        }
        if (fontFamily !== undefined) {
          options.fontFamily = fontFamily;
        }
        if (lineHeight !== undefined) {
          options.lineHeight = lineHeight;
        }

        terminal.terminal.options = {
          ...terminal.terminal.options,
          ...options,
        };
      }
    }
  }

  /**
   * Handle settings response from extension
   */
  private async handleSettingsResponse(
    message: WebviewMessage,
    coordinator: any,
    context: IMessageHandlerContext
  ): Promise<void> {
    const { settings } = message as any;

    this.log(context, 'debug', 'Received settings response', settings);

    // Apply settings to webview state
    if (typeof coordinator.applySettings === 'function') {
      coordinator.applySettings(settings);
    }
  }

  /**
   * Handle open settings command
   */
  private async handleOpenSettings(coordinator: any, context: IMessageHandlerContext): Promise<void> {
    this.log(context, 'info', 'Opening settings');

    // Request to open VS Code settings
    if (context.postMessage) {
      context.postMessage({
        command: 'openSettingsRequested',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle version info update
   */
  private async handleVersionInfo(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const { version, buildDate } = message as any;

    this.log(context, 'debug', 'Version info received', {
      version,
      buildDate,
    });

    // Update UI with version information
    // This could be stored in coordinator state
  }

  /**
   * Handle state update
   */
  private async handleStateUpdate(
    message: WebviewMessage,
    coordinator: any,
    context: IMessageHandlerContext
  ): Promise<void> {
    const { state } = message as any;

    this.log(context, 'debug', 'State update received', state);

    // Update webview state
    if (typeof coordinator.updateState === 'function') {
      coordinator.updateState(state);
    }
  }
}
