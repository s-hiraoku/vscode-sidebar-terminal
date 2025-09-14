/**
 * Input Handler Interfaces - Defines contracts for input handling components
 */

import { IManagerCoordinator } from '../../../interfaces/ManagerInterfaces';
import { PartialTerminalSettings } from '../../../../types/common';

/**
 * Base interface for all input handlers
 */
export interface IInputHandler {
  /**
   * Initialize the handler
   */
  initialize(): void;

  /**
   * Dispose of resources
   */
  dispose(): void;
}

/**
 * Keyboard shortcut handler interface
 */
export interface IKeyboardShortcutHandler extends IInputHandler {
  /**
   * Setup keyboard shortcuts for terminal navigation
   */
  setupKeyboardShortcuts(manager: IManagerCoordinator): void;

  /**
   * Update keybinding settings
   */
  updateKeybindingSettings(settings: {
    sendKeybindingsToShell?: boolean;
    commandsToSkipShell?: string[];
    allowChords?: boolean;
    allowMnemonics?: boolean;
  }): void;

  /**
   * Handle legacy shortcuts for backward compatibility
   */
  handleLegacyShortcuts(event: KeyboardEvent, manager: IManagerCoordinator): void;
}

/**
 * IME composition handler interface
 */
export interface IIMEHandler extends IInputHandler {
  /**
   * Setup IME composition handling
   */
  setupIMEHandling(): void;

  /**
   * Check if IME is currently composing
   */
  isIMEComposing(): boolean;

  /**
   * Clear any pending input events that might conflict with IME
   */
  clearPendingInputEvents(): void;
}

/**
 * Alt+Click handler interface
 */
export interface IAltClickHandler extends IInputHandler {
  /**
   * Setup Alt key visual feedback
   */
  setupAltKeyVisualFeedback(): void;

  /**
   * Check if VS Code Alt+Click is enabled
   */
  isVSCodeAltClickEnabled(settings: PartialTerminalSettings): boolean;

  /**
   * Update Alt+Click settings
   */
  updateAltClickSettings(settings: PartialTerminalSettings): void;

  /**
   * Get current Alt+Click state
   */
  getAltClickState(): AltClickState;

  /**
   * Update terminal cursor styles based on Alt key state
   */
  updateTerminalCursors(): void;
}

/**
 * Special keys handler interface
 */
export interface ISpecialKeysHandler extends IInputHandler {
  /**
   * Handle special key combinations for terminal operations
   */
  handleSpecialKeys(
    event: KeyboardEvent,
    terminalId: string,
    manager: IManagerCoordinator
  ): boolean;

  /**
   * Setup agent arrow key handler
   */
  setupAgentArrowKeyHandler(): void;

  /**
   * Enable/disable agent interaction mode
   */
  setAgentInteractionMode(enabled: boolean): void;

  /**
   * Check if agent interaction mode is enabled
   */
  isAgentInteractionMode(): boolean;
}

/**
 * Alt+Click state interface
 */
export interface AltClickState {
  isVSCodeAltClickEnabled: boolean;
  isAltKeyPressed: boolean;
}

/**
 * Input handler factory interface
 */
export interface IInputHandlerFactory {
  createKeyboardShortcutHandler(): IKeyboardShortcutHandler;
  createIMEHandler(): IIMEHandler;
  createAltClickHandler(): IAltClickHandler;
  createSpecialKeysHandler(): ISpecialKeysHandler;
}
