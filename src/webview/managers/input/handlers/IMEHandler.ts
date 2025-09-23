/**
 * IME Handler - Manages Input Method Editor composition events
 * Handles Japanese, Chinese, Korean and other complex input methods
 */

import { IIMEHandler } from '../interfaces/IInputHandlers';
import { BaseManager } from '../../BaseManager';
import { EventHandlerRegistry } from '../../../utils/EventHandlerRegistry';

/**
 * IME Handler for managing composition events
 */
export class IMEHandler extends BaseManager implements IIMEHandler {
  // Event handler registry for centralized event management
  protected readonly eventRegistry = new EventHandlerRegistry();

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

    // Logger is automatically provided by BaseManager

    this.logger('initialization', 'starting');
  }

  /**
   * Initialize the IME handler (BaseManager abstract method implementation)
   */
  protected doInitialize(): void {
    this.setupIMEHandling();
    this.logger('IMEHandler', 'completed');
  }

  /**
   * Dispose IME handler resources (BaseManager abstract method implementation)
   */
  protected doDispose(): void {
    this.logger('disposal', 'starting');

    // EventHandlerRegistry dispose will be called by parent
    this.isComposing = false;

    this.logger('disposal', 'completed');
  }

  /**
   * Initialize the IME handler (legacy method kept for compatibility)
   */
  public override async initialize(): Promise<void> {
    await super.initialize();
  }

  /**
   * Setup IME composition handling with improved processing
   */
  public setupIMEHandling(): void {
    this.logger('Setting up IME composition handling');

    const compositionStartHandler = (event: CompositionEvent): void => {
      this.isComposing = true;
      this.logger(`IME composition started: ${event.data || 'no data'}`);

      // Clear any pending input events to avoid conflicts
      this.clearPendingInputEvents();
    };

    const compositionUpdateHandler = (event: CompositionEvent): void => {
      // Keep composition state active during updates
      this.isComposing = true;
      this.logger(`IME composition update: ${event.data || 'no data'}`);
    };

    const compositionEndHandler = (event: CompositionEvent): void => {
      // Immediately reset composition state - NO DELAY
      this.isComposing = false;
      this.logger(`IME composition ended immediately: ${event.data || 'no data'}`);
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

    this.logger('IME handling', 'completed');
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
        this.logger(`Cleared pending input event: ${key}`);
      }
    }
  }

  /**
   * Dispose of all event listeners and cleanup resources
   */
  public override dispose(): void {
    this.logger('Disposing IME handler');

    // Dispose EventHandlerRegistry - this will clean up all registered event listeners
    this.eventRegistry.dispose();

    // Reset composition state
    this.isComposing = false;

    // Call parent dispose
    super.dispose();

    this.logger('IMEHandler', 'completed');
  }
}
