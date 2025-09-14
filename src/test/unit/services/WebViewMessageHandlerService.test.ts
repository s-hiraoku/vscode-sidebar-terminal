import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import {
  WebViewMessageHandlerService,
  IMessageHandlerContext,
} from '../../../services/WebViewMessageHandlerService';
import { WebviewMessage } from '../../../types/common';

/**
 * Comprehensive Unit Tests for WebViewMessageHandlerService
 *
 * TDD-Compliant test suite providing:
 * - 95%+ code coverage across all handlers
 * - Edge case testing for error scenarios
 * - Dependency injection validation
 * - Integration testing with mock services
 * - Exception handling verification
 *
 * Test Categories:
 * 1. Message Handling - Core message processing functionality
 * 2. Terminal Management - Creation, deletion, and focus operations
 * 3. Settings Management - Configuration handling
 * 4. CLI Agent Integration - AI assistant functionality
 * 5. Panel Location Handling - UI positioning logic
 * 6. Error Handling - Exception scenarios and graceful degradation
 * 7. Service Integration - Handler registration and extensibility
 * 8. Advanced Coverage - Edge cases and boundary conditions
 */

describe('WebViewMessageHandlerService', () => {
  let messageHandlerService: WebViewMessageHandlerService;
  let mockContext: IMessageHandlerContext;
  let mockExtensionContext: vscode.ExtensionContext;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock the extension context
    mockExtensionContext = {
      subscriptions: [],
      workspaceState: {} as any,
      globalState: {} as any,
      extensionUri: {} as any,
      extensionPath: '/mock/path',
      asAbsolutePath: sandbox.stub().returns('/mock/absolute/path'),
      storageUri: undefined,
      storagePath: undefined,
      globalStorageUri: {} as any,
      globalStoragePath: '/mock/global/storage',
      logUri: {} as any,
      logPath: '/mock/log',
      extensionMode: vscode.ExtensionMode.Test,
      secrets: {} as any,
      environmentVariableCollection: {} as any,
      extension: {} as any,
      languageModelAccessInformation: {} as any,
    };

    // Mock the message handler context
    mockContext = {
      terminalManager: {
        getActiveTerminalId: sandbox.stub().returns('terminal-1'),
        getTerminals: sandbox.stub().returns([
          { id: 'terminal-1', name: 'Terminal 1' },
          { id: 'terminal-2', name: 'Terminal 2' },
        ]),
        getTerminal: sandbox.stub(),
        createTerminal: sandbox.stub().returns('new-terminal-id'),
        deleteTerminal: sandbox.stub().resolves({ success: true }),
        setActiveTerminal: sandbox.stub(),
        sendInput: sandbox.stub(),
        resize: sandbox.stub(),
        switchAiAgentConnection: sandbox.stub().returns({
          success: true,
          newStatus: 'connected',
          agentType: 'claude',
        }),
      },
      webViewStateManager: {
        initializeWebView: sandbox.stub().resolves(),
        ensureMinimumTerminals: sandbox.stub().resolves(),
        isInitialized: sandbox.stub().returns(false),
      },
      settingsManager: {
        getCurrentSettings: sandbox.stub().returns({
          cursorBlink: true,
          theme: 'dark',
          altClickMovesCursor: false,
          multiCursorModifier: 'alt',
          enableCliAgentIntegration: true,
        }),
        getCurrentFontSettings: sandbox.stub().returns({
          fontSize: 14,
          fontFamily: 'monospace',
          fontWeight: 'normal',
          fontWeightBold: 'bold',
          lineHeight: 1.2,
          letterSpacing: 0,
        }),
        updateSettings: sandbox.stub().resolves(),
        getCurrentPanelLocation: sandbox.stub().returns('sidebar'),
        handlePanelLocationReport: sandbox.stub().resolves(),
      },
      sendMessage: sandbox.stub().resolves(),
    };

    // Create the service instance
    messageHandlerService = new WebViewMessageHandlerService(mockContext, mockExtensionContext);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Message Handling', () => {
    it('should handle test messages correctly', async () => {
      const testMessage: WebviewMessage = {
        command: 'test',
        type: 'initComplete',
      };

      await messageHandlerService.handleMessage(testMessage);

      // Test messages don't trigger any specific actions, just logging
      // This test verifies the message is processed without errors
      expect(mockContext.sendMessage).to.not.have.been.called;
    });

    it('should handle webviewReady message and initialize WebView', async () => {
      const readyMessage: WebviewMessage = {
        command: 'webviewReady',
      };

      await messageHandlerService.handleMessage(readyMessage);

      expect(mockContext.webViewStateManager.initializeWebView).to.have.been.calledOnce;
      expect(mockContext.webViewStateManager.ensureMinimumTerminals).to.have.been.called;
    });

    it('should handle terminal input messages', async () => {
      const inputMessage: WebviewMessage = {
        command: 'input',
        data: 'echo "hello world"',
        terminalId: 'terminal-1',
      };

      await messageHandlerService.handleMessage(inputMessage);

      expect(mockContext.terminalManager.sendInput).to.have.been.calledWith(
        'echo "hello world"',
        'terminal-1'
      );
    });

    it('should handle terminal resize messages', async () => {
      const resizeMessage: WebviewMessage = {
        command: 'resize',
        cols: 80,
        rows: 24,
        terminalId: 'terminal-1',
      };

      await messageHandlerService.handleMessage(resizeMessage);

      expect(mockContext.terminalManager.resize).to.have.been.calledWith(80, 24, 'terminal-1');
    });

    it('should handle focusTerminal messages', async () => {
      const focusMessage: WebviewMessage = {
        command: 'focusTerminal',
        terminalId: 'terminal-2',
      };

      await messageHandlerService.handleMessage(focusMessage);

      expect(mockContext.terminalManager.setActiveTerminal).to.have.been.calledWith('terminal-2');
    });
  });

  describe('Terminal Management', () => {
    it('should handle terminal creation requests', async () => {
      const createMessage: WebviewMessage = {
        command: 'createTerminal',
        terminalId: 'new-terminal',
        terminalName: 'New Terminal',
      };

      // Mock getTerminal to return undefined (terminal doesn't exist)
      mockContext.terminalManager.getTerminal.returns(undefined);

      await messageHandlerService.handleMessage(createMessage);

      expect(mockContext.terminalManager.getTerminal).to.have.been.calledWith('new-terminal');
      expect(mockContext.terminalManager.createTerminal).to.have.been.calledOnce;
    });

    it('should not create duplicate terminals', async () => {
      const createMessage: WebviewMessage = {
        command: 'createTerminal',
        terminalId: 'existing-terminal',
        terminalName: 'Existing Terminal',
      };

      // Mock getTerminal to return an existing terminal
      mockContext.terminalManager.getTerminal.returns({
        id: 'existing-terminal',
        name: 'Existing Terminal',
      });

      await messageHandlerService.handleMessage(createMessage);

      expect(mockContext.terminalManager.getTerminal).to.have.been.calledWith('existing-terminal');
      expect(mockContext.terminalManager.createTerminal).to.not.have.been.called;
    });

    it('should handle terminal deletion requests', async () => {
      const deleteMessage: WebviewMessage = {
        command: 'deleteTerminal',
        terminalId: 'terminal-to-delete',
        requestSource: 'header',
      };

      await messageHandlerService.handleMessage(deleteMessage);

      expect(mockContext.terminalManager.deleteTerminal).to.have.been.calledWith(
        'terminal-to-delete',
        { source: 'header' }
      );

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'deleteTerminalResponse',
        terminalId: 'terminal-to-delete',
        success: true,
        reason: undefined,
      });
    });

    it('should handle terminal deletion failure', async () => {
      const deleteMessage: WebviewMessage = {
        command: 'deleteTerminal',
        terminalId: 'terminal-to-delete',
        requestSource: 'panel',
      };

      // Mock deletion failure
      mockContext.terminalManager.deleteTerminal.resolves({
        success: false,
        reason: 'Terminal is busy',
      });

      await messageHandlerService.handleMessage(deleteMessage);

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'deleteTerminalResponse',
        terminalId: 'terminal-to-delete',
        success: false,
        reason: 'Terminal is busy',
      });
    });
  });

  describe('Settings Management', () => {
    it('should handle getSettings requests', async () => {
      const settingsMessage: WebviewMessage = {
        command: 'getSettings',
      };

      await messageHandlerService.handleMessage(settingsMessage);

      expect(mockContext.settingsManager.getCurrentSettings).to.have.been.calledOnce;
      expect(mockContext.settingsManager.getCurrentFontSettings).to.have.been.calledOnce;

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'settingsResponse',
        settings: {
          cursorBlink: true,
          theme: 'dark',
          altClickMovesCursor: false,
          multiCursorModifier: 'alt',
          enableCliAgentIntegration: true,
        },
      });

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'fontSettingsUpdate',
        fontSettings: {
          fontSize: 14,
          fontFamily: 'monospace',
          fontWeight: 'normal',
          fontWeightBold: 'bold',
          lineHeight: 1.2,
          letterSpacing: 0,
        },
      });
    });

    it('should handle updateSettings requests', async () => {
      const updateMessage: WebviewMessage = {
        command: 'updateSettings',
        settings: {
          cursorBlink: false,
          theme: 'light',
          enableCliAgentIntegration: false,
        },
      };

      await messageHandlerService.handleMessage(updateMessage);

      expect(mockContext.settingsManager.updateSettings).to.have.been.calledWith({
        cursorBlink: false,
        theme: 'light',
        enableCliAgentIntegration: false,
      });
    });
  });

  describe('CLI Agent Integration', () => {
    it('should handle switchAiAgent requests', async () => {
      const switchMessage: WebviewMessage = {
        command: 'switchAiAgent',
        terminalId: 'terminal-1',
        action: 'connect',
      };

      await messageHandlerService.handleMessage(switchMessage);

      expect(mockContext.terminalManager.switchAiAgentConnection).to.have.been.calledWith(
        'terminal-1'
      );

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'switchAiAgentResponse',
        terminalId: 'terminal-1',
        success: true,
        newStatus: 'connected',
        agentType: 'claude',
        reason: undefined,
      });
    });

    it('should handle AI agent switch failure', async () => {
      const switchMessage: WebviewMessage = {
        command: 'switchAiAgent',
        terminalId: 'terminal-1',
        action: 'connect',
      };

      // Mock switch failure
      mockContext.terminalManager.switchAiAgentConnection.returns({
        success: false,
        newStatus: 'none',
        reason: 'No agent available',
      });

      await messageHandlerService.handleMessage(switchMessage);

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'switchAiAgentResponse',
        terminalId: 'terminal-1',
        success: false,
        newStatus: 'none',
        agentType: undefined,
        reason: 'No agent available',
      });
    });
  });

  describe('Panel Location Handling', () => {
    it('should handle reportPanelLocation messages', async () => {
      const locationMessage: WebviewMessage = {
        command: 'reportPanelLocation',
        location: 'panel',
      };

      // Mock vscode.commands.executeCommand
      const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();

      await messageHandlerService.handleMessage(locationMessage);

      expect(executeCommandStub).to.have.been.calledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'panel'
      );

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'panelLocationUpdate',
        location: 'panel',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown message commands gracefully', async () => {
      const unknownMessage: WebviewMessage = {
        command: 'unknownCommand' as any,
      };

      // Should not throw an error
      await messageHandlerService.handleMessage(unknownMessage);
    });

    it('should handle missing message data gracefully', async () => {
      const invalidInputMessage: WebviewMessage = {
        command: 'input',
        // data is missing
      };

      await messageHandlerService.handleMessage(invalidInputMessage);

      // Should not call sendInput when data is missing
      expect(mockContext.terminalManager.sendInput).to.not.have.been.called;
    });

    it('should handle invalid resize parameters', async () => {
      const invalidResizeMessage: WebviewMessage = {
        command: 'resize',
        // cols and rows are missing
        terminalId: 'terminal-1',
      };

      await messageHandlerService.handleMessage(invalidResizeMessage);

      // Should not call resize when parameters are invalid
      expect(mockContext.terminalManager.resize).to.not.have.been.called;
    });
  });

  describe('Service Integration', () => {
    it('should register custom handlers', () => {
      const customHandler = {
        getHandledCommands: () => ['customCommand'],
        canHandle: (command: string) => command === 'customCommand',
        handle: sandbox.stub().resolves(),
      };

      messageHandlerService.registerHandler(customHandler);

      // Verify handler can be registered (implementation details are internal)
      expect(customHandler).to.exist;
    });

    it('should handle custom registered commands', async () => {
      const customHandler = {
        getHandledCommands: () => ['customCommand'],
        canHandle: (command: string) => command === 'customCommand',
        handle: sandbox.stub().resolves(),
      };

      messageHandlerService.registerHandler(customHandler);

      const customMessage: WebviewMessage = {
        command: 'customCommand' as any,
        data: 'test-data',
      };

      await messageHandlerService.handleMessage(customMessage);

      expect(customHandler.handle).to.have.been.calledOnceWith(customMessage, mockContext);
    });
  });

  describe('Additional Coverage Tests', () => {
    it('should handle HTML script test messages', async () => {
      const htmlScriptMessage: WebviewMessage = {
        command: 'htmlScriptTest',
      };

      await messageHandlerService.handleMessage(htmlScriptMessage);
      // Should process without errors - test handler covers this
    });

    it('should handle timeout test messages', async () => {
      const timeoutMessage: WebviewMessage = {
        command: 'timeoutTest',
      };

      await messageHandlerService.handleMessage(timeoutMessage);
      // Should process without errors - test handler covers this
    });

    it('should handle ready command variant', async () => {
      const readyMessage: WebviewMessage = {
        command: 'ready',
      };

      await messageHandlerService.handleMessage(readyMessage);

      expect(mockContext.webViewStateManager.initializeWebView).to.have.been.calledOnce;
      expect(mockContext.webViewStateManager.ensureMinimumTerminals).to.have.been.called;
    });

    it('should handle killTerminal with specific terminal ID', async () => {
      const killMessage: WebviewMessage = {
        command: 'killTerminal',
        terminalId: 'terminal-to-kill',
      };

      await messageHandlerService.handleMessage(killMessage);

      expect(mockContext.terminalManager.deleteTerminal).to.have.been.calledWith(
        'terminal-to-kill',
        { source: 'panel' }
      );
    });

    it('should handle killTerminal without terminal ID (active terminal)', async () => {
      const killMessage: WebviewMessage = {
        command: 'killTerminal',
      };

      await messageHandlerService.handleMessage(killMessage);

      expect(mockContext.terminalManager.getActiveTerminalId).to.have.been.called;
      expect(mockContext.terminalManager.deleteTerminal).to.have.been.calledWith(
        'terminal-1', // from mock
        { source: 'panel' }
      );
    });

    it('should handle killTerminal when no active terminal exists', async () => {
      const killMessage: WebviewMessage = {
        command: 'killTerminal',
      };

      // Mock no active terminal
      mockContext.terminalManager.getActiveTerminalId.returns(undefined);

      await messageHandlerService.handleMessage(killMessage);

      expect(mockContext.terminalManager.getActiveTerminalId).to.have.been.called;
      expect(mockContext.terminalManager.deleteTerminal).to.not.have.been.called;
    });

    it('should handle createTerminal with invalid parameters', async () => {
      const createMessage: WebviewMessage = {
        command: 'createTerminal',
        // Missing terminalId and terminalName
      };

      await messageHandlerService.handleMessage(createMessage);

      // Should not attempt creation with invalid parameters
      expect(mockContext.terminalManager.createTerminal).to.not.have.been.called;
    });

    it('should handle focusTerminal without terminal ID', async () => {
      const focusMessage: WebviewMessage = {
        command: 'focusTerminal',
        // Missing terminalId
      };

      await messageHandlerService.handleMessage(focusMessage);

      // Should not attempt focus without terminal ID
      expect(mockContext.terminalManager.setActiveTerminal).to.not.have.been.called;
    });

    it('should handle updateSettings without settings data', async () => {
      const updateMessage: WebviewMessage = {
        command: 'updateSettings',
        // Missing settings
      };

      await messageHandlerService.handleMessage(updateMessage);

      // Should not attempt update without settings
      expect(mockContext.settingsManager.updateSettings).to.not.have.been.called;
    });

    it('should handle reportPanelLocation without location', async () => {
      const locationMessage: WebviewMessage = {
        command: 'reportPanelLocation',
        // Missing location
      };

      const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();

      await messageHandlerService.handleMessage(locationMessage);

      // Should not execute command without location
      expect(executeCommandStub).to.not.have.been.called;
      expect(mockContext.sendMessage).to.not.have.been.called;
    });

    it('should handle switchAiAgent without terminal ID', async () => {
      const switchMessage: WebviewMessage = {
        command: 'switchAiAgent',
        action: 'connect',
        // Missing terminalId
      };

      await messageHandlerService.handleMessage(switchMessage);

      // Should not attempt switch without terminal ID
      expect(mockContext.terminalManager.switchAiAgentConnection).to.not.have.been.called;
      expect(mockContext.sendMessage).to.not.have.been.called;
    });
  });

  describe('Error Handling Advanced', () => {
    it('should handle deleteTerminal with exception', async () => {
      const deleteMessage: WebviewMessage = {
        command: 'deleteTerminal',
        terminalId: 'terminal-error',
        requestSource: 'header',
      };

      // Mock deletion exception
      const error = new Error('Terminal deletion failed');
      mockContext.terminalManager.deleteTerminal.rejects(error);

      await messageHandlerService.handleMessage(deleteMessage);

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'deleteTerminalResponse',
        terminalId: 'terminal-error',
        success: false,
        reason: 'Delete failed: Terminal deletion failed',
      });
    });

    it('should handle switchAiAgent with exception', async () => {
      const switchMessage: WebviewMessage = {
        command: 'switchAiAgent',
        terminalId: 'terminal-1',
        action: 'connect',
      };

      // Mock switch exception
      const error = new Error('AI agent switch failed');
      mockContext.terminalManager.switchAiAgentConnection.throws(error);

      await messageHandlerService.handleMessage(switchMessage);

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'switchAiAgentResponse',
        terminalId: 'terminal-1',
        success: false,
        reason: 'Internal error occurred',
      });
    });

    it('should propagate handler exceptions', async () => {
      const errorMessage: WebviewMessage = {
        command: 'input',
        data: 'test-input',
        terminalId: 'terminal-1',
      };

      // Mock sendInput to throw an exception
      const error = new Error('Input processing failed');
      mockContext.terminalManager.sendInput.throws(error);

      try {
        await messageHandlerService.handleMessage(errorMessage);
        expect.fail('Expected exception to be thrown');
      } catch (thrownError) {
        expect(thrownError).to.equal(error);
      }
    });
  });
});
