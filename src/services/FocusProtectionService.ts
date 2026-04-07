import * as vscode from 'vscode';
import { DisposableStore } from '../utils/DisposableStore';

export interface FocusProtectionDependencies {
  isTerminalFocused: () => boolean;
}

/**
 * Protects sidebar terminal focus from being stolen by other extensions.
 *
 * When enabled, monitors VS Code's active terminal changes. If the sidebar
 * terminal had focus and a standard terminal becomes active (e.g. via
 * another extension calling terminal.show()), this service automatically
 * restores focus to the sidebar terminal.
 */
export class FocusProtectionService implements vscode.Disposable {
  private readonly _disposables = new DisposableStore();
  private readonly _deps: FocusProtectionDependencies;
  private _enabled: boolean;

  constructor(deps: FocusProtectionDependencies) {
    this._deps = deps;
    this._enabled = this._readSetting();

    this._disposables.add(
      vscode.window.onDidChangeActiveTerminal((terminal) => {
        this._onActiveTerminalChanged(terminal);
      })
    );

    this._disposables.add(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('secondaryTerminal.focusProtection')) {
          this._enabled = this._readSetting();
        }
      })
    );
  }

  private _readSetting(): boolean {
    return vscode.workspace.getConfiguration('secondaryTerminal').get('focusProtection', true);
  }

  private _onActiveTerminalChanged(terminal: vscode.Terminal | undefined): void {
    if (!this._enabled) return;
    if (!terminal) return;
    if (!this._deps.isTerminalFocused()) return;

    void vscode.commands.executeCommand('secondaryTerminalContainer.secondaryTerminal.focus');
  }

  public dispose(): void {
    this._disposables.dispose();
  }
}
