/**
 * Terminal Coordinator - Main orchestrator for all WebView managers
 */

import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

import { webview as log } from '../../utils/logger';
import { PartialTerminalSettings } from '../../types/shared';
import { TerminalInteractionEvent } from '../../types/common';
import { SplitManager } from './SplitManager';

import {
  IManagerCoordinator,
  ITerminalManager,
  IPerformanceManager,
  IInputManager,
  IUIManager,
  IConfigManager,
  IMessageManager,
  INotificationManager,
  TerminalInstance,
} from '../interfaces/ManagerInterfaces';

import { PerformanceManager } from './PerformanceManager';
import { InputManager } from './InputManager';
import { UIManager } from './UIManager';
import { ConfigManager } from './ConfigManager';
import { MessageManager } from './MessageManager';
import { NotificationManager } from './NotificationManager';

// VS Code API
declare const vscode: {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

export class TerminalCoordinator implements IManagerCoordinator, ITerminalManager {
  // Core terminal storage
  private terminals: Map<string, TerminalInstance> = new Map();
  private terminalContainers: Map<string, HTMLElement> = new Map();
  private activeTerminalId: string | null = null;

  // Manager instances
  private performanceManager: IPerformanceManager;
  private inputManager: IInputManager;
  private uiManager: IUIManager;
  private configManager: IConfigManager;
  private messageManager: IMessageManager;
  private notificationManager: INotificationManager;
  private splitManager: SplitManager;

  // State tracking
  private isInitialized = false;

  constructor() {
    log('🚀 [COORDINATOR] Initializing Terminal Coordinator');

    // Initialize managers
    this.performanceManager = new PerformanceManager();
    this.inputManager = new InputManager();
    this.uiManager = new UIManager();
    this.configManager = new ConfigManager();
    this.messageManager = new MessageManager();
    this.notificationManager = new NotificationManager();
    this.splitManager = new SplitManager();

    // Setup manager coordination
    this.setupManagerCoordination();

    // Inject dependencies
    this.inputManager.setNotificationManager(this.notificationManager);

    // Setup basic HTML structure
    this.setupBasicHTML();

    // Setup DOM and event listeners
    this.setupEventListeners();

    // Setup global keyboard debugging
    this.setupKeyboardDebugging();

    log('✅ [COORDINATOR] Terminal Coordinator initialized');
  }

  /**
   * Setup coordination between managers
   */
  private setupManagerCoordination(): void {
    // Claude Code detection disabled - no coordination needed
    log('🔗 [COORDINATOR] Manager coordination setup (Claude Code disabled)');
  }

  /**
   * Setup event listeners for WebView communication
   */
  private setupEventListeners(): void {
    // Listen for messages from extension
    window.addEventListener('message', (event) => {
      this.messageManager.handleMessage(event.data, this);
    });

    // Setup input handling
    this.inputManager.setupIMEHandling();
    this.inputManager.setupAltKeyVisualFeedback();
    this.inputManager.setupKeyboardShortcuts(this);

    // Setup notification styles
    this.notificationManager.setupNotificationStyles();

    // Send ready message to extension
    this.sendReadyMessage();

    log('👂 [COORDINATOR] Event listeners setup');
  }

  // =========================
  // IManagerCoordinator Implementation
  // =========================

  public getActiveTerminalId(): string | null {
    return this.activeTerminalId;
  }

  public setActiveTerminalId(terminalId: string): void {
    if (this.activeTerminalId !== terminalId) {
      this.activeTerminalId = terminalId;
      this.uiManager.updateTerminalBorders(terminalId, this.terminalContainers);
      log(`🎯 [COORDINATOR] Active terminal set: ${terminalId}`);
    }
  }

  public getTerminalInstance(terminalId: string): TerminalInstance | undefined {
    return this.terminals.get(terminalId);
  }

  public getAllTerminalInstances(): Map<string, TerminalInstance> {
    return this.terminals;
  }

  public getAllTerminalContainers(): Map<string, HTMLElement> {
    return this.terminalContainers;
  }

  public postMessageToExtension(message: unknown): void {
    vscode.postMessage(message);
  }

  public log(message: string, ...args: unknown[]): void {
    log(message, ...args);
  }

  public getManagers(): {
    performance: IPerformanceManager;
    input: IInputManager;
    ui: IUIManager;
    config: IConfigManager;
    message: IMessageManager;
    notification: INotificationManager;
  } {
    return {
      performance: this.performanceManager,
      input: this.inputManager,
      ui: this.uiManager,
      config: this.configManager,
      message: this.messageManager,
      notification: this.notificationManager,
    };
  }

  // =========================
  // ITerminalManager Implementation
  // =========================

  public createTerminal(id: string, name: string, config: PartialTerminalSettings): void {
    try {
      log(`➕ [COORDINATOR] Creating terminal: ${id} (${name})`);

      // Get current theme and settings
      const terminalSettings = this.configManager.getCurrentSettings();
      
      // Create xterm.js terminal with enhanced configuration
      const terminal = new Terminal({
        fontSize: config.fontSize || 14,
        fontFamily: config.fontFamily || 'Consolas, "Courier New", monospace',
        cursorBlink: config.cursorBlink !== undefined ? config.cursorBlink : true,
        scrollback: 10000,
        allowTransparency: true,
        theme: {
          background: 'transparent',
          foreground: '#ffffff',
          cursor: '#ffffff',
          cursorAccent: '#000000',
        },
        altClickMovesCursor: terminalSettings.altClickMovesCursor || false,
        // Ensure terminal can receive input
        disableStdin: false,
        convertEol: false,
      });
      
      log(`📺 [COORDINATOR] Terminal ${id} created with config:`, {
        fontSize: config.fontSize || 14,
        fontFamily: config.fontFamily || 'Consolas, "Courier New", monospace',
        cursorBlink: config.cursorBlink !== undefined ? config.cursorBlink : true,
        altClickMovesCursor: terminalSettings.altClickMovesCursor || false,
      });

      // Add addons
      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      // Create container
      const container = this.createTerminalContainer(id, name);

      // Open terminal in container
      const terminalElement = container.querySelector('.xterm-container') as HTMLElement;
      if (!terminalElement) {
        log(`❌ [COORDINATOR] Terminal container element not found for ${id}`);
        return;
      }
      
      log(`📺 [COORDINATOR] Opening terminal ${id} in element:`, terminalElement);
      terminal.open(terminalElement);
      
      // Verify terminal is opened
      setTimeout(() => {
        const xtermElement = terminalElement.querySelector('.xterm');
        log(`📺 [COORDINATOR] Terminal ${id} opened, xterm element found:`, !!xtermElement);
        if (xtermElement) {
          log(`📺 [COORDINATOR] xterm element attributes:`, xtermElement.outerHTML.substring(0, 200));
        }
      }, 50);

      // Setup terminal event handlers
      this.setupTerminalEventHandlers(terminal, id, container);

      // Store terminal instance
      const terminalInstance: TerminalInstance = {
        id,
        name,
        terminal,
        fitAddon,
        container,
      };

      this.terminals.set(id, terminalInstance);
      this.terminalContainers.set(id, container);

      // Apply current settings
      const visualSettings = this.configManager.getCurrentSettings();
      this.uiManager.applyAllVisualSettings(terminal, visualSettings);

      // Fit terminal to container with delay for proper rendering
      setTimeout(() => {
        fitAddon.fit();
        // Focus the terminal to ensure it's ready for input
        terminal.focus();
        log(`🎯 [COORDINATOR] Terminal ${id} fitted and focused`);
        
        // Force cursor to be visible
        terminal.write('');
        
        // Test if terminal can receive input
        setTimeout(() => {
          log(`🔍 [COORDINATOR] Terminal ${id} focus test - has focus: ${terminal.hasSelection()}`);
          log(`🔍 [COORDINATOR] Terminal element:`, terminalElement);
          log(`🔍 [COORDINATOR] Terminal active element:`, document.activeElement);
        }, 500);
      }, 100);

      // Set as active if first terminal
      if (this.terminals.size === 1) {
        this.setActiveTerminalId(id);
        this.uiManager.hideTerminalPlaceholder();
        // Ensure focus after creation with multiple attempts
        setTimeout(() => {
          this.ensureTerminalFocus(id);
          log(`🎯 [COORDINATOR] First terminal focus attempt for ${id}`);
        }, 200);
        
        setTimeout(() => {
          this.ensureTerminalFocus(id);
          log(`🎯 [COORDINATOR] Second terminal focus attempt for ${id}`);
        }, 500);
        
        setTimeout(() => {
          this.ensureTerminalFocus(id);
          log(`🎯 [COORDINATOR] Third terminal focus attempt for ${id}`);
        }, 1000);
      }

      // Update UI
      this.uiManager.updateTerminalBorders(this.activeTerminalId || '', this.terminalContainers);

      log(`✅ [COORDINATOR] Terminal created successfully: ${id}`);
    } catch (error) {
      log(`❌ [COORDINATOR] Error creating terminal ${id}:`, error);
      this.notificationManager.showNotificationInTerminal(
        `Failed to create terminal: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      );
    }
  }

  public switchToTerminal(id: string): void {
    if (this.terminals.has(id)) {
      this.setActiveTerminalId(id);
      this.ensureTerminalFocus(id);
      log(`🔄 [COORDINATOR] Switched to terminal: ${id}`);
    } else {
      log(`⚠️ [COORDINATOR] Cannot switch to unknown terminal: ${id}`);
    }
  }

  public ensureTerminalFocus(terminalId: string): void {
    const terminalInstance = this.terminals.get(terminalId);
    if (terminalInstance) {
      log(`🎯 [COORDINATOR] Attempting to focus terminal ${terminalId}`);
      
      // Focus the xterm.js terminal
      terminalInstance.terminal.focus();
      
      // Focus the container as well
      terminalInstance.container.focus();
      
      // Check if terminal is focused
      setTimeout(() => {
        const xtermElement = terminalInstance.container.querySelector('.xterm');
        const isFocused = document.activeElement === xtermElement || 
                         document.activeElement === terminalInstance.container ||
                         terminalInstance.container.contains(document.activeElement);
        log(`🎯 [COORDINATOR] Terminal ${terminalId} focus result:`, {
          isFocused,
          activeElement: document.activeElement?.tagName,
          xtermElement: !!xtermElement
        });
        
        // Force click on terminal to ensure focus
        if (xtermElement && !isFocused) {
          log(`🎯 [COORDINATOR] Forcing click on terminal ${terminalId}`);
          (xtermElement as HTMLElement).click();
        }
      }, 100);
      
      log(`🎯 [COORDINATOR] Terminal ${terminalId} focus requested`);
    } else {
      log(`⚠️ [COORDINATOR] Cannot focus unknown terminal: ${terminalId}`);
    }
  }

  public closeTerminal(id?: string): void {
    const terminalId = id || this.activeTerminalId;
    if (!terminalId) {
      log('⚠️ [COORDINATOR] No terminal to close');
      return;
    }

    // Check minimum terminal requirement
    if (this.terminals.size <= 1) {
      this.notificationManager.showTerminalCloseError(1);
      return;
    }

    const terminalInstance = this.terminals.get(terminalId);
    if (terminalInstance) {
      try {
        // Dispose terminal
        terminalInstance.terminal.dispose();

        // Remove from storage
        this.terminals.delete(terminalId);
        this.terminalContainers.delete(terminalId);

        // Remove container from DOM
        terminalInstance.container.remove();

        // Switch to another terminal if this was active
        if (this.activeTerminalId === terminalId) {
          const remainingTerminals = Array.from(this.terminals.keys());
          if (remainingTerminals.length > 0) {
            const firstTerminal = remainingTerminals[0];
            if (firstTerminal) {
              this.setActiveTerminalId(firstTerminal);
            } else {
              this.activeTerminalId = null;
              this.uiManager.showTerminalPlaceholder();
            }
          } else {
            this.activeTerminalId = null;
            this.uiManager.showTerminalPlaceholder();
          }
        }

        log(`🗑️ [COORDINATOR] Terminal closed: ${terminalId}`);
      } catch (error) {
        log(`❌ [COORDINATOR] Error closing terminal ${terminalId}:`, error);
        this.notificationManager.showTerminalKillError(
          `Failed to close terminal: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  public handleTerminalRemovedFromExtension(id: string): void {
    log(`📢 [COORDINATOR] Terminal removed by extension: ${id}`);
    this.closeTerminal(id);
  }

  public writeToTerminal(data: string, terminalId?: string): void {
    const targetTerminalId = terminalId || this.activeTerminalId;
    if (!targetTerminalId) {
      log('⚠️ [COORDINATOR] No target terminal for output');
      return;
    }

    const terminalInstance = this.terminals.get(targetTerminalId);
    if (terminalInstance) {
      // Use performance manager for buffering
      this.performanceManager.scheduleOutputBuffer(data, terminalInstance.terminal);

      // Claude Code monitoring disabled
    } else {
      log(`⚠️ [COORDINATOR] Cannot write to unknown terminal: ${targetTerminalId}`);
    }
  }


  public switchToNextTerminal(): void {
    const terminalIds = Array.from(this.terminals.keys());
    if (terminalIds.length <= 1) return;

    const currentIndex = this.activeTerminalId ? terminalIds.indexOf(this.activeTerminalId) : -1;
    const nextIndex = (currentIndex + 1) % terminalIds.length;
    const nextTerminalId = terminalIds[nextIndex];
    if (nextTerminalId) {
      this.switchToTerminal(nextTerminalId);
    }
  }

  public getTerminal(terminalId: string): TerminalInstance | undefined {
    return this.terminals.get(terminalId);
  }

  public getAllTerminals(): Map<string, TerminalInstance> {
    return this.terminals;
  }

  public getTerminalContainer(terminalId: string): HTMLElement | undefined {
    return this.terminalContainers.get(terminalId);
  }

  // =========================
  // Private Helper Methods
  // =========================

  /**
   * Setup keyboard debugging to catch all keyboard events
   */
  private setupKeyboardDebugging(): void {
    document.addEventListener('keydown', (event) => {
      log(`⌨️ [COORDINATOR] Global keydown:`, {
        key: event.key,
        code: event.code,
        target: (event.target as HTMLElement)?.tagName,
        activeElement: (document.activeElement as HTMLElement)?.tagName,
        activeTerminal: this.activeTerminalId
      });
    });
    
    document.addEventListener('keypress', (event) => {
      log(`⌨️ [COORDINATOR] Global keypress:`, {
        key: event.key,
        code: event.code,
        target: (event.target as HTMLElement)?.tagName,
        activeElement: (document.activeElement as HTMLElement)?.tagName,
        activeTerminal: this.activeTerminalId
      });
    });
  }

  /**
   * Setup basic HTML structure required for terminal operation
   */
  private setupBasicHTML(): void {
    log('🏗️ [COORDINATOR] Setting up basic HTML structure');

    // Check if terminal-container already exists
    let terminalContainer = document.getElementById('terminal-container');
    if (!terminalContainer) {
      // Create the main terminal container
      terminalContainer = document.createElement('div');
      terminalContainer.id = 'terminal-container';
      terminalContainer.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: #000;
        overflow: hidden;
        margin: 0;
        padding: 0;
      `;

      // Find the terminal-body and append to it, or use document.body as fallback
      const terminalBody = document.getElementById('terminal-body');
      if (terminalBody) {
        // Clear existing content and add our container
        terminalBody.innerHTML = '';
        terminalBody.appendChild(terminalContainer);
        log('✅ [COORDINATOR] Terminal container added to terminal-body');
      } else {
        // Fallback to document.body
        document.body.appendChild(terminalContainer);
        log('✅ [COORDINATOR] Terminal container added to document.body');
      }
    }

    // Add initial placeholder content
    if (terminalContainer.children.length === 0) {
      terminalContainer.innerHTML = `
        <div id="terminal-placeholder" style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #888;
          font-family: monospace;
          font-size: 14px;
          text-align: center;
        ">
          <div>Terminal Ready</div>
          <div style="font-size: 12px; margin-top: 8px;">Waiting for initialization...</div>
        </div>
      `;
    }

    log('✅ [COORDINATOR] Basic HTML structure setup complete');
  }

  /**
   * Create terminal container element
   */
  private createTerminalContainer(id: string, name: string): HTMLElement {
    const container = document.createElement('div');
    container.className = 'terminal-container';
    container.dataset.terminalId = id;
    container.id = `terminal-container-${id}`;
    container.tabIndex = -1; // Make focusable

    // Apply detailed styling from original implementation
    container.style.cssText = `
      width: 100%;
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      margin: 0;
      padding: 2px;
      min-height: 100px;
      outline: none;
      background: transparent;
    `;

    // Create terminal content area (no header for simplicity)
    const xtermContainer = document.createElement('div');
    xtermContainer.className = 'xterm-container';
    xtermContainer.style.cssText = `
      width: 100%;
      height: 100%;
      flex: 1;
      overflow: hidden;
    `;
    container.appendChild(xtermContainer);

    // Add focus handler with debouncing
    let focusDebounceTimer: number | null = null;
    container.addEventListener('focus', () => {
      if (focusDebounceTimer) {
        clearTimeout(focusDebounceTimer);
      }
      focusDebounceTimer = window.setTimeout(() => {
        log(`🔵 [FOCUS] Terminal ${id} received focus - updating borders`);
        this.setActiveTerminalId(id);
        focusDebounceTimer = null;
      }, 100);
    }, true);

    // Add click handler for focus with debouncing
    let clickDebounceTimer: number | null = null;
    container.addEventListener('click', () => {
      if (clickDebounceTimer) {
        clearTimeout(clickDebounceTimer);
      }
      clickDebounceTimer = window.setTimeout(() => {
        log(`🖱️ [CLICK] Terminal clicked: ${id}, current active: ${this.activeTerminalId}`);
        this.ensureTerminalFocus(id);
        if (this.activeTerminalId !== id) {
          this.switchToTerminal(id);
        }
        clickDebounceTimer = null;
      }, 50);
    });

    // Add to terminal area
    const terminalArea = document.getElementById('terminal-container') || document.body;
    terminalArea.appendChild(container);

    // Apply VS Code styling
    this.uiManager.applyVSCodeStyling(container);

    return container;
  }

  /**
   * Setup event handlers for a terminal
   */
  private setupTerminalEventHandlers(
    terminal: Terminal,
    terminalId: string,
    container: HTMLElement
  ): void {
    // Data input handler with debugging
    terminal.onData((data) => {
      log(`⌨️ [COORDINATOR] Terminal input received: ${data.length} chars for ${terminalId}`);
      log(`⌨️ [COORDINATOR] Input data:`, data);
      this.messageManager.sendInput(data, terminalId, this);
    });

    // Resize handler
    terminal.onResize((size) => {
      this.messageManager.sendResize(size.cols, size.rows, terminalId, this);
    });

    // Click handler for focus and Alt+Click
    this.inputManager.addXtermClickHandler(terminal, terminalId, container, this);

    // Special key handling
    terminal.attachCustomKeyEventHandler((event) => {
      return this.inputManager.handleSpecialKeys(event, terminalId, this);
    });
  }

  /**
   * Initialize the coordinator with ready state
   */
  public initialize(): void {
    if (this.isInitialized) return;

    log('🚀 [COORDINATOR] Initializing WebView');

    // Load settings
    this.configManager.loadSettings();

    // Show placeholder if no terminals
    if (this.terminals.size === 0) {
      this.uiManager.showTerminalPlaceholder();
    }

    // Send ready message
    this.messageManager.sendReadyMessage(this);

    this.isInitialized = true;
    log('✅ [COORDINATOR] WebView initialized');
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    log('🧹 [COORDINATOR] Disposing Terminal Coordinator');

    // Dispose all terminals
    this.terminals.forEach((terminalInstance) => {
      terminalInstance.terminal.dispose();
    });
    this.terminals.clear();
    this.terminalContainers.clear();

    // Dispose managers
    this.performanceManager.dispose();
    this.inputManager.dispose();
    this.uiManager.dispose();
    this.configManager.dispose();
    this.messageManager.dispose();
    this.notificationManager.dispose();

    this.isInitialized = false;
    log('✅ [COORDINATOR] Terminal Coordinator disposed');
  }

  // =========================
  // Public API for Main
  // =========================


  /**
   * Send ready message to extension
   */
  private sendReadyMessage(): void {
    log('🎯 [COORDINATOR] Sending READY message to extension');
    try {
      this.messageManager.sendReadyMessage(this);
      log('✅ [COORDINATOR] READY message sent successfully');
    } catch (error) {
      log('❌ [COORDINATOR] Failed to send READY message:', error);
      this.notificationManager.showNotificationInTerminal(
        `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      );
    }
  }

  /**
   * Get current state for debugging
   */
  public getState(): Record<string, unknown> {
    return {
      terminals: this.terminals.size,
      activeTerminal: this.activeTerminalId,
      initialized: this.isInitialized,
      // claudeCodeState: removed with ClaudeCodeManager
      altClickState: this.inputManager.getAltClickState(),
      settings: this.configManager.getCurrentSettings(),
    };
  }
}
