/**
 * Terminal Validation Service
 *
 * Responsible for terminal operation validation and error recovery:
 * - Operation validation (create, delete, write, resize)
 * - Terminal health checks
 * - Error recovery
 * - Launch timeout monitoring
 * - State consistency validation
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/213
 */

import {
  ITerminalValidationService,
  ValidationResult,
  OperationResult,
} from '../interfaces/TerminalServices';
import { TerminalInstance, TerminalDimensions, ProcessState } from '../types/shared';
import { terminal as log } from '../utils/logger';
import { getTerminalConfig, showWarningMessage } from '../utils/common';

/**
 * Terminal Validation Service Implementation
 */
export class TerminalValidationService implements ITerminalValidationService {
  // Launch timeout tracking
  private readonly _launchTimeouts = new Map<string, NodeJS.Timeout>();

  // Default launch timeout (10 seconds)
  private readonly DEFAULT_LAUNCH_TIMEOUT_MS = 10000;

  constructor(
    private readonly getTerminalsFn: () => Map<string, TerminalInstance>,
    private readonly getPtyFn: (terminalId: string) => any
  ) {
    log('🚀 [VALIDATION] Terminal Validation Service initialized');
  }

  // =================== Creation Validation ===================

  /**
   * Validate terminal creation
   */
  validateCreation(): ValidationResult {
    const terminals = this.getTerminalsFn();
    const config = getTerminalConfig();

    if (terminals.size >= config.maxTerminals) {
      log(`⚠️ [VALIDATION] Cannot create terminal: maximum limit reached (${config.maxTerminals})`);
      return {
        isValid: false,
        reason: `Maximum number of terminals reached (${config.maxTerminals})`,
        canProceed: false,
      };
    }

    return {
      isValid: true,
      canProceed: true,
    };
  }

  // =================== Deletion Validation ===================

  /**
   * Validate terminal deletion
   */
  validateDeletion(terminalId: string): ValidationResult {
    const terminals = this.getTerminalsFn();

    if (!terminals.has(terminalId)) {
      return {
        isValid: false,
        reason: 'Terminal not found',
        canProceed: false,
      };
    }

    // Ensure at least 1 terminal remains
    if (terminals.size <= 1) {
      return {
        isValid: false,
        reason: 'Must keep at least 1 terminal open',
        canProceed: false,
      };
    }

    return {
      isValid: true,
      canProceed: true,
    };
  }

  // =================== PTY Operation Validation ===================

  /**
   * Validate PTY write operation
   */
  validatePtyWrite(terminalId: string): ValidationResult {
    const terminals = this.getTerminalsFn();
    const terminal = terminals.get(terminalId);

    if (!terminal) {
      return {
        isValid: false,
        reason: 'Terminal not found',
        canProceed: false,
      };
    }

    const ptyProcess = this.getPtyFn(terminalId);
    if (!ptyProcess) {
      return {
        isValid: false,
        reason: 'PTY process not available',
        canProceed: false,
      };
    }

    if (typeof ptyProcess.write !== 'function') {
      return {
        isValid: false,
        reason: 'PTY instance missing write method',
        canProceed: false,
      };
    }

    // Check if PTY process is still alive
    if (this.isPtyKilled(ptyProcess)) {
      return {
        isValid: false,
        reason: 'PTY process has been killed',
        canProceed: false,
      };
    }

    return {
      isValid: true,
      canProceed: true,
    };
  }

  /**
   * Validate PTY resize operation
   */
  validatePtyResize(terminalId: string, dimensions: TerminalDimensions): ValidationResult {
    const { cols, rows } = dimensions;

    // Validate dimensions
    if (cols <= 0 || rows <= 0) {
      return {
        isValid: false,
        reason: `Invalid dimensions: ${cols}x${rows}`,
        canProceed: false,
      };
    }

    if (cols > 500 || rows > 200) {
      return {
        isValid: false,
        reason: `Dimensions too large: ${cols}x${rows}`,
        canProceed: false,
      };
    }

    const terminals = this.getTerminalsFn();
    const terminal = terminals.get(terminalId);

    if (!terminal) {
      return {
        isValid: false,
        reason: 'Terminal not found',
        canProceed: false,
      };
    }

    const ptyProcess = this.getPtyFn(terminalId);
    if (!ptyProcess) {
      return {
        isValid: false,
        reason: 'PTY process not available',
        canProceed: false,
      };
    }

    if (typeof ptyProcess.resize !== 'function') {
      return {
        isValid: false,
        reason: 'PTY instance missing resize method',
        canProceed: false,
      };
    }

    // Check if PTY process is still alive
    if (this.isPtyKilled(ptyProcess)) {
      return {
        isValid: false,
        reason: 'PTY process has been killed',
        canProceed: false,
      };
    }

    return {
      isValid: true,
      canProceed: true,
    };
  }

  // =================== Health Checks ===================

  /**
   * Check terminal health
   */
  checkTerminalHealth(terminalId: string): {
    isHealthy: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const terminals = this.getTerminalsFn();
    const terminal = terminals.get(terminalId);

    if (!terminal) {
      issues.push('Terminal not found in registry');
      return { isHealthy: false, issues };
    }

    // Check PTY process
    const ptyProcess = this.getPtyFn(terminalId);
    if (!ptyProcess) {
      issues.push('PTY process not available');
    } else {
      // Check PTY methods
      if (typeof ptyProcess.write !== 'function') {
        issues.push('PTY missing write method');
      }
      if (typeof ptyProcess.resize !== 'function') {
        issues.push('PTY missing resize method');
      }
      if (typeof ptyProcess.kill !== 'function') {
        issues.push('PTY missing kill method');
      }

      // Check if killed
      if (this.isPtyKilled(ptyProcess)) {
        issues.push('PTY process has been killed');
      }
    }

    // Check terminal properties
    if (!terminal.id) {
      issues.push('Terminal missing ID');
    }
    if (!terminal.name) {
      issues.push('Terminal missing name');
    }
    if (terminal.number === undefined || terminal.number === null) {
      issues.push('Terminal missing number');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
    };
  }

  // =================== State Consistency ===================

  /**
   * Validate terminal state consistency
   */
  validateStateConsistency(): {
    isConsistent: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const terminals = this.getTerminalsFn();

    // Check for duplicate terminal numbers
    const usedNumbers = new Set<number>();
    for (const terminal of terminals.values()) {
      if (terminal.number !== undefined && terminal.number !== null) {
        if (usedNumbers.has(terminal.number)) {
          issues.push(`Duplicate terminal number: ${terminal.number}`);
        }
        usedNumbers.add(terminal.number);
      }
    }

    // Check for terminals without PTY processes
    for (const [terminalId, terminal] of terminals.entries()) {
      const ptyProcess = this.getPtyFn(terminalId);
      if (!ptyProcess) {
        issues.push(`Terminal ${terminal.name} (${terminalId}) has no PTY process`);
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues,
    };
  }

  // =================== Recovery ===================

  /**
   * Attempt terminal recovery
   */
  async attemptRecovery(terminalId: string): Promise<OperationResult> {
    const terminals = this.getTerminalsFn();
    const terminal = terminals.get(terminalId);

    if (!terminal) {
      return { success: false, error: 'Terminal not found' };
    }

    log(`🔄 [VALIDATION] Attempting recovery for terminal: ${terminalId}`);

    // Check if terminal has persistent process
    if (terminal.shouldPersist && terminal.persistentProcessId) {
      log(`🔄 [VALIDATION] Attempting recovery for persistent terminal ${terminalId}`);
      // Recovery logic would go here
      return { success: false, error: 'Persistent process recovery not implemented' };
    }

    log(`ℹ️ [VALIDATION] Terminal ${terminalId} terminated normally (no recovery needed)`);
    return { success: false, error: 'No recovery mechanism available' };
  }

  // =================== Launch Monitoring ===================

  /**
   * Setup launch timeout monitoring
   */
  setupLaunchTimeout(terminal: TerminalInstance, timeoutMs?: number): void {
    const timeout = timeoutMs || this.DEFAULT_LAUNCH_TIMEOUT_MS;

    const timer = setTimeout(() => {
      if (terminal.processState === ProcessState.Launching) {
        log(`⏰ [VALIDATION] Terminal ${terminal.id} launch timeout - marking as failed`);
        terminal.processState = ProcessState.KilledDuringLaunch;
        this.handleLaunchFailure(terminal);
      }
    }, timeout);

    this._launchTimeouts.set(terminal.id, timer);
    log(`⏱️ [VALIDATION] Launch timeout set for terminal ${terminal.id} (${timeout}ms)`);
  }

  /**
   * Clear launch timeout
   */
  clearLaunchTimeout(terminal: TerminalInstance): void {
    const timer = this._launchTimeouts.get(terminal.id);
    if (timer) {
      clearTimeout(timer);
      this._launchTimeouts.delete(terminal.id);
      log(`✅ [VALIDATION] Launch timeout cleared for terminal ${terminal.id}`);
    }
  }

  /**
   * Handle launch failure
   */
  handleLaunchFailure(terminal: TerminalInstance): void {
    log(`🚨 [VALIDATION] Terminal ${terminal.id} failed to launch`);

    showWarningMessage(
      `Terminal ${terminal.name} failed to launch. Check your shell configuration.`
    );

    // Clear timeout
    this.clearLaunchTimeout(terminal);
  }

  // =================== Helpers ===================

  /**
   * Check if PTY process has been killed
   */
  private isPtyKilled(ptyProcess: any): boolean {
    return ptyProcess.killed === true;
  }

  // =================== Disposal ===================

  /**
   * Dispose service
   */
  dispose(): void {
    log('🗑️ [VALIDATION] Disposing Terminal Validation Service...');

    // Clear all launch timeouts
    for (const timer of this._launchTimeouts.values()) {
      clearTimeout(timer);
    }
    this._launchTimeouts.clear();

    log('✅ [VALIDATION] Terminal Validation Service disposed');
  }
}
