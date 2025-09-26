/**
 * Shell Integration Addon for Secondary Sidebar Terminal
 * Implements VS Code terminal shell integration features
 * - Command detection and tracking
 * - Exit code indication
 * - Command history navigation
 * - Current working directory detection
 */

import { ITerminalAddon, Terminal } from '@xterm/xterm';

export interface ICommandDetection {
  command: string;
  cwd?: string;
  timestamp: number;
  exitCode?: number;
  isRunning: boolean;
}

export interface IShellIntegrationEvents {
  onCommandStart: (command: ICommandDetection) => void;
  onCommandEnd: (command: ICommandDetection, exitCode: number) => void;
  onCwdChange: (cwd: string) => void;
  onPromptStart: () => void;
}

/**
 * Shell Integration Addon for processing OSC sequences
 * Compatible with VS Code terminal shell integration
 */
export class ShellIntegrationAddon implements ITerminalAddon {
  private terminal?: Terminal;
  private currentCommand?: ICommandDetection;
  private commandHistory: ICommandDetection[] = [];
  private currentCwd: string = '';
  private events?: IShellIntegrationEvents;
  private disposables: (() => void)[] = [];

  constructor(events?: IShellIntegrationEvents) {
    this.events = events;
  }

  public activate(terminal: Terminal): void {
    this.terminal = terminal;

    // Register OSC handler for shell integration sequences
    const oscHandler = terminal.parser.registerOscHandler(633, (data: string) => {
      return this.handleOSC633(data);
    });

    this.disposables.push(() => oscHandler.dispose());
  }

  public dispose(): void {
    this.disposables.forEach((dispose) => dispose());
    this.disposables = [];
    this.terminal = undefined;
    this.currentCommand = undefined;
  }

  /**
   * Handle OSC 633 sequences for shell integration
   * OSC 633 is VS Code specific shell integration protocol
   */
  private handleOSC633(data: string): boolean {
    const parts = data.split(';');
    const command = parts[0];

    try {
      switch (command) {
        case 'A': // Prompt start
          this.handlePromptStart();
          break;
        case 'B': // Command start
          this.handleCommandStart();
          break;
        case 'C': // Command executed
          this.handleCommandExecuted();
          break;
        case 'D': // Command finished with exit code
          const exitCode = parts[1] ? parseInt(parts[1], 10) : 0;
          this.handleCommandFinished(exitCode);
          break;
        case 'E': // Command line with optional nonce
          const commandLine = parts[1] || '';
          this.handleCommandLine(commandLine);
          break;
        case 'P': // Property (CWD, etc.)
          this.handleProperty(parts.slice(1));
          break;
        default:
          console.warn(`Unknown OSC 633 command: ${command}`);
          break;
      }
      return true;
    } catch (error) {
      console.error('Error handling OSC 633 sequence:', error);
      return false;
    }
  }

  /**
   * Handle prompt start (OSC 633;A)
   */
  private handlePromptStart(): void {
    // Mark that we're at a prompt, not executing a command
    if (this.currentCommand?.isRunning) {
      // Command finished without explicit exit code
      this.handleCommandFinished(0);
    }

    this.events?.onPromptStart();
  }

  /**
   * Handle command start (OSC 633;B)
   */
  private handleCommandStart(): void {
    this.currentCommand = {
      command: '',
      cwd: this.currentCwd,
      timestamp: Date.now(),
      isRunning: false,
    };
  }

  /**
   * Handle command executed (OSC 633;C)
   */
  private handleCommandExecuted(): void {
    if (this.currentCommand) {
      this.currentCommand.isRunning = true;
      this.events?.onCommandStart(this.currentCommand);
    }
  }

  /**
   * Handle command finished (OSC 633;D)
   */
  private handleCommandFinished(exitCode: number): void {
    if (this.currentCommand) {
      this.currentCommand.exitCode = exitCode;
      this.currentCommand.isRunning = false;

      // Add to history
      this.commandHistory.push({ ...this.currentCommand });

      // Keep only last 100 commands
      if (this.commandHistory.length > 100) {
        this.commandHistory.shift();
      }

      this.events?.onCommandEnd(this.currentCommand, exitCode);
      this.currentCommand = undefined;
    }
  }

  /**
   * Handle command line (OSC 633;E)
   */
  private handleCommandLine(commandLine: string): void {
    if (this.currentCommand) {
      this.currentCommand.command = commandLine;
    }
  }

  /**
   * Handle properties like CWD (OSC 633;P)
   */
  private handleProperty(parts: string[]): void {
    for (const part of parts) {
      const [key, value] = part.split('=', 2);

      switch (key) {
        case 'Cwd':
          if (value && value !== this.currentCwd) {
            this.currentCwd = value;
            this.events?.onCwdChange(value);
          }
          break;
        default:
          console.warn(`Unknown property: ${key}=${value}`);
          break;
      }
    }
  }

  /**
   * Get command history
   */
  public getCommandHistory(): ICommandDetection[] {
    return [...this.commandHistory];
  }

  /**
   * Get current working directory
   */
  public getCurrentCwd(): string {
    return this.currentCwd;
  }

  /**
   * Get currently running command
   */
  public getCurrentCommand(): ICommandDetection | undefined {
    return this.currentCommand;
  }

  /**
   * Check if shell integration is active
   */
  public isActive(): boolean {
    return !!this.terminal;
  }

  /**
   * Get last command with exit code
   */
  public getLastCommand(): ICommandDetection | undefined {
    return this.commandHistory[this.commandHistory.length - 1];
  }

  /**
   * Clear command history
   */
  public clearHistory(): void {
    this.commandHistory = [];
  }
}
