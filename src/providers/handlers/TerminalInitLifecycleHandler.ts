/**
 * TerminalInitLifecycleHandler
 *
 * Terminal initialization lifecycle management extracted from SecondaryTerminalProvider.
 * Handles terminal ready, initialization complete, watchdog registration,
 * terminal ensure logic, and terminal state sync to WebView.
 */

import { WebviewMessage } from '../../types/common';
import { TERMINAL_CONSTANTS } from '../../constants';
import { provider as log } from '../../utils/logger';
import {
  TerminalInitializationState,
} from '../services/TerminalInitializationStateMachine';

/**
 * Subset of WatchdogCoordinator methods used by this handler
 */
export interface IWatchdogCoordinatorLike {
  recordInitStart(terminalId: string): void;
  startForTerminal(terminalId: string, phase: 'ack' | 'prompt', reason: string): void;
  stopForTerminal(terminalId: string, reason: string): void;
  addPendingTerminal(terminalId: string): void;
  getPhase(terminalId: string): 'ack' | 'prompt' | undefined;
  isInSafeMode(terminalId: string): boolean;
  clearSafeMode(terminalId: string): void;
  markInitSuccess(terminalId: string): void;
  startPendingWatchdogs(isInit?: boolean): void;
}

/**
 * Subset of TerminalInitializationStateMachine methods used by this handler
 */
export interface ITerminalInitStateMachineLike {
  getState(terminalId: string): TerminalInitializationState;
  markViewPending(terminalId: string, reason: string): void;
  markPtySpawned(terminalId: string, reason: string): void;
  markViewReady(terminalId: string, reason: string): void;
  markShellInitializing(terminalId: string, reason: string): void;
  markShellInitialized(terminalId: string, reason: string): void;
  markOutputStreaming(terminalId: string, reason: string): void;
  markPromptReady(terminalId: string, reason: string): void;
  markFailed(terminalId: string, reason: string): void;
  reset(terminalId: string): void;
}

/**
 * Subset of EventCoordinator methods used by this handler
 */
export interface IEventCoordinatorLike {
  flushBufferedOutput(terminalId: string): void;
}

/**
 * Disposable-like interface
 */
interface IDisposable {
  dispose(): void;
}

/**
 * Dependencies required by TerminalInitLifecycleHandler
 */
export interface ITerminalInitLifecycleDependencies {
  // TerminalManager methods
  getTerminal(terminalId: string): { id: string; ptyProcess?: unknown; name?: string; cwd?: string } | undefined;
  getTerminals(): Array<{ id: string; name?: string; cwd?: string }>;
  getActiveTerminalId(): string | undefined;
  createTerminal(): string;
  setActiveTerminal(terminalId: string): void;
  initializeShellForTerminal(terminalId: string, ptyProcess: unknown, safeMode: boolean): void;
  startPtyOutput(terminalId: string): void;
  consumeCreationDisplayModeOverride(terminalId: string): string | undefined;
  getCurrentState(): unknown;
  onTerminalCreated(callback: (terminal: { id: string }) => void): IDisposable;
  onTerminalRemoved(callback: (terminalId: string) => void): IDisposable;

  // Communication
  sendMessage(message: WebviewMessage): Promise<void>;
  getCurrentFontSettings(): Record<string, unknown>;
  sendFullCliAgentStateSync(): void;

  // Resource management
  addDisposable(disposable: IDisposable): void;

  // WebView state
  isWebViewInitialized(): boolean;

  // Coordinated services
  readonly watchdogCoordinator: IWatchdogCoordinatorLike;
  readonly terminalInitStateMachine: ITerminalInitStateMachineLike;
  eventCoordinator: IEventCoordinatorLike | null;  // mutable: set lazily after view creation

  // Utils
  safeProcessCwd(): string;
}

export class TerminalInitLifecycleHandler {
  private readonly _pendingInitRetries = new Map<string, number>();

  constructor(private readonly deps: ITerminalInitLifecycleDependencies) {}

  /**
   * Update the event coordinator reference (needed because it's created lazily in _resetForNewView)
   */
  public setEventCoordinator(coordinator: IEventCoordinatorLike | null): void {
    this.deps.eventCoordinator = coordinator;
  }

  /**
   * Handle terminalReady message from WebView
   */
  public async handleTerminalReady(message: WebviewMessage): Promise<void> {
    const terminalId = message.terminalId as string;
    if (!terminalId) {
      log('⚠️ [PROVIDER] terminalReady missing terminalId');
      return;
    }

    log(`✅ [PROVIDER] Terminal ready: ${terminalId}`);

    const currentState = this.deps.terminalInitStateMachine.getState(terminalId);
    if (currentState < TerminalInitializationState.ViewReady) {
      this.deps.terminalInitStateMachine.markViewReady(terminalId, 'terminalReady');
      this.deps.watchdogCoordinator.startForTerminal(terminalId, 'prompt', 'terminalReady');
      log(`🔄 [PROVIDER] terminalReady promoted state to ViewReady for ${terminalId}`);
    }

    // Forward to persistence service for terminal ready event handling
    // Note: This is handled externally by the caller if needed
  }

  /**
   * Send initializationComplete message to WebView
   */
  public async sendInitializationComplete(terminalCount: number): Promise<void> {
    log(`📤 [PROVIDER] Sending initialization complete: ${terminalCount} terminals`);
    await this.deps.sendMessage({
      command: 'initializationComplete',
      terminalCount: terminalCount,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle terminalInitializationComplete message from WebView.
   * Advances the terminal through shell init, PTY output start, and prompt ready.
   */
  public async handleTerminalInitializationComplete(message: WebviewMessage): Promise<void> {
    const terminalId = message.terminalId as string;
    if (!terminalId) {
      log('⚠️ [PROVIDER] Terminal initialization complete missing terminalId');
      return;
    }

    const currentState = this.deps.terminalInitStateMachine.getState(terminalId);
    const phase = this.deps.watchdogCoordinator.getPhase(terminalId);
    if (
      phase === 'prompt' &&
      currentState >= TerminalInitializationState.ViewReady &&
      !this.deps.watchdogCoordinator.isInSafeMode(terminalId)
    ) {
      log(`⏭️ [PROVIDER] Ignoring duplicate terminalInitializationComplete for ${terminalId}`);
      return;
    }

    log(`✅ [PROVIDER] Terminal ${terminalId} initialization confirmed by WebView`);
    this.deps.watchdogCoordinator.stopForTerminal(terminalId, 'webviewAck');
    this.deps.terminalInitStateMachine.markViewReady(terminalId, 'webviewAck');
    this.deps.watchdogCoordinator.startForTerminal(terminalId, 'prompt', 'awaitPrompt');

    const terminal = this.deps.getTerminal(terminalId);
    if (!terminal || !terminal.ptyProcess) {
      const attempts = (this._pendingInitRetries.get(terminalId) ?? 0) + 1;
      this._pendingInitRetries.set(terminalId, attempts);

      if (attempts > 5) {
        log(`❌ [PROVIDER] Terminal ${terminalId} still unavailable after ${attempts} retries`);
        this._pendingInitRetries.delete(terminalId);
        return;
      }

      log(
        `⏳ [PROVIDER] Terminal ${terminalId} not ready (attempt=${attempts}). Retrying terminalInitializationComplete handler...`
      );
      setTimeout(() => this.handleTerminalInitializationComplete(message), 50 * attempts);
      return;
    }

    this._pendingInitRetries.delete(terminalId);

    try {
      this.deps.terminalInitStateMachine.markShellInitializing(terminalId, 'initializeShell');
      this.deps.initializeShellForTerminal(terminalId, terminal.ptyProcess, false);
      this.deps.terminalInitStateMachine.markShellInitialized(terminalId, 'initializeShell');
    } catch (error) {
      log(`❌ [PROVIDER] Shell initialization failed for ${terminalId}:`, error);
      this.deps.terminalInitStateMachine.markFailed(terminalId, 'initializeShell');
      this.deps.watchdogCoordinator.startForTerminal(terminalId, 'prompt', 'shellInitRetry');
      return;
    }

    try {
      this.deps.startPtyOutput(terminalId);
      this.deps.terminalInitStateMachine.markOutputStreaming(terminalId, 'startPtyOutput');
    } catch (error) {
      log(`❌ [PROVIDER] PTY output start failed for ${terminalId}:`, error);
      this.deps.terminalInitStateMachine.markFailed(terminalId, 'startPtyOutput');
      this.deps.watchdogCoordinator.startForTerminal(terminalId, 'prompt', 'ptyRetry');
      return;
    }

    await this.deps.sendMessage({
      command: TERMINAL_CONSTANTS.COMMANDS.START_OUTPUT,
      terminalId,
      timestamp: Date.now(),
    });
    this.deps.eventCoordinator?.flushBufferedOutput(terminalId);
    this.deps.terminalInitStateMachine.markPromptReady(terminalId, 'startOutput');
    this.deps.watchdogCoordinator.stopForTerminal(terminalId, 'promptReady');
    this.deps.watchdogCoordinator.clearSafeMode(terminalId);
    this.deps.watchdogCoordinator.markInitSuccess(terminalId);
  }

  /**
   * Initialize terminals in the WebView by sending terminalCreated messages for all existing terminals.
   */
  public async initializeTerminal(): Promise<void> {
    log('🔧 [PROVIDER] Initializing terminal...');

    const fontSettings = this.deps.getCurrentFontSettings();
    log('🔤 [PROVIDER] Font settings for terminal creation:', fontSettings);

    const terminals = this.deps.getTerminals();
    for (const terminal of terminals) {
      const displayModeOverride = this.deps.consumeCreationDisplayModeOverride(terminal.id);
      await this.deps.sendMessage({
        command: 'terminalCreated',
        terminal: {
          id: terminal.id,
          name: terminal.name,
          cwd: terminal.cwd || this.deps.safeProcessCwd(),
          isActive: terminal.id === this.deps.getActiveTerminalId(),
        },
        config: {
          fontSettings,
          ...(displayModeOverride ? { displayModeOverride } : {}),
        },
      });
    }

    await this.deps.sendMessage({
      command: 'stateUpdate',
      state: this.deps.getCurrentState(),
    });

    log('✅ [PROVIDER] Terminal initialization complete');
  }

  /**
   * Ensure at least one terminal exists, creating one if needed.
   */
  public ensureMultipleTerminals(): void {
    log('🔥 [ENSURE] _ensureMultipleTerminals called');
    try {
      const currentTerminals = this.deps.getTerminals().length;
      log(`🔍 [ENSURE] Current terminal count: ${currentTerminals}`);

      if (currentTerminals < 1) {
        log('🎯 [ENSURE] Creating minimum terminal (1)');
        const terminalId = this.deps.createTerminal();
        log(`✅ [ENSURE] Created terminal: ${terminalId}`);

        if (!terminalId) {
          log('❌ [ENSURE] createTerminal() returned null/undefined!');
          return;
        }

        this.deps.setActiveTerminal(terminalId);
        log(`🎯 [ENSURE] Set terminal as active: ${terminalId}`);

        log('🎯 [ENSURE] About to call initializeTerminal...');
        void this.initializeTerminal().then(() => {
          log('🎯 [ENSURE] initializeTerminal completed');
        }).catch((err) => {
          log(`❌ [ENSURE] initializeTerminal failed: ${err}`);
        });
        log('🎯 [ENSURE] Called initializeTerminal (async)');
      } else {
        log(`✅ [ENSURE] Sufficient terminals already exist: ${currentTerminals}`);
      }
    } catch (error) {
      log(`❌ [ENSURE] Failed to ensure terminals: ${String(error)}`);
    }
  }

  /**
   * Sync terminal state to WebView after panel movement.
   */
  public syncTerminalStateToWebView(): void {
    log('🔄 [PROVIDER] Syncing terminal state to WebView after panel move');
    void this.initializeTerminal();
    this.deps.sendFullCliAgentStateSync();
    log('✅ [PROVIDER] Terminal state sync complete');
  }

  /**
   * Register watchdog listeners for terminal create/remove events.
   */
  public registerInitializationWatchdogs(): void {
    try {
      const createdDisposable = this.deps.onTerminalCreated((terminal) => {
        if (!terminal?.id) {
          return;
        }

        this.deps.watchdogCoordinator.recordInitStart(terminal.id);
        this.deps.terminalInitStateMachine.markViewPending(terminal.id, 'terminalCreated');
        this.deps.terminalInitStateMachine.markPtySpawned(terminal.id, 'terminalCreated');

        if (this.deps.isWebViewInitialized()) {
          this.deps.watchdogCoordinator.startForTerminal(terminal.id, 'ack', 'terminalCreated');
        } else {
          this.deps.watchdogCoordinator.addPendingTerminal(terminal.id);
        }
      });

      const removedDisposable = this.deps.onTerminalRemoved((terminalId) => {
        this.deps.watchdogCoordinator.stopForTerminal(terminalId, 'terminalRemoved');
        this.deps.terminalInitStateMachine.reset(terminalId);
      });

      this.deps.addDisposable(createdDisposable);
      this.deps.addDisposable(removedDisposable);

      const existingTerminals = this.deps.getTerminals();
      for (const terminal of existingTerminals) {
        if (!terminal.id) {
          continue;
        }

        this.deps.watchdogCoordinator.recordInitStart(terminal.id);
        if (this.deps.isWebViewInitialized()) {
          this.deps.watchdogCoordinator.startForTerminal(terminal.id, 'ack', 'existingTerminal');
        } else {
          this.deps.watchdogCoordinator.addPendingTerminal(terminal.id);
        }
      }
    } catch (error) {
      log('⚠️ [PROVIDER] Failed to register initialization watchdogs:', error);
    }
  }
}
