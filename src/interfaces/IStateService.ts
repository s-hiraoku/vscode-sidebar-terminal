/**
 * State Management Interface
 *
 * Clean Architecture - Layer Separation
 * This interface defines the contract for state management
 * that can be implemented by both Extension and WebView layers.
 *
 * Key Principles:
 * - No layer-specific dependencies
 * - Observable state changes via callbacks
 * - Immutable state objects
 */

/**
 * Terminal state representation
 */
export interface TerminalState {
  readonly id: string;
  readonly name?: string;
  readonly isActive: boolean;
  readonly pid?: number;
  readonly cwd?: string;
  readonly exitCode?: number;
}

/**
 * Application state
 */
export interface ApplicationState {
  readonly terminals: ReadonlyArray<TerminalState>;
  readonly activeTerminalId: string | null;
  readonly totalTerminals: number;
}

/**
 * State change event
 */
export interface StateChangeEvent<T> {
  readonly type: 'terminal-added' | 'terminal-removed' | 'terminal-updated' | 'active-changed' | 'full-update';
  readonly data: T;
  readonly timestamp: number;
}

/**
 * State observer callback
 */
export type StateObserver<T> = (event: StateChangeEvent<T>) => void;

/**
 * State Service Interface
 *
 * Implemented by:
 * - ExtensionStateService (Extension layer)
 * - WebViewStateService (WebView layer)
 */
export interface IStateService {
  /**
   * Get current application state
   */
  getState(): ApplicationState;

  /**
   * Get a specific terminal state
   */
  getTerminalState(terminalId: string): TerminalState | null;

  /**
   * Update terminal state
   */
  updateTerminalState(terminalId: string, updates: Partial<TerminalState>): void;

  /**
   * Set active terminal
   */
  setActiveTerminal(terminalId: string): void;

  /**
   * Add a new terminal to state
   */
  addTerminal(terminal: TerminalState): void;

  /**
   * Remove a terminal from state
   */
  removeTerminal(terminalId: string): void;

  /**
   * Subscribe to state changes
   * Returns unsubscribe function
   */
  subscribe(observer: StateObserver<ApplicationState>): () => void;

  /**
   * Clear all state
   */
  clear(): void;
}

/**
 * State synchronization interface
 * Used to sync state between Extension and WebView
 */
export interface IStateSynchronizer {
  /**
   * Sync state from source to target
   */
  syncState(sourceState: ApplicationState): Promise<void>;

  /**
   * Handle state change event
   */
  handleStateChange(event: StateChangeEvent<ApplicationState>): Promise<void>;
}
