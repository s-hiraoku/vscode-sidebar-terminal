/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as vscode from 'vscode';
import { TerminalInstance, ProcessState } from '../types/shared';
import { terminal as log } from '../utils/logger';
import { showWarningMessage } from '../utils/common';
import { ShellIntegrationService } from '../services/ShellIntegrationService';
import type { IDisposable } from '@homebridge/node-pty-prebuilt-multiarch';

/**
 * TerminalProcessCoordinator
 *
 * Responsibility: Manage PTY process lifecycle and shell integration
 * - Initialize shell for terminals
 * - Start and manage PTY output
 * - Handle process state changes
 * - Setup terminal event handlers
 * - Manage initial prompt guards
 *
 * Single Responsibility Principle: Focused on process coordination only
 */
export class TerminalProcessCoordinator {
  // 🎯 HANDSHAKE PROTOCOL: Track shell integration initialization to prevent duplicates
  private readonly _shellInitialized = new Set<string>();

  // 🎯 HANDSHAKE PROTOCOL: Track PTY output handlers to prevent duplicates and enable deferred start
  private readonly _ptyOutputStarted = new Set<string>();
  private readonly _ptyDataDisposables = new Map<string, vscode.Disposable>();

  // Initial prompt guards
  private readonly _initialPromptGuards = new Map<string, { dispose: () => void }>();

  constructor(
    private readonly _terminals: Map<string, TerminalInstance>,
    private readonly _shellIntegrationService: ShellIntegrationService | null,
    private readonly _stateUpdateEmitter: vscode.EventEmitter<any>,
    private readonly _bufferDataCallback: (terminalId: string, data: string) => void
  ) {}

  /**
   * Initialize shell for a terminal after PTY creation
   * 🎯 HANDSHAKE PROTOCOL: Prevents duplicate initialization that causes multiple prompts
   */
  public initializeShellForTerminal(terminalId: string, ptyProcess: any, safeMode: boolean): void {
    try {
      // 🎯 HANDSHAKE PROTOCOL: Guard against duplicate initialization
      if (this._shellInitialized.has(terminalId)) {
        log(`⏭️ [TERMINAL] Shell already initialized for ${terminalId}, skipping duplicate init`);
        return;
      }

      // Mark as initialized BEFORE starting async operations to prevent race conditions
      this._shellInitialized.add(terminalId);

      // Inject shell integration if service is available (async)
      if (this._shellIntegrationService && !safeMode) {
        // Skip shell integration in safe mode to avoid conflicts
        log(`🔧 [TERMINAL] Injecting shell integration for: ${terminalId}`);
        const terminal = this._terminals.get(terminalId);
        if (terminal) {
          const shellPath = (terminal.ptyProcess as any)?.spawnfile || '/bin/bash';
          // Fire and forget - permission prompt will handle async flow
          void this._shellIntegrationService
            .injectShellIntegration(terminalId, shellPath, ptyProcess)
            .catch((error) => {
              log(`⚠️ [TERMINAL] Shell integration injection error: ${error}`);
            });
        }
      } else if (safeMode) {
        log(`🛡️ [TERMINAL] Skipping shell integration in safe mode for: ${terminalId}`);
      }

      // 🎯 FIX: Skip prompt initialization in safe mode (session restore)
      // Safe mode is used during session restore where prompt is already in scrollback
      if (!safeMode) {
        // Kick off deterministic prompt readiness guard
        this.ensureInitialPrompt(terminalId, ptyProcess);
      }
    } catch (error) {
      log(`⚠️ [TERMINAL] Post-creation initialization error for ${terminalId}:`, error);
    }
  }

  /**
   * Start PTY output after WebView handshake complete
   * 🎯 VS Code Pattern: Defer PTY output until WebView confirms ready
   */
  public startPtyOutput(terminalId: string): void {
    // Guard against duplicate start
    if (this._ptyOutputStarted.has(terminalId)) {
      log(`⏭️ [TERMINAL] PTY output already started for ${terminalId}, skipping`);
      return;
    }

    const terminal = this._terminals.get(terminalId);
    if (!terminal || !terminal.ptyProcess) {
      log(`❌ [TERMINAL] Cannot start PTY output - terminal not found: ${terminalId}`);
      return;
    }

    // Mark as started (data handler is already registered in setupTerminalEvents)
    this._ptyOutputStarted.add(terminalId);

    log(`✅ [TERMINAL] PTY output acknowledged for ${terminalId} (listener active)`);
  }

  /**
   * Setup terminal event handlers
   */
  public setupTerminalEvents(
    terminal: TerminalInstance,
    onExitCallback: (terminalId: string, exitCode: number) => void
  ): void {
    const { id: terminalId, ptyProcess } = terminal;

    // Initialize process state
    terminal.processState = ProcessState.Launching;
    this.notifyProcessStateChange(terminal, ProcessState.Launching);

    // Set up data event handler with CLI agent detection and shell integration
    const dataDisposable: IDisposable = (ptyProcess as any).onData((data: string) => {
      // Update process state to running on first data
      if (terminal.processState === ProcessState.Launching) {
        terminal.processState = ProcessState.Running;
        this.notifyProcessStateChange(terminal, ProcessState.Running);
      }

      // 🔍 DEBUGGING: Log all PTY data to identify shell prompt issues
      log(
        `📤 [PTY-DATA] Terminal ${terminalId} received ${data.length} chars:`,
        JSON.stringify(data.substring(0, 100))
      );

      // Process shell integration sequences if service is available
      try {
        if (this._shellIntegrationService) {
          this._shellIntegrationService.processTerminalData(terminalId, data);
        }
      } catch (error) {
        log(`⚠️ [TERMINAL] Shell integration processing error: ${error}`);
      }

      // Performance optimization: Batch small data chunks
      this._bufferDataCallback(terminalId, data);
    });

    // Track the disposable so repeated events don't accumulate listeners
    this._ptyDataDisposables.set(terminalId, dataDisposable);

    // Set up exit event handler
    (ptyProcess as any).onExit((event: number | { exitCode: number; signal?: number }) => {
      const exitCode = typeof event === 'number' ? event : event.exitCode;
      const signal = typeof event === 'object' ? event.signal : undefined;

      // Update process state based on exit conditions
      if (terminal.processState === ProcessState.Launching) {
        terminal.processState = ProcessState.KilledDuringLaunch;
      } else {
        terminal.processState = ProcessState.KilledByProcess;
      }

      this.notifyProcessStateChange(terminal, terminal.processState);

      log(
        '🚪 [DEBUG] PTY process exited:',
        exitCode,
        'signal:',
        signal,
        'state:',
        ProcessState[terminal.processState],
        'for terminal:',
        terminalId
      );

      // Notify exit callback
      onExitCallback(terminalId, exitCode);
    });
  }

  /**
   * Notify process state changes for better lifecycle tracking
   * Based on VS Code's process state management patterns
   */
  public notifyProcessStateChange(terminal: TerminalInstance, newState: ProcessState): void {
    const previousState = terminal.processState;

    log(
      `🔄 [PROCESS-STATE] Terminal ${terminal.id} state change:`,
      `${previousState !== undefined ? ProcessState[previousState] : 'undefined'} → ${ProcessState[newState]}`
    );

    // Fire process state change event for monitoring and debugging
    this._stateUpdateEmitter.fire({
      type: 'processStateChange',
      terminalId: terminal.id,
      previousState,
      newState,
      timestamp: Date.now(),
    } as any);

    // Handle state-specific actions
    this.handleProcessStateActions(terminal, newState, previousState);
  }

  /**
   * Handle actions based on process state changes
   */
  private handleProcessStateActions(
    terminal: TerminalInstance,
    newState: ProcessState,
    _previousState?: ProcessState
  ): void {
    switch (newState) {
      case ProcessState.Launching:
        // Setup launch timeout monitoring
        this.setupLaunchTimeout(terminal);
        break;

      case ProcessState.Running:
        // Clear any launch timeouts
        this.clearLaunchTimeout(terminal);
        break;

      case ProcessState.KilledDuringLaunch:
        log(
          `⚠️ [PROCESS] Terminal ${terminal.id} killed during launch - potential configuration issue`
        );
        this.handleLaunchFailure(terminal);
        break;

      case ProcessState.KilledByUser:
        log(`ℹ️ [PROCESS] Terminal ${terminal.id} killed by user request`);
        break;

      case ProcessState.KilledByProcess:
        log(`⚠️ [PROCESS] Terminal ${terminal.id} process terminated unexpectedly`);
        this.attemptProcessRecovery(terminal);
        break;
    }
  }

  /**
   * Setup launch timeout monitoring
   */
  private setupLaunchTimeout(terminal: TerminalInstance): void {
    const timeoutMs = 10000; // 10 seconds timeout

    setTimeout(() => {
      if (terminal.processState === ProcessState.Launching) {
        log(`⏰ [PROCESS] Terminal ${terminal.id} launch timeout - marking as failed`);
        terminal.processState = ProcessState.KilledDuringLaunch;
        this.notifyProcessStateChange(terminal, ProcessState.KilledDuringLaunch);
      }
    }, timeoutMs);
  }

  /**
   * Clear launch timeout (if any)
   */
  private clearLaunchTimeout(terminal: TerminalInstance): void {
    // Implementation would clear any active timeout for this terminal
    // For now, just log the successful launch
    log(`✅ [PROCESS] Terminal ${terminal.id} launched successfully`);
  }

  /**
   * Handle launch failure with recovery options
   */
  private handleLaunchFailure(terminal: TerminalInstance): void {
    log(`🚨 [RECOVERY] Terminal ${terminal.id} failed to launch, attempting recovery...`);

    // For now, log the failure. In a full implementation, this could:
    // 1. Try alternative shell configurations
    // 2. Suggest profile changes to the user
    // 3. Provide diagnostic information
    showWarningMessage(
      `Terminal ${terminal.name} failed to launch. Check your shell configuration.`
    );
  }

  /**
   * Attempt process recovery for unexpected terminations
   */
  private attemptProcessRecovery(terminal: TerminalInstance): void {
    if (terminal.shouldPersist && terminal.persistentProcessId) {
      log(`🔄 [RECOVERY] Attempting recovery for persistent terminal ${terminal.id}`);
      // Implementation would attempt to reconnect to persistent process
      // For now, just log the recovery attempt
    } else {
      log(`ℹ️ [RECOVERY] Terminal ${terminal.id} terminated normally (no recovery needed)`);
    }
  }

  /**
   * Ensure initial prompt is displayed
   */
  private ensureInitialPrompt(terminalId: string, ptyProcess: any): void {
    this.cleanupInitialPromptGuard(terminalId);

    if (!ptyProcess || typeof ptyProcess.write !== 'function') {
      log(`⚠️ [TERMINAL] Unable to ensure prompt for ${terminalId} - invalid PTY process`);
      return;
    }

    const PROMPT_TIMEOUT_MS = 1200;
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

    try {
      if (ptyProcess.onData) {
        dataDisposable = ptyProcess.onData((chunk: string) => {
          if (promptSeen) {
            return;
          }

          if (this.hasVisibleOutput(chunk)) {
            promptSeen = true;
            guard.dispose();
          }
        });
      }
    } catch (listenerError) {
      log(`⚠️ [TERMINAL] Failed to attach prompt listener for ${terminalId}:`, listenerError);
    }

    timer = setTimeout(() => {
      if (!promptSeen) {
        try {
          ptyProcess.write('\r');
        } catch (writeError) {
          log(`❌ [TERMINAL] Failed to send newline fallback for ${terminalId}:`, writeError);
        }
      }
      guard.dispose();
    }, PROMPT_TIMEOUT_MS);

    this._initialPromptGuards.set(terminalId, guard);
  }

  /**
   * Cleanup initial prompt guard
   */
  public cleanupInitialPromptGuard(terminalId: string): void {
    const guard = this._initialPromptGuards.get(terminalId);
    if (guard) {
      guard.dispose();
    }
  }

  /**
   * Check if data has visible output
   */
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

  /**
   * Cleanup PTY output handlers for a terminal
   */
  public cleanupPtyOutput(terminalId: string): void {
    // Clean up PTY data disposable
    const disposable = this._ptyDataDisposables.get(terminalId);
    if (disposable) {
      disposable.dispose();
      this._ptyDataDisposables.delete(terminalId);
    }

    // Clean up PTY output started flag
    this._ptyOutputStarted.delete(terminalId);

    // Clean up shell initialization flag
    if (this._shellInitialized.has(terminalId)) {
      this._shellInitialized.delete(terminalId);
      log(`🧹 [TERMINAL] Cleaned up shell initialization flag for: ${terminalId}`);
    }

    // Clean up prompt guard
    this.cleanupInitialPromptGuard(terminalId);
  }

  /**
   * Dispose all process coordinator resources
   */
  public dispose(): void {
    // Cleanup all PTY data disposables
    for (const [terminalId, disposable] of this._ptyDataDisposables.entries()) {
      try {
        disposable.dispose();
      } catch (error) {
        log(`⚠️ [TERMINAL] Error disposing PTY data handler for ${terminalId}:`, error);
      }
    }
    this._ptyDataDisposables.clear();

    // Cleanup all prompt guards
    for (const guard of this._initialPromptGuards.values()) {
      try {
        guard.dispose();
      } catch (error) {
        log(`⚠️ [TERMINAL] Error disposing prompt guard:`, error);
      }
    }
    this._initialPromptGuards.clear();

    // Clear tracking sets
    this._shellInitialized.clear();
    this._ptyOutputStarted.clear();
  }
}
