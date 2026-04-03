import { CliAgentPatternRegistry } from './CliAgentPatternRegistry';
import { CliAgentStateStore } from './CliAgentStateStore';

const DEBOUNCE_MS = 300;
const MAX_PENDING_DATA_BYTES = 64 * 1024; // 64KB cap per terminal

export class CliAgentWaitingDetector {
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingData = new Map<string, string>();

  constructor(
    private readonly patternRegistry: CliAgentPatternRegistry,
    private readonly stateStore: CliAgentStateStore
  ) {}

  public analyze(terminalId: string, data: string): void {
    const existingTimer = this.debounceTimers.get(terminalId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const existing = this.pendingData.get(terminalId) ?? '';
    const accumulated = existing + data;
    if (accumulated.length > MAX_PENDING_DATA_BYTES) {
      // Cap reached; flush immediately
      this.pendingData.delete(terminalId);
      this.performAnalysis(terminalId, accumulated);
      return;
    }
    this.pendingData.set(terminalId, accumulated);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(terminalId);
      const accumulatedData = this.pendingData.get(terminalId) ?? '';
      this.pendingData.delete(terminalId);
      this.performAnalysis(terminalId, accumulatedData);
    }, DEBOUNCE_MS);

    this.debounceTimers.set(terminalId, timer);
  }

  public analyzeImmediately(terminalId: string, data: string): void {
    const existingTimer = this.debounceTimers.get(terminalId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.debounceTimers.delete(terminalId);
    }
    this.pendingData.delete(terminalId);
    this.performAnalysis(terminalId, data);
  }

  private performAnalysis(terminalId: string, data: string): void {
    const state = this.stateStore.getAgentState(terminalId);
    if (!state || state.status !== 'connected' || !state.agentType) {
      return;
    }

    const cleanedData = this.patternRegistry.cleanAnsiEscapeSequences(data);

    if (!cleanedData.trim()) {
      return;
    }

    const match = this.patternRegistry.matchWaitingPattern(state.agentType, cleanedData);

    if (match) {
      this.stateStore.setAgentWaiting(terminalId, true, match.waitingType);
    }
  }

  public clearTerminalData(terminalId: string): void {
    const timer = this.debounceTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(terminalId);
    }
    this.pendingData.delete(terminalId);
  }

  public dispose(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.pendingData.clear();
  }
}
