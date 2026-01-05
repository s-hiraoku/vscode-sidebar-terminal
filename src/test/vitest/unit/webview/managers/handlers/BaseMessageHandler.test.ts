/**
 * BaseMessageHandler Unit Tests
 *
 * Tests for abstract base message handler with common patterns
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseMessageHandler } from '../../../../../../webview/managers/handlers/BaseMessageHandler';
import { IManagerCoordinator } from '../../../../../../webview/interfaces/ManagerInterfaces';
import { MessageCommand } from '../../../../../../webview/managers/messageTypes';
import { MessageQueue } from '../../../../../../webview/utils/MessageQueue';
import { ManagerLogger } from '../../../../../../webview/utils/ManagerLogger';

// Concrete implementation for testing abstract class
class TestMessageHandler extends BaseMessageHandler {
  protected readonly supportedCommands = ['testCommand1', 'testCommand2', 'testCommand3'];

  public async handleMessage(msg: MessageCommand, _coordinator: IManagerCoordinator): Promise<void> {
    const command = this.getCommand(msg);

    if (!this.validate(msg)) {
      this.handleValidationError(msg);
      return;
    }

    switch (command) {
      case 'testCommand1':
        this.handleTestCommand1(msg);
        break;
      case 'testCommand2':
        await this.handleTestCommand2(msg);
        break;
      case 'testCommand3':
        this.handleTestCommand3WithError(msg);
        break;
      default:
        this.handleUnknownCommand(command);
    }
  }

  private handleTestCommand1(_msg: MessageCommand): void {
    // Simple command
  }

  private async handleTestCommand2(_msg: MessageCommand): Promise<void> {
    // Async command
  }

  private handleTestCommand3WithError(_msg: MessageCommand): void {
    throw new Error('Test error');
  }

  // Expose protected methods for testing
  public testGetCommand(msg: MessageCommand) {
    return this.getCommand(msg);
  }

  public testValidate(msg: MessageCommand) {
    return this.validate(msg);
  }

  public testHandleError(error: unknown, operation: string, context?: Record<string, unknown>) {
    this.handleError(error, operation, context);
  }

  public testHandleWarning(error: unknown, operation: string, context?: Record<string, unknown>) {
    this.handleWarning(error, operation, context);
  }

  public testSafeExecute<T>(
    operation: () => T | Promise<T>,
    operationName: string,
    context?: Record<string, unknown>
  ) {
    return this.safeExecute(operation, operationName, context);
  }

  public testHasProperty<K extends string>(msg: MessageCommand, prop: K) {
    return this.hasProperty(msg, prop);
  }

  public testGetProperty<T>(msg: MessageCommand, prop: string) {
    return this.getProperty<T>(msg, prop);
  }

  public testGetRequiredProperty<T>(msg: MessageCommand, prop: string) {
    return this.getRequiredProperty<T>(msg, prop);
  }
}

describe('BaseMessageHandler', () => {
  let handler: TestMessageHandler;
  let messageQueue: MessageQueue;
  let logger: ManagerLogger;
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;
  let mockCoordinator: IManagerCoordinator;

  beforeEach(() => {
    messageQueue = new MessageQueue({} as any, {} as any);
    logger = new ManagerLogger('test');

    // Spy on logger methods
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    handler = new TestMessageHandler(messageQueue, logger);

    // Create minimal coordinator mock
    mockCoordinator = {} as IManagerCoordinator;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSupportedCommands()', () => {
    it('should return list of supported commands', () => {
      const commands = handler.getSupportedCommands();
      expect(commands).toEqual(['testCommand1', 'testCommand2', 'testCommand3']);
    });
  });

  describe('getCommand()', () => {
    it('should extract command from message', () => {
      const msg = { command: 'testCommand1' } as MessageCommand;
      const command = handler.testGetCommand(msg);
      expect(command).toBe('testCommand1');
    });

    it('should return undefined for message without command', () => {
      const msg = {} as MessageCommand;
      const command = handler.testGetCommand(msg);
      expect(command).toBeUndefined();
    });
  });

  describe('validate()', () => {
    it('should return true for valid message', () => {
      const msg = { command: 'testCommand1' } as MessageCommand;
      const isValid = handler.testValidate(msg);
      expect(isValid).toBe(true);
    });

    it('should return false for message without command', () => {
      const msg = {} as MessageCommand;
      const isValid = handler.testValidate(msg);
      expect(isValid).toBe(false);
      expect(loggerWarnSpy).toHaveBeenCalledWith('Message missing command field');
    });

    it('should return false for unsupported command', () => {
      const msg = { command: 'unsupportedCommand' } as MessageCommand;
      const isValid = handler.testValidate(msg);
      expect(isValid).toBe(false);
    });
  });

  describe('handleUnknownCommand()', () => {
    it('should log warning for unknown command', async () => {
      // Note: When using handleMessage, validation happens first
      // so unsupported commands get validation error, not unknown command warning
      const msg = { command: 'unknownCommand' } as MessageCommand;
      await handler.handleMessage(msg, mockCoordinator);
      // Validation fails before unknown command handler is called
      expect(loggerWarnSpy).toHaveBeenCalledWith('Validation failed for command: unknownCommand');
    });
  });

  describe('handleValidationError()', () => {
    it('should log validation error', async () => {
      const msg = { command: 'unsupportedCommand' } as MessageCommand;
      await handler.handleMessage(msg, mockCoordinator);
      expect(loggerWarnSpy).toHaveBeenCalledWith('Validation failed for command: unsupportedCommand');
    });
  });

  describe('handleError()', () => {
    it('should handle error with ErrorHandler', () => {
      const error = new Error('Test error');
      handler.testHandleError(error, 'Test operation');
      // ErrorHandler should log the error (verified via loggerErrorStub in ErrorHandler tests)
    });

    it('should handle error with context', () => {
      const error = new Error('Context error');
      const context = { testId: '123', action: 'test' };
      handler.testHandleError(error, 'Context operation', context);
      // ErrorHandler logs context information
    });
  });

  describe('handleWarning()', () => {
    it('should handle warning with ErrorHandler', () => {
      const error = new Error('Warning test');
      handler.testHandleWarning(error, 'Warning operation');
      // ErrorHandler uses warn severity
    });
  });

  describe('safeExecute()', () => {
    it('should execute operation successfully', async () => {
      const result = await handler.testSafeExecute(() => 'success', 'Test operation');
      expect(result).toBe('success');
    });

    it('should handle operation error gracefully', async () => {
      const operation = () => {
        throw new Error('Operation failed');
      };
      const result = await handler.testSafeExecute(operation, 'Failing operation');
      expect(result).toBeUndefined();
    });

    it('should execute async operation successfully', async () => {
      const asyncOp = async () => 'async success';
      const result = await handler.testSafeExecute(asyncOp, 'Async operation');
      expect(result).toBe('async success');
    });

    it('should handle async operation error', async () => {
      const asyncOp = async () => {
        throw new Error('Async failed');
      };
      const result = await handler.testSafeExecute(asyncOp, 'Failing async operation');
      expect(result).toBeUndefined();
    });
  });

  describe('hasProperty()', () => {
    it('should return true for existing property', () => {
      const msg = { command: 'test', terminalId: '123' } as MessageCommand;
      const hasTerminalId = handler.testHasProperty(msg, 'terminalId');
      expect(hasTerminalId).toBe(true);
    });

    it('should return false for non-existing property', () => {
      const msg = { command: 'test' } as MessageCommand;
      const hasTerminalId = handler.testHasProperty(msg, 'terminalId');
      expect(hasTerminalId).toBe(false);
    });
  });

  describe('getProperty()', () => {
    it('should return property value if exists', () => {
      const msg = { command: 'test', terminalId: '123' } as MessageCommand;
      const terminalId = handler.testGetProperty<string>(msg, 'terminalId');
      expect(terminalId).toBe('123');
    });

    it('should return undefined for non-existing property', () => {
      const msg = { command: 'test' } as MessageCommand;
      const terminalId = handler.testGetProperty<string>(msg, 'terminalId');
      expect(terminalId).toBeUndefined();
    });
  });

  describe('getRequiredProperty()', () => {
    it('should return property value if exists', () => {
      const msg = { command: 'test', terminalId: '123' } as MessageCommand;
      const terminalId = handler.testGetRequiredProperty<string>(msg, 'terminalId');
      expect(terminalId).toBe('123');
    });

    it('should log warning for missing required property', () => {
      const msg = { command: 'test' } as MessageCommand;
      const terminalId = handler.testGetRequiredProperty<string>(msg, 'terminalId');
      expect(terminalId).toBeUndefined();
      expect(loggerWarnSpy).toHaveBeenCalledWith("Required property 'terminalId' missing from message");
    });
  });

  describe('dispose()', () => {
    it('should execute without error', () => {
      expect(() => handler.dispose()).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle valid message end-to-end', async () => {
      const msg = { command: 'testCommand1' } as MessageCommand;
      await handler.handleMessage(msg, mockCoordinator);
      // Should execute successfully without errors
    });

    it('should handle async message end-to-end', async () => {
      const msg = { command: 'testCommand2' } as MessageCommand;
      await handler.handleMessage(msg, mockCoordinator);
      // Should execute async command successfully
    });

    it('should reject invalid message', async () => {
      const msg = { command: 'invalidCommand' } as MessageCommand;
      await handler.handleMessage(msg, mockCoordinator);
      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    it('should handle message without command', async () => {
      const msg = {} as MessageCommand;
      await handler.handleMessage(msg, mockCoordinator);
      expect(loggerWarnSpy).toHaveBeenCalledWith('Message missing command field');
    });
  });
});
