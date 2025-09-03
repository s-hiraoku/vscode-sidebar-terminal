/**
 * IME Handler - Manages Input Method Editor composition events
 * Handles Japanese, Chinese, Korean and other complex input methods
 */

import { IIMEHandler } from '../interfaces/IInputHandlers';
import { BaseManager } from '../../BaseManager';
import { EventHandlerRegistry } from '../../../utils/EventHandlerRegistry';
import { ManagerLogger } from '../../../utils/ManagerLogger';

/**
 * IME Handler for managing composition events
 */
export class IMEHandler extends BaseManager implements IIMEHandler {
  // Specialized logger for IME Handler
  protected override readonly logger = new ManagerLogger('IMEHandler', '🎯');

  // Event handler registry for centralized event management
  protected override readonly eventRegistry = new EventHandlerRegistry();

  // IME composition state
  private isComposing = false;

  // Reference to parent's debounce timers for cleanup
  private eventDebounceTimers: Map<string, number>;

  constructor(eventDebounceTimers: Map<string, number>) {
    super('IMEHandler', {
      enableLogging: true,
      enableValidation: true,
      enableErrorRecovery: true,
    });

    this.eventDebounceTimers = eventDebounceTimers;
    this.logger.lifecycle('initialization', 'starting');
  }

  /**
   * Initialize the IME handler
   */
  public override initialize(): void {
    this.setupIMEHandling();
    this.logger.lifecycle('IMEHandler', 'completed');
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
      // Immediately update composition state for VS Code standard behavior
      this.isComposing = false;
      this.logger.debug(`IME composition ended: ${event.data || 'no data'}`);
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
   * Check if IME is currently composing
   */
  public isIMEComposing(): boolean {
    return this.isComposing;
  }

  /**
   * Clear any pending input events that might conflict with IME
   */
  public clearPendingInputEvents(): void {
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
   * Dispose of all event listeners and cleanup resources
   */
  public override dispose(): void {
    this.logger.info('Disposing IME handler');

    // Dispose EventHandlerRegistry - this will clean up all registered event listeners
    this.eventRegistry.dispose();

    // Reset composition state
    this.isComposing = false;

    // Call parent dispose
    super.dispose();

    this.logger.lifecycle('IMEHandler', 'completed');
  }
}