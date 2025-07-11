/* eslint-disable */
// @ts-nocheck

import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { ErrorHandler } from '../../../../webview/utils/ErrorHandler';

// Mock VS Code API
const mockVscode = {
  workspace: {
    getConfiguration: sinon.stub(),
  },
  window: {
    showErrorMessage: sinon.stub(),
    showWarningMessage: sinon.stub(),
    showInformationMessage: sinon.stub(),
  },
  ExtensionContext: sinon.stub(),
  ViewColumn: { One: 1 },
  TreeDataProvider: sinon.stub(),
  EventEmitter: sinon.stub(),
  CancellationToken: sinon.stub(),
  commands: {
    registerCommand: sinon.stub(),
    executeCommand: sinon.stub(),
  },
};

// Setup test environment
function setupTestEnvironment() {
  // Mock VS Code module
  (global as any).vscode = mockVscode;

  // Mock Node.js modules
  (global as any).require = sinon.stub();
  (global as any).module = { exports: {} };
  (global as any).process = {
    platform: 'linux',
    env: {
      NODE_ENV: 'test',
    },
  };
}

describe('ErrorHandler', () => {
  let sandbox: sinon.SinonSandbox;
  let dom: JSDOM;
  let document: Document;
  let errorHandler: ErrorHandler;
  let consoleErrorStub: sinon.SinonStub;

  beforeEach(() => {
    setupTestEnvironment();

    // Mock console before JSDOM creation
    consoleErrorStub = sinon.stub();
    (global as Record<string, unknown>).console = {
      log: sinon.stub(),
      warn: sinon.stub(),
      error: consoleErrorStub,
    };

    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="notification-container"></div>
        </body>
      </html>
    `);
    document = dom.window.document;
    (global as any).document = document;
    (global as any).window = dom.window;

    sandbox = sinon.createSandbox();
    errorHandler = new ErrorHandler();
  });

  afterEach(() => {
    if (sandbox) {
      sandbox.restore();
    }
    if (dom) {
      dom.window.close();
    }
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(errorHandler).to.be.an('object');
      expect(errorHandler.maxRetries).to.equal(3);
      expect(errorHandler.enableUserNotifications).to.be.true;
    });

    it('should initialize with custom configuration', () => {
      const customHandler = new ErrorHandler({
        maxRetries: 5,
        enableUserNotifications: false,
        logLevel: 'debug',
      });

      expect(customHandler.maxRetries).to.equal(5);
      expect(customHandler.enableUserNotifications).to.be.false;
      expect(customHandler.logLevel).to.equal('debug');
    });
  });

  describe('handleError method', () => {
    it('should handle Error object', () => {
      const error = new Error('Test error message');

      errorHandler.handleError(error);

      expect(consoleErrorStub).to.have.been.calledWith('[ERROR]', 'Test error message');
    });

    it('should handle string error', () => {
      const error = 'String error message';

      errorHandler.handleError(error);

      expect(consoleErrorStub).to.have.been.calledWith('[ERROR]', 'String error message');
    });

    it('should handle object error', () => {
      const error = { message: 'Object error', code: 500 };

      errorHandler.handleError(error);

      expect(consoleErrorStub).to.have.been.called;
    });

    it('should handle context information', () => {
      const error = new Error('Test error');
      const context = { component: 'terminal', action: 'create' };

      errorHandler.handleError(error, context);

      expect(consoleErrorStub).to.have.been.calledWith('[ERROR]', 'Test error', context);
    });

    it('should show user notification when enabled', () => {
      const error = new Error('Test error');

      errorHandler.handleError(error);

      // Should create notification element
      const notifications = document.querySelectorAll('.error-notification');
      expect(notifications.length).to.be.greaterThan(0);
    });
  });

  describe('handleTerminalError method', () => {
    it('should handle terminal creation error', () => {
      const error = new Error('Terminal creation failed');

      errorHandler.handleTerminalError(error, 'create');

      expect(consoleErrorStub).to.have.been.calledWith(
        '[TERMINAL ERROR]',
        'Terminal creation failed'
      );
    });

    it('should handle terminal destruction error', () => {
      const error = new Error('Terminal destruction failed');

      errorHandler.handleTerminalError(error, 'destroy');

      expect(consoleErrorStub).to.have.been.calledWith(
        '[TERMINAL ERROR]',
        'Terminal destruction failed'
      );
    });

    it('should include action context in error message', () => {
      const error = new Error('Action failed');

      errorHandler.handleTerminalError(error, 'split');

      expect(consoleErrorStub).to.have.been.calledWith('[TERMINAL ERROR]', 'Action failed');
    });
  });

  describe('handleWebviewError method', () => {
    it('should handle webview communication error', () => {
      const error = new Error('Webview communication failed');

      errorHandler.handleWebviewError(error, 'communication');

      expect(consoleErrorStub).to.have.been.calledWith(
        '[WEBVIEW ERROR]',
        'Webview communication failed'
      );
    });

    it('should handle webview initialization error', () => {
      const error = new Error('Webview initialization failed');

      errorHandler.handleWebviewError(error, 'initialization');

      expect(consoleErrorStub).to.have.been.calledWith(
        '[WEBVIEW ERROR]',
        'Webview initialization failed'
      );
    });

    it('should handle webview rendering error', () => {
      const error = new Error('Webview rendering failed');

      errorHandler.handleWebviewError(error, 'rendering');

      expect(consoleErrorStub).to.have.been.calledWith(
        '[WEBVIEW ERROR]',
        'Webview rendering failed'
      );
    });
  });

  describe('handleConfigurationError method', () => {
    it('should handle configuration loading error', () => {
      const error = new Error('Configuration loading failed');

      errorHandler.handleConfigurationError(error, 'load');

      expect(consoleErrorStub).to.have.been.calledWith(
        '[CONFIG ERROR]',
        'Configuration loading failed'
      );
    });

    it('should handle configuration validation error', () => {
      const error = new Error('Configuration validation failed');

      errorHandler.handleConfigurationError(error, 'validate');

      expect(consoleErrorStub).to.have.been.calledWith(
        '[CONFIG ERROR]',
        'Configuration validation failed'
      );
    });

    it('should handle configuration update error', () => {
      const error = new Error('Configuration update failed');

      errorHandler.handleConfigurationError(error, 'update');

      expect(consoleErrorStub).to.have.been.calledWith(
        '[CONFIG ERROR]',
        'Configuration update failed'
      );
    });
  });

  describe('retry mechanism', () => {
    it('should retry operation on failure', async () => {
      let attempts = 0;
      const operation = sinon.stub().callsFake(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Operation failed');
        }
        return 'success';
      });

      const result = await errorHandler.withRetry(operation);

      expect(result).to.equal('success');
      expect(operation).to.have.been.calledThrice;
    });

    it('should respect max retries limit', async () => {
      const operation = sinon.stub().throws(new Error('Always fails'));

      try {
        await errorHandler.withRetry(operation);
      } catch (error) {
        expect(error.message).to.equal('Always fails');
      }

      expect(operation).to.have.been.calledThrice; // maxRetries = 3
    });

    it('should handle async operations', async () => {
      let attempts = 0;
      const asyncOperation = sinon.stub().callsFake(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Async operation failed');
        }
        return 'async success';
      });

      const result = await errorHandler.withRetry(asyncOperation);

      expect(result).to.equal('async success');
      expect(asyncOperation).to.have.been.calledTwice;
    });
  });

  describe('error classification', () => {
    it('should classify network errors', () => {
      const networkError = new Error('Network request failed');
      networkError.code = 'NETWORK_ERROR';

      const classification = errorHandler.classifyError(networkError);

      expect(classification.type).to.equal('network');
      expect(classification.severity).to.equal('high');
    });

    it('should classify permission errors', () => {
      const permissionError = new Error('Permission denied');
      permissionError.code = 'PERMISSION_DENIED';

      const classification = errorHandler.classifyError(permissionError);

      expect(classification.type).to.equal('permission');
      expect(classification.severity).to.equal('high');
    });

    it('should classify validation errors', () => {
      const validationError = new Error('Invalid input');
      validationError.code = 'VALIDATION_ERROR';

      const classification = errorHandler.classifyError(validationError);

      expect(classification.type).to.equal('validation');
      expect(classification.severity).to.equal('medium');
    });

    it('should classify unknown errors', () => {
      const unknownError = new Error('Unknown error');

      const classification = errorHandler.classifyError(unknownError);

      expect(classification.type).to.equal('unknown');
      expect(classification.severity).to.equal('medium');
    });
  });

  describe('error reporting', () => {
    it('should format error report', () => {
      const error = new Error('Test error');
      const context = { component: 'terminal', action: 'create' };

      const report = errorHandler.formatErrorReport(error, context);

      expect(report).to.include('Test error');
      expect(report).to.include('terminal');
      expect(report).to.include('create');
    });

    it('should include stack trace in detailed mode', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n  at test.js:1:1';

      const report = errorHandler.formatErrorReport(error, {}, true);

      expect(report).to.include('Error: Test error');
      expect(report).to.include('at test.js:1:1');
    });

    it('should handle errors without stack trace', () => {
      const error = new Error('Test error');
      delete error.stack;

      const report = errorHandler.formatErrorReport(error);

      expect(report).to.include('Test error');
      expect(report).to.not.include('undefined');
    });
  });

  describe('error recovery', () => {
    it('should provide recovery suggestions for common errors', () => {
      const error = new Error('Permission denied');
      error.code = 'PERMISSION_DENIED';

      const suggestions = errorHandler.getRecoverySuggestions(error);

      expect(suggestions).to.be.an('array');
      expect(suggestions.length).to.be.greaterThan(0);
      expect(suggestions[0]).to.include('permission');
    });

    it('should provide generic recovery suggestions for unknown errors', () => {
      const error = new Error('Unknown error');

      const suggestions = errorHandler.getRecoverySuggestions(error);

      expect(suggestions).to.be.an('array');
      expect(suggestions.length).to.be.greaterThan(0);
    });
  });

  describe('error suppression', () => {
    it('should suppress duplicate errors', () => {
      const error = new Error('Duplicate error');

      errorHandler.handleError(error);
      errorHandler.handleError(error);

      // Should only log once due to suppression
      expect(consoleErrorStub).to.have.been.calledOnce;
    });

    it('should reset suppression after timeout', (done) => {
      const error = new Error('Timeout error');

      errorHandler.handleError(error);

      setTimeout(() => {
        errorHandler.handleError(error);
        expect(consoleErrorStub).to.have.been.calledTwice;
        done();
      }, 100);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      errorHandler.cleanup();

      // Should clear any timers or resources
      expect(errorHandler.isCleanedUp).to.be.true;
    });

    it('should handle cleanup when already cleaned', () => {
      errorHandler.cleanup();
      errorHandler.cleanup();

      // Should not throw error
      expect(errorHandler.isCleanedUp).to.be.true;
    });
  });
});
