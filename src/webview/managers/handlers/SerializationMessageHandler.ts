/**
 * Serialization Message Handler
 *
 * Handles terminal state serialization and restoration
 *
 * Uses registry-based dispatch pattern instead of switch-case
 * for better maintainability and extensibility.
 */

import { IMessageHandler } from './IMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { ManagerLogger } from '../../utils/ManagerLogger';

/**
 * Handler function type (supports both sync and async)
 */
type CommandHandler = (
  msg: MessageCommand,
  coordinator: IManagerCoordinator
) => void | Promise<void>;

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
  private readonly handlers: Map<string, CommandHandler>;
  private cachedTerminalRestoreInfo: {
    terminals: Array<Record<string, unknown>>;
    activeTerminalId: string | null;
    config?: unknown;
    timestamp: number;
  } | null = null;

  constructor(private readonly logger: ManagerLogger) {
    this.handlers = this.buildHandlerRegistry();
  }

  /**
   * Build handler registry - replaces switch-case pattern
   */
  private buildHandlerRegistry(): Map<string, CommandHandler> {
    const registry = new Map<string, CommandHandler>();

    registry.set('serializeTerminal', (msg, coord) => this.handleSerializeTerminal(msg, coord));
    registry.set('restoreSerializedContent', (msg, coord) =>
      this.handleRestoreSerializedContent(msg, coord)
    );
    registry.set('requestTerminalSerialization', (msg, coord) =>
      this.handleRequestTerminalSerialization(msg, coord)
    );
    registry.set('restoreTerminalSerialization', (msg, coord) =>
      this.handleRestoreTerminalSerialization(msg, coord)
    );
    registry.set('terminalRestoreInfo', (msg, coord) =>
      this.handleTerminalRestoreInfo(msg, coord)
    );
    registry.set('saveAllTerminalSessions', (msg, coord) =>
      this.handleSaveAllTerminalSessions(msg, coord)
    );

    return registry;
  }

  /**
   * Handle serialization related messages using registry dispatch
   */
  public async handleMessage(msg: MessageCommand, coordinator: IManagerCoordinator): Promise<void> {
    const command = (msg as { command?: string }).command;

    if (!command) {
      this.logger.warn('Message received without command property');
      return;
    }

    const handler = this.handlers.get(command);
    if (handler) {
      await handler(msg, coordinator);
    } else {
      this.logger.warn(`Unknown serialization command: ${command}`);
    }
  }

  /**
   * Get supported command types
   */
  public getSupportedCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Handle serialize terminal request (single terminal)
   */
  private handleSerializeTerminal(msg: MessageCommand, coordinator: IManagerCoordinator): void {
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
        if (
          persistenceManager &&
          typeof serializedContent === 'string' &&
          serializedContent.length > 0
        ) {
          restored = Boolean(
            persistenceManager.restoreTerminalContent(terminalId, serializedContent)
          );
        }

        if (!restored && scrollbackData && scrollbackData.length > 0 && restoreSessionFn) {
          restored = await restoreSessionFn({
            terminalId,
            terminalName:
              typeof msg.terminalName === 'string'
                ? (msg.terminalName as string)
                : `Terminal ${terminalId}`,
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
  private handleTerminalRestoreInfo(msg: MessageCommand, _coordinator: IManagerCoordinator): void {
    this.logger.info('Terminal restore info received');

    const terminals = Array.isArray((msg as any).terminals)
      ? ((msg as any).terminals as Array<Record<string, unknown>>)
      : [];
    const activeTerminalId =
      typeof (msg as any).activeTerminalId === 'string'
        ? ((msg as any).activeTerminalId as string)
        : null;
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
            ? `Saved ${terminalIds.length} terminal session${terminalIds.length === 1 ? '' : 's'}`
            : 'No terminals available to save',
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
      const scrollbackLines = (msg as any).scrollbackLines || 1000;
      const serializationData: Record<string, string> = {};
      const requestId = (msg as any).requestId;
      const messageId = (msg as any).messageId;

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

      // Extract serialized content from each terminal using SerializeAddon
      terminalIds.forEach((terminalId: string) => {
        try {
          // Get terminal instance
          const terminalInstance = coordinator.getTerminalInstance(terminalId);
          if (!terminalInstance) {
            this.logger.warn(`Terminal ${terminalId} not found for serialization`);
            return;
          }

          // Get SerializeAddon for color-preserving serialization
          const serializeAddon = coordinator.getSerializeAddon(terminalId);

          let serializedContent = '';

          if (serializeAddon) {
            // Use SerializeAddon for color preservation
            this.logger.info(`Using SerializeAddon for terminal ${terminalId} serialization`);
            const fullContent = serializeAddon.serialize();
            const lines = fullContent.split('\n');
            const startIndex = Math.max(0, lines.length - scrollbackLines);
            serializedContent = lines.slice(startIndex).join('\n');
          } else {
            // Fallback: Extract plain text from buffer
            this.logger.warn(
              `SerializeAddon not available for terminal ${terminalId}, using plain text`
            );
            const buffer = terminalInstance.terminal.buffer.active;
            const lines: string[] = [];
            const startLine = Math.max(0, buffer.length - scrollbackLines);

            for (let i = startLine; i < buffer.length; i++) {
              const line = buffer.getLine(i);
              if (line) {
                lines.push(line.translateToString());
              }
            }
            serializedContent = lines.join('\n');
          }

          if (serializedContent.length > 0) {
            serializationData[terminalId] = serializedContent;
            this.logger.info(
              `Serialized terminal ${terminalId}: ${serializedContent.length} chars (${serializedContent.split('\n').length} lines)`
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
        `Terminal serialization completed for ${Object.keys(serializationData).length}/${terminalIds.length} terminals`
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
    this.logger.info('[RESTORE-DEBUG] === Restore terminal serialization START ===');

    try {
      const terminalData = (msg as any).terminalData || [];
      this.logger.info(`[RESTORE-DEBUG] Received ${terminalData.length} terminals to restore`);
      let restoredCount = 0;

      // Restore serialized content to each terminal
      terminalData.forEach((terminal: any, index: number) => {
        const { id, serializedContent, isActive } = terminal;
        this.logger.info(
          `[RESTORE-DEBUG] Processing terminal ${index + 1}/${terminalData.length}: ${id}`
        );
        this.logger.info(
          `[RESTORE-DEBUG] Has serializedContent: ${!!(serializedContent && serializedContent.length > 0)}, length: ${serializedContent?.length || 0}`
        );

        if (serializedContent && serializedContent.length > 0) {
          try {
            // Get terminal instance
            this.logger.info(`[RESTORE-DEBUG] Getting terminal instance for ${id}...`);
            const terminalInstance = coordinator.getTerminalInstance(id);
            if (!terminalInstance) {
              this.logger.warn(`[RESTORE-DEBUG] Terminal ${id} not found for restoration`);
              return;
            }
            this.logger.info(`[RESTORE-DEBUG] Terminal instance found for ${id}`);

            // Convert serialized string to ScrollbackLine array
            const scrollbackLines = serializedContent.split('\n').map((line: string) => ({
              content: line,
              type: 'output' as const,
              timestamp: Date.now(),
            }));
            this.logger.info(
              `[RESTORE-DEBUG] Created ${scrollbackLines.length} scrollback lines for terminal ${id}`
            );

            // Restore scrollback with ANSI colors preserved
            this.logger.info(
              `[RESTORE-DEBUG] Writing ${scrollbackLines.length} lines to terminal ${id}...`
            );
            scrollbackLines.forEach((line: any) => {
              terminalInstance.terminal.writeln(line.content);
            });
            this.logger.info(`[RESTORE-DEBUG] Finished writing to terminal ${id}`);

            // Set as active if needed
            if (isActive) {
              coordinator.setActiveTerminalId(id);
              this.logger.info(`[RESTORE-DEBUG] Set terminal ${id} as active`);
            }

            restoredCount++;
            this.logger.info(
              `[RESTORE-DEBUG] Restored terminal ${id}: ${scrollbackLines.length} lines with ANSI colors`
            );
          } catch (restoreError) {
            this.logger.error(`[RESTORE-DEBUG] Error restoring terminal ${id}:`, restoreError);
          }
        } else {
          this.logger.info(`[RESTORE-DEBUG] No serialized content for terminal ${id}`);
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
        `Terminal serialization restoration completed: ${restoredCount}/${terminalData.length} terminals`
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
    this.handlers.clear();
  }
}
