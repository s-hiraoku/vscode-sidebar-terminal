import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { VsCodeMessage, WebviewMessage } from '../types/common';
import { TERMINAL_CONSTANTS } from '../constants';
import { getTerminalConfig, generateNonce, normalizeTerminalInfo } from '../utils/common';

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
      return terminalId;
    } catch (error) {
      console.error('❌ [ERROR] Failed to create new terminal:', error);
      void vscode.window.showErrorMessage(`Failed to create new terminal: ${String(error)}`);
      throw error;
    }
  }

  public splitTerminal(): void {
    console.log('🔧 [DEBUG] Splitting terminal...');
    try {
      const terminalId = this._terminalManager.createTerminal();
      console.log('✅ [DEBUG] Split terminal created with ID:', terminalId);
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.SPLIT,
        terminalId,
      });
    } catch (error) {
      console.error('❌ [ERROR] Failed to split terminal:', error);
      void vscode.window.showErrorMessage(`Failed to split terminal: ${String(error)}`);
    }
  }

  public clearTerminal(): void {
    console.log('🔧 [DEBUG] Clearing terminal...');
    try {
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.CLEAR,
      });
      console.log('✅ [DEBUG] Clear command sent');
    } catch (error) {
      console.error('❌ [ERROR] Failed to clear terminal:', error);
      void vscode.window.showErrorMessage(`Failed to clear terminal: ${String(error)}`);
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
      } else {
        console.warn('⚠️ [WARN] No active terminal to kill');
        void vscode.window.showWarningMessage('No active terminal to kill');
      }
    } catch (error) {
      console.error('❌ [ERROR] Failed to kill terminal:', error);
      void vscode.window.showErrorMessage(`Failed to kill terminal: ${String(error)}`);
    }
  }

  public async _initializeTerminal(): Promise<void> {
    console.log('🔧 [DEBUG] Initializing terminal...');

    try {
      // Ensure we have an active terminal
      let terminalId: string;
      if (!this._terminalManager.hasActiveTerminal()) {
        console.log('🔧 [DEBUG] No active terminal, creating new one...');
        terminalId = this._terminalManager.createTerminal();
        console.log('🔧 [DEBUG] New terminal created with ID:', terminalId);
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

      console.log('🔧 [DEBUG] Sending init message to webview:', initMessage);
      await this._sendMessage(initMessage);
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

    try {
      switch (message.command) {
        case TERMINAL_CONSTANTS.COMMANDS.READY:
          console.log('✅ [DEBUG] Webview is ready, initializing terminal...');
          await this._initializeTerminal();
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
            #terminal {
                width: 100%;
                height: 100vh;
                position: relative;
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
}
