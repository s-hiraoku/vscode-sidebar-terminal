/**
 * Split Resize Manager
 *
 * Handles drag-to-resize functionality for split terminal layouts.
 * Uses pointer events for cross-device compatibility.
 */

import { webview as log } from '../../utils/logger';
import { EventHandlerRegistry } from '../utils/EventHandlerRegistry';
import { Throttler } from '../utils/DebouncedEventBuffer';
import { SPLIT_RESIZE_CONSTANTS } from '../constants/webview';

/**
 * Drag state during resize operation
 */
export interface DragState {
  isActive: boolean;
  resizerElement: HTMLElement | null;
  startPosition: number; // clientX or clientY depending on direction
  startSizes: { before: number; after: number };
  wrapperBefore: HTMLElement | null;
  wrapperAfter: HTMLElement | null;
  direction: 'horizontal' | 'vertical';
}

/**
 * Configuration for SplitResizeManager
 */
export interface SplitResizeManagerConfig {
  /** Callback to notify PTY about terminal resize */
  onResizeComplete: () => void;
  /** Get current split direction */
  getSplitDirection: () => 'horizontal' | 'vertical';
}

/**
 * Parameters for size calculation
 */
interface SizeCalculationParams {
  startPosition: number;
  currentPosition: number;
  startSizes: { before: number; after: number };
  direction: 'horizontal' | 'vertical';
  minSize: number;
}

/**
 * Result of size calculation
 */
interface SizeCalculationResult {
  beforeSize: number;
  afterSize: number;
}

/**
 * Manages drag-to-resize functionality for split terminal layouts
 */
export class SplitResizeManager {
  private eventRegistry: EventHandlerRegistry;
  private dragState: DragState;
  private moveThrottler: Throttler | null = null;
  private ptyNotifyTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private config: SplitResizeManagerConfig;

  constructor(config: SplitResizeManagerConfig) {
    this.config = config;
    this.eventRegistry = new EventHandlerRegistry();
    this.dragState = this.createInitialDragState();

    log('📐 [SPLIT-RESIZE] SplitResizeManager initialized');
  }

  /**
   * Create initial drag state
   */
  private createInitialDragState(): DragState {
    return {
      isActive: false,
      resizerElement: null,
      startPosition: 0,
      startSizes: { before: 0, after: 0 },
      wrapperBefore: null,
      wrapperAfter: null,
      direction: 'vertical',
    };
  }

  /**
   * Initialize manager with resizer elements
   */
  public initialize(resizers: HTMLElement[]): void {
    if (this.disposed) {
      log('⚠️ [SPLIT-RESIZE] Cannot initialize - manager is disposed');
      return;
    }

    // Clean up previous event listeners
    this.eventRegistry.unregisterByPattern(/^split-resize:/);

    // Register pointer down on each resizer
    resizers.forEach((resizer, index) => {
      this.eventRegistry.register(
        `split-resize:resizer-${index}-pointerdown`,
        resizer,
        'pointerdown',
        (e) => this.handlePointerDown(e as PointerEvent, resizer)
      );
    });

    log(`📐 [SPLIT-RESIZE] Initialized with ${resizers.length} resizers`);
  }

  /**
   * Check if currently resizing
   */
  public isResizing(): boolean {
    return this.dragState.isActive;
  }

  /**
   * Get current drag state (for testing)
   */
  public getDragState(): DragState | null {
    return this.dragState.isActive ? { ...this.dragState } : null;
  }

  /**
   * Cancel any active drag operation
   */
  public cancelDrag(): void {
    if (this.dragState.isActive) {
      log('📐 [SPLIT-RESIZE] Cancelling active drag');
      this.endDrag(false);
    }
  }

  /**
   * Handle pointer down on resizer
   */
  private handlePointerDown(event: PointerEvent, resizer: HTMLElement): void {
    event.preventDefault();
    event.stopPropagation();

    // Get terminal IDs from resizer data attributes
    const beforeId = resizer.getAttribute('data-resizer-before');
    const afterId = resizer.getAttribute('data-resizer-after');

    if (!beforeId || !afterId) {
      log('⚠️ [SPLIT-RESIZE] Resizer missing terminal ID attributes');
      return;
    }

    // Find wrapper elements
    const wrapperBefore = document.querySelector<HTMLElement>(
      `[data-terminal-wrapper-id="${beforeId}"]`
    );
    const wrapperAfter = document.querySelector<HTMLElement>(
      `[data-terminal-wrapper-id="${afterId}"]`
    );

    if (!wrapperBefore || !wrapperAfter) {
      log(`⚠️ [SPLIT-RESIZE] Could not find wrappers for terminals: ${beforeId}, ${afterId}`);
      return;
    }

    // Get current split direction
    const direction = this.config.getSplitDirection();

    // Get current sizes
    const beforeRect = wrapperBefore.getBoundingClientRect();
    const afterRect = wrapperAfter.getBoundingClientRect();

    const beforeSize = direction === 'horizontal' ? beforeRect.width : beforeRect.height;
    const afterSize = direction === 'horizontal' ? afterRect.width : afterRect.height;

    // Initialize drag state
    this.dragState = {
      isActive: true,
      resizerElement: resizer,
      startPosition: direction === 'horizontal' ? event.clientX : event.clientY,
      startSizes: { before: beforeSize, after: afterSize },
      wrapperBefore,
      wrapperAfter,
      direction,
    };

    // Add visual feedback classes
    document.body.classList.add('resizing-split');
    document.body.classList.add(`resizing-${direction}`);
    resizer.classList.add('dragging');

    // Set pointer capture for smooth tracking
    resizer.setPointerCapture(event.pointerId);

    // Create throttler for move events
    this.moveThrottler = new Throttler(
      (moveEvent: unknown) => this.handlePointerMoveThrottled(moveEvent as PointerEvent),
      {
        interval: SPLIT_RESIZE_CONSTANTS.RESIZE_THROTTLE_MS,
        leading: true,
        trailing: true,
      }
    );

    // Register document-level event listeners
    this.eventRegistry.register(
      'split-resize:document-pointermove',
      document,
      'pointermove',
      (e) => this.handlePointerMove(e as PointerEvent)
    );

    this.eventRegistry.register(
      'split-resize:document-pointerup',
      document,
      'pointerup',
      (e) => this.handlePointerUp(e as PointerEvent)
    );

    // Handle pointer leaving window
    this.eventRegistry.register(
      'split-resize:document-pointercancel',
      document,
      'pointercancel',
      () => this.endDrag(false)
    );

    log(`📐 [SPLIT-RESIZE] Drag started: ${beforeId} ↔ ${afterId} (${direction})`);
  }

  /**
   * Handle pointer move (throttled)
   */
  private handlePointerMove(event: PointerEvent): void {
    if (!this.dragState.isActive || !this.moveThrottler) {
      return;
    }

    event.preventDefault();
    this.moveThrottler.trigger(event);
  }

  /**
   * Throttled handler for pointer move
   */
  private handlePointerMoveThrottled(event: PointerEvent): void {
    if (!this.dragState.isActive) {
      return;
    }

    const { direction, wrapperBefore, wrapperAfter } = this.dragState;
    if (!wrapperBefore || !wrapperAfter) {
      return;
    }

    const currentPosition = direction === 'horizontal' ? event.clientX : event.clientY;

    // Calculate new sizes
    const { beforeSize, afterSize } = this.calculateNewSizes({
      startPosition: this.dragState.startPosition,
      currentPosition,
      startSizes: this.dragState.startSizes,
      direction,
      minSize: SPLIT_RESIZE_CONSTANTS.MIN_RESIZE_SIZE_PX,
    });

    // Apply sizes using flex-basis
    const totalSize = this.dragState.startSizes.before + this.dragState.startSizes.after;
    const beforeRatio = beforeSize / totalSize;
    const afterRatio = afterSize / totalSize;

    // Use flex-grow with ratio instead of fixed pixels for responsive layout
    wrapperBefore.style.flex = `${beforeRatio} 1 0`;
    wrapperAfter.style.flex = `${afterRatio} 1 0`;

    log(
      `📐 [SPLIT-RESIZE] Resizing: before=${beforeSize.toFixed(0)}px (${(beforeRatio * 100).toFixed(1)}%), after=${afterSize.toFixed(0)}px (${(afterRatio * 100).toFixed(1)}%)`
    );
  }

  /**
   * Handle pointer up
   */
  private handlePointerUp(event: PointerEvent): void {
    if (!this.dragState.isActive) {
      return;
    }

    // Release pointer capture
    if (this.dragState.resizerElement) {
      try {
        this.dragState.resizerElement.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore if pointer capture was already released
      }
    }

    this.endDrag(true);
  }

  /**
   * End drag operation
   */
  private endDrag(notifyPty: boolean): void {
    // Remove visual feedback classes
    document.body.classList.remove('resizing-split');
    document.body.classList.remove('resizing-horizontal');
    document.body.classList.remove('resizing-vertical');

    if (this.dragState.resizerElement) {
      this.dragState.resizerElement.classList.remove('dragging');
    }

    // Clean up document-level listeners
    this.eventRegistry.unregister('split-resize:document-pointermove');
    this.eventRegistry.unregister('split-resize:document-pointerup');
    this.eventRegistry.unregister('split-resize:document-pointercancel');

    // Dispose throttler
    if (this.moveThrottler) {
      this.moveThrottler.dispose();
      this.moveThrottler = null;
    }

    // Reset drag state
    this.dragState = this.createInitialDragState();

    log('📐 [SPLIT-RESIZE] Drag ended');

    // Notify PTY with debounce
    if (notifyPty) {
      this.scheduleRefitCallback();
    }
  }

  /**
   * Schedule PTY notification with debounce
   */
  private scheduleRefitCallback(): void {
    if (this.ptyNotifyTimer !== null) {
      clearTimeout(this.ptyNotifyTimer);
    }

    this.ptyNotifyTimer = setTimeout(() => {
      this.ptyNotifyTimer = null;
      log('📐 [SPLIT-RESIZE] Notifying PTY of resize completion');
      this.config.onResizeComplete();
    }, SPLIT_RESIZE_CONSTANTS.PTY_NOTIFY_DEBOUNCE_MS);
  }

  /**
   * Calculate new sizes based on pointer delta
   */
  public calculateNewSizes(params: SizeCalculationParams): SizeCalculationResult {
    const { startPosition, currentPosition, startSizes, minSize } = params;

    // Calculate delta
    const delta = currentPosition - startPosition;

    // Calculate raw new sizes
    let beforeSize = startSizes.before + delta;
    let afterSize = startSizes.after - delta;

    // Get total size (should remain constant)
    const totalSize = startSizes.before + startSizes.after;

    // Enforce minimum sizes
    if (beforeSize < minSize) {
      beforeSize = minSize;
      afterSize = totalSize - beforeSize;
    }

    if (afterSize < minSize) {
      afterSize = minSize;
      beforeSize = totalSize - afterSize;
    }

    // Final clamp to ensure total remains constant
    if (beforeSize + afterSize !== totalSize) {
      // Adjust to maintain total
      const adjustment = (beforeSize + afterSize - totalSize) / 2;
      beforeSize -= adjustment;
      afterSize -= adjustment;
    }

    return { beforeSize, afterSize };
  }

  /**
   * Reinitialize with new resizers (called when split layout changes)
   */
  public reinitialize(resizers: HTMLElement[]): void {
    // Cancel any active drag
    this.cancelDrag();

    // Reinitialize with new resizers
    this.initialize(resizers);
  }

  /**
   * Dispose manager and clean up resources
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    log('📐 [SPLIT-RESIZE] Disposing SplitResizeManager');

    // Cancel active drag
    this.cancelDrag();

    // Clear PTY notify timer
    if (this.ptyNotifyTimer !== null) {
      clearTimeout(this.ptyNotifyTimer);
      this.ptyNotifyTimer = null;
    }

    // Dispose throttler
    if (this.moveThrottler) {
      this.moveThrottler.dispose();
      this.moveThrottler = null;
    }

    // Clean up all event listeners
    this.eventRegistry.unregisterByPattern(/^split-resize:/);
    this.eventRegistry.dispose();

    this.disposed = true;
    log('📐 [SPLIT-RESIZE] SplitResizeManager disposed');
  }
}
