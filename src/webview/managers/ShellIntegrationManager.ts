/**
 * Shell Integration Manager for WebView
 * 
 * Handles shell integration features in the webview:
 * - Command status indicators
 * - Working directory display
 * - Command duration tracking
 * - Command history visualization
 */

import { Terminal } from 'xterm';
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { WebviewMessage } from '../../types/shared';

export interface ShellStatus {
  terminalId: string;
  status: 'ready' | 'executing' | 'success' | 'error';
  currentCwd?: string;
  lastCommand?: string;
  lastExitCode?: number;
  lastDuration?: number;
}

export class ShellIntegrationManager {
  private coordinator: IManagerCoordinator | null = null;
  private statusMap = new Map<string, ShellStatus>();
  private statusIndicators = new Map<string, HTMLElement>();
  private cwdDisplays = new Map<string, HTMLElement>();

  // VS Code standard colors
  private readonly STATUS_COLORS = {
    ready: '#007acc',      // VS Code blue
    executing: '#f9c74f',  // Yellow for running
    success: '#73c991',    // Green for success
    error: '#f85149',      // Red for error
  };

  constructor() {
    this.setupStyles();
  }

  public setCoordinator(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
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
  public updateShellStatus(terminalId: string, status: 'ready' | 'executing' | 'success' | 'error'): void {
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
  private updateStatusIndicator(terminalId: string, status: 'ready' | 'executing' | 'success' | 'error'): void {
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
  public showCommandHistory(terminalId: string, history: Array<{ command: string; exitCode?: number; duration?: number }>): void {
    // This would integrate with VS Code's QuickPick API
    // For now, we'll just log it
    console.log('Command history for terminal', terminalId, history);
  }

  /**
   * Add decorations to terminal output
   */
  public decorateTerminalOutput(terminal: Terminal, _terminalId: string): void {
    // Add link provider for file paths
    terminal.registerLinkProvider({
      provideLinks: (line: number, callback) => {
        // Simple file path detection
        const lineContent = terminal.buffer.active.getLine(line - 1)?.translateToString();
        if (!lineContent) {
          callback(undefined);
          return;
        }

        const filePathRegex = /(?:[a-zA-Z]:)?(?:\/|\\)?(?:[\w.-]+(?:\/|\\))*[\w.-]+\.\w+/g;
        const links: any[] = [];
        let match: RegExpExecArray | null;

        while ((match = filePathRegex.exec(lineContent)) !== null) {
          links.push({
            range: {
              start: { x: match.index + 1, y: line },
              end: { x: match.index + match[0].length + 1, y: line }
            },
            text: match[0],
            activate: () => {
              // Send open file command to extension
              if (match) {
                this.coordinator?.postMessageToExtension({
                  command: 'openFile',
                  filePath: match[0],
                });
              }
            }
          });
        }

        callback(links);
      }
    });

    // Add link provider for URLs
    terminal.registerLinkProvider({
      provideLinks: (line: number, callback) => {
        const lineContent = terminal.buffer.active.getLine(line - 1)?.translateToString();
        if (!lineContent) {
          callback(undefined);
          return;
        }

        const urlRegex = /https?:\/\/[^\s]+/g;
        const links: any[] = [];
        let match: RegExpExecArray | null;

        while ((match = urlRegex.exec(lineContent)) !== null) {
          links.push({
            range: {
              start: { x: match.index + 1, y: line },
              end: { x: match.index + match[0].length + 1, y: line }
            },
            text: match[0],
            activate: () => {
              if (match) {
                window.open(match[0], '_blank');
              }
            }
          });
        }

        callback(links);
      }
    });
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
  }

  public dispose(): void {
    this.statusMap.clear();
    this.statusIndicators.forEach(indicator => indicator.remove());
    this.statusIndicators.clear();
    this.cwdDisplays.forEach(display => display.remove());
    this.cwdDisplays.clear();
  }
}