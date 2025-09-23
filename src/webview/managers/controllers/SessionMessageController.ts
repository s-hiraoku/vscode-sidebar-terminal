import type { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import type { ManagerLogger } from '../../utils/ManagerLogger';
import {
  showSessionRestoreStarted,
  showSessionRestoreProgress,
  showSessionRestoreCompleted,
  showSessionRestoreError,
  showSessionSaved,
  showSessionSaveError,
  showSessionCleared,
  showSessionRestoreSkipped,
} from '../../utils/NotificationUtils';
import type { MessageCommand } from '../messageTypes';

interface SessionMessageControllerDeps {
  logger: ManagerLogger;
}

export class SessionMessageController {
  private readonly logger: ManagerLogger;

  constructor({ logger }: SessionMessageControllerDeps) {
    this.logger = logger;
  }

  async handleSessionRestoreMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    this.logger.info('Session restore message received');

    const terminalId = msg.terminalId as string;
    const terminalName = msg.terminalName as string;
    const config = msg.config;
    const sessionRestoreMessage = msg.sessionRestoreMessage as string;
    const sessionScrollback = msg.sessionScrollback as string[];

    if (!terminalId || !terminalName) {
      this.logger.error('Invalid session restore data received', { terminalId, terminalName });
      return;
    }

    this.logger.info(`Restoring terminal session: ${terminalId} (${terminalName})`);

    try {
      if (typeof (coordinator as unknown as { restoreSession?: unknown }).restoreSession === 'function') {
        const success = await (coordinator as unknown as {
          restoreSession: (payload: {
            terminalId: string;
            terminalName: string;
            scrollbackData?: string[];
            sessionRestoreMessage?: string;
          }) => Promise<boolean>;
        }).restoreSession({
          terminalId,
          terminalName,
          scrollbackData: sessionScrollback,
          sessionRestoreMessage,
        });

        if (success) {
          this.logger.info(`✅ Successfully restored terminal session: ${terminalId}`);
          return;
        }

        this.logger.warn(`⚠️ Session restore failed, creating regular terminal: ${terminalId}`);
      }

      await coordinator.createTerminal(terminalId, terminalName, config);
      this.logger.info(`Created terminal for session restore: ${terminalId}`);

      if (sessionRestoreMessage || (sessionScrollback && sessionScrollback.length > 0)) {
        setTimeout(() => {
          if (
            'restoreTerminalScrollback' in coordinator &&
            typeof (coordinator as unknown as {
              restoreTerminalScrollback: (
                terminalId: string,
                message: string,
                scrollback: string[]
              ) => void;
            }).restoreTerminalScrollback === 'function'
          ) {
            (coordinator as unknown as {
              restoreTerminalScrollback: (
                terminalId: string,
                message: string,
                scrollback: string[]
              ) => void;
            }).restoreTerminalScrollback(terminalId, sessionRestoreMessage || '', sessionScrollback || []);
            this.logger.info(`Restored scrollback for terminal: ${terminalId}`);
          } else {
            this.logger.warn('restoreTerminalScrollback method not found');
          }
        }, 100);
      }
    } catch (error) {
      this.logger.error(`Failed to restore terminal session ${terminalId}: ${String(error)}`);
      try {
        await coordinator.createTerminal(terminalId, terminalName, config);
        this.logger.info(`Created fallback terminal: ${terminalId}`);
      } catch (fallbackError) {
        this.logger.error(`Failed to create fallback terminal: ${String(fallbackError)}`);
      }
    }
  }

  handleSessionRestoreStartedMessage(msg: MessageCommand): void {
    const terminalCount = (msg.terminalCount as number) || 0;
    this.logger.info(`Session restore started for ${terminalCount} terminals`);
    showSessionRestoreStarted(terminalCount);
  }

  handleSessionRestoreProgressMessage(msg: MessageCommand): void {
    const restored = (msg.restored as number) || 0;
    const total = (msg.total as number) || 0;
    this.logger.info(`Session restore progress: ${restored}/${total}`);
    showSessionRestoreProgress(restored, total);
  }

  handleSessionRestoreCompletedMessage(msg: MessageCommand): void {
    const restoredCount = (msg.restoredCount as number) || 0;
    const skippedCount = (msg.skippedCount as number) || 0;
    this.logger.info(`Session restore completed: ${restoredCount} restored, ${skippedCount} skipped`);
    showSessionRestoreCompleted(restoredCount, skippedCount);
  }

  handleSessionRestoreErrorMessage(msg: MessageCommand): void {
    const error = (msg.error as string) || 'Unknown error';
    const partialSuccess = (msg.partialSuccess as boolean) || false;
    const errorType = (msg.errorType as string) || undefined;
    this.logger.error(`Session restore error: ${error} (partial: ${partialSuccess}, type: ${errorType})`);
    showSessionRestoreError(error, partialSuccess, errorType);
  }

  handleSessionSavedMessage(msg: MessageCommand): void {
    const terminalCount = (msg.terminalCount as number) || 0;
    this.logger.info(`Session saved with ${terminalCount} terminals`);
    showSessionSaved(terminalCount);
  }

  handleSessionSaveErrorMessage(msg: MessageCommand): void {
    const error = (msg.error as string) || 'Unknown error';
    this.logger.error(`Session save error: ${error}`);
    showSessionSaveError(error);
  }

  handleSessionClearedMessage(): void {
    this.logger.info('Session cleared');
    showSessionCleared();
  }

  handleSessionRestoredMessage(msg: MessageCommand): void {
    const success = msg.success as boolean;
    const restoredCount = (msg.restoredCount as number) || 0;
    const totalCount = (msg.totalCount as number) || 0;

    this.logger.info(
      `🔥 [RESTORE-DEBUG] Session restoration completed: success=${success}, restored=${restoredCount}/${totalCount}`
    );

    if (success) {
      this.logger.info(
        `✅ [RESTORE-DEBUG] Session restoration successful: ${restoredCount} terminals restored out of ${totalCount}`
      );
    } else {
      this.logger.warn(
        `⚠️ [RESTORE-DEBUG] Session restoration partially failed: only ${restoredCount} out of ${totalCount} terminals restored`
      );
    }
  }

  handleSessionRestoreSkippedMessage(msg: MessageCommand): void {
    const reason = (msg.reason as string) || 'Unknown reason';
    this.logger.info(`Session restore skipped: ${reason}`);
    showSessionRestoreSkipped(reason);
  }

  async handleTerminalRestoreErrorMessage(msg: MessageCommand): Promise<void> {
    const terminalName = (msg.terminalName as string) || 'Unknown terminal';
    const error = (msg.error as string) || 'Unknown error';
    this.logger.warn(`Terminal restore error: ${terminalName} - ${error}`);

    const { showTerminalRestoreError } = await import('../../utils/NotificationUtils');
    showTerminalRestoreError(terminalName, error);
  }
}
