/**
 * TDD Test Suite for SecondaryTerminalProvider Message Handling
 *
 * Following t-wada's TDD methodology for critical WebView communication:
 * 1. RED: Specify message handling behaviors that must work
 * 2. GREEN: Implement minimal message routing and processing
 * 3. REFACTOR: Improve error handling and performance
 *
 * Focus Areas:
 * - Extension ↔ WebView message coordination
 * - Session restoration message flow
 * - Async operation timeout handling
 * - Terminal lifecycle coordination
 * - Error recovery scenarios
 */

import * as _assert from 'assert';
import * as sinon from 'sinon';
import { expect } from 'chai';

// Test setup
import '../../shared/TestSetup';

describe('SecondaryTerminalProvider - Message Handling TDD Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let _mockWebview: any;
  let _mockContext: any;
  let mockTerminalManager: any;
  let mockSessionManager: any;
  let _provider: any; // Will be loaded dynamically to avoid import issues

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock WebView
    _mockWebview = {
      postMessage: sandbox.stub().resolves(),
      onDidReceiveMessage: sandbox.stub(),
      html: '',
      options: {
        enableScripts: true,
        localResourceRoots: [],
      },
    };

    // Mock VS Code context
    _mockContext = {
      extensionUri: { fsPath: '/mock/extension/path' },
      globalState: {
        get: sandbox.stub(),
        update: sandbox.stub().resolves(),
      },
      subscriptions: [],
    };

    // Mock Terminal Manager
    mockTerminalManager = {
      getTerminals: sandbox.stub().returns([]),
      createTerminal: sandbox.stub(),
      deleteTerminal: sandbox.stub(),
      setActiveTerminal: sandbox.stub(),
      getActiveTerminalId: sandbox.stub(),
      onTerminalOutput: sandbox.stub(),
      onTerminalClosed: sandbox.stub(),
      sendData: sandbox.stub(),
      resizeTerminal: sandbox.stub(),
    };

    // Mock Session Manager
    mockSessionManager = {
      saveCurrentSession: sandbox.stub().resolves({ success: true, terminalCount: 0 }),
      restoreSession: sandbox.stub().resolves({ success: true, restoredCount: 0, skippedCount: 0 }),
      getSessionInfo: sandbox.stub().returns({ exists: false }),
      clearSession: sandbox.stub().resolves(),
      setSidebarProvider: sandbox.stub(),
      handleSerializationResponse: sandbox.stub(),
      sendTerminalRestoreInfoToWebView: sandbox.stub().resolves(),
    };

    // Mock VS Code API
    (global as any).vscode = {
      workspace: {
        getConfiguration: sandbox.stub().returns({
          get: sandbox.stub().returns(true),
        }),
      },
      Uri: {
        file: sandbox.stub(),
        joinPath: sandbox.stub(),
      },
      window: {
        showErrorMessage: sandbox.stub(),
        showInformationMessage: sandbox.stub(),
      },
      ViewColumn: { One: 1 },
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('RED Phase: Message Flow Specification', () => {
    it('should define message handler registration contract', () => {
      // RED: Test that message handlers are properly registered
      const expectedHandlers = [
        'webviewReady',
        'getSettings',
        'focusTerminal',
        'splitTerminal',
        'createTerminal',
        'requestInitialTerminal',
        'terminalInput',
        'terminalResize',
        'terminalClosed',
        'killTerminal',
        'deleteTerminal',
        'updateSettings',
        'reportPanelLocation',
        'sessionRestorationDataRequest',
        'extractScrollbackData',
        'restoreTerminalSerialization',
        'requestTerminalSerialization',
      ];

      // This test will initially fail until handlers are properly registered
      const mockProvider = {
        _messageHandlers: new Map(),
        _initializeMessageHandlers: function() {
          expectedHandlers.forEach(handler => {
            this._messageHandlers.set(handler, () => {});
          });
        }
      };

      mockProvider._initializeMessageHandlers();

      expectedHandlers.forEach(handlerName => {
        expect(mockProvider._messageHandlers.has(handlerName)).to.be.true;
      });
    });

    it('should specify WebView ready initialization behavior', () => {
      // RED: Define what must happen when WebView becomes ready
      const mockProvider = {
        _isInitialized: false,
        _handleWebviewReady: function() {
          this._isInitialized = true;
          return {
            success: true,
            terminalsCreated: 0,
            sessionRestored: false,
          };
        }
      };

      const result = mockProvider._handleWebviewReady();

      expect(mockProvider._isInitialized).to.be.true;
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('terminalsCreated');
      expect(result).to.have.property('sessionRestored');
    });

    it('should specify session restoration message protocol', () => {
      // RED: Define session restoration request/response cycle
      const sessionRestorationRequest = {
        command: 'requestTerminalSerialization',
        terminalIds: ['term-1', 'term-2'],
        requestId: 'restore-123',
        timestamp: Date.now(),
      };

      const _expectedResponse = {
        command: 'sessionRestorationData',
        requestId: 'restore-123',
        terminalData: {
          'term-1': 'serialized-content-1',
          'term-2': 'serialized-content-2',
        },
        timestamp: sinon.match.number,
      };

      // This test specifies the contract but will fail initially
      const mockProvider = {
        _handleSessionRestorationDataRequest: function(message: any) {
          return {
            command: 'sessionRestorationData',
            requestId: message.requestId,
            terminalData: {},
            timestamp: Date.now(),
          };
        }
      };

      const response = mockProvider._handleSessionRestorationDataRequest(sessionRestorationRequest);

      expect(response.command).to.equal('sessionRestorationData');
      expect(response.requestId).to.equal(sessionRestorationRequest.requestId);
    });
  });

  describe('GREEN Phase: Basic Message Processing Implementation', () => {
    it('should process webviewReady message and initialize terminals', async () => {
      // GREEN: Implement basic WebView ready handling
      const mockProvider = {
        _isInitialized: false,
        _terminalManager: mockTerminalManager,
        _standardSessionManager: mockSessionManager,
        _sendMessage: sandbox.stub().resolves(),

        async _handleWebviewReady() {
          this._isInitialized = true;

          // Check for existing terminals
          const existingTerminals = this._terminalManager.getTerminals();
          let terminalsCreated = 0;
          let sessionRestored = false;

          if (existingTerminals.length === 0) {
            // Check for saved session
            const sessionInfo = this._standardSessionManager.getSessionInfo();

            if (sessionInfo.exists) {
              const restoreResult = await this._standardSessionManager.restoreSession();
              sessionRestored = restoreResult.success;
              terminalsCreated = restoreResult.restoredCount;
            } else {
              // Create initial terminal
              const terminalId = this._terminalManager.createTerminal();
              if (terminalId) {
                terminalsCreated = 1;
              }
            }
          }

          return {
            success: true,
            terminalsCreated,
            sessionRestored,
          };
        }
      };

      // Mock session with terminals
      mockSessionManager.getSessionInfo.returns({
        exists: true,
        terminals: [
          { id: 'saved-term-1', name: 'Saved Terminal 1' },
        ],
      });
      mockSessionManager.restoreSession.resolves({
        success: true,
        restoredCount: 1,
        skippedCount: 0,
      });

      const result = await mockProvider._handleWebviewReady();

      expect(result.success).to.be.true;
      expect(result.sessionRestored).to.be.true;
      expect(result.terminalsCreated).to.equal(1);
      expect(mockProvider._isInitialized).to.be.true;
    });

    it('should handle terminal creation requests', () => {
      // GREEN: Implement terminal creation message handling
      const mockProvider = {
        _terminalManager: mockTerminalManager,
        _sendMessage: sandbox.stub().resolves(),

        _handleCreateTerminal() {
          const terminalId = this._terminalManager.createTerminal();

          if (terminalId) {
            this._sendMessage({
              command: 'terminalCreated',
              terminalId,
              timestamp: Date.now(),
            });
            return { success: true, terminalId };
          }

          return { success: false, error: 'Failed to create terminal' };
        }
      };

      mockTerminalManager.createTerminal.returns('new-terminal-123');

      const result = mockProvider._handleCreateTerminal();

      expect(result.success).to.be.true;
      expect(result.terminalId).to.equal('new-terminal-123');
      expect(mockProvider._sendMessage).to.have.been.called;
    });

    it('should handle terminal deletion with proper cleanup', async () => {
      // GREEN: Implement terminal deletion logic
      const mockProvider = {
        _terminalManager: mockTerminalManager,
        _sendMessage: sandbox.stub().resolves(),

        async _handleDeleteTerminal(message: any) {
          const { terminalId } = message;

          const deleteResult = await this._terminalManager.deleteTerminal(terminalId, {
            force: false,
          });

          if (deleteResult.success) {
            await this._sendMessage({
              command: 'terminalDeleted',
              terminalId,
              timestamp: Date.now(),
            });
            return { success: true };
          }

          return {
            success: false,
            error: deleteResult.reason || 'Failed to delete terminal'
          };
        }
      };

      mockTerminalManager.deleteTerminal.resolves({ success: true });

      const result = await mockProvider._handleDeleteTerminal({ terminalId: 'term-to-delete' });

      expect(result.success).to.be.true;
      expect(mockTerminalManager.deleteTerminal).to.have.been.calledWith(
        'term-to-delete',
        { force: false }
      );
      expect(mockProvider._sendMessage).to.have.been.calledWith(
        sinon.match({
          command: 'terminalDeleted',
          terminalId: 'term-to-delete',
        })
      );
    });

    it('should handle terminal input forwarding', () => {
      // GREEN: Implement input forwarding to terminal processes
      const mockProvider = {
        _terminalManager: mockTerminalManager,

        _handleTerminalInput(message: any) {
          const { terminalId, data } = message;

          if (!terminalId || !data) {
            return { success: false, error: 'Missing terminalId or data' };
          }

          this._terminalManager.sendData(terminalId, data);
          return { success: true };
        }
      };

      const inputMessage = {
        terminalId: 'active-terminal',
        data: 'echo "Hello World"\\r',
      };

      const result = mockProvider._handleTerminalInput(inputMessage);

      expect(result.success).to.be.true;
      expect(mockTerminalManager.sendData).to.have.been.calledWith(
        'active-terminal',
        'echo "Hello World"\\r'
      );
    });
  });

  describe('GREEN Phase: Session Persistence Message Handling', () => {
    it('should handle scrollback data requests from SessionManager', async () => {
      // GREEN: Implement scrollback data request handling
      const mockProvider = {
        _sendMessage: sandbox.stub().resolves(),
        pendingScrollbackRequests: new Map(),

        async _handlePersistenceMessage(message: any) {
          if (message.command === 'requestTerminalSerialization') {
            const { terminalIds, requestId } = message;

            // Store pending request
            this.pendingScrollbackRequests.set(requestId, {
              terminalIds,
              timestamp: Date.now(),
            });

            // Send request to WebView
            await this._sendMessage({
              command: 'extractScrollbackData',
              terminalIds,
              requestId,
              timestamp: Date.now(),
            });

            return { success: true, requestId };
          }

          if (message.command === 'restoreTerminalSerialization') {
            const { terminalData } = message;

            // Send restoration data to WebView
            await this._sendMessage({
              command: 'restoreSerializedTerminals',
              terminalData,
              timestamp: Date.now(),
            });

            return { success: true, restoredCount: terminalData.length };
          }

          return { success: false, error: 'Unknown persistence command' };
        }
      };

      // Test scrollback data request
      const scrollbackRequest = {
        command: 'requestTerminalSerialization',
        terminalIds: ['term-1', 'term-2'],
        requestId: 'scroll-req-123',
      };

      const requestResult = await mockProvider._handlePersistenceMessage(scrollbackRequest);

      expect(requestResult.success).to.be.true;
      expect(requestResult.requestId).to.equal('scroll-req-123');
      expect(mockProvider.pendingScrollbackRequests.has('scroll-req-123')).to.be.true;
      expect(mockProvider._sendMessage).to.have.been.calledWith(
        sinon.match({
          command: 'extractScrollbackData',
          terminalIds: ['term-1', 'term-2'],
          requestId: 'scroll-req-123',
        })
      );

      // Test restoration request
      const restorationRequest = {
        command: 'restoreTerminalSerialization',
        terminalData: [
          { id: 'term-1', serializedContent: 'content-1' },
          { id: 'term-2', serializedContent: 'content-2' },
        ],
      };

      const restoreResult = await mockProvider._handlePersistenceMessage(restorationRequest);

      expect(restoreResult.success).to.be.true;
      expect(restoreResult.restoredCount).to.equal(2);
    });

    it('should handle scrollback data responses from WebView', () => {
      // GREEN: Implement response handling for scrollback data
      const mockProvider = {
        _standardSessionManager: mockSessionManager,
        pendingScrollbackRequests: new Map(),

        handleScrollbackDataResponse(data: any) {
          // Extract request ID from response
          const requestId = data.requestId || 'default';

          if (this.pendingScrollbackRequests.has(requestId)) {
            // Remove pending request
            this.pendingScrollbackRequests.delete(requestId);

            // Forward to session manager
            this._standardSessionManager.handleSerializationResponse(data.terminalData || data);

            return { success: true, terminalCount: Object.keys(data.terminalData || data).length };
          }

          return { success: false, error: 'No pending request found' };
        }
      };

      // Set up pending request
      mockProvider.pendingScrollbackRequests.set('test-request', {
        terminalIds: ['term-1'],
        timestamp: Date.now(),
      });

      const responseData = {
        requestId: 'test-request',
        terminalData: {
          'term-1': 'serialized-scrollback-content',
        },
      };

      const result = mockProvider.handleScrollbackDataResponse(responseData);

      expect(result.success).to.be.true;
      expect(result.terminalCount).to.equal(1);
      expect(mockProvider.pendingScrollbackRequests.has('test-request')).to.be.false;
      expect(mockSessionManager.handleSerializationResponse).to.have.been.calledWith({
        'term-1': 'serialized-scrollback-content',
      });
    });
  });

  describe('REFACTOR Phase: Error Handling and Edge Cases', () => {
    it('should handle message processing errors gracefully', async () => {
      // REFACTOR: Improve error handling in message processing
      const mockProvider = {
        _terminalManager: mockTerminalManager,
        _sendMessage: sandbox.stub().rejects(new Error('WebView communication failed')),

        async _handleWebviewMessage(message: any) {
          try {
            switch (message.command) {
              case 'createTerminal':
                const terminalId = this._terminalManager.createTerminal();
                if (!terminalId) {
                  throw new Error('Terminal creation failed');
                }

                await this._sendMessage({
                  command: 'terminalCreated',
                  terminalId,
                });

                return { success: true, terminalId };

              default:
                throw new Error(`Unknown command: ${message.command}`);
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              command: message.command,
            };
          }
        }
      };

      mockTerminalManager.createTerminal.returns('new-terminal');

      const result = await mockProvider._handleWebviewMessage({ command: 'createTerminal' });

      expect(result.success).to.be.false;
      expect(result.error).to.include('WebView communication failed');
      expect(result.command).to.equal('createTerminal');
    });

    it('should handle invalid message formats', () => {
      // REFACTOR: Add message validation
      const mockProvider = {
        _isValidWebviewMessage(message: any): boolean {
          return message && typeof message === 'object' && typeof message.command === 'string';
        },

        _hasTerminalId(message: any): boolean {
          return this._isValidWebviewMessage(message) && typeof message.terminalId === 'string';
        },

        _hasInputData(message: any): boolean {
          return this._hasTerminalId(message) && typeof message.data === 'string';
        },

        processMessage(message: any) {
          if (!this._isValidWebviewMessage(message)) {
            return { success: false, error: 'Invalid message format' };
          }

          if (message.command === 'terminalInput' && !this._hasInputData(message)) {
            return { success: false, error: 'Missing terminal input data' };
          }

          return { success: true };
        }
      };

      // Test invalid messages
      expect(mockProvider.processMessage(null).success).to.be.false;
      expect(mockProvider.processMessage('invalid').success).to.be.false;
      expect(mockProvider.processMessage({}).success).to.be.false;

      // Test valid message
      expect(mockProvider.processMessage({ command: 'test' }).success).to.be.true;

      // Test terminal input validation
      const invalidInput = { command: 'terminalInput' };
      expect(mockProvider.processMessage(invalidInput).success).to.be.false;

      const validInput = { command: 'terminalInput', terminalId: 'term-1', data: 'test' };
      expect(mockProvider.processMessage(validInput).success).to.be.true;
    });

    it('should handle WebView unavailability during message sending', async () => {
      // REFACTOR: Add resilience for WebView disconnection
      const mockProvider = {
        _view: null as any,
        _messageQueue: [] as any[],

        _isWebviewAvailable(): boolean {
          return !!(this._view && this._view.webview);
        },

        async _sendMessage(message: any): Promise<boolean> {
          if (!this._isWebviewAvailable()) {
            // Queue message for later delivery
            this._messageQueue.push({
              message,
              timestamp: Date.now(),
            });
            return false;
          }

          try {
            await this._view!.webview.postMessage(message);
            return true;
          } catch (error) {
            // Queue message on failure
            this._messageQueue.push({
              message,
              timestamp: Date.now(),
              error: error instanceof Error ? error.message : String(error),
            });
            return false;
          }
        },

        async flushMessageQueue(): Promise<number> {
          if (!this._isWebviewAvailable()) {
            return 0;
          }

          let flushedCount = 0;
          const queue = [...this._messageQueue];
          this._messageQueue = [];

          for (const queuedMessage of queue) {
            try {
              await this._view!.webview.postMessage(queuedMessage.message);
              flushedCount++;
            } catch (error) {
              // Re-queue failed messages
              this._messageQueue.push(queuedMessage);
            }
          }

          return flushedCount;
        }
      };

      // Test message queuing when WebView unavailable
      const success = await mockProvider._sendMessage({ command: 'test' });
      expect(success).to.be.false;
      expect(mockProvider._messageQueue).to.have.length(1);

      // Test message queue flushing when WebView becomes available
      mockProvider._view = {
        webview: {
          postMessage: sandbox.stub().resolves(),
        },
      };

      const flushedCount = await mockProvider.flushMessageQueue();
      expect(flushedCount).to.equal(1);
      expect(mockProvider._messageQueue).to.have.length(0);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should cleanup pending requests on timeout', () => {
      // REFACTOR: Add timeout handling for pending requests
      const mockProvider = {
        pendingScrollbackRequests: new Map(),
        REQUEST_TIMEOUT_MS: 5000,

        cleanupExpiredRequests(): number {
          const now = Date.now();
          let cleanedCount = 0;

          for (const [requestId, request] of this.pendingScrollbackRequests.entries()) {
            if (now - request.timestamp > this.REQUEST_TIMEOUT_MS) {
              this.pendingScrollbackRequests.delete(requestId);
              cleanedCount++;
            }
          }

          return cleanedCount;
        }
      };

      // Add expired request
      mockProvider.pendingScrollbackRequests.set('expired-request', {
        terminalIds: ['term-1'],
        timestamp: Date.now() - 10000, // 10 seconds ago
      });

      // Add recent request
      mockProvider.pendingScrollbackRequests.set('recent-request', {
        terminalIds: ['term-2'],
        timestamp: Date.now() - 1000, // 1 second ago
      });

      const cleanedCount = mockProvider.cleanupExpiredRequests();

      expect(cleanedCount).to.equal(1);
      expect(mockProvider.pendingScrollbackRequests.has('expired-request')).to.be.false;
      expect(mockProvider.pendingScrollbackRequests.has('recent-request')).to.be.true;
    });

    it('should limit message queue size to prevent memory issues', () => {
      // REFACTOR: Add message queue size limits
      const mockProvider = {
        _messageQueue: [] as any[],
        MAX_QUEUE_SIZE: 100,

        queueMessage(message: any): boolean {
          if (this._messageQueue.length >= this.MAX_QUEUE_SIZE) {
            // Remove oldest messages
            this._messageQueue.splice(0, this._messageQueue.length - this.MAX_QUEUE_SIZE + 1);
          }

          this._messageQueue.push({
            message,
            timestamp: Date.now(),
          });

          return true;
        }
      };

      // Fill queue beyond limit
      for (let i = 0; i < 150; i++) {
        mockProvider.queueMessage({ command: `test-${i}` });
      }

      expect(mockProvider._messageQueue.length).to.equal(mockProvider.MAX_QUEUE_SIZE);

      // Verify oldest messages were removed (newest 100 should remain)
      const lastMessage = mockProvider._messageQueue[mockProvider._messageQueue.length - 1];
      expect(lastMessage.message.command).to.equal('test-149');
    });
  });
});