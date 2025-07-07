/**
 * リファクタリング後のWebViewメインエントリーポイント
 */
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

// Types and constants
import type { WebviewMessage, VsCodeMessage, TerminalConfig } from '../types/common';
import { WEBVIEW_TERMINAL_CONSTANTS, SPLIT_CONSTANTS } from './constants/webview';
import { getWebviewTheme } from './utils/WebviewThemeUtils';
import { SimpleStatusManager } from './managers/SimpleStatusManager';
import { SplitManager, type TerminalInstance } from './managers/SplitManager';

// Type definitions
interface TerminalMessage extends WebviewMessage {
  terminalId?: string;
  terminalName?: string;
  data?: string;
  config?: TerminalConfig;
  activeTerminalId?: string;
  exitCode?: number;
  settings?: {
    fontSize: number;
    fontFamily: string;
    theme?: string;
    cursorBlink: boolean;
  };
}

declare const acquireVsCodeApi: () => {
  postMessage: (message: VsCodeMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

const vscode = acquireVsCodeApi();

// Main terminal management class
class TerminalWebviewManager {
  public terminal: Terminal | null = null;
  public fitAddon: FitAddon | null = null;
  public terminalContainer: HTMLElement | null = null;
  private isComposing: boolean = false;
  public activeTerminalId: string | null = null;

  // Performance optimization: Buffer output and batch writes
  private outputBuffer: string[] = [];
  private bufferFlushTimer: number | null = null;
  private readonly BUFFER_FLUSH_INTERVAL = SPLIT_CONSTANTS.BUFFER_FLUSH_INTERVAL;
  private readonly MAX_BUFFER_SIZE = SPLIT_CONSTANTS.MAX_BUFFER_SIZE;

  // Performance optimization: Debounce resize operations
  private resizeDebounceTimer: number | null = null;
  private readonly RESIZE_DEBOUNCE_DELAY = SPLIT_CONSTANTS.RESIZE_DEBOUNCE_DELAY;

  // Managers
  private splitManager: SplitManager;
  private statusManager: SimpleStatusManager;

  constructor() {
    this.splitManager = new SplitManager();
    this.statusManager = new SimpleStatusManager();
  }

  public initializeSimpleTerminal(): void {
    const container = document.getElementById('terminal');
    if (!container) {
      console.error('Terminal container not found');
      this.statusManager.showStatus('ERROR: Terminal container not found', 'error');
      return;
    }

    this.statusManager.showStatus('Initializing simple terminal');
    console.log('🎯 [WEBVIEW] Initializing simple terminal');

    // Create simple terminal container
    container.innerHTML = `
      <div id="terminal-body" style="
        flex: 1;
        background: #000;
        position: relative;
        height: 100%;
        min-height: 200px;
      ">
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
      </div>
    `;

    // Force DOM update by using a small delay
    setTimeout(() => {
      this.terminalContainer = document.getElementById('terminal-body');

      if (this.terminalContainer) {
        this.statusManager.showStatus('Simple terminal view initialized', 'success');
        console.log('🎯 [WEBVIEW] Simple terminal container created successfully');
      } else {
        this.statusManager.showStatus('ERROR: Failed to create terminal container', 'error');
        console.error('❌ [WEBVIEW] Failed to create terminal container');
      }
    }, 1);

    // Setup IME support
    this.setupIMEHandling();
  }

  public createTerminal(id: string, name: string, config: TerminalConfig): void {
    this.statusManager.showStatus(`Creating terminal: ${name}`);
    this.setActiveTerminalId(id);
    console.log('🎯 [WEBVIEW] Creating terminal:', id, name);

    if (!this.terminalContainer) {
      console.error('❌ [WEBVIEW] No terminal container available');
      this.statusManager.showStatus('ERROR: No terminal container');
      return;
    }

    try {
      const terminalTheme = getWebviewTheme();
      console.log('🎨 [WEBVIEW] Creating terminal with theme:', terminalTheme);

      const terminal = new Terminal({
        fontSize: config.fontSize || 14,
        fontFamily: config.fontFamily || 'monospace',
        theme: terminalTheme,
        cursorBlink: true,
        allowTransparency: true,
        scrollback: 10000,
      });

      this.statusManager.showStatus(`Terminal instance created: ${name}`);

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(new WebLinksAddon());

      // Clear placeholder
      const placeholder = document.getElementById('terminal-placeholder');
      if (placeholder) {
        placeholder.remove();
      }

      // Create terminal container div
      let targetContainer = this.terminalContainer;

      if (!this.splitManager.getIsSplitMode()) {
        // First terminal - create primary container
        const terminalDiv = document.createElement('div');
        terminalDiv.style.cssText = 'width: 100%; height: 100%;';
        terminalDiv.setAttribute('data-terminal-container', 'primary');
        terminalDiv.id = `terminal-container-${id}`;
        this.terminalContainer.appendChild(terminalDiv);
        targetContainer = terminalDiv;

        // Register the container with split manager
        this.splitManager.getTerminalContainers().set(id, terminalDiv);
      } else {
        // Split mode - create container for the new terminal
        const terminalDiv = document.createElement('div');
        terminalDiv.style.cssText = 'width: 100%; height: 50%; display: block;';
        terminalDiv.setAttribute('data-terminal-container', 'split');
        terminalDiv.id = `terminal-container-${id}`;
        this.terminalContainer.appendChild(terminalDiv);
        targetContainer = terminalDiv;

        // Register the container with split manager
        this.splitManager.getTerminalContainers().set(id, terminalDiv);

        // Adjust existing terminal containers to 50% height
        this.splitManager.getTerminalContainers().forEach((container, terminalId) => {
          if (terminalId !== id) {
            container.style.height = '50%';
            container.style.display = 'block';
          }
        });
      }

      // Open terminal
      setTimeout(() => {
        try {
          terminal.open(targetContainer);
          setTimeout(() => {
            fitAddon.fit();
            terminal.refresh(0, terminal.rows - 1);
            terminal.focus();

            this.statusManager.showStatus(`✅ ${name} ACTIVE`, 'success');

            // Only set as main terminal if it's the first one or not in split mode
            if (!this.splitManager.getIsSplitMode() || !this.terminal) {
              this.terminal = terminal;
              this.fitAddon = fitAddon;
            }

            // Switch to the newly created terminal
            this.switchToTerminal(id);
          }, 300);
        } catch (openError) {
          console.error('❌ [WEBVIEW] Error opening terminal:', openError);
          this.statusManager.showStatus(`Error opening: ${String(openError)}`, 'error');
        }
      }, 100);

      // Handle terminal input
      terminal.onData((data) => {
        if (this.isComposing) {
          return;
        }

        vscode.postMessage({
          command: 'input' as const,
          data,
          terminalId: this.activeTerminalId || id,
        });
      });

      // Handle resize
      terminal.onResize((size) => {
        vscode.postMessage({
          command: 'resize' as const,
          cols: size.cols,
          rows: size.rows,
          terminalId: id,
        });
      });

      // Store terminal instance
      this.splitManager.setTerminal(id, {
        terminal,
        fitAddon,
        name,
      });

      // Performance optimization: Use debounced resize observer
      if (this.terminalContainer) {
        const resizeObserver = new ResizeObserver(() => {
          if (this.fitAddon && this.terminal) {
            this.debouncedResize(this.terminal.cols, this.terminal.rows);
          }
        });
        resizeObserver.observe(this.terminalContainer);
      }
    } catch (error) {
      console.error('❌ [WEBVIEW] Error creating terminal:', error);
      this.statusManager.showStatus(`Error creating terminal: ${String(error)}`, 'error');
    }
  }

  public switchToTerminal(id: string): void {
    console.log('🔄 [WEBVIEW] Switching to terminal:', id);

    this.setActiveTerminalId(id);

    const terminalCount = this.splitManager.getTerminals().size;

    if (terminalCount <= 1) {
      // Single terminal mode - show only the active terminal
      this.splitManager.getTerminalContainers().forEach((container, terminalId) => {
        if (terminalId === id) {
          container.style.display = 'block';
          container.style.height = '100%';
        } else {
          container.style.display = 'none';
        }
      });
    } else {
      // Split mode - show all terminals but focus the active one
      this.splitManager.getTerminalContainers().forEach((container, terminalId) => {
        container.style.display = 'block';
        container.style.height = '50%';
        // Add visual indicator for active terminal
        if (terminalId === id) {
          container.style.border = '2px solid var(--vscode-focusBorder, #007acc)';
        } else {
          container.style.border = '1px solid var(--vscode-panel-border, #454545)';
        }
      });
    }

    // Focus the active terminal
    const terminalData = this.splitManager.getTerminals().get(id);
    if (terminalData?.terminal) {
      terminalData.terminal.focus();
      if (terminalData.fitAddon) {
        terminalData.fitAddon.fit();
      }
    }

    console.log('✅ [WEBVIEW] Switched to terminal:', id);
  }

  public closeTerminal(id: string): void {
    console.log('🗑️ [WEBVIEW] Close terminal requested:', id);

    // Check if this is a safe kill attempt
    if (!this.canKillTerminal(id)) {
      return;
    }

    this.performKillTerminal(id);
  }

  private canKillTerminal(_id: string): boolean {
    const terminalCount = this.splitManager.getTerminals().size;
    const minTerminalCount = 1;

    if (terminalCount <= minTerminalCount) {
      console.warn('🛡️ [WEBVIEW] Cannot kill terminal - would go below minimum count');
      this.showLastTerminalWarning(minTerminalCount);
      return false;
    }

    return true;
  }

  private showLastTerminalWarning(minCount: number): void {
    const warningOverlay = document.createElement('div');
    warningOverlay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--vscode-notifications-background, #1e1e1e);
      border: 2px solid var(--vscode-errorBackground, #f14c4c);
      border-radius: 6px;
      padding: 16px 20px;
      color: var(--vscode-errorForeground, #ffffff);
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      text-align: center;
    `;

    warningOverlay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; justify-content: center; margin-bottom: 8px;">
        <span style="font-size: 16px;">⚠️</span>
        <span><strong>Cannot close terminal</strong></span>
      </div>
      <div style="margin-bottom: 4px;">
        Must keep at least ${minCount} terminal${minCount > 1 ? 's' : ''} open
      </div>
    `;

    document.body.appendChild(warningOverlay);

    setTimeout(() => {
      if (warningOverlay.parentNode) {
        warningOverlay.remove();
      }
    }, 3000);
  }

  private performKillTerminal(id: string): void {
    console.log('🗑️ [WEBVIEW] Performing kill for terminal:', id);

    // Remove terminal instance
    const terminalData = this.splitManager.getTerminals().get(id);
    if (terminalData) {
      terminalData.terminal.dispose();
      this.splitManager.getTerminals().delete(id);
    }

    // Remove terminal container
    const container = this.splitManager.getTerminalContainers().get(id);
    if (container) {
      container.remove();
      this.splitManager.getTerminalContainers().delete(id);
    }

    // Adjust remaining terminal layouts
    const remainingTerminals = Array.from(this.splitManager.getTerminals().keys());

    if (remainingTerminals.length === 1) {
      // Only one terminal left - make it full height
      const remainingId = remainingTerminals[0];
      if (remainingId) {
        const remainingContainer = this.splitManager.getTerminalContainers().get(remainingId);
        if (remainingContainer) {
          remainingContainer.style.height = '100%';
          remainingContainer.style.border = 'none';
        }
      }
    }

    // If this was the active terminal, switch to another one
    if (this.activeTerminalId === id) {
      if (remainingTerminals.length > 0) {
        const nextTerminalId = remainingTerminals[0];
        if (nextTerminalId) {
          this.switchToTerminal(nextTerminalId);
        }
      } else {
        this.activeTerminalId = null;
        this.showTerminalPlaceholder();
      }
    }

    // Notify extension about terminal closure
    vscode.postMessage({
      command: 'terminalClosed',
      terminalId: id,
    });

    console.log('✅ [WEBVIEW] Terminal closed:', id);
  }

  private showTerminalPlaceholder(): void {
    const terminalBody = document.getElementById('terminal-body');
    if (terminalBody) {
      terminalBody.innerHTML = `
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
          <div>No Terminal</div>
          <div style="font-size: 12px; margin-top: 8px;">Create a new terminal to get started</div>
        </div>
      `;
    }
  }

  public clearTerminal(): void {
    // Clear active terminal
    let targetTerminal = this.terminal;
    if (this.activeTerminalId) {
      const terminalData = this.splitManager.getTerminals().get(this.activeTerminalId);
      if (terminalData) {
        targetTerminal = terminalData.terminal;
      }
    }

    if (targetTerminal) {
      console.log('🧹 [WEBVIEW] Clearing terminal screen');
      targetTerminal.clear();
      targetTerminal.write('\x1b[2J\x1b[H');
      this.statusManager.showStatus('Terminal cleared', 'success');
    }
  }

  public writeToTerminal(data: string, _terminalId?: string): void {
    // Determine which terminal to write to
    let targetTerminal = this.terminal;

    if (this.activeTerminalId) {
      const terminalData = this.splitManager.getTerminals().get(this.activeTerminalId);
      if (terminalData) {
        targetTerminal = terminalData.terminal;
      }
    }

    if (targetTerminal) {
      if (data.length < 1000 && this.outputBuffer.length < this.MAX_BUFFER_SIZE) {
        this.outputBuffer.push(data);
        this.scheduleBufferFlush();
      } else {
        this.flushOutputBuffer();
        targetTerminal.write(data);
      }
    } else {
      console.warn('⚠️ [WEBVIEW] No terminal instance to write to');
    }
  }

  private scheduleBufferFlush(): void {
    if (this.bufferFlushTimer === null) {
      this.bufferFlushTimer = window.setTimeout(() => {
        this.flushOutputBuffer();
      }, this.BUFFER_FLUSH_INTERVAL);
    }
  }

  private flushOutputBuffer(): void {
    if (this.bufferFlushTimer !== null) {
      window.clearTimeout(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }

    if (this.outputBuffer.length > 0) {
      const bufferedData = this.outputBuffer.join('');
      this.outputBuffer = [];

      // Write to active terminal
      let targetTerminal = this.terminal;
      if (this.activeTerminalId) {
        const terminalData = this.splitManager.getTerminals().get(this.activeTerminalId);
        if (terminalData) {
          targetTerminal = terminalData.terminal;
        }
      }

      if (targetTerminal) {
        targetTerminal.write(bufferedData);
      }
    }
  }

  public debouncedResize(cols: number, rows: number): void {
    if (this.resizeDebounceTimer !== null) {
      window.clearTimeout(this.resizeDebounceTimer);
    }

    this.resizeDebounceTimer = window.setTimeout(() => {
      if (this.fitAddon && this.terminal) {
        this.terminal.resize(cols, rows);
        this.fitAddon.fit();
      }
      this.resizeDebounceTimer = null;
    }, this.RESIZE_DEBOUNCE_DELAY);
  }

  // Split functionality methods
  public initializeSplitControls(): void {
    console.log('🔀 [WEBVIEW] Split controls ready (using panel commands)');
  }

  public prepareSplitMode(direction: 'horizontal' | 'vertical'): void {
    this.splitManager.prepareSplitMode(direction);
  }

  public splitTerminal(direction: 'horizontal' | 'vertical'): void {
    this.splitManager.splitTerminal(direction);
  }

  public addNewTerminalToSplit(terminalId: string, terminalName: string): void {
    this.splitManager.addNewTerminalToSplit(terminalId, terminalName);
  }

  private setupIMEHandling(): void {
    console.log('🌐 [WEBVIEW] Setting up IME handling');

    document.addEventListener('compositionstart', (_e) => {
      this.isComposing = true;
    });

    document.addEventListener('compositionend', (e) => {
      this.isComposing = false;

      if (e.data && this.terminal) {
        vscode.postMessage({
          command: 'input' as const,
          data: e.data,
          terminalId: this.activeTerminalId || 'terminal-initial',
        });
      }
    });

    const style = document.createElement('style');
    style.textContent = `
      .xterm-screen {
        min-width: 1px;
      }
      .xterm-composition-view {
        background: rgba(255, 255, 0, 0.3);
        border-bottom: 1px solid #ffff00;
      }
    `;
    document.head.appendChild(style);
  }

  public setActiveTerminalId(terminalId: string): void {
    this.activeTerminalId = terminalId;
    console.log('🎯 [WEBVIEW] Active terminal ID set to:', terminalId);
  }

  // Getters for split manager integration
  public getIsSplitMode(): boolean {
    return this.splitManager.getIsSplitMode();
  }

  public getSplitManager(): SplitManager {
    return this.splitManager;
  }

  public getStatusManager(): SimpleStatusManager {
    return this.statusManager;
  }

  public switchToNextTerminal(): void {
    const terminalIds = Array.from(this.splitManager.getTerminals().keys());
    if (terminalIds.length <= 1) return;

    const currentIndex = terminalIds.indexOf(this.activeTerminalId || '');
    const nextIndex = (currentIndex + 1) % terminalIds.length;
    const nextTerminalId = terminalIds[nextIndex];

    if (nextTerminalId) {
      this.switchToTerminal(nextTerminalId);
      this.statusManager.showStatus(`Switched to terminal ${nextIndex + 1}`, 'info');
    }
  }

  public dispose(): void {
    this.flushOutputBuffer();

    if (this.bufferFlushTimer !== null) {
      window.clearTimeout(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }

    if (this.resizeDebounceTimer !== null) {
      window.clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }

    if (this.terminal) {
      this.terminal.dispose();
      this.terminal = null;
    }

    this.fitAddon = null;
    this.terminalContainer = null;
  }
}

// Global instance
const terminalManager = new TerminalWebviewManager();

// Handle messages from the extension
window.addEventListener('message', (event) => {
  const message = event.data as TerminalMessage;
  console.log('🎯 [WEBVIEW] Message data:', message);

  switch (message.command) {
    case WEBVIEW_TERMINAL_CONSTANTS.COMMANDS.INIT:
      terminalManager.getStatusManager().showStatus('Received INIT command');
      console.log('🎯 [WEBVIEW] Received INIT command', message);
      if (message.config) {
        terminalManager.getStatusManager().showStatus('Initializing terminal UI');
        terminalManager.initializeSimpleTerminal();

        if (message.activeTerminalId) {
          terminalManager.setActiveTerminalId(message.activeTerminalId);
        }

        const checkContainerAndCreate = (): void => {
          if (terminalManager.terminalContainer) {
            const terminalId = message.activeTerminalId || 'terminal-initial';
            try {
              if (message.config) {
                terminalManager.createTerminal(terminalId, 'Terminal 1', message.config);
              } else {
                throw new Error('No terminal config provided');
              }
              terminalManager.initializeSplitControls();
              terminalManager.getStatusManager().showStatus('Terminal ready');
            } catch (error) {
              console.error('❌ [WEBVIEW] Error during terminal creation:', error);
              terminalManager.getStatusManager().showStatus(`ERROR: ${String(error)}`, 'error');
            }
          } else {
            setTimeout(checkContainerAndCreate, 50);
          }
        };

        setTimeout(checkContainerAndCreate, 10);
      } else {
        terminalManager.getStatusManager().showStatus('ERROR: No config');
        console.error('❌ [WEBVIEW] No config provided in INIT message');
      }
      break;

    case WEBVIEW_TERMINAL_CONSTANTS.COMMANDS.OUTPUT:
      if (message.data) {
        terminalManager.writeToTerminal(message.data, message.terminalId);
      }
      break;

    case WEBVIEW_TERMINAL_CONSTANTS.COMMANDS.CLEAR:
      terminalManager.clearTerminal();
      break;

    case WEBVIEW_TERMINAL_CONSTANTS.COMMANDS.EXIT:
      if (message.exitCode !== undefined) {
        terminalManager.writeToTerminal(
          `\r\n[Process exited with code ${message.exitCode ?? 'unknown'}]\r\n`
        );
      }
      break;

    case WEBVIEW_TERMINAL_CONSTANTS.COMMANDS.SPLIT:
      console.log('🔀 [WEBVIEW] Received SPLIT command');
      terminalManager.prepareSplitMode('vertical');
      break;

    case WEBVIEW_TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED:
      if (message.terminalId && message.terminalName && message.config) {
        if (
          terminalManager.getIsSplitMode() &&
          message.terminalId !== terminalManager.activeTerminalId
        ) {
          console.log('🔀 [WEBVIEW] Adding new terminal to split layout');
          terminalManager.createTerminal(message.terminalId, message.terminalName, message.config);
          terminalManager.addNewTerminalToSplit(message.terminalId, message.terminalName);
        } else {
          terminalManager.createTerminal(message.terminalId, message.terminalName, message.config);
        }
      }
      break;

    case WEBVIEW_TERMINAL_CONSTANTS.COMMANDS.TERMINAL_REMOVED:
      if (message.terminalId) {
        console.log('🗑️ [WEBVIEW] Received terminal removal command for:', message.terminalId);
        terminalManager.closeTerminal(message.terminalId);
      }
      break;

    default:
      console.warn('⚠️ [WEBVIEW] Unknown command received:', message.command);
  }
});

// Enhanced update status function
function updateStatus(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  terminalManager.getStatusManager().showStatus(message, type);
}

// Setup activity listeners
function setupActivityListeners(): void {
  document.addEventListener('keydown', () => {
    terminalManager.getStatusManager().showLastStatusOnActivity();
  });

  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement)?.closest('.status')) {
      terminalManager.getStatusManager().showLastStatusOnActivity();
    }
  });

  window.addEventListener('focus', () => {
    terminalManager.getStatusManager().showLastStatusOnActivity();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    terminalManager.getStatusManager().hideStatus();
  }

  // Ctrl+Tab to switch between terminals
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault();
    terminalManager.switchToNextTerminal();
  }
});

// Notify extension that webview is ready
console.log('🎯 [WEBVIEW] Webview script starting...');
updateStatus('Webview script loaded');

setupActivityListeners();

function sendReadyMessage(): void {
  console.log('🎯 [WEBVIEW] Sending READY message to extension');
  updateStatus('Sending ready message to extension');
  try {
    vscode.postMessage({ command: 'ready' as const });
    console.log('✅ [WEBVIEW] READY message sent successfully');
    updateStatus('Ready message sent, waiting for response...');
  } catch (error) {
    console.error('❌ [WEBVIEW] Failed to send READY message:', error);
    updateStatus(`ERROR sending ready: ${String(error)}`);
  }
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    updateStatus('DOM loaded, sending ready message');
    sendReadyMessage();
  });
} else {
  updateStatus('DOM ready, sending ready message');
  sendReadyMessage();
}
