/* eslint-disable */
// @ts-nocheck

import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { ErrorHandler } from '../../../../webview/utils/ErrorHandler';
import { setupJSDOMEnvironment } from '../../../shared/TestSetup';

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
  let consoleMocks: any;

  beforeEach(() => {
    setupTestEnvironment();

    // Mock console before JSDOM creation
    consoleErrorStub = sinon.stub();
    consoleMocks = {
      log: sinon.stub(),
      warn: sinon.stub(),
      error: consoleErrorStub,
      debug: sinon.stub(),
      info: sinon.stub(),
      trace: sinon.stub(),
      assert: sinon.stub(),
      clear: sinon.stub(),
      count: sinon.stub(),
      countReset: sinon.stub(),
      group: sinon.stub(),
      groupCollapsed: sinon.stub(),
      groupEnd: sinon.stub(),
      table: sinon.stub(),
      time: sinon.stub(),
      timeEnd: sinon.stub(),
      timeLog: sinon.stub(),
      timeStamp: sinon.stub(),
      profile: sinon.stub(),
      profileEnd: sinon.stub(),
      dir: sinon.stub(),
      dirxml: sinon.stub(),
    };
    (global as Record<string, unknown>).console = consoleMocks;

    sandbox = sinon.createSandbox();

    // Use proper test setup for JSDOM environment
    const testEnv = setupJSDOMEnvironment('<!DOCTYPE html><html><body></body></html>');
    dom = testEnv.dom;
    document = testEnv.document;

    // Initialize ErrorHandler after DOM setup
    errorHandler = ErrorHandler.getInstance();
  });

  afterEach(() => {
    sandbox.restore();
    if (dom && dom.window) {
      dom.window.close();
    }

    // Clear singleton instance for clean tests
    (ErrorHandler as any).instance = undefined;

    // Clean up global references
    delete (global as any).window;
    delete (global as any).document;
  });

  describe('getInstance method', () => {
    it('should return singleton instance', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();

      expect(instance1).to.equal(instance2);
    });
  });

  describe('basic error handling', () => {
    it('should handle Error objects', () => {
      const error = new Error('Test error message');

      errorHandler.handleGenericError(error, 'test');

      expect(consoleErrorStub).to.have.been.calledWith('[GENERIC_ERROR] test:', error);
    });

    it('should handle string errors', () => {
      const error = new Error('String error message');

      errorHandler.handleGenericError(error, 'test');

      expect(consoleErrorStub).to.have.been.calledWith('[GENERIC_ERROR] test:', error);
    });

    it('should handle errors with context', () => {
      const error = new Error('Test error');
      const context = 'testing-context';

      errorHandler.handleGenericError(error, context);

      expect(consoleErrorStub).to.have.been.calledWith('[GENERIC_ERROR] testing-context:', error);
    });
  });

  describe('safe execution methods', () => {
    it('should execute function safely and return result', () => {
      const result = ErrorHandler.safeExecute(() => 'success', 'test');

      expect(result).to.equal('success');
    });

    it('should catch errors and return fallback', () => {
      const result = ErrorHandler.safeExecute(
        () => {
          throw new Error('Test error');
        },
        'test',
        'fallback'
      );

      expect(result).to.equal('fallback');
      expect(consoleErrorStub).to.have.been.called;
    });

    it('should execute async functions safely', async () => {
      const result = await ErrorHandler.safeExecuteAsync(async () => 'async-success', 'test');

      expect(result).to.equal('async-success');
    });

    it('should catch async errors and return fallback', async () => {
      const result = await ErrorHandler.safeExecuteAsync(
        async () => {
          throw new Error('Async error');
        },
        'test',
        'async-fallback'
      );

      expect(result).to.equal('async-fallback');
      expect(consoleErrorStub).to.have.been.called;
    });
  });

  describe('handleTerminalError method', () => {
    it('should handle terminal creation error', () => {
      const error = new Error('Terminal creation failed');

      errorHandler.handleTerminalError(error, 'create');

      expect(consoleErrorStub).to.have.been.calledWith('[TERMINAL_ERROR] create:', error);
    });

    it('should handle terminal destruction error', () => {
      const error = new Error('Terminal destruction failed');

      errorHandler.handleTerminalError(error, 'destroy');

      expect(consoleErrorStub).to.have.been.calledWith('[TERMINAL_ERROR] destroy:', error);
    });

    it('should include action context in error message', () => {
      const error = new Error('Action failed');

      errorHandler.handleTerminalError(error, 'split');

      expect(consoleErrorStub).to.have.been.calledWith('[TERMINAL_ERROR] split:', error);
    });
  });

  describe('handleCommunicationError method', () => {
    it('should handle webview communication error', () => {
      const error = new Error('Webview communication failed');

      errorHandler.handleCommunicationError(error, 'communication');

      expect(consoleErrorStub).to.have.been.calledWith(
        '[COMMUNICATION_ERROR] communication:',
        error
      );
    });

    it('should handle webview initialization error', () => {
      const error = new Error('Webview initialization failed');

      errorHandler.handleCommunicationError(error, 'initialization');

      expect(consoleErrorStub).to.have.been.calledWith(
        '[COMMUNICATION_ERROR] initialization:',
        error
      );
    });

    it('should handle webview rendering error', () => {
      const error = new Error('Webview rendering failed');

      errorHandler.handleCommunicationError(error, 'rendering');

      expect(consoleErrorStub).to.have.been.calledWith('[COMMUNICATION_ERROR] rendering:', error);
    });
  });

  describe('handleSettingsError method', () => {
    it('should handle configuration loading error', () => {
      const error = new Error('Configuration loading failed');

      errorHandler.handleSettingsError(error, 'load');

      expect(consoleErrorStub).to.have.been.calledWith('[SETTINGS_ERROR] load:', error);
    });

    it('should handle configuration validation error', () => {
      const error = new Error('Configuration validation failed');

      errorHandler.handleSettingsError(error, 'validate');

      expect(consoleErrorStub).to.have.been.calledWith('[SETTINGS_ERROR] validate:', error);
    });

    it('should handle configuration update error', () => {
      const error = new Error('Configuration update failed');

      errorHandler.handleSettingsError(error, 'update');

      expect(consoleErrorStub).to.have.been.calledWith('[SETTINGS_ERROR] update:', error);
    });
  });
});
