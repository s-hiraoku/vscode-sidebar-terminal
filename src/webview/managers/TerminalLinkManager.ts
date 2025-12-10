/**
 * Terminal Link Manager
 *
 * Handles file path and URL link detection in terminal output.
 * Follows VS Code standard terminal link behavior:
 * - Links require modifier key + click to activate (Cmd/Ctrl or Alt depending on settings)
 * - Hover shows underline and pointer cursor when modifier key is pressed
 * - Supports file paths with line:column navigation
 * - Supports multi-line URLs that wrap across terminal lines
 */

import { Terminal, type ILink, type IDisposable } from '@xterm/xterm';
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { terminalLogger } from '../utils/ManagerLogger';
import { BaseManager } from './BaseManager';
import { MultiLineUrlLinkProvider } from '../providers/MultiLineUrlLinkProvider';

/**
 * Parsed file link with optional line and column numbers
 */
interface ParsedFileLink {
  path: string;
  line?: number;
  column?: number;
}

/**
 * Terminal Link Manager
 *
 * Detects clickable file paths in terminal output and opens them in the editor.
 * URL links are handled separately by WebLinksAddon.
 *
 * VS Code Standard Behavior:
 * - When multiCursorModifier is 'alt', Cmd/Ctrl+Click opens links
 * - When multiCursorModifier is 'ctrlCmd', Alt+Click opens links
 * - Hover shows underline when modifier key is pressed
 */
export class TerminalLinkManager extends BaseManager {
  private readonly coordinator: IManagerCoordinator;
  private readonly linkProviderDisposables = new Map<string, IDisposable>();
  private readonly multiLineProviderDisposables = new Map<string, IDisposable>();
  private readonly multiLineProviders = new Map<string, MultiLineUrlLinkProvider>();

  // Current link modifier setting (updated when settings change)
  // 'alt' means Alt is for multi-cursor, so Cmd/Ctrl opens links
  // 'ctrlCmd' means Cmd/Ctrl is for multi-cursor, so Alt opens links
  private linkModifier: 'alt' | 'ctrlCmd' = 'alt';

  // Simple regex to match file paths
  // Matches: /path/to/file, ./relative/path, ../parent/path, C:\windows\path
  private readonly filePathRegex = /(?:\.{0,2}\/|[A-Za-z]:\\)[^\s"'<>()[\]{}|]+/g;

  constructor(coordinator: IManagerCoordinator) {
    super('TerminalLinkManager', {
      enableLogging: false,
      enablePerformanceTracking: true,
      enableErrorRecovery: true,
    });
    this.coordinator = coordinator;
  }

  /**
   * Update link modifier setting
   * Called when VS Code settings change
   */
  public setLinkModifier(modifier: 'alt' | 'ctrlCmd'): void {
    this.linkModifier = modifier;
    terminalLogger.info(`Link modifier updated to: ${modifier}`);

    // Update all multi-line URL providers with the new modifier
    this.multiLineProviders.forEach((provider) => {
      provider.setLinkModifier(modifier);
    });
  }

  /**
   * Check if the event has the required modifier key for link activation
   * VS Code uses the OPPOSITE modifier for links:
   * - When multiCursorModifier is 'alt', Cmd/Ctrl+Click opens links
   * - When multiCursorModifier is 'ctrlCmd', Alt+Click opens links
   */
  private isValidLinkActivation(event: MouseEvent | undefined): boolean {
    if (!event) return false;

    if (this.linkModifier === 'alt') {
      // Alt is for multi-cursor, so Cmd/Ctrl opens links
      return event.metaKey || event.ctrlKey;
    } else {
      // Cmd/Ctrl is for multi-cursor, so Alt opens links
      return event.altKey;
    }
  }

  protected doInitialize(): void {
    terminalLogger.info('TerminalLinkManager initialized');
  }

  /**
   * Register link provider for a terminal
   */
  public registerTerminalLinkHandlers(terminal: Terminal, terminalId: string): void {
    try {
      // Dispose existing providers if any
      this.linkProviderDisposables.get(terminalId)?.dispose();
      this.multiLineProviderDisposables.get(terminalId)?.dispose();

      // Register file path link provider
      const filePathDisposable = terminal.registerLinkProvider({
        provideLinks: (lineNumber, callback) => {
          const links = this.findLinksInLine(terminal, lineNumber, terminalId);
          callback(links);
        },
      });

      this.linkProviderDisposables.set(terminalId, filePathDisposable);

      // Register multi-line URL link provider
      // This handles URLs that wrap across multiple terminal lines
      const multiLineProvider = new MultiLineUrlLinkProvider(terminal, terminalId, {
        linkModifier: this.linkModifier,
        onUrlActivate: (url, tid) => {
          this.openUrlFromTerminal(url, tid);
        },
      });

      const multiLineDisposable = terminal.registerLinkProvider(multiLineProvider);
      this.multiLineProviderDisposables.set(terminalId, multiLineDisposable);
      this.multiLineProviders.set(terminalId, multiLineProvider);

      terminalLogger.debug(
        `Link providers registered for ${terminalId} (file paths + multi-line URLs)`
      );
    } catch (error) {
      terminalLogger.warn(`Failed to register link provider for ${terminalId}:`, error);
    }
  }

  /**
   * Find all file links in a terminal line
   */
  private findLinksInLine(terminal: Terminal, lineNumber: number, terminalId: string): ILink[] {
    try {
      const line = terminal.buffer.active.getLine(lineNumber - 1);
      if (!line) return [];

      const text = line.translateToString(false);
      return this.extractFileLinks(text, lineNumber, terminalId);
    } catch (error) {
      terminalLogger.warn('Error finding links:', error);
      return [];
    }
  }

  /**
   * Extract file links from text
   * Returns ILink objects with VS Code standard behavior:
   * - activate: Opens file only when modifier key is pressed
   * - decorations: Shows underline and pointer cursor
   * - hover/leave: Visual feedback for link state
   */
  private extractFileLinks(text: string, lineNumber: number, terminalId: string): ILink[] {
    const links: ILink[] = [];
    const seen = new Set<string>();

    this.filePathRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = this.filePathRegex.exec(text)) !== null) {
      const raw = match[0];
      const cleaned = this.cleanLinkText(raw);
      if (!cleaned) continue;

      // Avoid duplicates
      const key = `${match.index}:${cleaned}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Parse path and optional line:column
      const parsed = this.parseFileLink(cleaned);
      if (!parsed) continue;

      // Calculate link position
      const startX = match.index + 1;
      const endX = startX + cleaned.length;

      // Create link with VS Code standard behavior
      const link: ILink = {
        text: cleaned,
        range: {
          start: { x: startX, y: lineNumber },
          end: { x: endX, y: lineNumber },
        },
        // VS Code standard: show underline and pointer cursor when hovering
        decorations: {
          pointerCursor: true,
          underline: true,
        },
        // Activate only when modifier key is pressed (VS Code standard)
        activate: (event: MouseEvent, linkText: string) => {
          // Check if the correct modifier key is pressed
          if (!this.isValidLinkActivation(event)) {
            terminalLogger.debug(
              `Link activation blocked - modifier key not pressed: ${linkText}`
            );
            return;
          }

          terminalLogger.info(
            `🔗 File link activated: ${linkText} (meta=${event.metaKey}, ctrl=${event.ctrlKey}, alt=${event.altKey})`
          );
          this.openFile(parsed, terminalId);
        },
        // Optional: hover callback for additional visual feedback
        hover: (_event: MouseEvent, _linkText: string) => {
          // xterm.js handles the visual decorations automatically
          // This callback can be used for additional hover effects if needed
        },
        // Optional: leave callback for cleanup
        leave: (_event: MouseEvent, _linkText: string) => {
          // Cleanup any additional hover effects if needed
        },
      };

      links.push(link);
    }

    return links;
  }

  /**
   * Clean trailing punctuation and brackets from link text
   */
  private cleanLinkText(text: string): string | null {
    if (!text) return null;

    // Remove trailing punctuation that's likely not part of the path
    let cleaned = text.replace(/[,;:.'"`)\]}>]+$/, '');

    // Handle matched brackets/quotes at the end
    const brackets: Record<string, string> = { ')': '(', ']': '[', '}': '{', '>': '<' };
    while (cleaned.length > 0) {
      const lastChar = cleaned[cleaned.length - 1];
      if (lastChar === undefined) break;
      const openChar = brackets[lastChar];
      if (openChar && !cleaned.includes(openChar)) {
        cleaned = cleaned.slice(0, -1);
      } else {
        break;
      }
    }

    return cleaned || null;
  }

  /**
   * Parse file path with optional :line:column suffix
   *
   * Examples:
   *   /path/to/file.ts        -> { path: '/path/to/file.ts' }
   *   /path/to/file.ts:10     -> { path: '/path/to/file.ts', line: 10 }
   *   /path/to/file.ts:10:5   -> { path: '/path/to/file.ts', line: 10, column: 5 }
   *   C:\path\file.ts         -> { path: 'C:\path\file.ts' }
   */
  private parseFileLink(text: string): ParsedFileLink | null {
    // Skip URLs
    if (text.includes('://')) return null;

    // Match path with optional :line:column at the end
    const match = text.match(/^(.+?)(?::(\d+)(?::(\d+))?)?$/);
    if (!match || !match[1]) return null;

    const path = match[1];

    // Validate it looks like a file path
    if (!this.isValidFilePath(path)) return null;

    return {
      path,
      line: match[2] ? parseInt(match[2], 10) : undefined,
      column: match[3] ? parseInt(match[3], 10) : undefined,
    };
  }

  /**
   * Check if a string looks like a valid file path
   */
  private isValidFilePath(path: string): boolean {
    // Must start with /, ./, ../, or drive letter
    const hasPathPrefix = /^(\/|\.\.?\/|[A-Za-z]:\\)/.test(path);
    if (!hasPathPrefix) return false;

    // Must have at least one path separator
    const hasPathSeparator = path.includes('/') || path.includes('\\');
    return hasPathSeparator;
  }

  /**
   * Open a file in the editor
   */
  private openFile(link: ParsedFileLink, terminalId: string): void {
    this.coordinator?.postMessageToExtension({
      command: 'openTerminalLink',
      linkType: 'file',
      filePath: link.path,
      lineNumber: link.line,
      columnNumber: link.column,
      terminalId,
      timestamp: Date.now(),
    });
  }

  /**
   * Open a URL in the browser (kept for compatibility)
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
   * Unregister link provider for a terminal
   */
  public unregisterTerminalLinkProvider(terminalId: string): void {
    // Dispose file path link provider
    const disposable = this.linkProviderDisposables.get(terminalId);
    if (disposable) {
      disposable.dispose();
      this.linkProviderDisposables.delete(terminalId);
    }

    // Dispose multi-line URL link provider
    const multiLineDisposable = this.multiLineProviderDisposables.get(terminalId);
    if (multiLineDisposable) {
      multiLineDisposable.dispose();
      this.multiLineProviderDisposables.delete(terminalId);
    }
    this.multiLineProviders.delete(terminalId);
  }

  /**
   * Get all registered terminal IDs
   */
  public getRegisteredTerminals(): string[] {
    return Array.from(this.linkProviderDisposables.keys());
  }

  protected doDispose(): void {
    this.linkProviderDisposables.forEach((d) => d.dispose());
    this.linkProviderDisposables.clear();

    this.multiLineProviderDisposables.forEach((d) => d.dispose());
    this.multiLineProviderDisposables.clear();
    this.multiLineProviders.clear();

    terminalLogger.info('TerminalLinkManager disposed');
  }
}
