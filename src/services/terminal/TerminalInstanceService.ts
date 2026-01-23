import * as pty from 'node-pty';
import { TerminalInstance } from '../../types/shared';
import { terminal as log } from '../../utils/logger';
import {
  getTerminalConfig,
  getShellForPlatform,
  getWorkingDirectory,
  generateTerminalId,
  generateTerminalName,
} from '../../utils/common';
import { TerminalNumberManager } from '../../utils/TerminalNumberManager';
import { ShellIntegrationService } from '../../services/ShellIntegrationService';
import { TerminalProfileService } from '../../services/TerminalProfileService';

/**
 * Interface for terminal creation options
 */
interface TerminalCreationOptions {
  profileName?: string;
  safeMode?: boolean;
  cwd?: string;
  shell?: string;
  shellArgs?: string[];
  terminalName?: string;
}

/**
 * Terminal Instance Service
 *
 * VS Code pattern: ITerminalInstanceService implementation
 * Responsible for creating and disposing terminal instances.
 *
 * Based on VS Code's ITerminalInstanceService - separates instance creation
 * from service orchestration (TerminalManager/ITerminalService).
 *
 * Responsibilities:
 * - Terminal instance creation (PTY spawning)
 * - Instance initialization (shell integration)
 * - Instance disposal (process cleanup)
 * - Terminal profile resolution
 *
 * @see src/terminals/interfaces/ITerminalService.ts
 */
export class TerminalInstanceService {
  private readonly _terminalNumberManager: TerminalNumberManager;
  private readonly _profileService: TerminalProfileService;
  private _shellIntegrationService: ShellIntegrationService | null = null;
  private readonly _maxTerminals: number;

  // Track terminals created by this service
  private readonly _terminals = new Map<string, TerminalInstance>();

  // Track terminals being created to prevent races
  private readonly _terminalsBeingCreated = new Set<string>();

  constructor() {
    const config = getTerminalConfig();
    this._maxTerminals = config.maxTerminals || 10;
    this._terminalNumberManager = new TerminalNumberManager(this._maxTerminals);
    this._profileService = new TerminalProfileService();

    log('🔄 [InstanceService] Terminal instance service initialized');
  }

  /**
   * Create a new terminal with the specified options
   */
  async createTerminal(options: TerminalCreationOptions = {}): Promise<TerminalInstance> {
    const terminalId = generateTerminalId();

    try {
      // Prevent duplicate creation
      if (this._terminalsBeingCreated.has(terminalId)) {
        throw new Error(`Terminal ${terminalId} is already being created`);
      }

      // Check if we can create more terminals
      if (!this._terminalNumberManager.canCreate(this._terminals)) {
        throw new Error('Maximum number of terminals reached');
      }

      this._terminalsBeingCreated.add(terminalId);
      log(`🚀 [InstanceService] Creating terminal ${terminalId} with options:`, options);

      // Get terminal number from manager
      const terminalNumber = this._terminalNumberManager.findAvailableNumber(this._terminals);

      // Resolve shell and working directory
      const terminalProfile = await this.resolveTerminalProfile(options.profileName);
      const shell = options.shell || terminalProfile.shell;
      const shellArgs = options.shellArgs || terminalProfile.args;
      const cwd = options.cwd || (await getWorkingDirectory());

      // Generate terminal name
      const terminalName = options.terminalName || generateTerminalName(terminalNumber);

      log(
        `🔧 [InstanceService] Terminal config: shell=${shell}, args=[${shellArgs.join(', ')}], cwd=${cwd}`
      );

      // Create PTY process
      const ptyProcess = await this.createPtyProcess({
        shell,
        args: shellArgs,
        cwd,
        safeMode: options.safeMode || false,
      });

      // Create terminal instance
      const terminal: TerminalInstance = {
        id: terminalId,
        name: terminalName,
        number: terminalNumber,
        pty: ptyProcess,
        isActive: false,
        createdAt: new Date(),
        pid: ptyProcess.pid,
        cwd: cwd,
        shell: shell,
        shellArgs: shellArgs,
      };

      // Add to tracked terminals
      this._terminals.set(terminalId, terminal);

      // Initialize shell integration if available
      this.initializeShellIntegration(terminal, options.safeMode || false);

      log(`✅ [InstanceService] Terminal created successfully: ${terminalId} (${terminalName})`);
      return terminal;
    } catch (error) {
      log(`❌ [InstanceService] Failed to create terminal ${terminalId}:`, error);
      throw error;
    } finally {
      this._terminalsBeingCreated.delete(terminalId);
    }
  }

  /**
   * Dispose of a terminal and clean up resources
   */
  async disposeTerminal(terminal: TerminalInstance): Promise<void> {
    try {
      log(`🗑️ [InstanceService] Disposing terminal ${terminal.id} (${terminal.name})`);

      // Kill PTY process
      if (terminal.pty) {
        try {
          terminal.pty.kill();
          // Wait briefly for graceful shutdown
          await new Promise((resolve) => setTimeout(resolve, 50));
          // Force kill
          terminal.pty.kill('SIGKILL');
        } catch (e) {
          log(`⚠️ [InstanceService] Error killing PTY for ${terminal.id}:`, e);
        }
      }

      // Remove from tracked terminals
      this._terminals.delete(terminal.id);

      log(`✅ [InstanceService] Terminal ${terminal.id} disposed successfully`);
    } catch (error) {
      log(`❌ [InstanceService] Error disposing terminal ${terminal.id}:`, error);
      throw error;
    }
  }

  /**
   * Resize a terminal
   */
  resizeTerminal(terminal: TerminalInstance, cols: number, rows: number): void {
    try {
      if (!terminal.pty) {
        log(`⚠️ [InstanceService] Cannot resize terminal without PTY ${terminal.id}`);
        return;
      }

      terminal.pty.resize(cols, rows);
      log(`📏 [InstanceService] Resized terminal ${terminal.id} to ${cols}x${rows}`);
    } catch (error) {
      log(`❌ [InstanceService] Error resizing terminal ${terminal.id}:`, error);
      throw error;
    }
  }

  /**
   * Send input to a terminal
   */
  sendInputToTerminal(terminal: TerminalInstance, data: string): void {
    try {
      if (!terminal.pty) {
        log(`⚠️ [InstanceService] Cannot send input to terminal without PTY ${terminal.id}`);
        return;
      }

      terminal.pty.write(data);
      log(`⌨️ [InstanceService] Sent ${data.length} chars to terminal ${terminal.id}`);
    } catch (error) {
      log(`❌ [InstanceService] Error sending input to terminal ${terminal.id}:`, error);
      throw error;
    }
  }

  /**
   * Check if a terminal is alive
   */
  isTerminalAlive(terminal: TerminalInstance): boolean {
    return this._terminals.has(terminal.id) && !!(terminal.pty && terminal.pty.pid > 0);
  }

  /**
   * Get terminal statistics
   */
  getTerminalStats(): {
    maxTerminals: number;
    availableNumbers: number[];
    usedNumbers: number[];
    terminalsBeingCreated: number;
  } {
    const usedNumbers = Array.from(this._terminals.values())
      .map((t) => t.number)
      .filter((n): n is number => typeof n === 'number');

    return {
      maxTerminals: this._maxTerminals,
      availableNumbers: this._terminalNumberManager.getAvailableSlots(this._terminals),
      usedNumbers,
      terminalsBeingCreated: this._terminalsBeingCreated.size,
    };
  }

  /**
   * Resolve terminal profile for shell configuration
   */
  private async resolveTerminalProfile(requestedProfile?: string): Promise<{
    shell: string;
    args: string[];
    description: string;
  }> {
    try {
      if (requestedProfile) {
        try {
          // const profile = await this._profileService.getProfile(requestedProfile);
          // Profile service method not available, using default
          log(
            `⚠️ [InstanceService] Profile service not available, using default for: ${requestedProfile}`
          );
        } catch (error) {
          log(`⚠️ [InstanceService] Error getting profile ${requestedProfile}:`, error);
        }
      }

      // Fallback to platform default
      const defaultShell = getShellForPlatform();
      log(`📋 [InstanceService] Using default shell: ${defaultShell}`);

      return {
        shell: defaultShell,
        args: [],
        description: 'Default Shell',
      };
    } catch (error) {
      log(`❌ [InstanceService] Error resolving terminal profile:`, error);

      // Final fallback
      return {
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
        args: [],
        description: 'Fallback Shell',
      };
    }
  }

  /**
   * Create PTY process with safe mode support
   */
  private async createPtyProcess(options: {
    shell: string;
    args: string[];
    cwd: string;
    safeMode: boolean;
  }): Promise<pty.IPty> {
    try {
      const { shell, args, cwd, safeMode } = options;

      // Safe mode: use simpler shell configuration
      const ptyOptions: pty.IPtyForkOptions = {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: cwd,
        env: {
          ...process.env,
          ...(safeMode && {
            // Safe mode environment variables
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
          }),
        },
      };

      log(`🔧 [InstanceService] Creating PTY process: ${shell} ${args.join(' ')}`);

      const ptyProcess = pty.spawn(shell, args, ptyOptions);

      // Verify process was created successfully
      if (!ptyProcess || !ptyProcess.pid) {
        throw new Error(`Failed to spawn PTY process for shell: ${shell}`);
      }

      log(`✅ [InstanceService] PTY process created with PID: ${ptyProcess.pid}`);
      return ptyProcess;
    } catch (error) {
      log(`❌ [InstanceService] Failed to create PTY process:`, error);
      throw new Error(`Terminal creation failed: ${String(error)}`);
    }
  }

  /**
   * Initialize shell integration for terminal
   */
  private initializeShellIntegration(terminal: TerminalInstance, safeMode: boolean): void {
    try {
      // Shell integration service initialization skipped due to constructor requirements
      if (!this._shellIntegrationService) {
        // this._shellIntegrationService = new ShellIntegrationService();
        log(`⚠️ [InstanceService] Shell integration service initialization skipped`);
      }

      // Skip shell integration in safe mode
      if (safeMode) {
        log(
          `⚠️ [InstanceService] Skipping shell integration for safe mode terminal ${terminal.id}`
        );
        return;
      }

      // this._shellIntegrationService.attachToTerminal(terminal);
      // Method not available in current implementation
      log(`🔗 [InstanceService] Shell integration attachment skipped for terminal ${terminal.id}`);
    } catch (error) {
      log(
        `⚠️ [InstanceService] Failed to initialize shell integration for terminal ${terminal.id}:`,
        error
      );
      // Non-fatal: continue without shell integration
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    log('🧹 [InstanceService] Disposing terminal lifecycle service');

    try {
      // Clear creation tracking
      this._terminalsBeingCreated.clear();

      // Dispose shell integration service
      if (this._shellIntegrationService) {
        this._shellIntegrationService.dispose();
        this._shellIntegrationService = null;
      }

      log('✅ [InstanceService] Terminal lifecycle service disposed');
    } catch (error) {
      log('❌ [InstanceService] Error disposing terminal lifecycle service:', error);
    }
  }
}
