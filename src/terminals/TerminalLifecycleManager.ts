/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as vscode from 'vscode';
import { TerminalInstance, DeleteResult, ProcessState } from '../types/shared';
import { ERROR_MESSAGES } from '../constants';
import { terminal as log } from '../utils/logger';
import {
  getTerminalConfig,
  getShellForPlatform,
  getWorkingDirectory,
  generateTerminalId,
  generateTerminalName,
  showErrorMessage,
  showWarningMessage,
} from '../utils/common';
import { TerminalNumberManager } from '../utils/TerminalNumberManager';
import { TerminalProfileService } from '../services/TerminalProfileService';
import { TerminalSpawner } from './TerminalSpawner';
import { ICliAgentDetectionService } from '../interfaces/CliAgentService';

/**
 * TerminalLifecycleManager
 *
 * Responsibility: Manage terminal creation and deletion lifecycle
 * - Create terminals with/without profiles
 * - Delete terminals with validation
 * - Manage terminal instances
 * - Handle terminal number assignment
 *
 * Single Responsibility Principle: Focused on lifecycle management only
 */
export class TerminalLifecycleManager {
  // Track terminals being killed to prevent infinite loops
  private readonly _terminalBeingKilled = new Set<string>();

  // Operation queue for atomic operations
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly _terminals: Map<string, TerminalInstance>,
    private readonly _terminalNumberManager: TerminalNumberManager,
    private readonly _profileService: TerminalProfileService,
    private readonly _terminalSpawner: TerminalSpawner,
    private readonly _cliAgentService: ICliAgentDetectionService,
    private readonly _terminalCreatedEmitter: vscode.EventEmitter<TerminalInstance>,
    private readonly _terminalRemovedEmitter: vscode.EventEmitter<string>,
    private readonly _exitEmitter: vscode.EventEmitter<any>,
    private readonly _setupEventsCallback: (terminal: TerminalInstance) => void,
    private readonly _notifyStateUpdateCallback: () => void,
    private readonly _cleanupTerminalDataCallback: (terminalId: string) => void
  ) {}

  /**
   * Resolve terminal profile for shell configuration
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

      // Store terminal
      this._terminals.set(terminalId, terminal);

      // Set up terminal event handlers
      this._setupEventsCallback(terminal);

      log(`✅ [TERMINAL] Terminal created successfully: ${terminalId} (${terminal.name})`);
      this._terminalCreatedEmitter.fire(terminal);
      this._notifyStateUpdateCallback();

      return terminalId;
    } catch (error) {
      log(`❌ [TERMINAL] Failed to create terminal with profile: ${error}`);
      showErrorMessage(`Failed to create terminal: ${error}`);
      return '';
    }
  }

  /**
   * Create terminal (synchronous version without profile)
   */
  public createTerminal(): string {
    log('🔍 [TERMINAL] === CREATE TERMINAL CALLED ===');

    const config = getTerminalConfig();
    log(`🔍 [TERMINAL] Config loaded: maxTerminals=${config.maxTerminals}`);

    log(`🔍 [TERMINAL] Current terminals count: ${this._terminals.size}`);

    // Force debug the actual terminal state before validation
    log('🔍 [TERMINAL] Current terminals in map:', this._terminals.size);
    for (const [id, terminal] of this._terminals.entries()) {
      log(`🔍 [TERMINAL] Map entry: ${id} -> ${terminal.name} (number: ${terminal.number})`);
    }

    // 🚨 CRITICAL DEBUG: Detailed canCreate analysis
    log('🔍 [TERMINAL] === DETAILED canCreate() ANALYSIS ===');
    log('🔍 [TERMINAL] this._terminals.size:', this._terminals.size);
    log('🔍 [TERMINAL] config.maxTerminals:', config.maxTerminals);

    // Call canCreate and get detailed information
    const canCreateResult = this._terminalNumberManager.canCreate(this._terminals);
    log('🔍 [TERMINAL] canCreate() returned:', canCreateResult);

    if (!canCreateResult) {
      log('🚨 [TERMINAL] Cannot create terminal: all slots used');
      log('🚨 [TERMINAL] Final canCreate check failed - investigating...');

      // Force re-check the numbers manually
      const usedNumbers = new Set<number>();
      log('🚨 [TERMINAL] Analyzing each terminal in map:');
      for (const [id, terminal] of this._terminals.entries()) {
        log(`🚨 [TERMINAL] Terminal ${id}:`, {
          name: terminal.name,
          number: terminal.number,
          hasValidNumber: typeof terminal.number === 'number' && !isNaN(terminal.number),
        });

        if (terminal.number && typeof terminal.number === 'number') {
          usedNumbers.add(terminal.number);
        }
      }
      log('🚨 [TERMINAL] Used numbers from current terminals:', Array.from(usedNumbers));
      log(
        '🚨 [TERMINAL] Available slots should be:',
        Array.from({ length: config.maxTerminals }, (_, i) => i + 1).filter(
          (n) => !usedNumbers.has(n)
        )
      );

      // 🚨 CRITICAL: If terminals map is empty but canCreate returns false, there's a bug
      if (this._terminals.size === 0) {
        log('🚨🚨🚨 [TERMINAL] CRITICAL BUG: No terminals exist but canCreate returned FALSE!');
        log('🚨🚨🚨 [TERMINAL] This should NEVER happen - forcing creation');
        // Don't return early - continue with creation
      } else {
        showWarningMessage(`${ERROR_MESSAGES.MAX_TERMINALS_REACHED} (${config.maxTerminals})`);
        return '';
      }
    } else {
      log('✅ [TERMINAL] canCreate() returned TRUE - proceeding with creation');
    }

    log('🔍 [TERMINAL] Finding available terminal number...');
    const terminalNumber = this._terminalNumberManager.findAvailableNumber(this._terminals);
    log(`🔍 [TERMINAL] Found available terminal number: ${terminalNumber}`);

    log('🔍 [TERMINAL] Generating terminal ID...');
    const terminalId = generateTerminalId();
    log(`🔍 [TERMINAL] Generated terminal ID: ${terminalId}`);

    const shell = getShellForPlatform();
    const shellArgs = config.shellArgs;
    const cwd = getWorkingDirectory();

    log(
      `🔍 [TERMINAL] Creating terminal: ID=${terminalId}, Shell=${shell}, Args=${JSON.stringify(shellArgs)}, CWD=${cwd}`
    );

    try {
      // Prepare environment variables with explicit PWD
      const env = {
        ...process.env,
        PWD: cwd,
        // Add VS Code workspace information if available
        ...(vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders.length > 0 && {
            VSCODE_WORKSPACE: vscode.workspace.workspaceFolders[0]?.uri.fsPath || '',
            VSCODE_PROJECT_NAME: vscode.workspace.workspaceFolders[0]?.name || '',
          }),
      } as { [key: string]: string };

      // 🚨 CRITICAL ESP-IDF DEBUG: Log environment variables that might cause issues
      log('🔍 [ESP-IDF-DEBUG] Checking for ESP-IDF related environment variables:');
      const espidxRelatedEnvs = Object.keys(env).filter(
        (key) =>
          key.includes('ESP') || key.includes('IDF') || key.includes('PYTHON') || key === 'PATH'
      );
      espidxRelatedEnvs.forEach((key) => {
        const value = env[key];
        if (value && value.length > 100) {
          log(
            `🔍 [ESP-IDF-DEBUG] ${key}=${value.substring(0, 100)}... (truncated ${value.length} chars)`
          );
        } else {
          log(`🔍 [ESP-IDF-DEBUG] ${key}=${value}`);
        }
      });

      const { ptyProcess } = this._terminalSpawner.spawnTerminal({
        terminalId,
        shell,
        shellArgs: shellArgs || [],
        cwd,
        env,
      });

      // Create terminal with actual PTY from the start
      const terminal: TerminalInstance = {
        id: terminalId,
        pty: ptyProcess,
        ptyProcess: ptyProcess,
        name: generateTerminalName(terminalNumber),
        number: terminalNumber,
        cwd: cwd,
        isActive: true,
        createdAt: new Date(),
      };

      // Store terminal
      this._terminals.set(terminalId, terminal);

      // Set up terminal events (including onExit handler)
      this._setupEventsCallback(terminal);

      // Fire terminal created event
      this._terminalCreatedEmitter.fire(terminal);

      // Verify PTY write capability without sending test commands
      if (ptyProcess && typeof ptyProcess.write === 'function') {
        log(`✅ [TERMINAL] PTY write capability verified for ${terminalId}`);
      } else {
        log(`❌ [TERMINAL] PTY write method not available for ${terminalId}`);
      }

      log(`✅ [TERMINAL] Terminal created successfully: ${terminal.name} (${terminalId})`);

      // 状態更新を通知
      log('🔍 [TERMINAL] Notifying state update...');
      this._notifyStateUpdateCallback();
      log('🔍 [TERMINAL] State update completed');

      log(`🔍 [TERMINAL] === CREATE TERMINAL FINISHED: ${terminalId} ===`);
      return terminalId;
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
   * Validate if terminal can be deleted
   */
  private validateDeletion(terminalId: string): { canDelete: boolean; reason?: string } {
    if (!this._terminals.has(terminalId)) {
      return { canDelete: false, reason: 'Terminal not found' };
    }

    // 最低1つのターミナルは保持する
    if (this._terminals.size <= 1) {
      return { canDelete: false, reason: 'Must keep at least 1 terminal open' };
    }

    return { canDelete: true };
  }

  /**
   * Public API: Check if terminal can be removed
   */
  public canRemoveTerminal(terminalId: string): { canRemove: boolean; reason?: string } {
    const validation = this.validateDeletion(terminalId);
    return { canRemove: validation.canDelete, reason: validation.reason };
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
   * Perform atomic delete operation
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

    // 🔧 FIX: ALWAYS validate to enforce minimum 1 terminal rule
    // Even with force: true, we must protect the last terminal
    const validation = this.validateDeletion(terminalId);
    if (!validation.canDelete) {
      log(`⚠️ [DELETE] Cannot delete terminal: ${validation.reason}`);
      // Only show warning message if not forced (force mode expects caller to handle errors)
      if (!options.force) {
        showWarningMessage(validation.reason || 'Cannot delete terminal');
      }
      return { success: false, reason: validation.reason };
    }

    // 2. Check terminal exists
    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      log(`⚠️ [DELETE] Terminal not found: ${terminalId}`);
      return { success: false, reason: 'Terminal not found' };
    }

    try {
      // 3. Kill process
      log(`🗑️ [DELETE] Killing terminal process: ${terminalId}`);
      this._terminalBeingKilled.add(terminalId);

      // 🔧 FIX: Set process state to KilledByUser BEFORE killing to ensure correct exit state
      terminal.processState = ProcessState.KilledByUser;

      const p = (terminal.ptyProcess || terminal.pty) as { kill?: () => void } | undefined;
      if (p && typeof p.kill === 'function') {
        p.kill();
      }

      // 4. State update will be handled by onExit handler
      log(`✅ [DELETE] Delete operation completed for: ${terminalId}`);

      // 5. Return new state (current state since it's async)
      return { success: true, newState: undefined };
    } catch (error) {
      log(`❌ [DELETE] Error during delete operation for ${terminalId}:`, error);
      if (error instanceof Error) {
        log(`❌ [DELETE] Error message: ${error.message}`);
        log(`❌ [DELETE] Error stack: ${error.stack}`);
      }
      this._terminalBeingKilled.delete(terminalId);
      return { success: false, reason: `Delete failed: ${String(error)}` };
    }
  }

  /**
   * Remove terminal immediately (internal method)
   */
  public removeTerminal(terminalId: string): void {
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
    this._cleanupTerminalDataCallback(terminalId);
  }

  /**
   * Get a specific terminal by ID
   */
  public getTerminal(terminalId: string): TerminalInstance | undefined {
    return this._terminals.get(terminalId);
  }

  /**
   * Get all terminals
   */
  public getTerminals(): TerminalInstance[] {
    return Array.from(this._terminals.values());
  }

  /**
   * Check if terminal is being killed
   */
  public isTerminalBeingKilled(terminalId: string): boolean {
    return this._terminalBeingKilled.has(terminalId);
  }

  /**
   * Mark terminal as being killed
   */
  public markTerminalBeingKilled(terminalId: string): void {
    this._terminalBeingKilled.add(terminalId);
  }

  /**
   * Unmark terminal as being killed
   */
  public unmarkTerminalBeingKilled(terminalId: string): void {
    this._terminalBeingKilled.delete(terminalId);
  }

  /**
   * Get available profiles
   */
  public async getAvailableProfiles(): Promise<
    Record<string, import('../types/shared').TerminalProfile>
  > {
    return await this._profileService.getAvailableProfiles();
  }

  /**
   * Get default profile
   */
  public getDefaultProfile(): string | null {
    return this._profileService.getDefaultProfile();
  }

  /**
   * Dispose lifecycle manager
   */
  public dispose(): void {
    // Clear kill tracking
    this._terminalBeingKilled.clear();

    // Kill all terminal processes
    for (const terminal of this._terminals.values()) {
      const p = (terminal.ptyProcess || terminal.pty) as { kill?: () => void } | undefined;
      if (p && typeof p.kill === 'function') {
        try {
          p.kill();
        } catch (error) {
          log(`⚠️ [TERMINAL] Error killing process during dispose:`, error);
        }
      }
    }
  }
}
