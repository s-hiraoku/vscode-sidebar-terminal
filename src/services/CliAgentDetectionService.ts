import { terminal as log } from '../utils/logger';
import {
  ICliAgentDetectionService,
  CliAgentDetectionResult,
  TerminationDetectionResult,
  CliAgentState,
  OutputChunkProcessingResult,
} from '../interfaces/CliAgentService';
import { CliAgentDetectionEngine } from './CliAgentDetectionEngine';
import { CliAgentStateStore, AgentStatus } from './CliAgentStateStore';
import { CliAgentWaitingDetector } from './CliAgentWaitingDetector';
import { AudioNotificationService } from './AudioNotificationService';
import { ToastNotificationService } from './ToastNotificationService';
import { NativeNotificationService } from './NativeNotificationService';
import { getAgentDisplayName, getWaitingTypeLabel, NOTIFICATION_TITLE } from './agentConstants';
import type { AgentType } from '../types/shared';
import { CliAgentInputAccumulator } from './CliAgentInputAccumulator';
import { CliAgentIdleDetector } from './CliAgentIdleDetector';

export class CliAgentDetectionService implements ICliAgentDetectionService {
  private readonly detectionEngine: CliAgentDetectionEngine;
  private readonly stateStore: CliAgentStateStore;
  private readonly waitingDetector: CliAgentWaitingDetector;
  private readonly audioService: AudioNotificationService;
  private readonly toastService: ToastNotificationService;
  private readonly nativeNotificationService: NativeNotificationService;
  private readonly inputAccumulator: CliAgentInputAccumulator;
  private readonly idleDetector: CliAgentIdleDetector;
  private waitingChangeSubscription: { dispose(): void } | undefined;
  private statusChangeSubscription: { dispose(): void } | undefined;
  private heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  private readonly previousAgentInfo = new Map<string, { status: AgentStatus; agentType: AgentType | null }>();
  private readonly removingTerminals = new Set<string>();

  constructor() {
    this.detectionEngine = new CliAgentDetectionEngine();
    this.stateStore = new CliAgentStateStore();
    this.waitingDetector = new CliAgentWaitingDetector(
      this.detectionEngine.getPatternRegistry(),
      this.stateStore
    );
    this.audioService = new AudioNotificationService();
    this.toastService = new ToastNotificationService();
    this.nativeNotificationService = new NativeNotificationService();
    this.inputAccumulator = new CliAgentInputAccumulator();
    this.idleDetector = new CliAgentIdleDetector(this.stateStore);

    this.waitingChangeSubscription = this.stateStore.onAgentWaitingChange((event) => {
      if (event.isWaiting) {
        this.audioService.playNotification(event.terminalId);
        this.toastService.showWaitingNotification(event.terminalId, event.waitingType);
        this.nativeNotificationService.notifyAndActivate(
          event.terminalId,
          NOTIFICATION_TITLE,
          `CLI Agent is ${getWaitingTypeLabel(event.waitingType)} (${event.terminalId})`
        );
      }
    });

    this.statusChangeSubscription = this.stateStore.onStatusChange((event) => {
      const previous = this.previousAgentInfo.get(event.terminalId);
      this.previousAgentInfo.set(event.terminalId, { status: event.status, agentType: event.type });

      if (event.status === 'none' && (previous?.status === 'connected' || previous?.status === 'disconnected')) {
        if (this.removingTerminals.has(event.terminalId)) {
          this.removingTerminals.delete(event.terminalId);
          return;
        }
        this.toastService.showCompletedNotification(event.terminalId, previous.agentType);
        this.nativeNotificationService.notifyAndActivate(
          event.terminalId,
          NOTIFICATION_TITLE,
          `${getAgentDisplayName(previous.agentType)} has completed (${event.terminalId})`
        );
      }
    });
  }

  detectFromInput(terminalId: string, input: string): CliAgentDetectionResult | null {
    try {
      const result = this.detectionEngine.detectFromInput(terminalId, input);

      if (/\x03/.test(input)) {
        const terminalState = this.stateStore.getAgentState(terminalId);
        if (terminalState && terminalState.status !== 'none') {
          const immediateTermination = this.detectionEngine.detectImmediateInterruptTermination(
            terminalId,
            terminalState.agentType ?? undefined
          );
          if (immediateTermination?.isTerminated) {
            this.stateStore.setAgentTerminated(terminalId);
            return null;
          }
        }
      }

      if (result.isDetected && result.agentType) {
        this.stateStore.setConnectedAgent(terminalId, result.agentType);

        return {
          type: result.agentType,
          confidence: result.confidence,
          source: 'input',
          detectedLine: result.detectedLine,
        };
      }

      return null;
    } catch (error) {
      log('ERROR: Input detection failed:', error);
      return null;
    }
  }

  handleInputChunk(terminalId: string, input: string): CliAgentDetectionResult | null {
    if (!input) {
      return null;
    }

    const { submittedCommands, sawInterrupt } = this.inputAccumulator.consume(terminalId, input);

    if (sawInterrupt) {
      this.detectFromInput(terminalId, '\x03');
    }

    let lastDetection: CliAgentDetectionResult | null = null;
    for (const command of submittedCommands) {
      const detection = this.detectFromInput(terminalId, command);
      if (detection) {
        lastDetection = detection;
      }
    }

    return lastDetection;
  }

  detectFromOutput(terminalId: string, data: string): CliAgentDetectionResult | null {
    try {
      const result = this.detectionEngine.detectFromOutput(terminalId, data);

      if (result.isDetected && result.agentType) {
        this.stateStore.setConnectedAgent(terminalId, result.agentType);

        return {
          type: result.agentType,
          confidence: result.confidence,
          source: 'output',
          detectedLine: result.detectedLine,
        };
      }

      return null;
    } catch (error) {
      log('ERROR: Output detection failed:', error);
      return null;
    }
  }

  handleOutputChunk(terminalId: string, data: string): OutputChunkProcessingResult {
    let detection: CliAgentDetectionResult | null = null;
    let termination: TerminationDetectionResult | null = null;

    let state = this.getAgentState(terminalId);

    if (state.status === 'none') {
      detection = this.detectFromOutput(terminalId, data);
      state = this.getAgentState(terminalId);
    }

    if (state.status !== 'none') {
      const terminationResult = this.detectTermination(terminalId, data);
      if (terminationResult.isTerminated) {
        termination = terminationResult;
      }
      state = this.getAgentState(terminalId);
    }

    if (state.status === 'connected') {
      // Clear idle waiting when new output arrives
      this.idleDetector.clearIdleWaiting(terminalId);
      // Reset idle timer (output received = agent is active)
      this.idleDetector.resetTimer(terminalId);

      this.waitingDetector.analyzeImmediately(terminalId, data);
      state = this.getAgentState(terminalId);
    }

    return {
      detection,
      termination,
      state,
    };
  }

  detectTermination(terminalId: string, data: string): TerminationDetectionResult {
    try {
      const terminalState = this.stateStore.getAgentState(terminalId);
      const currentAgentType = terminalState?.agentType ?? undefined;

      const result = this.detectionEngine.detectTermination(terminalId, data, currentAgentType);

      if (result.isTerminated) {
        this.stateStore.setAgentTerminated(terminalId);
      }

      return result;
    } catch (error) {
      log('ERROR: Termination detection failed:', error);
      return {
        isTerminated: false,
        confidence: 0,
        detectedLine: '',
        reason: 'Detection error',
      };
    }
  }

  getAgentState(terminalId: string): CliAgentState {
    const state = this.stateStore.getAgentState(terminalId);
    return {
      status: state?.status ?? 'none',
      agentType: state?.agentType ?? null,
    };
  }

  getConnectedAgent(): { terminalId: string; type: AgentType } | null {
    const terminalId = this.stateStore.getConnectedAgentTerminalId();
    const type = this.stateStore.getConnectedAgentType();
    return terminalId && type ? { terminalId, type } : null;
  }

  getDisconnectedAgents(): Map<string, { type: AgentType; startTime: Date }> {
    return this.stateStore.getDisconnectedAgents();
  }

  switchAgentConnection(terminalId: string): {
    success: boolean;
    reason?: string;
    newStatus: AgentStatus;
    agentType: string | null;
  } {
    try {
      const existingState = this.stateStore.getAgentState(terminalId);
      const agentType = existingState?.agentType;
      if (!existingState || existingState.status === 'none' || !agentType) {
        return {
          success: false,
          reason: 'No detected AI agent found for this terminal',
          newStatus: 'none',
          agentType: null,
        };
      }

      this.stateStore.setConnectedAgent(terminalId, agentType, existingState.terminalName);

      return {
        success: true,
        newStatus: 'connected',
        agentType,
      };
    } catch (error) {
      log('ERROR: Connection switch failed:', error);
      return {
        success: false,
        reason: 'Connection switch failed',
        newStatus: 'none',
        agentType: null,
      };
    }
  }

  handleTerminalRemoved(terminalId: string): void {
    this.removingTerminals.add(terminalId);
    this.idleDetector.cancelTimer(terminalId);
    this.detectionEngine.clearTerminalCache(terminalId);
    this.waitingDetector.clearTerminalData(terminalId);
    this.inputAccumulator.clear(terminalId);
    this.stateStore.removeTerminalCompletely(terminalId);
    this.previousAgentInfo.delete(terminalId);
    this.toastService.clearTerminal(terminalId);
    this.nativeNotificationService.clearTerminal(terminalId);
  }

  forceReconnectAgent(
    terminalId: string,
    agentType: AgentType = 'claude',
    terminalName?: string
  ): boolean {
    this.detectionEngine.clearTerminalCache(terminalId);
    return this.stateStore.forceReconnectAgent(terminalId, agentType, terminalName);
  }

  clearDetectionError(terminalId: string): boolean {
    this.detectionEngine.clearTerminalCache(terminalId);
    return this.stateStore.clearDetectionError(terminalId);
  }

  detectWaitingState(terminalId: string, data: string): void {
    this.waitingDetector.analyze(terminalId, data);
  }

  get onAgentWaitingChange() {
    return this.stateStore.onAgentWaitingChange;
  }

  get onCliAgentStatusChange() {
    return this.stateStore.onStatusChange;
  }

  dispose(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    this.waitingChangeSubscription?.dispose();
    this.statusChangeSubscription?.dispose();
    this.idleDetector.dispose();
    this.waitingDetector.dispose();
    this.audioService.dispose();
    this.toastService.dispose();
    this.nativeNotificationService.dispose();
    this.stateStore.dispose();
  }

  public startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.stateStore.getStateStats();
    }, 30000);
  }

  refreshAgentState(): boolean {
    return this.stateStore.getConnectedAgentTerminalId() !== null;
  }

  setAgentConnected(terminalId: string, type: AgentType, terminalName?: string): void {
    this.stateStore.setConnectedAgent(terminalId, type, terminalName);
  }

  public get patternDetector() {
    return this.detectionEngine.getPatternRegistry();
  }

  public get stateManager() {
    return this.stateStore;
  }

  public get configManager() {
    return {
      getConfig: () => ({
        debounceMs: 25,
        cacheTtlMs: 1000,
        maxBufferSize: 50,
        skipMinimalData: true,
      }),
      updateConfig: () => {},
    };
  }
}

export { CliAgentPatternRegistry } from './CliAgentPatternRegistry';
export { CliAgentDetectionEngine } from './CliAgentDetectionEngine';
export { CliAgentStateStore } from './CliAgentStateStore';

export type { AgentType } from '../types/shared';
export type { DetectionResult, TerminationResult } from './CliAgentDetectionEngine';
export type { AgentState, AgentStatus, StateChangeEvent } from './CliAgentStateStore';

