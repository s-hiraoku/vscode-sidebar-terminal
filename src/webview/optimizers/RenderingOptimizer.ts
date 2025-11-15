/**
 * Rendering Optimizer
 *
 * Optimizes terminal rendering performance through:
 * - ResizeObserver-based debounced resizing (100ms)
 * - Dimension validation (min 50px width/height)
 * - WebGL auto-fallback to DOM renderer
 * - Device-specific smooth scrolling (trackpad: 0ms, mouse: 125ms)
 *
 * @see openspec/changes/optimize-terminal-rendering/specs/optimize-rendering/spec.md
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { terminalLogger } from '../utils/ManagerLogger';

export interface RenderingOptimizerOptions {
  enableWebGL?: boolean;
  resizeDebounceMs?: number;
  minWidth?: number;
  minHeight?: number;
}

export interface DeviceType {
  isTrackpad: boolean;
  smoothScrollDuration: number;
}

interface Disposable {
  dispose(): void;
}

/**
 * Optimizes terminal rendering performance
 */
export class RenderingOptimizer implements Disposable {
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimer: number | null = null;
  private readonly options: Required<RenderingOptimizerOptions>;
  private webglAddon: any = null;
  private currentDevice: DeviceType = {
    isTrackpad: true, // Default to trackpad
    smoothScrollDuration: 0,
  };

  constructor(options: RenderingOptimizerOptions = {}) {
    this.options = {
      enableWebGL: options.enableWebGL ?? true,
      resizeDebounceMs: options.resizeDebounceMs ?? 100,
      minWidth: options.minWidth ?? 50,
      minHeight: options.minHeight ?? 50,
    };
  }

  /**
   * Setup optimized resize handling with ResizeObserver
   */
  public setupOptimizedResize(
    terminal: Terminal,
    fitAddon: FitAddon,
    container: HTMLElement,
    terminalId: string
  ): void {
    // Clean up existing observer
    this.disposeResizeObserver();

    // Create ResizeObserver for efficient resize detection
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.handleResize(entry, terminal, fitAddon, terminalId);
      }
    });

    this.resizeObserver.observe(container);
    terminalLogger.info(`✅ ResizeObserver setup for terminal: ${terminalId}`);
  }

  /**
   * Handle resize with debouncing and dimension validation
   */
  private handleResize(
    entry: ResizeObserverEntry,
    terminal: Terminal,
    fitAddon: FitAddon,
    terminalId: string
  ): void {
    // Clear existing timer
    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer);
    }

    // Debounce resize events
    this.resizeTimer = window.setTimeout(() => {
      const { width, height } = entry.contentRect;

      // Validate dimensions
      if (!this.isValidDimension(width, height)) {
        terminalLogger.warn(
          `⚠️ Skipping resize for terminal ${terminalId}: invalid dimensions (${width}x${height})`
        );
        return;
      }

      // Perform resize
      try {
        fitAddon.fit();
        terminalLogger.debug(
          `✅ Terminal ${terminalId} resized to ${width}x${height}`
        );
      } catch (error) {
        terminalLogger.error(
          `❌ Failed to resize terminal ${terminalId}:`,
          error
        );
      }
    }, this.options.resizeDebounceMs);
  }

  /**
   * Validate terminal dimensions
   */
  private isValidDimension(width: number, height: number): boolean {
    return (
      width > this.options.minWidth &&
      height > this.options.minHeight
    );
  }

  /**
   * Enable WebGL rendering with auto-fallback
   */
  public async enableWebGL(
    terminal: Terminal,
    terminalId: string
  ): Promise<boolean> {
    if (!this.options.enableWebGL) {
      terminalLogger.info(
        `WebGL disabled for terminal: ${terminalId}`
      );
      return false;
    }

    try {
      // Lazy load WebglAddon
      const { WebglAddon } = await import('@xterm/addon-webgl');
      this.webglAddon = new WebglAddon();

      // Setup context loss handler
      this.webglAddon.onContextLoss(() => {
        terminalLogger.warn(
          `⚠️ WebGL context lost for terminal ${terminalId}, falling back to DOM renderer`
        );
        this.fallbackToDOMRenderer(terminal, terminalId);
      });

      // Load WebGL addon
      terminal.loadAddon(this.webglAddon);
      terminalLogger.info(
        `✅ WebGL renderer enabled for terminal: ${terminalId}`
      );
      return true;
    } catch (error) {
      terminalLogger.warn(
        `⚠️ Failed to enable WebGL for terminal ${terminalId}, using DOM renderer:`,
        error
      );
      this.fallbackToDOMRenderer(terminal, terminalId);
      return false;
    }
  }

  /**
   * Fallback to DOM renderer when WebGL fails
   */
  private fallbackToDOMRenderer(
    terminal: Terminal,
    terminalId: string
  ): void {
    try {
      if (this.webglAddon) {
        this.webglAddon.dispose();
        this.webglAddon = null;
      }
      terminalLogger.info(
        `✅ Terminal ${terminalId} using DOM renderer`
      );
    } catch (error) {
      terminalLogger.error(
        `❌ Failed to dispose WebGL addon for terminal ${terminalId}:`,
        error
      );
    }
  }

  /**
   * Detect device type from wheel event
   */
  public detectDevice(event: WheelEvent): DeviceType {
    // deltaMode 0 = pixels (trackpad)
    // deltaMode 1 = lines (mouse wheel)
    const isTrackpad = event.deltaMode === 0;
    const smoothScrollDuration = isTrackpad ? 0 : 125;

    this.currentDevice = {
      isTrackpad,
      smoothScrollDuration,
    };

    return this.currentDevice;
  }

  /**
   * Update terminal smooth scroll duration
   */
  public updateSmoothScrollDuration(
    terminal: Terminal,
    duration: number
  ): void {
    try {
      terminal.options.smoothScrollDuration = duration;
      terminalLogger.debug(
        `Updated smooth scroll duration: ${duration}ms`
      );
    } catch (error) {
      terminalLogger.warn(
        `Failed to update smooth scroll duration:`,
        error
      );
    }
  }

  /**
   * Setup device-specific smooth scrolling
   */
  public setupSmoothScrolling(
    terminal: Terminal,
    container: HTMLElement,
    terminalId: string
  ): void {
    const wheelHandler = (event: WheelEvent) => {
      const device = this.detectDevice(event);
      this.updateSmoothScrollDuration(
        terminal,
        device.smoothScrollDuration
      );
    };

    // Use passive listener for better scroll performance
    container.addEventListener('wheel', wheelHandler, {
      passive: true,
    });

    terminalLogger.info(
      `✅ Device-specific smooth scrolling enabled for terminal: ${terminalId}`
    );
  }

  /**
   * Dispose resize observer
   */
  private disposeResizeObserver(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.disposeResizeObserver();

    if (this.webglAddon) {
      try {
        this.webglAddon.dispose();
        this.webglAddon = null;
      } catch (error) {
        terminalLogger.warn(
          `Failed to dispose WebGL addon:`,
          error
        );
      }
    }

    terminalLogger.debug('RenderingOptimizer disposed');
  }
}
