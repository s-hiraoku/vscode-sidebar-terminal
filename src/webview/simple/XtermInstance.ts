/**
 * XtermInstance - Simplified Terminal Wrapper
 *
 * VS Code Standard Pattern:
 * - Single responsibility: manage one xterm.js terminal instance
 * - Barrier pattern for async initialization
 * - Clean lifecycle management (create → attach → dispose)
 *
 * Replaces:
 * - TerminalLifecycleCoordinator
 * - TerminalCreationService
 * - Multiple addon managers
 */

import { Terminal, ITerminalOptions } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SerializeAddon } from '@xterm/addon-serialize';
import { TerminalConfig, TerminalTheme } from './types';
import { cleanWrappedLineSelection } from '../utils/SelectionUtils';

/**
 * Terminal creation result
 */
export interface XtermCreateResult {
  instance: XtermInstance;
  cols: number;
  rows: number;
}

/**
 * Callback for terminal events
 */
export interface XtermCallbacks {
  onData: (terminalId: string, data: string) => void;
  onResize: (terminalId: string, cols: number, rows: number) => void;
  onFocus: (terminalId: string) => void;
  onTitleChange?: (terminalId: string, title: string) => void;
}

/**
 * Default terminal configuration following VS Code patterns
 */
const DEFAULT_CONFIG: ITerminalOptions = {
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  fontSize: 14,
  lineHeight: 1.2,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 1000,
  allowProposedApi: true,
  allowTransparency: true,
  convertEol: true,
  scrollOnUserInput: true,
  macOptionIsMeta: true,
  macOptionClickForcesSelection: true,
};

/**
 * Parse a color string to RGB values
 */
function parseColorToRGB(color: string): { r: number; g: number; b: number } | null {
  if (!color) return null;

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      const r = hex.charAt(0);
      const g = hex.charAt(1);
      const b = hex.charAt(2);
      return {
        r: parseInt(r + r, 16),
        g: parseInt(g + g, 16),
        b: parseInt(b + b, 16),
      };
    } else if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }

  // Handle rgb/rgba colors
  const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  return null;
}

/**
 * Calculate relative luminance of a color (0 = black, 1 = white)
 */
function getLuminance(r: number, g: number, b: number): number {
  // Convert to sRGB
  const toSrgb = (c: number): number => {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  // Calculate luminance
  return 0.2126 * toSrgb(r) + 0.7152 * toSrgb(g) + 0.0722 * toSrgb(b);
}

/**
 * Detect if a color is light or dark based on luminance
 */
function isLightColor(color: string): boolean {
  const rgb = parseColorToRGB(color);
  if (!rgb) return false;
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  // Threshold of 0.5 to determine light vs dark
  return luminance > 0.5;
}

/**
 * Light theme colors for VS Code
 */
const LIGHT_THEME: TerminalTheme = {
  background: '#ffffff',
  foreground: '#333333',
  cursor: '#000000',
  cursorAccent: '#ffffff',
  selectionBackground: 'rgba(173, 214, 255, 0.5)',
  black: '#000000',
  red: '#cd3131',
  green: '#00bc00',
  yellow: '#949800',
  blue: '#0451a5',
  magenta: '#bc05bc',
  cyan: '#0598bc',
  white: '#555555',
  brightBlack: '#666666',
  brightRed: '#cd3131',
  brightGreen: '#14ce14',
  brightYellow: '#b5ba00',
  brightBlue: '#0451a5',
  brightMagenta: '#bc05bc',
  brightCyan: '#0598bc',
  brightWhite: '#a5a5a5',
};

/**
 * Dark theme colors for VS Code
 */
const DARK_THEME: TerminalTheme = {
  background: '#1e1e1e',
  foreground: '#cccccc',
  cursor: '#ffffff',
  cursorAccent: '#000000',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
};

/**
 * Get VS Code theme colors from CSS variables
 * Detects light/dark mode based on background color luminance
 */
function getVSCodeTheme(): TerminalTheme {
  const style = getComputedStyle(document.documentElement);
  const getColor = (varName: string, fallback: string): string => {
    return style.getPropertyValue(varName).trim() || fallback;
  };

  // Detect theme based on background color luminance
  const bgColor =
    style.getPropertyValue('--vscode-terminal-background').trim() ||
    style.getPropertyValue('--vscode-editor-background').trim();

  // Determine if light or dark theme based on background luminance
  const isLight = bgColor ? isLightColor(bgColor) : false;

  // Choose appropriate fallback theme
  const fallbackTheme = isLight ? LIGHT_THEME : DARK_THEME;

  return {
    background: getColor('--vscode-terminal-background', fallbackTheme.background!),
    foreground: getColor('--vscode-terminal-foreground', fallbackTheme.foreground!),
    cursor: getColor('--vscode-terminalCursor-foreground', fallbackTheme.cursor!),
    cursorAccent: getColor('--vscode-terminalCursor-background', fallbackTheme.cursorAccent!),
    selectionBackground: getColor(
      '--vscode-terminal-selectionBackground',
      fallbackTheme.selectionBackground!
    ),
    black: getColor('--vscode-terminal-ansiBlack', fallbackTheme.black!),
    red: getColor('--vscode-terminal-ansiRed', fallbackTheme.red!),
    green: getColor('--vscode-terminal-ansiGreen', fallbackTheme.green!),
    yellow: getColor('--vscode-terminal-ansiYellow', fallbackTheme.yellow!),
    blue: getColor('--vscode-terminal-ansiBlue', fallbackTheme.blue!),
    magenta: getColor('--vscode-terminal-ansiMagenta', fallbackTheme.magenta!),
    cyan: getColor('--vscode-terminal-ansiCyan', fallbackTheme.cyan!),
    white: getColor('--vscode-terminal-ansiWhite', fallbackTheme.white!),
    brightBlack: getColor('--vscode-terminal-ansiBrightBlack', fallbackTheme.brightBlack!),
    brightRed: getColor('--vscode-terminal-ansiBrightRed', fallbackTheme.brightRed!),
    brightGreen: getColor('--vscode-terminal-ansiBrightGreen', fallbackTheme.brightGreen!),
    brightYellow: getColor('--vscode-terminal-ansiBrightYellow', fallbackTheme.brightYellow!),
    brightBlue: getColor('--vscode-terminal-ansiBrightBlue', fallbackTheme.brightBlue!),
    brightMagenta: getColor('--vscode-terminal-ansiBrightMagenta', fallbackTheme.brightMagenta!),
    brightCyan: getColor('--vscode-terminal-ansiBrightCyan', fallbackTheme.brightCyan!),
    brightWhite: getColor('--vscode-terminal-ansiBrightWhite', fallbackTheme.brightWhite!),
  };
}

/**
 * XtermInstance - Single terminal wrapper
 *
 * Lifecycle:
 * 1. create() - Static factory creates instance
 * 2. Terminal opened in DOM
 * 3. Addons loaded
 * 4. Events registered
 * 5. dispose() - Clean shutdown
 */
export class XtermInstance {
  public readonly terminal: Terminal;
  public readonly fitAddon: FitAddon;
  public readonly serializeAddon: SerializeAddon;
  public readonly container: HTMLElement;

  private webglAddon: WebglAddon | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;
  private cleanupCallbacks: (() => void)[] = [];

  // Debounce resize to prevent excessive fit() calls
  private resizeTimer: number | null = null;
  private readonly RESIZE_DEBOUNCE_MS = 50;

  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly number: number,
    container: HTMLElement,
    terminal: Terminal,
    fitAddon: FitAddon,
    serializeAddon: SerializeAddon
  ) {
    this.container = container;
    this.terminal = terminal;
    this.fitAddon = fitAddon;
    this.serializeAddon = serializeAddon;
  }

  /**
   * Create new terminal instance (Factory method)
   *
   * VS Code Pattern: Async factory with barrier-like behavior
   * - Container created and attached to DOM first
   * - Terminal opened after DOM ready
   * - Returns only when fully initialized
   */
  public static async create(
    id: string,
    name: string,
    terminalNumber: number,
    parentElement: HTMLElement,
    config: TerminalConfig,
    callbacks: XtermCallbacks
  ): Promise<XtermCreateResult> {
    // 1. Create container element
    const container = XtermInstance.createContainer(id, name, terminalNumber);
    const terminalBody = XtermInstance.createTerminalBody(id);
    container.appendChild(terminalBody);

    // 2. Attach to DOM BEFORE opening terminal (VS Code pattern)
    parentElement.appendChild(container);

    // 3. Wait for DOM to settle
    await XtermInstance.waitForNextFrame();

    // 4. Create xterm.js instance with merged config
    const terminalOptions = XtermInstance.mergeConfig(config);
    const terminal = new Terminal(terminalOptions);

    // 5. Load core addons
    const fitAddon = new FitAddon();
    const serializeAddon = new SerializeAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(serializeAddon);

    // 6. Open terminal in DOM
    terminal.open(terminalBody);

    // 🎯 CRITICAL: Handle ALL paste events (text AND image)
    // VS Code WebView has clipboard API restrictions, so xterm.js can't read clipboard directly.
    // We intercept paste events to:
    // 1. For IMAGE paste: Send \x16 to trigger Claude Code's native clipboard read
    // 2. For TEXT paste: Read from clipboardData and send via onData callback

    // Block xterm.js keydown handling for paste shortcuts to prevent double-handling
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      // Use userAgentData if available (modern), fallback to userAgent
      const isMac = (navigator as any).userAgentData?.platform === 'macOS' || /Mac/.test(navigator.userAgent);
      // Block Cmd+V on macOS and Ctrl+V on all platforms
      if ((isMac && event.metaKey && event.key === 'v') ||
          (event.ctrlKey && event.key === 'v' && !event.shiftKey)) {
        return false; // Let browser fire paste event, we'll handle it there
      }
      return true;
    });

    // Handle ALL paste events (text AND image)
    const pasteHandler = (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) return;

      const hasImage = Array.from(clipboardData.items).some(item => item.type.startsWith('image/'));

      if (hasImage) {
        // IMAGE paste: Send \x16 to trigger Claude Code's native clipboard read
        event.preventDefault();
        event.stopImmediatePropagation();
        callbacks.onData(id, '\x16');
        return;
      }

      // TEXT paste: Read from clipboardData and send via callback
      const text = clipboardData.getData('text/plain');
      if (text) {
        event.preventDefault();
        event.stopImmediatePropagation();
        callbacks.onData(id, text);
        return;
      }
    };
    terminalBody.addEventListener('paste', pasteHandler, true);

    // 🎯 CRITICAL: Handle COPY events to fix wrapped line newlines (xterm.js issue #443)
    // When copying text that spans wrapped lines, xterm.js incorrectly includes newlines
    // at visual wrap points. We intercept the copy event and clean the selection.
    const copyHandler = (event: ClipboardEvent) => {
      if (!terminal.hasSelection()) {
        return; // No selection, let browser handle normally
      }

      const rawSelection = terminal.getSelection();
      if (!rawSelection) {
        return;
      }

      // Clean wrapped line newlines using our utility
      const cleanedSelection = cleanWrappedLineSelection(terminal, rawSelection);

      // Always set cleaned selection to clipboard
      event.preventDefault();
      event.clipboardData?.setData('text/plain', cleanedSelection);
    };
    terminalBody.addEventListener('copy', copyHandler, true);

    // 7. Create instance
    const instance = new XtermInstance(
      id,
      name,
      terminalNumber,
      container,
      terminal,
      fitAddon,
      serializeAddon
    );

    // Register paste and copy handler cleanup to prevent memory leak
    instance.addCleanup(() => {
      terminalBody.removeEventListener('paste', pasteHandler, true);
      terminalBody.removeEventListener('copy', copyHandler, true);
    });

    // 8. Try WebGL addon for performance
    await instance.tryEnableWebGL();

    // 9. Initial fit after DOM is ready
    await XtermInstance.waitForNextFrame();
    fitAddon.fit();

    // 🔧 FIX: Refresh to ensure cursor and decorations are rendered
    // Do NOT call terminal.clear() as it interferes with shell prompt
    terminal.refresh(0, terminal.rows - 1);

    // 10. Setup event handlers
    instance.setupEventHandlers(callbacks);

    // 11. Setup resize observer
    instance.setupResizeObserver(callbacks);

    // 12. Focus terminal
    terminal.focus();

    return {
      instance,
      cols: terminal.cols,
      rows: terminal.rows,
    };
  }

  /**
   * Create terminal container element
   */
  private static createContainer(id: string, name: string, number: number): HTMLElement {
    const container = document.createElement('div');
    container.id = `terminal-container-${id}`;
    container.className = 'terminal-container';
    container.dataset.terminalId = id;
    container.dataset.terminalNumber = String(number);

    // VS Code standard container styling
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      position: relative;
    `;

    // Create header
    const header = XtermInstance.createHeader(id, name, number);
    container.appendChild(header);

    return container;
  }

  /**
   * Create terminal header with title and controls
   */
  private static createHeader(id: string, name: string, number: number): HTMLElement {
    const header = document.createElement('div');
    header.className = 'terminal-header';
    header.dataset.terminalId = id;

    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px;
      background: var(--vscode-tab-activeBackground, #1e1e1e);
      border-bottom: 1px solid var(--vscode-panel-border, #454545);
      min-height: 24px;
      user-select: none;
    `;

    // Title section
    const titleSection = document.createElement('div');
    titleSection.className = 'terminal-header-title';
    titleSection.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      overflow: hidden;
    `;

    // Terminal number badge
    const badge = document.createElement('span');
    badge.className = 'terminal-number-badge';
    badge.textContent = String(number);
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 3px;
      background: var(--vscode-badge-background, #4d4d4d);
      color: var(--vscode-badge-foreground, #ffffff);
      font-size: 11px;
      font-weight: 600;
    `;

    // Terminal name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'terminal-name';
    nameSpan.textContent = name;
    nameSpan.style.cssText = `
      color: var(--vscode-foreground, #cccccc);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    titleSection.appendChild(badge);
    titleSection.appendChild(nameSpan);

    // Actions section
    const actions = document.createElement('div');
    actions.className = 'terminal-header-actions';
    actions.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
    `;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'terminal-close-btn';
    closeBtn.dataset.terminalId = id;
    closeBtn.title = 'Close Terminal';
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border: none;
      background: transparent;
      color: var(--vscode-foreground, #cccccc);
      cursor: pointer;
      border-radius: 3px;
      font-size: 16px;
      line-height: 1;
    `;

    closeBtn.addEventListener('mouseover', () => {
      closeBtn.style.background = 'var(--vscode-toolbar-hoverBackground, #5a5d5e)';
    });
    closeBtn.addEventListener('mouseout', () => {
      closeBtn.style.background = 'transparent';
    });

    actions.appendChild(closeBtn);

    header.appendChild(titleSection);
    header.appendChild(actions);

    return header;
  }

  /**
   * Create terminal body element (where xterm.js renders)
   */
  private static createTerminalBody(id: string): HTMLElement {
    const body = document.createElement('div');
    body.id = `terminal-body-${id}`;
    body.className = 'terminal-body';

    body.style.cssText = `
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      position: relative;
    `;

    return body;
  }

  /**
   * Merge user config with defaults
   */
  private static mergeConfig(config: TerminalConfig): ITerminalOptions {
    const theme = config.theme || getVSCodeTheme();

    return {
      ...DEFAULT_CONFIG,
      fontFamily: config.fontFamily || DEFAULT_CONFIG.fontFamily,
      fontSize: config.fontSize || DEFAULT_CONFIG.fontSize,
      lineHeight: config.lineHeight || DEFAULT_CONFIG.lineHeight,
      cursorStyle: config.cursorStyle || DEFAULT_CONFIG.cursorStyle,
      cursorBlink: config.cursorBlink ?? DEFAULT_CONFIG.cursorBlink,
      scrollback: config.scrollback || DEFAULT_CONFIG.scrollback,
      theme,
    };
  }

  /**
   * Wait for next animation frame (barrier pattern)
   */
  private static waitForNextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  /**
   * Try to enable WebGL addon for better performance
   * Falls back silently if WebGL is not available
   */
  private async tryEnableWebGL(): Promise<void> {
    try {
      this.webglAddon = new WebglAddon();

      // Handle WebGL context loss
      this.webglAddon.onContextLoss(() => {
        console.warn(`[XtermInstance] WebGL context lost for ${this.id}`);
        this.webglAddon?.dispose();
        this.webglAddon = null;
      });

      this.terminal.loadAddon(this.webglAddon);
      console.log(`[XtermInstance] WebGL enabled for ${this.id}`);
    } catch {
      console.log(`[XtermInstance] WebGL not available for ${this.id}, using DOM renderer`);
      this.webglAddon = null;
    }
  }

  /**
   * Setup terminal event handlers
   */
  private setupEventHandlers(callbacks: XtermCallbacks): void {
    // User input
    this.terminal.onData((data) => {
      if (!this.disposed) {
        callbacks.onData(this.id, data);
      }
    });

    // Terminal focused
    this.terminal.textarea?.addEventListener('focus', () => {
      if (!this.disposed) {
        callbacks.onFocus(this.id);
      }
    });

    // Title change
    if (callbacks.onTitleChange) {
      this.terminal.onTitleChange((title) => {
        if (!this.disposed) {
          callbacks.onTitleChange!(this.id, title);
        }
      });
    }

    // Container click to focus
    this.container.addEventListener('click', () => {
      if (!this.disposed) {
        this.terminal.focus();
      }
    });
  }

  /**
   * Setup resize observer with debouncing
   */
  private setupResizeObserver(callbacks: XtermCallbacks): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.disposed) return;

      // Debounce resize
      if (this.resizeTimer !== null) {
        window.clearTimeout(this.resizeTimer);
      }

      this.resizeTimer = window.setTimeout(() => {
        this.resizeTimer = null;
        this.performResize(callbacks);
      }, this.RESIZE_DEBOUNCE_MS);
    });

    this.resizeObserver.observe(this.container);
  }

  /**
   * Perform terminal resize
   */
  private performResize(callbacks: XtermCallbacks): void {
    if (this.disposed) return;

    try {
      const rect = this.container.getBoundingClientRect();

      // Skip if container is too small
      if (rect.width < 50 || rect.height < 50) {
        return;
      }

      const prevCols = this.terminal.cols;
      const prevRows = this.terminal.rows;

      this.fitAddon.fit();

      // Notify only if dimensions actually changed
      if (this.terminal.cols !== prevCols || this.terminal.rows !== prevRows) {
        callbacks.onResize(this.id, this.terminal.cols, this.terminal.rows);
      }
    } catch (error) {
      console.error(`[XtermInstance] Resize error for ${this.id}:`, error);
    }
  }

  /**
   * Write data to terminal
   */
  public write(data: string): void {
    if (!this.disposed) {
      this.terminal.write(data);
    }
  }

  /**
   * Clear terminal
   */
  public clear(): void {
    if (!this.disposed) {
      this.terminal.clear();
    }
  }

  /**
   * Focus terminal
   */
  public focus(): void {
    if (!this.disposed) {
      this.terminal.focus();
    }
  }

  /**
   * Get terminal dimensions
   */
  public getDimensions(): { cols: number; rows: number } {
    return {
      cols: this.terminal.cols,
      rows: this.terminal.rows,
    };
  }

  /**
   * Serialize terminal content (for session persistence)
   */
  public serialize(options?: { scrollback?: number }): string {
    if (this.disposed) return '';

    try {
      return this.serializeAddon.serialize({
        scrollback: options?.scrollback ?? 1000,
      });
    } catch (error) {
      console.error(`[XtermInstance] Serialize error for ${this.id}:`, error);
      return '';
    }
  }

  /**
   * Update terminal theme
   */
  public updateTheme(theme: TerminalTheme): void {
    if (!this.disposed) {
      this.terminal.options.theme = theme;
    }
  }

  /**
   * Update font settings
   */
  public updateFont(fontFamily: string, fontSize: number, lineHeight?: number): void {
    if (this.disposed) return;

    this.terminal.options.fontFamily = fontFamily;
    this.terminal.options.fontSize = fontSize;
    if (lineHeight !== undefined) {
      this.terminal.options.lineHeight = lineHeight;
    }

    // Refit after font change
    requestAnimationFrame(() => {
      if (!this.disposed) {
        this.fitAddon.fit();
      }
    });
  }

  /**
   * Set active state (visual highlight)
   */
  public setActive(active: boolean): void {
    if (this.disposed) return;

    if (active) {
      this.container.classList.add('active');
      this.container.style.borderColor = 'var(--vscode-focusBorder, #007fd4)';
    } else {
      this.container.classList.remove('active');
      this.container.style.borderColor = 'transparent';
    }
  }

  /**
   * Register a cleanup callback to be called on dispose
   */
  public addCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Dispose terminal and clean up all resources
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Run cleanup callbacks first (e.g., remove event listeners)
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error(`[XtermInstance] Cleanup callback error for ${this.id}:`, error);
      }
    }
    this.cleanupCallbacks = [];

    // Clear resize timer
    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }

    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Dispose WebGL addon
    if (this.webglAddon) {
      try {
        this.webglAddon.dispose();
      } catch {
        // Ignore WebGL dispose errors
      }
      this.webglAddon = null;
    }

    // Dispose terminal
    try {
      this.terminal.dispose();
    } catch (error) {
      console.error(`[XtermInstance] Error disposing terminal ${this.id}:`, error);
    }

    // Remove container from DOM
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
