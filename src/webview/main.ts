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

// Simple terminal management without complex splitting
class TerminalWebviewManager {
  private terminal: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  public terminalContainer: HTMLElement | null = null;
  private isComposing: boolean = false;
  private activeTerminalId: string | null = null;

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

      // Observe container resize
      if (this.terminalContainer) {
        const resizeObserver = new ResizeObserver(() => {
          if (this.fitAddon) {
            this.fitAddon.fit();
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
      console.log('✍️ [WEBVIEW] Writing to xterm:', JSON.stringify(data.substring(0, 50)));
      this.terminal.write(data);
    } else {
      console.warn('⚠️ [WEBVIEW] No terminal instance to write to');
    }
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
          JSON.stringify(message.data.substring(0, 50))
        );
        terminalManager.writeToTerminal(message.data);
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
