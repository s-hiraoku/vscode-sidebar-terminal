/**
 * WatchdogCoordinator
 *
 * Terminal initialization watchdog management extracted from SecondaryTerminalProvider.
 * Tracks initialization state, handles timeouts, and manages safe mode transitions.
 */

import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';
import {
  TerminalInitializationWatchdog,
  WatchdogOptions,
} from './TerminalInitializationWatchdog';

/**
 * Dependencies required by WatchdogCoordinator
 */
export interface IWatchdogCoordinatorDependencies {
  getTerminal(terminalId: string): { ptyProcess?: unknown; name?: string } | undefined;
  initializeShellForTerminal(
    terminalId: string,
    ptyProcess: unknown,
    safeMode: boolean
  ): void;
  telemetryService?: {
    trackPerformance(data: {
      operation: string;
      duration: number;
      success: boolean;
      metadata: Record<string, unknown>;
    }): void;
  };
}

export class WatchdogCoordinator {
  private readonly _watchdog: TerminalInitializationWatchdog;
  private readonly _pendingTerminals = new Set<string>();
  private readonly _safeModeTerminals = new Set<string>();
  private readonly _recordedMetrics = new Set<string>();
  private readonly _watchdogPhases = new Map<string, 'ack' | 'prompt'>();
  private readonly _initStartTimes = new Map<string, number>();
  private readonly _safeModeNotified = new Set<string>();

  constructor(
    private readonly deps: IWatchdogCoordinatorDependencies,
    private readonly ackOptions: WatchdogOptions,
    private readonly promptOptions: WatchdogOptions
  ) {
    this._watchdog = new TerminalInitializationWatchdog(
      (terminalId, info) => this.handleTimeout(terminalId, info.attempt, info.isFinalAttempt)
    );
  }

  /**
   * Start watchdog for a specific terminal
   */
  public startForTerminal(
    terminalId: string,
    phase: 'ack' | 'prompt',
    source: string,
    overrideOptions?: Partial<WatchdogOptions>
  ): void {
    const baseOptions = phase === 'prompt' ? this.promptOptions : this.ackOptions;
    this._watchdogPhases.set(terminalId, phase);
    this._watchdog.start(terminalId, `${phase}:${source}`, {
      ...baseOptions,
      ...overrideOptions,
    });
    log(`⏳ [WATCHDOG] Started for ${terminalId} (phase=${phase}, source=${source})`);
  }

  /**
   * Stop watchdog for a specific terminal
   */
  public stopForTerminal(terminalId: string, reason: string): void {
    this._watchdog.stop(terminalId, reason);
    this._watchdogPhases.delete(terminalId);
  }

  /**
   * Queue a terminal for watchdog start when initialization completes
   */
  public addPendingTerminal(terminalId: string): void {
    this._pendingTerminals.add(terminalId);
  }

  /**
   * Start all queued pending watchdogs
   */
  public startPendingWatchdogs(isInitialized: boolean): void {
    if (!isInitialized || this._pendingTerminals.size === 0) {
      return;
    }

    for (const terminalId of Array.from(this._pendingTerminals.values())) {
      this.startForTerminal(terminalId, 'ack', 'pendingQueue');
      this._pendingTerminals.delete(terminalId);
    }
  }

  /**
   * Record initialization start time for metrics
   */
  public recordInitStart(terminalId: string): void {
    this._initStartTimes.set(terminalId, Date.now());
  }

  /**
   * Mark terminal initialization as successful
   */
  public markInitSuccess(terminalId: string): void {
    this._safeModeTerminals.delete(terminalId);
    this.recordMetric('success', terminalId);
  }

  /**
   * Clear safe mode state for a terminal (e.g., on reconnect)
   */
  public clearSafeMode(terminalId: string): void {
    this._safeModeTerminals.delete(terminalId);
    this._safeModeNotified.delete(terminalId);
  }

  /**
   * Check if a terminal is in safe mode
   */
  public isInSafeMode(terminalId: string): boolean {
    return this._safeModeTerminals.has(terminalId);
  }

  /**
   * Get the current phase for a terminal
   */
  public getPhase(terminalId: string): 'ack' | 'prompt' | undefined {
    return this._watchdogPhases.get(terminalId);
  }

  /**
   * Handle initialization timeout
   */
  private handleTimeout(terminalId: string, attempt: number, isFinalAttempt: boolean): void {
    const terminal = this.deps.getTerminal(terminalId);
    const phase = this._watchdogPhases.get(terminalId) ?? 'ack';
    if (!terminal || !terminal.ptyProcess) {
      this.stopForTerminal(terminalId, 'terminalMissing');
      return;
    }

    log(
      `⚠️ [WATCHDOG] Terminal ${terminalId} init timeout (phase=${phase}, attempt=${attempt}, final=${isFinalAttempt})`
    );

    if (phase === 'ack') {
      if (isFinalAttempt) {
        this.stopForTerminal(terminalId, 'ackTimeout');
        this.recordMetric('timeout', terminalId);
        void this.notifyInitializationFailure(terminalId);
      }
      return;
    }

    if (!this._safeModeTerminals.has(terminalId)) {
      this._safeModeTerminals.add(terminalId);
      log(`⚠️ Prompt timeout -> safe mode for ${terminalId}`);
      this.notifySafeMode(terminalId);
      try {
        this.deps.initializeShellForTerminal(terminalId, terminal.ptyProcess, true);
        this.startForTerminal(terminalId, 'prompt', 'safeModeMonitor');
        return;
      } catch (error) {
        log(`❌ [FALLBACK] Safe mode initialization failed for ${terminalId}:`, error);
      }
    }

    if (!isFinalAttempt) {
      return;
    }

    this.stopForTerminal(terminalId, 'safeModeFailed');
    this.recordMetric('timeout', terminalId);
    void this.notifyInitializationFailure(terminalId);
  }

  /**
   * Record initialization metric
   */
  private recordMetric(metric: 'success' | 'timeout', terminalId: string): void {
    const key = `${terminalId}:${metric}`;
    if (this._recordedMetrics.has(key)) {
      return;
    }

    this._recordedMetrics.add(key);
    const startTime = this._initStartTimes.get(terminalId);
    const duration = startTime ? Date.now() - startTime : 0;
    this._initStartTimes.delete(terminalId);
    this._safeModeNotified.delete(terminalId);

    log(`📊 [METRIC] terminal.init.${metric} (terminal=${terminalId}, duration=${duration}ms)`);
    this.deps.telemetryService?.trackPerformance({
      operation: 'terminal.init',
      duration,
      success: metric === 'success',
      metadata: { result: metric },
    });
  }

  private async notifyInitializationFailure(terminalId: string): Promise<void> {
    this.recordMetric('timeout', terminalId);
    await vscode.window.showErrorMessage(
      'Sidebar Terminal failed to initialize its shell. Close the terminal and create a new one.'
    );
  }

  private notifySafeMode(terminalId: string): void {
    if (this._safeModeNotified.has(terminalId)) {
      return;
    }

    this._safeModeNotified.add(terminalId);
    void vscode.window.showWarningMessage(
      'Sidebar Terminal prompt is taking longer than expected. Retrying in safe mode...'
    );
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this._watchdog.dispose();
    this._pendingTerminals.clear();
    this._safeModeTerminals.clear();
    this._recordedMetrics.clear();
    this._watchdogPhases.clear();
    this._initStartTimes.clear();
    this._safeModeNotified.clear();
  }
}
