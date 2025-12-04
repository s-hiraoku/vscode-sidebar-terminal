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
   * Check if WebGL environment is problematic
   * Some macOS configurations with certain GPU drivers can cause
   * rendering issues with WebGL in VS Code WebViews.
   */
  private isProblematicWebGLEnvironment(): boolean {
    try {
      // Check if we're in a VS Code WebView (limited WebGL support)
      const isVSCodeWebView = typeof window !== 'undefined' &&
        window.navigator.userAgent.includes('Electron');

      // Check if we're on macOS
      const isMacOS = typeof window !== 'undefined' &&
        window.navigator.userAgent.includes('Mac');

      // Test WebGL context creation
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

      if (!gl) {
        terminalLogger.warn('⚠️ WebGL not available in this environment');
        return true;
      }

      // Check for known problematic configurations
      const renderer = gl.getParameter(gl.RENDERER) || '';
      const vendor = gl.getParameter(gl.VENDOR) || '';

      terminalLogger.debug(`WebGL Renderer: ${renderer}, Vendor: ${vendor}`);

      // Some integrated GPUs on macOS have issues with WebGL in WebViews
      const problematicPatterns = [
        /SwiftShader/i,    // Software renderer (indicates GPU issues)
        /llvmpipe/i,       // Software renderer on Linux
      ];

      for (const pattern of problematicPatterns) {
        if (pattern.test(renderer) || pattern.test(vendor)) {
          terminalLogger.warn(`⚠️ Detected problematic WebGL renderer: ${renderer}`);
          return true;
        }
      }

      // Additional check: VS Code WebView on macOS can have WebGL issues
      // when creating multiple terminals due to context limit
      if (isVSCodeWebView && isMacOS) {
        terminalLogger.info('ℹ️ macOS VS Code WebView detected - WebGL may be unstable');
        // Don't return true here - let it try WebGL first, it will fallback if needed
      }

      return false;
    } catch (error) {
      terminalLogger.warn('⚠️ Error checking WebGL environment:', error);
      return true;
    }
  }

  /**
   * Verify WebGL rendering is working after addon load
   */
  private verifyWebGLRendering(terminal: Terminal, terminalId: string): boolean {
    try {
      // Check if the terminal has canvas layers
      const element = terminal.element;
      if (!element) {
        terminalLogger.warn(`⚠️ Terminal ${terminalId} has no element for WebGL verification`);
        return false;
      }

      // Look for WebGL canvas (xterm.js creates a canvas for WebGL rendering)
      const canvases = element.querySelectorAll('canvas');
      if (canvases.length === 0) {
        terminalLogger.warn(`⚠️ No canvas elements found for terminal ${terminalId}`);
        return false;
      }

      // Check if any canvas has WebGL context
      for (const canvas of canvases) {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl && !gl.isContextLost()) {
          terminalLogger.debug(`✅ WebGL context verified for terminal ${terminalId}`);
          return true;
        }
      }

      terminalLogger.warn(`⚠️ WebGL context not found or lost for terminal ${terminalId}`);
      return false;
    } catch (error) {
      terminalLogger.warn(`⚠️ WebGL verification failed for terminal ${terminalId}:`, error);
      return false;
    }
  }

  /**
   * Enable WebGL rendering with auto-fallback
   *
   * 🔧 TEMPORARILY DISABLED: WebGL causes rendering issues where text/cursor
   * disappear after initial render, especially on macOS. The DOM renderer
   * works correctly. This should be re-enabled once the WebGL timing issue
   * is resolved.
   */
  public async enableWebGL(terminal: Terminal, terminalId: string): Promise<boolean> {
    // 🔧 FIX: Temporarily disable WebGL to fix text/cursor visibility issues
    // WebGL loads AFTER theme is applied and overwrites the terminal rendering
    // causing black backgrounds and invisible text
    terminalLogger.info(`🔧 WebGL disabled for terminal ${terminalId} (DOM renderer used for stability)`);
    return false;

    // Original code below - re-enable when WebGL timing is fixed
    /*
    if (!this.options.enableWebGL) {
      terminalLogger.info(`WebGL disabled for terminal: ${terminalId}`);
      return false;
    }

    // Check for problematic WebGL environments first
    if (this.isProblematicWebGLEnvironment()) {
      terminalLogger.info(`🔧 Skipping WebGL for terminal ${terminalId} due to problematic environment`);
      return false;
    }
    */

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
      });

      // Load WebGL addon
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      terminal.loadAddon(addon as any);
      terminalLogger.info(`✅ WebGL renderer enabled for terminal: ${terminalId}`);

      // Verify WebGL is actually working after a short delay
      setTimeout(() => {
        if (!this.verifyWebGLRendering(terminal, terminalId)) {
          terminalLogger.warn(`⚠️ WebGL verification failed for ${terminalId}, switching to DOM renderer`);
          this.fallbackToDOMRenderer(terminal, terminalId);
          // Force a terminal refresh to ensure DOM renderer redraws properly
          terminal.refresh(0, terminal.rows - 1);
        }
      }, 100);

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
  private fallbackToDOMRenderer(terminal: Terminal, terminalId: string): void {
    try {
      if (this.webglAddon) {
        this.webglAddon.dispose();
        this.webglAddon = null;
      }
      terminalLogger.info(`✅ Terminal ${terminalId} using DOM renderer`);

      // Force terminal refresh to ensure DOM renderer redraws text properly
      // This is critical when switching from failed WebGL to DOM renderer
      setTimeout(() => {
        try {
          terminal.refresh(0, terminal.rows - 1);
          terminalLogger.debug(`🔄 Terminal ${terminalId} refreshed after DOM renderer fallback`);
        } catch (error) {
          terminalLogger.warn(`⚠️ Failed to refresh terminal ${terminalId}:`, error);
        }
      }, 50);
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
