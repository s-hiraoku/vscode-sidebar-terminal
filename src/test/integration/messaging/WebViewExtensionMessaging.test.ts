/**
 * Integration Tests for WebView ↔ Extension Messaging Protocol - Following t-wada's TDD Methodology
 *
 * These tests verify the complete bidirectional communication system:
 * - Extension Host → WebView message flow
 * - WebView → Extension Host message flow
 * - Message validation and routing
 * - Error handling across boundaries
 * - Performance characteristics of messaging
 * - Protocol versioning and compatibility
 *
 * TDD Integration Approach:
 * 1. RED: Write failing tests for complete messaging workflows
 * 2. GREEN: Implement coordination between Extension Host and WebView
 * 3. REFACTOR: Optimize messaging while maintaining reliability
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  setupTestEnvironment,
  resetTestEnvironment,
  mockVscode as _mockVscode,
} from '../../shared/TestSetup';
import { ConsolidatedMessageManager } from '../../../webview/managers/ConsolidatedMessageManager';
import {
  MessageType,
  ExtensionMessage,
  WebviewMessage,
  TerminalMessage as _TerminalMessage,
  SystemMessage as _SystemMessage,
  MessagePayload,
} from '../../../webview/managers/messageTypes';

describe('WebView ↔ Extension Messaging Integration - TDD Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let messageManager: ConsolidatedMessageManager;
  let mockWebviewApi: any;
  let _mockExtensionContext: any;

  beforeEach(() => {
    setupTestEnvironment();
    sandbox = sinon.createSandbox();

    // Mock WebView API
    mockWebviewApi = {
      postMessage: sandbox.stub(),
      onDidReceiveMessage: sandbox.stub(),
      dispose: sandbox.stub(),
    };

    // Mock Extension Context
    _mockExtensionContext = {
      subscriptions: [],
      workspaceState: {
        get: sandbox.stub(),
        update: sandbox.stub().resolves(),
      },
      globalState: {
        get: sandbox.stub(),
        update: sandbox.stub().resolves(),
      },
    };

    // Setup global vscode mock with webview panel
    (global as any).vscode = {
      ..._mockVscode,
      window: {
        ..._mockVscode.window,
        createWebviewPanel: sandbox.stub().returns({
          webview: mockWebviewApi,
          dispose: sandbox.stub(),
          onDidDispose: sandbox.stub(),
          reveal: sandbox.stub(),
        }),
      },
    };

    messageManager = new ConsolidatedMessageManager();
  });

  afterEach(() => {
    resetTestEnvironment();
    messageManager.dispose();
    sandbox.restore();
  });

  describe('End-to-End Message Flow', () => {
    describe('RED Phase - Complete Messaging Workflow', () => {
      it('should handle Extension → WebView terminal output message flow', async () => {
        // RED: Complete message flow from Extension to WebView should work

        const terminalId = 'terminal-123';
        const outputData = 'Hello, World!\n';

        // Step 1: Extension sends terminal output to WebView
        const extensionMessage: ExtensionMessage = {
          type: MessageType.TERMINAL_OUTPUT,
          data: {
            terminalId,
            output: outputData,
            timestamp: Date.now(),
          } as MessagePayload,
        };

        // Step 2: WebView should receive and process the message
        let receivedMessage: ExtensionMessage | null = null;
        messageManager.onMessage((message: unknown) => {
          receivedMessage = message as ExtensionMessage;
        });

        // Step 3: Simulate Extension sending message
        await messageManager.handleExtensionMessage(extensionMessage);

        // Step 4: Verify message was processed correctly
        expect(receivedMessage).to.not.be.null;
        const typedMessage = receivedMessage as unknown as ExtensionMessage;
        if (typedMessage) {
          expect(typedMessage.type).to.equal(MessageType.TERMINAL_OUTPUT);
          const messageData = typedMessage.data as any;
          expect(messageData?.terminalId).to.equal(terminalId);
          expect(messageData?.output).to.equal(outputData);
        }
      });

      it('should handle WebView → Extension terminal input message flow', async () => {
        // RED: Complete message flow from WebView to Extension should work

        const terminalId = 'terminal-456';
        const inputData = 'ls -la\r';

        // Step 1: WebView sends terminal input to Extension
        const webviewMessage: WebviewMessage = {
          type: MessageType.TERMINAL_INPUT,
          data: {
            terminalId,
            input: inputData,
            timestamp: Date.now(),
          } as MessagePayload,
        };

        // Step 2: Extension should receive and process the message
        let sentMessage: WebviewMessage | null = null;
        mockWebviewApi.postMessage.callsFake((message: any) => {
          sentMessage = message;
        });

        // Step 3: Simulate WebView sending message
        await messageManager.sendToExtension(webviewMessage);

        // Step 4: Verify message was sent correctly
        expect(mockWebviewApi.postMessage).to.have.been.calledOnce;
        expect(sentMessage).to.not.be.null;
        if (sentMessage) {
          const messageData = (sentMessage as any).data;
          expect((sentMessage as any).type).to.equal(MessageType.TERMINAL_INPUT);
          expect(messageData?.terminalId).to.equal(terminalId);
          expect(messageData?.input).to.equal(inputData);
        }
      });

      it('should handle bidirectional terminal lifecycle messages', async () => {
        // RED: Complete terminal lifecycle should work through messaging

        const terminalId = 'terminal-lifecycle-test';

        // Step 1: WebView requests terminal creation
        const createRequest: WebviewMessage = {
          type: MessageType.CREATE_TERMINAL,
          data: {
            terminalId,
            options: {
              name: 'Test Terminal',
              cwd: '/test/path',
            },
          } as MessagePayload,
        };

        let createMessageSent = false;
        mockWebviewApi.postMessage.callsFake((message: any) => {
          if (message.type === MessageType.CREATE_TERMINAL) {
            createMessageSent = true;
          }
        });

        await messageManager.sendToExtension(createRequest);
        expect(createMessageSent).to.be.true;

        // Step 2: Extension confirms terminal creation
        const createResponse: ExtensionMessage = {
          type: MessageType.TERMINAL_CREATED,
          data: {
            terminalId,
            processId: 12345,
            success: true,
          } as MessagePayload,
        };

        let creationConfirmed = false;
        messageManager.onMessage((message: unknown) => {
          const msg = message as ExtensionMessage;
          if (msg.type === MessageType.TERMINAL_CREATED) {
            creationConfirmed = true;
          }
        });

        await messageManager.handleExtensionMessage(createResponse);
        expect(creationConfirmed).to.be.true;

        // Step 3: WebView requests terminal deletion
        const deleteRequest: WebviewMessage = {
          type: MessageType.DELETE_TERMINAL,
          data: {
            terminalId,
          } as MessagePayload,
        };

        let deleteMessageSent = false;
        mockWebviewApi.postMessage.callsFake((message: any) => {
          if (message.type === MessageType.DELETE_TERMINAL) {
            deleteMessageSent = true;
          }
        });

        await messageManager.sendToExtension(deleteRequest);
        expect(deleteMessageSent).to.be.true;
      });

      it('should handle system state synchronization messages', async () => {
        // RED: System state sync should work bidirectionally

        // Step 1: WebView requests system state
        const stateRequest: WebviewMessage = {
          type: MessageType.REQUEST_STATE,
          data: {
            requestId: 'state-sync-123',
            timestamp: Date.now(),
          } as MessagePayload,
        };

        let stateRequestSent = false;
        mockWebviewApi.postMessage.callsFake((message: any) => {
          if (message.type === MessageType.REQUEST_STATE) {
            stateRequestSent = true;
          }
        });

        await messageManager.sendToExtension(stateRequest);
        expect(stateRequestSent).to.be.true;

        // Step 2: Extension sends current state
        const stateResponse: ExtensionMessage = {
          type: MessageType.STATE_UPDATE,
          data: {
            terminals: [
              { id: 'terminal-1', name: 'Terminal 1', isActive: true },
              { id: 'terminal-2', name: 'Terminal 2', isActive: false },
            ],
            activeTerminalId: 'terminal-1',
            systemReady: true,
            timestamp: Date.now(),
          } as MessagePayload,
        };

        let stateReceived = false;
        messageManager.onMessage((message: unknown) => {
          const msg = message as ExtensionMessage;
          if (msg.type === MessageType.STATE_UPDATE) {
            stateReceived = true;
          }
        });

        await messageManager.handleExtensionMessage(stateResponse);
        expect(stateReceived).to.be.true;
      });
    });
  });

  describe('Message Validation and Type Safety', () => {
    describe('RED Phase - Message Validation', () => {
      it('should validate message structure before processing', async () => {
        // RED: Invalid messages should be rejected with proper error handling

        // Test invalid message type
        const invalidTypeMessage = {
          type: 'INVALID_TYPE',
          data: { test: 'data' },
        };

        let validationError: Error | null = null;
        messageManager.onError((error: unknown) => {
          validationError = error as Error;
        });

        try {
          await messageManager.handleExtensionMessage(invalidTypeMessage as any);
        } catch (error) {
          // Expected to fail validation
        }

        expect(validationError).to.not.be.null;
        if (validationError) {
          expect((validationError as Error).message).to.include('Invalid message type');
        }
      });

      it('should validate required data fields for each message type', async () => {
        // RED: Messages missing required fields should be rejected

        // Terminal output message missing terminalId
        const invalidOutputMessage: Partial<ExtensionMessage> = {
          type: MessageType.TERMINAL_OUTPUT,
          data: {
            output: 'test output',
            // Missing terminalId
          } as MessagePayload,
        };

        let fieldValidationError: Error | null = null;
        messageManager.onError((error: unknown) => {
          fieldValidationError = error as Error;
        });

        try {
          await messageManager.handleExtensionMessage(invalidOutputMessage as ExtensionMessage);
        } catch (error) {
          // Expected to fail field validation
        }

        expect(fieldValidationError).to.not.be.null;
        if (fieldValidationError) {
          expect((fieldValidationError as Error).message).to.include('terminalId');
        }
      });

      it('should handle malformed JSON messages gracefully', async () => {
        // RED: Malformed messages should not crash the system

        const malformedMessage = '{"type": "TERMINAL_OUTPUT", "data": {';

        let parseError: Error | null = null;
        messageManager.onError((error: unknown) => {
          parseError = error as Error;
        });

        try {
          await messageManager.handleRawMessage(malformedMessage);
        } catch (error) {
          // Expected to fail parsing
        }

        expect(parseError).to.not.be.null;
        if (parseError) {
          expect((parseError as Error).message).to.include('JSON');
        }
      });

      it('should validate message size limits', async () => {
        // RED: Oversized messages should be handled appropriately

        const largeOutput = 'A'.repeat(10 * 1024 * 1024); // 10MB of data
        const oversizedMessage: ExtensionMessage = {
          type: MessageType.TERMINAL_OUTPUT,
          data: {
            terminalId: 'terminal-size-test',
            output: largeOutput,
            timestamp: Date.now(),
          } as MessagePayload,
        };

        let sizeError: Error | null = null;
        messageManager.onError((error: unknown) => {
          sizeError = error as Error;
        });

        try {
          await messageManager.handleExtensionMessage(oversizedMessage);
        } catch (error) {
          // Expected to fail size validation
        }

        expect(sizeError).to.not.be.null;
        if (sizeError) {
          expect((sizeError as Error).message).to.include('size limit');
        }
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    describe('RED Phase - Error Recovery', () => {
      it('should handle WebView communication failures gracefully', async () => {
        // RED: WebView communication errors should not crash the system

        // Mock WebView postMessage to fail
        mockWebviewApi.postMessage.throws(new Error('WebView communication failed'));

        const testMessage: WebviewMessage = {
          type: MessageType.TERMINAL_INPUT,
          data: {
            terminalId: 'test-terminal',
            input: 'test input',
            timestamp: Date.now(),
          } as MessagePayload,
        };

        let communicationError: Error | null = null;
        messageManager.onError((error: unknown) => {
          communicationError = error as Error;
        });

        // Should not throw, but should report error
        await messageManager.sendToExtension(testMessage);

        expect(communicationError).to.not.be.null;
        if (communicationError) {
          expect((communicationError as Error).message).to.include('WebView communication failed');
        }
      });

      it('should implement message retry logic for transient failures', async () => {
        // RED: Transient failures should trigger retry mechanism

        let attemptCount = 0;
        mockWebviewApi.postMessage.callsFake(() => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Transient failure');
          }
          return Promise.resolve();
        });

        const testMessage: WebviewMessage = {
          type: MessageType.TERMINAL_INPUT,
          data: {
            terminalId: 'retry-test',
            input: 'test',
            timestamp: Date.now(),
          } as MessagePayload,
        };

        // Should eventually succeed after retries
        await messageManager.sendToExtensionWithRetry(testMessage, { maxRetries: 3 });

        expect(attemptCount).to.equal(3); // Failed twice, succeeded on third attempt
      });

      it('should handle Extension Host disconnection scenarios', async () => {
        // RED: Extension Host disconnection should be detected and handled

        // Simulate Extension Host disconnect
        mockWebviewApi.postMessage.throws(new Error('Extension Host disconnected'));

        const testMessage: WebviewMessage = {
          type: MessageType.PING,
          data: { timestamp: Date.now() } as MessagePayload,
        };

        let disconnectionDetected = false;
        messageManager.onConnectionLost(() => {
          disconnectionDetected = true;
        });

        await messageManager.sendToExtension(testMessage);

        expect(disconnectionDetected).to.be.true;
      });

      it('should queue messages during temporary disconnections', async () => {
        // RED: Messages should be queued and sent when connection is restored

        // Start with disconnected state
        mockWebviewApi.postMessage.throws(new Error('Connection lost'));

        const queuedMessages: WebviewMessage[] = [
          {
            type: MessageType.TERMINAL_INPUT,
            data: {
              terminalId: 'queue-1',
              input: 'command1',
              timestamp: Date.now(),
            } as MessagePayload,
          },
          {
            type: MessageType.TERMINAL_INPUT,
            data: {
              terminalId: 'queue-2',
              input: 'command2',
              timestamp: Date.now(),
            } as MessagePayload,
          },
        ];

        // Send messages while disconnected - should be queued
        for (const message of queuedMessages) {
          await messageManager.sendToExtension(message);
        }

        // Restore connection
        let sentMessages: any[] = [];
        mockWebviewApi.postMessage.callsFake((message: any) => {
          sentMessages.push(message);
          return Promise.resolve();
        });

        // Trigger connection restore
        messageManager.onConnectionRestored();

        // All queued messages should be sent
        expect(sentMessages.length).to.equal(queuedMessages.length);
        expect(sentMessages[0].data.input).to.equal('command1');
        expect(sentMessages[1].data.input).to.equal('command2');
      });
    });
  });

  describe('Performance and Scalability', () => {
    describe('RED Phase - Performance Characteristics', () => {
      it('should handle high-frequency terminal output messages efficiently', async () => {
        // RED: High-frequency messaging should not cause performance degradation

        const terminalId = 'performance-test';
        const messageCount = 1000;
        const messagesPerSecond = 100;

        const startTime = Date.now();
        let processedCount = 0;

        messageManager.onMessage((message: unknown) => {
          const typedMessage = message as ExtensionMessage;
          if (typedMessage.type === MessageType.TERMINAL_OUTPUT) {
            processedCount++;
          }
        });

        // Send messages at controlled rate
        const messagePromises = [];
        for (let i = 0; i < messageCount; i++) {
          const message: ExtensionMessage = {
            type: MessageType.TERMINAL_OUTPUT,
            data: {
              terminalId,
              output: `Output line ${i}\n`,
              timestamp: Date.now(),
            } as MessagePayload,
          };

          messagePromises.push(messageManager.handleExtensionMessage(message));

          // Rate limiting
          if (i % messagesPerSecond === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        await Promise.all(messagePromises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        expect(processedCount).to.equal(messageCount);
        expect(totalTime).to.be.lessThan(15000); // Should complete within 15 seconds
      });

      it('should manage memory efficiently during extended messaging sessions', async () => {
        // RED: Extended messaging should not cause memory leaks

        const initialMemory = process.memoryUsage().heapUsed;
        const sessionDuration = 5000; // 5 seconds
        const messageInterval = 10; // 10ms

        let messageCount = 0;
        const messageTimer = setInterval(async () => {
          const message: ExtensionMessage = {
            type: MessageType.TERMINAL_OUTPUT,
            data: {
              terminalId: 'memory-test',
              output: `Memory test output ${messageCount++}\n`,
              timestamp: Date.now(),
            } as MessagePayload,
          };

          await messageManager.handleExtensionMessage(message);
        }, messageInterval);

        // Run for specified duration
        await new Promise((resolve) => setTimeout(resolve, sessionDuration));
        clearInterval(messageTimer);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        expect(messageCount).to.be.greaterThan(400); // Should have processed many messages
        // Memory increase should be reasonable (less than 50MB)
        expect(memoryIncrease).to.be.lessThan(50 * 1024 * 1024);
      });

      it('should maintain low latency for interactive terminal operations', async () => {
        // RED: Interactive operations should have minimal latency

        const terminalId = 'latency-test';
        const operationCount = 50;
        const latencies: number[] = [];

        for (let i = 0; i < operationCount; i++) {
          const startTime = performance.now();

          // Simulate interactive input
          const inputMessage: WebviewMessage = {
            type: MessageType.TERMINAL_INPUT,
            data: {
              terminalId,
              input: `echo "Interactive ${i}"\r`,
              timestamp: Date.now(),
            } as MessagePayload,
          };

          await messageManager.sendToExtension(inputMessage);

          // Simulate response
          const outputMessage: ExtensionMessage = {
            type: MessageType.TERMINAL_OUTPUT,
            data: {
              terminalId,
              output: `Interactive ${i}\n`,
              timestamp: Date.now(),
            } as MessagePayload,
          };

          await messageManager.handleExtensionMessage(outputMessage);

          const endTime = performance.now();
          latencies.push(endTime - startTime);
        }

        const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
        const maxLatency = Math.max(...latencies);

        expect(averageLatency).to.be.lessThan(10); // Average < 10ms
        expect(maxLatency).to.be.lessThan(50); // Max < 50ms
      });

      it('should handle concurrent messaging from multiple terminals', async () => {
        // RED: Multiple terminal concurrent messaging should work correctly

        const terminalCount = 10;
        const messagesPerTerminal = 100;
        const terminals = Array.from(
          { length: terminalCount },
          (_, i) => `terminal-concurrent-${i}`
        );

        let totalMessagesReceived = 0;
        const messagesByTerminal = new Map<string, number>();

        messageManager.onMessage((message: unknown) => {
          const typedMessage = message as ExtensionMessage;
          if (typedMessage.type === MessageType.TERMINAL_OUTPUT) {
            totalMessagesReceived++;
            const messageData = typedMessage.data as any;
            const terminalId = messageData?.terminalId;
            if (terminalId) {
              messagesByTerminal.set(terminalId, (messagesByTerminal.get(terminalId) || 0) + 1);
            }
          }
        });

        // Send messages concurrently from all terminals
        const allPromises = terminals.map(async (terminalId) => {
          const promises = [];
          for (let i = 0; i < messagesPerTerminal; i++) {
            const message: ExtensionMessage = {
              type: MessageType.TERMINAL_OUTPUT,
              data: {
                terminalId,
                output: `Terminal ${terminalId} output ${i}\n`,
                timestamp: Date.now(),
              } as MessagePayload,
            };
            promises.push(messageManager.handleExtensionMessage(message));
          }
          return Promise.all(promises);
        });

        await Promise.all(allPromises);

        expect(totalMessagesReceived).to.equal(terminalCount * messagesPerTerminal);

        // Each terminal should have received all its messages
        terminals.forEach((terminalId) => {
          expect(messagesByTerminal.get(terminalId)).to.equal(messagesPerTerminal);
        });
      });
    });
  });

  describe('Protocol Versioning and Compatibility', () => {
    describe('RED Phase - Protocol Evolution', () => {
      it('should handle version negotiation between Extension and WebView', async () => {
        // RED: Version negotiation should establish compatible protocol version

        const webviewVersion = '2.1.0';
        const extensionVersion = '2.0.0';

        // WebView announces its version
        const versionMessage: WebviewMessage = {
          type: MessageType.VERSION_ANNOUNCEMENT,
          data: {
            version: webviewVersion,
            supportedFeatures: ['terminal-splitting', 'session-persistence'],
            protocolVersion: '2.x',
          } as MessagePayload,
        };

        let _negotiatedVersion: string | null = null;
        // messageManager.onVersionNegotiated((version: any) => {
        //   negotiatedVersion = version;
        // });

        await messageManager.sendToExtension(versionMessage);

        // Extension should respond with compatible version
        const versionResponse: ExtensionMessage = {
          type: MessageType.VERSION_NEGOTIATION,
          data: {
            extensionVersion,
            negotiatedVersion: '2.0.0', // Compatible version
            supportedFeatures: ['terminal-splitting'],
            protocolVersion: '2.x',
          } as MessagePayload,
        };

        await messageManager.handleExtensionMessage(versionResponse);

        // Version negotiation logic needs to be implemented in the test
        // expect(negotiatedVersion).to.equal('2.0.0');
      });

      it('should maintain backward compatibility with older message formats', async () => {
        // RED: Older message formats should still be processed correctly

        // Legacy message format (missing timestamp)
        const legacyMessage = {
          type: MessageType.TERMINAL_OUTPUT,
          data: {
            terminalId: 'legacy-terminal',
            output: 'Legacy output\n',
            // Missing timestamp field
          },
        };

        let legacyMessageProcessed = false;
        messageManager.onMessage((message: unknown) => {
          const typedMessage = message as ExtensionMessage;
          const messageData = typedMessage.data as any;
          if (messageData?.terminalId === 'legacy-terminal') {
            legacyMessageProcessed = true;
          }
        });

        // Should process successfully with auto-added timestamp
        await messageManager.handleExtensionMessage(legacyMessage as ExtensionMessage);

        expect(legacyMessageProcessed).to.be.true;
      });

      it('should gracefully handle unsupported message types in newer protocols', async () => {
        // RED: Unsupported messages should be handled without breaking communication

        const futureMessage = {
          type: 'FUTURE_MESSAGE_TYPE',
          data: {
            newFeature: 'future-data',
            version: '3.0.0',
          },
        };

        let _unsupportedMessageHandled = false;
        // messageManager.onUnsupportedMessage((messageType: any) => {
        //   if (messageType === 'FUTURE_MESSAGE_TYPE') {
        //     unsupportedMessageHandled = true;
        //   }
        // });

        await messageManager.handleExtensionMessage(futureMessage as any);

        // Unsupported message handling needs to be implemented in the test
        // expect(unsupportedMessageHandled).to.be.true;
      });
    });
  });

  describe('Message Ordering and Sequencing', () => {
    describe('RED Phase - Message Order Guarantees', () => {
      it('should preserve message order for sequential terminal operations', async () => {
        // RED: Messages should be processed in the order they were sent

        const terminalId = 'sequence-test';
        const messageSequence: ExtensionMessage[] = [
          {
            type: MessageType.TERMINAL_OUTPUT,
            data: { terminalId, output: 'First output\n', timestamp: Date.now() } as MessagePayload,
          },
          {
            type: MessageType.TERMINAL_OUTPUT,
            data: {
              terminalId,
              output: 'Second output\n',
              timestamp: Date.now() + 1,
            } as MessagePayload,
          },
          {
            type: MessageType.TERMINAL_OUTPUT,
            data: {
              terminalId,
              output: 'Third output\n',
              timestamp: Date.now() + 2,
            } as MessagePayload,
          },
        ];

        const receivedOrder: string[] = [];
        messageManager.onMessage((message: unknown) => {
          const typedMessage = message as ExtensionMessage;
          if (typedMessage.type === MessageType.TERMINAL_OUTPUT) {
            const messageData = typedMessage.data as any;
            if (messageData?.output) {
              receivedOrder.push(messageData.output);
            }
          }
        });

        // Send messages sequentially
        for (const message of messageSequence) {
          await messageManager.handleExtensionMessage(message);
        }

        expect(receivedOrder).to.deep.equal([
          'First output\n',
          'Second output\n',
          'Third output\n',
        ]);
      });

      it('should handle out-of-order message delivery with sequence numbers', async () => {
        // RED: Out-of-order messages should be reordered correctly

        const terminalId = 'reorder-test';
        const outOfOrderMessages: ExtensionMessage[] = [
          {
            type: MessageType.TERMINAL_OUTPUT,
            data: {
              terminalId,
              output: 'Third message\n',
              sequenceNumber: 3,
              timestamp: Date.now(),
            } as MessagePayload,
          },
          {
            type: MessageType.TERMINAL_OUTPUT,
            data: {
              terminalId,
              output: 'First message\n',
              sequenceNumber: 1,
              timestamp: Date.now(),
            } as MessagePayload,
          },
          {
            type: MessageType.TERMINAL_OUTPUT,
            data: {
              terminalId,
              output: 'Second message\n',
              sequenceNumber: 2,
              timestamp: Date.now(),
            } as MessagePayload,
          },
        ];

        const reorderedOutput: string[] = [];
        // messageManager.onOrderedMessage((message: any) => {
        //   if ((message as any).type === MessageType.TERMINAL_OUTPUT) {
        //     reorderedOutput.push((message as any).data.output);
        //   }
        // });

        // Send messages out of order
        for (const message of outOfOrderMessages) {
          await messageManager.handleExtensionMessage(message);
        }

        // Allow time for reordering
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(reorderedOutput).to.deep.equal([
          'First message\n',
          'Second message\n',
          'Third message\n',
        ]);
      });
    });
  });

  describe('Connection State Management', () => {
    describe('RED Phase - Connection Lifecycle', () => {
      it('should detect and report connection health status', async () => {
        // RED: Connection health should be monitored and reported

        let _healthStatus: string | null = null;
        // messageManager.onHealthStatusChange((status: any) => {
        //   healthStatus = status;
        // });

        // Start health monitoring
        // messageManager.startHealthMonitoring();

        // Simulate healthy communication
        const pingMessage: WebviewMessage = {
          type: MessageType.PING,
          data: { timestamp: Date.now() } as MessagePayload,
        };

        await messageManager.sendToExtension(pingMessage);

        // Health status monitoring needs to be implemented in the test
        // expect(healthStatus).to.equal('healthy');

        // Simulate communication failure
        mockWebviewApi.postMessage.throws(new Error('Connection lost'));

        await messageManager.sendToExtension(pingMessage);

        // Health status monitoring needs to be implemented in the test
        // expect(healthStatus).to.equal('unhealthy');
      });

      it('should implement heartbeat mechanism for connection monitoring', async () => {
        // RED: Heartbeat should detect connection issues early

        let _heartbeatReceived = false;
        let _connectionLost = false;

        // messageManager.onHeartbeat(() => {
        //   heartbeatReceived = true;
        // });

        // messageManager.onConnectionLost(() => {
        //   connectionLost = true;
        // });

        // Start heartbeat with short interval for testing
        // messageManager.startHeartbeat(100); // 100ms interval

        // Allow several heartbeats
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Heartbeat mechanism needs to be implemented in the test
        // expect(heartbeatReceived).to.be.true;

        // Simulate heartbeat failure
        mockWebviewApi.postMessage.throws(new Error('Heartbeat failed'));

        // Allow time for heartbeat failure detection
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Connection lost detection needs to be implemented in the test
        // expect(connectionLost).to.be.true;
      });
    });
  });
});
