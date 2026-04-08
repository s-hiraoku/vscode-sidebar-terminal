import * as vscode from 'vscode';
import { DisposableStore } from '../utils/DisposableStore';

export interface FocusProtectionDependencies {
  isTerminalFocused: () => boolean;
  isWebViewVisible: () => boolean;
}

/**
 * Protects sidebar terminal focus from being stolen by other extensions.
 *
 * When enabled, monitors VS Code's active terminal changes. If the sidebar
 * terminal recently had focus and a standard terminal becomes active (e.g.
 * via another extension calling terminal.show()), this service automatically
 * restores focus to the sidebar terminal after a short delay.
 *
 * Guard logic: requires WebView visible AND (terminal currently focused OR
 * was focused within RECENT_FOCUS_WINDOW_MS). The window accounts for the
 * race where terminalBlurred arrives via the WebView bridge before
 * onDidChangeActiveTerminal fires.
 */
export class FocusProtectionService implements vscode.Disposable {
  private static readonly RESTORE_DELAY_MS = 150;
  private static readonly COOLDOWN_MS = 500;
  private static readonly RECENT_FOCUS_WINDOW_MS = 300;

  private readonly _disposables = new DisposableStore();
  private readonly _deps: FocusProtectionDependencies;
  private _enabled: boolean;
  private _pendingTimer: ReturnType<typeof setTimeout> | undefined;
  private _lastRestoreTime = 0;
  private _lastFocusedTime = 0;

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

  /**
   * Called by the extension when sidebar terminal focus state changes.
   * Tracks the last time the sidebar terminal had focus.
   */
  public notifyFocusChanged(focused: boolean): void {
    if (focused) {
      this._lastFocusedTime = Date.now();
    }
  }

  private _readSetting(): boolean {
    return vscode.workspace.getConfiguration('secondaryTerminal').get('focusProtection', true);
  }

  private _hadRecentFocus(): boolean {
    if (this._deps.isTerminalFocused()) return true;
    return Date.now() - this._lastFocusedTime < FocusProtectionService.RECENT_FOCUS_WINDOW_MS;
  }

  private _onActiveTerminalChanged(terminal: vscode.Terminal | undefined): void {
    if (!this._enabled) return;
    if (!terminal) return;
    if (!this._deps.isWebViewVisible()) return;
    if (!this._hadRecentFocus()) return;

    if (this._pendingTimer !== undefined) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = undefined;
    }

    const now = Date.now();
    if (now - this._lastRestoreTime < FocusProtectionService.COOLDOWN_MS) return;

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
