/**
 * ITerminal Interface
 *
 * VS Code standard terminal interface pattern.
 * Defines the contract for terminal instances following VS Code's architecture.
 *
 * Based on: src/vs/workbench/contrib/terminal/browser/terminal.ts
 */

import { Event } from 'vscode';
import { ProcessState } from '../../types/shared';

/**
 * Terminal instance interface
 *
 * Represents a single terminal instance with lifecycle management,
 * process tracking, and event coordination.
 */
export interface ITerminal {
  /**
   * Unique terminal identifier
   * Unlike VS Code's numeric instanceId, we use string IDs for flexibility
   */
  readonly id: string;

  /**
   * Terminal display name
   */
  readonly name: string;

  /**
   * Terminal number (1-5 for recycling)
   * VS Code uses continuous numbering, we use recycled numbers
   */
  readonly number: number;

  /**
   * Current working directory
   */
  readonly cwd: string | undefined;

  /**
   * Process ID of the underlying pty process
   * undefined until process is spawned
   */
  readonly processId: number | undefined;

  /**
   * Current process state
   */
  readonly processState: ProcessState;

  /**
   * Whether this terminal has been disposed
   */
  readonly isDisposed: boolean;

  /**
   * Terminal title (may differ from name)
   */
  readonly title: string;

  /**
   * Terminal color (for UI theming)
   */
  readonly color: string | undefined;

  /**
   * Terminal icon (for UI display)
   */
  readonly icon: string | undefined;

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Dispose the terminal instance
   *
   * Cleans up all resources, terminates the process, and removes event handlers.
   * This is a full disposal - terminal cannot be revived.
   */
  dispose(): void;

  /**
   * Detach the terminal instance
   *
   * Disconnects the terminal from the UI but keeps the process alive.
   * Used during window reload for session persistence.
   *
   * VS Code pattern: Detachment allows process to survive reload
   */
  detach(): void;

  /**
   * Kill the underlying terminal process
   *
   * @param immediate If true, force kill (SIGKILL), otherwise graceful (SIGTERM)
   */
  kill(immediate?: boolean): void;

  // ============================================================================
  // Process Management
  // ============================================================================

  /**
   * Send input to the terminal process
   *
   * @param data Data to write to the pty process
   */
  sendData(data: string): void;

  /**
   * Resize the terminal
   *
   * @param cols Number of columns
   * @param rows Number of rows
   */
  resize(cols: number, rows: number): void;

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Get the shell launch configuration
   *
   * Returns the configuration used to launch this terminal's shell
   */
  getShellLaunchConfig(): IShellLaunchConfig;

  /**
   * Get process details for serialization
   *
   * Returns current process state for persistence
   */
  getProcessDetails(): ITerminalProcessDetails;

  // ============================================================================
  // Events (VS Code Event Pattern)
  // ============================================================================

  /**
   * Fired when the terminal instance is disposed
   */
  readonly onDidDispose: Event<void>;

  /**
   * Fired when the terminal process exits
   *
   * @param exitCode Process exit code
   */
  readonly onProcessExit: Event<number | undefined>;

  /**
   * Fired when the terminal title changes
   *
   * @param title New terminal title
   */
  readonly onTitleChange: Event<string>;

  /**
   * Fired when terminal data is received from the process
   *
   * @param data Output data from the pty process
   */
  readonly onData: Event<string>;

  /**
   * Fired when the terminal process state changes
   *
   * @param state New process state
   */
  readonly onProcessStateChange: Event<ProcessState>;

  /**
   * Fired when the terminal process ID becomes available
   *
   * @param processId Process ID of the pty process
   */
  readonly onProcessIdReady: Event<number>;
}

/**
 * Shell launch configuration
 *
 * Based on VS Code's IShellLaunchConfig
 * Defines how the terminal shell should be launched
 */
export interface IShellLaunchConfig {
  /**
   * Shell executable path
   *
   * If undefined, uses default shell for platform
   */
  executable?: string;

  /**
   * Shell arguments
   */
  args?: string[];

  /**
   * Environment variables
   *
   * Merged with process environment
   */
  env?: { [key: string]: string | undefined };

  /**
   * Current working directory
   */
  cwd?: string;

  /**
   * Terminal name
   */
  name?: string;

  /**
   * Terminal icon ID
   */
  icon?: string;

  /**
   * Terminal color
   */
  color?: string;

  /**
   * Whether to ignore shell integration
   */
  ignoreShellIntegration?: boolean;

  /**
   * Initial text to write to terminal
   *
   * Used for session restoration - replays buffer content
   */
  initialText?: string;
}

/**
 * Terminal process details
 *
 * Based on VS Code's terminal state serialization
 * Contains process information for persistence
 */
export interface ITerminalProcessDetails {
  /**
   * Current working directory
   */
  cwd: string;

  /**
   * Terminal title
   */
  title: string;

  /**
   * Terminal color (hex or theme color)
   */
  color?: string;

  /**
   * Terminal icon identifier
   */
  icon?: string;

  /**
   * Process ID
   */
  processId?: number;

  /**
   * Shell type (bash, zsh, powershell, etc.)
   */
  shellType?: string;

  /**
   * Process exit code (if exited)
   */
  exitCode?: number;
}

/**
 * Terminal dimension
 */
export interface ITerminalDimensions {
  /**
   * Number of columns
   */
  cols: number;

  /**
   * Number of rows
   */
  rows: number;
}
