/**
 * Terminal Focus Service
 *
 * Extracted from TerminalCreationService for better maintainability.
 * Handles terminal focus management and keyboard input initialization.
 */

import { Terminal } from '@xterm/xterm';
import { terminalLogger } from '../../utils/ManagerLogger';

const debugLog = (message: string, data?: unknown): void => {
  terminalLogger.debug(message, data);
};

/**
 * Service for managing terminal focus and keyboard input
 */
export class TerminalFocusService {
  /**
   * Ensure terminal receives keyboard focus
   * Critical fix: Properly focus xterm.js textarea for keyboard input
   *
   * Strategy:
   * 1. Wait for xterm.js to fully create the textarea DOM element
   * 2. Verify textarea exists before attempting focus
   * 3. Focus using both terminal.focus() and direct textarea.focus()
   * 4. Verify focus succeeded and log result
   *
   * This fixes the issue where terminal renders but doesn't accept keyboard input.
   */
  public ensureTerminalFocus(
    terminal: Terminal,
    terminalId: string,
    terminalContent: HTMLElement
  ): void {
    // Use requestAnimationFrame to ensure DOM is fully settled
    requestAnimationFrame(() => {
      try {
        // Find the xterm textarea
        const textarea = terminalContent.querySelector(
          '.xterm-helper-textarea'
        ) as HTMLTextAreaElement;

        if (!textarea) {
          // Retry once after a short delay if textarea doesn't exist yet
          setTimeout(() => {
            const retryTextarea = terminalContent.querySelector(
              '.xterm-helper-textarea'
            ) as HTMLTextAreaElement;
            if (retryTextarea) {
              this.focusTerminalTextarea(terminal, retryTextarea, terminalId);
            } else {
              terminalLogger.error(`xterm-helper-textarea never appeared for: ${terminalId}`);
            }
          }, 50);
          return;
        }

        this.focusTerminalTextarea(terminal, textarea, terminalId);
      } catch (error) {
        terminalLogger.error(`Failed to ensure terminal focus for ${terminalId}:`, error);
      }
    });
  }

  /**
   * Focus the terminal textarea and verify success
   */
  public focusTerminalTextarea(
    terminal: Terminal,
    textarea: HTMLTextAreaElement,
    terminalId: string
  ): void {
    try {
      debugLog(`[FOCUS-DEBUG] Attempting to focus ${terminalId}...`);

      // Focus using xterm.js API (preferred method)
      terminal.focus();
      debugLog(`[FOCUS-DEBUG] Called terminal.focus()`);

      // Double-check with direct textarea focus
      textarea.focus();
      debugLog(`[FOCUS-DEBUG] Called textarea.focus()`);

      // Verify focus succeeded
      setTimeout(() => {
        const hasFocus = document.activeElement === textarea;
        const activeTag = document.activeElement?.tagName;
        const activeClass = document.activeElement?.className;

        debugLog(`[FOCUS-DEBUG] Focus verification for ${terminalId}:`, {
          hasFocus,
          activeElement: `${activeTag}.${activeClass}`,
          textareaInDOM: document.body.contains(textarea),
          textareaVisible: textarea.offsetParent !== null,
        });

        if (hasFocus) {
          debugLog(`[FOCUS-DEBUG] Terminal focused successfully: ${terminalId}`);
          terminalLogger.info(`Terminal successfully focused and ready for input: ${terminalId}`);
        } else {
          console.warn(`[FOCUS-DEBUG] Focus failed for ${terminalId}`);

          console.warn(`   Active element: ${activeTag}.${activeClass}`);
          terminalLogger.warn(`Terminal focus verification failed for: ${terminalId}`);
          terminalLogger.warn(`   Active element: ${activeTag}.${activeClass}`);

          // One final focus attempt
          textarea.focus();
          debugLog(`[FOCUS-DEBUG] Retried textarea.focus()`);
        }
      }, 10);
    } catch (error) {
      console.error(`[FOCUS-DEBUG] Exception during focus:`, error);
      terminalLogger.error(`Failed to focus terminal textarea for ${terminalId}:`, error);
    }
  }

  /**
   * Setup container click handler for re-focusing terminal
   */
  public setupContainerFocusHandler(
    terminal: Terminal,
    terminalId: string,
    container: HTMLElement,
    terminalContent: HTMLElement
  ): void {
    container.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      // Keep header interactions (rename/edit controls) from being overridden by xterm focus.
      if (target.closest('.terminal-control')) return;
      if (target.closest('.terminal-header')) return;
      if (target.closest('.terminal-name-edit-input')) return;

      this.ensureTerminalFocus(terminal, terminalId, terminalContent);
    });
  }
}
