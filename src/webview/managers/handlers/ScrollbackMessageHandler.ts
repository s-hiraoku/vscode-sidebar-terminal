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
   */
  private handleRestoreScrollback(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
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

    try {
      // Get terminal instance
      const terminalInstance = coordinator.getTerminalInstance(terminalId);
      if (!terminalInstance) {
        throw new Error(`Terminal instance not found for ID: ${terminalId}`);
      }

      // Normalize scrollback data
      const normalizedScrollback = this.normalizeScrollbackData(scrollbackContent);

      this.logger.info(
        `🔧 [RESTORE-DEBUG] Restoring ${normalizedScrollback.length} lines to terminal ${terminalId}`
      );

      // Restore scrollback to the terminal
      this.restoreScrollbackToXterm(terminalInstance.terminal, normalizedScrollback);

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
    this.logger.info(`Restoring ${scrollbackContent.length} lines to terminal`);

    if (!terminal) {
      throw new Error('Terminal instance not provided');
    }

    // Write each line to the terminal
    for (const line of scrollbackContent) {
      terminal.writeln(line.content);
    }

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

  // Pending scrollback restorations - wait for shell output before restoring
  private pendingScrollbackRestorations = new Map<string, {
    scrollbackData: string[];
    onDataDisposable?: { dispose: () => void };
  }>();

  /**
   * Handle restore terminal sessions request (batch restoration)
   * CRITICAL FIX: Wait for shell output before restoring scrollback
   *
   * The issue is that if we restore scrollback immediately, the shell's
   * initialization output (prompt, welcome message) will overwrite/scroll
   * out the restored content. Solution: Queue the restoration and trigger
   * it after the first shell output is received.
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
      this.logger.warn('⚠️ [RESTORE-SESSIONS] No terminals provided for restoration');
      return;
    }

    this.logger.info(`📦 [RESTORE-SESSIONS] Restoring ${terminals.length} terminals`);

    let queuedCount = 0;
    let skippedCount = 0;

    for (const terminalData of terminals) {
      const { terminalId, scrollbackData, restoreScrollback } = terminalData;

      if (!terminalId) {
        this.logger.warn('⚠️ [RESTORE-SESSIONS] Terminal data missing terminalId');
        skippedCount++;
        continue;
      }

      if (!restoreScrollback || !scrollbackData || scrollbackData.length === 0) {
        this.logger.info(`⏭️ [RESTORE-SESSIONS] Skipping terminal ${terminalId} - no scrollback data`);
        skippedCount++;
        continue;
      }

      // Queue scrollback restoration - will be triggered after first shell output
      this.queueScrollbackRestoration(terminalId, scrollbackData, coordinator);
      queuedCount++;
    }

    // Notify extension that restoration is queued (not complete yet)
    void this.messageQueue.enqueue({
      command: 'terminalSessionsRestored',
      terminalsRestored: queuedCount,
      terminalsFailed: skippedCount,
      status: 'queued', // Mark as queued, not complete
      timestamp: Date.now(),
    });

    this.logger.info(`✅ [RESTORE-SESSIONS] Queued restoration: ${queuedCount} queued, ${skippedCount} skipped`);
  }

  /**
   * Queue scrollback restoration for a terminal
   * Will be triggered after the first shell output is received
   *
   * IMPORTANT: We use a simple delay-based approach because:
   * - terminal.onData() is for USER INPUT, not shell output
   * - Shell output arrives via Extension messages ('output' command)
   * - The most reliable approach is to wait for shell initialization
   */
  private queueScrollbackRestoration(
    terminalId: string,
    scrollbackData: string[],
    coordinator: IManagerCoordinator
  ): void {
    // eslint-disable-next-line no-console
    console.log(`[SCROLLBACK-RESTORE] Queueing restoration for ${terminalId}: ${scrollbackData.length} lines`);

    // Wait for terminal to be available
    const checkAndQueue = async (): Promise<void> => {
      const maxRetries = 10;
      const retryDelay = 200; // ms

      for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        const terminalInstance = coordinator.getTerminalInstance(terminalId);

        if (terminalInstance && terminalInstance.terminal) {
          // Terminal is available

          // eslint-disable-next-line no-console
          console.log(`[SCROLLBACK-RESTORE] Terminal ${terminalId} available, scheduling delayed restoration...`);

          // Store pending restoration data
          const pendingData = {
            scrollbackData,
            onDataDisposable: undefined as { dispose: () => void } | undefined,
          };
          this.pendingScrollbackRestorations.set(terminalId, pendingData);

          // STRATEGY: Use a fixed delay to wait for shell initialization
          // This is more reliable than trying to detect shell output
          // because output arrives via Extension messages, not terminal events
          //
          // Typical shell init times:
          // - bash/zsh: 200-500ms
          // - fish: 300-800ms
          // - PowerShell: 500-1500ms
          //
          // We use 1500ms to be safe across all shells
          setTimeout(() => {
            if (this.pendingScrollbackRestorations.has(terminalId)) {
              // eslint-disable-next-line no-console
              console.log(`[SCROLLBACK-RESTORE] Executing restoration for ${terminalId} after shell init delay`);
              this.executeDelayedRestoration(terminalId, coordinator);
            }
          }, 1500); // 1.5 second delay for shell initialization

          return; // Successfully queued
        }

        // Terminal not ready, retry after delay
        if (retryCount < maxRetries - 1) {
          this.logger.info(`⏳ [RESTORE-SESSIONS] Terminal ${terminalId} not ready, retry ${retryCount + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      // eslint-disable-next-line no-console
      console.error(`[SCROLLBACK-RESTORE] Failed to queue restoration for ${terminalId} - terminal not available`);
    };

    void checkAndQueue();
  }

  /**
   * Execute delayed scrollback restoration after shell output
   */
  private executeDelayedRestoration(
    terminalId: string,
    coordinator: IManagerCoordinator
  ): void {
    const pending = this.pendingScrollbackRestorations.get(terminalId);
    if (!pending) {
      // eslint-disable-next-line no-console
      console.log(`[SCROLLBACK-RESTORE] No pending restoration for ${terminalId}`);
      return;
    }

    // Cleanup
    if (pending.onDataDisposable) {
      pending.onDataDisposable.dispose();
    }
    this.pendingScrollbackRestorations.delete(terminalId);

    // eslint-disable-next-line no-console
    console.log(`[SCROLLBACK-RESTORE] Executing delayed restoration for ${terminalId}: ${pending.scrollbackData.length} lines`);

    try {
      // Delegate to existing restoreScrollback handler
      const restoreMsg: MessageCommand = {
        command: 'restoreScrollback',
        terminalId,
        scrollbackContent: pending.scrollbackData,
      };

      this.handleRestoreScrollback(restoreMsg, coordinator);
      this.logger.info(`✅ [RESTORE-SESSIONS] Delayed restoration completed for terminal ${terminalId}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[SCROLLBACK-RESTORE] Delayed restoration failed for ${terminalId}:`, error);
      this.logger.error(
        `❌ [RESTORE-SESSIONS] Delayed restoration failed for terminal ${terminalId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // Cleanup pending scrollback restorations
    for (const [, pending] of this.pendingScrollbackRestorations) {
      if (pending.onDataDisposable) {
        pending.onDataDisposable.dispose();
      }
    }
    this.pendingScrollbackRestorations.clear();
  }
}
