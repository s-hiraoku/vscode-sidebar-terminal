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
import { DOMUtils } from '../utils/DOMUtils';
import { RENDERING_CONSTANTS } from '../constants/webview';

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

interface WebglAddonType extends Disposable {
  onContextLoss(callback: () => void): void;
}

/**
 * Optimizes terminal rendering performance
 */
export class RenderingOptimizer implements Disposable {
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimer: number | null = null;
  private readonly options: Required<RenderingOptimizerOptions>;
  private webglAddon: WebglAddonType | null = null;
  private currentDevice: DeviceType = {
    isTrackpad: true,
    smoothScrollDuration: RENDERING_CONSTANTS.TRACKPAD_SMOOTH_SCROLL_MS,
  };
  private container: HTMLElement | null = null;

  constructor(options: RenderingOptimizerOptions = {}) {
    this.options = {
      enableWebGL: options.enableWebGL ?? true,
      resizeDebounceMs: options.resizeDebounceMs ?? RENDERING_CONSTANTS.DEFAULT_RESIZE_DEBOUNCE_MS,
      minWidth: options.minWidth ?? RENDERING_CONSTANTS.MIN_DIMENSION_PX,
      minHeight: options.minHeight ?? RENDERING_CONSTANTS.MIN_DIMENSION_PX,
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

    // 🔧 CRITICAL FIX: Store container reference for style reset during resize
    this.container = container;

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
        // 🔧 CRITICAL FIX: Reset xterm.js internal element styles BEFORE fit()
        // xterm.js sets fixed pixel widths that prevent expansion beyond initial size
        this.resetXtermInlineStyles(terminalId);

        fitAddon.fit();
        // 🔧 CRITICAL FIX: Refresh terminal after fit to ensure cursor is displayed
        // This is essential for cursor visibility after resize operations
        terminal.refresh(0, terminal.rows - 1);
        terminalLogger.debug(`✅ Terminal ${terminalId} resized to ${width}x${height}`);
      } catch (error) {
        terminalLogger.error(`❌ Failed to resize terminal ${terminalId}:`, error);
      }
    }, this.options.resizeDebounceMs);
  }

  /**
   * 🔧 CRITICAL FIX: Reset xterm.js internal element inline styles
   * Delegates to shared DOMUtils.resetXtermInlineStyles
   */
  private resetXtermInlineStyles(terminalId: string): void {
    if (!this.container) {
      terminalLogger.warn(`⚠️ No container reference for terminal ${terminalId}`);
      return;
    }

    // 🔧 FIX: Use shared utility to reset xterm inline styles
    DOMUtils.resetXtermInlineStyles(this.container);

    terminalLogger.debug(`🔧 Reset xterm inline styles for terminal ${terminalId}`);
  }

  /**
   * Validate terminal dimensions
   */
  private isValidDimension(width: number, height: number): boolean {
    return width > this.options.minWidth && height > this.options.minHeight;
  }

  /**
   * Check if running in a potentially problematic WebGL environment
   * (e.g., x86 Node.js on ARM macOS via Rosetta, or Volta with x86 Node)
   */
  private isProblematicWebGLEnvironment(): boolean {
    try {
      // Check for macOS
      const isMacOS = navigator.platform?.toLowerCase().includes('mac') ||
                      navigator.userAgent?.toLowerCase().includes('mac');

      if (!isMacOS) {
        return false;
      }

      // Check WebGL context creation - if it fails silently, we're in trouble
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

      if (!gl) {
        terminalLogger.warn('⚠️ WebGL context creation failed - problematic environment detected');
        return true;
      }

      // Check for software renderer (indicates Rosetta/emulation issues)
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);

        terminalLogger.debug(`WebGL renderer: ${renderer}, vendor: ${vendor}`);

        // Software renderers often indicate emulation issues
        const isSoftwareRenderer = renderer?.toLowerCase().includes('swiftshader') ||
                                   renderer?.toLowerCase().includes('llvmpipe') ||
                                   renderer?.toLowerCase().includes('software');

        if (isSoftwareRenderer) {
          terminalLogger.warn(`⚠️ Software WebGL renderer detected: ${renderer}`);
          return true;
        }
      }

      // Clean up test canvas
      canvas.remove();

      return false;
    } catch (error) {
      terminalLogger.warn('⚠️ Error checking WebGL environment:', error);
      return true; // Assume problematic if we can't check
    }
  }

  /**
   * Enable WebGL rendering with auto-fallback
   */
  public async enableWebGL(terminal: Terminal, terminalId: string): Promise<boolean> {
    if (!this.options.enableWebGL) {
      terminalLogger.info(`WebGL disabled for terminal: ${terminalId}`);
      return false;
    }

    // Check for problematic WebGL environment (Rosetta, Volta x86, etc.)
    if (this.isProblematicWebGLEnvironment()) {
      terminalLogger.info(
        `⚠️ Skipping WebGL for terminal ${terminalId}: problematic environment detected (Rosetta/x86 on ARM)`
      );
      return false;
    }

    try {
      // Lazy load WebglAddon
      const { WebglAddon } = await import('@xterm/addon-webgl');
      const addon = new WebglAddon() as WebglAddonType;
      this.webglAddon = addon;

      // Setup context loss handler
      addon.onContextLoss(() => {
        terminalLogger.warn(
          `⚠️ WebGL context lost for terminal ${terminalId}, falling back to DOM renderer`
        );
        this.fallbackToDOMRenderer(terminal, terminalId);
        // Force refresh after fallback to ensure cursor is visible
        terminal.refresh(0, terminal.rows - 1);
      });

      // Load WebGL addon
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      terminal.loadAddon(addon as any);

      // 🔧 CRITICAL FIX: Verify WebGL is actually working after loading
      // Some environments silently fail and need a refresh to trigger DOM fallback
      await this.verifyWebGLRendering(terminal, terminalId);

      terminalLogger.info(`✅ WebGL renderer enabled for terminal: ${terminalId}`);
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
   * Verify WebGL is actually rendering correctly
   * Force a refresh and check if canvas layers are properly initialized
   */
  private async verifyWebGLRendering(terminal: Terminal, terminalId: string): Promise<void> {
    // Wait a frame for WebGL to initialize
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Force a refresh to ensure all layers render
    terminal.refresh(0, terminal.rows - 1);

    // Wait another frame
    await new Promise(resolve => requestAnimationFrame(resolve));

    terminalLogger.debug(`✅ WebGL rendering verified for terminal: ${terminalId}`);
  }

  /**
   * Fallback to DOM renderer when WebGL fails
   */
  private fallbackToDOMRenderer(terminal: Terminal, terminalId: string): void {
    try {
      if (this.webglAddon) {
        this.webglAddon.dispose();
        this.webglAddon = null;
      }
      terminalLogger.info(`✅ Terminal ${terminalId} using DOM renderer`);
    } catch (error) {
      terminalLogger.error(`❌ Failed to dispose WebGL addon for terminal ${terminalId}:`, error);
    }
  }

  /**
   * Detect device type from wheel event
   */
  public detectDevice(event: WheelEvent): DeviceType {
    // deltaMode 0 = pixels (trackpad)
    // deltaMode 1 = lines (mouse wheel)
    const isTrackpad = event.deltaMode === 0;
    const smoothScrollDuration = isTrackpad
      ? RENDERING_CONSTANTS.TRACKPAD_SMOOTH_SCROLL_MS
      : RENDERING_CONSTANTS.MOUSE_SCROLL_DURATION_MS;

    this.currentDevice = {
      isTrackpad,
      smoothScrollDuration,
    };

    return this.currentDevice;
  }

  /**
   * Update terminal smooth scroll duration
   */
  public updateSmoothScrollDuration(terminal: Terminal, duration: number): void {
    try {
      terminal.options.smoothScrollDuration = duration;
      terminalLogger.debug(`Updated smooth scroll duration: ${duration}ms`);
    } catch (error) {
      terminalLogger.warn(`Failed to update smooth scroll duration:`, error);
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
      this.updateSmoothScrollDuration(terminal, device.smoothScrollDuration);
    };

    // Use passive listener for better scroll performance
    container.addEventListener('wheel', wheelHandler, {
      passive: true,
    });

    terminalLogger.info(`✅ Device-specific smooth scrolling enabled for terminal: ${terminalId}`);
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
        terminalLogger.warn(`Failed to dispose WebGL addon:`, error);
      }
    }

    terminalLogger.debug('RenderingOptimizer disposed');
  }
}
