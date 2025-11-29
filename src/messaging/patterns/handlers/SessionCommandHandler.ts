/**
 * Session Command Handler
 *
 * Handles session management commands (save, restore, clear).
 * Consolidates logic from:
 * - ConsolidatedMessageManager (session cases)
 * - SessionMessageController
 *
 * Related to: GitHub Issue #219
 */

import { WebviewMessage } from '../../../types/common';
import { BaseCommandHandler, IMessageHandlerContext } from '../core/IMessageHandler';

/**
 * Handler for session-related commands
 */
export class SessionCommandHandler extends BaseCommandHandler {
  constructor() {
    super(
      'SessionCommandHandler',
      [
        'sessionRestore',
        'sessionRestoreStarted',
        'sessionRestoreProgress',
        'sessionRestoreCompleted',
        'sessionRestoreError',
        'sessionRestoreSkipped',
        'sessionSaved',
        'sessionSaveError',
        'sessionCleared',
        'sessionRestored',
        'terminalRestoreError',
      ],
      60 // Medium-high priority for session operations
    );
  }

  public async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    const { command } = message;

    this.log(context, 'info', `Processing session command: ${command}`);

    switch (command) {
      case 'sessionRestore':
        await this.handleSessionRestore(message, context);
        break;

      case 'sessionRestoreStarted':
        this.handleSessionRestoreStarted(message, context);
        break;

      case 'sessionRestoreProgress':
        this.handleSessionRestoreProgress(message, context);
        break;

      case 'sessionRestoreCompleted':
        this.handleSessionRestoreCompleted(message, context);
        break;

      case 'sessionRestoreError':
        this.handleSessionRestoreError(message, context);
        break;

      case 'sessionRestoreSkipped':
        this.handleSessionRestoreSkipped(message, context);
        break;

      case 'sessionSaved':
        this.handleSessionSaved(message, context);
        break;

      case 'sessionSaveError':
        this.handleSessionSaveError(message, context);
        break;

      case 'sessionCleared':
        this.handleSessionCleared(context);
        break;

      case 'sessionRestored':
        this.handleSessionRestored(message, context);
        break;

      case 'terminalRestoreError':
        await this.handleTerminalRestoreError(message, context);
        break;

      default:
        this.log(context, 'warn', `Unknown session command: ${command}`);
    }
  }

  /**
   * Handle session restore command
   */
  private async handleSessionRestore(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const coordinator = context.coordinator;
    if (!coordinator) {
      throw new Error('Coordinator not available for session restore');
    }

    this.log(context, 'info', 'Starting session restore');

    const { terminals, activeTerminalId, config } = message as any;

    this.validateRequired(message, ['terminals']);

    // Delegate to coordinator's session restoration logic
    if (typeof (coordinator as any).restoreSession === 'function') {
      await (coordinator as any).restoreSession({
        terminals,
        activeTerminalId,
        config,
      });
    } else {
      this.log(context, 'warn', 'Session restore not implemented in coordinator');
    }
  }

  /**
   * Handle session restore started event
   */
  private handleSessionRestoreStarted(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): void {
    this.log(context, 'info', 'Session restore started');
    // Update UI or state to show restoration in progress
  }

  /**
   * Handle session restore progress event
   */
  private handleSessionRestoreProgress(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): void {
    const { progress, total } = message as any;
    this.log(context, 'debug', `Session restore progress: ${progress}/${total}`);
    // Update UI with progress
  }

  /**
   * Handle session restore completed event
   */
  private handleSessionRestoreCompleted(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): void {
    const { restoredCount } = message as any;
    this.log(context, 'info', `Session restore completed: ${restoredCount} terminals restored`);
    // Update UI to show completion
  }

  /**
   * Handle session restore error event
   */
  private handleSessionRestoreError(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): void {
    const { error } = message as any;
    this.log(context, 'error', 'Session restore failed', error);
    // Show error notification
  }

  /**
   * Handle session restore skipped event
   */
  private handleSessionRestoreSkipped(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): void {
    const { reason } = message as any;
    this.log(context, 'info', `Session restore skipped: ${reason || 'unknown reason'}`);
  }

  /**
   * Handle session saved event
   */
  private handleSessionSaved(message: WebviewMessage, context: IMessageHandlerContext): void {
    const { terminalCount } = message as any;
    this.log(context, 'info', `Session saved: ${terminalCount || 'unknown'} terminals`);
  }

  /**
   * Handle session save error event
   */
  private handleSessionSaveError(message: WebviewMessage, context: IMessageHandlerContext): void {
    const { error } = message as any;
    this.log(context, 'error', 'Session save failed', error);
  }

  /**
   * Handle session cleared event
   */
  private handleSessionCleared(context: IMessageHandlerContext): void {
    this.log(context, 'info', 'Session cleared');
  }

  /**
   * Handle session restored event
   */
  private handleSessionRestored(message: WebviewMessage, context: IMessageHandlerContext): void {
    const { terminals } = message as any;
    this.log(context, 'info', `Session restored with ${terminals?.length || 0} terminals`);
  }

  /**
   * Handle terminal restore error
   */
  private async handleTerminalRestoreError(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<void> {
    const { terminalId, error } = message as any;
    this.log(context, 'error', `Terminal restore error for ${terminalId}`, error);
  }
}
