/**
 * Terminal Service Interfaces
 *
 * These interfaces define the contracts for the specialized terminal services
 * that decompose the TerminalManager's responsibilities according to the
 * Single Responsibility Principle.
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/213
 */

import * as vscode from 'vscode';
import { TerminalInstance, TerminalState, ProcessState, TerminalDimensions } from '../types/shared';
import { IPty } from '@homebridge/node-pty-prebuilt-multiarch';

// =================== Common Types ===================

/**
 * Operation result with success/failure status
 */
export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * PTY creation options
 */
export interface PtyCreationOptions {
  shell: string;
  shellArgs: string[];
  cwd: string;
  env: Record<string, string>;
  cols: number;
  rows: number;
}

/**
 * Terminal validation result
 */
export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  canProceed: boolean;
}

// =================== Service 1: TerminalProcessManager ===================

/**
 * Terminal Process Manager Interface
 *
 * Responsible for:
 * - PTY process creation and management
 * - Process lifecycle (spawn, write, resize, kill)
 * - Process state tracking
 * - Process recovery
 */
export interface ITerminalProcessManager {
  /**
   * Create a new PTY process with the given options
   */
  createPtyProcess(options: PtyCreationOptions): Promise<IPty>;

  /**
   * Write data to a PTY process
   */
  writeToPty(terminalId: string, data: string): OperationResult;

  /**
   * Resize a PTY process
   */
  resizePty(terminalId: string, dimensions: TerminalDimensions): OperationResult;

  /**
   * Kill a PTY process
   */
  killPty(terminalId: string): Promise<OperationResult>;

  /**
   * Get PTY process for a terminal
   */
  getPty(terminalId: string): IPty | undefined;

  /**
   * Check if PTY process is alive
   */
  isPtyAlive(terminalId: string): boolean;

  /**
   * Attempt to recover a failed PTY process
   */
  attemptPtyRecovery(terminalId: string, data: string): Promise<OperationResult>;

  /**
   * Get process state for a terminal
   */
  getProcessState(terminalId: string): ProcessState | undefined;

  /**
   * Set process state for a terminal
   */
  setProcessState(terminalId: string, state: ProcessState): void;

  /**
   * Register a PTY process for a terminal
   */
  registerPty(terminalId: string, pty: IPty): void;

  /**
   * Unregister a PTY process
   */
  unregisterPty(terminalId: string): void;

  /**
   * Dispose all PTY processes
   */
  dispose(): void;
}

// =================== Service 2: TerminalLifecycleService ===================

/**
 * Terminal Lifecycle Service Interface
 *
 * Responsible for:
 * - Terminal creation
 * - Terminal deletion
 * - Terminal focus management
 * - Terminal activation state
 */
export interface ITerminalLifecycleService {
  /**
   * Create a new terminal
   */
  createTerminal(profileName?: string): Promise<string>;

  /**
   * Delete a terminal
   */
  deleteTerminal(
    terminalId: string,
    options?: { force?: boolean; source?: 'header' | 'panel' | 'command' }
  ): Promise<OperationResult>;

  /**
   * Focus a terminal
   */
  focusTerminal(terminalId: string): void;

  /**
   * Set active terminal
   */
  setActiveTerminal(terminalId: string): void;

  /**
   * Get active terminal ID
   */
  getActiveTerminalId(): string | undefined;

  /**
   * Get terminal by ID
   */
  getTerminal(terminalId: string): TerminalInstance | undefined;

  /**
   * Get all terminals
   */
  getTerminals(): TerminalInstance[];

  /**
   * Check if terminal exists
   */
  hasTerminal(terminalId: string): boolean;

  /**
   * Terminal created event
   */
  readonly onTerminalCreated: vscode.Event<TerminalInstance>;

  /**
   * Terminal removed event
   */
  readonly onTerminalRemoved: vscode.Event<string>;

  /**
   * Terminal focus event
   */
  readonly onTerminalFocus: vscode.Event<string>;

  /**
   * Dispose service
   */
  dispose(): void;
}

// =================== Service 3: TerminalStateCoordinator ===================

/**
 * Terminal State Coordinator Interface
 *
 * Responsible for:
 * - Terminal state tracking
 * - State change notifications
 * - Event emission
 * - State synchronization
 */
export interface ITerminalStateCoordinator {
  /**
   * Get current terminal state
   */
  getCurrentState(): TerminalState;

  /**
   * Update terminal state and notify listeners
   */
  notifyStateUpdate(): void;

  /**
   * Notify process state change
   */
  notifyProcessStateChange(
    terminal: TerminalInstance,
    newState: ProcessState,
    previousState?: ProcessState
  ): void;

  /**
   * Get available terminal slots
   */
  getAvailableSlots(): number[];

  /**
   * Check if terminal is active
   */
  isTerminalActive(terminalId: string): boolean;

  /**
   * Set terminal active state
   */
  setTerminalActive(terminalId: string, isActive: boolean): void;

  /**
   * Deactivate all terminals
   */
  deactivateAllTerminals(): void;

  /**
   * Update active terminal after removal
   */
  updateActiveTerminalAfterRemoval(terminalId: string): void;

  /**
   * State update event
   */
  readonly onStateUpdate: vscode.Event<TerminalState>;

  /**
   * Terminal data event
   */
  readonly onData: vscode.Event<{ terminalId: string; data: string }>;

  /**
   * Terminal exit event
   */
  readonly onExit: vscode.Event<{ terminalId: string; exitCode?: number }>;

  /**
   * Dispose service
   */
  dispose(): void;
}

// =================== Service 4: TerminalDataBufferService ===================

/**
 * Terminal Data Buffer Service Interface
 *
 * Responsible for:
 * - Data buffering for performance optimization
 * - Batch processing of terminal output
 * - Adaptive flush strategies
 * - Buffer management
 *
 * @see TerminalDataBufferingService for implementation
 */
export interface ITerminalDataBufferService {
  /**
   * Buffer data for a terminal
   */
  bufferData(terminalId: string, data: string): void;

  /**
   * Flush buffer for a terminal
   */
  flushBuffer(terminalId: string): void;

  /**
   * Flush all buffers
   */
  flushAllBuffers(): void;

  /**
   * Schedule flush for a terminal
   */
  scheduleFlush(terminalId: string): void;

  /**
   * Check if buffer is empty
   */
  isBufferEmpty(terminalId: string): boolean;

  /**
   * Get buffer size
   */
  getBufferSize(terminalId: string): number;

  /**
   * Clear buffer for a terminal
   */
  clearBuffer(terminalId: string): void;

  /**
   * Add flush handler
   */
  addFlushHandler(handler: (terminalId: string, data: string) => void): void;

  /**
   * Remove flush handler
   */
  removeFlushHandler(handler: (terminalId: string, data: string) => void): void;

  /**
   * Get all buffer statistics
   */
  getAllStats(): Record<string, unknown>;

  /**
   * Dispose service
   */
  dispose(): void;
}

// =================== Service 5: TerminalValidationService ===================

/**
 * Terminal Validation Service Interface
 *
 * Responsible for:
 * - Terminal operation validation
 * - Error recovery
 * - Process health checks
 * - Operation safety checks
 */
export interface ITerminalValidationService {
  /**
   * Validate terminal deletion
   */
  validateDeletion(terminalId: string): ValidationResult;

  /**
   * Validate terminal creation
   */
  validateCreation(): ValidationResult;

  /**
   * Validate PTY write operation
   */
  validatePtyWrite(terminalId: string): ValidationResult;

  /**
   * Validate PTY resize operation
   */
  validatePtyResize(terminalId: string, dimensions: TerminalDimensions): ValidationResult;

  /**
   * Check terminal health
   */
  checkTerminalHealth(terminalId: string): {
    isHealthy: boolean;
    issues: string[];
  };

  /**
   * Attempt terminal recovery
   */
  attemptRecovery(terminalId: string): Promise<OperationResult>;

  /**
   * Validate terminal state consistency
   */
  validateStateConsistency(): {
    isConsistent: boolean;
    issues: string[];
  };

  /**
   * Setup launch timeout monitoring
   */
  setupLaunchTimeout(terminal: TerminalInstance, timeoutMs?: number): void;

  /**
   * Clear launch timeout
   */
  clearLaunchTimeout(terminal: TerminalInstance): void;

  /**
   * Handle launch failure
   */
  handleLaunchFailure(terminal: TerminalInstance): void;

  /**
   * Dispose service
   */
  dispose(): void;
}

// =================== Factory Interface ===================

/**
 * Terminal Services Factory
 *
 * Creates and configures all terminal services
 */
export interface ITerminalServicesFactory {
  createProcessManager(): ITerminalProcessManager;
  createLifecycleService(): ITerminalLifecycleService;
  createStateCoordinator(): ITerminalStateCoordinator;
  createDataBufferService(): ITerminalDataBufferService;
  createValidationService(): ITerminalValidationService;
}
