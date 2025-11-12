import * as vscode from 'vscode';
import { BaseMessageHandler } from './BaseMessageHandler';
import { IMessageHandlerContext } from '../interfaces';
import { WebviewMessage } from '../../../types/common';
import { provider as log } from '../../../utils/logger';

/**
 * Handles panel location reporting from WebView
 * Issue #148: Dynamic split direction based on panel location
 */
export class PanelLocationHandler extends BaseMessageHandler {
  protected readonly supportedCommands = ['reportPanelLocation'];

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logMessageHandling(message, 'PanelLocation');

    const location = (message as any).location;
    if (location !== 'sidebar' && location !== 'panel') {
      log('⚠️ [PanelLocation] Invalid or missing panel location');
      return;
    }

    try {
      log(`📍 [PanelLocation] Panel location reported from WebView: ${location}`);

      // Update context key for VS Code when clause
      await vscode.commands.executeCommand('setContext', 'secondaryTerminal.panelLocation', location);
      log('📍 [PanelLocation] Context key updated with panel location:', location);

      // Notify WebView of the panel location (keeps behavior consistent)
      await context.sendMessage({
        command: 'panelLocationUpdate',
        location: location,
      });
      log('📍 [PanelLocation] Panel location update sent to WebView:', location);
    } catch (error) {
      await this.handleError(error, message, 'PanelLocation');
    }
  }
}
