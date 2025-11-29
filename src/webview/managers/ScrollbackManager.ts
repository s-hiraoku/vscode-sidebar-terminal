/**
 * Scrollback Manager
 *
 * Manages terminal scrollback buffer with ANSI color preservation,
 * wrapped line processing, and empty line trimming.
 *
 * Features:
 * - SerializeAddon integration for ANSI color preservation
 * - Wrapped line detection and joining
 * - Empty line trimming for storage optimization
 * - Buffer reverse iteration for efficient processing
 * - BaseManager integration for consistent lifecycle management
 *
 * @see openspec/changes/optimize-terminal-rendering/specs/scrollback-fix/spec.md
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

import { Terminal, IBufferLine } from '@xterm/xterm';
import { SerializeAddon } from '@xterm/addon-serialize';
import { terminalLogger } from '../utils/ManagerLogger';
import { BaseManager } from './BaseManager';

export interface ScrollbackOptions {
  scrollback?: number;
  excludeModes?: boolean;
  excludeAltBuffer?: boolean;
  trimEmptyLines?: boolean;
  preserveWrappedLines?: boolean;
}

export interface ScrollbackData {
  content: string;
  lineCount: number;
  originalSize: number;
  trimmedSize: number;
  timestamp: number;
}

/**
 * Scrollback Manager Interface
 */
export interface IScrollbackManager {
  saveScrollback(terminalId: string, options?: ScrollbackOptions): ScrollbackData | null;
  restoreScrollback(terminalId: string, content: string): boolean;
  getFullBufferLine(line: IBufferLine, lineIndex: number, buffer: any): string;
  getBufferReverseIterator(buffer: any, startLine: number): IterableIterator<IBufferLine>;
}

/**
 * Scrollback Manager Implementation
 *
 * Extends BaseManager for consistent lifecycle management and monitoring.
 * Implements IScrollbackManager for scrollback operations.
 *
 * @see Issue #216 - Manager Pattern Standardization
 */
export class ScrollbackManager extends BaseManager implements IScrollbackManager {
  private serializeAddons: Map<string, SerializeAddon> = new Map();
  private terminals: Map<string, Terminal> = new Map();

  constructor() {
    super('ScrollbackManager', {
      enableLogging: false, // Use terminalLogger instead
      enablePerformanceTracking: true,
      enableErrorRecovery: true,
    });
  }

  /**
   * Initialize ScrollbackManager
   * No special initialization needed - manager is ready immediately
   */
  protected doInitialize(): void {
    // ScrollbackManager is stateless and ready immediately
    this.logger('ScrollbackManager initialized');
  }

  /**
   * Register terminal with SerializeAddon
   */
  public registerTerminal(
    terminalId: string,
    terminal: Terminal,
    serializeAddon: SerializeAddon
  ): void {
    this.terminals.set(terminalId, terminal);
    this.serializeAddons.set(terminalId, serializeAddon);
    terminalLogger.info(`📋 ScrollbackManager: Registered terminal ${terminalId}`);
  }

  /**
   * Unregister terminal
   */
  public unregisterTerminal(terminalId: string): void {
    this.terminals.delete(terminalId);
    this.serializeAddons.delete(terminalId);
    terminalLogger.info(`🗑️ ScrollbackManager: Unregistered terminal ${terminalId}`);
  }

  /**
   * Save scrollback with ANSI color preservation
   */
  public saveScrollback(terminalId: string, options?: ScrollbackOptions): ScrollbackData | null {
    terminalLogger.debug(`💾 ScrollbackManager: Saving scrollback for ${terminalId}`);

    const terminal = this.terminals.get(terminalId);
    const serializeAddon = this.serializeAddons.get(terminalId);

    if (!terminal || !serializeAddon) {
      terminalLogger.warn(`⚠️ ScrollbackManager: Terminal or addon not found for ${terminalId}`);
      return null;
    }

    try {
      const defaultOptions: Required<ScrollbackOptions> = {
        scrollback: 1000,
        excludeModes: false,
        excludeAltBuffer: true,
        trimEmptyLines: true,
        preserveWrappedLines: true,
      };

      const mergedOptions = { ...defaultOptions, ...options };

      // Serialize terminal content with ANSI colors
      const serializedContent = serializeAddon.serialize({
        scrollback: mergedOptions.scrollback,
        excludeModes: mergedOptions.excludeModes,
        excludeAltBuffer: mergedOptions.excludeAltBuffer,
      });

      const originalSize = serializedContent.length;
      let processedContent = serializedContent;

      // Process wrapped lines if enabled
      if (mergedOptions.preserveWrappedLines) {
        processedContent = this.processWrappedLines(terminal, processedContent);
      }

      // Trim empty lines if enabled
      if (mergedOptions.trimEmptyLines) {
        processedContent = this.trimEmptyLines(processedContent);
      }

      const trimmedSize = processedContent.length;
      const lineCount = processedContent.split('\n').length;

      terminalLogger.info(
        `✅ ScrollbackManager: Saved ${terminalId} - ${lineCount} lines, ` +
          `${originalSize} → ${trimmedSize} chars (${((1 - trimmedSize / originalSize) * 100).toFixed(1)}% reduction)`
      );

      return {
        content: processedContent,
        lineCount,
        originalSize,
        trimmedSize,
        timestamp: Date.now(),
      };
    } catch (error) {
      terminalLogger.error(
        `❌ ScrollbackManager: Failed to save scrollback for ${terminalId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Restore scrollback with ANSI colors
   */
  public restoreScrollback(terminalId: string, content: string): boolean {
    terminalLogger.debug(`🔄 ScrollbackManager: Restoring scrollback for ${terminalId}`);

    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      terminalLogger.warn(`⚠️ ScrollbackManager: Terminal not found for restore: ${terminalId}`);
      return false;
    }

    try {
      // Clear terminal before restore
      terminal.clear();

      // Write content line by line for better control
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.length > 0) {
          terminal.writeln(line);
        }
      }

      terminalLogger.info(`✅ ScrollbackManager: Restored ${terminalId} - ${lines.length} lines`);
      return true;
    } catch (error) {
      terminalLogger.error(
        `❌ ScrollbackManager: Failed to restore scrollback for ${terminalId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get full buffer line including wrapped continuation lines
   *
   * VS Code Pattern: Detect wrapped lines using line.isWrapped property
   * and join them backwards to reconstruct the original line.
   */
  public getFullBufferLine(line: IBufferLine, lineIndex: number, buffer: any): string {
    try {
      let fullLine = line.translateToString(true);

      // Check if this line is wrapped from previous line
      // Join backwards to get the complete original line
      let currentIndex = lineIndex;
      let currentLine = line;

      while (currentIndex > 0 && currentLine.isWrapped) {
        currentIndex--;
        const prevLine = buffer.getLine(currentIndex);
        if (prevLine) {
          fullLine = prevLine.translateToString(true) + fullLine;
          currentLine = prevLine;
        } else {
          break;
        }
      }

      return fullLine;
    } catch (error) {
      terminalLogger.warn(
        `⚠️ ScrollbackManager: Failed to get full buffer line at index ${lineIndex}:`,
        error
      );
      return '';
    }
  }

  /**
   * Get buffer reverse iterator for efficient iteration
   *
   * Iterates buffer from startLine backwards to 0
   */
  public *getBufferReverseIterator(buffer: any, startLine: number): IterableIterator<IBufferLine> {
    try {
      for (let i = startLine; i >= 0; i--) {
        const line = buffer.getLine(i);
        if (line) {
          yield line;
        }
      }
    } catch (error) {
      terminalLogger.warn(`⚠️ ScrollbackManager: Error during buffer reverse iteration:`, error);
    }
  }

  /**
   * Process wrapped lines to preserve original line structure
   */
  private processWrappedLines(terminal: Terminal, content: string): string {
    try {
      const buffer = terminal.buffer.active;
      const lines: string[] = [];
      let currentLine = '';
      let skipNextWrapped = false;

      const baseRow = buffer.baseY;
      const cursorRow = buffer.cursorY;
      const totalLines = baseRow + cursorRow + 1;

      for (let i = 0; i < totalLines; i++) {
        const line = buffer.getLine(i);
        if (!line) continue;

        const lineText = line.translateToString(true);

        if (line.isWrapped && !skipNextWrapped) {
          // This line is wrapped from previous - append to current
          currentLine += lineText;
        } else {
          // Start of new logical line
          if (currentLine.length > 0) {
            lines.push(currentLine);
          }
          currentLine = lineText;
          skipNextWrapped = false;
        }
      }

      // Add final line
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }

      return lines.join('\n');
    } catch (error) {
      terminalLogger.warn(
        `⚠️ ScrollbackManager: Failed to process wrapped lines, using original content:`,
        error
      );
      return content;
    }
  }

  /**
   * Trim empty lines from content
   *
   * Removes trailing and leading empty lines while preserving
   * meaningful whitespace in the middle.
   */
  private trimEmptyLines(content: string): string {
    try {
      const lines = content.split('\n');

      // Trim trailing empty lines
      while (lines.length > 0 && lines[lines.length - 1]!.trim().length === 0) {
        lines.pop();
      }

      // Trim leading empty lines
      while (lines.length > 0 && lines[0]!.trim().length === 0) {
        lines.shift();
      }

      return lines.join('\n');
    } catch (error) {
      terminalLogger.warn(
        `⚠️ ScrollbackManager: Failed to trim empty lines, using original content:`,
        error
      );
      return content;
    }
  }

  /**
   * Get statistics for debugging
   */
  public getStats(): {
    registeredTerminals: number;
    terminals: string[];
  } {
    return {
      registeredTerminals: this.terminals.size,
      terminals: Array.from(this.terminals.keys()),
    };
  }

  /**
   * Dispose all resources
   * Called by BaseManager.dispose() for cleanup
   */
  protected doDispose(): void {
    this.terminals.clear();
    this.serializeAddons.clear();
    terminalLogger.info('🧹 ScrollbackManager: Disposed');
  }
}
