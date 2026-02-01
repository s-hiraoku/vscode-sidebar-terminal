/**
 * Comprehensive TDD Tests for TypedMessageHandling - Following t-wada's Methodology
 *
 * These tests verify type-safe message handling system components:
 * - MessageDataValidator
 * - TypedMessageRouter
 * - TypedMessageSender
 * - Message event listeners
 *
 * TDD Principles Applied:
 * 1. RED: Write failing tests that specify exact behavior
 * 2. GREEN: Implement minimal code to satisfy tests
 * 3. REFACTOR: Improve design while keeping tests green
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestEnvironment, resetTestEnvironment } from '../../../../shared/TestSetup';
import {
  MessageDataValidator,
  TypedMessageRouter,
  TypedMessageSender,
  createTypedMessageEventListener,
  TerminalMessageData,
  TypedMessageHandler,
  TypedMessageRegistration,
  MESSAGE_COMMANDS,
} from '../../../../../webview/utils/TypedMessageHandling';

describe('TypedMessageHandling - Comprehensive TDD Suite', () => {
  let mockLogger: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setupTestEnvironment();
    mockLogger = vi.fn();
  });

  afterEach(() => {
    resetTestEnvironment();
    vi.restoreAllMocks();
  });

  describe('MessageDataValidator - Type-Safe Data Validation', () => {
    describe('RED Phase - Validation Requirements', () => {
      it('should fail when validating null data', () => {
        // RED: Null data should be invalid
        const validator = new MessageDataValidator<TerminalMessageData>(['terminalId'], mockLogger);

        const result = validator.validate(null);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Data must be a valid object');
      });

      it('should fail when validating undefined data', () => {
        // RED: Undefined data should be invalid
        const validator = new MessageDataValidator<TerminalMessageData>(['terminalId'], mockLogger);

        const result = validator.validate(undefined);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Data must be a valid object');
      });

      it('should fail when validating non-object data', () => {
        // RED: Non-object data should be invalid
        const validator = new MessageDataValidator<TerminalMessageData>(['terminalId'], mockLogger);

        const result = validator.validate('not an object');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Data must be a valid object');
      });

      it('should fail when required fields are missing', () => {
        // RED: Missing required fields should be invalid
        const validator = new MessageDataValidator<TerminalMessageData>(
          ['terminalId', 'action'],
          mockLogger
        );

        const invalidData = { terminalId: 'term-1' }; // missing 'action'
        const result = validator.validate(invalidData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Missing required field: action');
      });

      it('should pass when all required fields are present', () => {
        // RED: Valid data should pass validation
        const validator = new MessageDataValidator<TerminalMessageData>(['terminalId'], mockLogger);

        const validData = { terminalId: 'term-1', action: 'create' };
        const result = validator.validate(validData);

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.data.terminalId).toBe('term-1');
      });
    });

    describe('Factory Methods - Pre-configured Validators', () => {
      it('should create terminal validator with correct required fields', () => {
        // RED: Terminal validator should require terminalId
        const validator = MessageDataValidator.createTerminalValidator(mockLogger);

        const validData = { terminalId: 'term-1', action: 'create' };
        const result = validator.validate(validData);

        expect(result.isValid).toBe(true);
      });

      it('should create session validator with correct required fields', () => {
        // RED: Session validator should require sessionId and terminalStates
        const validator = MessageDataValidator.createSessionValidator(mockLogger);

        const validData = {
          sessionId: 'session-1',
          terminalStates: { 'term-1': {} },
        };
        const result = validator.validate(validData);

        expect(result.isValid).toBe(true);
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should handle empty object validation', () => {
        // RED: Empty object with required fields should fail
        const validator = new MessageDataValidator<TerminalMessageData>(['terminalId'], mockLogger);

        const result = validator.validate({});

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Missing required field: terminalId');
      });

      it('should handle validation with no required fields', () => {
        // RED: Validator with no required fields should pass any object
        const validator = new MessageDataValidator<Record<string, unknown>>([], mockLogger);

        const result = validator.validate({ anything: 'goes' });

        expect(result.isValid).toBe(true);
        expect(result.data.anything).toBe('goes');
      });

      it('should log validation failures', () => {
        // RED: Validation failures should be logged
        const validator = new MessageDataValidator<TerminalMessageData>(['terminalId'], mockLogger);

        validator.validate({});

        expect(mockLogger).toHaveBeenCalledWith('Validation failed:', expect.any(Array));
      });
    });
  });

  describe('TypedMessageRouter - Message Routing and Processing', () => {
    let router: TypedMessageRouter;

    beforeEach(() => {
      router = new TypedMessageRouter('TestComponent', mockLogger);
    });

    describe('RED Phase - Handler Registration', () => {
      it('should fail to process unregistered commands', async () => {
        // RED: Unregistered commands should fail
        const result = await router.processMessage('unregistered', {});

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('No handler registered for command: unregistered');
      });

      it('should successfully register and execute handlers', async () => {
        // RED: Registered handlers should execute
        const handler: TypedMessageHandler<TerminalMessageData> = vi.fn().mockResolvedValue(undefined);
        const registration: TypedMessageRegistration<TerminalMessageData> = {
          command: 'terminal:create',
          handler,
          description: 'Create terminal',
        };

        router.registerHandler(registration);
        const result = await router.processMessage('terminal:create', { terminalId: 'term-1' });

        expect(result.success).toBe(true);
        expect(handler).toHaveBeenCalledOnce();
      });

      it('should handle handler execution errors', async () => {
        // RED: Handler errors should be caught and reported
        const handler: TypedMessageHandler<TerminalMessageData> = vi
          .fn()
          .mockRejectedValue(new Error('Handler failed'));
        const registration: TypedMessageRegistration<TerminalMessageData> = {
          command: 'terminal:create',
          handler,
        };

        router.registerHandler(registration);
        const result = await router.processMessage('terminal:create', { terminalId: 'term-1' });

        expect(result.success).toBe(false);
        expect(result.error?.message).toBe('Handler failed');
      });
    });

    describe('Validation Integration', () => {
      it('should validate data before passing to handler', async () => {
        // RED: Invalid data should not reach handler
        const handler: TypedMessageHandler<TerminalMessageData> = vi.fn().mockResolvedValue(undefined);
        const validator = MessageDataValidator.createTerminalValidator(mockLogger);
        const registration: TypedMessageRegistration<TerminalMessageData> = {
          command: 'terminal:create',
          handler,
          validator,
        };

        router.registerHandler(registration);
        const result = await router.processMessage('terminal:create', {}); // Missing terminalId

        expect(result.success).toBe(false);
        expect(handler).not.toHaveBeenCalled();
        expect(result.error?.message).toContain('Validation failed');
      });

      it('should pass validated data to handler', async () => {
        // RED: Valid data should reach handler after validation
        const handler: TypedMessageHandler<TerminalMessageData> = vi.fn().mockResolvedValue(undefined);
        const validator = MessageDataValidator.createTerminalValidator(mockLogger);
        const registration: TypedMessageRegistration<TerminalMessageData> = {
          command: 'terminal:create',
          handler,
          validator,
        };

        router.registerHandler(registration);
        const result = await router.processMessage('terminal:create', { terminalId: 'term-1' });

        expect(result.success).toBe(true);
        expect(handler).toHaveBeenCalledWith({ terminalId: 'term-1' });
      });
    });

    describe('Multiple Handler Management', () => {
      it('should register multiple handlers without conflicts', () => {
        // RED: Multiple handlers should coexist
        const handler1: TypedMessageHandler = vi.fn().mockResolvedValue(undefined);
        const handler2: TypedMessageHandler = vi.fn().mockResolvedValue(undefined);

        router.registerHandler({ command: 'cmd1', handler: handler1 });
        router.registerHandler({ command: 'cmd2', handler: handler2 });

        const commands = router.getRegisteredCommands();

        expect(commands).toContain('cmd1');
        expect(commands).toContain('cmd2');
        expect(commands).toHaveLength(2);
      });

      it('should register multiple handlers in batch', () => {
        // RED: Batch registration should work
        const registrations: TypedMessageRegistration[] = [
          { command: 'cmd1', handler: vi.fn().mockResolvedValue(undefined) },
          { command: 'cmd2', handler: vi.fn().mockResolvedValue(undefined) },
          { command: 'cmd3', handler: vi.fn().mockResolvedValue(undefined) },
        ];

        router.registerMultipleHandlers(registrations);

        const commands = router.getRegisteredCommands();
        expect(commands).toHaveLength(3);
      });

      it('should clear all handlers when requested', () => {
        // RED: Clear should remove all handlers
        router.registerHandler({ command: 'cmd1', handler: vi.fn().mockResolvedValue(undefined) });
        router.registerHandler({ command: 'cmd2', handler: vi.fn().mockResolvedValue(undefined) });

        router.clearAllHandlers();

        const commands = router.getRegisteredCommands();
        expect(commands).toHaveLength(0);
      });
    });

    describe('Performance and Timing', () => {
      it('should measure processing time accurately', async () => {
        // RED: Processing time should be measured
        const slowHandler: TypedMessageHandler = async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        };

        router.registerHandler({ command: 'slow', handler: slowHandler });
        const result = await router.processMessage('slow', {});

        expect(result.processingTimeMs).toBeGreaterThan(40);
        expect(result.processingTimeMs).toBeLessThan(500); // Increased for CI/environment variability
      });
    });
  });

  describe('TypedMessageSender - Message Transmission', () => {
    let mockVSCodeAPI: { postMessage: ReturnType<typeof vi.fn> };
    let sender: TypedMessageSender;

    beforeEach(() => {
      mockVSCodeAPI = {
        postMessage: vi.fn(),
      };
      sender = new TypedMessageSender(mockVSCodeAPI as any, 'TestComponent', mockLogger);
    });

    describe('RED Phase - Basic Message Sending', () => {
      it('should send message with command and data', () => {
        // RED: Basic message sending should work
        const data: TerminalMessageData = { terminalId: 'term-1', action: 'create' };

        sender.sendMessage('terminal:create', data);

        expect(mockVSCodeAPI.postMessage).toHaveBeenCalledWith({
          command: 'terminal:create',
          terminalId: 'term-1',
          action: 'create',
        });
      });

      it('should send message without data', () => {
        // RED: Should handle empty data gracefully
        sender.sendMessage('simple:command');

        expect(mockVSCodeAPI.postMessage).toHaveBeenCalledWith({
          command: 'simple:command',
        });
      });

      it('should handle postMessage errors gracefully', () => {
        // RED: Should not throw on postMessage errors
        mockVSCodeAPI.postMessage.mockImplementation(() => {
          throw new Error('PostMessage failed');
        });

        expect(() => sender.sendMessage('test:command', {})).not.toThrow();
        expect(mockLogger).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Error)
        );
      });
    });

    describe('Batch and Conditional Sending', () => {
      it('should send multiple messages in sequence', () => {
        // RED: Batch sending should work
        const messages = [
          { command: 'cmd1', data: { value: 1 } },
          { command: 'cmd2', data: { value: 2 } },
          { command: 'cmd3' },
        ];

        sender.sendMultipleMessages(messages);

        expect(mockVSCodeAPI.postMessage).toHaveBeenCalledTimes(3);
      });

      it('should send conditional messages based on boolean condition', () => {
        // RED: Conditional sending should work
        sender.sendConditionalMessage(true, 'conditional:command', { sent: true });
        sender.sendConditionalMessage(false, 'conditional:command', { sent: false });

        expect(mockVSCodeAPI.postMessage).toHaveBeenCalledOnce();
        expect(mockVSCodeAPI.postMessage).toHaveBeenCalledWith({
          command: 'conditional:command',
          sent: true,
        });
      });

      it('should send conditional messages based on function condition', () => {
        // RED: Function-based conditions should work
        let shouldSend = false;
        const condition = () => shouldSend;

        sender.sendConditionalMessage(condition, 'conditional:command', {});
        shouldSend = true;
        sender.sendConditionalMessage(condition, 'conditional:command', {});

        expect(mockVSCodeAPI.postMessage).toHaveBeenCalledOnce();
      });
    });

    describe('Retry Mechanism', () => {
      it('should queue failed messages for retry', () => {
        // RED: Failed messages should be queued
        mockVSCodeAPI.postMessage.mockImplementation(() => {
          throw new Error('Network error');
        });

        sender.sendMessage('retry:test', { value: 1 });

        // Message should be queued (internal state, hard to test directly)
        expect(mockLogger).toHaveBeenCalledWith(expect.stringMatching(/Queued message for retry/));
      });

      it('should retry queued messages when requested', () => {
        // RED: Retry should re-attempt queued messages
        mockVSCodeAPI.postMessage
          .mockImplementationOnce(() => {
            throw new Error('First failure');
          })
          .mockImplementationOnce(() => undefined);

        sender.sendMessage('retry:test', { value: 1 });
        sender.retryQueuedMessages();

        // Should eventually succeed on retry
        expect(mockVSCodeAPI.postMessage).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Message Event Listener - Event Processing', () => {
    let router: TypedMessageRouter;
    let eventListener: (event: MessageEvent) => void;

    beforeEach(() => {
      router = new TypedMessageRouter('TestComponent', mockLogger);
      eventListener = createTypedMessageEventListener(router);
    });

    describe('RED Phase - Event Processing', () => {
      it('should process valid message events', async () => {
        // RED: Valid events should be processed
        const handler: TypedMessageHandler = vi.fn().mockResolvedValue(undefined);
        router.registerHandler({ command: 'test:command', handler });

        const mockEvent = {
          data: { command: 'test:command', payload: 'test' },
        } as MessageEvent;

        await eventListener(mockEvent);

        expect(handler).toHaveBeenCalledWith({ payload: 'test' });
      });

      it('should handle events without valid command', () => {
        // RED: Invalid events should be handled gracefully
        const mockEvent = {
          data: { invalidData: true },
        } as MessageEvent;

        expect(() => eventListener(mockEvent)).not.toThrow();
      });

      it('should call unhandled message callback for unknown commands', async () => {
        // RED: Unknown commands should trigger callback
        const unhandledCallback = vi.fn();
        const listener = createTypedMessageEventListener(router, unhandledCallback);

        const mockEvent = {
          data: { command: 'unknown:command' },
        } as MessageEvent;

        await listener(mockEvent);

        expect(unhandledCallback).toHaveBeenCalledWith(mockEvent);
      });

      it('should handle message processing errors gracefully', async () => {
        // RED: Processing errors should not crash listener
        const handler: TypedMessageHandler = vi.fn().mockRejectedValue(new Error('Processing failed'));
        router.registerHandler({ command: 'error:command', handler });

        const mockEvent = {
          data: { command: 'error:command' },
        } as MessageEvent;

        await expect(eventListener(mockEvent)).resolves.not.toThrow();
      });
    });
  });

  describe('Message Constants - Command Definitions', () => {
    describe('RED Phase - Constant Validation', () => {
      it('should provide all required terminal commands', () => {
        // RED: All terminal commands should be available
        expect(MESSAGE_COMMANDS.TERMINAL_CREATE).toBe('terminal:create');
        expect(MESSAGE_COMMANDS.TERMINAL_DELETE).toBe('terminal:delete');
        expect(MESSAGE_COMMANDS.TERMINAL_SET_ACTIVE).toBe('terminal:setActive');
        expect(MESSAGE_COMMANDS.TERMINAL_RESIZE).toBe('terminal:resize');
      });

      it('should provide all required input/output commands', () => {
        // RED: I/O commands should be available
        expect(MESSAGE_COMMANDS.TERMINAL_OUTPUT).toBe('terminal:output');
        expect(MESSAGE_COMMANDS.TERMINAL_INPUT).toBe('terminal:input');
        expect(MESSAGE_COMMANDS.TERMINAL_CLEAR).toBe('terminal:clear');
      });

      it('should provide all required session commands', () => {
        // RED: Session commands should be available
        expect(MESSAGE_COMMANDS.SESSION_RESTORE).toBe('session:restore');
        expect(MESSAGE_COMMANDS.SESSION_SAVE).toBe('session:save');
        expect(MESSAGE_COMMANDS.SESSION_EXTRACT_SCROLLBACK).toBe('session:extractScrollback');
      });

      it('should provide all required configuration commands', () => {
        // RED: Configuration commands should be available
        expect(MESSAGE_COMMANDS.CONFIG_UPDATE).toBe('config:update');
        expect(MESSAGE_COMMANDS.THEME_UPDATE).toBe('theme:update');
      });

      it('should provide all required state management commands', () => {
        // RED: State commands should be available
        expect(MESSAGE_COMMANDS.STATE_INIT).toBe('state:init');
        expect(MESSAGE_COMMANDS.STATE_UPDATE).toBe('state:update');
        expect(MESSAGE_COMMANDS.STATE_RESET).toBe('state:reset');
      });

      it('should provide all required notification commands', () => {
        // RED: Notification commands should be available
        expect(MESSAGE_COMMANDS.NOTIFICATION_SHOW).toBe('notification:show');
        expect(MESSAGE_COMMANDS.NOTIFICATION_HIDE).toBe('notification:hide');
      });
    });

    describe('Command Uniqueness', () => {
      it('should have unique command values', () => {
        // RED: All commands should be unique
        const commands = Object.values(MESSAGE_COMMANDS);
        const uniqueCommands = new Set(commands);

        expect(uniqueCommands.size).toBe(commands.length);
      });

      it('should follow consistent naming convention', () => {
        // RED: Commands should follow namespace:action pattern
        const commands = Object.values(MESSAGE_COMMANDS);

        for (const command of commands) {
          expect(command).toMatch(/^[a-z]+:[a-zA-Z]+$/);
        }
      });
    });
  });

  describe('Integration Tests - End-to-End Message Flow', () => {
    it('should handle complete message processing workflow', async () => {
      // RED: Complete workflow should work end-to-end
      const router = new TypedMessageRouter('TestComponent', mockLogger);
      const validator = MessageDataValidator.createTerminalValidator(mockLogger);
      const handler: TypedMessageHandler<TerminalMessageData> = vi.fn().mockResolvedValue(undefined);

      // Register handler with validation
      router.registerHandler({
        command: MESSAGE_COMMANDS.TERMINAL_CREATE,
        handler,
        validator,
        description: 'Create new terminal',
      });

      // Process message
      const result = await router.processMessage(MESSAGE_COMMANDS.TERMINAL_CREATE, {
        terminalId: 'term-1',
        action: 'create',
      });

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalledWith({ terminalId: 'term-1', action: 'create' });
    });

    it('should handle message sending and event processing integration', () => {
      // RED: Sender and event processing should integrate
      const mockVSCodeAPI = { postMessage: vi.fn() };
      const sender = new TypedMessageSender(mockVSCodeAPI as any, 'TestComponent', mockLogger);
      const router = new TypedMessageRouter('TestComponent', mockLogger);
      const eventListener = createTypedMessageEventListener(router);

      // Send message
      const messageData: TerminalMessageData = { terminalId: 'term-1', action: 'create' };
      sender.sendMessage(MESSAGE_COMMANDS.TERMINAL_CREATE, messageData);

      // Verify message was sent correctly
      expect(mockVSCodeAPI.postMessage).toHaveBeenCalledWith({
        command: MESSAGE_COMMANDS.TERMINAL_CREATE,
        terminalId: 'term-1',
        action: 'create',
      });

      // Simulate receiving the same message structure
      const mockEvent = {
        data: {
          command: MESSAGE_COMMANDS.TERMINAL_CREATE,
          terminalId: 'term-1',
          action: 'create',
        },
      } as MessageEvent;

      expect(() => eventListener(mockEvent)).not.toThrow();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle high-frequency message processing without memory leaks', async () => {
      // RED: High frequency processing should be stable
      const router = new TypedMessageRouter('TestComponent', mockLogger);
      const handler: TypedMessageHandler = vi.fn().mockResolvedValue(undefined);

      router.registerHandler({ command: 'high:frequency', handler });

      // Process many messages rapidly
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(router.processMessage('high:frequency', { count: i }));
      }

      const results = await Promise.all(promises);

      // All should succeed
      expect(results.every((r) => r.success)).toBe(true);
      expect(handler).toHaveBeenCalledTimes(100);
    });

    it('should handle concurrent message processing safely', async () => {
      // RED: Concurrent processing should be safe
      const router = new TypedMessageRouter('TestComponent', mockLogger);
      const slowHandler: TypedMessageHandler = async (data: any) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return data;
      };

      router.registerHandler({ command: 'concurrent:test', handler: slowHandler });

      // Start multiple concurrent operations
      const promises = [
        router.processMessage('concurrent:test', { id: 1 }),
        router.processMessage('concurrent:test', { id: 2 }),
        router.processMessage('concurrent:test', { id: 3 }),
      ];

      const results = await Promise.all(promises);

      // All should complete successfully
      expect(results.every((r) => r.success)).toBe(true);
    });
  });
});
