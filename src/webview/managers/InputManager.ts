/**
 * Input Manager - Handles keyboard shortcuts, IME composition, Alt+Click interactions, and mouse events
 */

import { Terminal } from 'xterm';
import { AltClickState, TerminalInteractionEvent } from '../../types/common';
import { PartialTerminalSettings } from '../../types/shared';
import { IInputManager, IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { INotificationManager } from '../interfaces/ManagerInterfaces';
import { BaseManager } from './BaseManager';

export class InputManager extends BaseManager implements IInputManager {
  constructor() {
    super('InputManager', {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true
    });
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
  private arrowKeyListener?: (event: KeyboardEvent) => void;

  /**
   * Set the notification manager for Alt+Click feedback
   */
  public setNotificationManager(notificationManager: INotificationManager): void {
    this.notificationManager = notificationManager;
  }

  // Event listeners for cleanup
  private keydownListener?: (event: KeyboardEvent) => void;
  private keyupListener?: (event: KeyboardEvent) => void;
  private compositionStartListener?: (event: CompositionEvent) => void;
  private compositionUpdateListener?: (event: CompositionEvent) => void;
  private compositionEndListener?: (event: CompositionEvent) => void;

  /**
   * Setup IME composition handling with improved processing
   */
  public setupIMEHandling(): void {
    this.log('⌨️ [INPUT] Setting up IME composition handling');

    this.compositionStartListener = (event: CompositionEvent) => {
      this.isComposing = true;
      this.log('🈶 [INPUT] IME composition started:', event.data || 'no data');

      // Clear any pending input events to avoid conflicts
      this.clearPendingInputEvents();
    };

    this.compositionUpdateListener = (event: CompositionEvent) => {
      // Keep composition state active during updates
      this.isComposing = true;
      this.log('🈶 [INPUT] IME composition update:', event.data || 'no data');
    };

    this.compositionEndListener = (event: CompositionEvent) => {
      // Small delay to ensure composition data is properly processed
      setTimeout(() => {
        this.isComposing = false;
        this.log('🈶 [INPUT] IME composition ended:', event.data || 'no data');
      }, 10);
    };

    document.addEventListener('compositionstart', this.compositionStartListener);
    document.addEventListener('compositionupdate', this.compositionUpdateListener);
    document.addEventListener('compositionend', this.compositionEndListener);
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
        this.log('🧹 [INPUT] Cleared pending input event:', key);
      }
    }
  }

  /**
   * Setup Alt key visual feedback for terminals
   */
  public setupAltKeyVisualFeedback(): void {
    this.log('⌨️ [INPUT] Setting up Alt key visual feedback');

    this.keydownListener = (event: KeyboardEvent) => {
      if (event.altKey && !this.altClickState.isAltKeyPressed) {
        this.altClickState.isAltKeyPressed = true;
        this.updateTerminalCursors();
      }
    };

    this.keyupListener = (event: KeyboardEvent) => {
      if (!event.altKey && this.altClickState.isAltKeyPressed) {
        this.altClickState.isAltKeyPressed = false;
        this.updateTerminalCursors();
      }
    };

    document.addEventListener('keydown', this.keydownListener);
    document.addEventListener('keyup', this.keyupListener);
  }

  /**
   * Setup keyboard shortcuts for terminal navigation
   */
  public setupKeyboardShortcuts(manager: IManagerCoordinator): void {
    this.log('⌨️ [INPUT] Setting up keyboard shortcuts');

    const shortcutListener = (event: KeyboardEvent): void => {
      // Ignore if IME is composing
      if (this.isComposing) {
        return;
      }

      // Ctrl+Tab: Switch to next terminal
      if (event.ctrlKey && event.key === 'Tab') {
        event.preventDefault();
        this.log('⌨️ [INPUT] Ctrl+Tab shortcut detected');
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
        this.log('⌨️ [INPUT] Escape key detected, clearing notifications');
        this.clearNotifications();
      }
    };

    document.addEventListener('keydown', shortcutListener);
  }

  /**
   * Add click handler to xterm.js terminal for focus and Alt+Click
   */
  public addXtermClickHandler(
    terminal: Terminal,
    terminalId: string,
    container: HTMLElement,
    manager: IManagerCoordinator
  ): void {
    this.log(`⌨️ [INPUT] Adding click handler for terminal ${terminalId}`);

    const clickHandler = (event: MouseEvent): void => {
      // Regular click: Focus terminal
      if (!event.altKey) {
        this.log(`🖱️ [INPUT] Regular click on terminal ${terminalId}`);
        manager.setActiveTerminalId(terminalId);
        this.emitTerminalInteractionEvent('focus', terminalId, undefined, manager);
        return;
      }

      // Alt+Click handling
      if (event.altKey && this.altClickState.isVSCodeAltClickEnabled) {
        // VS Code standard Alt+Click behavior
        this.log(
          `⌨️ [INPUT] Alt+Click on terminal ${terminalId} at (${event.clientX}, ${event.clientY})`
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

    // Add click listener to terminal container
    container.addEventListener('click', clickHandler);
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
    this.log(
      `⌨️ [INPUT] VS Code Alt+Click enabled: ${isEnabled} (altClick: ${altClickMovesCursor}, modifier: ${multiCursorModifier})`
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
      this.log(`⌨️ [INPUT] Alt+Click setting changed: ${wasEnabled} → ${isEnabled}`);

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
      this.log(
        `🎯 [INPUT] Agent interaction mode: ${actualEnabled} (VS Code standard - always disabled)`
      );

      // Clean up any existing arrow key listener
      if (this.arrowKeyListener) {
        document.removeEventListener('keydown', this.arrowKeyListener, true);
        this.arrowKeyListener = undefined;
      }
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
    this.log('⌨️ [INPUT] Setting up agent arrow key handler (VS Code standard)');

    this.arrowKeyListener = (event: KeyboardEvent) => {
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
            this.log(
              `🎯 [INPUT] Arrow key ${event.key} in agent mode for terminal ${terminalId} - letting xterm.js handle`
            );
          }
        }
      }

      // VS Code Standard: Let xterm.js and shell handle all arrow keys naturally
      // Do NOT preventDefault() or stopPropagation() to preserve terminal functionality
      // This allows bash history, completion, and cursor movement to work properly
    };

    document.addEventListener('keydown', this.arrowKeyListener, true);
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
      this.log('❌ [INPUT] Error emitting terminal interaction event:', error);
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
      this.log(`⌨️ [INPUT] Ctrl+C interrupt for terminal ${terminalId}`);
      this.emitTerminalInteractionEvent('interrupt', terminalId, undefined, manager);
      return true;
    }

    // Ctrl+V: Paste
    if (event.ctrlKey && event.key === 'v') {
      this.log(`⌨️ [INPUT] Ctrl+V paste for terminal ${terminalId}`);
      this.emitTerminalInteractionEvent('paste', terminalId, undefined, manager);
      return false; // Let browser handle paste
    }

    return false;
  }

  /**
   * Dispose of all event listeners and cleanup resources
   */
  public override dispose(): void {
    this.log('🧹 [INPUT] Disposing input manager');
    
    // Call parent dispose
    super.dispose();

    // Remove event listeners
    if (this.keydownListener) {
      document.removeEventListener('keydown', this.keydownListener);
    }
    if (this.keyupListener) {
      document.removeEventListener('keyup', this.keyupListener);
    }
    if (this.compositionStartListener) {
      document.removeEventListener('compositionstart', this.compositionStartListener);
    }
    if (this.compositionUpdateListener) {
      document.removeEventListener('compositionupdate', this.compositionUpdateListener);
    }
    if (this.compositionEndListener) {
      document.removeEventListener('compositionend', this.compositionEndListener);
    }
    if (this.arrowKeyListener) {
      document.removeEventListener('keydown', this.arrowKeyListener, true);
    }

    // Reset state
    this.altClickState = {
      isVSCodeAltClickEnabled: false,
      isAltKeyPressed: false,
    };
    this.isComposing = false;
    this.agentInteractionMode = false;

    // Clear references
    this.keydownListener = undefined;
    this.keyupListener = undefined;
    this.compositionStartListener = undefined;
    this.compositionUpdateListener = undefined;
    this.compositionEndListener = undefined;
    this.arrowKeyListener = undefined;

    this.log('✅ [INPUT] Input manager disposed');
  }
}
