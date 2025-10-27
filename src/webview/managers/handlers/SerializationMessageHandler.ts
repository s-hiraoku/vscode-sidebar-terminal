/**
 * Serialization Message Handler
 *
 * Handles terminal state serialization and restoration
 */

import { IMessageHandler } from './IMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { ManagerLogger } from '../../utils/ManagerLogger';

/**
 * Serialization Message Handler
 *
 * Responsibilities:
 * - Serialize terminal content and state
 * - Restore serialized terminal content
 * - Handle terminal restore information
 * - Save all terminal sessions
 */
export class SerializationMessageHandler implements IMessageHandler {
  private cachedTerminalRestoreInfo: {
    terminals: Array<Record<string, unknown>>;
    activeTerminalId: string | null;
    config?: unknown;
    timestamp: number;
  } | null = null;

  constructor(private readonly logger: ManagerLogger) {}

  /**
   * Handle serialization related messages
   */
  public async handleMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    const command = (msg as { command?: string }).command;

    switch (command) {
      case 'serializeTerminal':
        this.handleSerializeTerminal(msg, coordinator);
        break;
      case 'restoreSerializedContent':
        this.handleRestoreSerializedContent(msg, coordinator);
        break;
      case 'requestTerminalSerialization':
        this.handleRequestTerminalSerialization(msg, coordinator);
        break;
      case 'restoreTerminalSerialization':
        this.handleRestoreTerminalSerialization(msg, coordinator);
        break;
      case 'terminalRestoreInfo':
        this.handleTerminalRestoreInfo(msg, coordinator);
        break;
      case 'saveAllTerminalSessions':
        this.handleSaveAllTerminalSessions(msg, coordinator);
        break;
      default:
        this.logger.warn(`Unknown serialization command: ${command}`);
    }
  }

  /**
   * Get supported command types
   */
  public getSupportedCommands(): string[] {
    return [
      'serializeTerminal',
      'restoreSerializedContent',
      'requestTerminalSerialization',
      'restoreTerminalSerialization',
      'terminalRestoreInfo',
      'saveAllTerminalSessions',
    ];
  }

  /**
   * Handle serialize terminal request (single terminal)
   */
  private handleSerializeTerminal(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Terminal serialization requested (single terminal)');

    const terminalIds: string[] = [];

    if (typeof msg.terminalId === 'string' && msg.terminalId.trim().length > 0) {
      terminalIds.push(msg.terminalId);
    }

    const additionalIds = (msg as any).terminalIds;
    if (Array.isArray(additionalIds)) {
      additionalIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .forEach((id) => terminalIds.push(id));
    }

    if (terminalIds.length === 0) {
      this.logger.warn('No terminalId provided for serialization request');
      coordinator.postMessageToExtension({
        command: 'terminalSerializationResponse',
        serializationData: {},
        error: 'missing-terminal-id',
        terminalId: msg.terminalId,
        requestId: (msg as any).requestId,
        messageId: (msg as any).messageId,
        timestamp: Date.now(),
      });
      return;
    }

    this.handleRequestTerminalSerialization(
      {
        ...msg,
        terminalIds,
      },
      coordinator
    );
  }

  /**
   * Handle restore serialized content request
   */
  private handleRestoreSerializedContent(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Restore serialized content requested');

    const terminalId = typeof msg.terminalId === 'string' ? msg.terminalId : undefined;
    const serializedContent = (msg as any).serializedContent as string | undefined;
    const scrollbackData = Array.isArray((msg as any).scrollbackData)
      ? ((msg as any).scrollbackData as unknown[]).filter(
          (line): line is string => typeof line === 'string'
        )
      : undefined;
    const sessionRestoreMessage =
      typeof (msg as any).sessionRestoreMessage === 'string'
        ? ((msg as any).sessionRestoreMessage as string)
        : typeof (msg as any).resumeMessage === 'string'
        ? ((msg as any).resumeMessage as string)
        : undefined;
    const isActive = Boolean((msg as any).isActive);
    const requestId = (msg as any).requestId;
    const messageId = (msg as any).messageId;

    if (!terminalId) {
      this.logger.error('Restore serialized content request missing terminalId');
      coordinator.postMessageToExtension({
        command: 'terminalSerializationRestoreResponse',
        restoredCount: 0,
        totalCount: 0,
        error: 'missing-terminal-id',
        requestId,
        messageId,
        timestamp: Date.now(),
      });
      return;
    }

    const persistenceManager = (coordinator as any).persistenceManager;
    const restoreSessionFn =
      'restoreSession' in coordinator && typeof (coordinator as any).restoreSession === 'function'
        ? ((coordinator as any).restoreSession as (payload: {
            terminalId: string;
            terminalName: string;
            scrollbackData?: string[];
            sessionRestoreMessage?: string;
          }) => Promise<boolean>)
        : undefined;

    void (async () => {
      let restored = false;
      let errorMessage: string | undefined;

      try {
        if (persistenceManager && typeof serializedContent === 'string' && serializedContent.length > 0) {
          restored = Boolean(persistenceManager.restoreTerminalContent(terminalId, serializedContent));
        }

        if (!restored && scrollbackData && scrollbackData.length > 0 && restoreSessionFn) {
          restored = await restoreSessionFn({
            terminalId,
            terminalName:
              typeof msg.terminalName === 'string' ? (msg.terminalName as string) : `Terminal ${terminalId}`,
            scrollbackData,
            sessionRestoreMessage,
          });
        }

        if (restored && isActive) {
          coordinator.setActiveTerminalId(terminalId);
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to restore serialized content for ${terminalId}:`, error);
      } finally {
        coordinator.postMessageToExtension({
          command: 'terminalSerializationRestoreResponse',
          restoredCount: restored ? 1 : 0,
          totalCount: 1,
          success: restored,
          error: errorMessage,
          terminalId,
          requestId,
          messageId,
          timestamp: Date.now(),
        });
      }
    })();
  }

  /**
   * Handle terminal restore info message
   */
  private handleTerminalRestoreInfo(
    msg: MessageCommand,
    _coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Terminal restore info received');

    const terminals = Array.isArray((msg as any).terminals)
      ? ((msg as any).terminals as Array<Record<string, unknown>>)
      : [];
    const activeTerminalId =
      typeof (msg as any).activeTerminalId === 'string' ? ((msg as any).activeTerminalId as string) : null;
    const config = (msg as any).config;

    this.cachedTerminalRestoreInfo = {
      terminals,
      activeTerminalId,
      config,
      timestamp: Date.now(),
    };

    this.logger.info(`Cached terminal restore info for ${terminals.length} terminals`);
  }

  /**
   * Handle save all terminal sessions request
   */
  private handleSaveAllTerminalSessions(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Save all terminal sessions requested');

    const persistenceManager = (coordinator as any).persistenceManager;
    const requestId = (msg as any).requestId;
    const messageId = (msg as any).messageId;

    if (!persistenceManager) {
      this.logger.error('StandardTerminalPersistenceManager not available for save request');
      coordinator.postMessageToExtension({
        command: 'saveAllTerminalSessionsResponse',
        success: false,
        error: 'persistence-manager-unavailable',
        requestId,
        messageId,
        timestamp: Date.now(),
      });
      return;
    }

    try {
      const terminalIds: string[] =
        typeof persistenceManager.getAvailableTerminals === 'function'
          ? persistenceManager.getAvailableTerminals()
          : [];

      terminalIds.forEach((terminalId) => {
        try {
          persistenceManager.saveTerminalContent(terminalId);
        } catch (saveError) {
          this.logger.error(`Failed to save session for terminal ${terminalId}:`, saveError);
        }
      });

      coordinator.postMessageToExtension({
        command: 'saveAllTerminalSessionsResponse',
        success: true,
        savedTerminals: terminalIds.length,
        requestId,
        messageId,
        timestamp: Date.now(),
      });

      const notificationManager = coordinator.getManagers()?.notification;
      if (notificationManager) {
        notificationManager.showNotificationInTerminal(
          terminalIds.length > 0
            ? `✅ Saved ${terminalIds.length} terminal session${terminalIds.length === 1 ? '' : 's'}`
            : 'ℹ️ No terminals available to save',
          terminalIds.length > 0 ? 'success' : 'info'
        );
      }
    } catch (error) {
      this.logger.error('Failed to save terminal sessions', error);
      coordinator.postMessageToExtension({
        command: 'saveAllTerminalSessionsResponse',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        requestId,
        messageId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle request terminal serialization
   */
  private handleRequestTerminalSerialization(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Request terminal serialization');

    try {
      const terminalIds = Array.isArray((msg as any).terminalIds)
        ? ((msg as any).terminalIds as string[])
        : [];
      const scrollbackLines = (msg as any).scrollbackLines;
      const serializationData: Record<string, string> = {};
      const requestId = (msg as any).requestId;
      const messageId = (msg as any).messageId;

      // Use existing StandardTerminalPersistenceManager for serialization
      const persistenceManager = (coordinator as any).persistenceManager;
      if (!persistenceManager) {
        throw new Error('StandardTerminalPersistenceManager not available');
      }

      if (terminalIds.length === 0) {
        coordinator.postMessageToExtension({
          command: 'terminalSerializationResponse',
          serializationData: {},
          error: 'no-terminal-ids',
          requestId,
          messageId,
          timestamp: Date.now(),
        });
        return;
      }

      // Get serialized content from each terminal via persistence manager
      terminalIds.forEach((terminalId: string) => {
        try {
          // Use serializeTerminal method which returns the serialized content
          const serialized = persistenceManager.serializeTerminal(terminalId, {
            scrollback: typeof scrollbackLines === 'number' ? scrollbackLines : undefined,
          });
          const serializedContent = serialized?.content ?? '';

          if (serializedContent.length > 0) {
            serializationData[terminalId] = serializedContent;
            this.logger.info(
              `Serialized terminal ${terminalId}: ${serializedContent.length} chars`
            );
          } else {
            this.logger.warn(`No serialized content for terminal ${terminalId}`);
          }
        } catch (terminalError) {
          this.logger.error(`Error serializing terminal ${terminalId}:`, terminalError);
        }
      });

      // Send serialized data back to Extension
      coordinator.postMessageToExtension({
        command: 'terminalSerializationResponse',
        serializationData: serializationData,
        requestId,
        messageId,
        timestamp: Date.now(),
      });

      this.logger.info(
        `Terminal serialization completed for ${Object.keys(serializationData).length} terminals`
      );
    } catch (error) {
      this.logger.error('Error during terminal serialization:', error);

      // Send error response to Extension
      coordinator.postMessageToExtension({
        command: 'terminalSerializationResponse',
        serializationData: {},
        error: error instanceof Error ? error.message : String(error),
        requestId: (msg as any).requestId,
        messageId: (msg as any).messageId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle restore terminal serialization
   */
  private handleRestoreTerminalSerialization(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    this.logger.info('Restore terminal serialization');

    try {
      const terminalData = (msg as any).terminalData || [];
      let restoredCount = 0;

      // Restore serialized content to each terminal
      terminalData.forEach((terminal: any) => {
        const { id, serializedContent, isActive } = terminal;

        if (serializedContent && serializedContent.length > 0) {
          try {
            // Get terminal instance
            const terminalInstance = coordinator.getTerminalInstance(id);
            if (!terminalInstance) {
              this.logger.warn(`Terminal ${id} not found for restoration`);
              return;
            }

            // Convert serialized string to ScrollbackLine array
            const scrollbackLines = serializedContent.split('\n').map((line: string) => ({
              content: line,
              type: 'output' as const,
              timestamp: Date.now(),
            }));

            // Restore scrollback with ANSI colors preserved
            scrollbackLines.forEach((line: any) => {
              terminalInstance.terminal.writeln(line.content);
            });

            // Set as active if needed
            if (isActive) {
              coordinator.setActiveTerminalId(id);
            }

            restoredCount++;
            this.logger.info(`✅ Restored terminal ${id}: ${scrollbackLines.length} lines with ANSI colors`);
          } catch (restoreError) {
            this.logger.error(`Error restoring terminal ${id}:`, restoreError);
          }
        } else {
          this.logger.info(`No serialized content for terminal ${id}`);
        }
      });

      // Send restoration completion response
      coordinator.postMessageToExtension({
        command: 'terminalSerializationRestoreResponse',
        restoredCount: restoredCount,
        totalCount: terminalData.length,
        requestId: (msg as any).requestId,
        messageId: (msg as any).messageId,
        timestamp: Date.now(),
      });

      this.logger.info(
        `✅ Terminal serialization restoration completed: ${restoredCount}/${terminalData.length} terminals`
      );
    } catch (error) {
      this.logger.error('Error during terminal serialization restoration:', error);

      // Send error response to Extension
      coordinator.postMessageToExtension({
        command: 'terminalSerializationRestoreResponse',
        restoredCount: 0,
        totalCount: 0,
        error: error instanceof Error ? error.message : String(error),
        requestId: (msg as any).requestId,
        messageId: (msg as any).messageId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get cached terminal restore info
   */
  public getCachedTerminalRestoreInfo(): typeof this.cachedTerminalRestoreInfo {
    return this.cachedTerminalRestoreInfo;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.cachedTerminalRestoreInfo = null;
  }
}
