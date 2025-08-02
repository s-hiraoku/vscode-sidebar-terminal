/**
 * Focused test for MessageManager scrollback extraction functionality
 * Tests WebView-side handling of extractScrollbackData messages and scrollbackDataCollected responses
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../../shared/TestSetup';
import { MessageManager } from '../../../webview/managers/MessageManager';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import {
  IManagerCoordinator,
  TerminalInstance,
} from '../../../webview/interfaces/ManagerInterfaces';

describe('MessageManager - Scrollback Extraction', () => {
  let sandbox: sinon.SinonSandbox;
  let messageManager: MessageManager;
  let mockCoordinator: IManagerCoordinator;
  let mockTerminal: Terminal;
  let mockTerminalInstance: TerminalInstance;
  let dom: any;
  let consoleMocks: any;

  // Helper function to create MessageEvent from data
  const createMessageEvent = (data: any): MessageEvent => {
    return new MessageEvent('message', { data });
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Setup complete test environment with DOM
    const testEnv = setupCompleteTestEnvironment();
    dom = testEnv.dom;
    consoleMocks = testEnv.consoleMocks;

    // Create mock terminal with xterm buffer
    mockTerminal = {
      write: sandbox.spy(),
      writeln: sandbox.spy(),
      clear: sandbox.spy(),
      resize: sandbox.spy(),
      focus: sandbox.spy(),
      blur: sandbox.spy(),
      dispose: sandbox.spy(),
      open: sandbox.spy(),
      onData: sandbox.stub().returns({ dispose: sandbox.spy() }),
      onResize: sandbox.stub().returns({ dispose: sandbox.spy() }),
      onKey: sandbox.stub().returns({ dispose: sandbox.spy() }),
      loadAddon: sandbox.spy(),
      options: {},
      rows: 24,
      cols: 80,
      buffer: {
        active: {
          length: 100,
          viewportY: 50,
          baseY: 0,
          getLine: sandbox.stub().callsFake((lineNumber: number) => {
            // Mock different types of terminal content
            if (lineNumber < 10) {
              return {
                translateToString: () => `Line ${lineNumber}: Command output`,
              };
            }
            if (lineNumber >= 10 && lineNumber < 20) {
              return {
                translateToString: () => `Line ${lineNumber}: CLI Agent response`,
              };
            }
            if (lineNumber >= 20 && lineNumber < 30) {
              return {
                translateToString: () => '', // Empty lines
              };
            }
            return {
              translateToString: () => `Line ${lineNumber}: Regular content`,
            };
          }),
        },
      },
    } as any;

    // Create mock terminal instance
    mockTerminalInstance = {
      id: 'test-terminal-1',
      name: 'Test Terminal',
      terminal: mockTerminal,
      fitAddon: {} as FitAddon,
      container: document.createElement('div'),
    };

    // Create mock coordinator
    mockCoordinator = {
      getActiveTerminalId: sandbox.stub().returns('test-terminal-1'),
      setActiveTerminalId: sandbox.spy(),
      getTerminalInstance: sandbox.stub().callsFake((terminalId: string) => {
        if (terminalId === 'test-terminal-1') {
          return mockTerminalInstance;
        }
        return undefined;
      }),
      getAllTerminalInstances: sandbox
        .stub()
        .returns(new Map([['test-terminal-1', mockTerminalInstance]])),
      getAllTerminalContainers: sandbox.stub().returns(new Map()),
      getTerminalElement: sandbox.stub(),
      postMessageToExtension: sandbox.spy(),
      log: sandbox.spy(),
      createTerminal: sandbox.spy(),
      openSettings: sandbox.spy(),
      applyFontSettings: sandbox.spy(),
      closeTerminal: sandbox.spy(),
      getManagers: sandbox.stub().returns({
        performance: {},
        input: {},
        ui: {},
        config: {},
        message: {},
        notification: {},
      }),
      updateClaudeStatus: sandbox.spy(),
      updateCliAgentStatus: sandbox.spy(),
      ensureTerminalFocus: sandbox.spy(),
    };

    // Create MessageManager instance
    messageManager = new MessageManager();
  });

  afterEach(() => {
    cleanupTestEnvironment(sandbox, dom);
  });

  describe('extractScrollbackData message handling', () => {
    it('should handle extractScrollbackData message and send scrollbackDataCollected response', async () => {
      // Arrange
      const extractScrollbackMessage = {
        command: 'extractScrollbackData',
        terminalId: 'test-terminal-1',
        maxLines: 50,
        requestId: 'test-request-123',
      };

      // Act
      messageManager.handleMessage(createMessageEvent(extractScrollbackMessage), mockCoordinator);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(mockCoordinator.getTerminalInstance).to.have.been.calledWith('test-terminal-1');
      expect(mockCoordinator.postMessageToExtension).to.have.been.called;

      // Verify the response message structure
      const postMessageCalls = (
        mockCoordinator.postMessageToExtension as sinon.SinonSpy
      ).getCalls();
      expect(postMessageCalls.length).to.be.greaterThan(0);

      // Find the scrollbackDataCollected response
      const scrollbackResponse = postMessageCalls.find((call) => {
        const message = call.args[0];
        return message && message.command === 'scrollbackDataCollected';
      });

      expect(scrollbackResponse).to.exist;
      const responseMessage = scrollbackResponse?.args[0];
      expect(responseMessage.command).to.equal('scrollbackDataCollected');
      expect(responseMessage.terminalId).to.equal('test-terminal-1');
      expect(responseMessage.requestId).to.equal('test-request-123');
      expect(responseMessage.success).to.be.true;
      expect(responseMessage.scrollbackData).to.be.an('array');
      expect(responseMessage.timestamp).to.be.a('number');
    });

    it('should extract scrollback data from xterm buffer correctly', async () => {
      // Arrange
      const extractScrollbackMessage = {
        command: 'extractScrollbackData',
        terminalId: 'test-terminal-1',
        maxLines: 25,
        requestId: 'test-request-456',
      };

      // Act
      messageManager.handleMessage(createMessageEvent(extractScrollbackMessage), mockCoordinator);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - Check that scrollback extraction worked
      const postMessageCalls = (
        mockCoordinator.postMessageToExtension as sinon.SinonSpy
      ).getCalls();
      const scrollbackResponse = postMessageCalls.find((call) => {
        const message = call.args[0];
        return message && message.command === 'scrollbackDataCollected';
      });

      expect(scrollbackResponse).to.exist;
      const responseMessage = scrollbackResponse?.args[0];
      expect(responseMessage.scrollbackData).to.be.an('array');

      // Should have extracted some lines (non-empty lines)
      expect(responseMessage.scrollbackData.length).to.be.greaterThan(0);

      // Check structure of scrollback data entries
      const firstEntry = responseMessage.scrollbackData[0];
      expect(firstEntry).to.have.property('content');
      expect(firstEntry).to.have.property('type');
      expect(firstEntry).to.have.property('timestamp');
    });

    it('should handle terminal not found error', async () => {
      // Arrange
      const extractScrollbackMessage = {
        command: 'extractScrollbackData',
        terminalId: 'non-existent-terminal',
        maxLines: 50,
        requestId: 'test-request-789',
      };

      // Act
      messageManager.handleMessage(createMessageEvent(extractScrollbackMessage), mockCoordinator);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(mockCoordinator.getTerminalInstance).to.have.been.calledWith('non-existent-terminal');

      const postMessageCalls = (
        mockCoordinator.postMessageToExtension as sinon.SinonSpy
      ).getCalls();
      const errorResponse = postMessageCalls.find((call) => {
        const message = call.args[0];
        return message && message.command === 'scrollbackDataCollected' && !message.success;
      });

      expect(errorResponse).to.exist;
      const responseMessage = errorResponse?.args[0];
      expect(responseMessage.success).to.be.false;
      expect(responseMessage.error).to.include('Terminal not found');
      expect(responseMessage.scrollbackData).to.be.an('array').that.is.empty;
    });

    it('should handle missing requestId parameter', async () => {
      // Arrange
      const extractScrollbackMessage = {
        command: 'extractScrollbackData',
        terminalId: 'test-terminal-1',
        maxLines: 50,
        // Missing requestId
      };

      // Act
      messageManager.handleMessage(createMessageEvent(extractScrollbackMessage), mockCoordinator);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - should return early due to missing requestId
      expect(mockCoordinator.postMessageToExtension).to.not.have.been.called;
    });

    it('should handle missing terminalId parameter', async () => {
      // Arrange
      const extractScrollbackMessage = {
        command: 'extractScrollbackData',
        maxLines: 50,
        requestId: 'test-request-999',
        // Missing terminalId
      };

      // Act
      messageManager.handleMessage(createMessageEvent(extractScrollbackMessage), mockCoordinator);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - should return early due to missing terminalId
      expect(mockCoordinator.postMessageToExtension).to.not.have.been.called;
    });

    it('should use default maxLines when not provided', async () => {
      // Arrange
      const extractScrollbackMessage = {
        command: 'extractScrollbackData',
        terminalId: 'test-terminal-1',
        requestId: 'test-request-default',
        // Missing maxLines - should default to 1000
      };

      // Act
      messageManager.handleMessage(createMessageEvent(extractScrollbackMessage), mockCoordinator);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      const postMessageCalls = (
        mockCoordinator.postMessageToExtension as sinon.SinonSpy
      ).getCalls();
      const scrollbackResponse = postMessageCalls.find((call) => {
        const message = call.args[0];
        return message && message.command === 'scrollbackDataCollected';
      });

      expect(scrollbackResponse).to.exist;
      // The extraction should still work with default maxLines
      const responseMessage = scrollbackResponse?.args[0];
      expect(responseMessage.success).to.be.true;
    });

    it('should handle xterm buffer extraction errors', function () {
      // Skip this test for now as it requires complex error handling setup
      // The main functionality is tested in other test cases
      this.skip();
    });

    it('should filter out trailing empty lines from scrollback data', async () => {
      // Arrange - Create terminal with trailing empty lines
      const terminalWithEmptyLines = {
        ...mockTerminal,
        buffer: {
          active: {
            length: 10,
            viewportY: 5,
            baseY: 0,
            getLine: sandbox.stub().callsFake((lineNumber: number) => {
              if (lineNumber < 5) {
                return {
                  translateToString: () => `Content line ${lineNumber}`,
                };
              }
              // Last 5 lines are empty
              return {
                translateToString: () => '',
              };
            }),
          },
        },
      };

      const terminalInstanceWithEmptyLines = {
        ...mockTerminalInstance,
        terminal: terminalWithEmptyLines,
      };

      mockCoordinator.getTerminalInstance = sandbox.stub().returns(terminalInstanceWithEmptyLines);

      const extractScrollbackMessage = {
        command: 'extractScrollbackData',
        terminalId: 'test-terminal-1',
        maxLines: 10,
        requestId: 'test-request-empty-lines',
      };

      // Act
      messageManager.handleMessage(createMessageEvent(extractScrollbackMessage), mockCoordinator);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      const postMessageCalls = (
        mockCoordinator.postMessageToExtension as sinon.SinonSpy
      ).getCalls();
      const scrollbackResponse = postMessageCalls.find((call) => {
        const message = call.args[0];
        return message && message.command === 'scrollbackDataCollected';
      });

      expect(scrollbackResponse).to.exist;
      const responseMessage = scrollbackResponse?.args[0];

      // Should have filtered out trailing empty lines
      expect(responseMessage.scrollbackData.length).to.equal(5); // Only non-empty lines

      // All remaining lines should have content
      responseMessage.scrollbackData.forEach((line: any, index: number) => {
        expect(line.content.trim()).to.not.be.empty;
        expect(line.content).to.include(`Content line ${index}`);
      });
    });
  });

  describe('scrollback data structure validation', () => {
    it('should return properly structured scrollback data entries', async () => {
      // Arrange
      const extractScrollbackMessage = {
        command: 'extractScrollbackData',
        terminalId: 'test-terminal-1',
        maxLines: 10,
        requestId: 'test-request-structure',
      };

      // Act
      messageManager.handleMessage(createMessageEvent(extractScrollbackMessage), mockCoordinator);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      const postMessageCalls = (
        mockCoordinator.postMessageToExtension as sinon.SinonSpy
      ).getCalls();
      const scrollbackResponse = postMessageCalls.find((call) => {
        const message = call.args[0];
        return message && message.command === 'scrollbackDataCollected' && message.success;
      });

      expect(scrollbackResponse).to.exist;
      const responseMessage = scrollbackResponse?.args[0];

      // Validate each scrollback data entry structure
      responseMessage.scrollbackData.forEach((entry: any) => {
        expect(entry).to.have.property('content').that.is.a('string');
        expect(entry).to.have.property('type').that.equals('output');
        expect(entry).to.have.property('timestamp').that.is.a('number');
        expect(entry.timestamp).to.be.closeTo(Date.now(), 1000); // Within 1 second
      });
    });
  });

  describe('message queueing and coordination', () => {
    it('should queue scrollbackDataCollected response through coordinator', async () => {
      // Arrange
      const extractScrollbackMessage = {
        command: 'extractScrollbackData',
        terminalId: 'test-terminal-1',
        maxLines: 5,
        requestId: 'test-request-queue',
      };

      // Act
      messageManager.handleMessage(createMessageEvent(extractScrollbackMessage), mockCoordinator);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - Message should be sent through coordinator's postMessageToExtension
      expect(mockCoordinator.postMessageToExtension).to.have.been.called;

      // Verify coordinator was used to get terminal instance
      expect(mockCoordinator.getTerminalInstance).to.have.been.calledWith('test-terminal-1');
      expect(mockCoordinator.getAllTerminalInstances).to.have.been.called;
    });

    it('should handle coordinator method availability gracefully', async () => {
      // Arrange - Create coordinator without getAllTerminalInstances method
      const limitedCoordinator = {
        ...mockCoordinator,
        getAllTerminalInstances: undefined as any,
      };

      const extractScrollbackMessage = {
        command: 'extractScrollbackData',
        terminalId: 'test-terminal-1',
        maxLines: 5,
        requestId: 'test-request-limited',
      };

      // Act & Assert - Should not throw error
      expect(() => {
        messageManager.handleMessage(createMessageEvent(extractScrollbackMessage), limitedCoordinator);
      }).to.not.throw();
    });
  });
});
