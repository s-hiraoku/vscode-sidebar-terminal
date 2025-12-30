/**
 * Session Handler
 *
 * Handles session management messages including restoration,
 * scrollback management, and session persistence.
 */

import { WebviewMessage } from '../../types/common';
import { IMessageHandlerContext, MessagePriority } from '../UnifiedMessageDispatcher';
import { BaseMessageHandler } from './BaseMessageHandler';

// Import session notification utilities
import {
  showSessionRestoreStarted,
  showSessionRestoreProgress,
  showSessionRestoreCompleted,
  showSessionRestoreError,
  showSessionSaved,
  showSessionSaveError,
  showSessionCleared,
  showSessionRestoreSkipped,
} from '../../webview/utils/NotificationUtils';

export class SessionHandler extends BaseMessageHandler {
  constructor() {
    super(
      [
        'sessionRestore',
        'sessionRestoreStarted',
        'sessionRestoreProgress',
        'sessionRestoreCompleted',
        'sessionRestoreError',
        'sessionSaved',
        'sessionSaveError',
        'sessionCleared',
        'sessionRestoreSkipped',
        'getScrollback',
        'restoreScrollback',
        'scrollbackProgress',
        'terminalRestoreError',
      ],
      MessagePriority.HIGH
    );
  }

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logActivity(context, `Processing session message: ${message.command}`);

    try {
      switch (message.command) {
        case 'sessionRestore':
          await this.handleSessionRestore(message, context);
          break;
        case 'sessionRestoreStarted':
          await this.handleSessionRestoreStarted(message, context);
          break;
        case 'sessionRestoreProgress':
          await this.handleSessionRestoreProgress(message, context);
          break;
        case 'sessionRestoreCompleted':
          await this.handleSessionRestoreCompleted(message, context);
          break;
        case 'sessionRestoreError':
          await this.handleSessionRestoreError(message, context);
          break;
        case 'sessionSaved':
          await this.handleSessionSaved(message, context);
          break;
        case 'sessionSaveError':
          await this.handleSessionSaveError(message, context);
          break;
        case 'sessionCleared':
          await this.handleSessionCleared(message, context);
          break;
        case 'sessionRestoreSkipped':
          await this.handleSessionRestoreSkipped(message, context);
          break;
        case 'getScrollback':
          await this.handleGetScrollback(message, context);
          break;
        case 'restoreScrollback':
          await this.handleRestoreScrollback(message, context);
          break;
        case 'scrollbackProgress':
          await this.handleScrollbackProgress(message, context);
          break;
        case 'terminalRestoreError':
          await this.handleTerminalRestoreError(message, context);
          break;
        default:
          context.logger.warn(`Unhandled session command: ${message.command}`);
      }
    } catch (error) {
      this.handleError(context, message.command, error);
    }
  }

  /**
   * Handle session restore message from extension
   */
  private async handleSessionRestore(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('Session restore message received');

    const terminalId = message.terminalId as string;
    const terminalName = message.terminalName as string;
    const config = message.config;
    const sessionRestoreMessage = message.sessionRestoreMessage as string;
    const sessionScrollback = message.sessionScrollback as string[];

    if (terminalId && terminalName && config) {
      context.logger.info(`Restoring terminal session: ${terminalId} (${terminalName})`);

      try {
        // Create terminal normally, then restore scrollback
        await context.coordinator.createTerminal(terminalId, terminalName, config);
        context.logger.info(`Created terminal for session restore: ${terminalId}`);

        // Restore scrollback data after a brief delay
        if (sessionRestoreMessage || (sessionScrollback && sessionScrollback.length > 0)) {
          setTimeout(() => {
            if (
              'restoreTerminalScrollback' in context.coordinator &&
              typeof context.coordinator.restoreTerminalScrollback === 'function'
            ) {
              context.coordinator.restoreTerminalScrollback(
                terminalId,
                sessionRestoreMessage || '',
                sessionScrollback || []
              );
              context.logger.info(`Restored scrollback for terminal: ${terminalId}`);
            } else {
              context.logger.warn('restoreTerminalScrollback method not found');
            }
          }, 100);
        }
      } catch (error) {
        context.logger.error(`Failed to restore terminal session ${terminalId}: ${String(error)}`);
        // Continue with regular terminal creation as fallback
        await context.coordinator.createTerminal(terminalId, terminalName, config);
      }
    } else {
      context.logger.error('Invalid session restore data received');
    }
  }

  /**
   * Session restore notification handlers
   */
  private async handleSessionRestoreStarted(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const terminalCount = (message.terminalCount as number) || 0;
    context.logger.info(`Session restore started for ${terminalCount} terminals`);
    showSessionRestoreStarted(terminalCount);
  }

  private async handleSessionRestoreProgress(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const restored = (message.restored as number) || 0;
    const total = (message.total as number) || 0;
    context.logger.info(`Session restore progress: ${restored}/${total}`);
    showSessionRestoreProgress(restored, total);
  }

  private async handleSessionRestoreCompleted(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const restoredCount = (message.restoredCount as number) || 0;
    const skippedCount = (message.skippedCount as number) || 0;
    context.logger.info(
      `Session restore completed: ${restoredCount} restored, ${skippedCount} skipped`
    );
    showSessionRestoreCompleted(restoredCount, skippedCount);
  }

  private async handleSessionRestoreError(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const error = (message.error as string) || 'Unknown error';
    const partialSuccess = (message.partialSuccess as boolean) || false;
    const errorType = (message.errorType as string) || undefined;
    context.logger.error(
      `Session restore error: ${error} (partial: ${partialSuccess}, type: ${errorType})`
    );
    showSessionRestoreError(error, partialSuccess, errorType);
  }

  private async handleSessionSaved(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const terminalCount = (message.terminalCount as number) || 0;
    context.logger.info(`Session saved with ${terminalCount} terminals`);
    showSessionSaved(terminalCount);
  }

  private async handleSessionSaveError(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const error = (message.error as string) || 'Unknown error';
    context.logger.error(`Session save error: ${error}`);
    showSessionSaveError(error);
  }

  private async handleSessionCleared(
    _message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('Session cleared');
    showSessionCleared();
  }

  private async handleSessionRestoreSkipped(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const reason = (message.reason as string) || 'Unknown reason';
    context.logger.info(`Session restore skipped: ${reason}`);
    showSessionRestoreSkipped(reason);
  }

  private async handleTerminalRestoreError(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const terminalName = (message.terminalName as string) || 'Unknown terminal';
    const error = (message.error as string) || 'Unknown error';
    context.logger.warn(`Terminal restore error: ${terminalName} - ${error}`);

    // Use try-catch to handle potential circular dependency
    try {
      const notificationUtils = require('../../webview/utils/NotificationUtils');
      if (notificationUtils.showTerminalRestoreError) {
        notificationUtils.showTerminalRestoreError(terminalName, error);
      }
    } catch (importError) {
      context.logger.error('Failed to show terminal restore error notification:', importError);
    }
  }

  /**
   * Handle scrollback extraction request
   */
  private async handleGetScrollback(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('Handling get scrollback message');

    const terminalId = message.terminalId as string;
    const maxLines = (message.maxLines as number) || 1000;

    if (!terminalId) {
      context.logger.error('No terminal ID provided for scrollback extraction');
      return;
    }

    // Get terminal instance instead of element
    const terminalInstance = context.coordinator.getTerminalInstance(terminalId);
    if (!terminalInstance) {
      context.logger.error(`Terminal instance not found for ID: ${terminalId}`);
      return;
    }

    try {
      // Extract scrollback from xterm.js
      const scrollbackContent = this.extractScrollbackFromXterm(
        context,
        terminalInstance.terminal,
        maxLines
      );

      // Send scrollback data back to extension
      await context.postMessage({
        command: 'scrollbackExtracted',
        terminalId,
        scrollbackContent,
        timestamp: Date.now(),
      });

      context.logger.info(
        `Scrollback extracted for terminal ${terminalId}: ${scrollbackContent.length} lines`
      );
    } catch (error) {
      context.logger.error(
        `Error extracting scrollback: ${error instanceof Error ? error.message : String(error)}`
      );

      await context.postMessage({
        command: 'error',
        error: `Failed to extract scrollback: ${error instanceof Error ? error.message : String(error)}`,
        terminalId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle scrollback restoration request
   */
  private async handleRestoreScrollback(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('Handling restore scrollback message');

    const terminalId = message.terminalId as string;
    const scrollbackContent = message.scrollbackContent as Array<{
      content: string;
      type?: 'output' | 'input' | 'error';
      timestamp?: number;
    }>;

    if (!terminalId || !scrollbackContent) {
      context.logger.error('Invalid scrollback restore request');
      return;
    }

    try {
      // Get terminal instance
      const terminalInstance = context.coordinator.getTerminalInstance(terminalId);
      if (!terminalInstance) {
        throw new Error(`Terminal instance not found for ID: ${terminalId}`);
      }

      // Restore scrollback to the terminal
      this.restoreScrollbackToXterm(context, terminalInstance.terminal, scrollbackContent);

      // Send confirmation back to extension
      await context.postMessage({
        command: 'scrollbackRestored',
        terminalId,
        restoredLines: scrollbackContent.length,
        timestamp: Date.now(),
      });

      context.logger.info(
        `Scrollback restored for terminal ${terminalId}: ${scrollbackContent.length} lines`
      );
    } catch (error) {
      context.logger.error(
        `Error restoring scrollback: ${error instanceof Error ? error.message : String(error)}`
      );

      await context.postMessage({
        command: 'error',
        error: `Failed to restore scrollback: ${error instanceof Error ? error.message : String(error)}`,
        terminalId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle scrollback progress updates
   */
  private async handleScrollbackProgress(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    context.logger.info('Handling scrollback progress message');

    const progressInfo = message.scrollbackProgress as {
      terminalId: string;
      progress: number;
      currentLines: number;
      totalLines: number;
      stage: 'loading' | 'decompressing' | 'restoring';
    };

    if (!progressInfo) {
      context.logger.error('No progress information provided');
      return;
    }

    // Show progress notification
    context.logger.info(
      `Scrollback progress: ${progressInfo.progress}% (${progressInfo.currentLines}/${progressInfo.totalLines})`
    );
  }

  /**
   * Extract scrollback content from xterm terminal (improved version)
   */
  private extractScrollbackFromXterm(
    context: IMessageHandlerContext,
    terminal: any,
    maxLines: number
  ): Array<{ content: string; type?: 'output' | 'input' | 'error'; timestamp?: number }> {
    this.logActivity(
      context,
      `Extracting scrollback from xterm terminal (max ${maxLines} lines)`
    );

    if (!terminal) {
      throw new Error('Terminal instance not provided');
    }

    const scrollbackLines: Array<{
      content: string;
      type?: 'output' | 'input' | 'error';
      timestamp?: number;
    }> = [];

    try {
      // Get active buffer from xterm.js
      const buffer = terminal.buffer.active;
      const bufferLength = buffer.length;
      const viewportY = buffer.viewportY;
      const baseY = buffer.baseY;

      this.logActivity(
        context,
        `Buffer info: length=${bufferLength}, viewportY=${viewportY}, baseY=${baseY}`
      );

      // Calculate range to extract (include scrollback + viewport)
      const startLine = Math.max(0, bufferLength - maxLines);
      const endLine = bufferLength;

      this.logActivity(
        context,
        `Extracting lines ${startLine} to ${endLine} (${endLine - startLine} lines)`
      );

      for (let i = startLine; i < endLine; i++) {
        try {
          const line = buffer.getLine(i);
          if (line) {
            const content = line.translateToString(true); // trim whitespace

            // Include non-empty lines and preserve some empty lines for structure
            if (content.trim() || scrollbackLines.length > 0) {
              scrollbackLines.push({
                content: content,
                type: 'output',
                timestamp: Date.now(),
              });
            }
          }
        } catch (lineError) {
          this.logActivity(context, `Error extracting line ${i}: ${String(lineError)}`);
          continue;
        }
      }

      // Remove trailing empty lines
      while (scrollbackLines.length > 0) {
        const lastLine = scrollbackLines[scrollbackLines.length - 1];
        if (!lastLine || !lastLine.content.trim()) {
          scrollbackLines.pop();
        } else {
          break;
        }
      }

      this.logActivity(
        context,
        `Successfully extracted ${scrollbackLines.length} lines from terminal buffer`
      );
    } catch (error) {
      this.logActivity(context, `Error accessing terminal buffer: ${String(error)}`);
      throw error;
    }

    return scrollbackLines;
  }

  /**
   * Restore scrollback content to xterm terminal
   */
  private restoreScrollbackToXterm(
    context: IMessageHandlerContext,
    terminal: any,
    scrollbackContent: Array<{
      content: string;
      type?: 'output' | 'input' | 'error';
      timestamp?: number;
    }>
  ): void {
    this.logActivity(context, `Restoring ${scrollbackContent.length} lines to terminal`);

    if (!terminal) {
      throw new Error('Terminal instance not provided');
    }

    // Write each line to the terminal
    for (const line of scrollbackContent) {
      terminal.writeln(line.content);
    }

    this.logActivity(context, `Restored ${scrollbackContent.length} lines to terminal`);
  }
}
