/**
 * KeyboardShortcutSetupHandler - Manages keyboard shortcut registration, legacy shortcuts,
 * agent interaction mode, and global keyboard listeners.
 *
 * Extracted from InputManager to reduce method size and improve testability.
 * Contains:
 * - setupKeyboardShortcuts: Register VS Code compatible keyboard shortcuts
 * - handleLegacyShortcuts: Backward-compatible shortcut handling
 * - clearNotifications: Remove notification elements from DOM
 * - setAgentInteractionMode / isAgentInteractionMode: Agent mode control
 * - setupGlobalKeyboardListener: Global keydown handler for special keys
 * - setupAgentArrowKeyHandler: Arrow key handling in agent mode
 */

import { IManagerCoordinator } from '../../../interfaces/ManagerInterfaces';
import { EventHandlerRegistry } from '../../../utils/EventHandlerRegistry';

/**
 * Keyboard event constants
 */
const KeyboardConstants = {
  /** IME composition keycode (when IME is processing input) */
  IME_COMPOSITION_KEYCODE: 229,
} as const;

/**
 * Dependencies required by KeyboardShortcutSetupHandler from InputManager
 */
export interface IKeyboardShortcutSetupHandlerDeps {
  /** Logger function */
  logger: (message: string, ...args: unknown[]) => void;
  /** Event handler registry for centralized event management */
  eventRegistry: EventHandlerRegistry;
  /** Check if IME is currently composing */
  isIMEComposing: () => boolean;
  /** Resolve keyboard event to VS Code command */
  resolveKeybinding: (event: KeyboardEvent) => string | null;
  /** Determine if keybinding should skip shell */
  shouldSkipShell: (event: KeyboardEvent, resolvedCommand?: string) => boolean;
  /** Handle resolved VS Code command */
  handleVSCodeCommand: (command: string, manager: IManagerCoordinator) => void;
  /** Handle panel navigation key event, returns true if consumed */
  handlePanelNavigationKey: (event: KeyboardEvent) => boolean;
  /** Handle special key combinations for active terminal */
  handleSpecialKeys: (
    event: KeyboardEvent,
    terminalId: string,
    manager: IManagerCoordinator
  ) => boolean;
  /** Get the currently active terminal ID */
  getActiveTerminalId: () => string | null;
}

/**
 * KeyboardShortcutSetupHandler - Manages keyboard shortcut setup, legacy shortcuts,
 * and agent interaction mode
 */
export class KeyboardShortcutSetupHandler {
  private agentInteractionMode = false;
  /** Stored manager reference for global keyboard listener */
  private coordinatorRef: IManagerCoordinator | null = null;

  constructor(private readonly deps: IKeyboardShortcutSetupHandlerDeps) {}

  /**
   * Setup keyboard shortcuts for terminal navigation with VS Code keybinding system
   */
  public setupKeyboardShortcuts(manager: IManagerCoordinator): void {
    this.deps.logger('Setting up VS Code compatible keyboard shortcuts');
    this.coordinatorRef = manager;

    const shortcutHandler = (event: KeyboardEvent): void => {
      if (this.deps.handlePanelNavigationKey(event)) {
        return;
      }

      // VS Code standard: Check IME composition before processing shortcuts
      if (this.deps.isIMEComposing()) {
        this.deps.logger(`Keyboard shortcut blocked during IME composition: ${event.key}`);
        return;
      }

      // Check for KEY_IN_COMPOSITION (VS Code standard)
      if (event.keyCode === KeyboardConstants.IME_COMPOSITION_KEYCODE) {
        this.deps.logger('KEY_IN_COMPOSITION detected - stopping propagation');
        event.stopPropagation();
        return;
      }

      // VS Code keybinding resolution
      const resolvedCommand = this.deps.resolveKeybinding(event);
      const shouldSkip = this.deps.shouldSkipShell(event, resolvedCommand || undefined);

      this.deps.logger(
        `Keybinding: ${event.key}, Command: ${resolvedCommand}, Skip Shell: ${shouldSkip}, IME: ${this.deps.isIMEComposing()}`
      );

      // If should skip shell, handle as VS Code command
      if (shouldSkip && resolvedCommand) {
        event.preventDefault();
        event.stopPropagation();
        this.deps.handleVSCodeCommand(resolvedCommand, manager);
        return;
      }

      // Legacy shortcuts for compatibility
      this.handleLegacyShortcuts(event, manager);
    };

    // Register shortcut handler using EventHandlerRegistry
    this.deps.eventRegistry.register(
      'keyboard-shortcuts',
      document,
      'keydown',
      shortcutHandler as EventListener
    );

    this.deps.logger('VS Code compatible keyboard shortcuts', 'completed');
  }

  /**
   * Handle legacy shortcuts for backward compatibility
   */
  public handleLegacyShortcuts(event: KeyboardEvent, manager: IManagerCoordinator): void {
    // Escape: Clear notifications (always handle, don't send to shell)
    if (event.key === 'Escape') {
      this.deps.logger('Escape key detected, clearing notifications');
      this.clearNotifications();
    }

    // Ctrl+Shift+D: Toggle debug panel (always handle, don't send to shell)
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
      event.preventDefault();
      this.deps.logger('Ctrl+Shift+D shortcut detected, toggling debug panel');
      if ('toggleDebugPanel' in manager && typeof manager.toggleDebugPanel === 'function') {
        (manager as { toggleDebugPanel: () => void }).toggleDebugPanel();
      }
    }

    // Ctrl+Shift+P: Show profile selector (VS Code style)
    if (event.ctrlKey && event.shiftKey && event.key === 'P') {
      event.preventDefault();
      this.deps.logger('Ctrl+Shift+P shortcut detected, showing profile selector');
      if (manager.profileManager) {
        manager.profileManager.showProfileSelector();
      }
    }

    // Ctrl+Alt+T: Create terminal with default profile (VS Code compatible)
    if (event.ctrlKey && event.altKey && event.key === 't') {
      event.preventDefault();
      this.deps.logger('Ctrl+Alt+T shortcut detected, creating terminal with default profile');
      if (manager.profileManager) {
        manager.profileManager.createTerminalWithDefaultProfile().catch((error: any) => {
          this.deps.logger('Failed to create terminal with default profile:', error);
        });
      }
    }

    // Ctrl+Shift+1-5: Quick profile switching by index
    if (event.ctrlKey && event.shiftKey && /^[1-5]$/.test(event.key)) {
      event.preventDefault();
      const profileIndex = parseInt(event.key) - 1;
      this.deps.logger(
        `Ctrl+Shift+${event.key} shortcut detected, switching to profile index ${profileIndex}`
      );
      if (manager.profileManager) {
        manager.profileManager.switchToProfileByIndex(profileIndex).catch((error: any) => {
          this.deps.logger(`Failed to switch to profile index ${profileIndex}:`, error);
        });
      }
    }
  }

  /**
   * Enable/disable agent interaction mode
   * VS Code Standard: Always disabled for standard terminal functionality
   */
  public setAgentInteractionMode(_enabled: boolean): void {
    // VS Code Standard: Force disable to preserve terminal functionality
    const actualEnabled = false;

    if (this.agentInteractionMode !== actualEnabled) {
      this.agentInteractionMode = actualEnabled;
      this.deps.logger(
        `Agent interaction mode: ${actualEnabled} (VS Code standard - always disabled)`
      );

      // Clean up any existing arrow key listener
      this.deps.eventRegistry.unregister('agent-arrow-keys');
    }
  }

  /**
   * Check if agent interaction mode is enabled
   */
  public isAgentInteractionMode(): boolean {
    return this.agentInteractionMode;
  }

  /**
   * Setup global keyboard listener for shortcuts and commands
   */
  public setupGlobalKeyboardListener(): void {
    this.deps.logger('Setting up global keyboard listener');

    const globalKeyHandler = (event: KeyboardEvent): void => {
      // Handle keyboard shortcuts and commands here
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        // Debug panel toggle handled elsewhere
        return;
      }

      // Handle special keys (Ctrl+C/V, etc.) for the active terminal
      const activeTerminalId = this.deps.getActiveTerminalId();
      if (activeTerminalId && this.coordinatorRef) {
        const handled = this.deps.handleSpecialKeys(
          event,
          activeTerminalId,
          this.coordinatorRef
        );
        if (handled) {
          return;
        }
      }
    };

    this.deps.eventRegistry.register(
      'global-keyboard',
      document,
      'keydown',
      globalKeyHandler as EventListener,
      true
    );
  }

  /**
   * Setup simplified arrow key handler for agent interactions
   * VS Code Standard: Arrow keys should be handled by xterm.js and shell
   */
  public setupAgentArrowKeyHandler(): void {
    this.deps.logger('Setting up agent arrow key handler (VS Code standard)');

    const arrowKeyHandler = (event: KeyboardEvent): void => {
      // VS Code standard: Always respect IME composition state
      if (this.deps.isIMEComposing()) {
        this.deps.logger(
          `Arrow key ${event.key} during IME composition - letting IME handle`
        );
        return;
      }

      // Only log when in agent interaction mode for debugging
      if (!this.agentInteractionMode) {
        return;
      }

      // Check if this is an arrow key for logging only
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        const activeTerminal = document.querySelector('.terminal-container.active');
        if (activeTerminal) {
          const terminalId = activeTerminal.getAttribute('data-terminal-id');
          if (terminalId) {
            this.deps.logger(
              `Arrow key ${event.key} in agent mode for terminal ${terminalId} - letting xterm.js handle`
            );
          }
        }
      }
    };

    this.deps.eventRegistry.register(
      'agent-arrow-keys',
      document,
      'keydown',
      arrowKeyHandler as EventListener,
      true
    );
  }

  /**
   * Clear all notifications
   */
  private clearNotifications(): void {
    const notifications = document.querySelectorAll('.notification, .claude-code-notification');
    notifications.forEach((notification) => {
      notification.remove();
    });
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.agentInteractionMode = false;
    this.coordinatorRef = null;
  }
}
