import * as vscode from 'vscode';
import { DisposableStore } from '../utils/DisposableStore';
import { provider as log, isDebugEnabled } from '../utils/logger';

export interface FocusProtectionDependencies {
  isTerminalFocused: () => boolean;
  isWebViewVisible: () => boolean;
  /**
   * Optional: send a focus command to the webview after executing the
   * view-focus command. Mirrors the two-step sequence used by
   * KeyboardShortcutService.focusTerminal() so that xterm.js regains DOM focus.
   */
  sendWebviewFocus?: () => void;
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
 *
 * The window is also refreshed by notifyInteraction() whenever the user
 * actively interacts with the terminal (keystrokes), so that long typing
 * sessions don't let _lastFocusedTime go stale and defeat protection.
 */
export class FocusProtectionService implements vscode.Disposable {
  private static readonly RESTORE_DELAY_MS = 150;
  private static readonly COOLDOWN_MS = 500;
  private static readonly RECENT_FOCUS_WINDOW_MS = 600;

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

    // Diagnostic: log when a new integrated terminal is opened. Helps
    // correlate which extension created a terminal just before an
    // onDidChangeActiveTerminal event steals focus from the sidebar.
    this._disposables.add(
      vscode.window.onDidOpenTerminal((terminal) => {
        if (!isDebugEnabled()) return;
        log('🔍 [FOCUS_PROTECTION] onDidOpenTerminal fired:', this._describeTerminal(terminal));
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

  /**
   * Called by the extension on user interaction (keystrokes / input) with the
   * sidebar terminal. Refreshes the recent-focus window so that long typing
   * sessions do not let the window expire while the user is actively working.
   *
   * Only refreshes when the WebView is visible, to avoid false positives from
   * buffered messages arriving after the view has been hidden.
   */
  public notifyInteraction(): void {
    if (!this._deps.isWebViewVisible()) return;
    this._lastFocusedTime = Date.now();
  }

  private _readSetting(): boolean {
    return vscode.workspace.getConfiguration('secondaryTerminal').get('focusProtection', true);
  }

  private _hadRecentFocus(): boolean {
    if (this._deps.isTerminalFocused()) return true;
    return Date.now() - this._lastFocusedTime < FocusProtectionService.RECENT_FOCUS_WINDOW_MS;
  }

  /**
   * Best-effort fingerprint of a vscode.Terminal so we can log who activated it.
   *
   * VS Code does not expose which extension created a terminal, but
   * `creationOptions` usually contains enough (name, shellPath, env, iconPath,
   * and for ExtensionTerminalOptions the custom `pty` flag) to identify the
   * culprit by pattern matching against known extensions.
   */
  private _describeTerminal(terminal: vscode.Terminal): Record<string, unknown> {
    // Fire-and-forget async resolution of processId. The error handler swallows
    // rejections so a pending pty that never resolves never becomes an unhandled
    // rejection.
    Promise.resolve(terminal.processId).then(
      (pid) =>
        log('🔍 [FOCUS_PROTECTION] terminal processId resolved:', {
          name: terminal.name,
          pid,
        }),
      () => undefined
    );

    const info: Record<string, unknown> = {
      name: terminal.name,
      state: terminal.state,
    };

    const opts = terminal.creationOptions as
      | vscode.TerminalOptions
      | vscode.ExtensionTerminalOptions
      | undefined;
    if (opts) {
      const terminalOpts = opts as vscode.TerminalOptions;
      const extOpts = opts as vscode.ExtensionTerminalOptions;
      const cwd = terminalOpts.cwd;
      info.creationOptions = {
        name: terminalOpts.name,
        shellPath: terminalOpts.shellPath,
        shellArgs: terminalOpts.shellArgs,
        cwd: typeof cwd === 'string' ? cwd : cwd?.fsPath,
        hasPty: Boolean(extOpts.pty),
        iconPath: this._describeIcon(terminalOpts.iconPath),
        envKeys: terminalOpts.env ? Object.keys(terminalOpts.env) : undefined,
        isTransient: terminalOpts.isTransient,
        hideFromUser: terminalOpts.hideFromUser,
      };
    }
    return info;
  }

  private _describeIcon(icon: unknown): string | undefined {
    if (!icon) return undefined;
    if (typeof icon === 'string') return icon;
    if (icon instanceof vscode.ThemeIcon) return `ThemeIcon(${icon.id})`;
    if ((icon as vscode.Uri).fsPath) return (icon as vscode.Uri).fsPath;
    return undefined;
  }

  private _onActiveTerminalChanged(terminal: vscode.Terminal | undefined): void {
    // Diagnostic: log who just became the active integrated terminal so users
    // can identify which external extension is stealing focus. Guarded by
    // isDebugEnabled() to avoid the describe-cost in production.
    if (isDebugEnabled()) {
      if (terminal) {
        log(
          '🔍 [FOCUS_PROTECTION] onDidChangeActiveTerminal fired:',
          this._describeTerminal(terminal)
        );
      } else {
        log('🔍 [FOCUS_PROTECTION] onDidChangeActiveTerminal fired: undefined');
      }
    }

    if (!this._enabled) {
      log('🛡️ [FOCUS_PROTECTION] skip: disabled');
      return;
    }
    if (!terminal) {
      log('🛡️ [FOCUS_PROTECTION] skip: active terminal is undefined');
      return;
    }
    if (!this._deps.isWebViewVisible()) {
      log('🛡️ [FOCUS_PROTECTION] skip: webview not visible');
      return;
    }
    if (!this._hadRecentFocus()) {
      log('🛡️ [FOCUS_PROTECTION] skip: no recent focus');
      return;
    }

    if (this._pendingTimer !== undefined) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = undefined;
    }

    const now = Date.now();
    if (now - this._lastRestoreTime < FocusProtectionService.COOLDOWN_MS) {
      log('🛡️ [FOCUS_PROTECTION] skip: cooldown active');
      return;
    }

    log('🛡️ [FOCUS_PROTECTION] scheduling focus restoration');
    this._pendingTimer = setTimeout(() => {
      this._pendingTimer = undefined;
      this._lastRestoreTime = Date.now();
      // Use the VS Code auto-generated view focus command: `${viewId}.focus`.
      // The view id is `secondaryTerminal` (see package.json contributes.views).
      // Mirrors the working sequence in KeyboardShortcutService.focusTerminal().
      void vscode.commands.executeCommand('secondaryTerminal.focus');
      // Then ask the webview to push DOM focus back into xterm.js.
      try {
        this._deps.sendWebviewFocus?.();
      } catch (err) {
        log('🛡️ [FOCUS_PROTECTION] sendWebviewFocus failed:', err);
      }
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
