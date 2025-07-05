import * as vscode from 'vscode';
import * as pty from 'node-pty';
import * as os from 'os';

interface TerminalInstance {
  id: string;
  pty: pty.IPty;
  name: string;
  isActive: boolean;
}

export class TerminalManager {
  private _terminals = new Map<string, TerminalInstance>();
  private _activeTerminalId?: string;
  private _dataEmitter = new vscode.EventEmitter<{terminalId: string; data: string}>();
  private _exitEmitter = new vscode.EventEmitter<{terminalId: string; exitCode: number | undefined}>();
  private _terminalCreatedEmitter = new vscode.EventEmitter<TerminalInstance>();
  private _terminalRemovedEmitter = new vscode.EventEmitter<string>();

  public readonly onData = this._dataEmitter.event;
  public readonly onExit = this._exitEmitter.event;
  public readonly onTerminalCreated = this._terminalCreatedEmitter.event;
  public readonly onTerminalRemoved = this._terminalRemovedEmitter.event;

  constructor(private readonly _context: vscode.ExtensionContext) {
    // Context may be used in future for storing state
  }

  public createTerminal(): void {
    this.killTerminal();

    const config = vscode.workspace.getConfiguration('sidebarTerminal');
    const shell = this._getShell(config);
    const shellArgs = config.get<string[]>('shellArgs', []);
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || os.homedir();

    try {
      this._terminal = pty.spawn(shell, shellArgs, {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd,
        env: process.env as { [key: string]: string },
      });

      this._terminal.onData((data) => {
        this._dataEmitter.fire(data);
      });

      this._terminal.onExit((exitCode) => {
        this._exitEmitter.fire(exitCode.exitCode);
        this._terminal = undefined;
      });
    } catch (error) {
      void vscode.window.showErrorMessage(`Failed to create terminal: ${String(error)}`);
      throw error;
    }
  }

  public sendInput(data: string): void {
    this._terminal?.write(data);
  }

  public resize(cols: number, rows: number): void {
    this._terminal?.resize(cols, rows);
  }

  public killTerminal(): void {
    if (this._terminal) {
      this._terminal.kill();
      this._terminal = undefined;
    }
  }

  public hasActiveTerminal(): boolean {
    return this._terminal !== undefined;
  }

  public dispose(): void {
    this.killTerminal();
    this._dataEmitter.dispose();
    this._exitEmitter.dispose();
  }

  private _getShell(config: vscode.WorkspaceConfiguration): string {
    const customShell = config.get<string>('shell', '');
    if (customShell) {
      return customShell;
    }

    // Use VS Code's integrated terminal shell settings as fallback
    const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');

    if (process.platform === 'win32') {
      return terminalConfig.get<string>('shell.windows') || process.env['COMSPEC'] || 'cmd.exe';
    } else if (process.platform === 'darwin') {
      return terminalConfig.get<string>('shell.osx') || process.env['SHELL'] || '/bin/zsh';
    } else {
      return terminalConfig.get<string>('shell.linux') || process.env['SHELL'] || '/bin/bash';
    }
  }
}
