/**
 * Terminal Coordinator Service Interface
 * Handles terminal lifecycle coordination without UI concerns
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

export interface TerminalInfo {
  readonly id: string;
  readonly terminal: Terminal;
  readonly fitAddon: FitAddon;
  readonly container: HTMLElement;
  readonly number: number;
  readonly isActive: boolean;
}

export interface TerminalCreationOptions {
  readonly initialCommand?: string;
  readonly workingDirectory?: string;
  readonly profile?: string;
  readonly environmentVariables?: Record<string, string>;
}

export interface TerminalCoordinatorEvents {
  onTerminalCreated: (terminalInfo: TerminalInfo) => void;
  onTerminalRemoved: (terminalId: string) => void;
  onTerminalActivated: (terminalId: string) => void;
  onTerminalOutput: (terminalId: string, data: string) => void;
  onTerminalResize: (terminalId: string, cols: number, rows: number) => void;
}

/**
 * Core terminal coordination service
 * Manages terminal instances without UI concerns
 */
export interface ITerminalCoordinator {
  // Initialization
  initialize(): Promise<void>;

  // Terminal lifecycle management
  createTerminal(options?: TerminalCreationOptions): Promise<string>;
  removeTerminal(terminalId: string): Promise<boolean>;
  activateTerminal(terminalId: string): void;

  // Terminal access
  getTerminal(terminalId: string): Terminal | undefined;
  getTerminalInfo(terminalId: string): TerminalInfo | undefined;
  getAllTerminalInfos(): TerminalInfo[];
  getActiveTerminalId(): string | undefined;

  // Terminal operations
  writeToTerminal(terminalId: string, data: string): void;
  resizeTerminal(terminalId: string, cols: number, rows: number): void;
  switchToTerminal(terminalId: string): Promise<void>;

  // State queries
  hasTerminals(): boolean;
  canCreateTerminal(): boolean;
  getTerminalCount(): number;
  getAvailableSlots(): number;

  // Event management
  addEventListener<K extends keyof TerminalCoordinatorEvents>(
    event: K,
    listener: TerminalCoordinatorEvents[K]
  ): void;
  removeEventListener<K extends keyof TerminalCoordinatorEvents>(
    event: K,
    listener: TerminalCoordinatorEvents[K]
  ): void;

  // Resource management
  dispose(): void;
}

/**
 * Terminal coordinator configuration
 */
export interface TerminalCoordinatorConfig {
  readonly maxTerminals: number;
  readonly defaultShell: string;
  readonly workingDirectory: string;
  readonly enablePerformanceOptimization: boolean;
  readonly bufferSize: number;
  readonly debugMode: boolean;
}

/**
 * Factory interface for creating terminal coordinators
 */
export interface ITerminalCoordinatorFactory {
  create(config: TerminalCoordinatorConfig): ITerminalCoordinator;
}