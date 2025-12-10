/**
 * Multi-Line URL Link Provider
 *
 * Detects and handles URLs that wrap across multiple terminal lines.
 * Uses VS Code-style approach: scans wrapped lines using `line.isWrapped`
 * property to reconstruct full URLs before matching.
 *
 * This provider complements WebLinksAddon which only handles single-line URLs.
 *
 * @see https://github.com/xtermjs/xterm.js/issues/4296
 */

import { Terminal, ILinkProvider, ILink } from '@xterm/xterm';
import { terminalLogger } from '../utils/ManagerLogger';

/**
 * Configuration for multi-line URL detection
 */
export interface MultiLineUrlConfig {
  /**
   * Maximum number of wrapped lines to scan (default: 10)
   * Prevents excessive scanning for very long outputs
   */
  maxWrappedLines?: number;

  /**
   * Link modifier for activation (VS Code standard)
   * - 'alt': Alt+Click activates links
   * - 'ctrlCmd': Cmd/Ctrl+Click activates links
   */
  linkModifier?: 'alt' | 'ctrlCmd';

  /**
   * Callback when URL is activated
   */
  onUrlActivate?: (url: string, terminalId: string) => void;
}

/**
 * Detected URL with position information
 */
interface DetectedUrl {
  url: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/**
 * Multi-Line URL Link Provider
 *
 * Implements ILinkProvider to detect URLs spanning multiple wrapped lines.
 */
export class MultiLineUrlLinkProvider implements ILinkProvider {
  private readonly terminal: Terminal;
  private readonly terminalId: string;
  private readonly config: Required<MultiLineUrlConfig>;

  // URL regex that matches common URL patterns
  // More permissive than WebLinksAddon to catch partial matches
  private readonly urlStartRegex = /https?:\/\/[^\s<>"'`)\]}>]*/gi;

  // Characters that are valid in URLs but often appear at boundaries
  private readonly trailingPunctuation = /[.,;:!?)>\]}"']+$/;

  constructor(terminal: Terminal, terminalId: string, config: MultiLineUrlConfig = {}) {
    this.terminal = terminal;
    this.terminalId = terminalId;
    this.config = {
      maxWrappedLines: config.maxWrappedLines ?? 10,
      linkModifier: config.linkModifier ?? 'ctrlCmd',
      onUrlActivate: config.onUrlActivate ?? (() => {}),
    };
  }

  /**
   * ILinkProvider implementation - called by xterm.js when mouse moves over a line
   */
  public provideLinks(
    lineNumber: number,
    callback: (links: ILink[] | undefined) => void
  ): void {
    try {
      const links = this.findMultiLineUrls(lineNumber);
      callback(links.length > 0 ? links : undefined);
    } catch (error) {
      terminalLogger.warn(`Error finding multi-line URLs at line ${lineNumber}:`, error);
      callback(undefined);
    }
  }

  /**
   * Find multi-line URLs that include the specified line
   */
  private findMultiLineUrls(lineNumber: number): ILink[] {
    const buffer = this.terminal.buffer.active;
    const bufferLineIndex = lineNumber - 1; // Convert to 0-based

    // Get the line and check if it's part of a wrapped sequence
    const line = buffer.getLine(bufferLineIndex);
    if (!line) return [];

    // Find the start of the wrapped line sequence
    const { startLineIndex, combinedText, lineOffsets } = this.getWrappedLineSequence(
      bufferLineIndex
    );

    // Find all URLs in the combined text
    const detectedUrls = this.detectUrlsInText(combinedText, startLineIndex, lineOffsets);

    // Filter to URLs that include our target line and convert to ILink
    return detectedUrls
      .filter((detected) => {
        // Include URL if it spans across our target line
        return detected.startLine <= lineNumber && detected.endLine >= lineNumber;
      })
      .map((detected) => this.createLink(detected));
  }

  /**
   * Get the combined text of a wrapped line sequence
   *
   * Returns the starting line index, combined text, and offsets for each line
   */
  private getWrappedLineSequence(
    bufferLineIndex: number
  ): {
    startLineIndex: number;
    combinedText: string;
    lineOffsets: Array<{ lineIndex: number; startOffset: number; length: number }>;
  } {
    const buffer = this.terminal.buffer.active;
    const lineOffsets: Array<{ lineIndex: number; startOffset: number; length: number }> = [];

    // Find the start of the wrapped sequence by scanning backwards
    let startLineIndex = bufferLineIndex;
    for (let i = bufferLineIndex; i > 0 && i > bufferLineIndex - this.config.maxWrappedLines; i--) {
      const prevLine = buffer.getLine(i);
      if (!prevLine || !prevLine.isWrapped) {
        startLineIndex = prevLine?.isWrapped ? i : i;
        break;
      }
      startLineIndex = i - 1;
    }

    // Adjust: if the line at startLineIndex is wrapped, go back one more
    const startLine = buffer.getLine(startLineIndex);
    if (startLine?.isWrapped && startLineIndex > 0) {
      const prevLine = buffer.getLine(startLineIndex - 1);
      if (prevLine && !prevLine.isWrapped) {
        // prevLine is the actual start
      }
    }

    // Actually find the true start (first non-wrapped line going backwards)
    let trueStart = bufferLineIndex;
    for (let i = bufferLineIndex; i >= 0; i--) {
      const line = buffer.getLine(i);
      if (!line) break;
      if (!line.isWrapped) {
        trueStart = i;
        break;
      }
      if (i === 0) {
        trueStart = 0;
      }
    }
    startLineIndex = trueStart;

    // Combine text from start through all wrapped lines
    let combinedText = '';
    let currentOffset = 0;

    for (
      let i = startLineIndex;
      i < buffer.length && i <= startLineIndex + this.config.maxWrappedLines;
      i++
    ) {
      const line = buffer.getLine(i);
      if (!line) break;

      // After the first line, only continue if this line is wrapped
      if (i > startLineIndex && !line.isWrapped) break;

      const lineText = line.translateToString(false);
      lineOffsets.push({
        lineIndex: i,
        startOffset: currentOffset,
        length: lineText.length,
      });

      combinedText += lineText;
      currentOffset += lineText.length;
    }

    return { startLineIndex, combinedText, lineOffsets };
  }

  /**
   * Detect URLs in the combined text and map back to line positions
   */
  private detectUrlsInText(
    text: string,
    startLineIndex: number,
    lineOffsets: Array<{ lineIndex: number; startOffset: number; length: number }>
  ): DetectedUrl[] {
    const urls: DetectedUrl[] = [];

    this.urlStartRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = this.urlStartRegex.exec(text)) !== null) {
      let url = match[0];

      // Clean trailing punctuation
      url = url.replace(this.trailingPunctuation, '');

      // Validate URL
      if (!this.isValidUrl(url)) continue;

      // Skip if this is a single-line URL (WebLinksAddon handles those)
      const startOffset = match.index;
      const endOffset = startOffset + url.length;

      const startPos = this.offsetToPosition(startOffset, lineOffsets, startLineIndex);
      const endPos = this.offsetToPosition(endOffset - 1, lineOffsets, startLineIndex);

      // Only include if URL spans multiple lines
      if (startPos.line !== endPos.line) {
        urls.push({
          url,
          startLine: startPos.line,
          startColumn: startPos.column,
          endLine: endPos.line,
          endColumn: endPos.column + 1, // End column is exclusive
        });
      }
    }

    return urls;
  }

  /**
   * Convert text offset to line/column position
   */
  private offsetToPosition(
    offset: number,
    lineOffsets: Array<{ lineIndex: number; startOffset: number; length: number }>,
    startLineIndex: number
  ): { line: number; column: number } {
    for (const lineInfo of lineOffsets) {
      if (offset >= lineInfo.startOffset && offset < lineInfo.startOffset + lineInfo.length) {
        return {
          line: lineInfo.lineIndex + 1, // Convert to 1-based
          column: offset - lineInfo.startOffset + 1, // Convert to 1-based
        };
      }
    }

    // Fallback to last line
    const lastLine = lineOffsets[lineOffsets.length - 1];
    if (lastLine) {
      return {
        line: lastLine.lineIndex + 1,
        column: lastLine.length,
      };
    }

    return { line: startLineIndex + 1, column: 1 };
  }

  /**
   * Validate that a string is a valid URL
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      // Only allow http/https
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Check if modifier key is pressed for link activation
   */
  private isValidLinkActivation(event: MouseEvent): boolean {
    if (this.config.linkModifier === 'alt') {
      return event.metaKey || event.ctrlKey;
    } else {
      return event.altKey;
    }
  }

  /**
   * Create an ILink from detected URL
   */
  private createLink(detected: DetectedUrl): ILink {
    return {
      text: detected.url,
      range: {
        start: { x: detected.startColumn, y: detected.startLine },
        end: { x: detected.endColumn, y: detected.endLine },
      },
      decorations: {
        pointerCursor: true,
        underline: true,
      },
      activate: (event: MouseEvent, linkText: string) => {
        if (!this.isValidLinkActivation(event)) {
          terminalLogger.debug(
            `Multi-line URL activation blocked - modifier key not pressed: ${linkText}`
          );
          return;
        }

        terminalLogger.info(
          `🔗 Multi-line URL activated: ${linkText} (spans lines ${detected.startLine}-${detected.endLine})`
        );
        this.config.onUrlActivate(detected.url, this.terminalId);
      },
    };
  }

  /**
   * Update link modifier setting
   */
  public setLinkModifier(modifier: 'alt' | 'ctrlCmd'): void {
    this.config.linkModifier = modifier;
  }
}
