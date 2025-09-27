/**
 * IME Handler - Manages Input Method Editor composition events
 * Based on VS Code's TextAreaInput pattern for accurate IME handling
 * Handles Japanese, Chinese, Korean and other complex input methods
 * Now extends BaseInputHandler for improved architecture
 */

import { IIMEHandler } from '../interfaces/IInputHandlers';
import { BaseInputHandler } from './BaseInputHandler';
import { InputStateManager } from '../services/InputStateManager';
import { InputEventService } from '../services/InputEventService';

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
 * Implements VS Code standard TextAreaInput pattern with new architecture
 */
export class IMEHandler extends BaseInputHandler implements IIMEHandler {
  // IME composition state - VS Code standard pattern
  private compositionContext: CompositionContext | null = null;

  // Track composition events for proper sequencing
  private lastCompositionEvent: string | null = null;

  // Hidden textarea reference for IME positioning (VS Code pattern)
  private hiddenTextarea: HTMLTextAreaElement | null = null;

  // State manager for unified state management
  private stateManager: InputStateManager;

  // Event service for centralized event handling
  private eventService: InputEventService;

  constructor(
    eventDebounceTimers: Map<string, number>,
    stateManager: InputStateManager,
    eventService: InputEventService
  ) {
    super('IMEHandler', eventDebounceTimers, {
      enableDebouncing: false, // IME events should not be debounced
      enableStateTracking: true,
      enableEventPrevention: false
    });

    this.stateManager = stateManager;
    this.eventService = eventService;

    this.logger('initialization', 'starting');
  }

  /**
   * Initialize the IME handler (BaseInputHandler abstract method implementation)
   */
  protected override doInitialize(): void {
    this.setupIMEHandling();
    this.logger('IMEHandler', 'completed');
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

    // Register composition events using the centralized event service
    this.eventService.registerEventHandler(
      'ime-composition-start',
      document,
      'compositionstart',
      this.handleCompositionStart.bind(this),
      { preventDefault: false, stopPropagation: false }
    );

    this.eventService.registerEventHandler(
      'ime-composition-update',
      document,
      'compositionupdate',
      this.handleCompositionUpdate.bind(this),
      { preventDefault: false, stopPropagation: false }
    );

    this.eventService.registerEventHandler(
      'ime-composition-end',
      document,
      'compositionend',
      this.handleCompositionEnd.bind(this),
      { preventDefault: false, stopPropagation: false }
    );

    // Register input event handlers for composition tracking (VS Code pattern)
    this.eventService.registerEventHandler(
      'ime-input',
      document,
      'input',
      this.handleInput.bind(this),
      { preventDefault: false, stopPropagation: false }
    );

    this.eventService.registerEventHandler(
      'ime-beforeinput',
      document,
      'beforeinput',
      this.handleBeforeInput.bind(this),
      { preventDefault: false, stopPropagation: false }
    );

    this.logger('IME handling', 'completed');
  }

  /**
   * Handle composition start event
   */
  private handleCompositionStart(event: Event): void {
    const compositionEvent = event as CompositionEvent;
    this.logger(`IME composition started: ${compositionEvent.data || 'no data'}`);

    // Create composition context (VS Code CompositionContext pattern)
    this.compositionContext = {
      data: compositionEvent.data || '',
      isActive: true,
      startOffset: 0,
      endOffset: 0
    };

    this.lastCompositionEvent = 'start';

    // Update state manager
    this.stateManager.updateIMEState({
      isActive: true,
      data: compositionEvent.data || '',
      startOffset: 0,
      endOffset: 0,
      lastEvent: 'start',
      timestamp: Date.now()
    });

    // Clear any pending input events to avoid conflicts
    this.clearPendingInputEvents();

    // Position hidden textarea for accurate IME positioning
    this.positionHiddenTextarea();
  }

  /**
   * Handle composition update event
   */
  private handleCompositionUpdate(event: Event): void {
    const compositionEvent = event as CompositionEvent;
    this.logger(`IME composition update: ${compositionEvent.data || 'no data'}`);

    // Update composition context with new data
    if (this.compositionContext) {
      this.compositionContext.data = compositionEvent.data || '';
      this.compositionContext.isActive = true;
    } else {
      // Handle case where update comes without start (Android/some IMEs)
      this.compositionContext = {
        data: compositionEvent.data || '',
        isActive: true,
        startOffset: 0,
        endOffset: 0
      };
    }

    this.lastCompositionEvent = 'update';

    // Update state manager
    this.stateManager.updateIMEState({
      isActive: true,
      data: compositionEvent.data || '',
      lastEvent: 'update',
      timestamp: Date.now()
    });
  }

  /**
   * Handle composition end event
   */
  private handleCompositionEnd(event: Event): void {
    const compositionEvent = event as CompositionEvent;
    this.logger(`IME composition ended: ${compositionEvent.data || 'no data'}`);

    // Update final composition data
    if (this.compositionContext) {
      this.compositionContext.data = compositionEvent.data || '';
      this.compositionContext.isActive = false;
    }

    this.lastCompositionEvent = 'end';

    // Update state manager
    this.stateManager.updateIMEState({
      isActive: false,
      data: compositionEvent.data || '',
      lastEvent: 'end',
      timestamp: Date.now()
    });

    // Clear composition context after a brief delay to handle input events
    // VS Code pattern: Allow input events to process before clearing
    setTimeout(() => {
      this.compositionContext = null;
      this.lastCompositionEvent = null;
      this.hideHiddenTextarea();

      // Final state reset
      this.stateManager.updateIMEState({
        isActive: false,
        data: '',
        lastEvent: null,
        timestamp: Date.now()
      });
    }, 0);
  }

  /**
   * Handle input events during composition (VS Code pattern)
   */
  private handleInput(event: Event): void {
    const inputEvent = event as InputEvent;

    // Only process input events during active composition
    if (this.compositionContext?.isActive) {
      this.logger(`Input during composition: ${inputEvent.data || 'no data'}, isComposing: ${inputEvent.isComposing}`);

      // Update composition context with input data if available
      if (inputEvent.data && this.compositionContext) {
        this.compositionContext.data = inputEvent.data;

        // Update state manager
        this.stateManager.updateIMEState({
          data: inputEvent.data,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Handle beforeinput events (VS Code pattern for better composition tracking)
   */
  private handleBeforeInput(event: Event): void {
    const inputEvent = event as InputEvent;

    if (this.compositionContext?.isActive) {
      this.logger(`Before input during composition: ${inputEvent.data || 'no data'}, isComposing: ${inputEvent.isComposing}`);
    }
  }

  /**
   * Check if IME is currently composing (VS Code standard pattern)
   */
  public isIMEComposing(): boolean {
    return this.stateManager.getStateSection('ime').isActive;
  }

  /**
   * Get current composition data
   */
  public getCompositionData(): string | null {
    return this.stateManager.getStateSection('ime').data || null;
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
   * Dispose IME handler resources (BaseInputHandler abstract method implementation)
   */
  protected override doDispose(): void {
    this.logger('disposal', 'starting');

    // Clear composition context
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

    // Reset IME state in state manager
    this.stateManager.resetStateSection('ime');

    // Unregister all events from event service
    if (this.eventService) {
      this.eventService.unregisterEventHandler('ime-composition-start');
      this.eventService.unregisterEventHandler('ime-composition-update');
      this.eventService.unregisterEventHandler('ime-composition-end');
      this.eventService.unregisterEventHandler('ime-input');
      this.eventService.unregisterEventHandler('ime-beforeinput');
    }

    // Call parent dispose
    super.doDispose();

    this.logger('disposal', 'completed');
  }

  /**
   * Dispose of all event listeners and cleanup resources
   */
  public override dispose(): void {
    this.logger('Disposing IME handler');

    // Call parent dispose which will call doDispose()
    super.dispose();

    this.logger('IMEHandler', 'completed');
  }
}