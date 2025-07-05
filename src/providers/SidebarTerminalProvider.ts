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
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionContext.extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      async (message: VsCodeMessage) => {
        await this._handleWebviewMessage(message);
      },
      null,
      this._extensionContext.subscriptions
    );

    // Set up terminal event listeners
    this._setupTerminalEventListeners();
  }

  public createNewTerminal(): void {
    this._terminalManager.createTerminal();
    void this._initializeTerminal();
  }

  public splitTerminal(): void {
    const terminalId = this._terminalManager.createTerminal();
    void this._sendMessage({
      command: TERMINAL_CONSTANTS.COMMANDS.SPLIT,
      terminalId,
    });
  }

  public clearTerminal(): void {
    void this._sendMessage({
      command: TERMINAL_CONSTANTS.COMMANDS.CLEAR,
    });
  }

  public killTerminal(): void {
    const activeTerminalId = this._terminalManager.getActiveTerminalId();
    if (activeTerminalId) {
      this._terminalManager.killTerminal(activeTerminalId);
    }
  }

  private async _initializeTerminal(): Promise<void> {
    if (!this._terminalManager.hasActiveTerminal()) {
      this._terminalManager.createTerminal();
    }

    const config = getTerminalConfig();
    const terminals = this._terminalManager.getTerminals();
    await this._sendMessage({
      command: TERMINAL_CONSTANTS.COMMANDS.INIT,
      config,
      terminals: terminals.map(normalizeTerminalInfo),
    });
  }

  /**
   * Webviewメッセージを処理する
   */
  private async _handleWebviewMessage(message: VsCodeMessage): Promise<void> {
    switch (message.command) {
      case TERMINAL_CONSTANTS.COMMANDS.READY:
        await this._initializeTerminal();
        break;
      case TERMINAL_CONSTANTS.COMMANDS.INPUT:
        if (message.data) {
          this._terminalManager.sendInput(message.data, message.terminalId);
        }
        break;
      case TERMINAL_CONSTANTS.COMMANDS.RESIZE:
        if (message.cols && message.rows) {
          this._terminalManager.resize(message.cols, message.rows, message.terminalId);
        }
        break;
      case TERMINAL_CONSTANTS.COMMANDS.SWITCH_TERMINAL:
        if (message.terminalId) {
          this._terminalManager.setActiveTerminal(message.terminalId);
        }
        break;
    }
  }

  /**
   * ターミナルイベントリスナーを設定する
   */
  private _setupTerminalEventListeners(): void {
    // Handle terminal output
    this._terminalManager.onData((event) => {
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.OUTPUT,
        data: event.data,
        terminalId: event.terminalId,
      });
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
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED,
        terminalId: terminal.id,
        terminalName: terminal.name,
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
    await this._view?.webview.postMessage(message);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
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

    return `<!DOCTYPE html>
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
            }
            #terminal {
                width: 100vw;
                height: 100vh;
            }
        </style>
    </head>
    <body>
        <div id="terminal"></div>
        <script nonce="${nonce}" src="${scriptUri.toString()}"></script>
    </body>
    </html>`;
  }
}