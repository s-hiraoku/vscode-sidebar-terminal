import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { Unicode11Addon } from 'xterm-addon-unicode11';

// Import types and constants for webview
import type { WebviewMessage, VsCodeMessage, TerminalConfig } from '../types/common';

// Constants for webview (duplicated to avoid import issues)
const WEBVIEW_CONSTANTS = {
  CSS_VARS: {
    TAB_INACTIVE_BACKGROUND: 'var(--vscode-tab-inactiveBackground)',
    TAB_ACTIVE_BACKGROUND: 'var(--vscode-tab-activeBackground)',
    TAB_INACTIVE_FOREGROUND: 'var(--vscode-tab-inactiveForeground)',
    TAB_ACTIVE_FOREGROUND: 'var(--vscode-tab-activeForeground)',
    TAB_BORDER: 'var(--vscode-tab-border)',
    EDITOR_BACKGROUND: 'var(--vscode-editor-background)',
  },
  DARK_THEME: {
    background: '#1e1e1e',
    foreground: '#cccccc',
    cursor: '#ffffff',
    cursorAccent: '#000000',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff',
  },
  LIGHT_THEME: {
    background: '#ffffff',
    foreground: '#333333',
    cursor: '#000000',
    cursorAccent: '#ffffff',
    black: '#000000',
    red: '#cd3131',
    green: '#00bc00',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
    brightBlack: '#666666',
    brightRed: '#cd3131',
    brightGreen: '#14ce14',
    brightYellow: '#b5ba00',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#a5a5a5',
  },
};

const TERMINAL_CONSTANTS = {
  TERMINAL_REMOVE_DELAY: 2000,
  COMMANDS: {
    READY: 'ready',
    INIT: 'init',
    INPUT: 'input',
    OUTPUT: 'output',
    RESIZE: 'resize',
    CLEAR: 'clear',
    EXIT: 'exit',
    SPLIT: 'split',
    TERMINAL_CREATED: 'terminalCreated',
    TERMINAL_REMOVED: 'terminalRemoved',
    SWITCH_TERMINAL: 'switchTerminal',
  },
};

const ERROR_MESSAGES = {
  TERMINAL_CONTAINER_NOT_FOUND: 'Terminal container not found',
};

// Types are now imported from ../types/common

declare const acquireVsCodeApi: () => {
  postMessage: (message: VsCodeMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

const vscode = acquireVsCodeApi();

interface TerminalPane {
  id: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  element: HTMLElement;
  name: string;
  isActive: boolean;
}

class TerminalWebviewManager {
  private terminals = new Map<string, TerminalPane>();
  private activeTerminalId: string | undefined;
  private splitContainer: HTMLElement | undefined;

  public initializeSplitView(): void {
    const container = document.getElementById('terminal');
    if (!container) {
      console.error(ERROR_MESSAGES.TERMINAL_CONTAINER_NOT_FOUND);
      return;
    }

    container.innerHTML = `
      <div id="split-container" style="display: flex; flex-direction: column; height: 100%; width: 100%;">
        <div id="terminal-tabs" style="display: flex; background: ${WEBVIEW_CONSTANTS.CSS_VARS.TAB_INACTIVE_BACKGROUND}; border-bottom: 1px solid ${WEBVIEW_CONSTANTS.CSS_VARS.TAB_BORDER}; min-height: 30px; align-items: center; padding: 0 8px; gap: 4px;"></div>
        <div id="terminal-panes" style="flex: 1; display: flex; flex-direction: row;"></div>
      </div>
    `;

    this.splitContainer = document.getElementById('terminal-panes') || undefined;
  }

  public createTerminal(
    id: string,
    name: string,
    config: TerminalConfig,
    isActive: boolean = false
  ): void {
    if (!this.splitContainer) {
      this.initializeSplitView();
    }

    const terminal = new Terminal({
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      theme: getTheme(),
      cursorBlink: true,
      allowTransparency: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(new Unicode11Addon());

    // Create terminal pane
    const paneElement = document.createElement('div');
    paneElement.id = `terminal-pane-${id}`;
    paneElement.style.cssText = `
      flex: 1;
      display: ${isActive ? 'block' : 'none'};
      width: 100%;
      height: 100%;
    `;

    this.splitContainer?.appendChild(paneElement);
    terminal.open(paneElement);
    fitAddon.fit();

    // Handle terminal input
    terminal.onData((data) => {
      vscode.postMessage({
        command: 'input' as const,
        data,
        terminalId: id,
      });
    });

    // Handle resize
    terminal.onResize((size) => {
      vscode.postMessage({
        command: 'resize' as const,
        cols: size.cols,
        rows: size.rows,
        terminalId: id,
      });
    });

    const terminalPane: TerminalPane = {
      id,
      terminal,
      fitAddon,
      element: paneElement,
      name,
      isActive,
    };

    this.terminals.set(id, terminalPane);

    if (isActive) {
      this.setActiveTerminal(id);
    }

    // Create tab
    this.createTab(id, name, isActive);

    // Observe container resize
    const resizeObserver = new ResizeObserver(() => {
      if (isActive) {
        fitAddon.fit();
      }
    });
    resizeObserver.observe(paneElement);
  }

  public createTab(terminalId: string, name: string, isActive: boolean): void {
    const tabsContainer = document.getElementById('terminal-tabs');
    if (!tabsContainer) return;

    const tab = document.createElement('div');
    tab.id = `terminal-tab-${terminalId}`;
    tab.textContent = name;
    tab.style.cssText = `
      padding: 4px 12px;
      cursor: pointer;
      background: ${isActive ? WEBVIEW_CONSTANTS.CSS_VARS.TAB_ACTIVE_BACKGROUND : WEBVIEW_CONSTANTS.CSS_VARS.TAB_INACTIVE_BACKGROUND};
      color: ${isActive ? WEBVIEW_CONSTANTS.CSS_VARS.TAB_ACTIVE_FOREGROUND : WEBVIEW_CONSTANTS.CSS_VARS.TAB_INACTIVE_FOREGROUND};
      border: 1px solid ${WEBVIEW_CONSTANTS.CSS_VARS.TAB_BORDER};
      border-bottom: none;
      border-radius: 4px 4px 0 0;
      font-size: 12px;
      user-select: none;
    `;

    tab.addEventListener('click', () => {
      this.setActiveTerminal(terminalId);
    });

    tabsContainer.appendChild(tab);
  }

  public setActiveTerminal(terminalId: string): void {
    // Hide all terminals
    for (const [id, pane] of this.terminals) {
      pane.element.style.display = 'none';
      pane.isActive = false;

      // Update tab appearance
      const tab = document.getElementById(`terminal-tab-${id}`);
      if (tab) {
        tab.style.background = WEBVIEW_CONSTANTS.CSS_VARS.TAB_INACTIVE_BACKGROUND;
        tab.style.color = WEBVIEW_CONSTANTS.CSS_VARS.TAB_INACTIVE_FOREGROUND;
      }
    }

    // Show active terminal
    const activePane = this.terminals.get(terminalId);
    if (activePane) {
      activePane.element.style.display = 'block';
      activePane.isActive = true;
      activePane.terminal.focus();
      activePane.fitAddon.fit();
      this.activeTerminalId = terminalId;

      // Update tab appearance
      const tab = document.getElementById(`terminal-tab-${terminalId}`);
      if (tab) {
        tab.style.background = WEBVIEW_CONSTANTS.CSS_VARS.TAB_ACTIVE_BACKGROUND;
        tab.style.color = WEBVIEW_CONSTANTS.CSS_VARS.TAB_ACTIVE_FOREGROUND;
      }

      // Notify extension
      vscode.postMessage({
        command: 'switchTerminal' as const,
        terminalId,
      });
    }
  }

  public removeTerminal(terminalId: string): void {
    const pane = this.terminals.get(terminalId);
    if (pane) {
      pane.terminal.dispose();
      pane.element.remove();
      this.terminals.delete(terminalId);

      // Remove tab
      const tab = document.getElementById(`terminal-tab-${terminalId}`);
      if (tab) {
        tab.remove();
      }

      // If this was the active terminal, activate another one
      if (this.activeTerminalId === terminalId) {
        const remaining = Array.from(this.terminals.keys());
        if (remaining.length > 0 && remaining[0]) {
          this.setActiveTerminal(remaining[0]);
        } else {
          this.activeTerminalId = undefined;
        }
      }
    }
  }

  public getActiveTerminalId(): string | undefined {
    return this.activeTerminalId;
  }

  public getTerminal(terminalId: string): TerminalPane | undefined {
    return this.terminals.get(terminalId);
  }

  public clear(): void {
    if (this.activeTerminalId) {
      const pane = this.terminals.get(this.activeTerminalId);
      pane?.terminal.clear();
    }
  }

  public writeToTerminal(terminalId: string, data: string): void {
    const pane = this.terminals.get(terminalId);
    pane?.terminal.write(data);
  }
}

// Global instance
const terminalManager = new TerminalWebviewManager();

function getTheme(): { [key: string]: string } {
  const style = getComputedStyle(document.body);
  const isDark = style
    .getPropertyValue(WEBVIEW_CONSTANTS.CSS_VARS.EDITOR_BACKGROUND)
    .includes('1e1e1e');

  return isDark ? WEBVIEW_CONSTANTS.DARK_THEME : WEBVIEW_CONSTANTS.LIGHT_THEME;
}

// Handle messages from the extension
window.addEventListener('message', (event) => {
  const message = event.data as WebviewMessage;

  switch (message.command) {
    case TERMINAL_CONSTANTS.COMMANDS.INIT:
      if (message.config) {
        terminalManager.initializeSplitView();
        // Initialize existing terminals
        if (message.terminals && message.terminals.length > 0) {
          for (const terminal of message.terminals) {
            terminalManager.createTerminal(
              terminal.id,
              terminal.name,
              message.config,
              terminal.isActive
            );
          }
        } else {
          // Create first terminal if none exist
          const firstTerminalId = 'terminal-initial';
          terminalManager.createTerminal(firstTerminalId, 'Terminal 1', message.config, true);
        }
      }
      break;

    case TERMINAL_CONSTANTS.COMMANDS.OUTPUT:
      if (message.data && message.terminalId) {
        terminalManager.writeToTerminal(message.terminalId, message.data);
      }
      break;

    case TERMINAL_CONSTANTS.COMMANDS.CLEAR:
      terminalManager.clear();
      break;

    case TERMINAL_CONSTANTS.COMMANDS.EXIT:
      if (message.terminalId) {
        terminalManager.writeToTerminal(
          message.terminalId,
          `\r\n[Process exited with code ${message.exitCode ?? 'unknown'}]\r\n`
        );
        setTimeout(
          () => terminalManager.removeTerminal(message.terminalId!),
          TERMINAL_CONSTANTS.TERMINAL_REMOVE_DELAY
        );
      }
      break;

    case TERMINAL_CONSTANTS.COMMANDS.SPLIT:
    case TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED:
      if (message.terminalId && message.terminalName && message.config) {
        terminalManager.createTerminal(
          message.terminalId,
          message.terminalName,
          message.config,
          true
        );
      }
      break;

    case TERMINAL_CONSTANTS.COMMANDS.TERMINAL_REMOVED:
      if (message.terminalId) {
        terminalManager.removeTerminal(message.terminalId);
      }
      break;
  }
});

// Notify extension that webview is ready
vscode.postMessage({ command: 'ready' as const });
