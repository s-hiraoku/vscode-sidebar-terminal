/**
 * Terminal Focus Service
 *
 * Extracted from TerminalCreationService for better maintainability.
 * Handles terminal focus management and keyboard input initialization.
 */

import { Terminal } from '@xterm/xterm';
import { terminalLogger } from '../../utils/ManagerLogger';

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
      // eslint-disable-next-line no-console
      console.log(`[FOCUS-DEBUG] Attempting to focus ${terminalId}...`);

      // Focus using xterm.js API (preferred method)
      terminal.focus();
      // eslint-disable-next-line no-console
      console.log(`[FOCUS-DEBUG] Called terminal.focus()`);

      // Double-check with direct textarea focus
      textarea.focus();
      // eslint-disable-next-line no-console
      console.log(`[FOCUS-DEBUG] Called textarea.focus()`);

      // Verify focus succeeded
      setTimeout(() => {
        const hasFocus = document.activeElement === textarea;
        const activeTag = document.activeElement?.tagName;
        const activeClass = document.activeElement?.className;

        // eslint-disable-next-line no-console
        console.log(`[FOCUS-DEBUG] Focus verification for ${terminalId}:`, {
          hasFocus,
          activeElement: `${activeTag}.${activeClass}`,
          textareaInDOM: document.body.contains(textarea),
          textareaVisible: textarea.offsetParent !== null,
        });

        if (hasFocus) {
          // eslint-disable-next-line no-console
          console.log(`[FOCUS-DEBUG] Terminal focused successfully: ${terminalId}`);
          terminalLogger.info(`Terminal successfully focused and ready for input: ${terminalId}`);

          // Test: Simulate a keystroke to verify input handler
          setTimeout(() => {
            // eslint-disable-next-line no-console
            console.log(`[FOCUS-DEBUG] Testing input by simulating 'a' key...`);
            const event = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' });
            textarea.dispatchEvent(event);
          }, 100);
        } else {
          // eslint-disable-next-line no-console
          console.warn(`[FOCUS-DEBUG] Focus failed for ${terminalId}`);
          // eslint-disable-next-line no-console
          console.warn(`   Active element: ${activeTag}.${activeClass}`);
          terminalLogger.warn(`Terminal focus verification failed for: ${terminalId}`);
          terminalLogger.warn(`   Active element: ${activeTag}.${activeClass}`);

          // One final focus attempt
          textarea.focus();
          // eslint-disable-next-line no-console
          console.log(`[FOCUS-DEBUG] Retried textarea.focus()`);
        }
      }, 10);
    } catch (error) {
      // eslint-disable-next-line no-console
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
      // Don't focus if clicking on buttons
      if (!target.closest('.terminal-control')) {
        this.ensureTerminalFocus(terminal, terminalId, terminalContent);
      }
    });
  }
}
