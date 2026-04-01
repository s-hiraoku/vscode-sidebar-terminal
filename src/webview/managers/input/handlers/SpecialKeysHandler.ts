/**
 * SpecialKeysHandler - Handles special key combinations for terminal operations
 *
 * Extracted from InputManager to reduce method size and improve testability.
 * Contains:
 * - handleSpecialKeys: Process Ctrl+C/V, Cmd+C/V, Insert shortcuts, Shift+Enter etc.
 *
 * Respects IME composition state and VS Code keybinding conventions.
 */

import { TerminalInteractionEvent } from '../../../../types/common';
import { IManagerCoordinator } from '../../../interfaces/ManagerInterfaces';
import { isMacPlatform } from '../../../utils/PlatformUtils';

/**
 * Keyboard event constants
 */
const KeyboardConstants = {
  /** IME composition keycode (when IME is processing input) */
  IME_COMPOSITION_KEYCODE: 229,
} as const;

/**
 * Dependencies required by SpecialKeysHandler from InputManager
 */
export interface ISpecialKeysHandlerDeps {
  /** Logger function */
  logger: (message: string, ...args: unknown[]) => void;
  /** Check if IME is currently composing */
  isIMEComposing: () => boolean;
  /** Handle terminal copy operation */
  handleTerminalCopy: (manager: IManagerCoordinator) => void;
  /** Handle terminal paste operation */
  handleTerminalPaste: (manager: IManagerCoordinator) => void;
  /** Emit terminal interaction event */
  emitTerminalInteractionEvent: (
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data: unknown,
    manager: IManagerCoordinator
  ) => void;
  /** Queue input data to be sent to the terminal */
  queueInputData: (terminalId: string, data: string, flushImmediately: boolean) => void;
  /** Get terminal instance by ID (via manager) */
  getTerminalInstance: (
    terminalId: string
  ) => { terminal: { hasSelection(): boolean } } | null | undefined;
}

/**
 * SpecialKeysHandler - Manages special key combinations for terminal operations
 */
export class SpecialKeysHandler {
  constructor(private readonly deps: ISpecialKeysHandlerDeps) {}

  /**
   * Handle special key combinations for terminal operations with IME awareness
   */
  public handleSpecialKeys(
    event: KeyboardEvent,
    terminalId: string,
    manager: IManagerCoordinator
  ): boolean {
    // VS Code standard: Check IME composition state first
    if (this.deps.isIMEComposing()) {
      this.deps.logger(`Special key ${event.key} blocked during IME composition`);
      return false;
    }

    // Check for KEY_IN_COMPOSITION (VS Code standard)
    if (event.keyCode === KeyboardConstants.IME_COMPOSITION_KEYCODE) {
      this.deps.logger('KEY_IN_COMPOSITION in special keys - blocking');
      event.stopPropagation();
      return true;
    }

    // Ctrl+C (Windows/Linux) or Cmd+C (macOS): Copy (if selection exists) or interrupt
    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
      const terminal = this.deps.getTerminalInstance(terminalId);
      if (terminal && terminal.terminal.hasSelection()) {
        this.deps.logger(`${event.metaKey ? 'Cmd' : 'Ctrl'}+C copy for terminal ${terminalId}`);
        event.preventDefault();
        event.stopPropagation();
        this.deps.handleTerminalCopy(manager);
        return true;
      }
      // Send interrupt signal (only on Ctrl+C, not Cmd+C on macOS)
      if (!event.metaKey) {
        this.deps.logger(`Ctrl+C interrupt for terminal ${terminalId}`);
        this.deps.emitTerminalInteractionEvent('interrupt', terminalId, undefined, manager);
        return true;
      }
    }

    // Paste handling: Let paste event handler deal with it
    const isMac = isMacPlatform();
    if (event.key === 'v') {
      if (isMac && event.metaKey) {
        this.deps.logger(`Cmd+V on macOS - letting paste event handler process`);
        return false;
      } else if (!isMac && event.ctrlKey) {
        this.deps.logger(`Ctrl+V on non-Mac - letting paste event handler process`);
        return false;
      }
    }

    // Ctrl+Insert (Windows/Linux): Copy - VS Code standard shortcut
    if (event.ctrlKey && event.key === 'Insert') {
      const terminal = this.deps.getTerminalInstance(terminalId);
      if (terminal && terminal.terminal.hasSelection()) {
        this.deps.logger(`Ctrl+Insert copy for terminal ${terminalId}`);
        event.preventDefault();
        event.stopPropagation();
        this.deps.handleTerminalCopy(manager);
        return true;
      }
    }

    // Shift+Insert (Windows/Linux): Paste - VS Code standard shortcut
    if (event.shiftKey && event.key === 'Insert') {
      this.deps.logger(`Shift+Insert paste for terminal ${terminalId}`);
      event.preventDefault();
      event.stopPropagation();
      this.deps.handleTerminalPaste(manager);
      return true;
    }

    // Shift+Enter or Option/Alt+Enter: Send newline for Claude Code multiline input
    if (event.key === 'Enter' && (event.shiftKey || event.altKey || event.metaKey)) {
      this.deps.logger(
        `${event.shiftKey ? 'Shift' : event.altKey ? 'Alt' : 'Cmd'}+Enter - sending newline for multiline input`
      );
      event.preventDefault();
      event.stopPropagation();
      this.deps.queueInputData(terminalId, '\n', true);
      return true;
    }

    return false;
  }
}
