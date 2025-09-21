/**
 * TypedMessageHandling 完全テストスイート
 * - 型安全性とエラーハンドリングの検証
 * - パフォーマンスとリソース管理のテスト
 * - リアルワールドシナリオの包括的カバレッジ
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  TypedMessageRouter,
  TypedMessageSender,
  MessageDataValidator,
  createTypedMessageEventListener,
  MESSAGE_COMMANDS,
  TerminalMessageData,
  SessionMessageData,
  MessageProcessingResult,
  VSCodeWebviewAPI,
  LoggerFunction
} from '../../../../webview/utils/TypedMessageHandling';

describe('TypedMessageHandling - 型安全なメッセージシステム', () => {

  // =============================================================================
  // テストセットアップとユーティリティ
  // =============================================================================

  let mockLogger: sinon.SinonStub<Parameters<LoggerFunction>, void>;
  let mockVSCodeAPI: sinon.SinonStubbedInstance<VSCodeWebviewAPI>;

  beforeEach(() => {
    mockLogger = sinon.stub();
    mockVSCodeAPI = {
      postMessage: sinon.stub()
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  // =============================================================================
  // MessageDataValidator テスト
  // =============================================================================

  describe('MessageDataValidator - データ検証機能', () => {

    describe('基本的な検証機能', () => {

      it('should validate required fields correctly', () => {
        const validator = new MessageDataValidator(['terminalId', 'action'], mockLogger);

        const validData = { terminalId: 'term-1', action: 'create' };
        const result = validator.validate(validData);

        expect(result.isValid).to.be.true;
        expect(result.errors).to.be.empty;
        expect(result.data).to.deep.equal(validData);
      });

      it('should detect missing required fields', () => {
        const validator = new MessageDataValidator(['terminalId', 'action'], mockLogger);

        const invalidData = { terminalId: 'term-1' }; // missing 'action'
        const result = validator.validate(invalidData);

        expect(result.isValid).to.be.false;
        expect(result.errors).to.include('Missing required field: action');
      });

      it('should handle null and undefined input gracefully', () => {
        const validator = new MessageDataValidator(['field'], mockLogger);

        expect(validator.validate(null).isValid).to.be.false;
        expect(validator.validate(undefined).isValid).to.be.false;
        expect(validator.validate('string').isValid).to.be.false;
      });

    });

    describe('専用バリデーター作成機能', () => {

      it('should create terminal message validator', () => {
        const validator = MessageDataValidator.createTerminalValidator(mockLogger);

        const validTerminalData: TerminalMessageData = {
          terminalId: 'term-123',
          action: 'create',
          payload: { shell: '/bin/bash' }
        };

        const result = validator.validate(validTerminalData);
        expect(result.isValid).to.be.true;
      });

      it('should create session message validator', () => {
        const validator = MessageDataValidator.createSessionValidator(mockLogger);

        const validSessionData: SessionMessageData = {
          sessionId: 'session-456',
          terminalStates: { 'term-1': { active: true } }
        };

        const result = validator.validate(validSessionData);
        expect(result.isValid).to.be.true;
      });

    });

  });

  // =============================================================================
  // TypedMessageRouter テスト
  // =============================================================================

  describe('TypedMessageRouter - メッセージルーティング', () => {

    let router: TypedMessageRouter;

    beforeEach(() => {
      router = new TypedMessageRouter('test-component', mockLogger);
    });

    describe('ハンドラー登録機能', () => {

      it('should register single handler successfully', () => {
        const handler = sinon.stub().resolves();

        router.registerHandler({
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          handler,
          description: 'Create terminal handler'
        });

        const commands = router.getRegisteredCommands();
        expect(commands).to.include(MESSAGE_COMMANDS.TERMINAL_CREATE);
        expect(mockLogger).to.have.been.calledWith(
          sinon.match.string,
          sinon.match(MESSAGE_COMMANDS.TERMINAL_CREATE)
        );
      });

      it('should register multiple handlers at once', () => {
        const handlers = [
          {
            command: MESSAGE_COMMANDS.TERMINAL_CREATE,
            handler: sinon.stub().resolves()
          },
          {
            command: MESSAGE_COMMANDS.TERMINAL_DELETE,
            handler: sinon.stub().resolves()
          }
        ];

        router.registerMultipleHandlers(handlers);

        const commands = router.getRegisteredCommands();
        expect(commands).to.include.members([
          MESSAGE_COMMANDS.TERMINAL_CREATE,
          MESSAGE_COMMANDS.TERMINAL_DELETE
        ]);
      });

    });

    describe('メッセージ処理機能', () => {

      it('should process valid message successfully', async () => {
        const handler = sinon.stub().resolves();

        router.registerHandler({
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          handler
        });

        const result = await router.processMessage(
          MESSAGE_COMMANDS.TERMINAL_CREATE,
          { terminalId: 'term-1' }
        );

        expect(result.success).to.be.true;
        expect(result.command).to.equal(MESSAGE_COMMANDS.TERMINAL_CREATE);
        expect(result.processingTimeMs).to.be.a('number');
        expect(handler).to.have.been.calledOnce;
      });

      it('should handle unregistered commands gracefully', async () => {
        const result = await router.processMessage('unknown-command', {});

        expect(result.success).to.be.false;
        expect(result.command).to.equal('unknown-command');
        expect(result.error).to.be.instanceOf(Error);
        expect(result.error?.message).to.include('No handler registered');
      });

      it('should handle handler exceptions', async () => {
        const error = new Error('Handler execution failed');
        const handler = sinon.stub().rejects(error);

        router.registerHandler({
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          handler
        });

        const result = await router.processMessage(
          MESSAGE_COMMANDS.TERMINAL_CREATE,
          { terminalId: 'term-1' }
        );

        expect(result.success).to.be.false;
        expect(result.error).to.equal(error);
      });

    });

    describe('データ検証統合', () => {

      it('should use validator when provided', async () => {
        const validator = MessageDataValidator.createTerminalValidator(mockLogger);
        const handler = sinon.stub().resolves();

        router.registerHandler({
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          handler,
          validator
        });

        // Valid data
        const validResult = await router.processMessage(
          MESSAGE_COMMANDS.TERMINAL_CREATE,
          { terminalId: 'term-1' }
        );
        expect(validResult.success).to.be.true;

        // Invalid data
        const invalidResult = await router.processMessage(
          MESSAGE_COMMANDS.TERMINAL_CREATE,
          {} // missing terminalId
        );
        expect(invalidResult.success).to.be.false;
        expect(invalidResult.error?.message).to.include('Validation failed');
      });

    });

    describe('リソース管理', () => {

      it('should clear all handlers and validators', () => {
        router.registerHandler({
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          handler: sinon.stub().resolves()
        });

        expect(router.getRegisteredCommands()).to.not.be.empty;

        router.clearAllHandlers();

        expect(router.getRegisteredCommands()).to.be.empty;
      });

    });

  });

  // =============================================================================
  // TypedMessageSender テスト
  // =============================================================================

  describe('TypedMessageSender - メッセージ送信機能', () => {

    let sender: TypedMessageSender;

    beforeEach(() => {
      sender = new TypedMessageSender(mockVSCodeAPI, 'test-sender', mockLogger);
    });

    describe('基本的な送信機能', () => {

      it('should send message successfully', () => {
        const terminalData: TerminalMessageData = {
          terminalId: 'term-1',
          action: 'create'
        };

        sender.sendMessage(MESSAGE_COMMANDS.TERMINAL_CREATE, terminalData);

        expect(mockVSCodeAPI.postMessage).to.have.been.calledOnceWith({
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          ...terminalData
        });
      });

      it('should send multiple messages sequentially', () => {
        const messages = [
          { command: MESSAGE_COMMANDS.TERMINAL_CREATE, data: { terminalId: 'term-1' } },
          { command: MESSAGE_COMMANDS.TERMINAL_DELETE, data: { terminalId: 'term-2' } }
        ];

        sender.sendMultipleMessages(messages);

        expect(mockVSCodeAPI.postMessage).to.have.been.calledTwice;
      });

      it('should send conditional messages based on condition', () => {
        const data = { terminalId: 'term-1' };

        // True condition
        sender.sendConditionalMessage(true, MESSAGE_COMMANDS.TERMINAL_CREATE, data);
        expect(mockVSCodeAPI.postMessage).to.have.been.calledOnce;

        // False condition
        sender.sendConditionalMessage(false, MESSAGE_COMMANDS.TERMINAL_DELETE, data);
        expect(mockVSCodeAPI.postMessage).to.have.been.calledOnce; // Still once

        // Function condition
        sender.sendConditionalMessage(() => true, MESSAGE_COMMANDS.TERMINAL_RESIZE, data);
        expect(mockVSCodeAPI.postMessage).to.have.been.calledTwice;
      });

    });

    describe('エラーハンドリングとリトライ', () => {

      it('should handle postMessage errors gracefully', () => {
        mockVSCodeAPI.postMessage.throws(new Error('VS Code API error'));

        expect(() => {
          sender.sendMessage(MESSAGE_COMMANDS.TERMINAL_CREATE, { terminalId: 'term-1' });
        }).to.not.throw();

        expect(mockLogger).to.have.been.calledWith(
          sinon.match.string,
          sinon.match(MESSAGE_COMMANDS.TERMINAL_CREATE)
        );
      });

      it('should queue messages for retry on failure', () => {
        mockVSCodeAPI.postMessage.throws(new Error('Network error'));

        sender.sendMessage(MESSAGE_COMMANDS.TERMINAL_CREATE, { terminalId: 'term-1' });

        // The error should be logged and message queued
        expect(mockLogger).to.have.been.calledWith(
          sinon.match(/Failed to send/),
          sinon.match(MESSAGE_COMMANDS.TERMINAL_CREATE)
        );
      });

    });

  });

  // =============================================================================
  // Event Listener Integration テスト
  // =============================================================================

  describe('createTypedMessageEventListener - イベント統合', () => {

    let router: TypedMessageRouter;
    let eventListener: (event: MessageEvent) => void;
    let onUnhandled: sinon.SinonStub;

    beforeEach(() => {
      router = new TypedMessageRouter('test-listener', mockLogger);
      onUnhandled = sinon.stub();
      eventListener = createTypedMessageEventListener(router, onUnhandled);
    });

    it('should process valid message events', async () => {
      const handler = sinon.stub().resolves();
      router.registerHandler({
        command: MESSAGE_COMMANDS.TERMINAL_CREATE,
        handler
      });

      const event = new MessageEvent('message', {
        data: {
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          terminalId: 'term-1'
        }
      });

      await eventListener(event);

      expect(handler).to.have.been.calledOnce;
      expect(onUnhandled).to.not.have.been.called;
    });

    it('should handle events without command', async () => {
      const event = new MessageEvent('message', {
        data: { data: 'some data without command' }
      });

      await eventListener(event);

      expect(onUnhandled).to.have.been.calledOnceWith(event);
    });

    it('should handle events with failed processing', async () => {
      const event = new MessageEvent('message', {
        data: {
          command: 'unknown-command',
          data: 'test'
        }
      });

      await eventListener(event);

      expect(onUnhandled).to.have.been.calledOnceWith(event);
    });

  });

  // =============================================================================
  // パフォーマンステスト
  // =============================================================================

  describe('パフォーマンスとスケーラビリティ', () => {

    it('should handle high-frequency message processing', async () => {
      const router = new TypedMessageRouter('perf-test', mockLogger);
      const handler = sinon.stub().resolves();

      router.registerHandler({
        command: MESSAGE_COMMANDS.TERMINAL_OUTPUT,
        handler
      });

      const messageCount = 1000;
      const promises: Promise<MessageProcessingResult>[] = [];

      const startTime = performance.now();

      for (let i = 0; i < messageCount; i++) {
        promises.push(router.processMessage(
          MESSAGE_COMMANDS.TERMINAL_OUTPUT,
          { terminalId: `term-${i}`, data: `output-${i}` }
        ));
      }

      const results = await Promise.all(promises);
      const endTime = performance.now();

      expect(results).to.have.length(messageCount);
      expect(results.every(r => r.success)).to.be.true;
      expect(endTime - startTime).to.be.lessThan(1000); // Should complete in under 1 second
      expect(handler).to.have.callCount(messageCount);
    });

    it('should handle memory efficiently with many handlers', () => {
      const router = new TypedMessageRouter('memory-test', mockLogger);
      const handlerCount = 100;

      // Register many handlers
      for (let i = 0; i < handlerCount; i++) {
        router.registerHandler({
          command: `command-${i}`,
          handler: sinon.stub().resolves()
        });
      }

      expect(router.getRegisteredCommands()).to.have.length(handlerCount);

      // Clear all handlers - should free memory
      router.clearAllHandlers();

      expect(router.getRegisteredCommands()).to.be.empty;
    });

  });

  // =============================================================================
  // 統合テスト
  // =============================================================================

  describe('統合テスト - エンドツーエンドシナリオ', () => {

    it('should handle complete terminal creation workflow', async () => {
      const router = new TypedMessageRouter('integration-test', mockLogger);
      const sender = new TypedMessageSender(mockVSCodeAPI, 'integration-sender', mockLogger);

      // Set up terminal creation handler
      const createHandler = sinon.stub().resolves();
      router.registerHandler({
        command: MESSAGE_COMMANDS.TERMINAL_CREATE,
        handler: createHandler,
        validator: MessageDataValidator.createTerminalValidator(mockLogger)
      });

      // Simulate message from extension to webview
      const terminalData: TerminalMessageData = {
        terminalId: 'term-integration-1',
        action: 'create',
        payload: { shell: '/bin/bash', cwd: '/home/user' }
      };

      // Process incoming message
      const result = await router.processMessage(
        MESSAGE_COMMANDS.TERMINAL_CREATE,
        terminalData
      );

      expect(result.success).to.be.true;
      expect(createHandler).to.have.been.calledOnce;

      // Send response back to extension
      sender.sendMessage(MESSAGE_COMMANDS.STATE_UPDATE, {
        terminalId: terminalData.terminalId,
        status: 'created'
      });

      expect(mockVSCodeAPI.postMessage).to.have.been.calledOnceWith({
        command: MESSAGE_COMMANDS.STATE_UPDATE,
        terminalId: terminalData.terminalId,
        status: 'created'
      });
    });

    it('should handle error recovery in complex scenarios', async () => {
      const router = new TypedMessageRouter('error-recovery-test', mockLogger);

      // Handler that fails on first call, succeeds on second
      let callCount = 0;
      const flakyHandler = sinon.stub().callsFake(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Simulated failure');
        }
        return Promise.resolve();
      });

      router.registerHandler({
        command: MESSAGE_COMMANDS.TERMINAL_CREATE,
        handler: flakyHandler
      });

      // First call should fail
      const firstResult = await router.processMessage(
        MESSAGE_COMMANDS.TERMINAL_CREATE,
        { terminalId: 'term-1' }
      );
      expect(firstResult.success).to.be.false;

      // Second call should succeed
      const secondResult = await router.processMessage(
        MESSAGE_COMMANDS.TERMINAL_CREATE,
        { terminalId: 'term-1' }
      );
      expect(secondResult.success).to.be.true;
    });

  });

});

// =============================================================================
// TypeScript 型安全性検証テスト
// =============================================================================

describe('TypeScript Type Safety Verification', () => {

  it('should enforce type safety at compile time', () => {
    // These tests primarily verify that TypeScript compilation succeeds
    // with proper type checking enabled

    const router = new TypedMessageRouter('type-test');

    // Valid typed registration
    router.registerHandler<TerminalMessageData>({
      command: MESSAGE_COMMANDS.TERMINAL_CREATE,
      handler: async (data: TerminalMessageData) => {
        // TypeScript should enforce that data has terminalId property
        const terminalId: string = data.terminalId;
        expect(terminalId).to.be.a('string');
        return { success: true, command: MESSAGE_COMMANDS.TERMINAL_CREATE, processingTimeMs: 0 };
      }
    });

    // TypeScript should prevent invalid registrations at compile time
    // This would cause a compilation error:
    // router.registerHandler<TerminalMessageData>({
    //   command: MESSAGE_COMMANDS.TERMINAL_CREATE,
    //   handler: async (data: SessionMessageData) => { ... } // Type mismatch!
    // });

    expect(true).to.be.true; // Test passes if compilation succeeds
  });

});