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
   *
   * @param terminalId - The sidebar terminal that should receive focus.
   *   When provided, focus is restored to the specific terminal the user was
   *   interacting with, not just whichever terminal happens to be active.
   */
  sendWebviewFocus?: (terminalId?: string) => void;
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
  private static readonly RECENT_INTERACTION_WINDOW_MS = 200;

  /**
   * When a CLI agent is connected, use a much longer focus window and shorter
   * cooldown. The agent's VS Code extension calls terminal.show() during MCP
   * tool operations which can happen at any time during a long-running task.
   * 10 minutes covers even lengthy code-generation / multi-file edit sessions.
   */
  private static readonly CLI_AGENT_FOCUS_WINDOW_MS = 600_000;
  /** Shorter cooldown because MCP tool calls can steal focus in rapid succession. */
  private static readonly CLI_AGENT_COOLDOWN_MS = 150;

  private readonly _disposables = new DisposableStore();
  private readonly _deps: FocusProtectionDependencies;
  private _enabled: boolean;
  private _cliAgentConnected = false;
  private _pendingTimer: ReturnType<typeof setTimeout> | undefined;
  private _lastRestoreTime = 0;
  private _lastFocusedTime = 0;
  private _lastInteractionTime = 0;
  /** The sidebar terminal that was most recently interacted with. */
  private _lastInteractedTerminalId: string | undefined;

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
      this._clearPendingRestore();
      return;
    }

    if (this._shouldRestoreAfterBlur()) {
      this._scheduleFocusRestore();
    }
  }

  /**
   * Called when a CLI agent (e.g. Claude Code) connects or disconnects in the
   * sidebar terminal. When connected, focus protection becomes more aggressive
   * because the agent's VS Code extension may repeatedly call terminal.show()
   * to steal focus during MCP tool operations.
   */
  public notifyCliAgentConnected(connected: boolean): void {
    this._cliAgentConnected = connected;
  }

  /**
   * Called by the extension on user interaction (keystrokes / input) with the
   * sidebar terminal. Refreshes the recent-focus window so that long typing
   * sessions do not let the window expire while the user is actively working.
   *
   * Only refreshes when the WebView is visible, to avoid false positives from
   * buffered messages arriving after the view has been hidden.
   */
  public notifyInteraction(terminalId?: string): void {
    if (!this._deps.isWebViewVisible()) return;
    const now = Date.now();
    this._lastFocusedTime = now;
    this._lastInteractionTime = now;
    if (terminalId !== undefined) {
      this._lastInteractedTerminalId = terminalId;
    }
  }

  private _readSetting(): boolean {
    return vscode.workspace.getConfiguration('secondaryTerminal').get('focusProtection', true);
  }

  private _hadRecentFocus(): boolean {
    if (this._deps.isTerminalFocused()) return true;
    const window = this._cliAgentConnected
      ? FocusProtectionService.CLI_AGENT_FOCUS_WINDOW_MS
      : FocusProtectionService.RECENT_FOCUS_WINDOW_MS;
    return Date.now() - this._lastFocusedTime < window;
  }

  private _hadRecentInteraction(): boolean {
    return (
      Date.now() - this._lastInteractionTime < FocusProtectionService.RECENT_INTERACTION_WINDOW_MS
    );
  }

  private _shouldRestoreAfterBlur(): boolean {
    if (!this._enabled) return false;
    if (!this._deps.isWebViewVisible()) return false;
    if (this._deps.isTerminalFocused()) return false;
    // When a CLI agent is connected, skip the interaction check — the agent's
    // VS Code extension steals focus during background MCP operations when the
    // user is not actively typing.
    if (!this._cliAgentConnected && !this._hadRecentInteraction()) return false;
    return this._hadRecentFocus();
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

    this._scheduleFocusRestore();
  }

  private _clearPendingRestore(): void {
    if (this._pendingTimer !== undefined) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = undefined;
    }
  }

  private _scheduleFocusRestore(): void {
    this._clearPendingRestore();

    const now = Date.now();
    const cooldown = this._cliAgentConnected
      ? FocusProtectionService.CLI_AGENT_COOLDOWN_MS
      : FocusProtectionService.COOLDOWN_MS;
    if (now - this._lastRestoreTime < cooldown) {
      log('🛡️ [FOCUS_PROTECTION] skip: cooldown active');
      return;
    }

    log('🛡️ [FOCUS_PROTECTION] scheduling focus restoration');
    // Capture the terminal ID at schedule time, not at fire time, because
    // the active terminal may change between scheduling and execution.
    const targetTerminalId = this._lastInteractedTerminalId;
    this._pendingTimer = setTimeout(() => {
      this._pendingTimer = undefined;
      this._lastRestoreTime = Date.now();
      // Use the VS Code auto-generated view focus command: `${viewId}.focus`.
      // The view id is `secondaryTerminal` (see package.json contributes.views).
      // Mirrors the working sequence in KeyboardShortcutService.focusTerminal().
      void vscode.commands.executeCommand('secondaryTerminal.focus');
      // Then ask the webview to push DOM focus back into the specific xterm.js
      // terminal that the user was interacting with.
      try {
        this._deps.sendWebviewFocus?.(targetTerminalId);
      } catch (err) {
        log('🛡️ [FOCUS_PROTECTION] sendWebviewFocus failed:', err);
      }
    }, FocusProtectionService.RESTORE_DELAY_MS);
  }

  public dispose(): void {
    this._clearPendingRestore();
    this._disposables.dispose();
  }
}
