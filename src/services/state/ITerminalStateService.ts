/**
 * Terminal State Service Interface
 *
 * Manages terminal lifecycle states and metadata.
 * Responsible for tracking terminal registration, process states, and active terminal management.
 */

import type {
  ProcessState,
  InteractionState,
} from '../../types/shared';

/**
 * Terminal metadata for state tracking
 */
export interface TerminalMetadata {
  /** Terminal ID */
  readonly id: string;
  /** Terminal display name */
  name: string;
  /** Terminal number (1-5 for ID recycling) */
  number?: number;
  /** Current working directory */
  cwd?: string;
  /** Shell path */
  shell?: string;
  /** Shell arguments */
  shellArgs?: string[];
  /** Process ID */
  pid?: number;
  /** Active status */
  isActive: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last active timestamp */
  lastActiveAt: Date;
}

/**
 * Terminal lifecycle state
 */
export interface TerminalLifecycleState {
  /** Process execution state */
  processState: ProcessState;
  /** User interaction state */
  interactionState: InteractionState;
  /** Whether terminal should persist across sessions */
  shouldPersist: boolean;
  /** Persistent process ID for session restoration */
  persistentProcessId?: string;
}

/**
 * Complete terminal state (metadata + lifecycle)
 */
export interface TerminalState extends TerminalMetadata {
  /** Lifecycle state */
  lifecycle: TerminalLifecycleState;
}

/**
 * Terminal state change event data
 */
export interface TerminalStateChangeData {
  terminalId: string;
  previousState?: TerminalState;
  currentState: TerminalState;
  changeType: 'registered' | 'updated' | 'unregistered' | 'activated' | 'deactivated';
}

/**
 * Terminal State Service
 *
 * Core responsibilities:
 * - Terminal registration and lifecycle management
 * - Process and interaction state tracking
 * - Active terminal management
 * - Terminal metadata queries
 * - State change event publishing
 */
export interface ITerminalStateService {
  /**
   * Register a new terminal
   *
   * @param id Terminal ID
   * @param metadata Initial terminal metadata
   * @throws Error if terminal already registered
   */
  registerTerminal(id: string, metadata: Partial<TerminalMetadata>): void;

  /**
   * Unregister a terminal
   *
   * @param id Terminal ID
   * @returns True if terminal was unregistered, false if didn't exist
   */
  unregisterTerminal(id: string): boolean;

  /**
   * Check if terminal is registered
   *
   * @param id Terminal ID
   * @returns True if terminal exists
   */
  hasTerminal(id: string): boolean;

  /**
   * Get terminal metadata
   *
   * @param id Terminal ID
   * @returns Terminal metadata or undefined if not found
   */
  getMetadata(id: string): TerminalMetadata | undefined;

  /**
   * Update terminal metadata
   *
   * @param id Terminal ID
   * @param updates Partial metadata updates
   * @returns True if updated successfully, false if terminal doesn't exist
   */
  updateMetadata(id: string, updates: Partial<TerminalMetadata>): boolean;

  /**
   * Get terminal lifecycle state
   *
   * @param id Terminal ID
   * @returns Lifecycle state or undefined if not found
   */
  getLifecycleState(id: string): TerminalLifecycleState | undefined;

  /**
   * Update terminal lifecycle state
   *
   * @param id Terminal ID
   * @param updates Partial lifecycle state updates
   * @returns True if updated successfully, false if terminal doesn't exist
   */
  updateLifecycleState(
    id: string,
    updates: Partial<TerminalLifecycleState>
  ): boolean;

  /**
   * Get complete terminal state (metadata + lifecycle)
   *
   * @param id Terminal ID
   * @returns Complete state or undefined if not found
   */
  getState(id: string): TerminalState | undefined;

  /**
   * Set process state
   *
   * @param id Terminal ID
   * @param state Process state
   * @returns True if updated successfully
   */
  setProcessState(id: string, state: ProcessState): boolean;

  /**
   * Get process state
   *
   * @param id Terminal ID
   * @returns Process state or undefined
   */
  getProcessState(id: string): ProcessState | undefined;

  /**
   * Set interaction state
   *
   * @param id Terminal ID
   * @param state Interaction state
   * @returns True if updated successfully
   */
  setInteractionState(id: string, state: InteractionState): boolean;

  /**
   * Get interaction state
   *
   * @param id Terminal ID
   * @returns Interaction state or undefined
   */
  getInteractionState(id: string): InteractionState | undefined;

  /**
   * Set active terminal
   *
   * @param id Terminal ID
   * @returns True if set successfully
   */
  setActiveTerminal(id: string): boolean;

  /**
   * Get active terminal ID
   *
   * @returns Active terminal ID or undefined if none active
   */
  getActiveTerminalId(): string | undefined;

  /**
   * Get active terminal metadata
   *
   * @returns Active terminal metadata or undefined
   */
  getActiveTerminal(): TerminalMetadata | undefined;

  /**
   * Clear active terminal (set none as active)
   */
  clearActiveTerminal(): void;

  /**
   * Get all registered terminal IDs
   *
   * @returns Array of terminal IDs
   */
  getAllTerminalIds(): string[];

  /**
   * Get all terminal metadata
   *
   * @returns Array of terminal metadata
   */
  getAllTerminals(): TerminalMetadata[];

  /**
   * Get all terminal states
   *
   * @returns Array of complete terminal states
   */
  getAllStates(): TerminalState[];

  /**
   * Get terminal count
   *
   * @returns Number of registered terminals
   */
  getTerminalCount(): number;

  /**
   * Check if terminal is ready (running state)
   *
   * @param id Terminal ID
   * @returns True if terminal is in Running state
   */
  isTerminalReady(id: string): boolean;

  /**
   * Check if terminal is active
   *
   * @param id Terminal ID
   * @returns True if terminal is the active terminal
   */
  isTerminalActive(id: string): boolean;

  /**
   * Find terminals by criteria
   *
   * @param predicate Filter function
   * @returns Array of matching terminal metadata
   */
  findTerminals(
    predicate: (metadata: TerminalMetadata) => boolean
  ): TerminalMetadata[];

  /**
   * Update last active time for terminal
   *
   * @param id Terminal ID
   * @returns True if updated successfully
   */
  updateLastActiveTime(id: string): boolean;

  /**
   * Get terminals ordered by last active time
   *
   * @returns Terminal IDs ordered by most recent activity
   */
  getTerminalsByActivity(): string[];

  /**
   * Clear all terminal states
   * Used during disposal
   */
  clear(): void;

  /**
   * Dispose service and clean up resources
   */
  dispose(): void;
}

/**
 * Service token for dependency injection
 */
import { createServiceToken } from '../../core/DIContainer';
export const ITerminalStateService = createServiceToken<ITerminalStateService>('ITerminalStateService');
