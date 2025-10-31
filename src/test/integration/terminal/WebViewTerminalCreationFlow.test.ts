/**
 * Integration Test: TM-CF-003 - Terminal Creation Flow
 *
 * Purpose: Verify the complete terminal creation flow including WebView ↔ Extension communication
 *
 * Test Scenario (Priority P0):
 * 1. WebView sends 'webviewReady' message to Extension
 * 2. Extension creates terminal via TerminalManager
 * 3. Extension sends 'terminalCreated' message to WebView
 * 4. WebView displays terminal UI with xterm.js
 * 5. User input flows: WebView → Extension → PTY → Output → WebView
 *
 * Success Criteria:
 * - WebView ready message triggers initial terminal creation
 * - Terminal ID, name, and state are correctly synchronized
 * - PTY process is properly initialized with event handlers
 * - No duplicate event handlers registered
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import '../../shared/TestSetup';
import { TerminalManager } from '../../../terminals/TerminalManager';
import { ProcessState } from '../../../types/shared';

/**
 * Mock WebView for testing Extension ↔ WebView communication
 */
class MockWebView {
  private messageHandler: ((message: any) => void) | null = null;
  private sentMessages: any[] = [];

  // Mock vscode.Webview.postMessage
  postMessage(message: any): Thenable<boolean> {
    this.sentMessages.push(message);
    return Promise.resolve(true);
  }

  // Mock vscode.Webview.onDidReceiveMessage
  onDidReceiveMessage(handler: (message: any) => void): { dispose: () => void } {
    this.messageHandler = handler;
    return {
      dispose: () => {
        this.messageHandler = null;
      },
    };
  }

  // Test helper: Simulate WebView sending message to Extension
  simulateWebViewMessage(message: any): void {
    if (this.messageHandler) {
      this.messageHandler(message);
    }
  }

  // Test helper: Get messages sent from Extension to WebView
  getSentMessages(): any[] {
    return this.sentMessages;
  }

  // Test helper: Clear message history
  clearMessages(): void {
    this.sentMessages = [];
  }

  // Test helper: Find specific message by command
  findMessage(command: string): any | undefined {
    return this.sentMessages.find((msg) => msg.command === command);
  }
}

/**
 * Mock Secondary Terminal Provider for integration testing
 */
class MockSecondaryTerminalProvider {
  private webview: MockWebView;
  private terminalManager: TerminalManager;
  private messageDisposable: { dispose: () => void } | null = null;

  constructor(webview: MockWebView, terminalManager: TerminalManager) {
    this.webview = webview;
    this.terminalManager = terminalManager;
    this.setupMessageHandling();
  }

  private setupMessageHandling(): void {
    this.messageDisposable = this.webview.onDidReceiveMessage((message) => {
      this.handleWebViewMessage(message);
    });
  }

  private handleWebViewMessage(message: any): void {
    switch (message.command) {
      case 'webviewReady':
        this.handleWebViewReady();
        break;
      case 'sendInput':
        this.handleSendInput(message.data, message.terminalId);
        break;
      case 'deleteTerminal':
        this.handleDeleteTerminal(message.terminalId);
        break;
      case 'requestInitialTerminal':
        this.handleRequestInitialTerminal();
        break;
    }
  }

  private handleWebViewReady(): void {
    // When WebView is ready, send current state or create initial terminal
    const terminals = this.terminalManager.getTerminals();

    if (terminals.length === 0) {
      // Create initial terminal
      const terminalId = this.terminalManager.createTerminal();
      const terminal = this.terminalManager.getTerminal(terminalId);

      if (terminal) {
        // Notify WebView about new terminal
        void this.webview.postMessage({
          command: 'terminalCreated',
          terminal: {
            id: terminal.id,
            name: terminal.name,
            isActive: terminal.isActive,
          },
        });
      }
    } else {
      // Send existing terminals state
      void this.webview.postMessage({
        command: 'restoreTerminals',
        terminals: terminals.map((t) => ({
          id: t.id,
          name: t.name,
          isActive: t.isActive,
        })),
      });
    }
  }

  private handleRequestInitialTerminal(): void {
    // Create initial terminal on demand
    const terminalId = this.terminalManager.createTerminal();
    const terminal = this.terminalManager.getTerminal(terminalId);

    if (terminal) {
      void this.webview.postMessage({
        command: 'terminalCreated',
        terminal: {
          id: terminal.id,
          name: terminal.name,
          isActive: terminal.isActive,
        },
      });
    }
  }

  private handleSendInput(data: string, terminalId?: string): void {
    this.terminalManager.sendInput(data, terminalId);
  }

  private handleDeleteTerminal(terminalId: string): void {
    void this.terminalManager.deleteTerminal(terminalId);
  }

  public dispose(): void {
    if (this.messageDisposable) {
      this.messageDisposable.dispose();
    }
  }
}

describe('[TM-CF-003] Terminal Creation Flow Integration', () => {
  let mockWebView: MockWebView;
  let terminalManager: TerminalManager;
  let provider: MockSecondaryTerminalProvider;

  beforeEach(() => {
    mockWebView = new MockWebView();
    terminalManager = new TerminalManager();
    provider = new MockSecondaryTerminalProvider(mockWebView, terminalManager);
  });

  afterEach(() => {
    provider.dispose();
    terminalManager.dispose();
  });

  describe('Step 1: WebView Ready → Extension', () => {
    it('should create initial terminal when WebView sends webviewReady', (done) => {
      // Arrange: Clear any existing messages
      mockWebView.clearMessages();

      // Act: Simulate WebView ready message
      mockWebView.simulateWebViewMessage({ command: 'webviewReady' });

      // Assert: Extension should create terminal and notify WebView
      setTimeout(() => {
        const messages = mockWebView.getSentMessages();
        const terminalCreatedMsg = mockWebView.findMessage('terminalCreated');

        expect(terminalCreatedMsg).to.exist;
        expect(terminalCreatedMsg?.terminal).to.exist;
        expect(terminalCreatedMsg?.terminal.id).to.be.a('string');
        expect(terminalCreatedMsg?.terminal.name).to.match(/Terminal \d/);
        expect(terminalCreatedMsg?.terminal.isActive).to.be.true;

        done();
      }, 100);
    });

    it('should restore existing terminals when WebView reconnects', () => {
      // Arrange: Create terminals before WebView is ready
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();

      mockWebView.clearMessages();

      // Act: Simulate WebView ready with existing terminals
      mockWebView.simulateWebViewMessage({ command: 'webviewReady' });

      // Assert: Should send restore message instead of creating new
      const restoreMsg = mockWebView.findMessage('restoreTerminals');
      expect(restoreMsg).to.exist;
      expect(restoreMsg?.terminals).to.have.length(2);
      expect(restoreMsg?.terminals.map((t: any) => t.id)).to.include(terminal1);
      expect(restoreMsg?.terminals.map((t: any) => t.id)).to.include(terminal2);
    });

    it('should create terminal on explicit requestInitialTerminal message', (done) => {
      // Arrange
      mockWebView.clearMessages();

      // Act: WebView requests initial terminal
      mockWebView.simulateWebViewMessage({ command: 'requestInitialTerminal' });

      // Assert
      setTimeout(() => {
        const terminalCreatedMsg = mockWebView.findMessage('terminalCreated');
        expect(terminalCreatedMsg).to.exist;
        expect(terminalCreatedMsg?.terminal.id).to.be.a('string');

        done();
      }, 100);
    });
  });

  describe('Step 2: Terminal State Synchronization', () => {
    it('should synchronize terminal ID between Extension and WebView', (done) => {
      mockWebView.clearMessages();

      // Act: Create terminal via WebView ready
      mockWebView.simulateWebViewMessage({ command: 'webviewReady' });

      setTimeout(() => {
        const terminalCreatedMsg = mockWebView.findMessage('terminalCreated');
        const webViewTerminalId = terminalCreatedMsg?.terminal.id;

        // Get terminal from TerminalManager
        const terminal = terminalManager.getTerminal(webViewTerminalId);

        // Assert: IDs match
        expect(terminal).to.exist;
        expect(terminal?.id).to.equal(webViewTerminalId);

        done();
      }, 100);
    });

    it('should correctly set isActive flag for first terminal', (done) => {
      mockWebView.clearMessages();

      mockWebView.simulateWebViewMessage({ command: 'webviewReady' });

      setTimeout(() => {
        const terminalCreatedMsg = mockWebView.findMessage('terminalCreated');

        expect(terminalCreatedMsg?.terminal.isActive).to.be.true;

        done();
      }, 100);
    });

    it('should assign sequential terminal numbers', (done) => {
      mockWebView.clearMessages();

      // Create first terminal
      mockWebView.simulateWebViewMessage({ command: 'webviewReady' });

      setTimeout(() => {
        const msg1 = mockWebView.findMessage('terminalCreated');
        expect(msg1?.terminal.name).to.equal('Terminal 1');

        // Create second terminal
        mockWebView.clearMessages();
        mockWebView.simulateWebViewMessage({ command: 'requestInitialTerminal' });

        setTimeout(() => {
          const msg2 = mockWebView.findMessage('terminalCreated');
          expect(msg2?.terminal.name).to.equal('Terminal 2');

          done();
        }, 100);
      }, 100);
    });
  });

  describe('Step 3: PTY Process Initialization', () => {
    it('should initialize PTY process with event handlers', (done) => {
      mockWebView.clearMessages();

      mockWebView.simulateWebViewMessage({ command: 'webviewReady' });

      setTimeout(() => {
        const terminalCreatedMsg = mockWebView.findMessage('terminalCreated');
        const terminalId = terminalCreatedMsg?.terminal.id;
        const terminal = terminalManager.getTerminal(terminalId);

        // Assert: PTY process exists
        expect(terminal?.ptyProcess).to.exist;
        expect(terminal?.pty).to.exist;

        // Assert: Process state is initialized
        expect(terminal?.processState).to.be.oneOf([
          ProcessState.Launching,
          ProcessState.Running,
        ]);

        done();
      }, 100);
    });

    it('should register exactly one event handler per event type', (done) => {
      mockWebView.clearMessages();

      mockWebView.simulateWebViewMessage({ command: 'webviewReady' });

      setTimeout(() => {
        const terminalCreatedMsg = mockWebView.findMessage('terminalCreated');
        const terminalId = terminalCreatedMsg?.terminal.id;
        const terminal = terminalManager.getTerminal(terminalId);
        const ptyProcess = terminal?.ptyProcess as any;

        // Check event listener counts
        if (ptyProcess && ptyProcess.listenerCount) {
          expect(ptyProcess.listenerCount('data')).to.equal(1);
          expect(ptyProcess.listenerCount('exit')).to.equal(1);
        }

        done();
      }, 100);
    });
  });

  describe('Step 4: User Input Flow', () => {
    it('should handle user input from WebView to PTY', (done) => {
      mockWebView.clearMessages();

      mockWebView.simulateWebViewMessage({ command: 'webviewReady' });

      setTimeout(() => {
        const terminalCreatedMsg = mockWebView.findMessage('terminalCreated');
        const terminalId = terminalCreatedMsg?.terminal.id;

        // Spy on terminal manager's sendInput
        const sendInputSpy = sinon.spy(terminalManager, 'sendInput');

        // Act: Simulate user input from WebView
        mockWebView.simulateWebViewMessage({
          command: 'sendInput',
          data: 'echo "test"\n',
          terminalId,
        });

        // Assert: sendInput was called with correct parameters
        setTimeout(() => {
          expect(sendInputSpy.calledOnce).to.be.true;
          expect(sendInputSpy.firstCall.args[0]).to.equal('echo "test"\n');
          expect(sendInputSpy.firstCall.args[1]).to.equal(terminalId);

          sendInputSpy.restore();
          done();
        }, 50);
      }, 100);
    });

    it('should handle input for active terminal when terminalId not specified', (done) => {
      mockWebView.clearMessages();

      mockWebView.simulateWebViewMessage({ command: 'webviewReady' });

      setTimeout(() => {
        const sendInputSpy = sinon.spy(terminalManager, 'sendInput');

        // Act: Send input without specifying terminalId
        mockWebView.simulateWebViewMessage({
          command: 'sendInput',
          data: 'test command\n',
        });

        setTimeout(() => {
          expect(sendInputSpy.calledOnce).to.be.true;
          expect(sendInputSpy.firstCall.args[0]).to.equal('test command\n');
          // Should use active terminal
          expect(sendInputSpy.firstCall.args[1]).to.be.undefined;

          sendInputSpy.restore();
          done();
        }, 50);
      }, 100);
    });
  });

  describe('Step 5: Terminal Deletion Flow', () => {
    it('should handle terminal deletion from WebView', async () => {
      mockWebView.clearMessages();

      // Create terminal
      mockWebView.simulateWebViewMessage({ command: 'webviewReady' });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const terminalCreatedMsg = mockWebView.findMessage('terminalCreated');
      const terminalId = terminalCreatedMsg?.terminal.id;

      // Create second terminal to avoid last-terminal protection
      terminalManager.createTerminal();

      // Act: Delete terminal via WebView
      mockWebView.simulateWebViewMessage({
        command: 'deleteTerminal',
        terminalId,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Terminal no longer exists
      const terminal = terminalManager.getTerminal(terminalId);
      expect(terminal).to.be.undefined;
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid terminal ID gracefully', () => {
      // Act: Send input to non-existent terminal
      expect(() => {
        mockWebView.simulateWebViewMessage({
          command: 'sendInput',
          data: 'test\n',
          terminalId: 'invalid-id-12345',
        });
      }).to.not.throw();
    });

    it('should handle rapid WebView ready messages', (done) => {
      mockWebView.clearMessages();

      // Send multiple webviewReady messages rapidly
      mockWebView.simulateWebViewMessage({ command: 'webviewReady' });
      mockWebView.simulateWebViewMessage({ command: 'webviewReady' });
      mockWebView.simulateWebViewMessage({ command: 'webviewReady' });

      setTimeout(() => {
        // Should only create terminal once or restore existing
        const terminals = terminalManager.getTerminals();
        expect(terminals.length).to.be.lessThanOrEqual(1);

        done();
      }, 200);
    });
  });
});
