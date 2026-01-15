/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as vscode from 'vscode';
import { TerminalInstance, TerminalEvent, TerminalState, DeleteResult } from '../types/shared';
import { PERFORMANCE_CONSTANTS } from '../constants';
import { ShellIntegrationService } from '../services/ShellIntegrationService';
import { TerminalProfileService } from '../services/TerminalProfileService';
import { terminal as log } from '../utils/logger';
import { getTerminalConfig, ActiveTerminalManager } from '../utils/common';
import { TerminalNumberManager } from '../utils/TerminalNumberManager';
import { CliAgentDetectionService } from '../services/CliAgentDetectionService';
import { ICliAgentDetectionService } from '../interfaces/CliAgentService';
import { TerminalSpawner } from './TerminalSpawner';
import {
  TerminalProcessManager,
  ITerminalProcessManager,
} from '../services/TerminalProcessManager';
import {
  TerminalValidationService,
  ITerminalValidationService,
} from '../services/TerminalValidationService';
import { CircularBufferManager } from '../utils/CircularBufferManager';

// Import new modules (Issue #237 Phase 1)
import { TerminalDataBufferManager } from './TerminalDataBufferManager';
import { TerminalStateCoordinator } from './TerminalStateCoordinator';
import { TerminalIOCoordinator } from './TerminalIOCoordinator';
import { TerminalProcessCoordinator } from './TerminalProcessCoordinator';
import { TerminalLifecycleManager } from './TerminalLifecycleManager';
import { TerminalCreationOverrides, TerminalDisplayMode } from './types';

const ENABLE_TERMINAL_DEBUG_LOGS = process.env.SECONDARY_TERMINAL_DEBUG_LOGS === 'true';

/** Coordinates between specialized terminal management modules (Facade + Coordinator pattern) */
export class TerminalManager {
  private readonly _terminals = new Map<string, TerminalInstance>();
  private readonly _activeTerminalManager = new ActiveTerminalManager();
  private readonly _dataEmitter = new vscode.EventEmitter<TerminalEvent>();
  private readonly _exitEmitter = new vscode.EventEmitter<TerminalEvent>();
  private readonly _terminalCreatedEmitter = new vscode.EventEmitter<TerminalInstance>();
  private readonly _terminalRemovedEmitter = new vscode.EventEmitter<string>();
  private readonly _stateUpdateEmitter = new vscode.EventEmitter<TerminalState>();
  private readonly _terminalFocusEmitter = new vscode.EventEmitter<string>();
  private _outputEmitter?: vscode.EventEmitter<{ terminalId: string; data: string }>;

  private readonly _terminalNumberManager: TerminalNumberManager;
  private _shellIntegrationService: ShellIntegrationService | null = null;
  private readonly _profileService: TerminalProfileService;
  private readonly _cliAgentService: ICliAgentDetectionService;
  private readonly _terminalSpawner: TerminalSpawner;
  private readonly _processManager: ITerminalProcessManager;
  private readonly _validationService: ITerminalValidationService;
  private readonly _debugLoggingEnabled = ENABLE_TERMINAL_DEBUG_LOGS;
  private readonly _dataBufferManager: TerminalDataBufferManager;
  private readonly _stateCoordinator: TerminalStateCoordinator;
  private readonly _ioCoordinator: TerminalIOCoordinator;
  private readonly _processCoordinator: TerminalProcessCoordinator;
  private readonly _lifecycleManager: TerminalLifecycleManager;
  private operationQueue: Promise<void> = Promise.resolve();
  private readonly _shellInitialized = new Set<string>();
  private readonly _ptyOutputStarted = new Set<string>();
  private readonly _ptyDataDisposables = new Map<string, vscode.Disposable>();
  private readonly _bufferManager: CircularBufferManager;
  private readonly _initialPromptGuards = new Map<string, { dispose: () => void }>();
  private readonly _cleaningTerminals = new Set<string>();

  // Public event accessors
  public readonly onData = this._dataEmitter.event;
  public readonly onExit = this._exitEmitter.event;
  public readonly onTerminalCreated = this._terminalCreatedEmitter.event;
  public readonly onTerminalRemoved = this._terminalRemovedEmitter.event;
  public readonly onStateUpdate = this._stateUpdateEmitter.event;
  public readonly onTerminalFocus = this._terminalFocusEmitter.event;

  private debugLog(...args: unknown[]): void {
    if (this._debugLoggingEnabled) {
      log(...args);
    }
  }

  public consumeCreationDisplayModeOverride(terminalId: string): TerminalDisplayMode | null {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      return null;
    }
    const override = terminal.creationDisplayModeOverride ?? null;
    if (override) {
      terminal.creationDisplayModeOverride = undefined;
    }
    return override;
  }

  constructor(cliAgentService?: ICliAgentDetectionService) {
    const config = getTerminalConfig();
    this._terminalNumberManager = new TerminalNumberManager(config.maxTerminals);
    this._profileService = new TerminalProfileService();
    this._cliAgentService = cliAgentService || new CliAgentDetectionService();
    this._cliAgentService.startHeartbeat();
    this._terminalSpawner = new TerminalSpawner();
    this._processManager = new TerminalProcessManager();
    this._validationService = new TerminalValidationService({ maxTerminals: config.maxTerminals });

    this._bufferManager = new CircularBufferManager(
      (terminalId: string, data: string) => this._dataEmitter.fire({ terminalId, data }),
      {
        flushInterval: PERFORMANCE_CONSTANTS.OUTPUT_BUFFER_FLUSH_INTERVAL_MS,
        maxDataSize: PERFORMANCE_CONSTANTS.MAX_BUFFER_SIZE_BYTES,
      }
    );

    this._dataBufferManager = new TerminalDataBufferManager(
      this._terminals,
      this._dataEmitter,
      this._cliAgentService
    );

    this._stateCoordinator = new TerminalStateCoordinator(
      this._terminals,
      this._activeTerminalManager,
      this._stateUpdateEmitter,
      this._terminalFocusEmitter,
      this._terminalNumberManager
    );

    this._ioCoordinator = new TerminalIOCoordinator(
      this._terminals,
      this._activeTerminalManager,
      this._cliAgentService
    );

    this._processCoordinator = new TerminalProcessCoordinator(
      this._terminals,
      this._shellIntegrationService,
      this._stateUpdateEmitter,
      (terminalId: string, data: string) => this._dataBufferManager.bufferData(terminalId, data)
    );

    this._lifecycleManager = new TerminalLifecycleManager(
      this._terminals,
      this._terminalNumberManager,
      this._profileService,
      this._terminalSpawner,
      this._cliAgentService,
      this._terminalCreatedEmitter,
      this._terminalRemovedEmitter,
      this._exitEmitter,
      (terminal: TerminalInstance) => this._setupTerminalEvents(terminal),
      () => this._stateCoordinator.notifyStateUpdate(),
      (terminalId: string) => this._cleanupTerminalData(terminalId)
    );
  }

  public get onCliAgentStatusChange(): vscode.Event<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }> {
    return this._cliAgentService.onCliAgentStatusChange;
  }

  // === Lifecycle Management ===

  public async createTerminalWithProfile(
    profileName?: string,
    overrides?: TerminalCreationOverrides
  ): Promise<string> {
    return await this._lifecycleManager.createTerminalWithProfile(profileName, overrides);
  }

  public createTerminal(overrides?: TerminalCreationOverrides): string {
    return this._lifecycleManager.createTerminal(overrides);
  }

  public async deleteTerminal(
    terminalId: string,
    options: { force?: boolean; source?: 'header' | 'panel' | 'command' } = {}
  ): Promise<DeleteResult> {
    return await this._lifecycleManager.deleteTerminal(terminalId, options);
  }

  public canRemoveTerminal(terminalId: string): { canRemove: boolean; reason?: string } {
    return this._lifecycleManager.canRemoveTerminal(terminalId);
  }

  public removeTerminal(terminalId: string): void {
    this._lifecycleManager.removeTerminal(terminalId);
  }

  public getTerminal(terminalId: string): TerminalInstance | undefined {
    return this._lifecycleManager.getTerminal(terminalId);
  }

  public getTerminals(): TerminalInstance[] {
    return this._lifecycleManager.getTerminals();
  }

  // === Process Coordination ===

  public initializeShellForTerminal(terminalId: string, ptyProcess: any, safeMode: boolean): void {
    this._processCoordinator.initializeShellForTerminal(terminalId, ptyProcess, safeMode);
  }

  public startPtyOutput(terminalId: string): void {
    this._processCoordinator.startPtyOutput(terminalId);
  }

  // === State Management ===

  public getCurrentState(): TerminalState {
    return this._stateCoordinator.getCurrentState();
  }

  public hasActiveTerminal(): boolean {
    return this._stateCoordinator.hasActiveTerminal();
  }

  public getActiveTerminalId(): string | undefined {
    return this._stateCoordinator.getActiveTerminalId();
  }

  public setActiveTerminal(terminalId: string): void {
    this._stateCoordinator.setActiveTerminal(terminalId);
  }

  public focusTerminal(terminalId: string): void {
    this._stateCoordinator.focusTerminal(terminalId);
  }

  public reorderTerminals(order: string[]): void {
    this._stateCoordinator.reorderTerminals(order);
  }

  public updateTerminalCwd(terminalId: string, cwd: string): void {
    this._stateCoordinator.updateTerminalCwd(terminalId, cwd);
  }

  // === I/O Operations ===

  public sendInput(data: string, terminalId?: string): void {
    this._ioCoordinator.sendInput(data, terminalId);
  }

  public resize(cols: number, rows: number, terminalId?: string): void {
    this._ioCoordinator.resize(cols, rows, terminalId);
  }

  public writeToTerminal(terminalId: string, data: string): boolean {
    return this._ioCoordinator.writeToTerminal(terminalId, data);
  }

  public resizeTerminal(terminalId: string, cols: number, rows: number): boolean {
    return this._ioCoordinator.resizeTerminal(terminalId, cols, rows);
  }

  // === Legacy Methods ===

  /** @deprecated Use deleteTerminal() with active terminal ID */
  public async safeKillTerminal(_terminalId?: string): Promise<boolean> {
    const targetId = _terminalId || this._activeTerminalManager.getActive();
    if (!targetId) {
      log('No terminal to kill');
      return false;
    }
    try {
      const result = await this.deleteTerminal(targetId, { source: 'command' });
      return result.success;
    } catch (err) {
      log(`Failed to kill terminal ${targetId}: ${err}`);
      return false;
    }
  }

  public async killTerminal(terminalId?: string): Promise<void> {
    const targetId = terminalId || this._activeTerminalManager.getActive();
    if (!targetId) {
      return;
    }
    const result = await this.deleteTerminal(targetId, { force: true, source: 'command' });
    if (!result.success) {
      throw new Error(result.reason || 'Failed to kill terminal');
    }
  }

  // === CLI Agent Integration ===

  public isCliAgentConnected(terminalId: string): boolean {
    return this._cliAgentService.getAgentState(terminalId).status === 'connected';
  }

  public isCliAgentRunning(terminalId: string): boolean {
    return this._cliAgentService.getAgentState(terminalId).status !== 'none';
  }

  public getCurrentGloballyActiveAgent(): { terminalId: string; type: string } | null {
    return this._cliAgentService.getConnectedAgent();
  }

  public refreshCliAgentState(): boolean {
    return this._cliAgentService.refreshAgentState();
  }

  public getLastCommand(_terminalId: string): string | undefined {
    return undefined;
  }

  public handleTerminalOutputForCliAgent(terminalId: string, data: string): void {
    this._cliAgentService.detectFromOutput(terminalId, data);
  }

  public getAgentType(terminalId: string): string | null {
    return this._cliAgentService.getAgentState(terminalId).agentType;
  }

  public getConnectedAgents(): Array<{ terminalId: string; agentInfo: { type: string } }> {
    const agent = this._cliAgentService.getConnectedAgent();
    return agent ? [{ terminalId: agent.terminalId, agentInfo: { type: agent.type } }] : [];
  }

  public getDisconnectedAgents(): Map<
    string,
    { type: 'claude' | 'gemini' | 'codex' | 'copilot'; startTime: Date; terminalName?: string }
  > {
    return this._cliAgentService.getDisconnectedAgents();
  }

  public getConnectedAgentTerminalId(): string | null {
    return this._cliAgentService.getConnectedAgent()?.terminalId ?? null;
  }

  public getConnectedAgentType(): 'claude' | 'gemini' | 'codex' | 'copilot' | null {
    const agent = this._cliAgentService.getConnectedAgent();
    if (!agent) return null;
    const validTypes = ['claude', 'gemini', 'codex', 'copilot'] as const;
    return validTypes.includes(agent.type as (typeof validTypes)[number])
      ? (agent.type as 'claude' | 'gemini' | 'codex' | 'copilot')
      : null;
  }

  public switchAiAgentConnection(terminalId: string): {
    success: boolean;
    reason?: string;
    newStatus: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  } {
    if (!this._terminals.has(terminalId)) {
      return { success: false, reason: 'Terminal not found', newStatus: 'none', agentType: null };
    }
    return this._cliAgentService.switchAgentConnection(terminalId);
  }

  public forceReconnectAiAgent(
    terminalId: string,
    agentType: 'claude' | 'gemini' | 'codex' = 'claude'
  ): boolean {
    const terminalName = this._terminals.get(terminalId)?.name;
    return this._cliAgentService.forceReconnectAgent(terminalId, agentType, terminalName);
  }

  public clearAiAgentDetectionError(terminalId: string): boolean {
    return this._cliAgentService.clearDetectionError(terminalId);
  }

  // === Profile Management ===

  public async getAvailableProfiles(): Promise<
    Record<string, import('../types/shared').TerminalProfile>
  > {
    return await this._lifecycleManager.getAvailableProfiles();
  }

  public getDefaultProfile(): string | null {
    return this._lifecycleManager.getDefaultProfile();
  }

  // === Service Management ===

  public setShellIntegrationService(service: any): void {
    this._shellIntegrationService = service;
  }

  public get onTerminalOutput(): vscode.Event<{ terminalId: string; data: string }> {
    if (!this._outputEmitter) {
      this._outputEmitter = new vscode.EventEmitter<{ terminalId: string; data: string }>();
      this.onData((event: TerminalEvent) => {
        this._outputEmitter!.fire({
          terminalId: event.terminalId,
          data: event.data || '',
        });
      });
    }
    return this._outputEmitter.event;
  }

  // === Internal Methods ===

  private _setupTerminalEvents(terminal: TerminalInstance): void {
    this._processCoordinator.setupTerminalEvents(
      terminal,
      (terminalId: string, exitCode: number) => {
        if (this._cleaningTerminals.has(terminalId) || !this._terminals.has(terminalId)) {
          return;
        }
        this._exitEmitter.fire({ terminalId, exitCode });
        this._cleanupTerminalData(terminalId);
      }
    );
  }

  private _cleanupTerminalData(terminalId: string): void {
    if (this._cleaningTerminals.has(terminalId) || !this._terminals.has(terminalId)) {
      return;
    }
    this._cleaningTerminals.add(terminalId);
    try {
      this._processCoordinator.cleanupInitialPromptGuard(terminalId);
      this._processCoordinator.cleanupPtyOutput(terminalId);
      this._dataBufferManager.cleanupBuffer(terminalId);
      this._cliAgentService.handleTerminalRemoved(terminalId);
      this._terminals.delete(terminalId);
      this._terminalRemovedEmitter.fire(terminalId);
      this._stateCoordinator.updateActiveTerminalAfterRemoval(terminalId);
      this._stateCoordinator.notifyStateUpdate();
    } finally {
      this._cleaningTerminals.delete(terminalId);
    }
  }

  public dispose(): void {
    this._dataBufferManager.dispose();
    this._bufferManager.dispose();
    this._processCoordinator.dispose();
    this._lifecycleManager.dispose();
    this._cliAgentService.dispose();
    this._terminals.clear();
    this._dataEmitter.dispose();
    this._exitEmitter.dispose();
    this._terminalCreatedEmitter.dispose();
    this._terminalRemovedEmitter.dispose();
    this._stateUpdateEmitter.dispose();
    this._terminalFocusEmitter.dispose();
    this._outputEmitter?.dispose();
  }
}
