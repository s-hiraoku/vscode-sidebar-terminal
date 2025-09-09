// import * as vscode from 'vscode'; // unused
import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
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
 * Service responsible for terminal lifecycle management
 * 
 * This service extracts terminal creation, initialization, and disposal logic
 * from TerminalManager to improve:
 * - Single Responsibility: Focus only on terminal lifecycle
 * - Testability: Isolated terminal creation logic
 * - Reusability: Can be used by other components
 * - Maintainability: Cleaner separation of concerns
 */
export class TerminalLifecycleService {
  private readonly _terminalNumberManager: TerminalNumberManager;
  private readonly _profileService: TerminalProfileService;
  private _shellIntegrationService: ShellIntegrationService | null = null;
  
  // Track terminals being created to prevent races
  private readonly _terminalsBeingCreated = new Set<string>();

  constructor() {
    const config = getTerminalConfig();
    this._terminalNumberManager = new TerminalNumberManager(config.maxTerminals);
    this._profileService = new TerminalProfileService();
    
    log('🔄 [LifecycleService] Terminal lifecycle service initialized');
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
      
      this._terminalsBeingCreated.add(terminalId);
      log(`🚀 [LifecycleService] Creating terminal ${terminalId} with options:`, options);
      
      // Get terminal number from manager
      const terminals = new Map<string, TerminalInstance>(); // Empty for first terminal
      const terminalNumber = this._terminalNumberManager.findAvailableNumber(terminals);
      if (terminalNumber > 5) { // Default max terminals
        throw new Error('Maximum number of terminals reached');
      }
      
      // Resolve shell and working directory
      const terminalProfile = await this.resolveTerminalProfile(options.profileName);
      const shell = options.shell || terminalProfile.shell;
      const shellArgs = options.shellArgs || terminalProfile.args;
      const cwd = options.cwd || await getWorkingDirectory();
      
      // Generate terminal name
      const terminalName = options.terminalName || generateTerminalName(terminalNumber);
      
      log(`🔧 [LifecycleService] Terminal config: shell=${shell}, args=[${shellArgs.join(', ')}], cwd=${cwd}`);
      
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
      
      // Initialize shell integration if available
      this.initializeShellIntegration(terminal, options.safeMode || false);
      
      log(`✅ [LifecycleService] Terminal created successfully: ${terminalId} (${terminalName})`);
      return terminal;
      
    } catch (error) {
      // No need to release number as allocation failed
      
      log(`❌ [LifecycleService] Failed to create terminal ${terminalId}:`, error);
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
      log(`🗑️ [LifecycleService] Disposing terminal ${terminal.id} (${terminal.name})`);
      
      // Kill PTY process
      if (terminal.pty) {
        terminal.pty.kill();
        
        // Wait briefly for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Force kill if still alive (IPty doesn't have killed property, so we just attempt force kill)
        log(`🔨 [LifecycleService] Force killing terminal process ${terminal.id}`);
        terminal.pty.kill('SIGKILL');
      }
      
      // Terminal number will be released by caller
      if (terminal.number) {
        log(`🔢 [LifecycleService] Terminal number ${terminal.number} will be released by caller`);
      }
      
      // Clean up shell integration (method not available in current implementation)
      if (this._shellIntegrationService) {
        // this._shellIntegrationService.detachTerminal(terminal.id);
        log(`🧹 [LifecycleService] Shell integration cleanup skipped for terminal ${terminal.id}`);
      }
      
      log(`✅ [LifecycleService] Terminal ${terminal.id} disposed successfully`);
      
    } catch (error) {
      log(`❌ [LifecycleService] Error disposing terminal ${terminal.id}:`, error);
      throw error;
    }
  }

  /**
   * Resize a terminal
   */
  resizeTerminal(terminal: TerminalInstance, cols: number, rows: number): void {
    try {
      if (!terminal.pty) {
        log(`⚠️ [LifecycleService] Cannot resize terminal without PTY ${terminal.id}`);
        return;
      }
      
      terminal.pty.resize(cols, rows);
      log(`📏 [LifecycleService] Resized terminal ${terminal.id} to ${cols}x${rows}`);
      
    } catch (error) {
      log(`❌ [LifecycleService] Error resizing terminal ${terminal.id}:`, error);
      throw error;
    }
  }

  /**
   * Send input to a terminal
   */
  sendInputToTerminal(terminal: TerminalInstance, data: string): void {
    try {
      if (!terminal.pty) {
        log(`⚠️ [LifecycleService] Cannot send input to terminal without PTY ${terminal.id}`);
        return;
      }
      
      terminal.pty.write(data);
      log(`⌨️ [LifecycleService] Sent ${data.length} chars to terminal ${terminal.id}`);
      
    } catch (error) {
      log(`❌ [LifecycleService] Error sending input to terminal ${terminal.id}:`, error);
      throw error;
    }
  }

  /**
   * Check if a terminal is alive
   */
  isTerminalAlive(terminal: TerminalInstance): boolean {
    return !!(terminal.pty && terminal.pty.pid > 0);
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
    const terminals = new Map<string, TerminalInstance>(); // Empty map for now
    return {
      maxTerminals: 5, // Default max terminals
      availableNumbers: this._terminalNumberManager.getAvailableSlots(terminals),
      usedNumbers: [], // Would need to track this externally
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
          log(`⚠️ [LifecycleService] Profile service not available, using default for: ${requestedProfile}`);
        } catch (error) {
          log(`⚠️ [LifecycleService] Error getting profile ${requestedProfile}:`, error);
        }
      }

      // Fallback to platform default
      const defaultShell = getShellForPlatform(process.platform);
      log(`📋 [LifecycleService] Using default shell: ${defaultShell}`);
      
      return {
        shell: defaultShell,
        args: [],
        description: 'Default Shell',
      };
      
    } catch (error) {
      log(`❌ [LifecycleService] Error resolving terminal profile:`, error);
      
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

      log(`🔧 [LifecycleService] Creating PTY process: ${shell} ${args.join(' ')}`);
      
      const ptyProcess = pty.spawn(shell, args, ptyOptions);
      
      // Verify process was created successfully
      if (!ptyProcess || !ptyProcess.pid) {
        throw new Error(`Failed to spawn PTY process for shell: ${shell}`);
      }
      
      log(`✅ [LifecycleService] PTY process created with PID: ${ptyProcess.pid}`);
      return ptyProcess;
      
    } catch (error) {
      log(`❌ [LifecycleService] Failed to create PTY process:`, error);
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
        log(`⚠️ [LifecycleService] Shell integration service initialization skipped`);
      }
      
      // Skip shell integration in safe mode
      if (safeMode) {
        log(`⚠️ [LifecycleService] Skipping shell integration for safe mode terminal ${terminal.id}`);
        return;
      }
      
      // this._shellIntegrationService.attachToTerminal(terminal);
      // Method not available in current implementation
      log(`🔗 [LifecycleService] Shell integration attachment skipped for terminal ${terminal.id}`);
      
    } catch (error) {
      log(`⚠️ [LifecycleService] Failed to initialize shell integration for terminal ${terminal.id}:`, error);
      // Non-fatal: continue without shell integration
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    log('🧹 [LifecycleService] Disposing terminal lifecycle service');
    
    try {
      // Clear creation tracking
      this._terminalsBeingCreated.clear();
      
      // Dispose shell integration service
      if (this._shellIntegrationService) {
        this._shellIntegrationService.dispose();
        this._shellIntegrationService = null;
      }
      
      log('✅ [LifecycleService] Terminal lifecycle service disposed');
      
    } catch (error) {
      log('❌ [LifecycleService] Error disposing terminal lifecycle service:', error);
    }
  }
}