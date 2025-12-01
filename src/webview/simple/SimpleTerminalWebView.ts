/**
 * SimpleTerminalWebView - Simplified WebView Manager
 *
 * VS Code Standard Pattern Implementation:
 * - Single entry point for WebView
 * - Direct message handling (no complex routing)
 * - Simple state management
 * - Clean lifecycle
 *
 * Replaces:
 * - LightweightTerminalWebviewManager (1700+ lines)
 * - ConsolidatedMessageManager (650+ lines)
 * - 11+ Message Handlers
 * - Multiple coordinators
 */

import '@xterm/xterm/css/xterm.css';
import { XtermInstance, XtermCallbacks } from './XtermInstance';
import {
  VSCodeAPI,
  TerminalConfig,
  ExtensionToWebViewMessage,
  CreateTerminalMessage,
  TerminalOutputMessage,
  RemoveTerminalMessage,
  FocusTerminalMessage,
  ClearTerminalMessage,
  SetActiveTerminalMessage,
  UpdateThemeMessage,
  UpdateFontMessage,
} from './types';

// Acquire VS Code API once at module level
declare function acquireVsCodeApi(): VSCodeAPI;

/**
 * SimpleTerminalWebView
 *
 * Responsibilities:
 * 1. VS Code API management
 * 2. Terminal instances management (Map<string, XtermInstance>)
 * 3. Message handling (direct, no queue)
 * 4. UI updates (theme, focus, layout)
 *
 * Message Flow:
 * Extension → handleMessage() → appropriate handler → XtermInstance
 * XtermInstance events → callbacks → postMessage() → Extension
 */
export class SimpleTerminalWebView {
  private readonly terminals = new Map<string, XtermInstance>();
  private activeTerminalId: string | null = null;
  private readonly vscodeApi: VSCodeAPI;
  private readonly parentElement: HTMLElement;
  private initialized = false;
  private currentConfig: TerminalConfig = {};

  // Callbacks for XtermInstance events
  private readonly callbacks: XtermCallbacks = {
    onData: (terminalId, data) => this.handleTerminalInput(terminalId, data),
    onResize: (terminalId, cols, rows) => this.handleTerminalResize(terminalId, cols, rows),
    onFocus: (terminalId) => this.handleTerminalFocus(terminalId),
    onTitleChange: (terminalId, title) => this.handleTitleChange(terminalId, title),
  };

  constructor() {
    console.log('[SimpleTerminalWebView] Initializing...');

    // 1. Acquire VS Code API
    this.vscodeApi = acquireVsCodeApi();

    // 2. Get parent element
    const parent = document.getElementById('terminal-body');
    if (!parent) {
      throw new Error('[SimpleTerminalWebView] terminal-body element not found');
    }
    this.parentElement = parent;

    // 3. Setup parent element styles
    this.setupParentElement();

    // 4. Setup message listener
    this.setupMessageListener();

    // 5. Setup close button handler (event delegation)
    this.setupCloseButtonHandler();

    // 6. Notify Extension that WebView is ready
    this.notifyReady();

    console.log('[SimpleTerminalWebView] Initialization complete');
  }

  /**
   * Setup parent element with proper styles
   */
  private setupParentElement(): void {
    this.parentElement.style.cssText = `
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 200px;
      overflow: hidden;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      background: var(--vscode-terminal-background, #1e1e1e);
    `;

    // Create terminals wrapper for layout control
    let wrapper = document.getElementById('terminals-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'terminals-wrapper';
      wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        padding: 4px;
        gap: 4px;
        box-sizing: border-box;
      `;
      this.parentElement.appendChild(wrapper);
    }
  }

  /**
   * Setup message listener for Extension messages
   */
  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      const message = event.data as ExtensionToWebViewMessage;
      this.handleMessage(message);
    });
  }

  /**
   * Setup close button handler using event delegation
   */
  private setupCloseButtonHandler(): void {
    this.parentElement.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;

      // Check if clicked element is a close button
      if (target.classList.contains('terminal-close-btn')) {
        const terminalId = target.dataset.terminalId;
        if (terminalId) {
          this.requestDeleteTerminal(terminalId);
        }
      }
    });
  }

  /**
   * Notify Extension that WebView is ready
   */
  private notifyReady(): void {
    this.vscodeApi.postMessage({
      command: 'webviewReady',
      timestamp: Date.now(),
    });
    console.log('[SimpleTerminalWebView] Sent webviewReady');
  }

  /**
   * Handle incoming messages from Extension
   *
   * VS Code Pattern: Simple switch statement instead of complex routing
   */
  private handleMessage(message: ExtensionToWebViewMessage): void {
    if (!message || typeof message.command !== 'string') {
      console.warn('[SimpleTerminalWebView] Invalid message received:', message);
      return;
    }

    console.log(`[SimpleTerminalWebView] Received: ${message.command}`);

    switch (message.command) {
      case 'extensionReady':
        this.handleExtensionReady();
        break;

      case 'createTerminal':
        this.handleCreateTerminal(message as CreateTerminalMessage);
        break;

      case 'removeTerminal':
        this.handleRemoveTerminal(message as RemoveTerminalMessage);
        break;

      case 'output':
        this.handleOutput(message as TerminalOutputMessage);
        break;

      case 'focusTerminal':
        this.handleFocusTerminal(message as FocusTerminalMessage);
        break;

      case 'clearTerminal':
        this.handleClearTerminal(message as ClearTerminalMessage);
        break;

      case 'setActiveTerminal':
        this.handleSetActiveTerminal(message as SetActiveTerminalMessage);
        break;

      case 'updateTheme':
        this.handleUpdateTheme(message as UpdateThemeMessage);
        break;

      case 'updateFont':
        this.handleUpdateFont(message as UpdateFontMessage);
        break;

      default:
        // Type-safe handling of unknown commands
        console.log(`[SimpleTerminalWebView] Unknown command: ${(message as { command: string }).command}`);
    }
  }

  // ============================================================================
  // Message Handlers
  // ============================================================================

  /**
   * Handle Extension ready message
   */
  private handleExtensionReady(): void {
    console.log('[SimpleTerminalWebView] Extension is ready');
    this.initialized = true;
  }

  /**
   * Handle create terminal message
   */
  private async handleCreateTerminal(message: CreateTerminalMessage): Promise<void> {
    const { terminalId, terminalName, terminalNumber, config, isActive } = message;

    console.log(`[SimpleTerminalWebView] Creating terminal: ${terminalId} (${terminalName})`);

    // Check if terminal already exists
    if (this.terminals.has(terminalId)) {
      console.warn(`[SimpleTerminalWebView] Terminal ${terminalId} already exists`);
      return;
    }

    try {
      // Get or create terminals wrapper
      let wrapper = document.getElementById('terminals-wrapper');
      if (!wrapper) {
        wrapper = this.parentElement;
      }

      // Merge config with current config
      const mergedConfig: TerminalConfig = {
        ...this.currentConfig,
        ...config,
      };

      // Create terminal instance
      const result = await XtermInstance.create(
        terminalId,
        terminalName,
        terminalNumber,
        wrapper,
        mergedConfig,
        this.callbacks
      );

      // Store instance
      this.terminals.set(terminalId, result.instance);

      // Set as active if requested
      if (isActive || this.terminals.size === 1) {
        this.setActiveTerminal(terminalId);
      }

      // Notify Extension that terminal is ready
      this.vscodeApi.postMessage({
        command: 'terminalReady',
        terminalId,
        cols: result.cols,
        rows: result.rows,
        timestamp: Date.now(),
      });

      console.log(
        `[SimpleTerminalWebView] Terminal created: ${terminalId} (${result.cols}x${result.rows})`
      );
    } catch (error) {
      console.error(`[SimpleTerminalWebView] Failed to create terminal ${terminalId}:`, error);

      // Notify Extension of failure
      this.vscodeApi.postMessage({
        command: 'terminalCreationFailed',
        terminalId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle remove terminal message
   */
  private handleRemoveTerminal(message: RemoveTerminalMessage): void {
    const { terminalId } = message;

    console.log(`[SimpleTerminalWebView] Removing terminal: ${terminalId}`);

    const instance = this.terminals.get(terminalId);
    if (!instance) {
      console.warn(`[SimpleTerminalWebView] Terminal ${terminalId} not found for removal`);
      return;
    }

    // Dispose and remove
    instance.dispose();
    this.terminals.delete(terminalId);

    // If this was active terminal, activate another
    if (this.activeTerminalId === terminalId) {
      this.activeTerminalId = null;

      // Activate first available terminal
      const firstTerminal = this.terminals.keys().next().value;
      if (firstTerminal) {
        this.setActiveTerminal(firstTerminal);
      }
    }

    console.log(`[SimpleTerminalWebView] Terminal removed: ${terminalId}`);
  }

  /**
   * Handle terminal output
   */
  private handleOutput(message: TerminalOutputMessage): void {
    const { terminalId, data } = message;

    const instance = this.terminals.get(terminalId);
    if (!instance) {
      console.warn(`[SimpleTerminalWebView] Output for unknown terminal: ${terminalId}`);
      return;
    }

    instance.write(data);
  }

  /**
   * Handle focus terminal message
   */
  private handleFocusTerminal(message: FocusTerminalMessage): void {
    const { terminalId } = message;

    const instance = this.terminals.get(terminalId);
    if (instance) {
      this.setActiveTerminal(terminalId);
      instance.focus();
    }
  }

  /**
   * Handle clear terminal message
   */
  private handleClearTerminal(message: ClearTerminalMessage): void {
    const { terminalId } = message;

    const instance = this.terminals.get(terminalId);
    if (instance) {
      instance.clear();
    }
  }

  /**
   * Handle set active terminal message
   */
  private handleSetActiveTerminal(message: SetActiveTerminalMessage): void {
    const { terminalId } = message;
    this.setActiveTerminal(terminalId);
  }

  /**
   * Handle update theme message
   */
  private handleUpdateTheme(message: UpdateThemeMessage): void {
    const { theme } = message;

    this.currentConfig.theme = theme;

    // Update all terminals
    this.terminals.forEach((instance) => {
      instance.updateTheme(theme);
    });

    console.log('[SimpleTerminalWebView] Theme updated');
  }

  /**
   * Handle update font message
   */
  private handleUpdateFont(message: UpdateFontMessage): void {
    const { fontFamily, fontSize, lineHeight } = message;

    this.currentConfig.fontFamily = fontFamily;
    this.currentConfig.fontSize = fontSize;
    if (lineHeight !== undefined) {
      this.currentConfig.lineHeight = lineHeight;
    }

    // Update all terminals
    this.terminals.forEach((instance) => {
      instance.updateFont(fontFamily, fontSize, lineHeight);
    });

    console.log(`[SimpleTerminalWebView] Font updated: ${fontFamily} ${fontSize}px`);
  }

  // ============================================================================
  // Terminal Event Handlers (from XtermInstance callbacks)
  // ============================================================================

  /**
   * Handle terminal input
   */
  private handleTerminalInput(terminalId: string, data: string): void {
    this.vscodeApi.postMessage({
      command: 'input',
      terminalId,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle terminal resize
   */
  private handleTerminalResize(terminalId: string, cols: number, rows: number): void {
    this.vscodeApi.postMessage({
      command: 'resize',
      terminalId,
      cols,
      rows,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle terminal focus
   */
  private handleTerminalFocus(terminalId: string): void {
    // Set as active
    if (this.activeTerminalId !== terminalId) {
      this.setActiveTerminal(terminalId);

      // Notify Extension
      this.vscodeApi.postMessage({
        command: 'terminalFocused',
        terminalId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle title change
   */
  private handleTitleChange(terminalId: string, title: string): void {
    this.vscodeApi.postMessage({
      command: 'titleChange',
      terminalId,
      title,
      timestamp: Date.now(),
    });
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  /**
   * Set active terminal
   */
  private setActiveTerminal(terminalId: string): void {
    const instance = this.terminals.get(terminalId);
    if (!instance) return;

    // Deactivate previous
    if (this.activeTerminalId && this.activeTerminalId !== terminalId) {
      const prevInstance = this.terminals.get(this.activeTerminalId);
      if (prevInstance) {
        prevInstance.setActive(false);
      }
    }

    // Activate new
    this.activeTerminalId = terminalId;
    instance.setActive(true);
  }

  /**
   * Request terminal deletion from Extension
   */
  private requestDeleteTerminal(terminalId: string): void {
    console.log(`[SimpleTerminalWebView] Requesting delete: ${terminalId}`);

    this.vscodeApi.postMessage({
      command: 'deleteTerminal',
      terminalId,
      source: 'header',
      timestamp: Date.now(),
    });
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get terminal count
   */
  public getTerminalCount(): number {
    return this.terminals.size;
  }

  /**
   * Get active terminal ID
   */
  public getActiveTerminalId(): string | null {
    return this.activeTerminalId;
  }

  /**
   * Get terminal instance
   */
  public getTerminal(terminalId: string): XtermInstance | undefined {
    return this.terminals.get(terminalId);
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    console.log('[SimpleTerminalWebView] Disposing...');

    // Dispose all terminals
    this.terminals.forEach((instance) => {
      instance.dispose();
    });
    this.terminals.clear();

    this.activeTerminalId = null;
    this.initialized = false;

    console.log('[SimpleTerminalWebView] Disposed');
  }
}

// ============================================================================
// Module Entry Point
// ============================================================================

let webviewManager: SimpleTerminalWebView | null = null;

/**
 * Initialize WebView
 */
function initializeWebView(): void {
  try {
    webviewManager = new SimpleTerminalWebView();

    // Expose for debugging
    (window as any).terminalManager = webviewManager;

    console.log('[SimpleTerminalWebView] WebView manager created');
  } catch (error) {
    console.error('[SimpleTerminalWebView] Failed to initialize:', error);
  }
}

/**
 * Cleanup on unload
 */
function cleanupWebView(): void {
  if (webviewManager) {
    webviewManager.dispose();
    webviewManager = null;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeWebView);
} else {
  initializeWebView();
}

// Cleanup on unload
window.addEventListener('beforeunload', cleanupWebView);
window.addEventListener('unload', cleanupWebView);

// Export for testing
export { webviewManager };
