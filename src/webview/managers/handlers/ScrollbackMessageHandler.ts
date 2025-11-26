/**
 * Scrollback Message Handler
 *
 * Handles scrollback extraction, restoration, and progress tracking
 */

import { IMessageHandler } from './IMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { MessageQueue } from '../../utils/MessageQueue';
import { ManagerLogger } from '../../utils/ManagerLogger';
import { Terminal } from '@xterm/xterm';
import { TerminalCreationService } from '../../services/TerminalCreationService';

/**
 * Scrollback line format
 */
export interface ScrollbackLine {
  content: string;
  type?: 'output' | 'input' | 'error';
  timestamp?: number;
}

/**
 * Scrollback Message Handler
 *
 * Responsibilities:
 * - Extract scrollback data from xterm.js terminals
 * - Restore scrollback content to terminals
 * - Handle scrollback progress updates
 * - Manage scrollback data normalization
 */
export class ScrollbackMessageHandler implements IMessageHandler {
  // Track terminals that have already been restored to prevent duplicate restoration
  private readonly restoredTerminals = new Set<string>();

  constructor(
    private readonly messageQueue: MessageQueue,
    private readonly logger: ManagerLogger
  ) {}

  /**
   * Handle scrollback related messages
   */
  public async handleMessage(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    const command = (msg as { command?: string }).command;

    switch (command) {
      case 'getScrollback':
        this.handleGetScrollback(msg, coordinator);
        break;
      case 'restoreScrollback':
        this.handleRestoreScrollback(msg, coordinator);
        break;
      case 'scrollbackProgress':
        this.handleScrollbackProgress(msg);
        break;
      case 'extractScrollbackData':
        await this.handleExtractScrollbackData(msg, coordinator);
        break;
      case 'restoreTerminalSessions':
        await this.handleRestoreTerminalSessions(msg, coordinator);
        break;
      default:
        this.logger.warn(`Unknown scrollback command: ${command}`);
    }
  }

  /**
   * Get supported command types
   */
  public getSupportedCommands(): string[] {
    return ['getScrollback', 'restoreScrollback', 'scrollbackProgress', 'extractScrollbackData', 'restoreTerminalSessions'];
  }

  /**
   * Handle get scrollback request
   */
  private handleGetScrollback(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    this.logger.info('Handling get scrollback message');

    const terminalId = msg.terminalId as string;
    const maxLines = (msg.maxLines as number) || 1000;

    if (!terminalId) {
      this.logger.error('No terminal ID provided for scrollback extraction');
      return;
    }

    // Get terminal instance
    const terminalInstance = coordinator.getTerminalInstance(terminalId);
    if (!terminalInstance) {
      this.logger.error(`Terminal instance not found for ID: ${terminalId}`);
      return;
    }

    try {
      // Get SerializeAddon for color preservation
      const serializeAddon = coordinator.getSerializeAddon(terminalId);

      // Extract scrollback from xterm.js
      const scrollbackContent = this.extractScrollbackFromXterm(
        terminalInstance.terminal,
        serializeAddon,
        maxLines
      );

      // Send scrollback data back to extension
      void this.messageQueue.enqueue({
        command: 'scrollbackExtracted',
        terminalId,
        scrollbackContent,
        timestamp: Date.now(),
      });

      this.logger.info(
        `Scrollback extracted for terminal ${terminalId}: ${scrollbackContent.length} lines`
      );
    } catch (error) {
      this.logger.error(
        `Error extracting scrollback: ${error instanceof Error ? error.message : String(error)}`
      );

      void this.messageQueue.enqueue({
        command: 'error',
        error: `Failed to extract scrollback: ${error instanceof Error ? error.message : String(error)}`,
        terminalId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle scrollback restoration request
   * @param skipDuplicateCheck - If true, skips the duplicate check (used internally by handleRestoreTerminalSessions)
   */
  private handleRestoreScrollback(
    msg: MessageCommand,
    coordinator: IManagerCoordinator,
    skipDuplicateCheck = false
  ): void {
    // eslint-disable-next-line no-console
    console.log('[SCROLLBACK-RESTORE] handleRestoreScrollback called', { terminalId: msg.terminalId, timestamp: Date.now() });
    this.logger.info('Handling restore scrollback message');

    const terminalId = msg.terminalId as string;
    // Handle both old and new message formats
    const scrollbackContent = (msg.scrollback || msg.scrollbackContent) as
      | string
      | string[]
      | ScrollbackLine[];

    if (!terminalId || !scrollbackContent) {
      this.logger.error('Invalid scrollback restore request', {
        terminalId,
        hasScrollback: !!scrollbackContent,
      });
      return;
    }

    // 🔒 Skip if already restored (prevents duplicate restoration)
    // Only check if not called from handleRestoreTerminalSessions (which handles its own check)
    if (!skipDuplicateCheck && this.restoredTerminals.has(terminalId)) {
      // eslint-disable-next-line no-console
      console.log(`[SCROLLBACK-RESTORE] ⏭️ Already restored: ${terminalId}, skipping`);
      this.logger.info(`⏭️ [RESTORE-DEBUG] Already restored: ${terminalId}, skipping`);
      return;
    }

    try {
      // Get terminal instance
      const terminalInstance = coordinator.getTerminalInstance(terminalId);
      if (!terminalInstance) {
        throw new Error(`Terminal instance not found for ID: ${terminalId}`);
      }

      // 🔒 Mark terminal as restoring (blocks auto-save)
      if (!skipDuplicateCheck) {
        TerminalCreationService.markTerminalRestoring(terminalId);
      }

      // Normalize scrollback data
      const normalizedScrollback = this.normalizeScrollbackData(scrollbackContent);

      this.logger.info(
        `🔧 [RESTORE-DEBUG] Restoring ${normalizedScrollback.length} lines to terminal ${terminalId}`
      );

      // Restore scrollback to the terminal
      this.restoreScrollbackToXterm(terminalInstance.terminal, normalizedScrollback);

      // 🔒 Mark as restored to prevent duplicate restoration
      if (!skipDuplicateCheck) {
        this.restoredTerminals.add(terminalId);
        // 🔓 Mark restoration complete (starts 5s protection period countdown)
        TerminalCreationService.markTerminalRestored(terminalId);
      }

      // Send confirmation back to extension
      void this.messageQueue.enqueue({
        command: 'scrollbackRestored',
        terminalId,
        restoredLines: normalizedScrollback.length,
        timestamp: Date.now(),
      });

      // eslint-disable-next-line no-console
      console.log(`[SCROLLBACK-RESTORE] ✅ Restored ${normalizedScrollback.length} lines to terminal ${terminalId}`);
      this.logger.info(
        `✅ [RESTORE-DEBUG] Scrollback restored for terminal ${terminalId}: ${normalizedScrollback.length} lines`
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[SCROLLBACK-RESTORE] ❌ Error:`, error);
      this.logger.error(
        `❌ [RESTORE-DEBUG] Error restoring scrollback: ${error instanceof Error ? error.message : String(error)}`
      );

      // Even on error, mark as restored to prevent infinite retries
      if (!skipDuplicateCheck) {
        this.restoredTerminals.add(terminalId);
        TerminalCreationService.markTerminalRestored(terminalId);
      }

      void this.messageQueue.enqueue({
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
  private handleScrollbackProgress(msg: MessageCommand): void {
    this.logger.info('Handling scrollback progress message');

    const progressInfo = msg.scrollbackProgress as {
      terminalId: string;
      progress: number;
      currentLines: number;
      totalLines: number;
      stage: 'loading' | 'decompressing' | 'restoring';
    };

    if (!progressInfo) {
      this.logger.error('No progress information provided');
      return;
    }

    // Show progress notification
    this.logger.info(
      `Scrollback progress: ${progressInfo.progress}% (${progressInfo.currentLines}/${progressInfo.totalLines})`
    );
  }

  /**
   * Handle extract scrollback data request
   */
  private async handleExtractScrollbackData(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    try {
      const terminalId = msg.terminalId as string;
      const requestId = msg.requestId as string;
      const maxLines = msg.maxLines as number;

      if (!terminalId || !requestId) {
        this.logger.error('Missing terminalId or requestId for scrollback extraction');
        return;
      }

      this.logger.info(`📦 [SAVE-DEBUG] Extracting scrollback data for terminal ${terminalId}, requestId: ${requestId}`);

      // Get the terminal instance
      const terminalInstance = coordinator.getTerminalInstance(terminalId);
      if (!terminalInstance) {
        this.logger.error(`❌ [SAVE-DEBUG] Terminal ${terminalId} not found for scrollback extraction`);

        // Send empty response
        coordinator.postMessageToExtension({
          command: 'scrollbackDataCollected',
          terminalId,
          requestId,
          scrollbackData: [],
        });
        return;
      }

      this.logger.info(`✅ [SAVE-DEBUG] Terminal instance found for ${terminalId}`);
      this.logger.info(`🔍 [SAVE-DEBUG] Has serializeAddon: ${!!terminalInstance.serializeAddon}`);
      this.logger.info(`🔍 [SAVE-DEBUG] Has terminal: ${!!terminalInstance.terminal}`);

      // Extract scrollback data
      const scrollbackData = this.extractScrollbackFromTerminal(terminalInstance, maxLines || 1000);

      this.logger.info(`📦 [SAVE-DEBUG] Extracted ${scrollbackData.length} lines for terminal ${terminalId}`);

      // Send the scrollback data back to Extension
      coordinator.postMessageToExtension({
        command: 'scrollbackDataCollected',
        terminalId,
        requestId,
        scrollbackData,
      });
    } catch (error) {
      this.logger.error('Failed to extract scrollback data', error);

      // Send error response
      coordinator.postMessageToExtension({
        command: 'scrollbackDataCollected',
        terminalId: msg.terminalId,
        requestId: msg.requestId,
        scrollbackData: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Extract scrollback content from xterm terminal (improved version with color preservation)
   */
  private extractScrollbackFromXterm(
    terminal: Terminal,
    serializeAddon: import('@xterm/addon-serialize').SerializeAddon | undefined,
    maxLines: number
  ): ScrollbackLine[] {
    this.logger.debug(`Extracting scrollback from xterm terminal (max ${maxLines} lines)`);

    if (!terminal) {
      throw new Error('Terminal instance not provided');
    }

    const scrollbackLines: ScrollbackLine[] = [];

    try {
      // 🎨 Use SerializeAddon if available (preserves ANSI color codes)
      if (serializeAddon) {
        this.logger.info('✅ Using SerializeAddon for color-preserving scrollback extraction');

        const serialized = serializeAddon.serialize();
        const lines = serialized.split('\n');
        const startIndex = Math.max(0, lines.length - maxLines);

        for (let i = startIndex; i < lines.length; i++) {
          const content = lines[i];
          // Include non-empty lines and preserve some empty lines for structure
          if (content && (content.trim() || scrollbackLines.length > 0)) {
            scrollbackLines.push({
              content: content, // Includes ANSI escape codes for colors
              type: 'output',
              timestamp: Date.now(),
            });
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

        this.logger.info(
          `✅ Extracted ${scrollbackLines.length} lines with ANSI colors using SerializeAddon`
        );
        return scrollbackLines;
      }

      // Fallback: Extract plain text (colors will be lost)
      this.logger.warn('⚠️ SerializeAddon not available - extracting plain text (colors will be lost)');

      const buffer = terminal.buffer.active;
      const bufferLength = buffer.length;
      const viewportY = buffer.viewportY;
      const baseY = buffer.baseY;

      this.logger.debug(
        `Buffer info: length=${bufferLength}, viewportY=${viewportY}, baseY=${baseY}`
      );

      // Calculate range to extract (include scrollback + viewport)
      const startLine = Math.max(0, bufferLength - maxLines);
      const endLine = bufferLength;

      this.logger.debug(
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
          this.logger.warn(`Error extracting line ${i}: ${String(lineError)}`);
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

      this.logger.info(
        `Successfully extracted ${scrollbackLines.length} lines from terminal buffer (plain text)`
      );
    } catch (error) {
      this.logger.error(`Error accessing terminal buffer: ${String(error)}`);
      throw error;
    }

    return scrollbackLines;
  }

  /**
   * Restore scrollback content to xterm terminal
   */
  private restoreScrollbackToXterm(terminal: Terminal, scrollbackContent: ScrollbackLine[]): void {
    // eslint-disable-next-line no-console
    console.log(`[SCROLLBACK-RESTORE] restoreScrollbackToXterm: ${scrollbackContent.length} lines`);
    this.logger.info(`Restoring ${scrollbackContent.length} lines to terminal`);

    if (!terminal) {
      throw new Error('Terminal instance not provided');
    }

    // Debug: Log the actual content being written
    // eslint-disable-next-line no-console
    console.log('[SCROLLBACK-RESTORE] Content to restore:', scrollbackContent.map(l => l.content));

    // Write each line to the terminal
    for (const line of scrollbackContent) {
      // eslint-disable-next-line no-console
      console.log(`[SCROLLBACK-RESTORE] Writing line: "${line.content.substring(0, 100)}..."`);
      terminal.writeln(line.content);
    }

    // eslint-disable-next-line no-console
    console.log(`[SCROLLBACK-RESTORE] ✅ Finished writing ${scrollbackContent.length} lines to terminal`);
    this.logger.info(`Restored ${scrollbackContent.length} lines to terminal`);
  }

  /**
   * Extract scrollback data from terminal instance
   */
  private extractScrollbackFromTerminal(terminal: any, maxLines: number): string[] {
    try {
      if (!terminal || !terminal.terminal) {
        return [];
      }

      const xtermInstance = terminal.terminal;

      // 🎨 Try SerializeAddon first (if available) - preserves ANSI color codes
      if (terminal.serializeAddon) {
        this.logger.info('✅ Using SerializeAddon for color-preserving scrollback extraction');
        const serialized = terminal.serializeAddon.serialize();
        const lines = serialized.split('\n').slice(-maxLines);
        this.logger.info(
          `✅ Extracted ${lines.length} lines with ANSI colors using SerializeAddon`
        );
        return lines;
      }

      // Fallback: Read from buffer directly (plain text - colors will be lost)
      this.logger.warn('⚠️ SerializeAddon not available - extracting plain text (colors will be lost)');

      if (xtermInstance.buffer && xtermInstance.buffer.active) {
        const buffer = xtermInstance.buffer.active;
        const lines: string[] = [];

        const startLine = Math.max(0, buffer.length - maxLines);
        for (let i = startLine; i < buffer.length; i++) {
          const line = buffer.getLine(i);
          if (line) {
            lines.push(line.translateToString());
          }
        }

        this.logger.info(
          `Extracted ${lines.length} lines from terminal buffer (plain text)`
        );
        return lines;
      }

      return [];
    } catch (error) {
      this.logger.error('Failed to extract scrollback from terminal', error);
      return [];
    }
  }

  /**
   * Normalize scrollback data to consistent format
   */
  private normalizeScrollbackData(
    scrollbackContent: string | string[] | ScrollbackLine[]
  ): ScrollbackLine[] {
    // Accept legacy payloads that were stored as a single string
    if (typeof scrollbackContent === 'string') {
      const lines = scrollbackContent.split('\n');
      return lines.map(line => ({ content: line, type: 'output' as const }));
    }

    if (!Array.isArray(scrollbackContent) || scrollbackContent.length === 0) {
      this.logger.warn('Empty scrollback content');
      return [];
    }

    // Check if it's string array
    if (typeof scrollbackContent[0] === 'string') {
      // Convert string array to object array
      return (scrollbackContent as string[]).map((line) => ({
        content: line,
        type: 'output' as const,
      }));
    }

    // Already in object format, ensure type is properly typed
    return (scrollbackContent as ScrollbackLine[]).map((item) => ({
      content: item.content,
      type: item.type === 'input' || item.type === 'error' ? item.type : ('output' as const),
      timestamp: item.timestamp,
    }));
  }

  /**
   * Handle restore terminal sessions request (batch restoration)
   * Includes retry mechanism for terminals that may not be immediately available
   */
  private async handleRestoreTerminalSessions(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): Promise<void> {
    // eslint-disable-next-line no-console
    console.log('[SCROLLBACK-RESTORE] handleRestoreTerminalSessions called', { terminals: (msg as any).terminals?.length, timestamp: Date.now() });
    this.logger.info('🔄 [RESTORE-SESSIONS] Handling restoreTerminalSessions message');

    const terminals = (msg as any).terminals as Array<{
      terminalId: string;
      scrollbackData?: string[];
      restoreScrollback?: boolean;
      progressive?: boolean;
    }>;

    if (!Array.isArray(terminals) || terminals.length === 0) {
      // eslint-disable-next-line no-console
      console.warn('[SCROLLBACK-RESTORE] No terminals provided for restoration');
      this.logger.warn('⚠️ [RESTORE-SESSIONS] No terminals provided for restoration');
      return;
    }

    // 🔒 Mark all terminals as restoring BEFORE starting restoration (blocks auto-save)
    for (const terminalData of terminals) {
      if (terminalData.terminalId && terminalData.restoreScrollback && terminalData.scrollbackData?.length) {
        TerminalCreationService.markTerminalRestoring(terminalData.terminalId);
      }
    }

    // eslint-disable-next-line no-console
    console.log(`[SCROLLBACK-RESTORE] Processing ${terminals.length} terminals`);
    this.logger.info(`📦 [RESTORE-SESSIONS] Restoring ${terminals.length} terminals`);

    let successCount = 0;
    let failedCount = 0;

    for (const terminalData of terminals) {
      const { terminalId, scrollbackData, restoreScrollback } = terminalData;

      // eslint-disable-next-line no-console
      console.log(`[SCROLLBACK-RESTORE] Processing terminal: ${terminalId}`, {
        hasScrollbackData: !!scrollbackData,
        scrollbackLength: scrollbackData?.length ?? 0,
        restoreScrollback,
      });

      if (!terminalId) {
        // eslint-disable-next-line no-console
        console.warn('[SCROLLBACK-RESTORE] Terminal data missing terminalId');
        this.logger.warn('⚠️ [RESTORE-SESSIONS] Terminal data missing terminalId');
        failedCount++;
        continue;
      }

      // 🔒 Skip if already restored (prevents duplicate restoration)
      if (this.restoredTerminals.has(terminalId)) {
        // eslint-disable-next-line no-console
        console.log(`[SCROLLBACK-RESTORE] ⏭️ Already restored: ${terminalId}, skipping`);
        this.logger.info(`⏭️ [RESTORE-SESSIONS] Already restored: ${terminalId}, skipping`);
        continue;
      }

      if (!restoreScrollback || !scrollbackData || scrollbackData.length === 0) {
        // eslint-disable-next-line no-console
        console.log(`[SCROLLBACK-RESTORE] Skipping terminal ${terminalId} - no scrollback data or restoreScrollback=false`);
        this.logger.info(`⏭️ [RESTORE-SESSIONS] Skipping terminal ${terminalId} - no scrollback data`);
        continue;
      }

      // Retry mechanism: wait for terminal to be available
      const maxRetries = 10;
      const retryDelay = 200; // ms
      let restored = false;

      for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        const terminalInstance = coordinator.getTerminalInstance(terminalId);

        // eslint-disable-next-line no-console
        console.log(`[SCROLLBACK-RESTORE] Retry ${retryCount + 1}/${maxRetries} for ${terminalId}: terminalInstance=${!!terminalInstance}`);

        if (terminalInstance) {
          try {
            // Delegate to existing restoreScrollback handler
            // Pass skipDuplicateCheck=true since we handle duplicate prevention here
            const restoreMsg: MessageCommand = {
              command: 'restoreScrollback',
              terminalId,
              scrollbackContent: scrollbackData,
            };

            this.handleRestoreScrollback(restoreMsg, coordinator, true);

            // 🔒 Mark as restored to prevent duplicate restoration
            this.restoredTerminals.add(terminalId);

            // 🔓 Mark restoration complete (starts 5s protection period countdown)
            TerminalCreationService.markTerminalRestored(terminalId);

            // eslint-disable-next-line no-console
            console.log(`[SCROLLBACK-RESTORE] ✅ Restored scrollback for terminal ${terminalId}: ${scrollbackData.length} lines`);
            this.logger.info(`✅ [RESTORE-SESSIONS] Restored scrollback for terminal ${terminalId}: ${scrollbackData.length} lines`);
            successCount++;
            restored = true;
            break; // Success - exit retry loop
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`[SCROLLBACK-RESTORE] ❌ Failed to restore terminal ${terminalId}:`, error);
            this.logger.error(
              `❌ [RESTORE-SESSIONS] Failed to restore terminal ${terminalId}: ${error instanceof Error ? error.message : String(error)}`
            );
            // Even on error, mark as restored to prevent infinite retries
            this.restoredTerminals.add(terminalId);
            TerminalCreationService.markTerminalRestored(terminalId);
            failedCount++;
            break; // Error - don't retry
          }
        }

        // Terminal not ready, retry after delay
        if (retryCount < maxRetries - 1) {
          // eslint-disable-next-line no-console
          console.log(`[SCROLLBACK-RESTORE] ⏳ Terminal ${terminalId} not ready, waiting ${retryDelay}ms...`);
          this.logger.info(`⏳ [RESTORE-SESSIONS] Terminal ${terminalId} not ready, retry ${retryCount + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      if (!restored) {
        // eslint-disable-next-line no-console
        console.error(`[SCROLLBACK-RESTORE] ❌ Terminal ${terminalId} not available after ${maxRetries} retries`);
        this.logger.error(`❌ [RESTORE-SESSIONS] Terminal ${terminalId} not available after ${maxRetries} retries`);
        // Mark as "restored" to prevent future retry attempts
        this.restoredTerminals.add(terminalId);
        TerminalCreationService.markTerminalRestored(terminalId);
        failedCount++;
      }
    }

    // Notify extension that restoration is complete
    void this.messageQueue.enqueue({
      command: 'terminalSessionsRestored',
      terminalsRestored: successCount,
      terminalsFailed: failedCount,
      timestamp: Date.now(),
    });

    // eslint-disable-next-line no-console
    console.log(`[SCROLLBACK-RESTORE] ✅ Completed restoration: ${successCount} success, ${failedCount} failed`);
    this.logger.info(`✅ [RESTORE-SESSIONS] Completed restoration: ${successCount} success, ${failedCount} failed`);
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // No resources to clean up
  }
}
