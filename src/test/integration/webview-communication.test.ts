/**
 * WebView Communication Integration Tests
 * Tests the message passing between extension and webview
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../shared/TestSetup';

describe('WebView Communication Integration', () => {
  let sandbox: sinon.SinonSandbox;
  let dom: JSDOM;
  let document: Document;
  let window: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    const testEnv = setupCompleteTestEnvironment(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Terminal WebView</title>
        </head>
        <body>
          <div id="terminal-container"></div>
          <div id="header-container"></div>
          <div id="split-container"></div>
          <div id="settings-panel"></div>
          <div id="notification-container"></div>
        </body>
      </html>
    `);

    dom = testEnv.dom;
    document = testEnv.document;
    window = testEnv.window;

    // Mock VS Code webview API
    (global as any).acquireVsCodeApi = () => ({
      postMessage: sandbox.stub(),
      setState: sandbox.stub(),
      getState: sandbox.stub(),
    });

    // Mock xterm.js
    (global as any).Terminal = class MockTerminal {
      constructor() {
        this.element = document.createElement('div');
        this.onData = sandbox.stub();
        this.onResize = sandbox.stub();
        this.onTitleChange = sandbox.stub();
      }
      
      open = sandbox.stub();
      write = sandbox.stub();
      writeln = sandbox.stub();
      clear = sandbox.stub();
      focus = sandbox.stub();
      blur = sandbox.stub();
      resize = sandbox.stub();
      dispose = sandbox.stub();
      fit = sandbox.stub();
      select = sandbox.stub();
      selectAll = sandbox.stub();
      getSelection = sandbox.stub().returns('');
      clearSelection = sandbox.stub();
    };

    (global as any).FitAddon = class MockFitAddon {
      fit = sandbox.stub();
      activate = sandbox.stub();
      dispose = sandbox.stub();
    };
  });

  afterEach(() => {
    cleanupTestEnvironment(sandbox, dom);
  });

  describe('Message Protocol', () => {
    let vscode: any;
    let messageHandler: any;

    beforeEach(() => {
      vscode = (global as any).acquireVsCodeApi();
      
      // Mock window.addEventListener for message handling
      window.addEventListener = sandbox.stub().callsFake((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
    });

    it('should handle init message', async () => {
      // Load the webview main module
      const { TerminalWebviewManager } = await import('../../webview/main');
      
      // Initialize the webview manager
      const manager = new TerminalWebviewManager();
      
      // Simulate init message from extension
      const initMessage = {
        data: {
          command: 'init',
          data: {
            settings: {
              fontSize: 14,
              fontFamily: 'monospace',
              theme: 'auto',
              maxTerminals: 5,
              altClickMovesCursor: true,
            },
          },
        },
      };

      if (messageHandler) {
        await messageHandler(initMessage);
      }

      // Should respond with initComplete
      expect(vscode.postMessage).to.have.been.calledWith(
        sinon.match({ command: 'initComplete' })
      );
    });

    it('should handle terminalCreated message', async () => {
      const { TerminalWebviewManager } = await import('../../webview/main');
      const manager = new TerminalWebviewManager();

      const terminalCreatedMessage = {
        data: {
          command: 'terminalCreated',
          data: {
            terminalId: 'test-terminal-1',
            pid: 1234,
          },
        },
      };

      if (messageHandler) {
        await messageHandler(terminalCreatedMessage);
      }

      // Should create terminal in the UI
      const terminalContainer = document.getElementById('terminal-container');
      expect(terminalContainer).to.not.be.null;
    });

    it('should handle output message', async () => {
      const { TerminalWebviewManager } = await import('../../webview/main');
      const manager = new TerminalWebviewManager();

      // First create a terminal
      const terminalCreatedMessage = {
        data: {
          command: 'terminalCreated',
          data: {
            terminalId: 'test-terminal-1',
            pid: 1234,
          },
        },
      };

      if (messageHandler) {
        await messageHandler(terminalCreatedMessage);
      }

      // Then send output
      const outputMessage = {
        data: {
          command: 'output',
          data: {
            terminalId: 'test-terminal-1',
            data: 'Hello World\n',
          },
        },
      };

      if (messageHandler) {
        await messageHandler(outputMessage);
      }

      // Should display output in terminal
      expect(vscode.postMessage).to.have.been.called;
    });

    it('should handle settings update message', async () => {
      const { TerminalWebviewManager } = await import('../../webview/main');
      const manager = new TerminalWebviewManager();

      const settingsMessage = {
        data: {
          command: 'settingsResponse',
          data: {
            fontSize: 16,
            fontFamily: 'Consolas',
            theme: 'dark',
            altClickMovesCursor: false,
          },
        },
      };

      if (messageHandler) {
        await messageHandler(settingsMessage);
      }

      // Should update terminal settings
      expect(vscode.postMessage).to.have.been.called;
    });
  });

  describe('User Input Handling', () => {
    let vscode: any;
    let messageHandler: any;

    beforeEach(() => {
      vscode = (global as any).acquireVsCodeApi();
      window.addEventListener = sandbox.stub().callsFake((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
    });

    it('should send input to extension', async () => {
      const { TerminalWebviewManager } = await import('../../webview/main');
      const manager = new TerminalWebviewManager();

      // Initialize terminal
      const terminalCreatedMessage = {
        data: {
          command: 'terminalCreated',
          data: {
            terminalId: 'test-terminal-1',
            pid: 1234,
          },
        },
      };

      if (messageHandler) {
        await messageHandler(terminalCreatedMessage);
      }

      // Simulate user input
      const inputData = 'ls -la\n';
      
      // Should send input message to extension
      expect(vscode.postMessage).to.have.been.calledWith(
        sinon.match({
          command: 'input',
          data: { text: inputData },
        })
      );
    });

    it('should handle terminal resize', async () => {
      const { TerminalWebviewManager } = await import('../../webview/main');
      const manager = new TerminalWebviewManager();

      // Initialize terminal
      const terminalCreatedMessage = {
        data: {
          command: 'terminalCreated',
          data: {
            terminalId: 'test-terminal-1',
            pid: 1234,
          },
        },
      };

      if (messageHandler) {
        await messageHandler(terminalCreatedMessage);
      }

      // Simulate resize
      const resizeEvent = new Event('resize');
      window.dispatchEvent(resizeEvent);

      // Should send resize message to extension
      expect(vscode.postMessage).to.have.been.calledWith(
        sinon.match({
          command: 'resize',
          data: { cols: sinon.match.number, rows: sinon.match.number },
        })
      );
    });

    it('should handle terminal creation request', async () => {
      const { TerminalWebviewManager } = await import('../../webview/main');
      const manager = new TerminalWebviewManager();

      // Simulate new terminal button click
      const newTerminalBtn = document.createElement('button');
      newTerminalBtn.id = 'new-terminal-btn';
      document.body.appendChild(newTerminalBtn);

      newTerminalBtn.click();

      // Should send createTerminal message
      expect(vscode.postMessage).to.have.been.calledWith(
        sinon.match({
          command: 'createTerminal',
        })
      );
    });
  });

  describe('Split Terminal Communication', () => {
    let vscode: any;
    let messageHandler: any;

    beforeEach(() => {
      vscode = (global as any).acquireVsCodeApi();
      window.addEventListener = sandbox.stub().callsFake((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
    });

    it('should handle split terminal request', async () => {
      const { TerminalWebviewManager } = await import('../../webview/main');
      const manager = new TerminalWebviewManager();

      // Create first terminal
      const terminalCreatedMessage = {
        data: {
          command: 'terminalCreated',
          data: {
            terminalId: 'test-terminal-1',
            pid: 1234,
          },
        },
      };

      if (messageHandler) {
        await messageHandler(terminalCreatedMessage);
      }

      // Simulate split request
      const splitBtn = document.createElement('button');
      splitBtn.id = 'split-terminal-btn';
      document.body.appendChild(splitBtn);

      splitBtn.click();

      // Should send split message
      expect(vscode.postMessage).to.have.been.calledWith(
        sinon.match({
          command: 'split',
        })
      );
    });

    it('should handle multiple terminal outputs', async () => {
      const { TerminalWebviewManager } = await import('../../webview/main');
      const manager = new TerminalWebviewManager();

      // Create two terminals
      const terminal1Message = {
        data: {
          command: 'terminalCreated',
          data: {
            terminalId: 'terminal-1',
            pid: 1234,
          },
        },
      };

      const terminal2Message = {
        data: {
          command: 'terminalCreated',
          data: {
            terminalId: 'terminal-2',
            pid: 5678,
          },
        },
      };

      if (messageHandler) {
        await messageHandler(terminal1Message);
        await messageHandler(terminal2Message);
      }

      // Send output to both terminals
      const output1Message = {
        data: {
          command: 'output',
          data: {
            terminalId: 'terminal-1',
            data: 'Terminal 1 output\n',
          },
        },
      };

      const output2Message = {
        data: {
          command: 'output',
          data: {
            terminalId: 'terminal-2',
            data: 'Terminal 2 output\n',
          },
        },
      };

      if (messageHandler) {
        await messageHandler(output1Message);
        await messageHandler(output2Message);
      }

      // Both outputs should be handled
      expect(vscode.postMessage).to.have.been.called;
    });
  });

  describe('Settings Panel Communication', () => {
    let vscode: any;
    let messageHandler: any;

    beforeEach(() => {
      vscode = (global as any).acquireVsCodeApi();
      window.addEventListener = sandbox.stub().callsFake((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
    });

    it('should handle settings panel toggle', async () => {
      const { TerminalWebviewManager } = await import('../../webview/main');
      const manager = new TerminalWebviewManager();

      // Simulate settings button click
      const settingsBtn = document.createElement('button');
      settingsBtn.id = 'settings-btn';
      document.body.appendChild(settingsBtn);

      settingsBtn.click();

      // Should request settings from extension
      expect(vscode.postMessage).to.have.been.calledWith(
        sinon.match({
          command: 'getSettings',
        })
      );
    });

    it('should handle settings update', async () => {
      const { TerminalWebviewManager } = await import('../../webview/main');
      const manager = new TerminalWebviewManager();

      // Simulate settings update
      const newSettings = {
        fontSize: 16,
        fontFamily: 'Consolas',
        theme: 'dark',
        maxTerminals: 10,
      };

      // Should send updateSettings message
      expect(vscode.postMessage).to.have.been.calledWith(
        sinon.match({
          command: 'updateSettings',
          data: newSettings,
        })
      );
    });
  });

  describe('Error Handling Communication', () => {
    let vscode: any;
    let messageHandler: any;

    beforeEach(() => {
      vscode = (global as any).acquireVsCodeApi();
      window.addEventListener = sandbox.stub().callsFake((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
    });

    it('should handle error messages from extension', async () => {
      const { TerminalWebviewManager } = await import('../../webview/main');
      const manager = new TerminalWebviewManager();

      const errorMessage = {
        data: {
          command: 'error',
          data: {
            message: 'Terminal creation failed',
            type: 'terminal-error',
          },
        },
      };

      if (messageHandler) {
        await messageHandler(errorMessage);
      }

      // Should display error in UI
      const notificationContainer = document.getElementById('notification-container');
      expect(notificationContainer).to.not.be.null;
    });

    it('should handle terminal exit messages', async () => {
      const { TerminalWebviewManager } = await import('../../webview/main');
      const manager = new TerminalWebviewManager();

      // Create terminal first
      const terminalCreatedMessage = {
        data: {
          command: 'terminalCreated',
          data: {
            terminalId: 'test-terminal-1',
            pid: 1234,
          },
        },
      };

      if (messageHandler) {
        await messageHandler(terminalCreatedMessage);
      }

      // Send exit message
      const exitMessage = {
        data: {
          command: 'terminalExit',
          data: {
            terminalId: 'test-terminal-1',
            code: 0,
          },
        },
      };

      if (messageHandler) {
        await messageHandler(exitMessage);
      }

      // Should handle terminal cleanup
      expect(vscode.postMessage).to.have.been.called;
    });
  });
});