/**
 * Terminal Link Manager
 *
 * Extracted from TerminalLifecycleCoordinator to centralize link detection and handling.
 *
 * Responsibilities:
 * - File path detection and link creation
 * - URL detection and handling
 * - Link provider registration with xterm.js
 * - File opening with line/column navigation
 *
 * Extended BaseManager for consistent lifecycle management (Issue #216)
 *
 * @see openspec/changes/refactor-terminal-foundation/specs/split-lifecycle-manager/spec.md
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

import { Terminal, type ILink, type IDisposable } from '@xterm/xterm';
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { terminalLogger } from '../utils/ManagerLogger';
import { BaseManager } from './BaseManager';

/**
 * Service responsible for managing terminal links (file paths and URLs)
 * Uses constructor injection pattern (Issue #216)
 */
export class TerminalLinkManager extends BaseManager {
  private readonly coordinator: IManagerCoordinator;
  private readonly linkProviderDisposables: Map<string, IDisposable> = new Map();

  // File path detection regex patterns
  private readonly absoluteFilePathRegex =
    /(?:\/[a-zA-Z0-9._-]+)+|(?:[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]+)/g;
  private readonly relativeFilePathRegex = /(?:\.{1,2}\/)+[a-zA-Z0-9._/-]+/g;

  // Allowed file extensions for link detection
  private readonly allowedFileExtensions = new Set([
    'js',
    'ts',
    'jsx',
    'tsx',
    'json',
    'md',
    'txt',
    'py',
    'rb',
    'java',
    'c',
    'cpp',
    'h',
    'cs',
    'go',
    'rs',
    'php',
    'html',
    'css',
    'scss',
    'sass',
    'less',
    'xml',
    'yaml',
    'yml',
    'toml',
    'ini',
    'cfg',
    'conf',
    'sh',
    'bash',
    'zsh',
    'fish',
    'ps1',
    'gradle',
    'sql',
  ]);

  constructor(coordinator: IManagerCoordinator) {
    super('TerminalLinkManager', {
      enableLogging: false, // Use terminalLogger instead
      enablePerformanceTracking: true,
      enableErrorRecovery: true,
    });
    this.coordinator = coordinator;
  }

  /**
   * Initialize manager
   */
  protected doInitialize(): void {
    this.logger('TerminalLinkManager initialized');
    terminalLogger.info('✅ TerminalLinkManager ready');
  }

  /**
   * Register link provider for file path detection
   */
  public registerTerminalLinkHandlers(terminal: Terminal, terminalId: string): void {
    try {
      const existingDisposable = this.linkProviderDisposables.get(terminalId);
      existingDisposable?.dispose();

      const disposable = terminal.registerLinkProvider({
        provideLinks: (bufferLineNumber, callback) => {
          try {
            const line = terminal.buffer.active.getLine(bufferLineNumber - 1);
            if (!line) {
              callback([]);
              return;
            }

            const text = line.translateToString(false);
            const links = this.extractFileLinks(text, bufferLineNumber, terminalId);
            callback(links);
          } catch (error) {
            terminalLogger.warn('⚠️ Failed to analyze terminal links:', error);
            callback([]);
          }
        },
      });

      this.linkProviderDisposables.set(terminalId, disposable);
      terminalLogger.debug(`Registered terminal link provider for ${terminalId}`);
    } catch (error) {
      terminalLogger.warn(`⚠️ Unable to register link provider for ${terminalId}:`, error);
    }
  }

  /**
   * Extract file links from terminal line
   */
  private extractFileLinks(text: string, bufferLineNumber: number, terminalId: string): ILink[] {
    const matches: ILink[] = [];
    const processed = new Set<string>();

    const evaluateRegex = (regex: RegExp) => {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const raw = match[0];
        const sanitizedResult = this.sanitizeLinkText(raw);
        if (!sanitizedResult) {
          continue;
        }

        const { text: sanitizedText, leadingOffset } = sanitizedResult;
        const key = `${match.index + leadingOffset}:${sanitizedText}`;
        if (processed.has(key)) {
          continue;
        }
        processed.add(key);

        const { path: candidatePath, line, column } = this.parseFileLink(sanitizedText);
        if (!candidatePath) {
          continue;
        }

        const absoluteIndex = match.index + leadingOffset;
        const startColumn = absoluteIndex + 1;
        const endColumn = startColumn + sanitizedText.length;

        matches.push({
          text: sanitizedText,
          range: {
            start: { x: startColumn, y: bufferLineNumber },
            end: { x: endColumn, y: bufferLineNumber },
          },
          activate: () => this.openFileFromTerminal(candidatePath, line, column, terminalId),
        });
      }
    };

    evaluateRegex(this.absoluteFilePathRegex);
    evaluateRegex(this.relativeFilePathRegex);

    return matches;
  }

  /**
   * Sanitize link text by removing surrounding quotes and brackets
   */
  private sanitizeLinkText(raw: string): { text: string; leadingOffset: number } | null {
    if (!raw) {
      return null;
    }

    let startOffset = 0;
    let endOffset = raw.length;

    const trimChars = new Set([
      "'",
      '"',
      '`',
      '(',
      ')',
      '[',
      ']',
      '<',
      '>',
      '{',
      '}',
      ' ',
      ',',
      '.',
      ';',
    ]);

    while (startOffset < endOffset) {
      const char = raw[startOffset];
      if (!char || !trimChars.has(char)) {
        break;
      }
      startOffset++;
    }

    while (endOffset > startOffset) {
      const char = raw[endOffset - 1];
      if (!char || !trimChars.has(char)) {
        break;
      }
      endOffset--;
    }

    if (startOffset >= endOffset) {
      return null;
    }

    const text = raw.substring(startOffset, endOffset);
    return text ? { text, leadingOffset: startOffset } : null;
  }

  /**
   * Parse file link to extract path, line number, and column number
   */
  private parseFileLink(linkText: string): { path: string | null; line?: number; column?: number } {
    if (!linkText || linkText.includes('://')) {
      return { path: null };
    }

    let candidate = linkText;
    let lineNumber: number | undefined;
    let columnNumber: number | undefined;

    let searchEnd = candidate.length;
    const numericSegments: number[] = [];

    while (searchEnd > 0) {
      const colonIndex = candidate.lastIndexOf(':', searchEnd - 1);
      if (colonIndex <= 0) {
        break;
      }

      const numericPart = candidate.substring(colonIndex + 1, searchEnd);
      if (!/^\d+$/.test(numericPart)) {
        break;
      }

      if (colonIndex === 1 && candidate[0] && /^[A-Za-z]$/.test(candidate[0])) {
        break;
      }

      numericSegments.unshift(Number.parseInt(numericPart, 10));
      searchEnd = colonIndex;
    }

    if (numericSegments.length > 0) {
      lineNumber = numericSegments[0];
      if (numericSegments.length > 1) {
        columnNumber = numericSegments[1];
      }
      candidate = candidate.substring(0, searchEnd);
    }

    candidate = candidate.trim();
    if (!candidate) {
      return { path: null };
    }

    return {
      path: this.isSupportedFilePath(candidate) ? candidate : null,
      line: lineNumber,
      column: columnNumber,
    };
  }

  /**
   * Check if candidate path is a supported file path
   */
  private isSupportedFilePath(candidate: string | null): string | null {
    if (!candidate) {
      return null;
    }

    const hasDirectory = candidate.includes('/') || candidate.includes('\\');
    if (!hasDirectory) {
      const extensionMatch = candidate.match(/\.([A-Za-z0-9]+)$/);
      if (!extensionMatch || !extensionMatch[1]) {
        return null;
      }

      const extension = extensionMatch[1].toLowerCase();
      if (!this.allowedFileExtensions.has(extension)) {
        return null;
      }
    }

    return candidate;
  }

  /**
   * Open URL from terminal
   */
  public openUrlFromTerminal(url: string, terminalId: string): void {
    this.coordinator?.postMessageToExtension({
      command: 'openTerminalLink',
      linkType: 'url',
      url,
      terminalId,
      timestamp: Date.now(),
    });
  }

  /**
   * Open file from terminal with optional line and column navigation
   */
  private openFileFromTerminal(
    filePath: string,
    lineNumber: number | undefined,
    columnNumber: number | undefined,
    terminalId: string
  ): void {
    this.coordinator?.postMessageToExtension({
      command: 'openTerminalLink',
      linkType: 'file',
      filePath,
      lineNumber,
      columnNumber,
      terminalId,
      timestamp: Date.now(),
    });
  }

  /**
   * Unregister link provider for a terminal
   */
  public unregisterTerminalLinkProvider(terminalId: string): void {
    const disposable = this.linkProviderDisposables.get(terminalId);
    if (disposable) {
      disposable.dispose();
      this.linkProviderDisposables.delete(terminalId);
      terminalLogger.debug(`Unregistered link provider for terminal: ${terminalId}`);
    }
  }

  /**
   * Get all registered terminal IDs
   */
  public getRegisteredTerminals(): string[] {
    return Array.from(this.linkProviderDisposables.keys());
  }

  /**
   * Cleanup and dispose all link providers
   * Called by BaseManager.dispose() for cleanup
   */
  protected doDispose(): void {
    try {
      this.linkProviderDisposables.forEach((disposable) => {
        disposable.dispose();
      });
      this.linkProviderDisposables.clear();
      terminalLogger.info('🧹 TerminalLinkManager disposed');
    } catch (error) {
      terminalLogger.error('Error disposing TerminalLinkManager:', error);
    }
  }
}
