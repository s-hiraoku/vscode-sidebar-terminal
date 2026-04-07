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
 * restores focus to the sidebar terminal after a short delay.
 *
 * The delay (100ms) ensures the focus command runs after VS Code's
 * showPanel() completes, preventing the panel from re-stealing focus.
 * A cooldown (500ms) prevents rapid oscillation.
 */
export class FocusProtectionService implements vscode.Disposable {
  private static readonly RESTORE_DELAY_MS = 100;
  private static readonly COOLDOWN_MS = 500;

  private readonly _disposables = new DisposableStore();
  private readonly _deps: FocusProtectionDependencies;
  private _enabled: boolean;
  private _pendingTimer: ReturnType<typeof setTimeout> | undefined;
  private _lastRestoreTime = 0;

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

    // Cancel any pending restore to debounce rapid events
    if (this._pendingTimer !== undefined) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = undefined;
    }

    // Skip if within cooldown period
    const now = Date.now();
    if (now - this._lastRestoreTime < FocusProtectionService.COOLDOWN_MS) return;

    // Delay restoration so it runs after VS Code's showPanel() completes
    this._pendingTimer = setTimeout(() => {
      this._pendingTimer = undefined;
      this._lastRestoreTime = Date.now();
      void vscode.commands.executeCommand('secondaryTerminalContainer.secondaryTerminal.focus');
    }, FocusProtectionService.RESTORE_DELAY_MS);
  }

  public dispose(): void {
    if (this._pendingTimer !== undefined) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = undefined;
    }
    this._disposables.dispose();
  }
}
