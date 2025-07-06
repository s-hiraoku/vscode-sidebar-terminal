import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

// Import types and constants for webview
import type { WebviewMessage, VsCodeMessage, TerminalConfig } from '../types/common';

// Constants for webview (duplicated to avoid import issues)
const WEBVIEW_CONSTANTS = {
  DARK_THEME: {
    background: '#1e1e1e',
    foreground: '#cccccc',
    cursor: '#ffffff',
    cursorAccent: '#000000',
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
    brightWhite: '#ffffff',
  },
  LIGHT_THEME: {
    background: '#ffffff',
    foreground: '#333333',
    cursor: '#000000',
    cursorAccent: '#ffffff',
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
  },
};

const TERMINAL_CONSTANTS = {
  TERMINAL_REMOVE_DELAY: 2000,
  COMMANDS: {
    READY: 'ready',
    INIT: 'init',
    INPUT: 'input',
    OUTPUT: 'output',
    RESIZE: 'resize',
    CLEAR: 'clear',
    EXIT: 'exit',
    SPLIT: 'split',
    TERMINAL_CREATED: 'terminalCreated',
    TERMINAL_REMOVED: 'terminalRemoved',
    SWITCH_TERMINAL: 'switchTerminal',
  },
};

declare const acquireVsCodeApi: () => {
  postMessage: (message: VsCodeMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

const vscode = acquireVsCodeApi();

// Performance-optimized terminal management with split support
class TerminalWebviewManager {
  private terminal: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  public terminalContainer: HTMLElement | null = null;
  private isComposing: boolean = false;
  private activeTerminalId: string | null = null;

  // Split functionality
  public secondaryTerminal: Terminal | null = null;
  private secondaryFitAddon: FitAddon | null = null;
  private isSplitMode = false;
  private splitDirection: 'horizontal' | 'vertical' | null = null;

  // Performance optimization: Buffer output and batch writes
  private outputBuffer: string[] = [];
  private bufferFlushTimer: number | null = null;
  private readonly BUFFER_FLUSH_INTERVAL = 16; // ~60fps
  private readonly MAX_BUFFER_SIZE = 100;

  // Performance optimization: Debounce resize operations
  private resizeDebounceTimer: number | null = null;
  private readonly RESIZE_DEBOUNCE_DELAY = 150;

  public initializeSimpleTerminal(): void {
    const container = document.getElementById('terminal');
    if (!container) {
      console.error('Terminal container not found');
      updateStatus('ERROR: Terminal container not found');
      return;
    }

    updateStatus('Initializing simple terminal');
    console.log('🎯 [WEBVIEW] Initializing simple terminal');

    // Create a simple terminal container with buttons
    container.innerHTML = `
      <div id="terminal-header" style="
        display: flex;
        background: var(--vscode-tab-inactiveBackground, #2d2d30);
        border-bottom: 1px solid var(--vscode-tab-border, #333);
        padding: 4px 8px;
        gap: 4px;
        align-items: center;
        justify-content: space-between;
        min-height: 32px;
      ">
        <div style="
          font-size: 12px;
          color: var(--vscode-foreground, #cccccc);
          font-family: var(--vscode-font-family, monospace);
        ">Terminal</div>
      </div>
      <div id="terminal-body" style="
        flex: 1;
        background: #000;
        position: relative;
        height: calc(100% - 32px);
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
        updateStatus('Simple terminal view initialized');
        console.log('🎯 [WEBVIEW] Simple terminal container created successfully');
        console.log('🎯 [WEBVIEW] Container element:', this.terminalContainer);
      } else {
        updateStatus('ERROR: Failed to create terminal container');
        console.error('❌ [WEBVIEW] Failed to create terminal container');
        console.error('❌ [WEBVIEW] Available elements:', document.querySelectorAll('*'));
      }
    }, 1);

    // Setup IME support
    this.setupIMEHandling();
  }

  private setupIMEHandling(): void {
    console.log('🌐 [WEBVIEW] Setting up IME handling');

    // Listen for composition events on the document
    document.addEventListener('compositionstart', (_e) => {
      console.log('🌐 [WEBVIEW] Composition started');
      this.isComposing = true;
    });

    document.addEventListener('compositionupdate', (e) => {
      console.log('🌐 [WEBVIEW] Composition updating:', e.data);
      // Don't send data during composition updates
    });

    document.addEventListener('compositionend', (e) => {
      console.log('🌐 [WEBVIEW] Composition ended:', e.data);
      this.isComposing = false;

      // Send the composed text when IME composition is complete
      if (e.data && this.terminal) {
        console.log('🌐 [WEBVIEW] Sending composed text:', e.data);
        vscode.postMessage({
          command: 'input' as const,
          data: e.data,
          terminalId: this.activeTerminalId || 'terminal-initial',
        });
      }
    });

    // Add CSS for IME stability
    const style = document.createElement('style');
    style.textContent = `
      .xterm-screen {
        min-width: 1px; /* IME input stability fix */
      }
      .xterm-composition-view {
        background: rgba(255, 255, 0, 0.3);
        border-bottom: 1px solid #ffff00;
      }
    `;
    document.head.appendChild(style);

    console.log('🌐 [WEBVIEW] IME handling setup complete');
  }

  public setActiveTerminalId(terminalId: string): void {
    this.activeTerminalId = terminalId;
    console.log('🎯 [WEBVIEW] Active terminal ID set to:', terminalId);
  }

  public createTerminal(id: string, name: string, config: TerminalConfig): void {
    updateStatus(`Creating terminal: ${name}`);
    this.setActiveTerminalId(id); // Set active terminal ID immediately
    console.log('🎯 [WEBVIEW] Creating terminal:', id, name);
    console.log('🎯 [WEBVIEW] Terminal container available:', !!this.terminalContainer);

    if (!this.terminalContainer) {
      console.error('❌ [WEBVIEW] No terminal container available');
      updateStatus('ERROR: No terminal container');
      return;
    }

    try {
      const terminal = new Terminal({
        fontSize: config.fontSize || 14,
        fontFamily: config.fontFamily || 'monospace',
        theme: getTheme(),
        cursorBlink: true,
        allowTransparency: true,
        scrollback: 10000,
      });

      updateStatus(`Terminal instance created: ${name}`);
      console.log('🎯 [WEBVIEW] Terminal instance created successfully');

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(new WebLinksAddon());

      updateStatus(`Loading addons for: ${name}`);
      console.log('🎯 [WEBVIEW] Terminal addons loaded');

      if (this.terminalContainer) {
        // Clear placeholder immediately
        const placeholder = document.getElementById('terminal-placeholder');
        if (placeholder) {
          placeholder.remove();
          console.log('🎯 [WEBVIEW] Placeholder removed');
        } else {
          console.log('🎯 [WEBVIEW] No placeholder found to remove');
        }

        updateStatus(`Opening terminal: ${name}`);
        console.log('🎯 [WEBVIEW] Opening terminal in container');

        // Give the DOM time to settle before opening terminal
        setTimeout(() => {
          try {
            console.log('🎯 [WEBVIEW] Calling terminal.open()');
            terminal.open(this.terminalContainer as HTMLElement);
            console.log('🎯 [WEBVIEW] Terminal.open() completed');

            updateStatus(`Terminal opened: ${name}`);

            // Wait for terminal to be fully rendered
            setTimeout(() => {
              updateStatus(`Fitting terminal: ${name}`);
              console.log('🎯 [WEBVIEW] Fitting terminal');

              try {
                fitAddon.fit();
                console.log('🎯 [WEBVIEW] Terminal fitted successfully');

                // Force refresh after fitting
                terminal.refresh(0, terminal.rows - 1);

                console.log('🎯 [WEBVIEW] Focusing terminal and ready for pty connection');
                terminal.focus();

                updateStatus(`✅ ${name} ACTIVE`);

                // Store reference
                this.terminal = terminal;
                this.fitAddon = fitAddon;
              } catch (fitError) {
                console.error('❌ [WEBVIEW] Error during fitting:', fitError);
                updateStatus(`Error fitting: ${String(fitError)}`);
              }
            }, 300);
          } catch (openError) {
            console.error('❌ [WEBVIEW] Error opening terminal:', openError);
            updateStatus(`Error opening: ${String(openError)}`);
          }
        }, 100);
      } else {
        console.error('❌ [WEBVIEW] No terminal container available!');
        updateStatus('ERROR: No terminal container');
      }

      // Handle terminal input with special key processing
      terminal.onData((data) => {
        console.log(
          '🎯 [WEBVIEW] Terminal input data:',
          data,
          'length:',
          data.length,
          'charCode:',
          data.charCodeAt(0)
        );

        // Skip processing if we're in IME composition mode
        if (this.isComposing) {
          console.log('🌐 [WEBVIEW] Skipping input during IME composition');
          return;
        }

        // Handle special keys
        const charCode = data.charCodeAt(0);

        // Process the input based on character codes
        if (charCode === 127) {
          // Backspace key (DEL character) - convert to proper backspace
          console.log(
            '⌫ [WEBVIEW] DEL character detected (Backspace key), converting to backspace'
          );
          vscode.postMessage({
            command: 'input' as const,
            data: '\x08', // Send proper backspace character
            terminalId: this.activeTerminalId || id,
          });
        } else if (charCode === 8) {
          // BS (backspace) character - send as-is
          console.log('⌫ [WEBVIEW] BS character detected');
          vscode.postMessage({
            command: 'input' as const,
            data: data, // Pass through as-is
            terminalId: this.activeTerminalId || id,
          });
        } else if (charCode === 13) {
          // Enter key
          console.log('↵ [WEBVIEW] Enter detected');
          vscode.postMessage({
            command: 'input' as const,
            data: '\r', // Ensure proper line ending
            terminalId: this.activeTerminalId || id,
          });
        } else if (data.startsWith('\x1b[')) {
          // Arrow keys and other escape sequences
          console.log('🔄 [WEBVIEW] Escape sequence detected:', JSON.stringify(data));
          vscode.postMessage({
            command: 'input' as const,
            data: data,
            terminalId: this.activeTerminalId || id,
          });
        } else if (charCode === 3) {
          // Ctrl+C (SIGINT)
          console.log('🛑 [WEBVIEW] Ctrl+C detected');
          vscode.postMessage({
            command: 'input' as const,
            data: '\x03',
            terminalId: this.activeTerminalId || id,
          });
        } else if (charCode === 12) {
          // Ctrl+L (clear screen)
          console.log('🧹 [WEBVIEW] Ctrl+L detected');
          vscode.postMessage({
            command: 'input' as const,
            data: '\x0c',
            terminalId: this.activeTerminalId || id,
          });
        } else if (charCode === 4) {
          // Ctrl+D (EOF)
          console.log('📄 [WEBVIEW] Ctrl+D detected');
          vscode.postMessage({
            command: 'input' as const,
            data: '\x04',
            terminalId: this.activeTerminalId || id,
          });
        } else if (charCode === 9) {
          // Tab (for completion)
          console.log('⭾ [WEBVIEW] Tab detected');
          vscode.postMessage({
            command: 'input' as const,
            data: '\x09',
            terminalId: this.activeTerminalId || id,
          });
        } else {
          // Regular character input
          vscode.postMessage({
            command: 'input' as const,
            data,
            terminalId: this.activeTerminalId || id,
          });
        }
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

      // Performance optimization: Use debounced resize observer
      if (this.terminalContainer) {
        const resizeObserver = new ResizeObserver(() => {
          if (this.fitAddon && this.terminal) {
            // Use debounced resize to prevent excessive calls during window resizing
            this.debouncedResize(this.terminal.cols, this.terminal.rows);
          }
        });
        resizeObserver.observe(this.terminalContainer);
      }

      console.log('🎯 [WEBVIEW] Terminal creation completed successfully');
    } catch (error) {
      console.error('❌ [WEBVIEW] Error creating terminal:', error);
      updateStatus(`Error creating terminal: ${String(error)}`);
    }
  }

  public clearTerminal(): void {
    if (this.terminal) {
      console.log('🧹 [WEBVIEW] Clearing terminal screen');
      this.terminal.clear();
      // Also clear scrollback
      this.terminal.write('\x1b[2J\x1b[H'); // Clear screen and move cursor to home
      updateStatus('Terminal cleared');
    }
  }

  public writeToTerminal(data: string): void {
    if (this.terminal) {
      // Performance optimization: Buffer small outputs for batching
      if (data.length < 1000 && this.outputBuffer.length < this.MAX_BUFFER_SIZE) {
        this.outputBuffer.push(data);
        this.scheduleBufferFlush();
      } else {
        // Flush any buffered data first, then write large data directly
        this.flushOutputBuffer();
        this.terminal.write(data);
      }
    } else {
      console.warn('⚠️ [WEBVIEW] No terminal instance to write to');
    }
  }

  public writeToSecondaryTerminal(data: string): void {
    if (this.secondaryTerminal) {
      console.log('📝 [WEBVIEW] Writing to secondary terminal:', data.length, 'chars');
      this.secondaryTerminal.write(data);
    } else {
      console.warn('⚠️ [WEBVIEW] No secondary terminal instance to write to');
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

    if (this.outputBuffer.length > 0 && this.terminal) {
      const bufferedData = this.outputBuffer.join('');
      this.outputBuffer = [];
      this.terminal.write(bufferedData);
    }
  }

  // Performance optimization: Debounced resize to prevent excessive calls
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

  // Split functionality methods (controlled by panel commands)
  public initializeSplitControls(): void {
    console.log('🔀 [WEBVIEW] Split controls ready (using panel commands)');
    // No UI controls needed - using VS Code panel commands
  }

  public splitTerminal(direction: 'horizontal' | 'vertical'): void {
    if (this.isSplitMode) {
      console.log('Already in split mode');
      return;
    }

    console.log(`🔀 [WEBVIEW] Splitting terminal ${direction}ly`);

    const terminalBody = document.getElementById('terminal-body');

    if (!terminalBody) {
      console.error('Terminal body not found');
      return;
    }

    // Set split direction
    this.splitDirection = direction;
    this.isSplitMode = true;

    // Modify terminal body for split layout
    terminalBody.style.display = 'flex';
    terminalBody.style.flexDirection = direction === 'horizontal' ? 'row' : 'column';

    // Get existing terminal container
    const existingTerminal = terminalBody.querySelector('[data-terminal-container]');

    if (existingTerminal) {
      // Make existing terminal take half space
      (existingTerminal as HTMLElement).style.flex = '1';
      (existingTerminal as HTMLElement).style.minWidth =
        direction === 'horizontal' ? '200px' : 'auto';
      (existingTerminal as HTMLElement).style.minHeight =
        direction === 'vertical' ? '100px' : 'auto';
    }

    // Create splitter
    const splitter = document.createElement('div');
    splitter.style.cssText = `
      background: var(--vscode-widget-border, #454545);
      ${direction === 'horizontal' ? 'width: 4px; cursor: col-resize;' : 'height: 4px; cursor: row-resize;'}
      flex-shrink: 0;
    `;
    splitter.addEventListener('mouseenter', () => {
      splitter.style.background = 'var(--vscode-focusBorder, #007acc)';
    });
    splitter.addEventListener('mouseleave', () => {
      splitter.style.background = 'var(--vscode-widget-border, #454545)';
    });

    // Create secondary terminal container
    const secondaryContainer = document.createElement('div');
    secondaryContainer.style.cssText = `
      flex: 1;
      background: #000;
      ${direction === 'horizontal' ? 'min-width: 200px;' : 'min-height: 100px;'}
    `;
    secondaryContainer.setAttribute('data-terminal-container', 'secondary');
    secondaryContainer.id = 'secondary-terminal';

    // Add to DOM
    terminalBody.appendChild(splitter);
    terminalBody.appendChild(secondaryContainer);

    // Create secondary terminal
    this.createSecondaryTerminal(secondaryContainer);

    // Update UI (no controls to update - using panel commands)

    // Resize terminals
    setTimeout(() => {
      this.resizeTerminals();
    }, 100);

    // Notify extension that split was completed
    console.log('🔀 [WEBVIEW] Split layout completed');
  }

  private createSecondaryTerminal(container: HTMLElement): void {
    try {
      this.secondaryTerminal = new Terminal({
        fontSize: 14,
        fontFamily: 'Consolas, monospace',
        cursorBlink: true,
        theme: {
          background: '#000000',
          foreground: '#ffffff',
        },
      });

      this.secondaryFitAddon = new FitAddon();
      this.secondaryTerminal.loadAddon(this.secondaryFitAddon);
      this.secondaryTerminal.open(container);

      // Set up event handlers for secondary terminal
      this.secondaryTerminal.onData((data) => {
        vscode.postMessage({
          command: 'input' as const,
          data,
          terminalId: 'secondary',
        });
      });

      console.log('✅ [WEBVIEW] Secondary terminal created successfully');
    } catch (error) {
      console.error('❌ [WEBVIEW] Error creating secondary terminal:', error);
    }
  }

  public unsplitTerminal(): void {
    if (!this.isSplitMode) {
      console.log('Not in split mode');
      return;
    }

    console.log('🔀 [WEBVIEW] Removing split');

    const terminalBody = document.getElementById('terminal-body');

    if (!terminalBody) {
      console.error('Terminal body not found');
      return;
    }

    // Clean up secondary terminal
    if (this.secondaryTerminal) {
      this.secondaryTerminal.dispose();
      this.secondaryTerminal = null;
    }

    if (this.secondaryFitAddon) {
      this.secondaryFitAddon = null;
    }

    // Remove split elements
    const splitter = terminalBody.querySelector('[style*="cursor:"]');
    const secondaryContainer = document.getElementById('secondary-terminal');

    if (splitter) {
      terminalBody.removeChild(splitter);
    }

    if (secondaryContainer) {
      terminalBody.removeChild(secondaryContainer);
    }

    // Reset terminal body layout
    terminalBody.style.display = 'block';
    terminalBody.style.flexDirection = '';

    // Reset existing terminal styles
    const existingTerminal = terminalBody.querySelector('[data-terminal-container]');
    if (existingTerminal) {
      (existingTerminal as HTMLElement).style.flex = '';
      (existingTerminal as HTMLElement).style.minWidth = '';
      (existingTerminal as HTMLElement).style.minHeight = '';
    }

    // Update state
    this.isSplitMode = false;
    this.splitDirection = null;
    // No UI controls to update - using panel commands

    // Resize main terminal
    setTimeout(() => {
      this.resizeTerminals();
    }, 100);
  }

  // Split controls managed by VS Code panel - no internal UI needed

  private resizeTerminals(): void {
    if (this.fitAddon && this.terminal) {
      this.fitAddon.fit();
    }

    if (this.isSplitMode && this.secondaryFitAddon && this.secondaryTerminal) {
      this.secondaryFitAddon.fit();
    }
  }

  // Performance optimization: Cleanup method
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

    if (this.secondaryTerminal) {
      this.secondaryTerminal.dispose();
      this.secondaryTerminal = null;
    }

    this.fitAddon = null;
    this.secondaryFitAddon = null;
    this.terminalContainer = null;
  }
}

// Global instance
const terminalManager = new TerminalWebviewManager();

function getTheme(): { [key: string]: string } {
  const style = getComputedStyle(document.body);
  const isDark = style.backgroundColor.includes('30') || style.backgroundColor.includes('1e1e1e');

  return isDark ? WEBVIEW_CONSTANTS.DARK_THEME : WEBVIEW_CONSTANTS.LIGHT_THEME;
}

// Handle messages from the extension
window.addEventListener('message', (event) => {
  console.log('🎯 [WEBVIEW] Received message event:', event);
  const message = event.data as WebviewMessage;
  console.log('🎯 [WEBVIEW] Message data:', message);
  console.log('🎯 [WEBVIEW] Message command:', message.command);

  switch (message.command) {
    case TERMINAL_CONSTANTS.COMMANDS.INIT:
      updateStatus('Received INIT command');
      console.log('🎯 [WEBVIEW] Received INIT command', message);
      if (message.config) {
        updateStatus('Initializing terminal UI');
        console.log('🎯 [WEBVIEW] Initializing simple terminal');
        terminalManager.initializeSimpleTerminal();

        // Set active terminal ID
        if (message.activeTerminalId) {
          terminalManager.setActiveTerminalId(message.activeTerminalId);
          console.log('🎯 [WEBVIEW] Set active terminal ID:', message.activeTerminalId);
        }

        // Wait for terminal container to be available
        const checkContainerAndCreate = (): void => {
          updateStatus('Checking terminal container availability');
          console.log('🎯 [WEBVIEW] Checking terminal container...');
          console.log('🎯 [WEBVIEW] Container available:', !!terminalManager.terminalContainer);

          if (terminalManager.terminalContainer) {
            updateStatus('Creating initial terminal');
            console.log('🎯 [WEBVIEW] Creating initial terminal');
            const terminalId = message.activeTerminalId || 'terminal-initial';

            try {
              if (message.config) {
                terminalManager.createTerminal(terminalId, 'Terminal 1', message.config);
              } else {
                throw new Error('No terminal config provided');
              }

              // Initialize split controls after terminal is ready
              terminalManager.initializeSplitControls();

              updateStatus('Terminal ready');
              console.log('🎯 [WEBVIEW] Terminal initialization completed');
            } catch (error) {
              console.error('❌ [WEBVIEW] Error during terminal creation:', error);
              updateStatus(`ERROR: ${String(error)}`);
            }
          } else {
            console.log('🎯 [WEBVIEW] Container not ready, waiting...');
            updateStatus('Waiting for container...');
            setTimeout(checkContainerAndCreate, 50);
          }
        };

        setTimeout(checkContainerAndCreate, 10);
      } else {
        updateStatus('ERROR: No config');
        console.error('❌ [WEBVIEW] No config provided in INIT message');
      }
      break;

    case TERMINAL_CONSTANTS.COMMANDS.OUTPUT:
      if (message.data) {
        console.log(
          '📥 [WEBVIEW] Received output data:',
          message.data.length,
          'chars:',
          JSON.stringify(message.data.substring(0, 50)),
          'terminalId:',
          message.terminalId
        );

        // Route output to correct terminal
        if (message.terminalId === 'secondary' && terminalManager.secondaryTerminal) {
          terminalManager.writeToSecondaryTerminal(message.data);
        } else {
          terminalManager.writeToTerminal(message.data);
        }
      }
      break;

    case TERMINAL_CONSTANTS.COMMANDS.CLEAR:
      terminalManager.clearTerminal();
      break;

    case TERMINAL_CONSTANTS.COMMANDS.EXIT:
      if (message.exitCode !== undefined) {
        terminalManager.writeToTerminal(
          `\r\n[Process exited with code ${message.exitCode ?? 'unknown'}]\r\n`
        );
      }
      break;

    case TERMINAL_CONSTANTS.COMMANDS.SPLIT:
      console.log('🔀 [WEBVIEW] Received SPLIT command');
      // Default to horizontal split (can be extended to support direction)
      terminalManager.splitTerminal('horizontal');
      break;

    case TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED:
      if (message.terminalId && message.terminalName && message.config) {
        terminalManager.createTerminal(message.terminalId, message.terminalName, message.config);
      }
      break;
  }
});

// Update status display
function updateStatus(message: string): void {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
  }
  console.log('🎯 [WEBVIEW]', message);
}

// Notify extension that webview is ready
console.log('🎯 [WEBVIEW] Webview script starting...');
updateStatus('Webview script loaded');

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
  console.log('🎯 [WEBVIEW] DOM is loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 [WEBVIEW] DOMContentLoaded event fired');
    updateStatus('DOM loaded, sending ready message');
    sendReadyMessage();
  });
} else {
  console.log('🎯 [WEBVIEW] DOM is already ready');
  updateStatus('DOM ready, sending ready message');
  sendReadyMessage();
}
