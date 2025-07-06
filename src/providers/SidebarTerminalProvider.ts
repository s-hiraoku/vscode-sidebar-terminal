import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { VsCodeMessage, WebviewMessage } from '../types/common';
import { TERMINAL_CONSTANTS } from '../constants';
import { getTerminalConfig, generateNonce, normalizeTerminalInfo } from '../utils/common';
import { showSuccess, showError, TerminalErrorHandler } from '../utils/feedback';

export class SidebarTerminalProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sidebarTerminal';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _terminalManager: TerminalManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    console.log('🔧 [DEBUG] SidebarTerminalProvider.resolveWebviewView called');
    this._view = webviewView;

    // Enable scripts and set resource roots
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionContext.extensionUri],
    };

    try {
      const html = this._getHtmlForWebview(webviewView.webview);
      console.log('🔧 [DEBUG] Generated HTML length:', html.length);
      console.log('🔧 [DEBUG] Setting webview HTML...');
      webviewView.webview.html = html;
      console.log('✅ [DEBUG] HTML set successfully');
    } catch (error) {
      console.error('❌ [ERROR] Failed to generate HTML for webview:', error);
      void vscode.window.showErrorMessage(`Failed to generate webview HTML: ${String(error)}`);
      return;
    }

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      async (message: VsCodeMessage) => {
        console.log('📨 [DEBUG] Received message from webview:', message.command, message);
        await this._handleWebviewMessage(message);
      },
      null,
      this._extensionContext.subscriptions
    );

    // Set up terminal event listeners
    this._setupTerminalEventListeners();

    // Do not force initial terminal creation here
    // Let _initializeTerminal handle it when webview is ready

    console.log('✅ [DEBUG] WebviewView setup completed');
  }

  public createNewTerminal(): string {
    console.log('🔧 [DEBUG] Creating new terminal...');
    try {
      const terminalId = this._terminalManager.createTerminal();
      console.log('✅ [DEBUG] New terminal created with ID:', terminalId);
      showSuccess('Terminal created successfully');
      return terminalId;
    } catch (error) {
      console.error('❌ [ERROR] Failed to create new terminal:', error);
      TerminalErrorHandler.handleTerminalCreationError(error);
      throw error;
    }
  }

  public splitTerminal(): void {
    console.log('🔧 [DEBUG] Splitting terminal...');
    try {
      // First send the SPLIT command to prepare the UI
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.SPLIT,
      });

      // Then create a new terminal which will be used as secondary
      const terminalId = this._terminalManager.createTerminal();
      console.log('✅ [DEBUG] Split terminal created with ID:', terminalId);

      // The terminal creation event will send TERMINAL_CREATED to webview
    } catch (error) {
      console.error('❌ [ERROR] Failed to split terminal:', error);
      void vscode.window.showErrorMessage(`Failed to split terminal: ${String(error)}`);
    }
  }

  public openSettings(): void {
    console.log('⚙️ [DEBUG] Opening settings...');
    try {
      // Send message to webview to open settings panel
      void this._sendMessage({
        command: 'openSettings',
      });
      console.log('✅ [DEBUG] Settings open command sent');
    } catch (error) {
      console.error('❌ [ERROR] Failed to open settings:', error);
      void vscode.window.showErrorMessage(`Failed to open settings: ${String(error)}`);
    }
  }

  public clearTerminal(): void {
    console.log('🔧 [DEBUG] Clearing terminal...');
    try {
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.CLEAR,
      });
      console.log('✅ [DEBUG] Clear command sent');
      showSuccess('Terminal cleared');
    } catch (error) {
      console.error('❌ [ERROR] Failed to clear terminal:', error);
      showError(`Failed to clear terminal: ${String(error)}`);
    }
  }

  public killTerminal(): void {
    console.log('🔧 [DEBUG] Killing terminal...');
    try {
      const activeTerminalId = this._terminalManager.getActiveTerminalId();
      if (activeTerminalId) {
        console.log('🔧 [DEBUG] Killing active terminal:', activeTerminalId);
        this._terminalManager.killTerminal(activeTerminalId);
        console.log('✅ [DEBUG] Terminal killed successfully');
        showSuccess('Terminal closed');
      } else {
        console.warn('⚠️ [WARN] No active terminal to kill');
        TerminalErrorHandler.handleTerminalNotFound();
      }
    } catch (error) {
      console.error('❌ [ERROR] Failed to kill terminal:', error);
      showError(`Failed to close terminal: ${String(error)}`);
    }
  }

  public async _initializeTerminal(): Promise<void> {
    console.log('🔧 [DEBUG] Initializing terminal...');
    console.log('🔧 [DEBUG] Terminal manager available:', !!this._terminalManager);
    console.log('🔧 [DEBUG] Webview available:', !!this._view);

    try {
      // Check if we have an active terminal
      const hasActive = this._terminalManager.hasActiveTerminal();
      console.log('🔧 [DEBUG] Has active terminal:', hasActive);

      let terminalId: string;
      if (!hasActive) {
        console.log('🔧 [DEBUG] No active terminal, creating new one...');
        try {
          terminalId = this._terminalManager.createTerminal();
          console.log('🔧 [DEBUG] New terminal created with ID:', terminalId);
        } catch (createError) {
          console.error('❌ [ERROR] Failed to create terminal:', createError);
          throw new Error(`Failed to create terminal: ${String(createError)}`);
        }
      } else {
        terminalId = this._terminalManager.getActiveTerminalId() || '';
        console.log('🔧 [DEBUG] Using existing active terminal:', terminalId);
      }

      if (!terminalId) {
        throw new Error('Failed to get or create terminal ID');
      }

      const config = getTerminalConfig();
      const terminals = this._terminalManager.getTerminals();

      console.log('🔧 [DEBUG] Terminal config:', config);
      console.log('🔧 [DEBUG] Available terminals:', terminals.length);
      console.log('🔧 [DEBUG] Active terminal ID:', terminalId);

      const initMessage = {
        command: TERMINAL_CONSTANTS.COMMANDS.INIT,
        config,
        terminals: terminals.map(normalizeTerminalInfo),
        activeTerminalId: terminalId,
      };

      console.log(
        '🔧 [DEBUG] Sending init message to webview:',
        JSON.stringify(initMessage, null, 2)
      );
      try {
        await this._sendMessage(initMessage);
        console.log('✅ [DEBUG] INIT message sent successfully');
      } catch (sendError) {
        console.error('❌ [ERROR] Failed to send INIT message:', sendError);
        throw new Error(`Failed to send INIT message: ${String(sendError)}`);
      }
      console.log('✅ [DEBUG] Terminal initialization completed successfully');
    } catch (error) {
      console.error('❌ [ERROR] Failed to initialize terminal:', error);
      void vscode.window.showErrorMessage(`Failed to initialize terminal: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Webviewメッセージを処理する
   */
  private async _handleWebviewMessage(message: VsCodeMessage): Promise<void> {
    console.log('📨 [DEBUG] Handling webview message:', message.command);
    console.log('📨 [DEBUG] Full message object:', JSON.stringify(message, null, 2));

    try {
      switch (message.command) {
        case TERMINAL_CONSTANTS.COMMANDS.READY:
          console.log('✅ [DEBUG] Webview is ready, initializing terminal...');
          try {
            await this._initializeTerminal();
            console.log('✅ [DEBUG] Terminal initialization completed in message handler');
          } catch (initError) {
            console.error(
              '❌ [ERROR] Terminal initialization failed in message handler:',
              initError
            );
            void vscode.window.showErrorMessage(
              `Terminal initialization failed: ${String(initError)}`
            );
          }
          break;
        case TERMINAL_CONSTANTS.COMMANDS.INPUT:
          if (message.data) {
            console.log(
              '⌨️ [DEBUG] Terminal input:',
              message.data.length,
              'chars, data:',
              JSON.stringify(message.data),
              'terminalId:',
              message.terminalId
            );
            this._terminalManager.sendInput(message.data, message.terminalId);
          }
          break;
        case TERMINAL_CONSTANTS.COMMANDS.RESIZE:
          if (message.cols && message.rows) {
            console.log('📏 [DEBUG] Terminal resize:', message.cols, 'x', message.rows);
            this._terminalManager.resize(message.cols, message.rows, message.terminalId);
          }
          break;
        case TERMINAL_CONSTANTS.COMMANDS.SWITCH_TERMINAL:
          if (message.terminalId) {
            console.log('🔄 [DEBUG] Switching to terminal:', message.terminalId);
            this._terminalManager.setActiveTerminal(message.terminalId);
          }
          break;
        case 'createTerminal': {
          console.log('🆕 [DEBUG] Creating new terminal from webview...');
          const newTerminalId = this.createNewTerminal();
          console.log('🆕 [DEBUG] New terminal created with ID:', newTerminalId);
          // Re-initialize to show the new terminal
          await this._initializeTerminal();
          break;
        }
        case 'splitTerminal':
          console.log('🔀 [DEBUG] Splitting terminal from webview...');
          this.splitTerminal();
          break;
        case 'clear': {
          console.log('🧹 [DEBUG] Clear command from webview...');
          // Send clear command to webview (for visual clear)
          await this._sendMessage({
            command: TERMINAL_CONSTANTS.COMMANDS.CLEAR,
          });
          // Also send Ctrl+L to the actual terminal process
          const activeId = this._terminalManager.getActiveTerminalId();
          if (activeId) {
            console.log('🧹 [DEBUG] Sending Ctrl+L to terminal:', activeId);
            this._terminalManager.sendInput('\x0c', activeId);
          } else {
            console.warn('⚠️ [WARN] No active terminal to clear');
          }
          break;
        }
        case 'getSettings': {
          console.log('⚙️ [DEBUG] Getting settings from webview...');
          const settings = this.getCurrentSettings();
          await this._sendMessage({
            command: 'settingsResponse',
            settings,
          });
          break;
        }
        case 'updateSettings': {
          console.log('⚙️ [DEBUG] Updating settings from webview:', message.settings);
          if (message.settings) {
            await this.updateSettings(message.settings);
          }
          break;
        }
        default:
          console.warn('⚠️ [WARN] Unknown command received:', message.command);
      }
    } catch (error) {
      console.error('❌ [ERROR] Failed to handle webview message:', error);
      void vscode.window.showErrorMessage(`Failed to handle webview message: ${String(error)}`);
    }
  }

  /**
   * ターミナルイベントリスナーを設定する
   */
  private _setupTerminalEventListeners(): void {
    // Handle terminal output
    this._terminalManager.onData((event) => {
      if (event.data) {
        console.log(
          '📤 [DEBUG] Terminal output received:',
          event.data.length,
          'chars, terminalId:',
          event.terminalId
        );
        void this._sendMessage({
          command: TERMINAL_CONSTANTS.COMMANDS.OUTPUT,
          data: event.data,
          terminalId: event.terminalId,
        });
      }
    });

    // Handle terminal exit
    this._terminalManager.onExit((event) => {
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.EXIT,
        exitCode: event.exitCode,
        terminalId: event.terminalId,
      });
    });

    // Handle terminal creation
    this._terminalManager.onTerminalCreated((terminal) => {
      console.log('🆕 [DEBUG] Terminal created:', terminal.id, terminal.name);
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED,
        terminalId: terminal.id,
        terminalName: terminal.name,
        config: getTerminalConfig(),
      });
    });

    // Handle terminal removal
    this._terminalManager.onTerminalRemoved((terminalId) => {
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_REMOVED,
        terminalId,
      });
    });
  }

  /**
   * Webviewにメッセージを送信する
   */
  private async _sendMessage(message: WebviewMessage): Promise<void> {
    if (!this._view) {
      console.warn('⚠️ [WARN] No webview available to send message');
      return;
    }

    try {
      console.log('📤 [DEBUG] Sending message to webview:', message.command);
      await this._view.webview.postMessage(message);
    } catch (error) {
      console.error('❌ [ERROR] Failed to send message to webview:', error);
      void vscode.window.showErrorMessage(`Failed to send message to webview: ${String(error)}`);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    console.log('🔧 [DEBUG] Generating HTML for webview...');

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionContext.extensionUri, 'dist', 'webview.js')
    );

    const xtermCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionContext.extensionUri,
        'node_modules',
        'xterm',
        'css',
        'xterm.css'
      )
    );

    const nonce = generateNonce();

    console.log('🔧 [DEBUG] Script URI:', scriptUri.toString());
    console.log('🔧 [DEBUG] XTerm CSS URI:', xtermCssUri.toString());
    console.log('🔧 [DEBUG] CSP nonce:', nonce);

    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${
          webview.cspSource
        } 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
        <link href="${xtermCssUri.toString()}" rel="stylesheet">
        <style>
            body {
                margin: 0;
                padding: 0;
                overflow: hidden;
                background-color: var(--vscode-editor-background, #1e1e1e);
                color: var(--vscode-foreground, #cccccc);
                font-family: var(--vscode-font-family, monospace);
            }
            
            /* Split layout container */
            .terminal-layout {
                width: 100%;
                height: 100vh;
                display: flex;
                flex-direction: column;
                position: relative;
            }
            
            /* Split panes container */
            .split-container {
                flex: 1;
                display: flex;
                position: relative;
            }
            
            .split-container.horizontal {
                flex-direction: row;
            }
            
            .split-container.vertical {
                flex-direction: column;
            }
            
            /* Terminal panes */
            .terminal-pane {
                position: relative;
                background: #000;
                min-width: 200px;
                min-height: 100px;
                display: flex;
                flex-direction: column;
            }
            
            .terminal-pane.single {
                flex: 1;
            }
            
            .terminal-pane.split {
                flex: 1;
            }
            
            /* Resize splitter */
            .splitter {
                background: var(--vscode-widget-border, #454545);
                position: relative;
                z-index: 10;
            }
            
            .splitter.horizontal {
                width: 4px;
                cursor: col-resize;
                min-width: 4px;
            }
            
            .splitter.vertical {
                height: 4px;
                cursor: row-resize;
                min-height: 4px;
            }
            
            .splitter:hover {
                background: var(--vscode-focusBorder, #007acc);
            }
            
            .splitter.dragging {
                background: var(--vscode-focusBorder, #007acc);
            }
            
            /* Terminal containers */
            #terminal {
                width: 100%;
                height: 100%;
                position: relative;
            }
            
            .secondary-terminal {
                width: 100%;
                height: 100%;
                position: relative;
            }
            
            /* Split controls */
            .split-controls {
                position: absolute;
                top: 5px;
                right: 5px;
                z-index: 1000;
                display: flex;
                gap: 4px;
            }
            
            .split-btn {
                background: rgba(0, 0, 0, 0.7);
                color: var(--vscode-foreground, #cccccc);
                border: 1px solid var(--vscode-widget-border, #454545);
                border-radius: 3px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
                user-select: none;
            }
            
            .split-btn:hover {
                background: rgba(0, 0, 0, 0.9);
                border-color: var(--vscode-focusBorder, #007acc);
            }
            
            .split-btn.active {
                background: var(--vscode-button-background, #0e639c);
                border-color: var(--vscode-button-background, #0e639c);
            }
            
            .status {
                position: absolute;
                top: 5px;
                left: 5px;
                z-index: 1000;
                color: #00ff00;
                font-size: 11px;
                font-family: monospace;
                background: rgba(0, 0, 0, 0.8);
                padding: 2px 6px;
                border-radius: 3px;
                max-width: 300px;
                word-break: break-all;
            }
            
            .loading {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                color: var(--vscode-foreground, #cccccc);
                font-family: var(--vscode-font-family, monospace);
                background: var(--vscode-editor-background, #1e1e1e);
            }
        </style>
    </head>
    <body>
        <div class="status" id="status">Initializing...</div>
        <div id="terminal" style="position: absolute; top: 30px; left: 0; right: 0; bottom: 0; background: #000;">
            <!-- Simple terminal container -->
        </div>
        <script nonce="${nonce}">
            console.log('🎯 [WEBVIEW] Script loaded');
            document.getElementById('status').textContent = 'Script loaded';
        </script>
        <script nonce="${nonce}" src="${scriptUri.toString()}"></script>
    </body>
    </html>`;

    console.log('✅ [DEBUG] HTML generation completed');
    return html;
  }

  private getCurrentSettings(): {
    fontSize: number;
    fontFamily: string;
    cursorBlink: boolean;
    theme: string;
  } {
    const config = vscode.workspace.getConfiguration('sidebarTerminal');

    return {
      fontSize: config.get<number>('fontSize') ?? 14,
      fontFamily: config.get<string>('fontFamily') ?? 'Consolas, monospace',
      cursorBlink: config.get<boolean>('cursorBlink') ?? true,
      theme: config.get<string>('theme') ?? 'auto',
    };
  }

  private async updateSettings(settings: {
    fontSize: number;
    fontFamily: string;
    theme?: string;
    cursorBlink: boolean;
  }): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('sidebarTerminal');

      // Update VS Code settings
      await config.update('fontSize', settings.fontSize, vscode.ConfigurationTarget.Global);
      await config.update('fontFamily', settings.fontFamily, vscode.ConfigurationTarget.Global);
      await config.update('cursorBlink', settings.cursorBlink, vscode.ConfigurationTarget.Global);
      if (settings.theme) {
        await config.update('theme', settings.theme, vscode.ConfigurationTarget.Global);
      }

      console.log('✅ [DEBUG] Settings updated successfully');
      showSuccess('Settings updated successfully');

      // Reinitialize terminal with new settings to apply changes
      await this._initializeTerminal();
    } catch (error) {
      console.error('❌ [ERROR] Failed to update settings:', error);
      showError(`Failed to update settings: ${String(error)}`);
    }
  }
}
