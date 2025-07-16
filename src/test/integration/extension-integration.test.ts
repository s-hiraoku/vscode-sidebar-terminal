/**
 * Extension Integration Tests
 * Tests the actual VS Code extension integration points
 */

import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { SidebarTerminalProvider } from '../../providers/SidebarTerminalProvider';
import { TerminalManager } from '../../terminals/TerminalManager';
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../shared/TestSetup';

describe('Extension Integration Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let terminalManager: TerminalManager;
  let provider: SidebarTerminalProvider;
  let mockExtensionContext: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    setupCompleteTestEnvironment();

    // Mock extension context
    mockExtensionContext = {
      subscriptions: [],
      extensionPath: '/test/extension',
      globalState: {
        get: sandbox.stub(),
        update: sandbox.stub(),
      },
      workspaceState: {
        get: sandbox.stub(),
        update: sandbox.stub(),
      },
    };

    terminalManager = new TerminalManager();
    provider = new SidebarTerminalProvider(mockExtensionContext);
  });

  afterEach(() => {
    cleanupTestEnvironment(sandbox);
  });

  describe('SidebarTerminalProvider Integration', () => {
    it('should create webview view provider', () => {
      expect(provider).to.be.instanceOf(SidebarTerminalProvider);
      expect(provider.viewType).to.equal('sidebarTerminal');
    });

    it('should resolve webview view correctly', async () => {
      const mockWebviewView = {
        webview: {
          options: {},
          html: '',
          postMessage: sandbox.stub(),
          onDidReceiveMessage: sandbox.stub(),
        },
        title: '',
        description: '',
        onDidDispose: sandbox.stub(),
        onDidChangeVisibility: sandbox.stub(),
        visible: true,
      };

      const mockToken = {} as vscode.CancellationToken;
      
      await provider.resolveWebviewView(mockWebviewView, {}, mockToken);
      
      expect(mockWebviewView.webview.html).to.contain('<!DOCTYPE html>');
      expect(mockWebviewView.webview.html).to.contain('<div id="terminal-container">');
    });

    it('should handle webview messages', async () => {
      const mockWebviewView = {
        webview: {
          options: {},
          html: '',
          postMessage: sandbox.stub(),
          onDidReceiveMessage: sandbox.stub(),
        },
        title: '',
        description: '',
        onDidDispose: sandbox.stub(),
        onDidChangeVisibility: sandbox.stub(),
        visible: true,
      };

      await provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
      
      // Get the message handler
      const messageHandler = mockWebviewView.webview.onDidReceiveMessage.getCall(0)?.args[0];
      expect(messageHandler).to.be.a('function');
      
      // Test message handling
      const testMessage = { command: 'init', data: {} };
      await messageHandler(testMessage);
      
      expect(mockWebviewView.webview.postMessage).to.have.been.called;
    });
  });

  describe('TerminalManager Integration', () => {
    it('should create terminal manager instance', () => {
      expect(terminalManager).to.be.instanceOf(TerminalManager);
    });

    it('should handle terminal creation', () => {
      const terminalOptions = {
        shell: '/bin/bash',
        args: [],
        cwd: '/test',
        env: process.env,
      };

      const terminalId = terminalManager.createTerminal(terminalOptions);
      
      expect(terminalId).to.be.a('string');
      expect(terminalManager.getActiveTerminal()).to.equal(terminalId);
    });

    it('should handle terminal destruction', () => {
      const terminalId = terminalManager.createTerminal({
        shell: '/bin/bash',
        args: [],
        cwd: '/test',
        env: process.env,
      });

      terminalManager.killTerminal(terminalId);
      
      expect(terminalManager.getActiveTerminal()).to.be.null;
    });

    it('should handle multiple terminals', () => {
      const terminal1 = terminalManager.createTerminal({
        shell: '/bin/bash',
        args: [],
        cwd: '/test',
        env: process.env,
      });

      const terminal2 = terminalManager.createTerminal({
        shell: '/bin/bash',
        args: [],
        cwd: '/test',
        env: process.env,
      });

      expect(terminalManager.getTerminalCount()).to.equal(2);
      expect(terminalManager.getActiveTerminal()).to.equal(terminal2);
    });
  });

  describe('WebView-Extension Communication', () => {
    let mockWebviewView: any;
    let messageHandler: any;

    beforeEach(async () => {
      mockWebviewView = {
        webview: {
          options: {},
          html: '',
          postMessage: sandbox.stub(),
          onDidReceiveMessage: sandbox.stub(),
        },
        title: '',
        description: '',
        onDidDispose: sandbox.stub(),
        onDidChangeVisibility: sandbox.stub(),
        visible: true,
      };

      await provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
      messageHandler = mockWebviewView.webview.onDidReceiveMessage.getCall(0)?.args[0];
    });

    it('should handle init command', async () => {
      const initMessage = { command: 'init', data: {} };
      await messageHandler(initMessage);
      
      expect(mockWebviewView.webview.postMessage).to.have.been.calledWith(
        sinon.match({ command: 'init' })
      );
    });

    it('should handle createTerminal command', async () => {
      const createMessage = { 
        command: 'createTerminal', 
        data: { shell: '/bin/bash', args: [], cwd: '/test' } 
      };
      
      await messageHandler(createMessage);
      
      expect(mockWebviewView.webview.postMessage).to.have.been.calledWith(
        sinon.match({ command: 'terminalCreated' })
      );
    });

    it('should handle input command', async () => {
      // First create a terminal
      const createMessage = { 
        command: 'createTerminal', 
        data: { shell: '/bin/bash', args: [], cwd: '/test' } 
      };
      await messageHandler(createMessage);
      
      // Then send input
      const inputMessage = { 
        command: 'input', 
        data: { text: 'ls\n' } 
      };
      await messageHandler(inputMessage);
      
      // Should not throw errors
      expect(mockWebviewView.webview.postMessage).to.have.been.called;
    });

    it('should handle resize command', async () => {
      const resizeMessage = { 
        command: 'resize', 
        data: { cols: 80, rows: 24 } 
      };
      
      await messageHandler(resizeMessage);
      
      // Should handle resize gracefully
      expect(mockWebviewView.webview.postMessage).to.have.been.called;
    });

    it('should handle clear command', async () => {
      const clearMessage = { command: 'clear', data: {} };
      await messageHandler(clearMessage);
      
      expect(mockWebviewView.webview.postMessage).to.have.been.calledWith(
        sinon.match({ command: 'cleared' })
      );
    });

    it('should handle killTerminal command', async () => {
      // First create a terminal
      const createMessage = { 
        command: 'createTerminal', 
        data: { shell: '/bin/bash', args: [], cwd: '/test' } 
      };
      await messageHandler(createMessage);
      
      // Then kill it
      const killMessage = { command: 'killTerminal', data: {} };
      await messageHandler(killMessage);
      
      expect(mockWebviewView.webview.postMessage).to.have.been.calledWith(
        sinon.match({ command: 'terminalKilled' })
      );
    });
  });

  describe('Configuration Integration', () => {
    it('should respond to configuration changes', async () => {
      const mockWebviewView = {
        webview: {
          options: {},
          html: '',
          postMessage: sandbox.stub(),
          onDidReceiveMessage: sandbox.stub(),
        },
        title: '',
        description: '',
        onDidDispose: sandbox.stub(),
        onDidChangeVisibility: sandbox.stub(),
        visible: true,
      };

      await provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
      
      // Simulate configuration change
      const configChangeEvent = {} as vscode.ConfigurationChangeEvent;
      
      // This should trigger settings update
      expect(mockWebviewView.webview.postMessage).to.have.been.called;
    });

    it('should handle terminal configuration', () => {
      const config = vscode.workspace.getConfiguration('sidebarTerminal');
      
      expect(config.get('shell')).to.equal('/bin/bash');
      expect(config.get('fontSize')).to.equal(14);
      expect(config.get('maxTerminals')).to.equal(5);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle terminal creation errors', async () => {
      const mockWebviewView = {
        webview: {
          options: {},
          html: '',
          postMessage: sandbox.stub(),
          onDidReceiveMessage: sandbox.stub(),
        },
        title: '',
        description: '',
        onDidDispose: sandbox.stub(),
        onDidChangeVisibility: sandbox.stub(),
        visible: true,
      };

      await provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
      const messageHandler = mockWebviewView.webview.onDidReceiveMessage.getCall(0)?.args[0];
      
      // Try to create terminal with invalid shell
      const createMessage = { 
        command: 'createTerminal', 
        data: { shell: '/nonexistent/shell', args: [], cwd: '/test' } 
      };
      
      await messageHandler(createMessage);
      
      expect(mockWebviewView.webview.postMessage).to.have.been.calledWith(
        sinon.match({ command: 'error' })
      );
    });

    it('should handle webview disposal', async () => {
      const mockWebviewView = {
        webview: {
          options: {},
          html: '',
          postMessage: sandbox.stub(),
          onDidReceiveMessage: sandbox.stub(),
        },
        title: '',
        description: '',
        onDidDispose: sandbox.stub().returns({ dispose: sandbox.stub() }),
        onDidChangeVisibility: sandbox.stub(),
        visible: true,
      };

      await provider.resolveWebviewView(mockWebviewView, {}, {} as vscode.CancellationToken);
      
      // Simulate disposal
      const disposeHandler = mockWebviewView.onDidDispose.getCall(0)?.args[0];
      if (disposeHandler) {
        disposeHandler();
      }
      
      // Should clean up resources
      expect(mockWebviewView.onDidDispose).to.have.been.called;
    });
  });
});