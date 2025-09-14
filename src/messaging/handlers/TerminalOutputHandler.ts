/**
 * Terminal Output Handler
 *
 * Handles terminal output messages with performance optimizations
 * for CLI Agent and standard terminal operations.
 */

import { WebviewMessage } from '../../types/common';
import { IMessageHandlerContext, MessagePriority } from '../UnifiedMessageDispatcher';
import { BaseMessageHandler } from './BaseMessageHandler';

export class TerminalOutputHandler extends BaseMessageHandler {
  constructor() {
    super(['output'], MessagePriority.NORMAL);
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logActivity(context, `Processing output message`);

    try {
      this.validateMessage(message, ['data', 'terminalId']);

      const data = message.data as string;
      const terminalId = message.terminalId as string;

      // Critical validation for output message handling
      if (!data || !terminalId) {
        context.logger.error('Invalid output message - missing data or terminalId', {
          hasData: !!data,
          hasTerminalId: !!terminalId,
          terminalId: terminalId,
        });
        return;
      }

      if (typeof terminalId !== 'string' || terminalId.trim() === '') {
        context.logger.error('Invalid terminalId format', terminalId);
        return;
      }

      // Validate terminal exists before processing output
      const terminal = context.coordinator.getTerminalInstance(terminalId);
      if (!terminal) {
        context.logger.error(`Output for non-existent terminal: ${terminalId}`, {
          availableTerminals: Array.from(context.coordinator.getAllTerminalInstances().keys()),
        });
        return;
      }

      this.logActivity(
        context,
        `OUTPUT message received for terminal ${terminal.name} (${terminalId}): ${data.length} chars`
      );

      // Log significant CLI agent patterns for optimization
      if (
        data.length > 2000 &&
        (data.includes('Gemini') || data.includes('gemini') || data.includes('Claude'))
      ) {
        context.logger.info(`CLI Agent output detected for terminal ${terminal.name}`, {
          terminalId,
          terminalName: terminal.name,
          dataLength: data.length,
          containsGeminiPattern: data.includes('Gemini') || data.includes('gemini'),
          containsClaudePattern: data.includes('Claude') || data.includes('claude'),
        });
      }

      try {
        // Use PerformanceManager for buffered write with scroll preservation
        const managers = context.coordinator.getManagers();
        if (managers && managers.performance) {
          managers.performance.bufferedWrite(data, terminal.terminal, terminalId);
          this.logActivity(
            context,
            `Output buffered via PerformanceManager for ${terminal.name}: ${data.length} chars`
          );
        } else {
          // Fallback to direct write if performance manager is not available
          terminal.terminal.write(data);
          this.logActivity(
            context,
            `Output written directly to ${terminal.name}: ${data.length} chars`
          );
        }
      } catch (error) {
        this.handleError(
          context,
          message.command,
          `Error writing output to terminal ${terminal.name}: ${error}`
        );
      }
    } catch (error) {
      this.handleError(context, message.command, error);
    }
  }
}
