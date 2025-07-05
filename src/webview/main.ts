import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { Unicode11Addon } from 'xterm-addon-unicode11';

interface WebviewMessage {
  command: 'init' | 'output' | 'clear' | 'exit';
  config?: { fontSize: number; fontFamily: string };
  data?: string;
  exitCode?: number;
}

interface VsCodeMessage {
  command: 'ready' | 'input' | 'resize';
  data?: string;
  cols?: number;
  rows?: number;
}

declare const acquireVsCodeApi: () => {
  postMessage: (message: VsCodeMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

const vscode = acquireVsCodeApi();

let terminal: Terminal | undefined;
let fitAddon: FitAddon | undefined;

function initializeTerminal(config: { fontSize: number; fontFamily: string }): void {
  if (terminal) {
    terminal.dispose();
  }

  terminal = new Terminal({
    fontSize: config.fontSize,
    fontFamily: config.fontFamily,
    theme: getTheme(),
    cursorBlink: true,
    allowTransparency: true,
    scrollback: 10000,
  });

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebLinksAddon());
  terminal.loadAddon(new Unicode11Addon());

  const container = document.getElementById('terminal');
  if (!container) {
    console.error('Terminal container not found');
    return;
  }

  terminal.open(container);
  fitAddon.fit();

  // Handle terminal input
  terminal.onData((data) => {
    vscode.postMessage({
      command: 'input',
      data,
    });
  });

  // Handle resize
  terminal.onResize((size) => {
    vscode.postMessage({
      command: 'resize',
      cols: size.cols,
      rows: size.rows,
    });
  });

  // Observe container resize
  const resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit();
  });
  resizeObserver.observe(container);

  // Focus terminal
  terminal.focus();
}

function getTheme(): { [key: string]: string } {
  const style = getComputedStyle(document.body);
  const isDark = style.getPropertyValue('--vscode-editor-background').includes('1e1e1e');

  if (isDark) {
    return {
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
    };
  } else {
    return {
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
    };
  }
}

// Handle messages from the extension
window.addEventListener('message', (event) => {
  const message = event.data as WebviewMessage;

  switch (message.command) {
    case 'init':
      if (message.config) {
        initializeTerminal(message.config);
      }
      break;

    case 'output':
      if (message.data) {
        terminal?.write(message.data);
      }
      break;

    case 'clear':
      terminal?.clear();
      break;

    case 'exit':
      terminal?.write(`\r\n[Process exited with code ${message.exitCode ?? 'unknown'}]\r\n`);
      break;
  }
});

// Notify extension that webview is ready
vscode.postMessage({ command: 'ready' });
