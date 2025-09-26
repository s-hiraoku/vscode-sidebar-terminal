/**
 * IME Handler - Manages Input Method Editor composition events
 * Based on VS Code's TextAreaInput pattern for accurate IME handling
 * Handles Japanese, Chinese, Korean and other complex input methods
 */

import { IIMEHandler } from '../interfaces/IInputHandlers';
import { BaseManager } from '../../BaseManager';
import { EventHandlerRegistry } from '../../../utils/EventHandlerRegistry';

/**
 * Composition context for tracking IME state
 * Based on VS Code's CompositionContext pattern
 */
interface CompositionContext {
  data: string;
  isActive: boolean;
  startOffset: number;
  endOffset: number;
}

/**
 * IME Handler for managing composition events
 * Implements VS Code standard TextAreaInput pattern
 */
export class IMEHandler extends BaseManager implements IIMEHandler {
  // Event handler registry for centralized event management
  protected readonly eventRegistry = new EventHandlerRegistry();

  // IME composition state - VS Code standard pattern
  private compositionContext: CompositionContext | null = null;

  // Track composition events for proper sequencing
  private lastCompositionEvent: string | null = null;

  // Hidden textarea reference for IME positioning (VS Code pattern)
  private hiddenTextarea: HTMLTextAreaElement | null = null;

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

    // Clear composition context
    this.compositionContext = null;
    this.lastCompositionEvent = null;

    // Remove hidden textarea
    if (this.hiddenTextarea) {
      document.body.removeChild(this.hiddenTextarea);
      this.hiddenTextarea = null;
    }

    // EventHandlerRegistry dispose will be called by parent

    this.logger('disposal', 'completed');
  }

  /**
   * Initialize the IME handler (legacy method kept for compatibility)
   */
  public override async initialize(): Promise<void> {
    await super.initialize();
  }

  /**
   * Setup IME composition handling with VS Code standard pattern
   */
  public setupIMEHandling(): void {
    this.logger('Setting up VS Code standard IME composition handling');

    // Create hidden textarea for proper IME positioning (VS Code pattern)
    this.createHiddenTextarea();

    const compositionStartHandler = (event: CompositionEvent): void => {
      this.logger(`IME composition started: ${event.data || 'no data'}`);

      // Create composition context (VS Code CompositionContext pattern)
      this.compositionContext = {
        data: event.data || '',
        isActive: true,
        startOffset: 0,
        endOffset: 0
      };

      this.lastCompositionEvent = 'start';

      // Clear any pending input events to avoid conflicts
      this.clearPendingInputEvents();

      // Position hidden textarea for accurate IME positioning
      this.positionHiddenTextarea();
    };

    const compositionUpdateHandler = (event: CompositionEvent): void => {
      this.logger(`IME composition update: ${event.data || 'no data'}`);

      // Update composition context with new data
      if (this.compositionContext) {
        this.compositionContext.data = event.data || '';
        this.compositionContext.isActive = true;
      } else {
        // Handle case where update comes without start (Android/some IMEs)
        this.compositionContext = {
          data: event.data || '',
          isActive: true,
          startOffset: 0,
          endOffset: 0
        };
      }

      this.lastCompositionEvent = 'update';
    };

    const compositionEndHandler = (event: CompositionEvent): void => {
      this.logger(`IME composition ended: ${event.data || 'no data'}`);

      // Update final composition data
      if (this.compositionContext) {
        this.compositionContext.data = event.data || '';
        this.compositionContext.isActive = false;
      }

      this.lastCompositionEvent = 'end';

      // Clear composition context after a brief delay to handle input events
      // VS Code pattern: Allow input events to process before clearing
      setTimeout(() => {
        this.compositionContext = null;
        this.lastCompositionEvent = null;
        this.hideHiddenTextarea();
      }, 0);
    };

    // Handle input events during composition (VS Code pattern)
    const inputHandler = (event: InputEvent): void => {
      // Only process input events during active composition
      if (this.compositionContext?.isActive) {
        this.logger(`Input during composition: ${event.data || 'no data'}, isComposing: ${event.isComposing}`);

        // Update composition context with input data if available
        if (event.data && this.compositionContext) {
          this.compositionContext.data = event.data;
        }
      }
    };

    // Handle beforeinput events (VS Code pattern for better composition tracking)
    const beforeInputHandler = (event: InputEvent): void => {
      if (this.compositionContext?.isActive) {
        this.logger(`Before input during composition: ${event.data || 'no data'}, isComposing: ${event.isComposing}`);
      }
    };

    // Register IME event handlers using EventHandlerRegistry (VS Code pattern)
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

    // Register input event handlers for composition tracking (VS Code pattern)
    this.eventRegistry.register(
      'ime-input',
      document,
      'input',
      inputHandler as EventListener
    );

    this.eventRegistry.register(
      'ime-beforeinput',
      document,
      'beforeinput',
      beforeInputHandler as EventListener
    );

    this.logger('IME handling', 'completed');
  }

  /**
   * Check if IME is currently composing (VS Code standard pattern)
   */
  public isIMEComposing(): boolean {
    return this.compositionContext?.isActive === true;
  }

  /**
   * Get current composition data
   */
  public getCompositionData(): string | null {
    return this.compositionContext?.data || null;
  }

  /**
   * Create hidden textarea for proper IME positioning (VS Code pattern)
   */
  private createHiddenTextarea(): void {
    if (this.hiddenTextarea) {
      return; // Already created
    }

    this.hiddenTextarea = document.createElement('textarea');
    this.hiddenTextarea.style.position = 'absolute';
    this.hiddenTextarea.style.left = '-9999px';
    this.hiddenTextarea.style.top = '-9999px';
    this.hiddenTextarea.style.width = '1px';
    this.hiddenTextarea.style.height = '1px';
    this.hiddenTextarea.style.opacity = '0';
    this.hiddenTextarea.style.zIndex = '-1';
    this.hiddenTextarea.setAttribute('aria-hidden', 'true');
    this.hiddenTextarea.tabIndex = -1;

    document.body.appendChild(this.hiddenTextarea);
    this.logger('Created hidden textarea for IME positioning');
  }

  /**
   * Position hidden textarea near active terminal for accurate IME positioning
   */
  private positionHiddenTextarea(): void {
    if (!this.hiddenTextarea) {
      return;
    }

    // Find active terminal container
    const activeTerminal = document.querySelector('.terminal-container.active');
    if (activeTerminal) {
      const rect = activeTerminal.getBoundingClientRect();

      // Position textarea at the active cursor position (approximate)
      this.hiddenTextarea.style.left = `${rect.left}px`;
      this.hiddenTextarea.style.top = `${rect.top + rect.height / 2}px`;
      this.hiddenTextarea.style.zIndex = '1000';

      // Temporarily make visible for IME (VS Code pattern)
      this.hiddenTextarea.style.opacity = '0.01';

      this.logger('Positioned hidden textarea for IME');
    }
  }

  /**
   * Hide the textarea after composition ends
   */
  private hideHiddenTextarea(): void {
    if (this.hiddenTextarea) {
      this.hiddenTextarea.style.left = '-9999px';
      this.hiddenTextarea.style.top = '-9999px';
      this.hiddenTextarea.style.zIndex = '-1';
      this.hiddenTextarea.style.opacity = '0';
      this.logger('Hidden textarea after composition');
    }
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

    // Clear composition state
    this.compositionContext = null;
    this.lastCompositionEvent = null;

    // Remove hidden textarea
    if (this.hiddenTextarea) {
      try {
        document.body.removeChild(this.hiddenTextarea);
      } catch (error) {
        this.logger(`Error removing hidden textarea: ${error}`);
      }
      this.hiddenTextarea = null;
    }

    // Call parent dispose
    super.dispose();

    this.logger('IMEHandler', 'completed');
  }
}
