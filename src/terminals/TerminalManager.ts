/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as vscode from 'vscode';
import {
  TerminalInstance,
  TerminalEvent,
  TerminalState,
  TerminalInfo,
  DeleteResult,
  ProcessState,
} from '../types/shared';
import {
  ERROR_MESSAGES,
  PERFORMANCE_CONSTANTS,
  TIMING_CONSTANTS,
} from '../constants';
import { TERMINAL_CONSTANTS } from '../constants/SystemConstants';
import { ShellIntegrationService } from '../services/ShellIntegrationService';
import { TerminalProfileService } from '../services/TerminalProfileService';
import { terminal as log } from '../utils/logger';
import {
  getTerminalConfig,
  getShellForPlatform,
  getWorkingDirectory,
  generateTerminalId,
  generateTerminalName,
  showErrorMessage,
  showWarningMessage,
  ActiveTerminalManager,
  getFirstValue,
} from '../utils/common';
import { TerminalNumberManager } from '../utils/TerminalNumberManager';
import { CliAgentDetectionService } from '../services/CliAgentDetectionService';
import { ICliAgentDetectionService } from '../interfaces/CliAgentService';
import { TerminalSpawner } from './TerminalSpawner';
import type { IDisposable } from '@homebridge/node-pty-prebuilt-multiarch';
import {
  TerminalProcessManager,
  ITerminalProcessManager,
} from '../services/TerminalProcessManager';
import {
  TerminalValidationService,
  ITerminalValidationService,
} from '../services/TerminalValidationService';
import { CircularBufferManager } from '../utils/CircularBufferManager';

const ENABLE_TERMINAL_DEBUG_LOGS = process.env.SECONDARY_TERMINAL_DEBUG_LOGS === 'true';
// Removed unused service imports - these were for the RefactoredTerminalManager which was removed

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
  // Terminal Profile Service for VS Code standard profiles
  private readonly _profileService: TerminalProfileService;
  // CLI Agent Detection Service (extracted for SRP)
  private readonly _cliAgentService: ICliAgentDetectionService;
  private readonly _terminalSpawner: TerminalSpawner;
  // Terminal Process Manager (PTY operations)
  private readonly _processManager: ITerminalProcessManager;
  // Terminal Validation Service (validation and recovery)
  private readonly _validationService: ITerminalValidationService;
  private readonly _debugLoggingEnabled = ENABLE_TERMINAL_DEBUG_LOGS;

  // 操作の順序保証のためのキュー
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

  // CLI Agent detection moved to service - cache removed from TerminalManager

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
      (terminalId: string, data: string) => this._handleBufferFlush(terminalId, data),
      {
        flushInterval: 16, // ~60fps for smooth output
        bufferCapacity: 50,
        maxDataSize: 1000,
        debug: false, // Set to true for debugging
      }
    );

    log('🚀 [TERMINAL-MANAGER] Initialized with refactored services (issue #213)');
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

  /**
   * Resolve terminal profile for shell configuration
   * @param requestedProfile Optional profile name to use
   * @returns Promise resolving to profile configuration
   */
  private async resolveTerminalProfile(requestedProfile?: string): Promise<{
    shell: string;
    shellArgs: string[];
    cwd?: string;
    env?: Record<string, string | null>;
  }> {
    try {
      const profileResult = await this._profileService.resolveProfile(requestedProfile);
      log(
        `🔍 [TERMINAL] Resolved profile: ${profileResult.profileName} (source: ${profileResult.source})`
      );

      return {
        shell: profileResult.profile.path,
        shellArgs: profileResult.profile.args || [],
        cwd: profileResult.profile.cwd,
        env: profileResult.profile.env,
      };
    } catch (error) {
      log(`⚠️ [TERMINAL] Profile resolution failed: ${error}, falling back to default config`);
      // Fallback to existing configuration system
      const config = getTerminalConfig();
      return {
        shell: getShellForPlatform(),
        shellArgs: config.shellArgs || [],
      };
    }
  }

  /**
   * Create terminal with profile support (async version)
   * @param profileName Optional profile name to use
   * @returns Promise<string> Terminal ID
   */
  public async createTerminalWithProfile(profileName?: string): Promise<string> {
    log('🔍 [TERMINAL] === CREATE TERMINAL WITH PROFILE CALLED ===');

    const config = getTerminalConfig();
    log(`🔍 [TERMINAL] Config loaded: maxTerminals=${config.maxTerminals}`);

    // Check if we can create new terminal
    const canCreateResult = this._terminalNumberManager.canCreate(this._terminals);
    log('🔍 [TERMINAL] canCreate() returned:', canCreateResult);

    if (!canCreateResult) {
      log('🚨 [TERMINAL] Cannot create terminal: all slots used');
      showWarningMessage(
        'Maximum number of terminals reached. Please close some terminals before creating new ones.'
      );
      return '';
    }

    // Generate terminal ID and resolve profile
    const terminalId = generateTerminalId();
    const profileConfig = await this.resolveTerminalProfile(profileName);

    const cwd = profileConfig.cwd || getWorkingDirectory();
    log(
      `🔍 [TERMINAL] Creating terminal with profile: ID=${terminalId}, Shell=${profileConfig.shell}, CWD=${cwd}`
    );

    try {
      // Prepare environment variables with profile env merged
      const env = {
        ...process.env,
        PWD: cwd,
        // Add VS Code workspace information if available
        ...(vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders.length > 0 && {
            VSCODE_WORKSPACE: vscode.workspace.workspaceFolders[0]?.uri.fsPath || '',
            VSCODE_PROJECT_NAME: vscode.workspace.workspaceFolders[0]?.name || '',
          }),
        // Merge profile environment variables
        ...(profileConfig.env && profileConfig.env),
      } as { [key: string]: string };

      const { ptyProcess } = this._terminalSpawner.spawnTerminal({
        terminalId,
        shell: profileConfig.shell,
        shellArgs: profileConfig.shellArgs || [],
        cwd,
        env,
      });

      // Get terminal number from manager
      const terminalNumber = this._terminalNumberManager.findAvailableNumber(this._terminals);
      if (!terminalNumber) {
        throw new Error('Unable to assign terminal number');
      }

      const terminal: TerminalInstance = {
        id: terminalId,
        name: generateTerminalName(terminalNumber),
        number: terminalNumber,
        pty: ptyProcess, // 互換性のため
        ptyProcess, // 新しい参照名
        cwd,
        isActive: false,
        createdAt: new Date(),
      };

      // Store terminal and set it as active
      this._terminals.set(terminalId, terminal);
      this._activeTerminalManager.setActive(terminalId);

      // CLI Agent detection will be handled by the service automatically

      // Set up terminal event handlers
      this._setupTerminalEvents(terminal);

      log(`✅ [TERMINAL] Terminal created successfully: ${terminalId} (${terminal.name})`);
      this._terminalCreatedEmitter.fire(terminal);
      this._notifyStateUpdate();

      // 🎯 TIMING FIX: Shell initialization moved to _handleTerminalInitializationComplete
      // This ensures WebView terminal is fully ready before shell initialization

      return terminalId;
    } catch (error) {
      log(`❌ [TERMINAL] Failed to create terminal with profile: ${error}`);
      showErrorMessage(`Failed to create terminal: ${error}`);
      return '';
    }
  }

  /**
   * Validate terminal creation constraints
   * @returns Validation result with config if successful
   * @private
   */
  private validateTerminalCreation(): { canCreate: boolean; config: ReturnType<typeof getTerminalConfig> } {
    log('🔍 [TERMINAL] === CREATE TERMINAL CALLED ===');

    const config = getTerminalConfig();
    log(`🔍 [TERMINAL] Config loaded: maxTerminals=${config.maxTerminals}`);
    log(`🔍 [TERMINAL] Current terminals count: ${this._terminals.size}`);

    // Debug terminal state before validation
    this.debugLog('🔍 [TERMINAL] Current terminals in map:', this._terminals.size);
    for (const [id, terminal] of this._terminals.entries()) {
      this.debugLog(`🔍 [TERMINAL] Map entry: ${id} -> ${terminal.name} (number: ${terminal.number})`);
    }

    // Check if terminal creation is allowed
    const canCreateResult = this._terminalNumberManager.canCreate(this._terminals);
    log('🔍 [TERMINAL] canCreate() returned:', canCreateResult);

    if (!canCreateResult) {
      log('🚨 [TERMINAL] Cannot create terminal: all slots used');

      // Critical bug check: empty map but cannot create
      if (this._terminals.size === 0) {
        log('🚨 [TERMINAL] CRITICAL BUG: No terminals exist but canCreate returned FALSE!');
        // Allow creation to proceed
      } else {
        showWarningMessage(`${ERROR_MESSAGES.MAX_TERMINALS_REACHED} (${config.maxTerminals})`);
        return { canCreate: false, config };
      }
    }

    return { canCreate: true, config };
  }

  /**
   * Resolve terminal configuration including ID, number, shell, and cwd
   * @returns Configuration object for terminal creation
   * @private
   */
  private resolveTerminalConfiguration(): {
    terminalId: string;
    terminalNumber: number;
    shell: string;
    shellArgs: string[];
    cwd: string;
  } {
    log('🔍 [TERMINAL] Resolving terminal configuration...');

    const config = getTerminalConfig();
    const terminalNumber = this._terminalNumberManager.findAvailableNumber(this._terminals);
    log(`🔍 [TERMINAL] Found available terminal number: ${terminalNumber}`);

    const terminalId = generateTerminalId();
    log(`🔍 [TERMINAL] Generated terminal ID: ${terminalId}`);

    const shell = getShellForPlatform();
    const shellArgs = config.shellArgs;
    const cwd = getWorkingDirectory();

    log(
      `🔍 [TERMINAL] Configuration resolved: ID=${terminalId}, Shell=${shell}, CWD=${cwd}`
    );

    return { terminalId, terminalNumber, shell, shellArgs, cwd };
  }

  /**
   * Prepare environment variables for terminal process
   * @param cwd Working directory for the terminal
   * @returns Environment variables object
   * @private
   */
  private prepareEnvironmentVariables(cwd: string): Record<string, string> {
    const env = {
      ...process.env,
      PWD: cwd,
      // Add VS Code workspace information if available
      ...(vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0 && {
          VSCODE_WORKSPACE: vscode.workspace.workspaceFolders[0]?.uri.fsPath || '',
          VSCODE_PROJECT_NAME: vscode.workspace.workspaceFolders[0]?.name || '',
        }),
    } as Record<string, string>;

    // Debug log environment variables if debugging is enabled
    if (this._debugLoggingEnabled) {
      const espidxRelatedEnvs = Object.keys(env).filter(
        (key) =>
          key.includes('ESP') || key.includes('IDF') || key.includes('PYTHON') || key === 'PATH'
      );
      espidxRelatedEnvs.forEach((key) => {
        const value = env[key];
        if (value && value.length > 100) {
          this.debugLog(
            `🔍 [ENV-DEBUG] ${key}=${value.substring(0, 100)}... (truncated ${value.length} chars)`
          );
        } else {
          this.debugLog(`🔍 [ENV-DEBUG] ${key}=${value}`);
        }
      });
    }

    return env;
  }

  /**
   * Spawn terminal process using configured parameters
   * @param params Process spawn parameters
   * @returns PTY process instance
   * @private
   */
  private spawnTerminalProcess(params: {
    terminalId: string;
    shell: string;
    shellArgs: string[];
    cwd: string;
    env: Record<string, string>;
  }): any {
    log(
      `🔍 [TERMINAL] Spawning process: Shell=${params.shell}, Args=${JSON.stringify(params.shellArgs)}`
    );

    const { ptyProcess } = this._terminalSpawner.spawnTerminal(params);

    log(`✅ [TERMINAL] Process spawned successfully for ${params.terminalId}`);
    return ptyProcess;
  }

  /**
   * Create terminal instance object and register it
   * @param params Terminal instance parameters
   * @returns Created terminal instance
   * @private
   */
  private createTerminalInstance(params: {
    terminalId: string;
    terminalNumber: number;
    cwd: string;
    ptyProcess: any;
  }): TerminalInstance {
    const terminal: TerminalInstance = {
      id: params.terminalId,
      pty: params.ptyProcess,
      ptyProcess: params.ptyProcess,
      name: generateTerminalName(params.terminalNumber),
      number: params.terminalNumber,
      cwd: params.cwd,
      isActive: true,
      createdAt: new Date(),
    };

    // Set all other terminals as inactive and register new terminal
    this._deactivateAllTerminals();
    this._terminals.set(params.terminalId, terminal);
    this._activeTerminalManager.setActive(params.terminalId);

    log(`✅ [TERMINAL] Terminal instance created: ${terminal.name} (${params.terminalId})`);
    return terminal;
  }

  /**
   * Register event handlers for terminal process
   * @param terminalId Terminal identifier
   * @param ptyProcess PTY process instance
   * @private
   */
  private registerTerminalEvents(terminalId: string, ptyProcess: any): void {
    log(`🔍 [TERMINAL] Registering event handlers for ${terminalId}`);

    // Register PTY exit handler
    ptyProcess.onExit((event: number | { exitCode: number; signal?: number }) => {
      const exitCode = typeof event === 'number' ? event : event.exitCode;
      log('🚪 [PTY-EXIT] Terminal exited:', terminalId, 'ExitCode:', exitCode);

      this._cliAgentService.handleTerminalRemoved(terminalId);
      this._exitEmitter.fire({ terminalId, exitCode });
      this._removeTerminal(terminalId);
    });

    // Verify PTY write capability
    if (ptyProcess && typeof ptyProcess.write === 'function') {
      log(`✅ [TERMINAL] PTY write capability verified for ${terminalId}`);
    } else {
      log(`❌ [TERMINAL] PTY write method not available for ${terminalId}`);
    }

    log(`✅ [TERMINAL] Event handlers registered for ${terminalId}`);
  }

  public createTerminal(): string {
    try {
      // 1. Validate terminal creation
      const validation = this.validateTerminalCreation();
      if (!validation.canCreate) {
        return this._activeTerminalManager.getActive() || '';
      }

      // 2. Resolve terminal configuration
      const config = this.resolveTerminalConfiguration();

      // 3. Prepare environment variables
      const env = this.prepareEnvironmentVariables(config.cwd);

      // 4. Spawn terminal process
      const ptyProcess = this.spawnTerminalProcess({
        terminalId: config.terminalId,
        shell: config.shell,
        shellArgs: config.shellArgs,
        cwd: config.cwd,
        env,
      });

      // 5. Create terminal instance
      const terminal = this.createTerminalInstance({
        terminalId: config.terminalId,
        terminalNumber: config.terminalNumber,
        cwd: config.cwd,
        ptyProcess,
      });

      // 6. Register terminal events
      this.registerTerminalEvents(config.terminalId, ptyProcess);

      // Fire terminal created event
      this._terminalCreatedEmitter.fire(terminal);

      // Notify state update
      log('🔍 [TERMINAL] Notifying state update...');
      this._notifyStateUpdate();

      log(`🔍 [TERMINAL] === CREATE TERMINAL FINISHED: ${config.terminalId} ===`);
      return config.terminalId;
    } catch (error) {
      log(
        `❌ [TERMINAL] Error creating terminal: ${error instanceof Error ? error.message : String(error)}`
      );
      showErrorMessage(
        ERROR_MESSAGES.TERMINAL_CREATION_FAILED,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

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
        this._ensureInitialPrompt(terminalId, ptyProcess);
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

    log(`🎯 [TERMINAL] Starting PTY output for ${terminalId} after handshake`);

    // Register PTY data handler
    const dataDisposable = terminal.ptyProcess.onData((data: string) => {
      // Update process state to running on first data
      if (terminal.processState === ProcessState.Launching) {
        terminal.processState = ProcessState.Running;
        this._notifyProcessStateChange(terminal, ProcessState.Running);
      }

      // Process shell integration sequences if service is available
      try {
        if (this._shellIntegrationService) {
          this._shellIntegrationService.processTerminalData(terminalId, data);
        }
      } catch (error) {
        log(`⚠️ [TERMINAL] Shell integration processing error: ${error}`);
      }

      // Buffer data for efficient output
      this._bufferData(terminalId, data);
    });

    // Store disposable for cleanup
    this._ptyDataDisposables.set(terminalId, dataDisposable);

    // Mark as started
    this._ptyOutputStarted.add(terminalId);

    log(`✅ [TERMINAL] PTY output started successfully for ${terminalId}`);
  }

  /**
   * ターミナルにフォーカスを移す
   * 🚨 IMPORTANT: Focus should NOT change CLI Agent status (spec compliance)
   */
  public focusTerminal(terminalId: string): void {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      log('⚠️ [WARN] Terminal not found for focus:', terminalId);
      return;
    }

    // 🚨 CRITICAL: フォーカス変更はCLI Agent状態に影響しない（仕様書準拠）
    // Only fire focus event, do not change CLI Agent status
    this._terminalFocusEmitter.fire(terminalId);
    log(`🎯 [TERMINAL] Focused: ${terminal.name} (NO status change - spec compliant)`);
  }

  public sendInput(data: string, terminalId?: string): void {
    // ✅ CRITICAL FIX: Robust terminal ID resolution with complete validation
    let resolvedTerminalId: string;

    if (terminalId) {
      // Use provided terminal ID, but validate it exists and is active
      if (!this._terminals.has(terminalId)) {
        log(`🚨 [TERMINAL] Provided terminal ID does not exist: ${terminalId}`);
        this.debugLog('🔍 [TERMINAL] Available terminals:', Array.from(this._terminals.keys()));

        // Fallback to active terminal
        const activeId = this._activeTerminalManager.getActive();
        if (!activeId) {
          log('🚨 [TERMINAL] No active terminal available as fallback');
          return;
        }
        resolvedTerminalId = activeId;
        log(`⚠️ [TERMINAL] Using active terminal as fallback: ${resolvedTerminalId}`);
      } else {
        resolvedTerminalId = terminalId;
      }
    } else {
      // Get currently active terminal
      const activeId = this._activeTerminalManager.getActive();
      if (!activeId) {
        log('🚨 [TERMINAL] No active terminal ID available');
        this.debugLog('🔍 [TERMINAL] Available terminals:', Array.from(this._terminals.keys()));
        return;
      }

      // Validate the active terminal still exists
      if (!this._terminals.has(activeId)) {
        log(`🚨 [TERMINAL] Active terminal ID ${activeId} no longer exists`);

        // Emergency: Find first available terminal
        const availableTerminals = Array.from(this._terminals.keys());
        if (availableTerminals.length === 0) {
          log('🚨 [TERMINAL] No terminals available at all');
          return;
        }

        const emergencyTerminal = availableTerminals[0];
        if (!emergencyTerminal) {
          log('🚨 [TERMINAL] Emergency terminal is undefined');
          return;
        }
        this._activeTerminalManager.setActive(emergencyTerminal);
        resolvedTerminalId = emergencyTerminal;
        log(
          `⚠️ [TERMINAL] Emergency fallback to first available terminal: ${resolvedTerminalId}`
        );
      } else {
        resolvedTerminalId = activeId;
      }
    }

    // ✅ FINAL VALIDATION: Ensure terminal exists and get instance
    const terminal = this._terminals.get(resolvedTerminalId);
    if (!terminal) {
      log(`🚨 [TERMINAL] Terminal resolution failed for ID: ${resolvedTerminalId}`);
      return;
    }

    this.debugLog(
      `⌨️ [TERMINAL] Sending input to ${terminal.name} (${resolvedTerminalId}): ${data.length} chars`
    );

    try {
      // CLI Agent コマンドを検出
      this._cliAgentService.detectFromInput(resolvedTerminalId, data);

      // ✅ ENHANCED: Robust PTY writing with comprehensive validation
      const result = this._writeToPtyWithValidation(terminal, data);
      if (!result.success) {
        log(`🚨 [TERMINAL] PTY write failed for ${terminal.name}: ${result.error}`);

        // Attempt recovery with alternative PTY instance
        this.debugLog(`🔄 [TERMINAL] Attempting PTY recovery for ${terminal.name}...`);
        const recovered = this._attemptPtyRecovery(terminal, data);
        if (!recovered) {
          throw new Error(result.error || 'PTY write failed and recovery unsuccessful');
        }
        this.debugLog(`✅ [TERMINAL] PTY recovery successful for ${terminal.name}`);
      } else {
        this.debugLog(`✅ [TERMINAL] Input sent successfully to ${terminal.name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(
        `❌ [TERMINAL] Critical error sending input to ${terminal.name}:`,
        errorMessage
      );

      // Enhanced error logging with complete terminal state
      log('❌ [TERMINAL] Terminal state at failure:', {
        id: terminal.id,
        name: terminal.name,
        number: terminal.number,
        isActive: terminal.isActive,
        hasPty: !!terminal.pty,
        hasPtyProcess: !!terminal.ptyProcess,
        ptyType: terminal.pty ? typeof terminal.pty : 'undefined',
        ptyProcessType: terminal.ptyProcess ? typeof terminal.ptyProcess : 'undefined',
        ptyWritable: terminal.pty ? typeof terminal.pty.write : 'no pty',
        ptyProcessWritable:
          terminal.ptyProcess &&
          typeof terminal.ptyProcess === 'object' &&
          'write' in terminal.ptyProcess
            ? typeof (terminal.ptyProcess as any).write
            : 'no ptyProcess',
        createdAt: terminal.createdAt,
        cwd: terminal.cwd,
      });

      showErrorMessage(`Terminal input failed for ${terminal.name}: ${errorMessage}`, error instanceof Error ? error.message : String(error));
    }
  }

  public resize(cols: number, rows: number, terminalId?: string): void {
    const id = terminalId || this._activeTerminalManager.getActive();
    if (!id) {
      log('⚠️ [WARN] No terminal ID provided and no active terminal for resize');
      return;
    }

    const terminal = this._terminals.get(id);
    if (!terminal) {
      log('⚠️ [WARN] Terminal not found for resize:', id);
      return;
    }

    try {
      // Enhanced PTY resize with validation
      const result = this._resizePtyWithValidation(terminal, cols, rows);
      if (!result.success) {
        throw new Error(result.error || 'PTY resize failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('❌ [ERROR] Failed to resize terminal:', errorMessage);
      log('❌ [ERROR] Resize parameters:', { cols, rows, terminalId: id });
    }
  }

  public hasActiveTerminal(): boolean {
    return this._activeTerminalManager.hasActive();
  }

  public getActiveTerminalId(): string | undefined {
    return this._activeTerminalManager.getActive();
  }

  public getTerminals(): TerminalInstance[] {
    return Array.from(this._terminals.values());
  }

  public reorderTerminals(order: string[]): void {
    if (!Array.isArray(order) || order.length === 0) {
      return;
    }

    const existingEntries = Array.from(this._terminals.entries());
    const existingMap = new Map(existingEntries);

    const normalizedOrder = order.filter((id) => existingMap.has(id));
    const remaining = existingEntries
      .map(([id]) => id)
      .filter((id) => !normalizedOrder.includes(id));
    const finalOrder = [...normalizedOrder, ...remaining];

    if (finalOrder.length === 0) {
      return;
    }

    this._terminals.clear();

    for (const id of finalOrder) {
      const terminal = existingMap.get(id);
      if (terminal) {
        this._terminals.set(id, terminal);
      }
    }

    this._notifyStateUpdate();
  }

  /**
   * Get a specific terminal by ID
   */
  public getTerminal(terminalId: string): TerminalInstance | undefined {
    return this._terminals.get(terminalId);
  }

  public setActiveTerminal(terminalId: string): void {
    const terminal = this._terminals.get(terminalId);
    if (terminal) {
      this._deactivateAllTerminals();
      terminal.isActive = true;
      this._activeTerminalManager.setActive(terminalId);
    }
  }

  public updateTerminalCwd(terminalId: string, cwd: string): void {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      return;
    }

    terminal.cwd = cwd;
  }

  public removeTerminal(terminalId: string): void {
    this._removeTerminal(terminalId);
  }

  /**
   * ターミナルが削除可能かチェック（統一された検証ロジック）
   * Delegates to TerminalValidationService (issue #213 refactoring)
   */
  private _validateDeletion(terminalId: string): { canDelete: boolean; reason?: string } {
    // Delegate to validation service
    const result = this._validationService.validateDeletion(terminalId, this._terminals, false);
    return { canDelete: result.success, reason: result.error };
  }

  /**
   * ターミナルが削除可能かチェック（公開API、後方互換性のため維持）
   */
  public canRemoveTerminal(terminalId: string): { canRemove: boolean; reason?: string } {
    const validation = this._validateDeletion(terminalId);
    return { canRemove: validation.canDelete, reason: validation.reason };
  }


  /**
   * 統一されたターミナル削除メソッド
   * 指定されたターミナルIDを削除し、新しい状態を返す
   */
  public async deleteTerminal(
    terminalId: string,
    options: {
      force?: boolean;
      source?: 'header' | 'panel' | 'command';
    } = {}
  ): Promise<DeleteResult> {
    // 操作をキューに追加してレースコンディションを防ぐ
    return new Promise<DeleteResult>((resolve, reject) => {
      this.operationQueue = this.operationQueue.then(() => {
        try {
          const result = this.performDeleteOperation(terminalId, options);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * アトミックな削除処理
   */
  private performDeleteOperation(
    terminalId: string,
    options: {
      force?: boolean;
      source?: 'header' | 'panel' | 'command';
    }
  ): DeleteResult {
    log(
      `🗑️ [DELETE] Starting delete operation for terminal: ${terminalId} (source: ${options.source || 'unknown'})`
    );

    // 1. 削除前の検証（forceオプションがない場合）
    if (!options.force) {
      const validation = this._validateDeletion(terminalId);
      if (!validation.canDelete) {
        log(`⚠️ [DELETE] Cannot delete terminal: ${validation.reason}`);
        showWarningMessage(validation.reason || 'Cannot delete terminal');
        return { success: false, reason: validation.reason };
      }
    }

    // 2. ターミナルの存在確認
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      log(`⚠️ [DELETE] Terminal not found: ${terminalId}`);
      return { success: false, reason: 'Terminal not found' };
    }

    try {
      // 3. プロセスの終了
      log(`🗑️ [DELETE] Killing terminal process: ${terminalId}`);
      this._terminalBeingKilled.add(terminalId);
      const p = (terminal.ptyProcess || terminal.pty) as { kill?: () => void } | undefined;
      if (p && typeof p.kill === 'function') {
        p.kill();
      }

      // 4. 状態の更新は onExit ハンドラで行われる
      log(`✅ [DELETE] Delete operation completed for: ${terminalId}`);

      // 5. 新しい状態を返す (非同期なので現在の状態を返す)
      return { success: true, newState: this.getCurrentState() };
    } catch (error) {
      log(`❌ [DELETE] Error during delete operation:`, error);
      this._terminalBeingKilled.delete(terminalId);
      return { success: false, reason: `Delete failed: ${String(error)}` };
    }
  }

  /**
   * 現在の状態を取得
   */
  public getCurrentState(): TerminalState {
    const terminals: TerminalInfo[] = Array.from(this._terminals.values()).map((terminal) => ({
      id: terminal.id,
      name: terminal.name,
      isActive: terminal.isActive,
    }));

    return {
      terminals,
      activeTerminalId: this._activeTerminalManager.getActive() || null,
      maxTerminals: getTerminalConfig().maxTerminals,
      availableSlots: this._getAvailableSlots(),
    };
  }

  /**
   * 利用可能なスロットを取得
   */
  private _getAvailableSlots(): number[] {
    return this._terminalNumberManager.getAvailableSlots(this._terminals);
  }

  /**
   * WebView に状態更新を通知
   */
  private _notifyStateUpdate(): void {
    const state = this.getCurrentState();
    this._stateUpdateEmitter.fire(state);
    log(`📡 [STATE] State update notification sent:`, state);
  }

  /**
   * Notify process state changes for better lifecycle tracking
   * Based on VS Code's process state management patterns
   */
  private _notifyProcessStateChange(terminal: TerminalInstance, newState: ProcessState): void {
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
      timestamp: Date.now()
    } as any);

    // Handle state-specific actions
    this._handleProcessStateActions(terminal, newState, previousState);
  }

  /**
   * Handle actions based on process state changes
   */
  private _handleProcessStateActions(
    terminal: TerminalInstance,
    newState: ProcessState,
    _previousState?: ProcessState
  ): void {
    switch (newState) {
      case ProcessState.Launching:
        // Setup launch timeout monitoring
        this._setupLaunchTimeout(terminal);
        break;

      case ProcessState.Running:
        // Clear any launch timeouts
        this._clearLaunchTimeout(terminal);
        break;

      case ProcessState.KilledDuringLaunch:
        log(`⚠️ [PROCESS] Terminal ${terminal.id} killed during launch - potential configuration issue`);
        this._handleLaunchFailure(terminal);
        break;

      case ProcessState.KilledByUser:
        log(`ℹ️ [PROCESS] Terminal ${terminal.id} killed by user request`);
        break;

      case ProcessState.KilledByProcess:
        log(`⚠️ [PROCESS] Terminal ${terminal.id} process terminated unexpectedly`);
        this._attemptProcessRecovery(terminal);
        break;
    }
  }

  /**
   * Setup launch timeout monitoring
   */
  private _setupLaunchTimeout(terminal: TerminalInstance): void {
    const timeoutMs = 10000; // 10 seconds timeout

    setTimeout(() => {
      if (terminal.processState === ProcessState.Launching) {
        log(`⏰ [PROCESS] Terminal ${terminal.id} launch timeout - marking as failed`);
        terminal.processState = ProcessState.KilledDuringLaunch;
        this._notifyProcessStateChange(terminal, ProcessState.KilledDuringLaunch);
      }
    }, timeoutMs);
  }

  /**
   * Clear launch timeout (if any)
   */
  private _clearLaunchTimeout(terminal: TerminalInstance): void {
    // Implementation would clear any active timeout for this terminal
    // For now, just log the successful launch
    log(`✅ [PROCESS] Terminal ${terminal.id} launched successfully`);
  }

  /**
   * Handle launch failure with recovery options
   */
  private _handleLaunchFailure(terminal: TerminalInstance): void {
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
  private _attemptProcessRecovery(terminal: TerminalInstance): void {
    if (terminal.shouldPersist && terminal.persistentProcessId) {
      log(`🔄 [RECOVERY] Attempting recovery for persistent terminal ${terminal.id}`);
      // Implementation would attempt to reconnect to persistent process
      // For now, just log the recovery attempt
    } else {
      log(`ℹ️ [RECOVERY] Terminal ${terminal.id} terminated normally (no recovery needed)`);
    }
  }

  /**
   * 安全なターミナルキル（削除前の検証付き、後方互換性のため維持）
   * 常にアクティブターミナルをkillする
   * @deprecated Use deleteTerminal() with active terminal ID
   */
  public safeKillTerminal(terminalId?: string): boolean {
    const activeId = this._activeTerminalManager.getActive();
    if (!activeId) {
      const message = 'No active terminal to kill';
      log('⚠️ [WARN]', message);
      showWarningMessage(message);
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

  public killTerminal(terminalId?: string): void {
    // According to the spec: always kill the ACTIVE terminal, ignore provided ID
    const activeId = this._activeTerminalManager.getActive();
    if (!activeId) {
      log('⚠️ [WARN] No active terminal to kill');
      showWarningMessage('No active terminal to kill');
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

    // Use unified delete method with force option
    this.deleteTerminal(activeId, { force: true, source: 'command' }).catch((error) => {
      log('❌ [TERMINAL] Error killing terminal:', error);
    });
  }

  /**
   * Set shell integration service after construction
   */
  public setShellIntegrationService(service: any): void {
    this._shellIntegrationService = service;
  }

  public dispose(): void {
    // Dispose CircularBufferManager (flushes and cleans up all buffers)
    this._bufferManager.dispose();

    // Clear kill tracking
    this._terminalBeingKilled.clear();

    // 🔧 FIX: Dispose PTY data listeners to prevent memory leaks
    for (const disposable of this._ptyDataDisposables.values()) {
      disposable.dispose();
    }
    this._ptyDataDisposables.clear();

    // 🔧 FIX: Clean up initial prompt guards
    for (const guard of this._initialPromptGuards.values()) {
      guard.dispose();
    }
    this._initialPromptGuards.clear();

    // Dispose CLI Agent detection service
    this._cliAgentService.dispose();

    for (const terminal of this._terminals.values()) {
      const p = (terminal.ptyProcess || terminal.pty) as { kill?: () => void } | undefined;
      if (p && typeof p.kill === 'function') {
        p.kill();
      }
    }
    this._terminals.clear();
    this._dataEmitter.dispose();
    this._exitEmitter.dispose();
    this._terminalCreatedEmitter.dispose();
    this._terminalRemovedEmitter.dispose();
    this._stateUpdateEmitter.dispose();
    this._terminalFocusEmitter.dispose();

    // 🔧 FIX: Dispose output emitter if it was created
    if (this._outputEmitter) {
      this._outputEmitter.dispose();
    }
  }

  // Performance optimization: Buffer data to reduce event frequency
  private _bufferData(terminalId: string, data: string): void {
    // ✅ CRITICAL FIX: Strict terminal ID validation to prevent cross-terminal contamination
    if (!terminalId || typeof terminalId !== 'string') {
      log('🚨 [TERMINAL] Invalid terminalId for data buffering:', terminalId);
      return;
    }

    // Validate terminal exists before buffering data
    if (!this._terminals.has(terminalId)) {
      log(
        `⚠️ [TERMINAL] Attempting to buffer data for non-existent terminal: ${terminalId}`
      );
      return;
    }

    // Delegate to CircularBufferManager for efficient buffering
    this._bufferManager.bufferData(terminalId, data);
  }

  /**
   * Handle buffer flush from CircularBufferManager
   * This is called by the global timer or on immediate flush conditions
   */
  private _handleBufferFlush(terminalId: string, data: string): void {
    // Double-check terminal still exists
    if (!this._terminals.has(terminalId)) {
      console.warn(`⚠️ [TERMINAL] Cannot flush buffer for removed terminal: ${terminalId}`);
      return;
    }

    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      console.error(`🚨 [TERMINAL] Terminal disappeared during flush: ${terminalId}`);
      return;
    }

    // Send to CLI Agent detection service with validation
    try {
      this._cliAgentService.detectFromOutput(terminalId, data);
    } catch (error) {
      console.warn(`⚠️ [TERMINAL] CLI Agent detection failed for ${terminalId}:`, error);
    }

    // ✅ EMIT DATA WITH STRICT TERMINAL ID ASSOCIATION
    this.debugLog(
      `📤 [TERMINAL] Flushing data for terminal ${terminal.name} (${terminalId}): ${data.length} chars`
    );
    this._dataEmitter.fire({
      terminalId: terminalId, // Ensure exact ID match
      data: data,
      timestamp: Date.now(), // Add timestamp for debugging
      terminalName: terminal.name, // Add terminal name for validation
    });
  }

  private _flushAllBuffers(): void {
    this._bufferManager.flushAll();
  }

  /**
   * 全てのターミナルを非アクティブにする
   */
  private _deactivateAllTerminals(): void {
    for (const term of this._terminals.values()) {
      term.isActive = false;
    }
  }

  /**
   * ターミナルデータのクリーンアップのみを行う（プロセスはkillしない）
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
    this._cleanupInitialPromptGuard(terminalId);

    // 🎯 HANDSHAKE PROTOCOL: Clean up shell initialization flag
    // This allows the terminal ID to be reused without "already initialized" errors
    if (this._shellInitialized.has(terminalId)) {
      this._shellInitialized.delete(terminalId);
      log(`🧹 [TERMINAL] Cleaned up shell initialization flag for: ${terminalId}`);
    }

    // Clean up data buffers for this terminal using CircularBufferManager
    this._bufferManager.removeTerminal(terminalId);

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

    // アクティブターミナルだった場合、別のターミナルをアクティブにする
    this._updateActiveTerminalAfterRemoval(terminalId);

    // Force state notification update
    log('🧹 [TERMINAL] Notifying state update after cleanup...');
    this._notifyStateUpdate();
    log('🧹 [TERMINAL] === CLEANUP TERMINAL DATA END ===');
  }

  private _ensureInitialPrompt(terminalId: string, ptyProcess: any): void {
    this._cleanupInitialPromptGuard(terminalId);

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

          if (this._hasVisibleOutput(chunk)) {
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

  private _cleanupInitialPromptGuard(terminalId: string): void {
    const guard = this._initialPromptGuards.get(terminalId);
    if (guard) {
      guard.dispose();
    }
  }

  private _hasVisibleOutput(data: string): boolean {
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

  private _normalizeControlSequences(data: string): string {
    if (!data || data.indexOf('\f') === -1) {
      return data;
    }

    const CLEAR_SEQUENCE = '\u001b[2J\u001b[H';

    return data.replace(/\f+/g, CLEAR_SEQUENCE);
  }

  /**
   * ターミナルを削除し、必要に応じて他のターミナルをアクティブにする
   */
  private _removeTerminal(terminalId: string): void {
    log('🗑️ [TERMINAL] Removing terminal:', terminalId);

    // Get terminal instance before removal
    const terminal = this._terminals.get(terminalId);

    // Kill the terminal process if it's still running (safety check)
    if (terminal) {
      try {
        const p = (terminal.ptyProcess || terminal.pty) as { kill?: () => void } | undefined;
        if (p && typeof p.kill === 'function') {
          p.kill();
        }
        log('🗑️ [TERMINAL] Process killed during removal:', terminalId);
      } catch (error) {
        log('⚠️ [TERMINAL] Error killing process during removal:', error);
      }
    }

    // Clean up terminal data
    this._cleanupTerminalData(terminalId);
  }

  /**
   * ターミナル削除後のアクティブターミナル更新処理
   */
  private _updateActiveTerminalAfterRemoval(terminalId: string): void {
    if (this._activeTerminalManager.isActive(terminalId)) {
      const remaining = getFirstValue(this._terminals);
      if (remaining) {
        this._activeTerminalManager.setActive(remaining.id);
        remaining.isActive = true;
        log('🔄 [TERMINAL] Set new active terminal:', remaining.id);
      } else {
        this._activeTerminalManager.clearActive();
        log('🔄 [TERMINAL] No remaining terminals, cleared active');
      }
    }
  }

  /**
   * Check if CLI Agent is active in a terminal
   */
  public isCliAgentConnected(terminalId: string): boolean {
    const agentState = this._cliAgentService.getAgentState(terminalId);
    return agentState.status === 'connected';
  }

  /**
   * Check if CLI Agent is running in a terminal (CONNECTED or DISCONNECTED)
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
   * 🚨 NEW: Refresh CLI Agent state (fallback for file reference issues)
   */
  public refreshCliAgentState(): boolean {
    return this._cliAgentService.refreshAgentState();
  }

  /**
   * Get the last executed command for a terminal (シンプル化で無効化)
   */
  public getLastCommand(_terminalId: string): string | undefined {
    return undefined; // シンプル化でコマンド履歴は無効化
  }

  /**
   * Handle terminal output for CLI Agent detection (public API)
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
   * Get the map of disconnected agents for full state sync
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
   * Set up event handlers for a terminal instance
   * @param terminal The terminal instance to set up events for
   */
  private _setupTerminalEvents(terminal: TerminalInstance): void {
    const { id: terminalId, ptyProcess } = terminal;

    // Initialize process state
    terminal.processState = ProcessState.Launching;
    this._notifyProcessStateChange(terminal, ProcessState.Launching);

    // Set up data event handler with CLI agent detection and shell integration
    (ptyProcess as any).onData((data: string) => {
      // Update process state to running on first data
      if (terminal.processState === ProcessState.Launching) {
        terminal.processState = ProcessState.Running;
        this._notifyProcessStateChange(terminal, ProcessState.Running);
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
      this._bufferData(terminalId, data);
    });

    // Set up exit event handler
    (ptyProcess as any).onExit((event: number | { exitCode: number; signal?: number }) => {
      const exitCode = typeof event === 'number' ? event : event.exitCode;
      const signal = typeof event === 'object' ? event.signal : undefined;

      // Update process state based on exit conditions
      if (terminal.processState === ProcessState.Launching) {
        terminal.processState = ProcessState.KilledDuringLaunch;
      } else if (this._terminalBeingKilled.has(terminalId)) {
        terminal.processState = ProcessState.KilledByUser;
      } else {
        terminal.processState = ProcessState.KilledByProcess;
      }

      this._notifyProcessStateChange(terminal, terminal.processState);

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

      // 🛡️ プロセス終了イベント（CLI Agent終了検出を含む）
      // Handle CLI agent termination on process exit
      this._cliAgentService.handleTerminalRemoved(terminalId);

      // Clean up terminal and notify listeners
      this._terminals.delete(terminalId);
      this._terminalRemovedEmitter.fire(terminalId);
      this._exitEmitter.fire({ terminalId, exitCode });
      this._notifyStateUpdate();

      log(`🗑️ [TERMINAL] Terminal ${terminalId} cleaned up after exit`);
    });
  }

  /**
   * Get available terminal profiles for the current platform
   * @returns Promise<Record<string, TerminalProfile>> Available profiles
   */
  public async getAvailableProfiles(): Promise<
    Record<string, import('../types/shared').TerminalProfile>
  > {
    return await this._profileService.getAvailableProfiles();
  }

  /**
   * Get default profile name for the current platform
   * @returns string | null Default profile name
   */
  public getDefaultProfile(): string | null {
    return this._profileService.getDefaultProfile();
  }

  /**
   * 手動でAI Agent接続を切り替える
   * Issue #122: AI Agent接続切り替えボタン機能
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

    // Delegate to the CLI Agent service
    return this._cliAgentService.switchAgentConnection(terminalId);
  }

  /**
   * 🆕 MANUAL RESET: Force reconnect AI Agent to recover from detection errors
   * This is used when the user clicks the AI Agent toggle button to manually fix detection issues
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
   * 🆕 MANUAL RESET: Clear AI Agent detection errors for a terminal
   * Resets the terminal to 'none' state to allow fresh detection
   */
  public clearAiAgentDetectionError(terminalId: string): boolean {
    log(`🧹 [TERMINAL-MANAGER] Clearing AI Agent detection errors for terminal ${terminalId}`);
    return this._cliAgentService.clearDetectionError(terminalId);
  }

  /**
   * Write to PTY with validation and error handling
   * Delegates to TerminalProcessManager (issue #213 refactoring)
   */
  private _writeToPtyWithValidation(
    terminal: TerminalInstance,
    data: string
  ): { success: boolean; error?: string } {
    // Delegate to process manager
    const result = this._processManager.writeToPty(terminal, data);

    // Handle PTY not ready case with retry
    if (!result.success && result.error === 'PTY not ready') {
      // Queue the input and try again after a short delay
      setTimeout(() => {
        const updatedTerminal = this._terminals.get(terminal.id);
        if (updatedTerminal) {
          this._processManager.retryWrite(updatedTerminal, data).catch((error) => {
            log(`❌ [PTY-RETRY] Retry failed for terminal ${terminal.id}: ${error}`);
          });
        }
      }, 500);

      return { success: true }; // Return success to avoid error display while waiting
    }

    return result;
  }

  /**
   * Attempt to recover from PTY write failure
   * Delegates to TerminalProcessManager (issue #213 refactoring)
   */
  private _attemptPtyRecovery(terminal: TerminalInstance, _data: string): boolean {
    // Delegate to process manager
    const result = this._processManager.attemptRecovery(terminal);
    return result.success;
  }

  /**
   * Resize PTY with validation and error handling
   * Delegates to TerminalProcessManager (issue #213 refactoring)
   */
  private _resizePtyWithValidation(
    terminal: TerminalInstance,
    cols: number,
    rows: number
  ): { success: boolean; error?: string } {
    // Delegate to process manager
    return this._processManager.resizePty(terminal, cols, rows);
  }

  // =================== CLI Agent Detection - MOVED TO SERVICE ===================

  // All CLI Agent detection logic has been extracted to CliAgentDetectionService
  // for better separation of concerns and testability

  // =================== ADDITIONAL METHODS FOR COMPATIBILITY ===================

  /**
   * Output event emitter for backward compatibility
   */
  public get onTerminalOutput(): vscode.Event<{ terminalId: string; data: string }> {
    // Map the existing onData event to the expected format
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

  /**
   * Write data to a specific terminal
   */
  public writeToTerminal(terminalId: string, data: string): boolean {
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      log(`❌ [TERMINAL] Cannot write to terminal ${terminalId}: not found`);
      return false;
    }

    try {
      const ptyInstance = terminal.ptyProcess || terminal.pty;
      if (!ptyInstance) {
        log(`❌ [TERMINAL] Cannot write to terminal ${terminalId}: no PTY instance`);
        return false;
      }

      ptyInstance.write(data);
      log(`✍️ [TERMINAL] Data written to terminal ${terminalId}: ${data.length} bytes`);
      return true;
    } catch (error) {
      log(`❌ [TERMINAL] Failed to write to terminal ${terminalId}:`, error);
      return false;
    }
  }

  /**
   * Resize a specific terminal
   */
  public resizeTerminal(terminalId: string, cols: number, rows: number): boolean {
    try {
      this.resize(cols, rows, terminalId);
      return true;
    } catch {
      return false;
    }
  }
}
