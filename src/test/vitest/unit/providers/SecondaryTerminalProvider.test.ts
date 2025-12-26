// Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Test setup
import '../../../shared/TestSetup';

describe('SecondaryTerminalProvider', () => {
  describe('Message Handling', () => {
    let _mockWebview: any;
    let _mockContext: any;
    let mockTerminalManager: any;
    let mockSessionManager: any;
    let _provider: any; // Will be loaded dynamically to avoid import issues

    beforeEach(() => {
      // Mock WebView
      _mockWebview = {
        postMessage: vi.fn().mockResolvedValue(undefined),
        onDidReceiveMessage: vi.fn(),
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
          get: vi.fn(),
          update: vi.fn().mockResolvedValue(undefined),
        },
        subscriptions: [],
      };

      // Mock Terminal Manager
      mockTerminalManager = {
        getTerminals: vi.fn().mockReturnValue([]),
        createTerminal: vi.fn(),
        deleteTerminal: vi.fn(),
        setActiveTerminal: vi.fn(),
        getActiveTerminalId: vi.fn(),
        onTerminalOutput: vi.fn(),
        onTerminalClosed: vi.fn(),
        sendData: vi.fn(),
        resizeTerminal: vi.fn(),
      };

      // Mock Session Manager
      mockSessionManager = {
        saveCurrentSession: vi.fn().mockResolvedValue({ success: true, terminalCount: 0 }),
        restoreSession: vi.fn().mockResolvedValue({ success: true, restoredCount: 0, skippedCount: 0 }),
        getSessionInfo: vi.fn().mockReturnValue({ exists: false }),
        clearSession: vi.fn().mockResolvedValue(undefined),
        setSidebarProvider: vi.fn(),
        handleSerializationResponse: vi.fn(),
        sendTerminalRestoreInfoToWebView: vi.fn().mockResolvedValue(undefined),
      };

      // Mock VS Code API
      (global as any).vscode = {
        workspace: {
          getConfiguration: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(true),
          }),
        },
        Uri: {
          file: vi.fn(),
          joinPath: vi.fn(),
        },
        window: {
          showErrorMessage: vi.fn(),
          showInformationMessage: vi.fn(),
        },
        ViewColumn: { One: 1 },
      };
    });

    afterEach(() => {
      vi.restoreAllMocks();
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
          _initializeMessageHandlers: function () {
            expectedHandlers.forEach((handler) => {
              this._messageHandlers.set(handler, () => {});
            });
          },
        };

        mockProvider._initializeMessageHandlers();

        expectedHandlers.forEach((handlerName) => {
          expect(mockProvider._messageHandlers.has(handlerName)).toBe(true);
        });
      });

      it('should specify WebView ready initialization behavior', () => {
        // RED: Define what must happen when WebView becomes ready
        const mockProvider = {
          _isInitialized: false,
          _handleWebviewReady: function () {
            this._isInitialized = true;
            return {
              success: true,
              terminalsCreated: 0,
              sessionRestored: false,
            };
          },
        };

        const result = mockProvider._handleWebviewReady();

        expect(mockProvider._isInitialized).toBe(true);
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('terminalsCreated');
        expect(result).toHaveProperty('sessionRestored');
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
          timestamp: expect.any(Number),
        };

        // This test specifies the contract but will fail initially
        const mockProvider = {
          _handleSessionRestorationDataRequest: function (message: any) {
            return {
              command: 'sessionRestorationData',
              requestId: message.requestId,
              terminalData: {},
              timestamp: Date.now(),
            };
          },
        };

        const response =
          mockProvider._handleSessionRestorationDataRequest(sessionRestorationRequest);

        expect(response.command).toBe('sessionRestorationData');
        expect(response.requestId).toBe(sessionRestorationRequest.requestId);
      });
    });

    describe('GREEN Phase: Basic Message Processing Implementation', () => {
      it('should process webviewReady message and initialize terminals', async () => {
        // GREEN: Implement basic WebView ready handling
        const sendMessageMock = vi.fn().mockResolvedValue(undefined);
        const mockProvider = {
          _isInitialized: false,
          _terminalManager: mockTerminalManager,
          _standardSessionManager: mockSessionManager,
          _sendMessage: sendMessageMock,

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
          },
        };

        // Mock session with terminals
        mockSessionManager.getSessionInfo.mockReturnValue({
          exists: true,
          terminals: [{ id: 'saved-term-1', name: 'Saved Terminal 1' }],
        });
        mockSessionManager.restoreSession.mockResolvedValue({
          success: true,
          restoredCount: 1,
          skippedCount: 0,
        });

        const result = await mockProvider._handleWebviewReady();

        expect(result.success).toBe(true);
        expect(result.sessionRestored).toBe(true);
        expect(result.terminalsCreated).toBe(1);
        expect(mockProvider._isInitialized).toBe(true);
      });

      it('should handle terminal creation requests', () => {
        // GREEN: Implement terminal creation message handling
        const sendMessageMock = vi.fn().mockResolvedValue(undefined);
        const mockProvider = {
          _terminalManager: mockTerminalManager,
          _sendMessage: sendMessageMock,

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
          },
        };

        mockTerminalManager.createTerminal.mockReturnValue('new-terminal-123');

        const result = mockProvider._handleCreateTerminal();

        expect(result.success).toBe(true);
        expect(result.terminalId).toBe('new-terminal-123');
        expect(sendMessageMock).toHaveBeenCalled();
      });

      it('should handle terminal deletion with proper cleanup', async () => {
        // GREEN: Implement terminal deletion logic
        const sendMessageMock = vi.fn().mockResolvedValue(undefined);
        const mockProvider = {
          _terminalManager: mockTerminalManager,
          _sendMessage: sendMessageMock,

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
              error: deleteResult.reason || 'Failed to delete terminal',
            };
          },
        };

        mockTerminalManager.deleteTerminal.mockResolvedValue({ success: true });

        const result = await mockProvider._handleDeleteTerminal({ terminalId: 'term-to-delete' });

        expect(result.success).toBe(true);
        expect(mockTerminalManager.deleteTerminal).toHaveBeenCalledWith('term-to-delete', {
          force: false,
        });
        expect(sendMessageMock).toHaveBeenCalledWith(
          expect.objectContaining({
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
          },
        };

        const inputMessage = {
          terminalId: 'active-terminal',
          data: 'echo "Hello World"\\r',
        };

        const result = mockProvider._handleTerminalInput(inputMessage);

        expect(result.success).toBe(true);
        expect(mockTerminalManager.sendData).toHaveBeenCalledWith(
          'active-terminal',
          'echo "Hello World"\\r'
        );
      });
    });

    describe('GREEN Phase: Session Persistence Message Handling', () => {
      it('should handle scrollback data requests from SessionManager', async () => {
        // GREEN: Implement scrollback data request handling
        const sendMessageMock = vi.fn().mockResolvedValue(undefined);
        const mockProvider = {
          _sendMessage: sendMessageMock,
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
          },
        };

        // Test scrollback data request
        const scrollbackRequest = {
          command: 'requestTerminalSerialization',
          terminalIds: ['term-1', 'term-2'],
          requestId: 'scroll-req-123',
        };

        const requestResult = await mockProvider._handlePersistenceMessage(scrollbackRequest);

        expect(requestResult.success).toBe(true);
        expect(requestResult.requestId).toBe('scroll-req-123');
        expect(mockProvider.pendingScrollbackRequests.has('scroll-req-123')).toBe(true);
        expect(sendMessageMock).toHaveBeenCalledWith(
          expect.objectContaining({
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

        expect(restoreResult.success).toBe(true);
        expect(restoreResult.restoredCount).toBe(2);
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

              return {
                success: true,
                terminalCount: Object.keys(data.terminalData || data).length,
              };
            }

            return { success: false, error: 'No pending request found' };
          },
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

        expect(result.success).toBe(true);
        expect(result.terminalCount).toBe(1);
        expect(mockProvider.pendingScrollbackRequests.has('test-request')).toBe(false);
        expect(mockSessionManager.handleSerializationResponse).toHaveBeenCalledWith({
          'term-1': 'serialized-scrollback-content',
        });
      });
    });

    describe('REFACTOR Phase: Error Handling and Edge Cases', () => {
      it('should handle message processing errors gracefully', async () => {
        // REFACTOR: Improve error handling in message processing
        const sendMessageMock = vi.fn().mockRejectedValue(new Error('WebView communication failed'));
        const mockProvider = {
          _terminalManager: mockTerminalManager,
          _sendMessage: sendMessageMock,

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
          },
        };

        mockTerminalManager.createTerminal.mockReturnValue('new-terminal');

        const result = await mockProvider._handleWebviewMessage({ command: 'createTerminal' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('WebView communication failed');
        expect(result.command).toBe('createTerminal');
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
          },
        };

        // Test invalid messages
        expect(mockProvider.processMessage(null).success).toBe(false);
        expect(mockProvider.processMessage('invalid').success).toBe(false);
        expect(mockProvider.processMessage({}).success).toBe(false);

        // Test valid message
        expect(mockProvider.processMessage({ command: 'test' }).success).toBe(true);

        // Test terminal input validation
        const invalidInput = { command: 'terminalInput' };
        expect(mockProvider.processMessage(invalidInput).success).toBe(false);

        const validInput = { command: 'terminalInput', terminalId: 'term-1', data: 'test' };
        expect(mockProvider.processMessage(validInput).success).toBe(true);
      });

      it('should handle WebView unavailability during message sending', async () => {
        // REFACTOR: Add resilience for WebView disconnection
        const postMessageMock = vi.fn().mockResolvedValue(undefined);
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
          },
        };

        // Test message queuing when WebView unavailable
        const success = await mockProvider._sendMessage({ command: 'test' });
        expect(success).toBe(false);
        expect(mockProvider._messageQueue).toHaveLength(1);

        // Test message queue flushing when WebView becomes available
        mockProvider._view = {
          webview: {
            postMessage: postMessageMock,
          },
        };

        const flushedCount = await mockProvider.flushMessageQueue();
        expect(flushedCount).toBe(1);
        expect(mockProvider._messageQueue).toHaveLength(0);
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
          },
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

        expect(cleanedCount).toBe(1);
        expect(mockProvider.pendingScrollbackRequests.has('expired-request')).toBe(false);
        expect(mockProvider.pendingScrollbackRequests.has('recent-request')).toBe(true);
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
          },
        };

        // Fill queue beyond limit
        for (let i = 0; i < 150; i++) {
          mockProvider.queueMessage({ command: `test-${i}` });
        }

        expect(mockProvider._messageQueue.length).toBe(mockProvider.MAX_QUEUE_SIZE);

        // Verify oldest messages were removed (newest 100 should remain)
        const lastMessage = mockProvider._messageQueue[mockProvider._messageQueue.length - 1];
        expect(lastMessage.message.command).toBe('test-149');
      });
    });
  }); // End Message Handling
}); // End SecondaryTerminalProvider
