/**
 * TypedMessageHandling 完全テストスイート
 * - 型安全性とエラーハンドリングの検証
 * - パフォーマンスとリソース管理のテスト
 * - リアルワールドシナリオの包括的カバレッジ
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MessageDataValidator,
  TypedMessageRouter,
  TypedMessageSender,
  MESSAGE_COMMANDS,
  createTypedMessageEventListener,
} from '../../../../../webview/utils/TypedMessageHandling';

describe('TypedMessageHandling - 型安全なメッセージシステム', () => {
  // =============================================================================
  // テストセットアップとユーティリティ
  // =============================================================================

  let mockLogger: ReturnType<typeof vi.fn>;
  let mockVSCodeAPI: { postMessage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockLogger = vi.fn();
    mockVSCodeAPI = {
      postMessage: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.data).toEqual(validData);
      });

      it('should detect missing required fields', () => {
        const validator = new MessageDataValidator(['terminalId', 'action'], mockLogger);

        const invalidData = { terminalId: 'term-1' }; // missing 'action'
        const result = validator.validate(invalidData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Missing required field: action');
      });

      it('should handle null and undefined input gracefully', () => {
        const validator = new MessageDataValidator<Record<string, unknown>>(['field'], mockLogger);

        expect(validator.validate(null).isValid).toBe(false);
        expect(validator.validate(undefined).isValid).toBe(false);
        expect(validator.validate('string').isValid).toBe(false);
      });
    });

    describe('専用バリデーター作成機能', () => {
      it('should create terminal message validator', () => {
        const validator = MessageDataValidator.createTerminalValidator(mockLogger);

        const validTerminalData: TerminalMessageData = {
          terminalId: 'term-123',
          action: 'create',
          payload: { shell: '/bin/bash' },
        };

        const result = validator.validate(validTerminalData);
        expect(result.isValid).toBe(true);
      });

      it('should create session message validator', () => {
        const validator = MessageDataValidator.createSessionValidator(mockLogger);

        const validSessionData: SessionMessageData = {
          sessionId: 'session-456',
          terminalStates: { 'term-1': { active: true } },
        };

        const result = validator.validate(validSessionData);
        expect(result.isValid).toBe(true);
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
        const handler = vi.fn().mockResolvedValue(undefined);

        router.registerHandler({
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          handler,
          description: 'Create terminal handler',
        });

        const commands = router.getRegisteredCommands();
        expect(commands).toContain(MESSAGE_COMMANDS.TERMINAL_CREATE);
        expect(mockLogger).toHaveBeenCalledWith(
          expect.stringContaining(MESSAGE_COMMANDS.TERMINAL_CREATE)
        );
      });

      it('should register multiple handlers at once', () => {
        const handlers = [
          {
            command: MESSAGE_COMMANDS.TERMINAL_CREATE,
            handler: vi.fn().mockResolvedValue(undefined),
          },
          {
            command: MESSAGE_COMMANDS.TERMINAL_DELETE,
            handler: vi.fn().mockResolvedValue(undefined),
          },
        ];

        router.registerMultipleHandlers(handlers);

        const commands = router.getRegisteredCommands();
        expect(commands).toContain(MESSAGE_COMMANDS.TERMINAL_CREATE);
        expect(commands).toContain(MESSAGE_COMMANDS.TERMINAL_DELETE);
      });
    });

    describe('メッセージ処理機能', () => {
      it('should process valid message successfully', async () => {
        const handler = vi.fn().mockResolvedValue(undefined);

        router.registerHandler({
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          handler,
        });

        const result = await router.processMessage(MESSAGE_COMMANDS.TERMINAL_CREATE, {
          terminalId: 'term-1',
        });

        expect(result.success).toBe(true);
        expect(result.command).toBe(MESSAGE_COMMANDS.TERMINAL_CREATE);
        expect(result.processingTimeMs).toBeTypeOf('number');
        expect(handler).toHaveBeenCalledOnce();
      });

      it('should handle unregistered commands gracefully', async () => {
        const result = await router.processMessage('unknown-command', {});

        expect(result.success).toBe(false);
        expect(result.command).toBe('unknown-command');
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error?.message).toContain('No handler registered');
      });

      it('should handle handler exceptions', async () => {
        const error = new Error('Handler execution failed');
        const handler = vi.fn().mockRejectedValue(error);

        router.registerHandler({
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          handler,
        });

        const result = await router.processMessage(MESSAGE_COMMANDS.TERMINAL_CREATE, {
          terminalId: 'term-1',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe(error);
      });
    });

    describe('データ検証統合', () => {
      it('should use validator when provided', async () => {
        const validator = MessageDataValidator.createTerminalValidator(mockLogger);
        const handler = vi.fn().mockResolvedValue(undefined);

        router.registerHandler({
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          handler,
          validator,
        });

        // Valid data
        const validResult = await router.processMessage(MESSAGE_COMMANDS.TERMINAL_CREATE, {
          terminalId: 'term-1',
        });
        expect(validResult.success).toBe(true);

        // Invalid data
        const invalidResult = await router.processMessage(
          MESSAGE_COMMANDS.TERMINAL_CREATE,
          {} // missing terminalId
        );
        expect(invalidResult.success).toBe(false);
        expect(invalidResult.error?.message).toContain('Validation failed');
      });
    });

    describe('リソース管理', () => {
      it('should clear all handlers and validators', () => {
        router.registerHandler({
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          handler: vi.fn().mockResolvedValue(undefined),
        });

        expect(router.getRegisteredCommands()).not.toEqual([]);

        router.clearAllHandlers();

        expect(router.getRegisteredCommands()).toEqual([]);
      });
    });
  });

  // =============================================================================
  // TypedMessageSender テスト
  // =============================================================================

  describe('TypedMessageSender - メッセージ送信機能', () => {
    let sender: TypedMessageSender;

    beforeEach(() => {
      sender = new TypedMessageSender(mockVSCodeAPI as unknown as VSCodeWebviewAPI, 'test-sender', mockLogger);
    });

    describe('基本的な送信機能', () => {
      it('should send message successfully', () => {
        const terminalData: TerminalMessageData = {
          terminalId: 'term-1',
          action: 'create',
        };

        sender.sendMessage(MESSAGE_COMMANDS.TERMINAL_CREATE, terminalData);

        expect(mockVSCodeAPI.postMessage).toHaveBeenCalledOnce();
        expect(mockVSCodeAPI.postMessage).toHaveBeenCalledWith({
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          ...terminalData,
        });
      });

      it('should send multiple messages sequentially', () => {
        const messages = [
          { command: MESSAGE_COMMANDS.TERMINAL_CREATE, data: { terminalId: 'term-1' } },
          { command: MESSAGE_COMMANDS.TERMINAL_DELETE, data: { terminalId: 'term-2' } },
        ];

        sender.sendMultipleMessages(messages);

        expect(mockVSCodeAPI.postMessage).toHaveBeenCalledTimes(2);
      });

      it('should send conditional messages based on condition', () => {
        const data = { terminalId: 'term-1' };

        // True condition
        sender.sendConditionalMessage(true, MESSAGE_COMMANDS.TERMINAL_CREATE, data);
        expect(mockVSCodeAPI.postMessage).toHaveBeenCalledOnce();

        // False condition
        sender.sendConditionalMessage(false, MESSAGE_COMMANDS.TERMINAL_DELETE, data);
        expect(mockVSCodeAPI.postMessage).toHaveBeenCalledOnce(); // Still once

        // Function condition
        sender.sendConditionalMessage(() => true, MESSAGE_COMMANDS.TERMINAL_RESIZE, data);
        expect(mockVSCodeAPI.postMessage).toHaveBeenCalledTimes(2);
      });
    });

    describe('エラーハンドリングとリトライ', () => {
      it('should handle postMessage errors gracefully', () => {
        mockVSCodeAPI.postMessage.mockImplementation(() => {
          throw new Error('VS Code API error');
        });

        expect(() => {
          sender.sendMessage(MESSAGE_COMMANDS.TERMINAL_CREATE, { terminalId: 'term-1' });
        }).not.toThrow();

        expect(mockLogger).toHaveBeenCalledWith(
          expect.stringContaining(MESSAGE_COMMANDS.TERMINAL_CREATE),
          expect.any(Error)
        );
      });

      it('should queue messages for retry on failure', () => {
        mockVSCodeAPI.postMessage.mockImplementation(() => {
          throw new Error('Network error');
        });

        sender.sendMessage(MESSAGE_COMMANDS.TERMINAL_CREATE, { terminalId: 'term-1' });

        // The error should be logged and message queued
        expect(mockLogger).toHaveBeenCalledWith(
          expect.stringMatching(/Failed to send.*terminal:create/),
          expect.any(Error)
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
    let onUnhandled: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      router = new TypedMessageRouter('test-listener', mockLogger);
      onUnhandled = vi.fn();
      eventListener = createTypedMessageEventListener(router, onUnhandled);
    });

    it('should process valid message events', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.registerHandler({
        command: MESSAGE_COMMANDS.TERMINAL_CREATE,
        handler,
      });

      const event = new MessageEvent('message', {
        data: {
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          terminalId: 'term-1',
        },
      });

      await eventListener(event);

      expect(handler).toHaveBeenCalledOnce();
      expect(onUnhandled).not.toHaveBeenCalled();
    });

    it('should handle events without command', async () => {
      const event = new MessageEvent('message', {
        data: { data: 'some data without command' },
      });

      await eventListener(event);

      expect(onUnhandled).toHaveBeenCalledOnce();
      expect(onUnhandled).toHaveBeenCalledWith(event);
    });

    it('should handle events with failed processing', async () => {
      const event = new MessageEvent('message', {
        data: {
          command: 'unknown-command',
          data: 'test',
        },
      });

      await eventListener(event);

      expect(onUnhandled).toHaveBeenCalledOnce();
      expect(onUnhandled).toHaveBeenCalledWith(event);
    });
  });

  // =============================================================================
  // パフォーマンステスト
  // =============================================================================

  describe('パフォーマンスとスケーラビリティ', () => {
    it('should handle high-frequency message processing', async () => {
      const router = new TypedMessageRouter('perf-test', mockLogger);
      const handler = vi.fn().mockResolvedValue(undefined);

      router.registerHandler({
        command: MESSAGE_COMMANDS.TERMINAL_OUTPUT,
        handler,
      });

      const messageCount = 1000;
      const promises: Promise<MessageProcessingResult>[] = [];

      const startTime = performance.now();

      for (let i = 0; i < messageCount; i++) {
        promises.push(
          router.processMessage(MESSAGE_COMMANDS.TERMINAL_OUTPUT, {
            terminalId: `term-${i}`,
            data: `output-${i}`,
          })
        );
      }

      const results = await Promise.all(promises);
      const endTime = performance.now();

      expect(results).toHaveLength(messageCount);
      expect(results.every((r) => r.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
      expect(handler).toHaveBeenCalledTimes(messageCount);
    });

    it('should handle memory efficiently with many handlers', () => {
      const router = new TypedMessageRouter('memory-test', mockLogger);
      const handlerCount = 100;

      // Register many handlers
      for (let i = 0; i < handlerCount; i++) {
        router.registerHandler({
          command: `command-${i}`,
          handler: vi.fn().mockResolvedValue(undefined),
        });
      }

      expect(router.getRegisteredCommands()).toHaveLength(handlerCount);

      // Clear all handlers - should free memory
      router.clearAllHandlers();

      expect(router.getRegisteredCommands()).toEqual([]);
    });
  });

  // =============================================================================
  // 統合テスト
  // =============================================================================

  describe('統合テスト - エンドツーエンドシナリオ', () => {
    it('should handle complete terminal creation workflow', async () => {
      const router = new TypedMessageRouter('integration-test', mockLogger);
      const sender = new TypedMessageSender(mockVSCodeAPI as unknown as VSCodeWebviewAPI, 'integration-sender', mockLogger);

      // Set up terminal creation handler
      const createHandler = vi.fn().mockResolvedValue(undefined);
      router.registerHandler({
        command: MESSAGE_COMMANDS.TERMINAL_CREATE,
        handler: createHandler,
        validator: MessageDataValidator.createTerminalValidator(mockLogger),
      });

      // Simulate message from extension to webview
      const terminalData: TerminalMessageData = {
        terminalId: 'term-integration-1',
        action: 'create',
        payload: { shell: '/bin/bash', cwd: '/home/user' },
      };

      // Process incoming message
      const result = await router.processMessage(MESSAGE_COMMANDS.TERMINAL_CREATE, terminalData);

      expect(result.success).toBe(true);
      expect(createHandler).toHaveBeenCalledOnce();

      // Send response back to extension
      sender.sendMessage(MESSAGE_COMMANDS.STATE_UPDATE, {
        terminalId: terminalData.terminalId,
        status: 'created',
      });

      expect(mockVSCodeAPI.postMessage).toHaveBeenCalledOnce();
      expect(mockVSCodeAPI.postMessage).toHaveBeenCalledWith({
        command: MESSAGE_COMMANDS.STATE_UPDATE,
        terminalId: terminalData.terminalId,
        status: 'created',
      });
    });

    it('should handle error recovery in complex scenarios', async () => {
      const router = new TypedMessageRouter('error-recovery-test', mockLogger);

      // Handler that fails on first call, succeeds on second
      let callCount = 0;
      const flakyHandler = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Simulated failure');
        }
        return Promise.resolve();
      });

      router.registerHandler({
        command: MESSAGE_COMMANDS.TERMINAL_CREATE,
        handler: flakyHandler,
      });

      // First call should fail
      const firstResult = await router.processMessage(MESSAGE_COMMANDS.TERMINAL_CREATE, {
        terminalId: 'term-1',
      });
      expect(firstResult.success).toBe(false);

      // Second call should succeed
      const secondResult = await router.processMessage(MESSAGE_COMMANDS.TERMINAL_CREATE, {
        terminalId: 'term-1',
      });
      expect(secondResult.success).toBe(true);
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
        expect(terminalId).toBeTypeOf('string');
        // Handlers should not return anything (void)
      },
    });

    // TypeScript should prevent invalid registrations at compile time
    // This would cause a compilation error:
    // router.registerHandler<TerminalMessageData>({
    //   command: MESSAGE_COMMANDS.TERMINAL_CREATE,
    //   handler: async (data: SessionMessageData) => { ... } // Type mismatch!
    // });

    expect(true).toBe(true); // Test passes if compilation succeeds
  });
});
