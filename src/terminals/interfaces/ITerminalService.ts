/**
 * ITerminalService Interface
 *
 * VS Code standard terminal service pattern.
 * Central orchestrator for all terminal operations.
 *
 * Based on: src/vs/workbench/contrib/terminal/browser/terminal.ts (ITerminalService)
 */

import { Event } from 'vscode';
import { ITerminal, IShellLaunchConfig } from './ITerminal';
import { TerminalInfo, DeleteResult } from '../../types/shared';

/**
 * Terminal service interface
 *
 * Central service for managing all terminal instances.
 * Follows VS Code's service delegation pattern.
 */
export interface ITerminalService {
  // ============================================================================
  // Terminal Collection
  // ============================================================================

  /**
   * All active terminal instances
   *
   * VS Code pattern: Single source of truth for all terminals
   */
  readonly instances: ReadonlyArray<ITerminal>;

  /**
   * Currently active terminal
   */
  readonly activeInstance: ITerminal | undefined;

  /**
   * Number of active terminals
   */
  readonly instanceCount: number;

  // ============================================================================
  // Terminal Creation
  // ============================================================================

  /**
   * Create a new terminal instance
   *
   * @param launchConfig Shell launch configuration
   * @returns Terminal instance ID
   */
  createTerminal(launchConfig?: IShellLaunchConfig): string | null;

  /**
   * Create a terminal with specific configuration
   *
   * VS Code pattern: Factory method for terminal creation
   *
   * @param options Creation options
   * @returns Terminal instance ID
   */
  createTerminalWithOptions(options: ITerminalCreationOptions): string | null;

  // ============================================================================
  // Terminal Lifecycle
  // ============================================================================

  /**
   * Get terminal instance by ID
   *
   * @param terminalId Terminal identifier
   * @returns Terminal instance or undefined
   */
  getTerminalById(terminalId: string): ITerminal | undefined;

  /**
   * Set active terminal
   *
   * @param terminalId Terminal to activate
   */
  setActiveTerminal(terminalId: string): void;

  /**
   * Delete a terminal
   *
   * VS Code pattern: Atomic deletion with state cleanup
   *
   * @param terminalId Terminal to delete
   * @param force Force deletion even if process is running
   * @returns Deletion result
   */
  deleteTerminal(terminalId: string, force?: boolean): Promise<DeleteResult>;

  /**
   * Dispose all terminals
   *
   * Cleanup method for shutdown scenarios
   */
  disposeAll(): Promise<void>;

  // ============================================================================
  // Terminal Operations
  // ============================================================================

  /**
   * Send data to terminal
   *
   * @param terminalId Target terminal
   * @param data Data to send
   */
  sendData(terminalId: string, data: string): void;

  /**
   * Resize terminal
   *
   * @param terminalId Target terminal
   * @param cols Number of columns
   * @param rows Number of rows
   */
  resize(terminalId: string, cols: number, rows: number): void;

  /**
   * Kill terminal process
   *
   * @param terminalId Target terminal
   * @param immediate Force kill if true
   */
  kill(terminalId: string, immediate?: boolean): void;

  // ============================================================================
  // State Queries
  // ============================================================================

  /**
   * Get all terminal information
   *
   * @returns Array of terminal info objects
   */
  getTerminals(): TerminalInfo[];

  /**
   * Get active terminal ID
   *
   * @returns Active terminal ID or null
   */
  getActiveTerminalId(): string | null;

  /**
   * Check if terminal exists
   *
   * @param terminalId Terminal to check
   * @returns true if exists
   */
  hasTerminal(terminalId: string): boolean;

  // ============================================================================
  // Events (VS Code Event Pattern)
  // ============================================================================

  /**
   * Fired when a terminal is created
   *
   * @param terminal The created terminal instance
   */
  readonly onDidCreateInstance: Event<ITerminal>;

  /**
   * Fired when a terminal is disposed
   *
   * @param terminal The disposed terminal instance
   */
  readonly onDidDisposeInstance: Event<ITerminal>;

  /**
   * Fired when the active terminal changes
   *
   * @param terminal The new active terminal (or undefined if none)
   */
  readonly onDidChangeActiveInstance: Event<ITerminal | undefined>;

  /**
   * Fired when terminal state updates
   *
   * @param terminal The updated terminal instance
   */
  readonly onDidChangeInstanceState: Event<ITerminal>;

  /**
   * Fired when any terminal receives data
   *
   * @param event Data event with terminal ID and data
   */
  readonly onInstanceData: Event<{ terminalId: string; data: string }>;

  /**
   * Fired when any terminal process exits
   *
   * @param event Exit event with terminal ID and exit code
   */
  readonly onInstanceExit: Event<{ terminalId: string; exitCode: number | undefined }>;
}

/**
 * Terminal creation options
 *
 * Extended options for terminal creation
 */
export interface ITerminalCreationOptions {
  /**
   * Shell launch configuration
   */
  shellLaunchConfig?: IShellLaunchConfig;

  /**
   * Terminal name override
   */
  name?: string;

  /**
   * Terminal number override
   *
   * If not specified, uses next available number (1-5 recycling)
   */
  number?: number;

  /**
   * Whether to activate this terminal after creation
   */
  activate?: boolean;

  /**
   * Initial data to write to terminal
   *
   * Used for session restoration
   */
  initialData?: string;

  /**
   * Terminal icon
   */
  icon?: string;

  /**
   * Terminal color
   */
  color?: string;
}

/**
 * Terminal instance service
 *
 * Factory for creating terminal instances.
 * Separates instance creation from service orchestration (VS Code pattern)
 */
export interface ITerminalInstanceService {
  /**
   * Create a new terminal instance
   *
   * @param launchConfig Shell launch configuration
   * @param terminalId Optional terminal ID (for restoration)
   * @returns Created terminal instance
   */
  createInstance(launchConfig: IShellLaunchConfig, terminalId?: string): ITerminal;

  /**
   * Restore a terminal instance from serialized state
   *
   * @param state Serialized terminal state
   * @returns Restored terminal instance
   */
  restoreInstance(state: ISerializedTerminalState): ITerminal;
}

/**
 * Serialized terminal state
 *
 * Based on VS Code's ISerializedTerminalState
 * Used for session persistence
 */
export interface ISerializedTerminalState {
  /**
   * Terminal ID
   */
  id: string;

  /**
   * Terminal number
   */
  number: number;

  /**
   * Shell launch configuration
   */
  shellLaunchConfig: IShellLaunchConfig;

  /**
   * Process details at time of serialization
   */
  processDetails: {
    cwd: string;
    title: string;
    color?: string;
    icon?: string;
    shellType?: string;
  };

  /**
   * Replay event (serialized buffer content)
   *
   * VS Code pattern: Uses xterm SerializeAddon output
   */
  replayEvent: string;

  /**
   * Timestamp of serialization
   */
  timestamp: number;

  /**
   * Whether this was the active terminal
   */
  isActive: boolean;
}
