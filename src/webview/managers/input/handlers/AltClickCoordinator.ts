/**
 * AltClickCoordinator - Handles Alt+Click interactions and visual feedback
 *
 * Extracted from InputManager to reduce method size and improve testability.
 * Contains:
 * - updateAltClickSettings: Update Alt+Click enabled state from settings
 * - isVSCodeAltClickEnabled: Determine if Alt+Click is enabled
 * - getAltClickState: Return current Alt+Click state
 * - setupAltKeyVisualFeedback: Register keydown/keyup listeners for Alt key
 * - handleAltClick: Process an Alt+Click event with feedback
 * - updateTerminalCursors: Update cursor styles based on Alt key state
 */

import { AltClickState } from '../../../../types/common';
import { PartialTerminalSettings } from '../../../../types/shared';
import { INotificationManager } from '../../../interfaces/ManagerInterfaces';
import { EventHandlerRegistry } from '../../../utils/EventHandlerRegistry';
import { InputStateManager } from '../services/InputStateManager';

/**
 * Dependencies required by AltClickCoordinator from InputManager
 */
export interface IAltClickCoordinatorDeps {
  /** Logger function */
  logger: (message: string, ...args: unknown[]) => void;
  /** Event handler registry for centralized event management */
  eventRegistry: EventHandlerRegistry;
  /** Input state manager for unified state updates */
  stateManager: InputStateManager;
}

/**
 * AltClickCoordinator - Manages Alt+Click state, cursor feedback, and click handling
 */
export class AltClickCoordinator {
  private altClickState: AltClickState = {
    isVSCodeAltClickEnabled: false,
    isAltKeyPressed: false,
  };

  private notificationManager: INotificationManager | null = null;

  constructor(private readonly deps: IAltClickCoordinatorDeps) {}

  /**
   * Set the notification manager for Alt+Click feedback
   */
  public setNotificationManager(notificationManager: INotificationManager): void {
    this.notificationManager = notificationManager;
    this.deps.logger('Notification manager set for Alt+Click feedback');
  }

  /**
   * Check if VS Code Alt+Click is enabled based on settings
   */
  public isVSCodeAltClickEnabled(settings: PartialTerminalSettings): boolean {
    const altClickMovesCursor = settings.altClickMovesCursor ?? false;
    const multiCursorModifier = settings.multiCursorModifier ?? 'alt';

    const isEnabled = altClickMovesCursor && multiCursorModifier === 'alt';
    this.deps.logger(
      `VS Code Alt+Click enabled: ${isEnabled} (altClick: ${altClickMovesCursor}, modifier: ${multiCursorModifier})`
    );

    return isEnabled;
  }

  /**
   * Update Alt+Click settings and state using unified state management
   */
  public updateAltClickSettings(settings: PartialTerminalSettings): void {
    const wasEnabled = this.altClickState.isVSCodeAltClickEnabled;
    const isEnabled = this.isVSCodeAltClickEnabled(settings);

    if (wasEnabled !== isEnabled) {
      this.altClickState.isVSCodeAltClickEnabled = isEnabled;

      // Update unified state manager
      this.deps.stateManager.updateAltClickState({
        isVSCodeAltClickEnabled: isEnabled,
      });

      this.deps.logger(`Alt+Click setting changed: ${wasEnabled} → ${isEnabled}`);

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
   * Setup Alt key visual feedback for terminals
   */
  public setupAltKeyVisualFeedback(): void {
    this.deps.logger('Setting up Alt key visual feedback');

    const keydownHandler = (event: KeyboardEvent): void => {
      if (event.altKey && !this.altClickState.isAltKeyPressed) {
        this.altClickState.isAltKeyPressed = true;
        this.updateTerminalCursors();
        this.deps.logger('Alt key pressed - updating cursor styles');
      }
    };

    const keyupHandler = (event: KeyboardEvent): void => {
      if (!event.altKey && this.altClickState.isAltKeyPressed) {
        this.altClickState.isAltKeyPressed = false;
        this.updateTerminalCursors();
        this.deps.logger('Alt key released - resetting cursor styles');
      }
    };

    // Register Alt key handlers using EventHandlerRegistry
    this.deps.eventRegistry.register(
      'alt-key-down',
      document,
      'keydown',
      keydownHandler as EventListener
    );
    this.deps.eventRegistry.register(
      'alt-key-up',
      document,
      'keyup',
      keyupHandler as EventListener
    );

    this.deps.logger('Alt key visual feedback completed');
  }

  /**
   * Handle an Alt+Click event. Returns true if it was handled.
   */
  public handleAltClick(clientX: number, clientY: number, terminalId: string): boolean {
    if (!this.altClickState.isVSCodeAltClickEnabled) {
      return false;
    }

    this.deps.logger(`Alt+Click on terminal ${terminalId} at (${clientX}, ${clientY})`);

    // Show visual feedback
    if (this.notificationManager) {
      this.notificationManager.showAltClickFeedback(clientX, clientY);
    }

    return true;
  }

  /**
   * Update terminal cursor styles based on Alt key state
   */
  public updateTerminalCursors(): void {
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
   * Dispose resources and reset state
   */
  public dispose(): void {
    this.altClickState = {
      isVSCodeAltClickEnabled: false,
      isAltKeyPressed: false,
    };
    this.notificationManager = null;
  }
}
