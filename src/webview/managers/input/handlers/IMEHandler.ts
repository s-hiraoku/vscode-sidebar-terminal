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
  
  // Add buffer for composition end handling
  private compositionEndBuffer: string = '';
  private compositionEndTimer: number | null = null;

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
      // Store the composition data for later processing
      this.compositionEndBuffer = event.data || '';
      this.logger.debug(`IME composition ended: ${event.data || 'no data'}`);

      // Clear any existing timer
      if (this.compositionEndTimer !== null) {
        clearTimeout(this.compositionEndTimer);
      }

      // Delay the composition state reset to ensure proper IME handling
      // This prevents race conditions with xterm.js onData events
      this.compositionEndTimer = window.setTimeout(() => {
        this.isComposing = false;
        this.compositionEndBuffer = '';
        this.compositionEndTimer = null;
        this.logger.debug('IME composition state reset after buffer period');
      }, 50); // 50ms buffer to handle timing issues
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
   * Check if the given data matches the recent composition end buffer
   * This helps identify if input should be suppressed due to IME completion
   */
  public isCompositionEndData(data: string): boolean {
    return this.compositionEndBuffer !== '' && this.compositionEndBuffer === data;
  }

  /**
   * Clear any pending input events that might conflict with IME
   */
  public clearPendingInputEvents(): void {
    // Clear any debounced events that might interfere with IME composition
    for (const [key, timer] of this.eventDebounceTimers) {
      if (key.includes('input') || key.includes('keydown') || key.includes('data') || key.includes('terminal')) {
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

    // Clear composition end timer
    if (this.compositionEndTimer !== null) {
      clearTimeout(this.compositionEndTimer);
      this.compositionEndTimer = null;
    }

    // Dispose EventHandlerRegistry - this will clean up all registered event listeners
    this.eventRegistry.dispose();

    // Reset composition state
    this.isComposing = false;
    this.compositionEndBuffer = '';

    // Call parent dispose
    super.dispose();

    this.logger.lifecycle('IMEHandler', 'completed');
  }
}