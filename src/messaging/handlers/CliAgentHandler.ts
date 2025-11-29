/**
 * CLI Agent Handler
 *
 * Handles CLI Agent (Claude, Gemini) status updates and management.
 */

import { WebviewMessage } from '../../types/common';
import { IMessageHandlerContext, MessagePriority } from '../UnifiedMessageDispatcher';
import { BaseMessageHandler } from './BaseMessageHandler';

export class CliAgentHandler extends BaseMessageHandler {
  constructor() {
    super(
      ['cliAgentStatusUpdate', 'cliAgentFullStateSync', 'switchAiAgentResponse'],
      MessagePriority.HIGH
    );
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logActivity(context, `Processing CLI Agent message: ${message.command}`);

    try {
      switch (message.command) {
        case 'cliAgentStatusUpdate':
          await this.handleCliAgentStatusUpdate(message, context);
          break;
        case 'cliAgentFullStateSync':
          await this.handleCliAgentFullStateSync(message, context);
          break;
        case 'switchAiAgentResponse':
          await this.handleSwitchAiAgentResponse(message, context);
          break;
        default:
          context.logger.warn(`Unhandled CLI Agent command: ${message.command}`);
      }
    } catch (error) {
      this.handleError(context, message.command, error);
    }
  }

  /**
   * Handle CLI Agent status update message from extension
   */
  private async handleCliAgentStatusUpdate(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('CLI Agent Status Update received');

    const cliAgentStatus = message.cliAgentStatus;
    if (cliAgentStatus) {
      const statusData = cliAgentStatus as {
        status: 'connected' | 'disconnected' | 'none';
        activeTerminalName: string | null;
        agentType: string | null;
        terminalId?: string;
      };

      context.logger.info(
        `Processing status update: ${statusData.status} for ${statusData.activeTerminalName} (ID: ${statusData.terminalId})`
      );

      try {
        // Use terminalId directly if available, fallback to extracting from name
        let terminalId: string;

        if (statusData.terminalId) {
          terminalId = statusData.terminalId;
          context.logger.debug(`Using provided terminalId: ${terminalId}`);
        } else if (statusData.activeTerminalName) {
          terminalId = statusData.activeTerminalName.replace('Terminal ', '') || '1';
          context.logger.debug(`Extracted terminalId from name: ${terminalId}`);
        } else {
          const allTerminals = context.coordinator.getAllTerminalInstances();
          const connectedTerminal = Array.from(allTerminals.keys())[0];
          terminalId = connectedTerminal || '1';
          context.logger.warn(`Using fallback terminalId: ${terminalId}`);
        }

        // Map legacy status to new status format
        const mappedStatus = this.mapLegacyStatus(statusData.status);

        // Call the centralized status management method
        context.coordinator.updateCliAgentStatus(
          terminalId,
          mappedStatus,
          statusData.agentType || null
        );

        context.logger.info(
          `CLI Agent status updated successfully: ${mappedStatus} for terminal ${terminalId}`
        );
      } catch (error) {
        context.logger.error('Error updating CLI Agent status', error);
      }
    } else {
      context.logger.warn('No CLI Agent status data in message');
    }
  }

  /**
   * Handle full CLI Agent state sync message from extension
   */
  private async handleCliAgentFullStateSync(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('CLI Agent Full State Sync received');

    const terminalStates = message.terminalStates;
    const connectedAgentId = message.connectedAgentId;
    const connectedAgentType = message.connectedAgentType;
    const disconnectedCount = message.disconnectedCount;

    context.logger.debug('Full state sync data', {
      terminalStates,
      connectedAgentId,
      connectedAgentType,
      disconnectedCount,
    });

    if (terminalStates) {
      context.logger.info(
        `Processing full state sync: CONNECTED=${String(connectedAgentId)} (${String(connectedAgentType)}), DISCONNECTED=${String(disconnectedCount)}`
      );

      try {
        for (const [terminalId, stateInfo] of Object.entries(terminalStates)) {
          const typedStateInfo = stateInfo as {
            status: 'connected' | 'disconnected' | 'none';
            agentType: string | null;
          };

          context.logger.debug(`Updating terminal ${terminalId}`, typedStateInfo);

          try {
            context.coordinator.updateCliAgentStatus(
              terminalId,
              typedStateInfo.status,
              typedStateInfo.agentType
            );

            context.logger.debug(
              `Applied state: Terminal ${terminalId} -> ${typedStateInfo.status} (${typedStateInfo.agentType})`
            );
          } catch (error) {
            context.logger.error(`Error updating terminal ${terminalId}`, error);
          }
        }

        context.logger.info('Full CLI Agent state sync completed successfully');
      } catch (error) {
        context.logger.error('Error during full state sync', error);
      }
    } else {
      context.logger.warn('No terminal states data in full state sync message');
    }
  }

  /**
   * Handle AI Agent toggle response from extension
   */
  private async handleSwitchAiAgentResponse(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const responseData = message as any;
    const { terminalId, success, newStatus, agentType, reason, isForceReconnect } = responseData;

    context.logger.info(`AI Agent operation result for terminal ${terminalId}:`, {
      success,
      newStatus,
      agentType,
      isForceReconnect,
      reason,
    });

    // Update UI and show user feedback
    const managers = context.coordinator.getManagers();
    if (!managers?.notification) {
      context.logger.warn('NotificationManager not available for AI Agent feedback');
      return;
    }

    if (success) {
      // Only show subtle success notification for successful operations
      if (isForceReconnect) {
        const statusText = newStatus === 'connected' ? 'Connected' : 'Disconnected';
        managers.notification.showNotificationInTerminal(`📎 AI Agent ${statusText}`, 'success');
      }
      // No notification for regular switch operations - keep it quiet

      context.logger.info(`AI Agent operation succeeded:`, {
        terminalId,
        newStatus,
        agentType,
        isForceReconnect,
      });
    } else {
      // Only show error notifications - users need to know about failures
      managers.notification.showNotificationInTerminal(`❌ AI Agent operation failed`, 'error');

      context.logger.error(`AI Agent operation failed:`, {
        terminalId,
        reason,
        isForceReconnect,
      });
    }
  }

  /**
   * Map legacy status values to new status format
   */
  private mapLegacyStatus(legacyStatus: string): 'connected' | 'disconnected' | 'none' {
    switch (legacyStatus.toLowerCase()) {
      case 'connected':
        return 'connected';
      case 'disconnected':
        return 'disconnected';
      case 'none':
      case 'inactive':
      case 'terminated':
        return 'none';
      default:
        this.logActivity(
          undefined as any,
          `Unknown legacy status: ${legacyStatus}, defaulting to 'none'`
        );
        return 'none';
    }
  }
}
