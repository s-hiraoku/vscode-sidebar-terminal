/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as vscode from 'vscode';
import {
  TerminalInstance,
  TerminalEvent,
  TerminalState,
  DeleteResult,
} from '../types/shared';
import {
  PERFORMANCE_CONSTANTS,
} from '../constants';
import { ShellIntegrationService } from '../services/ShellIntegrationService';
import { TerminalProfileService } from '../services/TerminalProfileService';
import { terminal as log } from '../utils/logger';
import {
  getTerminalConfig,
  ActiveTerminalManager,
} from '../utils/common';
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

const ENABLE_TERMINAL_DEBUG_LOGS = process.env.SECONDARY_TERMINAL_DEBUG_LOGS === 'true';

/**
 * TerminalManager - Refactored with Module Coordination Pattern
 *
 * Responsibility: Coordinate between specialized terminal management modules
 * - Delegate to TerminalLifecycleManager for creation/deletion
 * - Delegate to TerminalProcessCoordinator for PTY management
 * - Delegate to TerminalDataBufferManager for output buffering
 * - Delegate to TerminalStateCoordinator for state management
 * - Delegate to TerminalIOCoordinator for input/output operations
 *
 * Integration with Issue #213 services:
 * - Uses TerminalProcessManager (PTY operations)
 * - Uses TerminalValidationService (validation and recovery)
 * - Uses CircularBufferManager (efficient data buffering)
 *
 * Design Pattern: Facade + Coordinator
 * Benefits: Single Responsibility, Testability, Maintainability
 */
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

  // Issue #213 services - PTY operations and validation
  private readonly _processManager: ITerminalProcessManager;
  private readonly _validationService: ITerminalValidationService;
  private readonly _debugLoggingEnabled = ENABLE_TERMINAL_DEBUG_LOGS;

  // Issue #237 Phase 1 - Module coordinators
  private readonly _dataBufferManager: TerminalDataBufferManager;
  private readonly _stateCoordinator: TerminalStateCoordinator;
  private readonly _ioCoordinator: TerminalIOCoordinator;
  private readonly _processCoordinator: TerminalProcessCoordinator;
  private readonly _lifecycleManager: TerminalLifecycleManager;

  // Operation queue for atomic operations
  private operationQueue: Promise<void> = Promise.resolve();

  // Track terminals being killed to prevent infinite loops
  private readonly _terminalBeingKilled = new Set<string>();

  // 🎯 HANDSHAKE PROTOCOL: Track shell integration initialization to prevent duplicates
  private readonly _shellInitialized = new Set<string>();

  // 🎯 HANDSHAKE PROTOCOL: Track PTY output handlers to prevent duplicates and enable deferred start
  private readonly _ptyOutputStarted = new Set<string>();
  private readonly _ptyDataDisposables = new Map<string, vscode.Disposable>();

  // Performance optimization: Circular Buffer Manager for efficient data buffering
  private readonly _bufferManager: CircularBufferManager;
  private readonly _initialPromptGuards = new Map<string, { dispose: () => void }>();

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

  constructor(cliAgentService?: ICliAgentDetectionService) {
    // Initialize terminal number manager with max terminals config
    const config = getTerminalConfig();
    this._terminalNumberManager = new TerminalNumberManager(config.maxTerminals);

    // Initialize Terminal Profile Service
    this._profileService = new TerminalProfileService();

    // Initialize CLI Agent detection service
    this._cliAgentService = cliAgentService || new CliAgentDetectionService();

    // 🚨 FIX: Start heartbeat mechanism for state validation
    this._cliAgentService.startHeartbeat();

    this._terminalSpawner = new TerminalSpawner();

    // Initialize refactored services for issue #213
    this._processManager = new TerminalProcessManager();
    this._validationService = new TerminalValidationService({
      maxTerminals: config.maxTerminals,
    });

    // Initialize Circular Buffer Manager with optimized settings
    this._bufferManager = new CircularBufferManager(
      (terminalId: string, data: string) => {
        this._dataEmitter.fire({ terminalId, data });
      },
      {
        flushInterval: PERFORMANCE_CONSTANTS.OUTPUT_BUFFER_FLUSH_INTERVAL_MS,
        maxDataSize: PERFORMANCE_CONSTANTS.MAX_BUFFER_SIZE_BYTES,
      }
    );

    // Initialize Issue #237 Phase 1 module coordinators
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

  /**
   * Get CLI Agent status change event
   */
  public get onCliAgentStatusChange(): vscode.Event<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }> {
    return this._cliAgentService.onCliAgentStatusChange;
  }

  // =================== LIFECYCLE MANAGEMENT (delegated) ===================

  /**
   * Create terminal with profile support (async version)
   */
  public async createTerminalWithProfile(profileName?: string): Promise<string> {
    return await this._lifecycleManager.createTerminalWithProfile(profileName);
  }

  /**
   * Create terminal (synchronous version without profile)
   */
  public createTerminal(): string {
    return this._lifecycleManager.createTerminal();
  }

  /**
   * Delete terminal with atomic operation
   */
  public async deleteTerminal(
    terminalId: string,
    options: {
      force?: boolean;
      source?: 'header' | 'panel' | 'command';
    } = {}
  ): Promise<DeleteResult> {
    return await this._lifecycleManager.deleteTerminal(terminalId, options);
  }

  /**
   * Check if terminal can be removed
   */
  public canRemoveTerminal(terminalId: string): { canRemove: boolean; reason?: string } {
    return this._lifecycleManager.canRemoveTerminal(terminalId);
  }

  /**
   * Remove terminal immediately
   */
  public removeTerminal(terminalId: string): void {
    this._lifecycleManager.removeTerminal(terminalId);
  }

  /**
   * Get a specific terminal by ID
   */
  public getTerminal(terminalId: string): TerminalInstance | undefined {
    return this._lifecycleManager.getTerminal(terminalId);
  }

  /**
   * Get all terminals
   */
  public getTerminals(): TerminalInstance[] {
    return this._lifecycleManager.getTerminals();
  }

  // =================== PROCESS COORDINATION (delegated) ===================

  /**
   * Initialize shell for a terminal after PTY creation
   */
  public initializeShellForTerminal(terminalId: string, ptyProcess: any, safeMode: boolean): void {
    this._processCoordinator.initializeShellForTerminal(terminalId, ptyProcess, safeMode);
  }

  /**
   * Start PTY output after WebView handshake complete
   */
  public startPtyOutput(terminalId: string): void {
    this._processCoordinator.startPtyOutput(terminalId);
  }

  // =================== STATE MANAGEMENT (delegated) ===================

  /**
   * Get current terminal state
   */
  public getCurrentState(): TerminalState {
    return this._stateCoordinator.getCurrentState();
  }

  /**
   * Check if there is an active terminal
   */
  public hasActiveTerminal(): boolean {
    return this._stateCoordinator.hasActiveTerminal();
  }

  /**
   * Get active terminal ID
   */
  public getActiveTerminalId(): string | undefined {
    return this._stateCoordinator.getActiveTerminalId();
  }

  /**
   * Set active terminal
   */
  public setActiveTerminal(terminalId: string): void {
    this._stateCoordinator.setActiveTerminal(terminalId);
  }

  /**
   * Focus a terminal
   */
  public focusTerminal(terminalId: string): void {
    this._stateCoordinator.focusTerminal(terminalId);
  }

  /**
   * Reorder terminals
   */
  public reorderTerminals(order: string[]): void {
    this._stateCoordinator.reorderTerminals(order);
  }

  /**
   * Update terminal CWD
   */
  public updateTerminalCwd(terminalId: string, cwd: string): void {
    this._stateCoordinator.updateTerminalCwd(terminalId, cwd);
  }

  // =================== I/O OPERATIONS (delegated) ===================

  /**
   * Send input to a terminal
   */
  public sendInput(data: string, terminalId?: string): void {
    this._ioCoordinator.sendInput(data, terminalId);
  }

  /**
   * Resize a terminal
   */
  public resize(cols: number, rows: number, terminalId?: string): void {
    this._ioCoordinator.resize(cols, rows, terminalId);
  }

  /**
   * Write to terminal (public API)
   */
  public writeToTerminal(terminalId: string, data: string): boolean {
    return this._ioCoordinator.writeToTerminal(terminalId, data);
  }

  /**
   * Resize terminal (public API)
   */
  public resizeTerminal(terminalId: string, cols: number, rows: number): boolean {
    return this._ioCoordinator.resizeTerminal(terminalId, cols, rows);
  }

  // =================== LEGACY METHODS (backward compatibility) ===================

  /**
   * @deprecated Use deleteTerminal() with active terminal ID
   */
  public safeKillTerminal(terminalId?: string): boolean {
    const activeId = this._activeTerminalManager.getActive();
    if (!activeId) {
      const message = 'No active terminal to kill';
      log('⚠️ [WARN]', message);
      return false;
    }

    if (terminalId && terminalId !== activeId) {
      log(
        '🔄 [TERMINAL] Requested to safely kill:',
        terminalId,
        'but will kill active terminal:',
        activeId
      );
    }

    const result = this.deleteTerminal(activeId, { source: 'command' });
    return result.then((r) => r.success).catch(() => false) as unknown as boolean;
  }

  /**
   * Kill active terminal
   */
  public killTerminal(terminalId?: string): void {
    const activeId = this._activeTerminalManager.getActive();
    if (!activeId) {
      log('⚠️ [WARN] No active terminal to kill');
      return;
    }

    if (terminalId && terminalId !== activeId) {
      log(
        '🔄 [TERMINAL] Requested to kill:',
        terminalId,
        'but will kill active terminal:',
        activeId
      );
    }

    this.deleteTerminal(activeId, { force: true, source: 'command' }).catch((error) => {
      log('❌ [TERMINAL] Error killing terminal:', error);
    });
  }

  // =================== CLI AGENT INTEGRATION ===================

  /**
   * Check if CLI Agent is connected in a terminal
   */
  public isCliAgentConnected(terminalId: string): boolean {
    const agentState = this._cliAgentService.getAgentState(terminalId);
    return agentState.status === 'connected';
  }

  /**
   * Check if CLI Agent is running in a terminal
   */
  public isCliAgentRunning(terminalId: string): boolean {
    const agentState = this._cliAgentService.getAgentState(terminalId);
    return agentState.status !== 'none';
  }

  /**
   * Get currently globally active CLI Agent
   */
  public getCurrentGloballyActiveAgent(): { terminalId: string; type: string } | null {
    return this._cliAgentService.getConnectedAgent();
  }

  /**
   * Refresh CLI Agent state
   */
  public refreshCliAgentState(): boolean {
    return this._cliAgentService.refreshAgentState();
  }

  /**
   * Get the last executed command for a terminal
   */
  public getLastCommand(_terminalId: string): string | undefined {
    return undefined; // Simplified - command history disabled
  }

  /**
   * Handle terminal output for CLI Agent detection
   */
  public handleTerminalOutputForCliAgent(terminalId: string, data: string): void {
    this._cliAgentService.detectFromOutput(terminalId, data);
  }

  /**
   * Get the active CLI Agent type for a terminal
   */
  public getAgentType(terminalId: string): string | null {
    const agentState = this._cliAgentService.getAgentState(terminalId);
    return agentState.agentType;
  }

  /**
   * Get all active CLI Agents
   */
  public getConnectedAgents(): Array<{ terminalId: string; agentInfo: { type: string } }> {
    const connectedAgent = this._cliAgentService.getConnectedAgent();
    return connectedAgent
      ? [
          {
            terminalId: connectedAgent.terminalId,
            agentInfo: { type: connectedAgent.type },
          },
        ]
      : [];
  }

  /**
   * Get the map of disconnected agents
   */
  public getDisconnectedAgents(): Map<
    string,
    { type: 'claude' | 'gemini' | 'codex' | 'copilot'; startTime: Date; terminalName?: string }
  > {
    return this._cliAgentService.getDisconnectedAgents();
  }

  /**
   * Get the connected agent terminal ID
   */
  public getConnectedAgentTerminalId(): string | null {
    const connectedAgent = this._cliAgentService.getConnectedAgent();
    return connectedAgent ? connectedAgent.terminalId : null;
  }

  /**
   * Get the connected agent type
   */
  public getConnectedAgentType(): 'claude' | 'gemini' | 'codex' | null {
    const connectedAgent = this._cliAgentService.getConnectedAgent();
    return connectedAgent ? (connectedAgent.type as 'claude' | 'gemini' | 'codex') : null;
  }

  /**
   * Switch AI Agent connection
   */
  public switchAiAgentConnection(terminalId: string): {
    success: boolean;
    reason?: string;
    newStatus: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  } {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      return {
        success: false,
        reason: 'Terminal not found',
        newStatus: 'none',
        agentType: null,
      };
    }

    return this._cliAgentService.switchAgentConnection(terminalId);
  }

  /**
   * Force reconnect AI Agent
   */
  public forceReconnectAiAgent(
    terminalId: string,
    agentType: 'claude' | 'gemini' | 'codex' = 'claude'
  ): boolean {
    const terminal = this._terminals.get(terminalId);
    const terminalName = terminal ? terminal.name : undefined;

    log(
      `🔄 [TERMINAL-MANAGER] Force reconnecting AI Agent for terminal ${terminalId} as ${agentType}`
    );
    return this._cliAgentService.forceReconnectAgent(terminalId, agentType, terminalName);
  }

  /**
   * Clear AI Agent detection errors
   */
  public clearAiAgentDetectionError(terminalId: string): boolean {
    log(`🧹 [TERMINAL-MANAGER] Clearing AI Agent detection errors for terminal ${terminalId}`);
    return this._cliAgentService.clearDetectionError(terminalId);
  }

  // =================== PROFILE MANAGEMENT ===================

  /**
   * Get available terminal profiles
   */
  public async getAvailableProfiles(): Promise<
    Record<string, import('../types/shared').TerminalProfile>
  > {
    return await this._lifecycleManager.getAvailableProfiles();
  }

  /**
   * Get default profile name
   */
  public getDefaultProfile(): string | null {
    return this._lifecycleManager.getDefaultProfile();
  }

  // =================== SERVICE MANAGEMENT ===================

  /**
   * Set shell integration service after construction
   */
  public setShellIntegrationService(service: any): void {
    this._shellIntegrationService = service;
  }

  /**
   * Output event emitter for backward compatibility
   */
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

  // =================== INTERNAL METHODS ===================

  /**
   * Setup terminal event handlers
   */
  private _setupTerminalEvents(terminal: TerminalInstance): void {
    this._processCoordinator.setupTerminalEvents(terminal, (terminalId: string, exitCode: number) => {
      // Handle CLI agent termination on process exit
      this._cliAgentService.handleTerminalRemoved(terminalId);

      // Clean up terminal and notify listeners
      this._terminals.delete(terminalId);
      this._terminalRemovedEmitter.fire(terminalId);
      this._exitEmitter.fire({ terminalId, exitCode });
      this._stateCoordinator.notifyStateUpdate();

      log(`🗑️ [TERMINAL] Terminal ${terminalId} cleaned up after exit`);
    });
  }

  /**
   * Cleanup terminal data
   */
  private _cleanupTerminalData(terminalId: string): void {
    log('🧹 [TERMINAL] === CLEANUP TERMINAL DATA START ===');
    log('🧹 [TERMINAL] Cleaning up terminal data:', terminalId);

    // Log terminal info before deletion
    const terminal = this._terminals.get(terminalId);
    if (terminal) {
      log('🧹 [TERMINAL] Deleting terminal:', {
        id: terminalId,
        name: terminal.name,
        number: terminal.number,
        exists: this._terminals.has(terminalId),
      });
    } else {
      log('⚠️ [TERMINAL] Terminal not found in map for cleanup:', terminalId);
    }

    log('🧹 [TERMINAL] Before deletion - terminals count:', this._terminals.size);
    log('🧹 [TERMINAL] Before deletion - terminal IDs:', Array.from(this._terminals.keys()));

    // Stop any pending prompt readiness guard for this terminal
    this._processCoordinator.cleanupInitialPromptGuard(terminalId);

    // Clean up process coordinator resources
    this._processCoordinator.cleanupPtyOutput(terminalId);

    // Clean up data buffers for this terminal
    this._dataBufferManager.cleanupBuffer(terminalId);

    // CLI Agent cleanup handled by service
    this._cliAgentService.handleTerminalRemoved(terminalId);

    // Remove from terminals map
    const deletionResult = this._terminals.delete(terminalId);
    log('🧹 [TERMINAL] Terminal deletion from map:', deletionResult ? 'SUCCESS' : 'FAILED');

    log('🧹 [TERMINAL] After deletion - terminals count:', this._terminals.size);
    log('🧹 [TERMINAL] After deletion - terminal IDs:', Array.from(this._terminals.keys()));

    this._terminalRemovedEmitter.fire(terminalId);

    log('🧹 [TERMINAL] Terminal data cleaned up:', terminalId);
    log('🧹 [TERMINAL] Remaining terminals:', Array.from(this._terminals.keys()));
    log(
      '🧹 [TERMINAL] Remaining terminal numbers:',
      Array.from(this._terminals.values()).map((t) => ({ id: t.id, number: t.number }))
    );

    // Force check if terminals map is actually empty and can create should return true
    if (this._terminals.size === 0) {
      log('✅ [TERMINAL] All terminals deleted - canCreate should return TRUE');
    }

    // Update active terminal after removal
    this._stateCoordinator.updateActiveTerminalAfterRemoval(terminalId);

    // Force state notification update
    log('🧹 [TERMINAL] Notifying state update after cleanup...');
    this._stateCoordinator.notifyStateUpdate();
    log('🧹 [TERMINAL] === CLEANUP TERMINAL DATA END ===');
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    // Dispose module coordinators
    this._dataBufferManager.dispose();
    this._processCoordinator.dispose();
    this._lifecycleManager.dispose();

    // Dispose CLI Agent detection service
    this._cliAgentService.dispose();

    // Clear terminals map
    this._terminals.clear();

    // Dispose event emitters
    this._dataEmitter.dispose();
    this._exitEmitter.dispose();
    this._terminalCreatedEmitter.dispose();
    this._terminalRemovedEmitter.dispose();
    this._stateUpdateEmitter.dispose();
    this._terminalFocusEmitter.dispose();

    if (this._outputEmitter) {
      this._outputEmitter.dispose();
    }
  }
}
