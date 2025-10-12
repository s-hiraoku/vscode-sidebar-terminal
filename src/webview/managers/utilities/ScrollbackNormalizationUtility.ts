/**
 * Scrollback Normalization Utility
 *
 * Provides scrollback data transformation and normalization functions
 */

/**
 * Scrollback line format
 */
export interface ScrollbackLine {
  content: string;
  type?: 'output' | 'input' | 'error';
  timestamp?: number;
}

/**
 * Scrollback Normalization Utility
 *
 * Centralized scrollback data transformation logic
 */
export class ScrollbackNormalizationUtility {
  /**
   * Normalize scrollback content to consistent format
   *
   * Handles both string arrays and object arrays
   */
  public static normalizeScrollbackContent(
    scrollbackContent: unknown
  ): ScrollbackLine[] {
    if (!Array.isArray(scrollbackContent) || scrollbackContent.length === 0) {
      return [];
    }

    // Check if it's string array
    if (typeof scrollbackContent[0] === 'string') {
      return this.normalizeStringArray(scrollbackContent as string[]);
    }

    // Already in object format, normalize type field
    return this.normalizeObjectArray(scrollbackContent);
  }

  /**
   * Normalize string array to ScrollbackLine array
   */
  private static normalizeStringArray(lines: string[]): ScrollbackLine[] {
    return lines.map((line) => ({
      content: line,
      type: 'output' as const,
    }));
  }

  /**
   * Normalize object array to ScrollbackLine array
   */
  private static normalizeObjectArray(lines: unknown[]): ScrollbackLine[] {
    return lines
      .filter((item): item is Record<string, unknown> => {
        return (
          typeof item === 'object' &&
          item !== null &&
          'content' in item &&
          typeof (item as any).content === 'string'
        );
      })
      .map((item) => {
        const type = (item as any).type;
        const normalizedType =
          type === 'input' || type === 'error' ? type : ('output' as const);

        return {
          content: (item as any).content,
          type: normalizedType,
          timestamp: (item as any).timestamp,
        };
      });
  }

  /**
   * Format scrollback lines for transfer
   *
   * Converts ScrollbackLine array to format suitable for message passing
   */
  public static formatScrollbackForTransfer(lines: ScrollbackLine[]): ScrollbackLine[] {
    return lines.map((line) => ({
      content: line.content,
      type: line.type || 'output',
      ...(line.timestamp && { timestamp: line.timestamp }),
    }));
  }

  /**
   * Convert scrollback to simple string array
   *
   * Useful for legacy compatibility or simple storage
   */
  public static toStringArray(lines: ScrollbackLine[]): string[] {
    return lines.map((line) => line.content);
  }

  /**
   * Filter empty lines from scrollback
   *
   * @param lines - Scrollback lines to filter
   * @param keepStructuralEmpty - Whether to keep empty lines that maintain structure
   */
  public static filterEmptyLines(
    lines: ScrollbackLine[],
    keepStructuralEmpty: boolean = false
  ): ScrollbackLine[] {
    if (keepStructuralEmpty) {
      // Keep empty lines that are surrounded by content
      const result: ScrollbackLine[] = [];
      let hasContent = false;

      for (const line of lines) {
        if (line.content.trim()) {
          hasContent = true;
          result.push(line);
        } else if (hasContent) {
          result.push(line);
        }
      }

      // Remove trailing empty lines
      while (result.length > 0) {
        const lastLine = result[result.length - 1];
        if (lastLine && !lastLine.content.trim()) {
          result.pop();
        } else {
          break;
        }
      }

      return result;
    }

    // Remove all empty lines
    return lines.filter((line) => line.content.trim());
  }

  /**
   * Truncate scrollback to maximum number of lines
   *
   * @param lines - Scrollback lines to truncate
   * @param maxLines - Maximum number of lines to keep
   * @param fromEnd - If true, keep last N lines; if false, keep first N lines
   */
  public static truncate(
    lines: ScrollbackLine[],
    maxLines: number,
    fromEnd: boolean = true
  ): ScrollbackLine[] {
    if (lines.length <= maxLines) {
      return lines;
    }

    if (fromEnd) {
      return lines.slice(-maxLines);
    }

    return lines.slice(0, maxLines);
  }

  /**
   * Merge multiple scrollback arrays
   *
   * Combines multiple scrollback arrays in order
   */
  public static merge(...scrollbackArrays: ScrollbackLine[][]): ScrollbackLine[] {
    const result: ScrollbackLine[] = [];

    for (const scrollback of scrollbackArrays) {
      result.push(...scrollback);
    }

    return result;
  }

  /**
   * Validate scrollback line
   *
   * Checks if a line has valid structure
   */
  public static isValidLine(line: unknown): line is ScrollbackLine {
    if (typeof line !== 'object' || line === null) {
      return false;
    }

    const obj = line as Record<string, unknown>;

    // Must have content field
    if (typeof obj.content !== 'string') {
      return false;
    }

    // Type field is optional but must be valid if present
    if (obj.type !== undefined) {
      const type = obj.type;
      if (type !== 'output' && type !== 'input' && type !== 'error') {
        return false;
      }
    }

    // Timestamp is optional but must be number if present
    if (obj.timestamp !== undefined && typeof obj.timestamp !== 'number') {
      return false;
    }

    return true;
  }

  /**
   * Sanitize scrollback content
   *
   * Removes invalid lines and normalizes valid ones
   */
  public static sanitize(lines: unknown[]): ScrollbackLine[] {
    return lines.filter(this.isValidLine).map((line) => ({
      content: line.content,
      type: line.type || 'output',
      ...(line.timestamp && { timestamp: line.timestamp }),
    }));
  }
}
