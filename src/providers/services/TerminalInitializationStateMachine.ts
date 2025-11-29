import { provider as log } from '../../utils/logger';

/**
 * Terminal initialization states.
 * Ordered to allow numeric comparison for state progression.
 */
export enum TerminalInitializationState {
  Idle = 0,
  ViewPending = 1,
  ViewReady = 2,
  PtySpawned = 3,
  ShellInitializing = 4,
  ShellInitialized = 5,
  OutputStreaming = 6,
  PromptReady = 7,
  Failed = 8,
}

const STATE_NAMES: Record<TerminalInitializationState, string> = {
  [TerminalInitializationState.Idle]: 'Idle',
  [TerminalInitializationState.ViewPending]: 'ViewPending',
  [TerminalInitializationState.ViewReady]: 'ViewReady',
  [TerminalInitializationState.PtySpawned]: 'PtySpawned',
  [TerminalInitializationState.ShellInitializing]: 'ShellInitializing',
  [TerminalInitializationState.ShellInitialized]: 'ShellInitialized',
  [TerminalInitializationState.OutputStreaming]: 'OutputStreaming',
  [TerminalInitializationState.PromptReady]: 'PromptReady',
  [TerminalInitializationState.Failed]: 'Failed',
};

interface TerminalStateInfo {
  state: TerminalInitializationState;
  updatedAt: number;
  retryCount: number;
}

/**
 * Tracks per-terminal initialization state transitions with logging.
 */
export class TerminalInitializationStateMachine {
  private readonly stateMap = new Map<string, TerminalStateInfo>();

  public reset(terminalId: string): void {
    if (this.stateMap.delete(terminalId)) {
      log(`🧹 [INIT-STATE] Reset state for terminal ${terminalId}`);
    }
  }

  public getState(terminalId: string): TerminalInitializationState {
    return this.stateMap.get(terminalId)?.state ?? TerminalInitializationState.Idle;
  }

  public isOutputAllowed(terminalId: string): boolean {
    const state = this.getState(terminalId);
    return state >= TerminalInitializationState.OutputStreaming;
  }

  public incrementRetry(terminalId: string): number {
    const current = this.stateMap.get(terminalId);
    if (!current) {
      this.stateMap.set(terminalId, {
        state: TerminalInitializationState.Idle,
        updatedAt: Date.now(),
        retryCount: 1,
      });
      return 1;
    }

    current.retryCount += 1;
    current.updatedAt = Date.now();
    log(
      `🔁 [INIT-STATE] Retry #${current.retryCount} for ${terminalId} (state=${STATE_NAMES[current.state]})`
    );
    return current.retryCount;
  }

  public markViewPending(terminalId: string, context?: string): void {
    this.transition(terminalId, TerminalInitializationState.ViewPending, context);
  }

  public markViewReady(terminalId: string, context?: string): void {
    this.transition(terminalId, TerminalInitializationState.ViewReady, context);
  }

  public markPtySpawned(terminalId: string, context?: string): void {
    this.transition(terminalId, TerminalInitializationState.PtySpawned, context);
  }

  public markShellInitializing(terminalId: string, context?: string): void {
    this.transition(terminalId, TerminalInitializationState.ShellInitializing, context);
  }

  public markShellInitialized(terminalId: string, context?: string): void {
    this.transition(terminalId, TerminalInitializationState.ShellInitialized, context);
  }

  public markOutputStreaming(terminalId: string, context?: string): void {
    this.transition(terminalId, TerminalInitializationState.OutputStreaming, context);
  }

  public markPromptReady(terminalId: string, context?: string): void {
    this.transition(terminalId, TerminalInitializationState.PromptReady, context);
  }

  public markFailed(terminalId: string, context?: string): void {
    this.transition(terminalId, TerminalInitializationState.Failed, context, true);
  }

  private transition(
    terminalId: string,
    nextState: TerminalInitializationState,
    context?: string,
    allowRegression = false
  ): void {
    const snapshot = this.stateMap.get(terminalId);
    const currentState = snapshot?.state ?? TerminalInitializationState.Idle;

    if (!allowRegression && nextState < currentState) {
      log(
        `⚠️ [INIT-STATE] Ignoring regression for ${terminalId}: ${STATE_NAMES[currentState]} -> ${STATE_NAMES[nextState]}`
      );
      return;
    }

    this.stateMap.set(terminalId, {
      state: nextState,
      updatedAt: Date.now(),
      retryCount: snapshot?.retryCount ?? 0,
    });

    log(
      `📡 [INIT-STATE] ${terminalId}: ${STATE_NAMES[currentState]} -> ${STATE_NAMES[nextState]}${context ? ` (${context})` : ''}`
    );
  }
}
