import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';

interface WebviewMessage {
  command: 'ready' | 'input' | 'resize';
  data?: string;
  cols?: number;
  rows?: number;
}

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
      async (message: WebviewMessage) => {
        switch (message.command) {
          case 'ready':
            await this._initializeTerminal();
            break;
          case 'input':
            if (message.data) {
              this._terminalManager.sendInput(message.data);
            }
            break;
          case 'resize':
            if (message.cols && message.rows) {
              this._terminalManager.resize(message.cols, message.rows);
            }
            break;
        }
      },
      null,
      this._extensionContext.subscriptions
    );

    // Handle terminal output
    this._terminalManager.onData((data) => {
      void this._view?.webview.postMessage({
        command: 'output',
        data,
      });
    });

    // Handle terminal exit
    this._terminalManager.onExit((exitCode) => {
      void this._view?.webview.postMessage({
        command: 'exit',
        exitCode,
      });
    });
  }

  public createNewTerminal(): void {
    this._terminalManager.createTerminal();
    void this._initializeTerminal();
  }

  public clearTerminal(): void {
    void this._view?.webview.postMessage({
      command: 'clear',
    });
  }

  public killTerminal(): void {
    this._terminalManager.killTerminal();
  }

  private async _initializeTerminal(): Promise<void> {
    if (!this._terminalManager.hasActiveTerminal()) {
      this._terminalManager.createTerminal();
    }

    const config = vscode.workspace.getConfiguration('sidebarTerminal');
    await this._view?.webview.postMessage({
      command: 'init',
      config: {
        fontSize: config.get<number>('fontSize', 14),
        fontFamily: config.get<string>('fontFamily', 'Consolas, "Courier New", monospace'),
      },
    });
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

    const nonce = getNonce();

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

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
