import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

// Update status display
function updateStatus(message: string) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
  }
  console.log('🎯 [SIMPLE]', message);
}

declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
};

const vscode = acquireVsCodeApi();

// Simple terminal implementation
function createSimpleTerminal() {
  updateStatus('Creating simple terminal...');

  const container = document.getElementById('terminal');
  if (!container) {
    updateStatus('ERROR: No terminal container');
    return;
  }

  updateStatus('Terminal container found');

  try {
    // Create terminal with minimal config
    const terminal = new Terminal({
      fontSize: 14,
      fontFamily: 'Consolas, monospace',
      theme: {
        background: '#000000',
        foreground: '#ffffff',
      },
      cursorBlink: true,
      scrollback: 1000,
    });

    updateStatus('Terminal instance created');

    // Create fit addon
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    updateStatus('Fit addon loaded');

    // Open terminal in container
    terminal.open(container);
    updateStatus('Terminal opened in container');

    // Wait for DOM to settle
    setTimeout(() => {
      try {
        fitAddon.fit();
        updateStatus('Terminal fitted');

        // Write test content
        terminal.write('🎉 Terminal is working!\r\n');
        terminal.write('Type anything to test...\r\n');
        terminal.write('$ ');

        updateStatus('✅ TERMINAL READY');

        // Handle input
        terminal.onData((data) => {
          terminal.write(data);
          if (data === '\r') {
            terminal.write('\n$ ');
          }
        });
      } catch (error) {
        updateStatus(`Error fitting: ${error}`);
      }
    }, 500);
  } catch (error) {
    updateStatus(`Error creating terminal: ${error}`);
    console.error('Terminal creation error:', error);
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    updateStatus('DOM loaded');
    createSimpleTerminal();
  });
} else {
  updateStatus('DOM ready');
  createSimpleTerminal();
}

updateStatus('Script loaded');
