/**
 * Selection Utilities
 *
 * Handles terminal text selection with fixes for xterm.js wrapped line issues
 * AND shell multi-line command continuation issues.
 *
 * Two problems addressed:
 * 1. xterm.js issue #443: Visual wrapping adds false newlines
 * 2. Shell continuation: Zsh/bash multi-line entry adds newlines within commands
 *
 * @see https://github.com/xtermjs/xterm.js/issues/443
 */

import { Terminal } from '@xterm/xterm';

/**
 * Get cleaned selection text from terminal
 *
 * Fixes both xterm.js visual wrapping issues and shell continuation line issues.
 * When copying a multi-line command from the terminal, this removes newlines
 * that break the command when pasted.
 *
 * @param terminal - The xterm.js Terminal instance
 * @returns Cleaned selection text, or null if no selection
 */
export function getCleanedSelection(terminal: Terminal): string | null {
  if (!terminal.hasSelection()) {
    return null;
  }

  const rawSelection = terminal.getSelection();
  if (!rawSelection) {
    return null;
  }

  return cleanWrappedLineSelection(terminal, rawSelection);
}

/**
 * Check if a line looks like a shell continuation (starts with whitespace only)
 * This handles zsh/bash multi-line command entry where continuation lines
 * are indented with spaces.
 */
function isShellContinuationLine(lineText: string): boolean {
  // Shell continuation lines typically start with spaces (zsh uses 2 spaces)
  // and don't have a prompt character like % or $ or >
  const trimmed = lineText.trimStart();

  // If line starts with whitespace and the trimmed content looks like
  // it could be part of a command (not starting with prompt chars)
  if (lineText.length > 0 && lineText !== trimmed) {
    // Count leading spaces
    const leadingSpaces = lineText.length - trimmed.length;
    // zsh typically uses 2 spaces for continuation
    if (leadingSpaces >= 2 && trimmed.length > 0) {
      // Make sure it doesn't look like a new command (no prompt chars at start)
      // and doesn't look like shell output
      const firstChar = trimmed[0];
      const isNotPrompt = firstChar !== '%' && firstChar !== '$' && firstChar !== '>';
      return isNotPrompt;
    }
  }
  return false;
}

/**
 * Clean wrapped line selection by removing false newlines
 *
 * Handles two cases:
 * 1. xterm.js visual wrapping (isWrapped=true)
 * 2. Shell continuation lines (lines starting with whitespace)
 *
 * @param terminal - The xterm.js Terminal instance
 * @param rawSelection - The raw selection text from getSelection()
 * @returns Cleaned selection text with false newlines removed
 */
export function cleanWrappedLineSelection(terminal: Terminal, rawSelection: string): string {
  const selectionPosition = terminal.getSelectionPosition();
  if (!selectionPosition) {
    return rawSelection;
  }

  const buffer = terminal.buffer.active;
  const startY = selectionPosition.start.y;
  const endY = selectionPosition.end.y;

  // If selection is on a single line, no wrapped line handling needed
  if (startY === endY) {
    return rawSelection;
  }

  // Split the selection into lines
  const lines = rawSelection.split('\n');

  // If the split doesn't match expected line count, fall back to raw
  // (this can happen with edge cases)
  const expectedLines = endY - startY + 1;
  if (lines.length !== expectedLines) {
    return rawSelection;
  }

  // Build cleaned selection by checking isWrapped AND shell continuation patterns
  const cleanedParts: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined) {
      // For continuation lines, trim the leading whitespace since we're joining
      if (i > 0) {
        const bufferLineIndex = startY - 1 + i;
        const bufferLine = buffer.getLine(bufferLineIndex);
        if (bufferLine) {
          const bufLineText = bufferLine.translateToString(true);
          if (isShellContinuationLine(bufLineText)) {
            // This is a continuation line - trim leading spaces
            cleanedParts.push(line.trimStart());
          } else {
            cleanedParts.push(line);
          }
        } else {
          cleanedParts.push(line);
        }
      } else {
        cleanedParts.push(line);
      }
    }

    // If this is the last line, don't add any separator
    if (i === lines.length - 1) {
      break;
    }

    // Check if the NEXT line is wrapped or is a shell continuation
    const nextBufferLineIndex = startY - 1 + i + 1;
    const nextBufferLine = buffer.getLine(nextBufferLineIndex);

    if (nextBufferLine) {
      const nextLineText = nextBufferLine.translateToString(true);
      const isXtermWrapped = nextBufferLine.isWrapped;
      const isShellContinuation = isShellContinuationLine(nextLineText);

      if (isXtermWrapped || isShellContinuation) {
        // Either visual wrap or shell continuation - remove the newline
        // Add a space as separator for shell continuations
        if (isShellContinuation && !isXtermWrapped) {
          cleanedParts.push(' ');
        }
        // For xterm wrapped lines, don't add anything (text continues directly)
      } else {
        // Real newline - keep it
        cleanedParts.push('\n');
      }
    } else {
      // Couldn't get buffer line, keep newline to be safe
      cleanedParts.push('\n');
    }
  }

  return cleanedParts.join('');
}
