import * as vscode from 'vscode';
import { CliAgentStateStore } from './CliAgentStateStore';

const SETTING_PREFIX = 'secondaryTerminal';

export class CliAgentIdleDetector implements vscode.Disposable {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly stateStore: CliAgentStateStore;
  private isDisposed = false;

  constructor(stateStore: CliAgentStateStore) {
    this.stateStore = stateStore;
  }

  private getTimeoutMs(): number {
    const config = vscode.workspace.getConfiguration(SETTING_PREFIX);
    const value = config.get<number>('agentIdleDetection.timeoutMs', 10000);
    return Math.max(1000, Math.min(30000, value));
  }

  public resetTimer(terminalId: string): void {
    if (this.isDisposed) {
      return;
    }

    // Clear existing timer
    const existing = this.timers.get(terminalId);
    if (existing) {
      clearTimeout(existing);
    }

    const timeoutMs = this.getTimeoutMs();

    const timer = setTimeout(() => {
      // Guard against stale callbacks after a replacement timer was set
      if (this.timers.get(terminalId) !== timer) {
        return;
      }
      this.timers.delete(terminalId);

      // Only fire if agent is still connected
      if (this.stateStore.isAgentConnected(terminalId)) {
        this.stateStore.setAgentWaiting(terminalId, true, 'idle');
      }
    }, timeoutMs);

    this.timers.set(terminalId, timer);
  }

  public clearIdleWaiting(terminalId: string): void {
    const state = this.stateStore.getAgentState(terminalId);
    if (state && state.isWaitingForInput && state.waitingType === 'idle') {
      this.stateStore.setAgentWaiting(terminalId, false);
    }
  }

  public cancelTimer(terminalId: string): void {
    const timer = this.timers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(terminalId);
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
