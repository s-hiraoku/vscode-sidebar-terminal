/**
 * ErrorHandler Unit Tests
 *
 * Tests for generic error handling utility with severity levels, notifications,
 * recovery callbacks, and rethrow capabilities.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { ErrorHandler } from '../../../../webview/utils/ErrorHandler';
import { terminalLogger } from '../../../../webview/utils/ManagerLogger';

describe('ErrorHandler', function () {
  let loggerErrorStub: sinon.SinonStub;
  let loggerWarnStub: sinon.SinonStub;
  let loggerInfoStub: sinon.SinonStub;
  let loggerDebugStub: sinon.SinonStub;

  beforeEach(function () {
    // Stub logger methods
    loggerErrorStub = sinon.stub(terminalLogger, 'error');
    loggerWarnStub = sinon.stub(terminalLogger, 'warn');
    loggerInfoStub = sinon.stub(terminalLogger, 'info');
    loggerDebugStub = sinon.stub(terminalLogger, 'debug');
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('handleOperationError()', function () {
    it('should handle error with default severity (error)', function () {
      const error = new Error('Test error');
      const result = ErrorHandler.handleOperationError('Test operation', error);

      expect(result.handled).to.be.true;
      expect(result.severity).to.equal('error');
      expect(result.message).to.equal('L Test operation failed');
      expect(result.error).to.equal(error);
      expect(loggerErrorStub.calledOnce).to.be.true;
    });

    it('should handle error with warn severity', function () {
      const error = new Error('Warning error');
      const result = ErrorHandler.handleOperationError('Warning operation', error, {
        severity: 'warn',
      });

      expect(result.severity).to.equal('warn');
      expect(result.message).to.equal('� Warning operation failed');
      expect(loggerWarnStub.calledOnce).to.be.true;
      expect(loggerErrorStub.called).to.be.false;
    });

    it('should handle error with info severity', function () {
      const error = new Error('Info error');
      const result = ErrorHandler.handleOperationError('Info operation', error, {
        severity: 'info',
      });

      expect(result.severity).to.equal('info');
      expect(result.message).to.equal('9 Info operation failed');
      expect(loggerInfoStub.calledOnce).to.be.true;
      expect(loggerErrorStub.called).to.be.false;
    });

    it('should include context in log message', function () {
      const error = new Error('Context error');
      const context = { terminalId: 'terminal-1', action: 'resize' };

      ErrorHandler.handleOperationError('Context operation', error, {
        context,
      });

      const logCall = loggerErrorStub.getCall(0);
      const logMessage = logCall.args[0];
      expect(logMessage).to.include('Context operation failed');
      expect(logMessage).to.include('terminal-1');
      expect(logMessage).to.include('resize');
    });

    it('should execute recovery callback on error', function () {
      const error = new Error('Recovery test');
      const recoverySpy = sinon.spy();

      ErrorHandler.handleOperationError('Recovery operation', error, {
        recovery: recoverySpy,
      });

      expect(recoverySpy.calledOnce).to.be.true;
    });

    it('should execute async recovery callback on error', function (done) {
      const error = new Error('Async recovery test');
      let recoveryExecuted = false;

      ErrorHandler.handleOperationError('Async recovery operation', error, {
        recovery: async () => {
          recoveryExecuted = true;
        },
      });

      // Check async callback execution
      setTimeout(() => {
        expect(recoveryExecuted).to.be.true;
        done();
      }, 10);
    });

    it('should handle recovery callback failures gracefully', function () {
      const error = new Error('Recovery failure test');
      const failingRecovery = () => {
        throw new Error('Recovery failed');
      };

      // Should not throw
      expect(() => {
        ErrorHandler.handleOperationError('Recovery failure operation', error, {
          recovery: failingRecovery,
        });
      }).to.not.throw();

      // Should log recovery error
      expect(loggerErrorStub.calledWith('L Recovery callback failed:', sinon.match.any)).to.be
        .true;
    });

    it('should notify user when notify option is true', function () {
      const error = new Error('Notification test');

      ErrorHandler.handleOperationError('Notification operation', error, {
        notify: true,
      });

      expect(loggerDebugStub.calledWith(sinon.match(/User Notification/))).to.be.true;
    });

    it('should not notify user when notify option is false', function () {
      const error = new Error('No notification test');

      ErrorHandler.handleOperationError('No notification operation', error, {
        notify: false,
      });

      expect(loggerDebugStub.called).to.be.false;
    });

    it('should rethrow error when rethrow option is true', function () {
      const error = new Error('Rethrow test');

      expect(() => {
        ErrorHandler.handleOperationError('Rethrow operation', error, {
          rethrow: true,
        });
      }).to.throw('Rethrow test');
    });

    it('should not rethrow error when rethrow option is false', function () {
      const error = new Error('No rethrow test');

      expect(() => {
        ErrorHandler.handleOperationError('No rethrow operation', error, {
          rethrow: false,
        });
      }).to.not.throw();
    });

    it('should handle all options combined', function () {
      const error = new Error('Combined options test');
      const recoverySpy = sinon.spy();

      expect(() => {
        ErrorHandler.handleOperationError('Combined operation', error, {
          severity: 'warn',
          notify: true,
          recovery: recoverySpy,
          rethrow: true,
          context: { test: 'data' },
        });
      }).to.throw('Combined options test');

      expect(loggerWarnStub.calledOnce).to.be.true;
      expect(loggerDebugStub.calledWith(sinon.match(/User Notification/))).to.be.true;
      expect(recoverySpy.calledOnce).to.be.true;
    });
  });

  describe('formatErrorMessage()', function () {
    it('should return operation name without details', function () {
      const result = ErrorHandler.formatErrorMessage('Test operation');
      expect(result).to.equal('Test operation');
    });

    it('should combine operation and details', function () {
      const result = ErrorHandler.formatErrorMessage('Test operation', 'additional details');
      expect(result).to.equal('Test operation: additional details');
    });
  });

  describe('extractErrorMessage()', function () {
    it('should extract message from Error object', function () {
      const error = new Error('Error message');
      const result = ErrorHandler.extractErrorMessage(error);
      expect(result).to.equal('Error message');
    });

    it('should return string error as-is', function () {
      const error = 'String error';
      const result = ErrorHandler.extractErrorMessage(error);
      expect(result).to.equal('String error');
    });

    it('should convert unknown error to string', function () {
      const error = { code: 'ERR_001' };
      const result = ErrorHandler.extractErrorMessage(error);
      expect(result).to.be.a('string');
    });

    it('should handle null/undefined', function () {
      const result1 = ErrorHandler.extractErrorMessage(null);
      const result2 = ErrorHandler.extractErrorMessage(undefined);
      expect(result1).to.be.a('string');
      expect(result2).to.be.a('string');
    });
  });

  describe('isErrorType()', function () {
    it('should return true for matching error type', function () {
      const error = new TypeError('Type error');
      const result = ErrorHandler.isErrorType(error, TypeError);
      expect(result).to.be.true;
    });

    it('should return false for non-matching error type', function () {
      const error = new Error('Generic error');
      const result = ErrorHandler.isErrorType(error, TypeError);
      expect(result).to.be.false;
    });

    it('should return false for non-error values', function () {
      const result1 = ErrorHandler.isErrorType('string', Error);
      const result2 = ErrorHandler.isErrorType(null, Error);
      const result3 = ErrorHandler.isErrorType(undefined, Error);
      expect(result1).to.be.false;
      expect(result2).to.be.false;
      expect(result3).to.be.false;
    });
  });

  describe('Emoji Display', function () {
    it('should use L emoji for error severity', function () {
      const error = new Error('Test');
      const result = ErrorHandler.handleOperationError('Test', error, { severity: 'error' });
      expect(result.message).to.include('L');
    });

    it('should use � emoji for warn severity', function () {
      const error = new Error('Test');
      const result = ErrorHandler.handleOperationError('Test', error, { severity: 'warn' });
      expect(result.message).to.include('�');
    });

    it('should use 9 emoji for info severity', function () {
      const error = new Error('Test');
      const result = ErrorHandler.handleOperationError('Test', error, { severity: 'info' });
      expect(result.message).to.include('9');
    });
  });

  describe('Integration Scenarios', function () {
    it('should handle terminal creation error with recovery', function () {
      const error = new Error('Terminal creation failed');
      let terminalRecreated = false;

      const result = ErrorHandler.handleOperationError('Terminal creation', error, {
        severity: 'error',
        recovery: () => {
          terminalRecreated = true;
        },
      });

      expect(result.handled).to.be.true;
      expect(terminalRecreated).to.be.true;
      expect(loggerErrorStub.calledOnce).to.be.true;
    });

    it('should handle optional addon loading error without rethrow', function () {
      const error = new Error('Addon failed to load');

      const result = ErrorHandler.handleOperationError('Addon loading', error, {
        severity: 'warn',
        rethrow: false,
      });

      expect(result.handled).to.be.true;
      expect(result.severity).to.equal('warn');
      expect(loggerWarnStub.calledOnce).to.be.true;
    });

    it('should handle critical operation error with notification and rethrow', function () {
      const error = new Error('Critical failure');

      expect(() => {
        ErrorHandler.handleOperationError('Critical operation', error, {
          severity: 'error',
          notify: true,
          rethrow: true,
          context: { operation: 'critical', timestamp: Date.now() },
        });
      }).to.throw('Critical failure');

      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(loggerDebugStub.calledWith(sinon.match(/User Notification/))).to.be.true;
    });
  });
});
