/**
 * Optimizes terminal rendering through debounced resizing, dimension validation,
 * WebGL auto-fallback, and device-specific smooth scrolling.
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

  public setupOptimizedResize(
    terminal: Terminal,
    fitAddon: FitAddon,
    container: HTMLElement,
    terminalId: string
  ): void {
    this.disposeResizeObserver();
    this.container = container;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.handleResize(entry, terminal, fitAddon, terminalId);
      }
    });

    this.resizeObserver.observe(container);
    terminalLogger.info(`✅ ResizeObserver setup for terminal: ${terminalId}`);
  }

  private handleResize(
    entry: ResizeObserverEntry,
    terminal: Terminal,
    fitAddon: FitAddon,
    terminalId: string
  ): void {
    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer);
    }

    this.resizeTimer = window.setTimeout(() => {
      const { width, height } = entry.contentRect;

      if (!this.isValidDimension(width, height)) {
        terminalLogger.warn(
          `⚠️ Skipping resize for terminal ${terminalId}: invalid dimensions (${width}x${height})`
        );
        return;
      }

      try {
        this.resetXtermInlineStyles(terminalId);
        fitAddon.fit();
        terminal.refresh(0, terminal.rows - 1);
        terminalLogger.debug(`✅ Terminal ${terminalId} resized to ${width}x${height}`);
      } catch (error) {
        terminalLogger.error(`❌ Failed to resize terminal ${terminalId}:`, error);
      }
    }, this.options.resizeDebounceMs);
  }

  private resetXtermInlineStyles(terminalId: string): void {
    if (!this.container) {
      terminalLogger.warn(`⚠️ No container reference for terminal ${terminalId}`);
      return;
    }

    DOMUtils.resetXtermInlineStyles(this.container);
    terminalLogger.debug(`🔧 Reset xterm inline styles for terminal ${terminalId}`);
  }

  private isValidDimension(width: number, height: number): boolean {
    return width > this.options.minWidth && height > this.options.minHeight;
  }

  /**
   * Check if running in a potentially problematic WebGL environment
   * (e.g., x86 Node.js on ARM macOS via Rosetta, or Volta with x86 Node)
   *
   * @see https://github.com/electron/electron/issues/45574
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
      const renderer = (gl.getParameter(gl.RENDERER) || '') as string;
      const vendor = (gl.getParameter(gl.VENDOR) || '') as string;

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

      // Clean up test canvas
      canvas.remove();

      return false;
    } catch (error) {
      terminalLogger.warn('⚠️ Error checking WebGL environment:', error);
      return true;
    }
  }

  /**
   * Enable WebGL rendering with auto-fallback.
   *
   * Waits for the terminal's theme to be applied (background color set)
   * before loading WebGL to prevent black background / invisible text issues.
   */
  public async enableWebGL(terminal: Terminal, terminalId: string): Promise<boolean> {
    if (!this.options.enableWebGL) {
      terminalLogger.info(`WebGL disabled by option for terminal: ${terminalId}`);
      return false;
    }

    // Check for problematic WebGL environments first
    if (this.isProblematicWebGLEnvironment()) {
      terminalLogger.info(`🔧 Skipping WebGL for terminal ${terminalId} due to problematic environment`);
      return false;
    }

    // Wait for theme to be applied before loading WebGL.
    // The root cause of the previous black-background issue was WebGL loading
    // before theme colors were set, causing it to render with default black.
    const themeReady = await this.waitForThemeReady(terminal, terminalId);
    if (!themeReady) {
      terminalLogger.warn(`⚠️ Theme not ready for ${terminalId}, skipping WebGL`);
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
        terminal.refresh(0, terminal.rows - 1);
      });

      // Load WebGL addon
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      terminal.loadAddon(addon as any);

      // Verify WebGL is actually working after loading
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
   * Wait for the terminal's theme to be applied before enabling WebGL.
   * Checks that the terminal element has a non-default background color set.
   * Times out after 500ms to avoid blocking terminal creation.
   */
  private async waitForThemeReady(terminal: Terminal, terminalId: string): Promise<boolean> {
    const maxWaitMs = 500;
    const checkIntervalMs = 50;
    let elapsed = 0;

    while (elapsed < maxWaitMs) {
      // Check if terminal element exists and has theme applied
      const element = terminal.element;
      if (element) {
        const viewport = element.querySelector('.xterm-viewport') as HTMLElement;
        if (viewport) {
          const bg = viewport.style.backgroundColor || '';
          // Theme is ready if viewport has a non-empty, non-default background
          if (bg && bg !== 'rgb(0, 0, 0)' && bg !== '#000000' && bg !== 'black') {
            terminalLogger.debug(`🎨 Theme ready for ${terminalId} after ${elapsed}ms (bg: ${bg})`);
            return true;
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
      elapsed += checkIntervalMs;
    }

    // Theme didn't apply in time — still allow WebGL with a warning
    terminalLogger.warn(`⚠️ Theme wait timed out for ${terminalId} after ${maxWaitMs}ms, proceeding with WebGL`);
    return true;
  }

  /**
   * Verify WebGL is actually rendering correctly.
   * Waits two frames for WebGL to initialize and forces a terminal refresh.
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
