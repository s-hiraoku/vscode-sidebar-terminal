/**
 * MessageFactory unit tests
 * 
 * 統一されたメッセージファクトリーのテスト
 * Extension ↔ WebView 間の通信メッセージ作成機能を検証
 */
/* eslint-disable */
// @ts-nocheck
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import * as sinon from 'sinon';

use(sinonChai);

import { MessageFactory } from '../../../messaging/MessageFactory';
import { WebviewMessage, VsCodeMessage, TerminalInstance, TerminalState } from '../../../types/common';
import { TerminalConfig } from '../../../types/shared';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestEnvironment,
} from '../../utils/CommonTestSetup';

describe('MessageFactory', () => {
  let testEnv: TestEnvironment;
  let mockTerminalInstance: TerminalInstance;
  let mockTerminalConfig: TerminalConfig;
  let mockTerminalState: TerminalState;

  beforeEach(() => {
    testEnv = setupTestEnvironment();
    
    // Mock terminal instance
    mockTerminalInstance = {
      id: 'terminal-123',
      name: 'Terminal 1',
      number: 1,
      cwd: '/test/directory',
      isActive: true,
      pty: null as any,
    };

    // Mock terminal config
    mockTerminalConfig = {
      shell: '/bin/bash',
      shellArgs: ['--login'],
      cwd: '/test/directory',
      env: {},
      fontSize: 14,
      fontFamily: 'Monaco',
      theme: 'dark',
      cursorBlink: true,
      scrollback: 1000,
    };

    // Mock terminal state
    mockTerminalState = {
      terminals: [
        { id: 'terminal-1', name: 'Terminal 1', isActive: true },
        { id: 'terminal-2', name: 'Terminal 2', isActive: false },
      ],
      activeTerminalId: 'terminal-1',
      maxTerminals: 5,
      availableSlots: [3, 4, 5],
    };
  });

  afterEach(() => {
    cleanupTestEnvironment(testEnv);
  });

  describe('createTerminalMessage', () => {
    it('should create basic terminal message with command', () => {
      const message = MessageFactory.createTerminalMessage('createTerminal');

      expect(message.command).to.equal('createTerminal');
      expect(message.terminalId).to.be.undefined;
      expect(message.timestamp).to.be.a('number');
      expect(message.timestamp).to.be.closeTo(Date.now(), 100);
    });

    it('should create terminal message with terminalId', () => {
      const message = MessageFactory.createTerminalMessage('deleteTerminal', 'terminal-456');

      expect(message.command).to.equal('deleteTerminal');
      expect(message.terminalId).to.equal('terminal-456');
      expect(message.timestamp).to.be.a('number');
    });

    it('should create terminal message with additional data', () => {
      const additionalData = { data: 'test input', cols: 80, rows: 24 };
      const message = MessageFactory.createTerminalMessage('input', 'terminal-789', additionalData);

      expect(message.command).to.equal('input');
      expect(message.terminalId).to.equal('terminal-789');
      expect(message.data).to.equal('test input');
      expect(message.cols).to.equal(80);
      expect(message.rows).to.equal(24);
      expect(message.timestamp).to.be.a('number');
    });

    it('should handle empty additional data object', () => {
      const message = MessageFactory.createTerminalMessage('getSettings', undefined, {});

      expect(message.command).to.equal('getSettings');
      expect(message.terminalId).to.be.undefined;
      expect(message.timestamp).to.be.a('number');
    });
  });

  describe('WebView → Extension message creation', () => {
    describe('createTerminalCreationRequest', () => {
      it('should create terminal creation request message', () => {
        const message = MessageFactory.createTerminalCreationRequest();

        expect(message.command).to.equal('createTerminal');
        expect(message.terminalId).to.be.undefined;
        expect(message.timestamp).to.be.a('number');
      });
    });

    describe('createTerminalDeletionRequest', () => {
      it('should create terminal deletion request with default source', () => {
        const message = MessageFactory.createTerminalDeletionRequest('terminal-delete-123');

        expect(message.command).to.equal('deleteTerminal');
        expect(message.terminalId).to.equal('terminal-delete-123');
        expect(message.requestSource).to.equal('panel');
        expect(message.timestamp).to.be.a('number');
      });

      it('should create terminal deletion request with header source', () => {
        const message = MessageFactory.createTerminalDeletionRequest('terminal-delete-456', 'header');

        expect(message.command).to.equal('deleteTerminal');
        expect(message.terminalId).to.equal('terminal-delete-456');
        expect(message.requestSource).to.equal('header');
        expect(message.timestamp).to.be.a('number');
      });
    });

    describe('createTerminalInputMessage', () => {
      it('should create terminal input message', () => {
        const inputData = 'ls -la\n';
        const message = MessageFactory.createTerminalInputMessage('input-terminal-123', inputData);

        expect(message.command).to.equal('input');
        expect(message.terminalId).to.equal('input-terminal-123');
        expect(message.data).to.equal(inputData);
        expect(message.timestamp).to.be.a('number');
      });

      it('should handle special characters in input', () => {
        const inputData = 'echo "Hello 世界! 🌍"\n';
        const message = MessageFactory.createTerminalInputMessage('unicode-terminal', inputData);

        expect(message.command).to.equal('input');
        expect(message.terminalId).to.equal('unicode-terminal');
        expect(message.data).to.equal(inputData);
      });
    });

    describe('createTerminalResizeMessage', () => {
      it('should create terminal resize message', () => {
        const message = MessageFactory.createTerminalResizeMessage('resize-terminal', 120, 30);

        expect(message.command).to.equal('resize');
        expect(message.terminalId).to.equal('resize-terminal');
        expect(message.cols).to.equal(120);
        expect(message.rows).to.equal(30);
        expect(message.timestamp).to.be.a('number');
      });

      it('should handle edge case dimensions', () => {
        const message = MessageFactory.createTerminalResizeMessage('edge-terminal', 1, 1);

        expect(message.command).to.equal('resize');
        expect(message.terminalId).to.equal('edge-terminal');
        expect(message.cols).to.equal(1);
        expect(message.rows).to.equal(1);
      });
    });

    describe('createTerminalFocusMessage', () => {
      it('should create terminal focus message', () => {
        const message = MessageFactory.createTerminalFocusMessage('focus-terminal-789');

        expect(message.command).to.equal('focusTerminal');
        expect(message.terminalId).to.equal('focus-terminal-789');
        expect(message.timestamp).to.be.a('number');
      });
    });

    describe('createSettingsRequest', () => {
      it('should create settings request message', () => {
        const message = MessageFactory.createSettingsRequest();

        expect(message.command).to.equal('getSettings');
        expect(message.terminalId).to.be.undefined;
        expect(message.timestamp).to.be.a('number');
      });
    });

    describe('createScrollbackDataRequest', () => {
      it('should create scrollback data request with parameters', () => {
        const message = MessageFactory.createScrollbackDataRequest('scrollback-terminal', 500, 1000);

        expect(message.command).to.equal('getScrollbackData');
        expect(message.terminalId).to.equal('scrollback-terminal');
        expect(message.scrollbackLines).to.equal(500);
        expect(message.maxLines).to.equal(1000);
        expect(message.timestamp).to.be.a('number');
      });

      it('should create scrollback data request without optional parameters', () => {
        const message = MessageFactory.createScrollbackDataRequest('scrollback-terminal-2');

        expect(message.command).to.equal('getScrollbackData');
        expect(message.terminalId).to.equal('scrollback-terminal-2');
        expect(message.scrollbackLines).to.be.undefined;
        expect(message.maxLines).to.be.undefined;
      });
    });

    describe('createErrorReport', () => {
      it('should create error report with all parameters', () => {
        const stack = 'Error: Test error\n    at TestFunction (test.js:10:5)';
        const message = MessageFactory.createErrorReport(
          'TERMINAL_CREATION',
          'Failed to create terminal',
          stack,
          'error-terminal-123'
        );

        expect(message.command).to.equal('error');
        expect(message.terminalId).to.equal('error-terminal-123');
        expect(message.context).to.equal('TERMINAL_CREATION');
        expect(message.message).to.equal('Failed to create terminal');
        expect(message.stack).to.equal(stack);
        expect(message.timestamp).to.be.a('number');
      });

      it('should create error report with minimal parameters', () => {
        const message = MessageFactory.createErrorReport('GENERAL_ERROR', 'Something went wrong');

        expect(message.command).to.equal('error');
        expect(message.terminalId).to.be.undefined;
        expect(message.context).to.equal('GENERAL_ERROR');
        expect(message.message).to.equal('Something went wrong');
        expect(message.stack).to.be.undefined;
      });
    });
  });

  describe('Extension → WebView message creation', () => {
    describe('createTerminalCreatedMessage', () => {
      it('should create terminal created message', () => {
        const message = MessageFactory.createTerminalCreatedMessage(mockTerminalInstance, mockTerminalConfig);

        expect(message.command).to.equal('terminalCreated');
        expect(message.terminalId).to.equal('terminal-123');
        expect(message.terminalName).to.equal('Terminal 1');
        expect(message.terminalInfo).to.deep.include({
          originalId: 'terminal-123',
          name: 'Terminal 1',
          number: 1,
          cwd: '/test/directory',
          isActive: true,
        });
        expect(message.config).to.deep.equal(mockTerminalConfig);
        expect(message.timestamp).to.be.a('number');
      });

      it('should handle terminal instance without cwd', () => {
        const terminalWithoutCwd = { ...mockTerminalInstance, cwd: undefined };
        const message = MessageFactory.createTerminalCreatedMessage(terminalWithoutCwd, mockTerminalConfig);

        expect(message.terminalInfo.cwd).to.equal(process.cwd());
      });
    });

    describe('createTerminalRemovedMessage', () => {
      it('should create terminal removed message', () => {
        const message = MessageFactory.createTerminalRemovedMessage('removed-terminal-456');

        expect(message.command).to.equal('terminalRemoved');
        expect(message.terminalId).to.equal('removed-terminal-456');
        expect(message.timestamp).to.be.a('number');
      });
    });

    describe('createTerminalOutputMessage', () => {
      it('should create terminal output message', () => {
        const outputData = 'user@host:~$ ls\nfile1.txt  file2.txt\n';
        const message = MessageFactory.createTerminalOutputMessage('output-terminal-789', outputData);

        expect(message.command).to.equal('output');
        expect(message.terminalId).to.equal('output-terminal-789');
        expect(message.data).to.equal(outputData);
        expect(message.timestamp).to.be.a('number');
      });

      it('should handle large output data', () => {
        const largeOutput = 'A'.repeat(10000);
        const message = MessageFactory.createTerminalOutputMessage('large-output-terminal', largeOutput);

        expect(message.command).to.equal('output');
        expect(message.terminalId).to.equal('large-output-terminal');
        expect(message.data).to.equal(largeOutput);
        expect(message.data.length).to.equal(10000);
      });
    });

    describe('createStateUpdateMessage', () => {
      it('should create state update message with active terminal', () => {
        const message = MessageFactory.createStateUpdateMessage(mockTerminalState, 'active-terminal-123');

        expect(message.command).to.equal('stateUpdate');
        expect(message.terminalId).to.equal('active-terminal-123');
        expect(message.state).to.deep.equal(mockTerminalState);
        expect(message.activeTerminalId).to.equal('active-terminal-123');
        expect(message.timestamp).to.be.a('number');
      });

      it('should create state update message without active terminal', () => {
        const message = MessageFactory.createStateUpdateMessage(mockTerminalState);

        expect(message.command).to.equal('stateUpdate');
        expect(message.terminalId).to.be.undefined;
        expect(message.state).to.deep.equal(mockTerminalState);
        expect(message.activeTerminalId).to.be.undefined;
      });
    });

    describe('createCliAgentStatusUpdate', () => {
      it('should create CLI Agent status update for connected state', () => {
        const message = MessageFactory.createCliAgentStatusUpdate('Terminal 1', 'connected', 'claude');

        expect(message.command).to.equal('cliAgentStatusUpdate');
        expect(message.terminalId).to.be.undefined;
        expect(message.cliAgentStatus).to.deep.equal({
          activeTerminalName: 'Terminal 1',
          status: 'connected',
          agentType: 'claude',
        });
        expect(message.timestamp).to.be.a('number');
      });

      it('should create CLI Agent status update for disconnected state', () => {
        const message = MessageFactory.createCliAgentStatusUpdate(null, 'disconnected', null);

        expect(message.command).to.equal('cliAgentStatusUpdate');
        expect(message.cliAgentStatus).to.deep.equal({
          activeTerminalName: null,
          status: 'disconnected',
          agentType: null,
        });
      });

      it('should create CLI Agent status update for none state', () => {
        const message = MessageFactory.createCliAgentStatusUpdate(null, 'none', null);

        expect(message.command).to.equal('cliAgentStatusUpdate');
        expect(message.cliAgentStatus).to.deep.equal({
          activeTerminalName: null,
          status: 'none',
          agentType: null,
        });
      });
    });

    describe('createCliAgentFullStateSync', () => {
      it('should create CLI Agent full state sync message', () => {
        const terminalStates = {
          'terminal-1': { status: 'connected' as const, agentType: 'claude', terminalName: 'Terminal 1' },
          'terminal-2': { status: 'disconnected' as const, agentType: null, terminalName: 'Terminal 2' },
        };

        const message = MessageFactory.createCliAgentFullStateSync(
          terminalStates,
          'terminal-1',
          'claude',
          1
        );

        expect(message.command).to.equal('cliAgentFullStateSync');
        expect(message.terminalId).to.be.undefined;
        expect(message.terminalStates).to.deep.equal(terminalStates);
        expect(message.connectedAgentId).to.equal('terminal-1');
        expect(message.connectedAgentType).to.equal('claude');
        expect(message.disconnectedCount).to.equal(1);
        expect(message.timestamp).to.be.a('number');
      });
    });

    describe('createSettingsResponse', () => {
      it('should create settings response with both settings and font settings', () => {
        const settings = { theme: 'dark', maxTerminals: 5 };
        const fontSettings = { fontFamily: 'Monaco', fontSize: 14 };

        const message = MessageFactory.createSettingsResponse(settings, fontSettings);

        expect(message.command).to.equal('settingsResponse');
        expect(message.terminalId).to.be.undefined;
        expect(message.settings).to.deep.equal(settings);
        expect(message.fontSettings).to.deep.equal(fontSettings);
        expect(message.timestamp).to.be.a('number');
      });

      it('should create settings response with only settings', () => {
        const settings = { theme: 'light', showHeader: true };

        const message = MessageFactory.createSettingsResponse(settings);

        expect(message.command).to.equal('settingsResponse');
        expect(message.settings).to.deep.equal(settings);
        expect(message.fontSettings).to.be.undefined;
      });
    });

    describe('createScrollbackRestoreMessage', () => {
      it('should create scrollback restore message with structured content', () => {
        const scrollbackContent = [
          { content: 'user@host:~$ ls', type: 'input' as const, timestamp: 1634567890000 },
          { content: 'file1.txt  file2.txt', type: 'output' as const, timestamp: 1634567891000 },
          { content: 'command not found: xyz', type: 'error' as const, timestamp: 1634567892000 },
        ];

        const message = MessageFactory.createScrollbackRestoreMessage('scrollback-terminal', scrollbackContent);

        expect(message.command).to.equal('restoreScrollback');
        expect(message.terminalId).to.equal('scrollback-terminal');
        expect(message.scrollbackContent).to.deep.equal(scrollbackContent);
        expect(message.timestamp).to.be.a('number');
      });

      it('should create scrollback restore message with string array content', () => {
        const scrollbackContent = ['line 1', 'line 2', 'line 3'];

        const message = MessageFactory.createScrollbackRestoreMessage('simple-scrollback-terminal', scrollbackContent);

        expect(message.command).to.equal('restoreScrollback');
        expect(message.terminalId).to.equal('simple-scrollback-terminal');
        expect(message.scrollbackContent).to.deep.equal(scrollbackContent);
      });
    });

    describe('createSessionRestoreCompleted', () => {
      it('should create session restore completed message with success', () => {
        const message = MessageFactory.createSessionRestoreCompleted(3, 0, false);

        expect(message.command).to.equal('sessionRestoreCompleted');
        expect(message.terminalId).to.be.undefined;
        expect(message.restoredCount).to.equal(3);
        expect(message.skippedCount).to.equal(0);
        expect(message.partialSuccess).to.be.false;
        expect(message.timestamp).to.be.a('number');
      });

      it('should create session restore completed message with partial success', () => {
        const message = MessageFactory.createSessionRestoreCompleted(2, 1, true);

        expect(message.command).to.equal('sessionRestoreCompleted');
        expect(message.restoredCount).to.equal(2);
        expect(message.skippedCount).to.equal(1);
        expect(message.partialSuccess).to.be.true;
      });

      it('should use default values for optional parameters', () => {
        const message = MessageFactory.createSessionRestoreCompleted(5);

        expect(message.restoredCount).to.equal(5);
        expect(message.skippedCount).to.equal(0);
        expect(message.partialSuccess).to.be.false;
      });
    });

    describe('createSessionRestoreError', () => {
      it('should create session restore error message with all parameters', () => {
        const message = MessageFactory.createSessionRestoreError(
          'Database connection failed',
          'connection_error',
          'Check network connectivity'
        );

        expect(message.command).to.equal('sessionRestoreError');
        expect(message.terminalId).to.be.undefined;
        expect(message.error).to.equal('Database connection failed');
        expect(message.errorType).to.equal('connection_error');
        expect(message.recoveryAction).to.equal('Check network connectivity');
        expect(message.timestamp).to.be.a('number');
      });

      it('should create session restore error message with minimal parameters', () => {
        const message = MessageFactory.createSessionRestoreError('Generic error');

        expect(message.command).to.equal('sessionRestoreError');
        expect(message.error).to.equal('Generic error');
        expect(message.errorType).to.equal('unknown');
        expect(message.recoveryAction).to.be.undefined;
      });
    });

    describe('createErrorMessage', () => {
      it('should create error message with all parameters', () => {
        const message = MessageFactory.createErrorMessage(
          'Terminal creation failed',
          'TERMINAL_MANAGER',
          'error-terminal-id'
        );

        expect(message.command).to.equal('error');
        expect(message.terminalId).to.equal('error-terminal-id');
        expect(message.message).to.equal('Terminal creation failed');
        expect(message.context).to.equal('TERMINAL_MANAGER');
        expect(message.timestamp).to.be.a('number');
      });

      it('should create error message with minimal parameters', () => {
        const message = MessageFactory.createErrorMessage('Generic error occurred');

        expect(message.command).to.equal('error');
        expect(message.message).to.equal('Generic error occurred');
        expect(message.context).to.be.undefined;
        expect(message.terminalId).to.be.undefined;
      });
    });
  });

  describe('utility methods', () => {
    describe('addRequestId', () => {
      it('should add request ID to message', () => {
        const originalMessage = MessageFactory.createTerminalCreationRequest();
        const messageWithRequestId = MessageFactory.addRequestId(originalMessage, 'req-123-456');

        expect(messageWithRequestId.requestId).to.equal('req-123-456');
        expect(messageWithRequestId.command).to.equal(originalMessage.command);
        expect(messageWithRequestId.timestamp).to.equal(originalMessage.timestamp);
      });

      it('should preserve all original message properties', () => {
        const originalMessage = MessageFactory.createTerminalInputMessage('terminal-789', 'test input');
        const messageWithRequestId = MessageFactory.addRequestId(originalMessage, 'req-789');

        expect(messageWithRequestId.requestId).to.equal('req-789');
        expect(messageWithRequestId.command).to.equal('input');
        expect(messageWithRequestId.terminalId).to.equal('terminal-789');
        expect(messageWithRequestId.data).to.equal('test input');
      });
    });

    describe('updateTimestamp', () => {
      it('should update message timestamp', async () => {
        const originalMessage = MessageFactory.createSettingsRequest();
        const originalTimestamp = originalMessage.timestamp;

        // Wait a bit to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 1));

        const updatedMessage = MessageFactory.updateTimestamp(originalMessage);

        expect(updatedMessage.timestamp).to.be.greaterThan(originalTimestamp);
        expect(updatedMessage.command).to.equal(originalMessage.command);
      });

      it('should preserve all other message properties', () => {
        const originalMessage = MessageFactory.createTerminalOutputMessage('terminal-update', 'output data');
        const updatedMessage = MessageFactory.updateTimestamp(originalMessage);

        expect(updatedMessage.command).to.equal('output');
        expect(updatedMessage.terminalId).to.equal('terminal-update');
        expect(updatedMessage.data).to.equal('output data');
        expect(updatedMessage.timestamp).to.be.a('number');
      });
    });

    describe('cloneMessage', () => {
      it('should clone message without modifications', () => {
        const originalMessage = MessageFactory.createTerminalResizeMessage('resize-test', 100, 25);
        const clonedMessage = MessageFactory.cloneMessage(originalMessage);

        expect(clonedMessage).to.deep.equal(originalMessage);
        expect(clonedMessage).not.to.equal(originalMessage); // Different object reference
      });

      it('should clone message with modifications', () => {
        const originalMessage = MessageFactory.createTerminalFocusMessage('focus-original');
        const modifications = { terminalId: 'focus-modified', extraProperty: 'test' };
        const modifiedMessage = MessageFactory.cloneMessage(originalMessage, modifications);

        expect(modifiedMessage.command).to.equal('focusTerminal');
        expect(modifiedMessage.terminalId).to.equal('focus-modified');
        expect(modifiedMessage.extraProperty).to.equal('test');
        expect(modifiedMessage.timestamp).to.equal(originalMessage.timestamp);
      });

      it('should handle complex modifications', () => {
        const originalMessage = MessageFactory.createStateUpdateMessage(mockTerminalState);
        const modifications = {
          state: { ...mockTerminalState, maxTerminals: 10 },
          activeTerminalId: 'new-active-terminal',
          newField: { nested: { value: 'test' } },
        };

        const modifiedMessage = MessageFactory.cloneMessage(originalMessage, modifications);

        expect(modifiedMessage.command).to.equal('stateUpdate');
        expect(modifiedMessage.state.maxTerminals).to.equal(10);
        expect(modifiedMessage.activeTerminalId).to.equal('new-active-terminal');
        expect(modifiedMessage.newField.nested.value).to.equal('test');
      });
    });
  });

  describe('parameter validation and edge cases', () => {
    it('should handle empty string terminal IDs', () => {
      const message = MessageFactory.createTerminalDeletionRequest('');

      expect(message.command).to.equal('deleteTerminal');
      expect(message.terminalId).to.equal('');
      expect(message.requestSource).to.equal('panel');
    });

    it('should handle very long terminal IDs', () => {
      const longTerminalId = 'terminal-' + 'x'.repeat(1000);
      const message = MessageFactory.createTerminalFocusMessage(longTerminalId);

      expect(message.command).to.equal('focusTerminal');
      expect(message.terminalId).to.equal(longTerminalId);
      expect(message.terminalId.length).to.equal(1009);
    });

    it('should handle special characters in data', () => {
      const specialData = 'echo "Hello\nWorld\t\u0001\u001b[31mRed\u001b[0m"';
      const message = MessageFactory.createTerminalInputMessage('special-terminal', specialData);

      expect(message.command).to.equal('input');
      expect(message.terminalId).to.equal('special-terminal');
      expect(message.data).to.equal(specialData);
    });

    it('should handle zero and negative dimensions in resize', () => {
      const message = MessageFactory.createTerminalResizeMessage('dimension-test', 0, -1);

      expect(message.command).to.equal('resize');
      expect(message.terminalId).to.equal('dimension-test');
      expect(message.cols).to.equal(0);
      expect(message.rows).to.equal(-1);
    });

    it('should handle empty scrollback content arrays', () => {
      const message = MessageFactory.createScrollbackRestoreMessage('empty-scrollback', []);

      expect(message.command).to.equal('restoreScrollback');
      expect(message.terminalId).to.equal('empty-scrollback');
      expect(message.scrollbackContent).to.deep.equal([]);
    });

    it('should handle null and undefined values in terminal states', () => {
      const terminalStatesWithNulls = {
        'terminal-null': { status: 'none' as const, agentType: null, terminalName: 'Terminal Null' },
      };

      const message = MessageFactory.createCliAgentFullStateSync(
        terminalStatesWithNulls,
        null,
        null,
        0
      );

      expect(message.command).to.equal('cliAgentFullStateSync');
      expect(message.terminalStates).to.deep.equal(terminalStatesWithNulls);
      expect(message.connectedAgentId).to.be.null;
      expect(message.connectedAgentType).to.be.null;
      expect(message.disconnectedCount).to.equal(0);
    });
  });

  describe('message consistency and format validation', () => {
    it('should ensure all messages have consistent timestamp format', () => {
      const messages = [
        MessageFactory.createTerminalCreationRequest(),
        MessageFactory.createTerminalDeletionRequest('test-terminal'),
        MessageFactory.createTerminalInputMessage('test-terminal', 'test'),
        MessageFactory.createSettingsRequest(),
        MessageFactory.createTerminalCreatedMessage(mockTerminalInstance, mockTerminalConfig),
        MessageFactory.createStateUpdateMessage(mockTerminalState),
      ];

      messages.forEach((message, index) => {
        expect(message.timestamp, `Message ${index} should have timestamp`).to.be.a('number');
        expect(message.timestamp, `Message ${index} timestamp should be recent`).to.be.closeTo(Date.now(), 1000);
      });
    });

    it('should ensure command field is always present and valid', () => {
      const messages = [
        MessageFactory.createTerminalCreationRequest(),
        MessageFactory.createErrorReport('TEST', 'test error'),
        MessageFactory.createScrollbackRestoreMessage('test', []),
        MessageFactory.createCliAgentStatusUpdate(null, 'none', null),
      ];

      messages.forEach((message, index) => {
        expect(message.command, `Message ${index} should have command`).to.be.a('string');
        expect(message.command, `Message ${index} command should not be empty`).to.not.be.empty;
      });
    });

    it('should ensure type safety for different message types', () => {
      // VsCode messages (WebView → Extension)
      const vsCodeMessage = MessageFactory.createTerminalCreationRequest();
      expect(vsCodeMessage).to.have.property('command');
      expect(vsCodeMessage).to.have.property('timestamp');

      // WebView messages (Extension → WebView)
      const webViewMessage = MessageFactory.createTerminalCreatedMessage(mockTerminalInstance, mockTerminalConfig);
      expect(webViewMessage).to.have.property('command');
      expect(webViewMessage).to.have.property('timestamp');
      expect(webViewMessage).to.have.property('terminalName');
    });
  });
});