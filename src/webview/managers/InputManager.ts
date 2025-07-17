/**
 * Input Manager - Handles keyboard shortcuts, IME composition, Alt+Click interactions, and mouse events
 */

import { Terminal } from 'xterm';
import { webview as log } from '../../utils/logger';
import { AltClickState, TerminalInteractionEvent } from '../../types/common';
import { PartialTerminalSettings } from '../../types/shared';
import { IInputManager, IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { INotificationManager } from '../interfaces/ManagerInterfaces';

export class InputManager implements IInputManager {
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
  private compositionEndListener?: (event: CompositionEvent) => void;

  /**
   * Setup IME composition handling
   */
  public setupIMEHandling(): void {
    log('⌨️ [INPUT] Setting up IME composition handling');

    this.compositionStartListener = (event: CompositionEvent) => {
      this.isComposing = true;
      log('🈶 [INPUT] IME composition started:', event.data);
    };

    this.compositionEndListener = (event: CompositionEvent) => {
      this.isComposing = false;
      log('🈶 [INPUT] IME composition ended:', event.data);
    };

    document.addEventListener('compositionstart', this.compositionStartListener);
    document.addEventListener('compositionend', this.compositionEndListener);
  }

  /**
   * Setup Alt key visual feedback for terminals
   */
  public setupAltKeyVisualFeedback(): void {
    log('⌨️ [INPUT] Setting up Alt key visual feedback');

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
    log('⌨️ [INPUT] Setting up keyboard shortcuts');

    const shortcutListener = (event: KeyboardEvent): void => {
      // Ignore if IME is composing
      if (this.isComposing) {
        return;
      }

      // Ctrl+Tab: Switch to next terminal
      if (event.ctrlKey && event.key === 'Tab') {
        event.preventDefault();
        log('⌨️ [INPUT] Ctrl+Tab shortcut detected');
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
        log('⌨️ [INPUT] Escape key detected, clearing notifications');
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
    log(`⌨️ [INPUT] Adding click handler for terminal ${terminalId}`);

    const clickHandler = (event: MouseEvent): void => {
      // Regular click: Focus terminal
      if (!event.altKey) {
        log(`🖱️ [INPUT] Regular click on terminal ${terminalId}`);
        manager.setActiveTerminalId(terminalId);
        this.emitTerminalInteractionEvent('focus', terminalId, undefined, manager);
        return;
      }

      // Alt+Click handling
      if (event.altKey && this.altClickState.isVSCodeAltClickEnabled) {
        // VS Code standard Alt+Click behavior
        log(
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
    log(
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
      log(`⌨️ [INPUT] Alt+Click setting changed: ${wasEnabled} → ${isEnabled}`);

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
        }, 200);

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
      log('❌ [INPUT] Error emitting terminal interaction event:', error);
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
      log(`⌨️ [INPUT] Ctrl+C interrupt for terminal ${terminalId}`);
      this.emitTerminalInteractionEvent('interrupt', terminalId, undefined, manager);
      return true;
    }

    // Ctrl+V: Paste
    if (event.ctrlKey && event.key === 'v') {
      log(`⌨️ [INPUT] Ctrl+V paste for terminal ${terminalId}`);
      this.emitTerminalInteractionEvent('paste', terminalId, undefined, manager);
      return false; // Let browser handle paste
    }

    return false;
  }

  /**
   * Dispose of all event listeners and cleanup resources
   */
  public dispose(): void {
    log('🧹 [INPUT] Disposing input manager');

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
    if (this.compositionEndListener) {
      document.removeEventListener('compositionend', this.compositionEndListener);
    }

    // Reset state
    this.altClickState = {
      isVSCodeAltClickEnabled: false,
      isAltKeyPressed: false,
    };
    this.isComposing = false;

    // Clear references
    this.keydownListener = undefined;
    this.keyupListener = undefined;
    this.compositionStartListener = undefined;
    this.compositionEndListener = undefined;

    log('✅ [INPUT] Input manager disposed');
  }
}
