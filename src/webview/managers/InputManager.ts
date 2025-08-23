/**
 * Input Manager - Handles keyboard shortcuts, IME composition, Alt+Click interactions, and mouse events
 */

import { Terminal } from 'xterm';
import { AltClickState, TerminalInteractionEvent } from '../../types/common';
import { PartialTerminalSettings } from '../../types/shared';
import { IInputManager, IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { INotificationManager } from '../interfaces/ManagerInterfaces';
import { BaseManager } from './BaseManager';
import { EventHandlerRegistry } from '../utils/EventHandlerRegistry';
import { inputLogger } from '../utils/ManagerLogger';

export class InputManager extends BaseManager implements IInputManager {
  // Specialized logger for Input Manager
  protected override readonly logger = inputLogger;

  // Event handler registry for centralized event management
  protected override readonly eventRegistry = new EventHandlerRegistry();

  constructor() {
    super('InputManager', {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });

    this.logger.lifecycle('initialization', 'starting');
  }

  // Alt+Click state management
  private altClickState: AltClickState = {
    isVSCodeAltClickEnabled: false,
    isAltKeyPressed: false,
  };

  // Notification manager for Alt+Click feedback
  private notificationManager: INotificationManager | null = null;

  // IME composition state
  private isComposing = false;

  // Debounce timers for events
  private eventDebounceTimers = new Map<string, number>();
  // Simple arrow key handling for agent interactions
  private agentInteractionMode = false;

  /**
   * Set the notification manager for Alt+Click feedback
   */
  public setNotificationManager(notificationManager: INotificationManager): void {
    this.notificationManager = notificationManager;
    this.logger.info('Notification manager set for Alt+Click feedback');
  }

  /**
   * Setup IME composition handling with improved processing
   */
  public setupIMEHandling(): void {
    this.logger.info('Setting up IME composition handling');

    const compositionStartHandler = (event: CompositionEvent): void => {
      this.isComposing = true;
      this.logger.debug(`IME composition started: ${event.data || 'no data'}`);

      // Clear any pending input events to avoid conflicts
      this.clearPendingInputEvents();
    };

    const compositionUpdateHandler = (event: CompositionEvent): void => {
      // Keep composition state active during updates
      this.isComposing = true;
      this.logger.debug(`IME composition update: ${event.data || 'no data'}`);
    };

    const compositionEndHandler = (event: CompositionEvent): void => {
      // Small delay to ensure composition data is properly processed
      setTimeout(() => {
        this.isComposing = false;
        this.logger.debug(`IME composition ended: ${event.data || 'no data'}`);
      }, 10);
    };

    // Register IME event handlers using EventHandlerRegistry
    this.eventRegistry.register(
      'ime-composition-start',
      document,
      'compositionstart',
      compositionStartHandler as EventListener
    );

    this.eventRegistry.register(
      'ime-composition-update',
      document,
      'compositionupdate',
      compositionUpdateHandler as EventListener
    );

    this.eventRegistry.register(
      'ime-composition-end',
      document,
      'compositionend',
      compositionEndHandler as EventListener
    );

    this.logger.lifecycle('IME handling', 'completed');
  }

  /**
   * Clear any pending input events that might conflict with IME
   */
  private clearPendingInputEvents(): void {
    // Clear any debounced events that might interfere with IME composition
    for (const [key, timer] of this.eventDebounceTimers) {
      if (key.includes('input') || key.includes('keydown')) {
        clearTimeout(timer);
        this.eventDebounceTimers.delete(key);
        this.logger.debug(`Cleared pending input event: ${key}`);
      }
    }
  }

  /**
   * Setup Alt key visual feedback for terminals
   */
  public setupAltKeyVisualFeedback(): void {
    this.logger.info('Setting up Alt key visual feedback');

    const keydownHandler = (event: KeyboardEvent): void => {
      if (event.altKey && !this.altClickState.isAltKeyPressed) {
        this.altClickState.isAltKeyPressed = true;
        this.updateTerminalCursors();
        this.logger.debug('Alt key pressed - updating cursor styles');
      }
    };

    const keyupHandler = (event: KeyboardEvent): void => {
      if (!event.altKey && this.altClickState.isAltKeyPressed) {
        this.altClickState.isAltKeyPressed = false;
        this.updateTerminalCursors();
        this.logger.debug('Alt key released - resetting cursor styles');
      }
    };

    // Register Alt key handlers using EventHandlerRegistry
    this.eventRegistry.register('alt-key-down', document, 'keydown', keydownHandler);
    this.eventRegistry.register('alt-key-up', document, 'keyup', keyupHandler);

    this.logger.lifecycle('Alt key visual feedback', 'completed');
  }

  /**
   * Setup keyboard shortcuts for terminal navigation
   */
  public setupKeyboardShortcuts(manager: IManagerCoordinator): void {
    this.logger.info('Setting up keyboard shortcuts');

    const shortcutHandler = (event: KeyboardEvent): void => {
      // Ignore if IME is composing
      if (this.isComposing) {
        return;
      }

      // Ctrl+Tab: Switch to next terminal
      if (event.ctrlKey && event.key === 'Tab') {
        event.preventDefault();
        this.logger.info('Ctrl+Tab shortcut detected');
        // Manager should implement terminal switching
        this.emitTerminalInteractionEvent(
          'switch-next',
          manager.getActiveTerminalId() || '',
          undefined,
          manager
        );
      }

      // Escape: Clear notifications
      if (event.key === 'Escape') {
        this.logger.info('Escape key detected, clearing notifications');
        this.clearNotifications();
      }
    };

    // Register shortcut handler using EventHandlerRegistry
    this.eventRegistry.register('keyboard-shortcuts', document, 'keydown', shortcutHandler);

    this.logger.lifecycle('Keyboard shortcuts', 'completed');
  }

  /**
   * Add complete input handling to xterm.js terminal (click, keyboard, focus)
   */
  public addXtermClickHandler(
    terminal: Terminal,
    terminalId: string,
    container: HTMLElement,
    manager: IManagerCoordinator
  ): void {
    this.logger.info(`Setting up complete input handling for terminal ${terminalId}`);

    // CRITICAL: Set up keyboard input handling for terminal
    terminal.onData((data: string) => {
      this.logger.debug(`Terminal ${terminalId} data: ${data.length} chars`);
      manager.postMessageToExtension({
        command: 'input',
        terminalId: terminalId,
        data: data,
        timestamp: Date.now(),
      });
    });

    // Set up focus handling
    terminal.onFocus(() => {
      this.logger.debug(`Terminal ${terminalId} focused`);
      manager.setActiveTerminalId(terminalId);
      this.emitTerminalInteractionEvent('focus', terminalId, undefined, manager);
    });

    // Set up blur handling
    terminal.onBlur(() => {
      this.logger.debug(`Terminal ${terminalId} blurred`);
    });

    const clickHandler = (event: MouseEvent): void => {
      // Regular click: Focus terminal
      if (!event.altKey) {
        this.logger.debug(`Regular click on terminal ${terminalId}`);
        manager.setActiveTerminalId(terminalId);
        terminal.focus(); // Ensure terminal gets focus for keyboard input
        this.emitTerminalInteractionEvent('focus', terminalId, undefined, manager);
        return;
      }

      // Alt+Click handling
      if (event.altKey && this.altClickState.isVSCodeAltClickEnabled) {
        // VS Code standard Alt+Click behavior
        this.logger.debug(
          `Alt+Click on terminal ${terminalId} at (${event.clientX}, ${event.clientY})`
        );

        // Show visual feedback
        if (this.notificationManager) {
          this.notificationManager.showAltClickFeedback(event.clientX, event.clientY);
        }

        // Let xterm.js handle the actual cursor positioning
        // No need to prevent default - xterm.js will handle it

        this.emitTerminalInteractionEvent(
          'alt-click',
          terminalId,
          {
            x: event.clientX,
            y: event.clientY,
          },
          manager
        );
      }
    };

    // Register click handler using EventHandlerRegistry
    this.eventRegistry.register(
      `terminal-click-${terminalId}`,
      container,
      'click',
      clickHandler
    );

    this.logger.info(`Complete input handling configured for terminal ${terminalId}`);
  }

  /**
   * Update terminal cursor styles based on Alt key state
   */
  private updateTerminalCursors(): void {
    const terminals = document.querySelectorAll('.terminal-container .xterm');
    terminals.forEach((terminal) => {
      const element = terminal as HTMLElement;
      if (this.altClickState.isAltKeyPressed && this.altClickState.isVSCodeAltClickEnabled) {
        element.style.cursor = 'default';
      } else {
        element.style.cursor = '';
      }
    });
  }

  /**
   * Check if VS Code Alt+Click is enabled based on settings
   */
  public isVSCodeAltClickEnabled(settings: PartialTerminalSettings): boolean {
    const altClickMovesCursor = settings.altClickMovesCursor ?? false;
    const multiCursorModifier = settings.multiCursorModifier ?? 'alt';

    const isEnabled = altClickMovesCursor && multiCursorModifier === 'alt';
    this.logger.debug(
      `VS Code Alt+Click enabled: ${isEnabled} (altClick: ${altClickMovesCursor}, modifier: ${multiCursorModifier})`
    );

    return isEnabled;
  }

  /**
   * Update Alt+Click settings and state
   */
  public updateAltClickSettings(settings: PartialTerminalSettings): void {
    const wasEnabled = this.altClickState.isVSCodeAltClickEnabled;
    const isEnabled = this.isVSCodeAltClickEnabled(settings);

    if (wasEnabled !== isEnabled) {
      this.altClickState.isVSCodeAltClickEnabled = isEnabled;
      this.logger.info(`Alt+Click setting changed: ${wasEnabled} → ${isEnabled}`);

      // Update cursor styles immediately
      this.updateTerminalCursors();
    }
  }

  /**
   * Get current Alt+Click state
   */
  public getAltClickState(): AltClickState {
    return { ...this.altClickState };
  }

  /**
   * Check if IME is currently composing
   */
  public isIMEComposing(): boolean {
    return this.isComposing;
  }

  /**
   * Enable/disable agent interaction mode
   * VS Code Standard: Always disabled for standard terminal functionality
   */
  public setAgentInteractionMode(_enabled: boolean): void {
    // VS Code Standard: Force disable to preserve terminal functionality
    // This ensures arrow keys work properly for bash history, completion, etc.
    const actualEnabled = false; // Always disabled for VS Code standard behavior

    if (this.agentInteractionMode !== actualEnabled) {
      this.agentInteractionMode = actualEnabled;
      this.logger.info(
        `Agent interaction mode: ${actualEnabled} (VS Code standard - always disabled)`
      );

      // Clean up any existing arrow key listener
      this.eventRegistry.unregister('agent-arrow-keys');
    }
  }

  /**
   * Check if agent interaction mode is enabled
   */
  public isAgentInteractionMode(): boolean {
    return this.agentInteractionMode;
  }

  /**
   * Setup simplified arrow key handler for agent interactions
   * VS Code Standard: Arrow keys should be handled by xterm.js and shell
   */
  private setupAgentArrowKeyHandler(): void {
    this.logger.info('Setting up agent arrow key handler (VS Code standard)');

    const arrowKeyHandler = (event: KeyboardEvent): void => {
      // Only log when in agent interaction mode for debugging
      if (!this.agentInteractionMode || this.isComposing) {
        return;
      }

      // Check if this is an arrow key for logging only
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        // Find active terminal for logging
        const activeTerminal = document.querySelector('.terminal-container.active');
        if (activeTerminal) {
          const terminalId = activeTerminal.getAttribute('data-terminal-id');
          if (terminalId) {
            this.logger.debug(
              `Arrow key ${event.key} in agent mode for terminal ${terminalId} - letting xterm.js handle`
            );
          }
        }
      }

      // VS Code Standard: Let xterm.js and shell handle all arrow keys naturally
      // Do NOT preventDefault() or stopPropagation() to preserve terminal functionality
      // This allows bash history, completion, and cursor movement to work properly
    };

    this.eventRegistry.register('agent-arrow-keys', document, 'keydown', arrowKeyHandler, true);
  }

  /**
   * Emit terminal interaction event with debouncing for frequent events
   */
  private emitTerminalInteractionEvent(
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data: unknown,
    manager: IManagerCoordinator
  ): void {
    try {
      // Debounce focus events to prevent spam
      if (type === 'focus') {
        const key = `${type}-${terminalId}`;
        if (this.eventDebounceTimers.has(key)) {
          clearTimeout(this.eventDebounceTimers.get(key));
        }

        const timer = window.setTimeout(() => {
          manager.postMessageToExtension({
            command: 'terminalInteraction',
            type,
            terminalId,
            data,
            timestamp: Date.now(),
          });
          this.eventDebounceTimers.delete(key);
        }, 50); // Reduced from 200ms to 50ms for better responsiveness

        this.eventDebounceTimers.set(key, timer);
      } else {
        // Emit other events immediately
        manager.postMessageToExtension({
          command: 'terminalInteraction',
          type,
          terminalId,
          data,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      this.logger.error(`Error emitting terminal interaction event: ${error}`);
    }
  }

  /**
   * Clear all notifications (placeholder for integration with NotificationManager)
   */
  private clearNotifications(): void {
    // This will be integrated with NotificationManager
    const notifications = document.querySelectorAll('.notification, .claude-code-notification');
    notifications.forEach((notification) => {
      notification.remove();
    });
  }

  /**
   * Handle special key combinations for terminal operations
   */
  public handleSpecialKeys(
    event: KeyboardEvent,
    terminalId: string,
    manager: IManagerCoordinator
  ): boolean {
    // Ignore if IME is composing
    if (this.isComposing) {
      return false;
    }

    // Ctrl+C: Copy (if selection exists) or interrupt
    if (event.ctrlKey && event.key === 'c') {
      const terminal = manager.getTerminalInstance(terminalId);
      if (terminal && terminal.terminal.hasSelection()) {
        // Let browser handle copy
        return false;
      }
      // Send interrupt signal
      this.logger.info(`Ctrl+C interrupt for terminal ${terminalId}`);
      this.emitTerminalInteractionEvent('interrupt', terminalId, undefined, manager);
      return true;
    }

    // Ctrl+V: Paste
    if (event.ctrlKey && event.key === 'v') {
      this.logger.info(`Ctrl+V paste for terminal ${terminalId}`);
      this.emitTerminalInteractionEvent('paste', terminalId, undefined, manager);
      return false; // Let browser handle paste
    }

    return false;
  }

  /**
   * Dispose of all event listeners and cleanup resources
   */
  public override dispose(): void {
    this.logger.info('Disposing input manager');

    // Dispose EventHandlerRegistry - this will clean up all registered event listeners
    this.eventRegistry.dispose();

    // Clear debounce timers
    for (const timer of this.eventDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.eventDebounceTimers.clear();

    // Reset state
    this.altClickState = {
      isVSCodeAltClickEnabled: false,
      isAltKeyPressed: false,
    };
    this.isComposing = false;
    this.agentInteractionMode = false;

    // Clear references
    this.notificationManager = null;

    // Call parent dispose
    super.dispose();

    this.logger.lifecycle('InputManager', 'completed');
  }
}
