/**
 * BaseMessageHandler Unit Tests
 *
 * Tests for abstract base message handler with common patterns
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { BaseMessageHandler } from '../../../../../webview/managers/handlers/BaseMessageHandler';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';
import { MessageCommand } from '../../../../../webview/managers/messageTypes';
import { MessageQueue } from '../../../../../webview/utils/MessageQueue';
import { ManagerLogger } from '../../../../../webview/utils/ManagerLogger';

// Concrete implementation for testing abstract class
class TestMessageHandler extends BaseMessageHandler {
  protected readonly supportedCommands = ['testCommand1', 'testCommand2', 'testCommand3'];

  public async handleMessage(
    msg: MessageCommand,
    _coordinator: IManagerCoordinator
  ): Promise<void> {
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

describe('BaseMessageHandler', function () {
  let handler: TestMessageHandler;
  let messageQueue: MessageQueue;
  let logger: ManagerLogger;
  let loggerWarnStub: sinon.SinonStub;
  let mockCoordinator: IManagerCoordinator;

  beforeEach(function () {
    messageQueue = new MessageQueue({} as any, {} as any);
    logger = new ManagerLogger('test');

    // Stub logger methods
    sinon.stub(logger, 'info');
    loggerWarnStub = sinon.stub(logger, 'warn');
    sinon.stub(logger, 'error');

    handler = new TestMessageHandler(messageQueue, logger);

    // Create minimal coordinator mock
    mockCoordinator = {} as IManagerCoordinator;
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('getSupportedCommands()', function () {
    it('should return list of supported commands', function () {
      const commands = handler.getSupportedCommands();
      expect(commands).to.deep.equal(['testCommand1', 'testCommand2', 'testCommand3']);
    });
  });

  describe('getCommand()', function () {
    it('should extract command from message', function () {
      const msg = { command: 'testCommand1' } as MessageCommand;
      const command = handler.testGetCommand(msg);
      expect(command).to.equal('testCommand1');
    });

    it('should return undefined for message without command', function () {
      const msg = {} as MessageCommand;
      const command = handler.testGetCommand(msg);
      expect(command).to.be.undefined;
    });
  });

  describe('validate()', function () {
    it('should return true for valid message', function () {
      const msg = { command: 'testCommand1' } as MessageCommand;
      const isValid = handler.testValidate(msg);
      expect(isValid).to.be.true;
    });

    it('should return false for message without command', function () {
      const msg = {} as MessageCommand;
      const isValid = handler.testValidate(msg);
      expect(isValid).to.be.false;
      expect(loggerWarnStub.calledWith('Message missing command field')).to.be.true;
    });

    it('should return false for unsupported command', function () {
      const msg = { command: 'unsupportedCommand' } as MessageCommand;
      const isValid = handler.testValidate(msg);
      expect(isValid).to.be.false;
    });
  });

  describe('handleUnknownCommand()', function () {
    it('should log warning for unknown command', async function () {
      const msg = { command: 'unknownCommand' } as MessageCommand;
      await handler.handleMessage(msg, mockCoordinator);
      expect(loggerWarnStub.calledWith('Unknown command: unknownCommand')).to.be.true;
    });
  });

  describe('handleValidationError()', function () {
    it('should log validation error', async function () {
      const msg = { command: 'unsupportedCommand' } as MessageCommand;
      await handler.handleMessage(msg, mockCoordinator);
      expect(loggerWarnStub.calledWith('Validation failed for command: unsupportedCommand')).to.be
        .true;
    });
  });

  describe('handleError()', function () {
    it('should handle error with ErrorHandler', function () {
      const error = new Error('Test error');
      handler.testHandleError(error, 'Test operation');
      // ErrorHandler should log the error (verified via loggerErrorStub in ErrorHandler tests)
    });

    it('should handle error with context', function () {
      const error = new Error('Context error');
      const context = { testId: '123', action: 'test' };
      handler.testHandleError(error, 'Context operation', context);
      // ErrorHandler logs context information
    });
  });

  describe('handleWarning()', function () {
    it('should handle warning with ErrorHandler', function () {
      const error = new Error('Warning test');
      handler.testHandleWarning(error, 'Warning operation');
      // ErrorHandler uses warn severity
    });
  });

  describe('safeExecute()', function () {
    it('should execute operation successfully', async function () {
      const result = await handler.testSafeExecute(() => 'success', 'Test operation');
      expect(result).to.equal('success');
    });

    it('should handle operation error gracefully', async function () {
      const operation = () => {
        throw new Error('Operation failed');
      };
      const result = await handler.testSafeExecute(operation, 'Failing operation');
      expect(result).to.be.undefined;
    });

    it('should execute async operation successfully', async function () {
      const asyncOp = async () => 'async success';
      const result = await handler.testSafeExecute(asyncOp, 'Async operation');
      expect(result).to.equal('async success');
    });

    it('should handle async operation error', async function () {
      const asyncOp = async () => {
        throw new Error('Async failed');
      };
      const result = await handler.testSafeExecute(asyncOp, 'Failing async operation');
      expect(result).to.be.undefined;
    });
  });

  describe('hasProperty()', function () {
    it('should return true for existing property', function () {
      const msg = { command: 'test', terminalId: '123' } as MessageCommand;
      const hasTerminalId = handler.testHasProperty(msg, 'terminalId');
      expect(hasTerminalId).to.be.true;
    });

    it('should return false for non-existing property', function () {
      const msg = { command: 'test' } as MessageCommand;
      const hasTerminalId = handler.testHasProperty(msg, 'terminalId');
      expect(hasTerminalId).to.be.false;
    });
  });

  describe('getProperty()', function () {
    it('should return property value if exists', function () {
      const msg = { command: 'test', terminalId: '123' } as MessageCommand;
      const terminalId = handler.testGetProperty<string>(msg, 'terminalId');
      expect(terminalId).to.equal('123');
    });

    it('should return undefined for non-existing property', function () {
      const msg = { command: 'test' } as MessageCommand;
      const terminalId = handler.testGetProperty<string>(msg, 'terminalId');
      expect(terminalId).to.be.undefined;
    });
  });

  describe('getRequiredProperty()', function () {
    it('should return property value if exists', function () {
      const msg = { command: 'test', terminalId: '123' } as MessageCommand;
      const terminalId = handler.testGetRequiredProperty<string>(msg, 'terminalId');
      expect(terminalId).to.equal('123');
    });

    it('should log warning for missing required property', function () {
      const msg = { command: 'test' } as MessageCommand;
      const terminalId = handler.testGetRequiredProperty<string>(msg, 'terminalId');
      expect(terminalId).to.be.undefined;
      expect(loggerWarnStub.calledWith("Required property 'terminalId' missing from message")).to.be
        .true;
    });
  });

  describe('dispose()', function () {
    it('should execute without error', function () {
      expect(() => handler.dispose()).to.not.throw();
    });
  });

  describe('Integration Scenarios', function () {
    it('should handle valid message end-to-end', async function () {
      const msg = { command: 'testCommand1' } as MessageCommand;
      await handler.handleMessage(msg, mockCoordinator);
      // Should execute successfully without errors
    });

    it('should handle async message end-to-end', async function () {
      const msg = { command: 'testCommand2' } as MessageCommand;
      await handler.handleMessage(msg, mockCoordinator);
      // Should execute async command successfully
    });

    it('should reject invalid message', async function () {
      const msg = { command: 'invalidCommand' } as MessageCommand;
      await handler.handleMessage(msg, mockCoordinator);
      expect(loggerWarnStub.called).to.be.true;
    });

    it('should handle message without command', async function () {
      const msg = {} as MessageCommand;
      await handler.handleMessage(msg, mockCoordinator);
      expect(loggerWarnStub.calledWith('Message missing command field')).to.be.true;
    });
  });
});
