/**
 * Shell Integration Manager for WebView
 *
 * Enhanced shell integration features:
 * - OSC 633 sequence processing (VS Code compatible)
 * - Command detection and exit code indication
 * - Command status indicators
 * - Working directory display
 * - Command duration tracking
 * - Command history visualization
 */

import { Terminal } from '@xterm/xterm';
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { WebviewMessage } from '../../types/shared';
import { webview as log } from '../../utils/logger';
import {
  ShellIntegrationAddon,
  ICommandDetection,
  IShellIntegrationEvents,
} from '../addons/ShellIntegrationAddon';

export interface ShellStatus {
  terminalId: string;
  status: 'ready' | 'executing' | 'success' | 'error';
  currentCwd?: string;
  lastCommand?: string;
  lastExitCode?: number;
  lastDuration?: number;
}

export class ShellIntegrationManager implements IShellIntegrationEvents {
  private coordinator: IManagerCoordinator | null = null;
  private statusMap = new Map<string, ShellStatus>();
  private statusIndicators = new Map<string, HTMLElement>();
  private cwdDisplays = new Map<string, HTMLElement>();
  private shellAddons = new Map<string, ShellIntegrationAddon>();
  private commandStartTimes = new Map<string, number>();

  // VS Code standard colors
  private readonly STATUS_COLORS = {
    ready: '#007acc', // VS Code blue
    executing: '#f9c74f', // Yellow for running
    success: '#73c991', // Green for success
    error: '#f85149', // Red for error
  };

  constructor() {
    this.setupStyles();
  }

  public setCoordinator(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
  }

  /**
   * Initialize shell integration for a terminal
   */
  public initializeTerminalShellIntegration(terminal: Terminal, terminalId: string): void {
    try {
      // Create and load shell integration addon
      const addon = new ShellIntegrationAddon(this);
      terminal.loadAddon(addon);

      this.shellAddons.set(terminalId, addon);

      // Initialize status
      this.statusMap.set(terminalId, {
        terminalId,
        status: 'ready',
      });

      log(`🐚 Shell Integration initialized for terminal: ${terminalId}`);
      this.updateStatusIndicator(terminalId, 'ready');
    } catch (error) {
      log(`Failed to initialize shell integration for terminal ${terminalId}:`, error);
    }
  }

  /**
   * Shell Integration Event Handlers (IShellIntegrationEvents)
   */
  public onCommandStart = (command: ICommandDetection): void => {
    // Find terminal ID for this command
    const terminalId = this.findTerminalIdForCommand(command);
    if (!terminalId) return;

    log(`🚀 Command started in terminal ${terminalId}: ${command.command}`);

    // Update status
    this.updateShellStatus(terminalId, 'executing');

    // Track start time for duration calculation
    this.commandStartTimes.set(terminalId, command.timestamp);

    // Update status with command info
    const status = this.statusMap.get(terminalId);
    if (status) {
      status.lastCommand = command.command;
      status.currentCwd = command.cwd;
    }
  };

  public onCommandEnd = (command: ICommandDetection, exitCode: number): void => {
    const terminalId = this.findTerminalIdForCommand(command);
    if (!terminalId) return;

    log(
      `✅ Command finished in terminal ${terminalId}: "${command.command}" (exit code: ${exitCode})`
    );

    // Calculate duration
    const startTime = this.commandStartTimes.get(terminalId);
    const duration = startTime ? Date.now() - startTime : undefined;
    this.commandStartTimes.delete(terminalId);

    // Update status
    const status = exitCode === 0 ? 'success' : 'error';
    this.updateShellStatus(terminalId, status);

    // Update status info
    const statusInfo = this.statusMap.get(terminalId);
    if (statusInfo) {
      statusInfo.lastExitCode = exitCode;
      statusInfo.lastDuration = duration;
    }

    // Show exit code indicator for errors
    if (exitCode !== 0) {
      this.showExitCodeNotification(terminalId, exitCode, command.command);
    }

    // Auto-return to ready state after 2 seconds
    setTimeout(() => {
      this.updateShellStatus(terminalId, 'ready');
    }, 2000);
  };

  public onCwdChange = (cwd: string): void => {
    // Find all terminals and update CWD for the one that matches
    // This is a simplified approach - in reality, we'd need better terminal tracking
    this.statusMap.forEach((status, terminalId) => {
      this.updateCwd(terminalId, cwd);
    });
  };

  public onPromptStart = (): void => {
    log('💡 Shell prompt started');
    // Could update UI to show prompt state
  };

  /**
   * Find terminal ID for a command (helper method)
   */
  private findTerminalIdForCommand(command: ICommandDetection): string | undefined {
    // In a more sophisticated implementation, we'd track which terminal
    // each ShellIntegrationAddon belongs to. For now, we'll use a simple approach
    for (const [terminalId, addon] of this.shellAddons.entries()) {
      if (addon.getCurrentCommand() === command) {
        return terminalId;
      }
    }

    // Fallback: use first terminal if we can't match
    const firstTerminalId = Array.from(this.statusMap.keys())[0];
    return firstTerminalId;
  }

  /**
   * Show exit code notification for failed commands
   */
  private showExitCodeNotification(terminalId: string, exitCode: number, command: string): void {
    // This would integrate with NotificationManager in a full implementation
    log(`Command failed in terminal ${terminalId}: "${command}" (exit code: ${exitCode})`);

    // Show visual indicator
    this.coordinator?.postMessageToExtension({
      command: 'showNotification',
      message: `Command failed: "${command}" (exit code: ${exitCode})`,
      type: 'warning',
    });
  }

  private setupStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .shell-status-indicator {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 4px;
        transition: background-color 0.2s ease;
      }
      
      .shell-status-indicator.ready {
        background-color: ${this.STATUS_COLORS.ready};
      }
      
      .shell-status-indicator.executing {
        background-color: ${this.STATUS_COLORS.executing};
        animation: pulse 1s infinite;
      }
      
      .shell-status-indicator.success {
        background-color: ${this.STATUS_COLORS.success};
      }
      
      .shell-status-indicator.error {
        background-color: ${this.STATUS_COLORS.error};
      }
      
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
      
      .shell-cwd-display {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        margin-left: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 200px;
      }
      
      .command-duration {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        margin-left: 4px;
      }
      
      .terminal-decoration {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .command-status-gutter {
        position: absolute;
        left: 0;
        width: 3px;
        height: 100%;
        transition: background-color 0.2s ease;
      }
      
      .command-status-gutter.success {
        background-color: ${this.STATUS_COLORS.success};
      }
      
      .command-status-gutter.error {
        background-color: ${this.STATUS_COLORS.error};
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Update shell status from extension
   */
  public updateShellStatus(
    terminalId: string,
    status: 'ready' | 'executing' | 'success' | 'error'
  ): void {
    let shellStatus = this.statusMap.get(terminalId);
    if (!shellStatus) {
      shellStatus = {
        terminalId,
        status: 'ready',
      };
      this.statusMap.set(terminalId, shellStatus);
    }

    shellStatus.status = status;
    this.updateStatusIndicator(terminalId, status);

    // Add command gutter decoration for success/error
    if (status === 'success' || status === 'error') {
      this.addCommandGutter(terminalId, status);
    }
  }

  /**
   * Update current working directory
   */
  public updateCwd(terminalId: string, cwd: string): void {
    let shellStatus = this.statusMap.get(terminalId);
    if (!shellStatus) {
      shellStatus = {
        terminalId,
        status: 'ready',
      };
      this.statusMap.set(terminalId, shellStatus);
    }

    shellStatus.currentCwd = cwd;
    this.updateCwdDisplay(terminalId, cwd);
  }

  /**
   * Update status indicator in terminal header
   */
  private updateStatusIndicator(
    terminalId: string,
    status: 'ready' | 'executing' | 'success' | 'error'
  ): void {
    // Find or create status indicator
    let indicator = this.statusIndicators.get(terminalId);
    if (!indicator) {
      const header = document.querySelector(`[data-terminal-id="${terminalId}"] .terminal-header`);
      if (!header) return;

      indicator = document.createElement('span');
      indicator.className = 'shell-status-indicator';

      // Insert at the beginning of header
      const title = header.querySelector('.terminal-title');
      if (title) {
        header.insertBefore(indicator, title);
      } else {
        header.appendChild(indicator);
      }

      this.statusIndicators.set(terminalId, indicator);
    }

    // Update indicator class
    indicator.className = `shell-status-indicator ${status}`;

    // Add tooltip
    switch (status) {
      case 'ready':
        indicator.title = 'Ready';
        break;
      case 'executing':
        indicator.title = 'Running command...';
        break;
      case 'success':
        indicator.title = 'Last command succeeded';
        break;
      case 'error':
        indicator.title = 'Last command failed';
        break;
    }
  }

  /**
   * Update CWD display in terminal header
   */
  private updateCwdDisplay(terminalId: string, cwd: string): void {
    // Find or create CWD display
    let cwdDisplay = this.cwdDisplays.get(terminalId);
    if (!cwdDisplay) {
      const header = document.querySelector(`[data-terminal-id="${terminalId}"] .terminal-header`);
      if (!header) return;

      cwdDisplay = document.createElement('span');
      cwdDisplay.className = 'shell-cwd-display';

      // Find a good place to insert
      const title = header.querySelector('.terminal-title');
      if (title && title.nextSibling) {
        header.insertBefore(cwdDisplay, title.nextSibling);
      } else {
        header.appendChild(cwdDisplay);
      }

      this.cwdDisplays.set(terminalId, cwdDisplay);
    }

    // Format and display CWD
    const home = process.env.HOME || process.env.USERPROFILE;
    let displayCwd = cwd;
    if (home && cwd.startsWith(home)) {
      displayCwd = '~' + cwd.slice(home.length);
    }

    cwdDisplay.textContent = displayCwd;
    cwdDisplay.title = cwd; // Full path in tooltip
  }

  /**
   * Add command gutter decoration
   */
  private addCommandGutter(terminalId: string, status: 'success' | 'error'): void {
    const terminalInstance = this.coordinator?.getAllTerminalInstances().get(terminalId);
    if (!terminalInstance) return;

    const container = terminalInstance.container;
    if (!container) return;

    // Create gutter element
    const gutter = document.createElement('div');
    gutter.className = `command-status-gutter ${status}`;

    // Add to terminal body
    const terminalBody = container.querySelector('.terminal-body');
    if (terminalBody) {
      terminalBody.appendChild(gutter);

      // Fade out after 3 seconds
      setTimeout(() => {
        gutter.style.opacity = '0';
        setTimeout(() => gutter.remove(), 200);
      }, 3000);
    }
  }

  /**
   * Handle command link click (for re-running commands)
   */
  public handleCommandLink(terminalId: string, command: string): void {
    const terminalInstance = this.coordinator?.getAllTerminalInstances().get(terminalId);
    if (!terminalInstance) return;

    // Send command to terminal
    terminalInstance.terminal.paste(command);
  }

  /**
   * Create command palette for history
   */
  public showCommandHistory(
    terminalId: string,
    history: Array<{ command: string; exitCode?: number; duration?: number }>
  ): void {
    // This would integrate with VS Code's QuickPick API
    // For now, we'll just log it
    log('Command history for terminal', terminalId, history);
  }

  /**
   * Add decorations to terminal output
   */
  public decorateTerminalOutput(_terminal: Terminal, _terminalId: string): void {
    // Link handling now relies on:
    // - xterm WebLinksAddon (custom handler posts to extension)
    // - TerminalLinkManager for file links
    // No additional per-line link providers are needed here. This keeps
    // selection/copy behavior intact and avoids duplicate overlays.
  }

  /**
   * Process incoming message from extension
   */
  public handleMessage(message: WebviewMessage): void {
    switch (message.command) {
      case 'updateShellStatus':
        if ('terminalId' in message && 'status' in message) {
          this.updateShellStatus(message.terminalId as string, message.status as any);
        }
        break;

      case 'updateCwd':
        if ('terminalId' in message && 'cwd' in message) {
          this.updateCwd(message.terminalId as string, message.cwd as string);
        }
        break;

      case 'commandHistory':
        if ('terminalId' in message && 'history' in message) {
          this.showCommandHistory(message.terminalId as string, message.history as any);
        }
        break;
    }
  }

  /**
   * Clean up resources for a terminal
   */
  public disposeTerminal(terminalId: string): void {
    this.statusMap.delete(terminalId);
    this.commandStartTimes.delete(terminalId);

    const indicator = this.statusIndicators.get(terminalId);
    if (indicator) {
      indicator.remove();
      this.statusIndicators.delete(terminalId);
    }

    const cwdDisplay = this.cwdDisplays.get(terminalId);
    if (cwdDisplay) {
      cwdDisplay.remove();
      this.cwdDisplays.delete(terminalId);
    }

    // Dispose shell integration addon
    const addon = this.shellAddons.get(terminalId);
    if (addon) {
      addon.dispose();
      this.shellAddons.delete(terminalId);
    }
  }

  public dispose(): void {
    this.statusMap.clear();
    this.commandStartTimes.clear();
    this.statusIndicators.forEach((indicator) => indicator.remove());
    this.statusIndicators.clear();
    this.cwdDisplays.forEach((display) => display.remove());
    this.cwdDisplays.clear();
    this.shellAddons.forEach((addon) => addon.dispose());
    this.shellAddons.clear();
  }

  /**
   * Get shell integration state for a terminal
   */
  public getShellIntegrationState(terminalId: string):
    | {
        isActive: boolean;
        currentCommand?: ICommandDetection;
        commandHistory: ICommandDetection[];
        currentCwd: string;
        lastExitCode?: number;
      }
    | undefined {
    const addon = this.shellAddons.get(terminalId);
    if (!addon) return undefined;

    return {
      isActive: addon.isActive(),
      currentCommand: addon.getCurrentCommand(),
      commandHistory: addon.getCommandHistory(),
      currentCwd: addon.getCurrentCwd(),
      lastExitCode: this.statusMap.get(terminalId)?.lastExitCode,
    };
  }

  /**
   * Get command history for a terminal
   */
  public getTerminalCommandHistory(terminalId: string): ICommandDetection[] {
    const addon = this.shellAddons.get(terminalId);
    return addon?.getCommandHistory() || [];
  }

  /**
   * Clear command history for a terminal
   */
  public clearTerminalCommandHistory(terminalId: string): void {
    const addon = this.shellAddons.get(terminalId);
    addon?.clearHistory();
  }
}
