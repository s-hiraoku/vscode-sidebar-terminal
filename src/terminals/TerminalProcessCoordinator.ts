/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as vscode from 'vscode';
import { TerminalInstance, ProcessState } from '../types/shared';
import { showWarningMessage } from '../utils/common';
import { ShellIntegrationService } from '../services/ShellIntegrationService';
import type { IDisposable } from '@homebridge/node-pty-prebuilt-multiarch';

/** Manages PTY process lifecycle and shell integration */
export class TerminalProcessCoordinator {
  private readonly _shellInitialized = new Set<string>();
  private readonly _ptyOutputStarted = new Set<string>();
  private readonly _ptyDataDisposables = new Map<string, vscode.Disposable>();
  private readonly _initialPromptGuards = new Map<string, { dispose: () => void }>();
  private readonly _launchTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly _terminals: Map<string, TerminalInstance>,
    private readonly _shellIntegrationService: ShellIntegrationService | null,
    private readonly _stateUpdateEmitter: vscode.EventEmitter<any>,
    private readonly _bufferDataCallback: (terminalId: string, data: string) => void
  ) {}

  public initializeShellForTerminal(terminalId: string, ptyProcess: any, safeMode: boolean): void {
    if (this._shellInitialized.has(terminalId)) {
      return;
    }

    this._shellInitialized.add(terminalId);

    if (this._shellIntegrationService && !safeMode) {
      const terminal = this._terminals.get(terminalId);
      if (terminal) {
        const shellPath = (terminal.ptyProcess as any)?.spawnfile || '/bin/bash';
        void this._shellIntegrationService
          .injectShellIntegration(terminalId, shellPath, ptyProcess)
          .catch(() => {});
      }
    }

    if (!safeMode) {
      this.ensureInitialPrompt(terminalId, ptyProcess);
    }
  }

  public startPtyOutput(terminalId: string): void {
    if (this._ptyOutputStarted.has(terminalId)) {
      return;
    }

    const terminal = this._terminals.get(terminalId);
    if (!terminal || !terminal.ptyProcess) {
      return;
    }

    this._ptyOutputStarted.add(terminalId);
  }

  public setupTerminalEvents(
    terminal: TerminalInstance,
    onExitCallback: (terminalId: string, exitCode: number) => void
  ): void {
    const { id: terminalId, ptyProcess } = terminal;

    terminal.processState = ProcessState.Launching;
    this.notifyProcessStateChange(terminal, ProcessState.Launching);

    const dataDisposable: IDisposable = (ptyProcess as any).onData((data: string) => {
      if (terminal.processState === ProcessState.Launching) {
        terminal.processState = ProcessState.Running;
        this.notifyProcessStateChange(terminal, ProcessState.Running);
      }

      if (this._shellIntegrationService) {
        try {
          this._shellIntegrationService.processTerminalData(terminalId, data);
        } catch {
          // Shell integration processing failed
        }
      }

      this._bufferDataCallback(terminalId, data);
    });

    this._ptyDataDisposables.set(terminalId, dataDisposable);

    (ptyProcess as any).onExit((event: number | { exitCode: number; signal?: number }) => {
      const exitCode = typeof event === 'number' ? event : event.exitCode;

      if (terminal.processState !== ProcessState.KilledByUser) {
        terminal.processState =
          terminal.processState === ProcessState.Launching
            ? ProcessState.KilledDuringLaunch
            : ProcessState.KilledByProcess;
      }

      this.notifyProcessStateChange(terminal, terminal.processState);
      onExitCallback(terminalId, exitCode);
    });
  }

  public notifyProcessStateChange(terminal: TerminalInstance, newState: ProcessState): void {
    const previousState = terminal.processState;

    this._stateUpdateEmitter.fire({
      type: 'processStateChange',
      terminalId: terminal.id,
      previousState,
      newState,
      timestamp: Date.now(),
    } as any);

    this.handleProcessStateActions(terminal, newState);
  }

  private handleProcessStateActions(terminal: TerminalInstance, newState: ProcessState): void {
    switch (newState) {
      case ProcessState.Launching:
        this.setupLaunchTimeout(terminal);
        break;
      case ProcessState.Running:
        this.clearLaunchTimeout(terminal);
        break;
      case ProcessState.KilledDuringLaunch:
        this.handleLaunchFailure(terminal);
        break;
      case ProcessState.KilledByProcess:
        this.attemptProcessRecovery(terminal);
        break;
    }
  }

  private setupLaunchTimeout(terminal: TerminalInstance): void {
    this.clearLaunchTimeout(terminal);

    const timeoutId = setTimeout(() => {
      this._launchTimeouts.delete(terminal.id);

      if (terminal.processState === ProcessState.Launching) {
        terminal.processState = ProcessState.KilledDuringLaunch;
        this.notifyProcessStateChange(terminal, ProcessState.KilledDuringLaunch);
      }
    }, 10000);

    this._launchTimeouts.set(terminal.id, timeoutId);
  }

  private clearLaunchTimeout(terminal: TerminalInstance): void {
    const timeoutId = this._launchTimeouts.get(terminal.id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this._launchTimeouts.delete(terminal.id);
    }
  }

  private handleLaunchFailure(terminal: TerminalInstance): void {
    showWarningMessage(
      `Terminal ${terminal.name} failed to launch. Check your shell configuration.`
    );
  }

  private attemptProcessRecovery(_terminal: TerminalInstance): void {
    // Placeholder for persistent terminal recovery
  }

  private ensureInitialPrompt(terminalId: string, ptyProcess: any): void {
    this.cleanupInitialPromptGuard(terminalId);

    if (!ptyProcess || typeof ptyProcess.write !== 'function') {
      return;
    }

    let promptSeen = false;
    let timer: NodeJS.Timeout | undefined;
    let dataDisposable: IDisposable | undefined;

    const guard = {
      disposed: false,
      dispose: () => {
        if (guard.disposed) {
          return;
        }
        guard.disposed = true;
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
        if (dataDisposable && typeof dataDisposable.dispose === 'function') {
          dataDisposable.dispose();
        }
        if (this._initialPromptGuards.get(terminalId) === guard) {
          this._initialPromptGuards.delete(terminalId);
        }
      },
    };

    if (ptyProcess.onData) {
      try {
        dataDisposable = ptyProcess.onData((chunk: string) => {
          if (!promptSeen && this.hasVisibleOutput(chunk)) {
            promptSeen = true;
            guard.dispose();
          }
        });
      } catch {
        // Failed to attach prompt listener
      }
    }

    timer = setTimeout(() => {
      if (!promptSeen) {
        try {
          ptyProcess.write('\r');
        } catch {
          // Failed to send newline fallback
        }
      }
      guard.dispose();
    }, 1200);

    this._initialPromptGuards.set(terminalId, guard);
  }

  public cleanupInitialPromptGuard(terminalId: string): void {
    this._initialPromptGuards.get(terminalId)?.dispose();
  }

  private hasVisibleOutput(data: string): boolean {
    if (!data) {
      return false;
    }

    if (data.includes(']633;')) {
      return true;
    }

    const cleaned = data
      .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
      .replace(/\x1b\][^\x07]*\x07/g, '')
      .replace(/\x1b[P^_].*?\x1b\\/g, '')
      .replace(/\u0007/g, '')
      .replace(/[\r\n]/g, '')
      .trim();

    return cleaned.length > 0;
  }

  public cleanupPtyOutput(terminalId: string): void {
    const disposable = this._ptyDataDisposables.get(terminalId);
    if (disposable) {
      disposable.dispose();
      this._ptyDataDisposables.delete(terminalId);
    }

    this._ptyOutputStarted.delete(terminalId);
    this._shellInitialized.delete(terminalId);

    const timeoutId = this._launchTimeouts.get(terminalId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this._launchTimeouts.delete(terminalId);
    }

    this.cleanupInitialPromptGuard(terminalId);
  }

  public dispose(): void {
    for (const disposable of this._ptyDataDisposables.values()) {
      try {
        disposable.dispose();
      } catch {
        // Disposal error
      }
    }
    this._ptyDataDisposables.clear();

    for (const guard of this._initialPromptGuards.values()) {
      try {
        guard.dispose();
      } catch {
        // Disposal error
      }
    }
    this._initialPromptGuards.clear();

    for (const timeoutId of this._launchTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    this._launchTimeouts.clear();

    this._shellInitialized.clear();
    this._ptyOutputStarted.clear();
  }
}
