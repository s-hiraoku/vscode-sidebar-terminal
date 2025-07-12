/* eslint-disable */
// @ts-nocheck

import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { FeedbackManager, TerminalErrorHandler } from '../../../utils/feedback';

// Mock VS Code API
const mockVscode = {
  workspace: {
    getConfiguration: sinon.stub(),
  },
  window: {
    showErrorMessage: sinon.stub(),
    showWarningMessage: sinon.stub(),
    showInformationMessage: sinon.stub(),
    withProgress: sinon.stub(),
    createStatusBarItem: sinon.stub(),
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  ProgressLocation: {
    Notification: 1,
    Window: 2,
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

describe('FeedbackManager', () => {
  let sandbox: sinon.SinonSandbox;
  let dom: JSDOM;
  let document: Document;
  let feedbackManager: FeedbackManager;

  beforeEach(() => {
    setupTestEnvironment();

    // Mock console before JSDOM creation
    (global as Record<string, unknown>).console = {
      log: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    };

    // Set up process.nextTick before JSDOM creation
    const originalProcess = global.process;
    (global as any).process = {
      ...originalProcess,
      nextTick: (callback: () => void) => setImmediate(callback),
      env: { ...originalProcess.env, NODE_ENV: 'test' },
    };

    dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
    document = dom.window.document;
    (global as any).document = document;
    (global as any).window = dom.window;

    sandbox = sinon.createSandbox();
    feedbackManager = FeedbackManager.getInstance();
  });

  afterEach(() => {
    if (sandbox) {
      sandbox.restore();
    }
    if (dom) {
      dom.window.close();
    }
    // Reset singleton instance
    FeedbackManager.resetInstance();
  });

  describe('singleton pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = FeedbackManager.getInstance();
      const instance2 = FeedbackManager.getInstance();

      expect(instance1).to.equal(instance2);
    });

    it('should initialize with default configuration', () => {
      expect(feedbackManager.isEnabled).to.be.true;
      expect(feedbackManager.autoHide).to.be.true;
      expect(feedbackManager.duration).to.equal(5000);
    });
  });

  describe('showFeedback method', () => {
    it('should show info feedback', async () => {
      await feedbackManager.showFeedback('Test info message', 'info');

      expect(mockVscode.window.showInformationMessage).to.have.been.calledWith('Test info message');
    });

    it('should show warning feedback', async () => {
      await feedbackManager.showFeedback('Test warning message', 'warning');

      expect(mockVscode.window.showWarningMessage).to.have.been.calledWith('Test warning message');
    });

    it('should show error feedback', async () => {
      await feedbackManager.showFeedback('Test error message', 'error');

      expect(mockVscode.window.showErrorMessage).to.have.been.calledWith('Test error message');
    });

    it('should handle feedback with actions', async () => {
      const actions = ['Action 1', 'Action 2'];

      await feedbackManager.showFeedback('Test message', 'info', actions);

      expect(mockVscode.window.showInformationMessage).to.have.been.calledWith(
        'Test message',
        ...actions
      );
    });

    it('should not show feedback when disabled', async () => {
      feedbackManager.setEnabled(false);

      await feedbackManager.showFeedback('Test message', 'info');

      expect(mockVscode.window.showInformationMessage).to.not.have.been.called;
    });
  });

  describe('showProgress method', () => {
    it('should show progress notification', async () => {
      const progressSpy = sinon.spy();
      mockVscode.window.withProgress.returns(Promise.resolve('completed'));

      await feedbackManager.showProgress('Processing...', progressSpy);

      expect(mockVscode.window.withProgress).to.have.been.called;
    });

    it('should handle progress with custom location', async () => {
      const progressSpy = sinon.spy();
      mockVscode.window.withProgress.returns(Promise.resolve('completed'));

      await feedbackManager.showProgress(
        'Processing...',
        progressSpy,
        mockVscode.ProgressLocation.Window
      );

      expect(mockVscode.window.withProgress).to.have.been.calledWith({
        location: mockVscode.ProgressLocation.Window,
        title: 'Processing...',
        cancellable: true,
      });
    });

    it('should handle progress cancellation', async () => {
      const progressSpy = sinon.spy();
      const cancelToken = { isCancellationRequested: true };
      mockVscode.window.withProgress.callsArgWith(1, { report: sinon.spy() }, cancelToken);

      await feedbackManager.showProgress('Processing...', progressSpy);

      expect(mockVscode.window.withProgress).to.have.been.called;
    });
  });

  describe('status bar integration', () => {
    it('should create status bar item', () => {
      const statusBarItem = {
        text: '',
        tooltip: '',
        show: sinon.spy(),
        hide: sinon.spy(),
        dispose: sinon.spy(),
      };
      mockVscode.window.createStatusBarItem.returns(statusBarItem);

      feedbackManager.createStatusBarItem('test-item');

      expect(mockVscode.window.createStatusBarItem).to.have.been.called;
    });

    it('should update status bar item', () => {
      const statusBarItem = {
        text: '',
        tooltip: '',
        show: sinon.spy(),
        hide: sinon.spy(),
        dispose: sinon.spy(),
      };
      mockVscode.window.createStatusBarItem.returns(statusBarItem);

      feedbackManager.createStatusBarItem('test-item');
      feedbackManager.updateStatusBarItem('test-item', 'Updated text', 'Updated tooltip');

      expect(statusBarItem.text).to.equal('Updated text');
      expect(statusBarItem.tooltip).to.equal('Updated tooltip');
    });

    it('should show/hide status bar item', () => {
      const statusBarItem = {
        text: '',
        tooltip: '',
        show: sinon.spy(),
        hide: sinon.spy(),
        dispose: sinon.spy(),
      };
      mockVscode.window.createStatusBarItem.returns(statusBarItem);

      feedbackManager.createStatusBarItem('test-item');
      feedbackManager.showStatusBarItem('test-item');
      feedbackManager.hideStatusBarItem('test-item');

      expect(statusBarItem.show).to.have.been.called;
      expect(statusBarItem.hide).to.have.been.called;
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const config = {
        enabled: false,
        autoHide: false,
        duration: 10000,
      };

      feedbackManager.updateConfig(config);

      expect(feedbackManager.isEnabled).to.be.false;
      expect(feedbackManager.autoHide).to.be.false;
      expect(feedbackManager.duration).to.equal(10000);
    });

    it('should enable/disable feedback', () => {
      feedbackManager.setEnabled(false);
      expect(feedbackManager.isEnabled).to.be.false;

      feedbackManager.setEnabled(true);
      expect(feedbackManager.isEnabled).to.be.true;
    });

    it('should set auto-hide behavior', () => {
      feedbackManager.setAutoHide(false);
      expect(feedbackManager.autoHide).to.be.false;

      feedbackManager.setAutoHide(true);
      expect(feedbackManager.autoHide).to.be.true;
    });

    it('should set duration', () => {
      feedbackManager.setDuration(8000);
      expect(feedbackManager.duration).to.equal(8000);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      const statusBarItem = {
        text: '',
        tooltip: '',
        show: sinon.spy(),
        hide: sinon.spy(),
        dispose: sinon.spy(),
      };
      mockVscode.window.createStatusBarItem.returns(statusBarItem);

      feedbackManager.createStatusBarItem('test-item');
      feedbackManager.cleanup();

      expect(statusBarItem.dispose).to.have.been.called;
    });
  });
});

describe('TerminalErrorHandler', () => {
  let sandbox: sinon.SinonSandbox;
  let dom: JSDOM;
  let document: Document;
  let errorHandler: TerminalErrorHandler;

  beforeEach(() => {
    setupTestEnvironment();

    // Mock console before JSDOM creation
    (global as Record<string, unknown>).console = {
      log: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    };

    // Set up process.nextTick before JSDOM creation
    const originalProcess = global.process;
    (global as any).process = {
      ...originalProcess,
      nextTick: (callback: () => void) => setImmediate(callback),
      env: { ...originalProcess.env, NODE_ENV: 'test' },
    };

    dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
    document = dom.window.document;
    (global as any).document = document;
    (global as any).window = dom.window;

    sandbox = sinon.createSandbox();
    errorHandler = new TerminalErrorHandler();
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
      expect(errorHandler.isEnabled).to.be.true;
      expect(errorHandler.showUserNotifications).to.be.true;
    });

    it('should initialize with custom configuration', () => {
      const customHandler = new TerminalErrorHandler({
        enabled: false,
        showUserNotifications: false,
        logLevel: 'debug',
      });

      expect(customHandler.isEnabled).to.be.false;
      expect(customHandler.showUserNotifications).to.be.false;
    });
  });

  describe('handleTerminalError method', () => {
    it('should handle terminal creation error', async () => {
      const error = new Error('Terminal creation failed');

      await errorHandler.handleTerminalError(error, 'create');

      expect(mockVscode.window.showErrorMessage).to.have.been.called;
    });

    it('should handle terminal connection error', async () => {
      const error = new Error('Connection failed');

      await errorHandler.handleTerminalError(error, 'connect');

      expect(mockVscode.window.showErrorMessage).to.have.been.called;
    });

    it('should handle terminal kill error', async () => {
      const error = new Error('Kill failed');

      await errorHandler.handleTerminalError(error, 'kill');

      expect(mockVscode.window.showErrorMessage).to.have.been.called;
    });

    it('should not show notifications when disabled', async () => {
      errorHandler.setShowUserNotifications(false);
      const error = new Error('Test error');

      await errorHandler.handleTerminalError(error, 'create');

      expect(mockVscode.window.showErrorMessage).to.not.have.been.called;
    });
  });

  describe('handleWebviewError method', () => {
    it('should handle webview communication error', async () => {
      const error = new Error('Communication failed');

      await errorHandler.handleWebviewError(error, 'communication');

      expect(mockVscode.window.showErrorMessage).to.have.been.called;
    });

    it('should handle webview initialization error', async () => {
      const error = new Error('Initialization failed');

      await errorHandler.handleWebviewError(error, 'initialization');

      expect(mockVscode.window.showErrorMessage).to.have.been.called;
    });
  });

  describe('handleConfigurationError method', () => {
    it('should handle configuration loading error', async () => {
      const error = new Error('Configuration loading failed');

      await errorHandler.handleConfigurationError(error, 'load');

      expect(mockVscode.window.showErrorMessage).to.have.been.called;
    });

    it('should handle configuration validation error', async () => {
      const error = new Error('Validation failed');

      await errorHandler.handleConfigurationError(error, 'validate');

      expect(mockVscode.window.showErrorMessage).to.have.been.called;
    });
  });

  describe('error recovery', () => {
    it('should provide recovery actions for terminal errors', async () => {
      const error = new Error('Terminal creation failed');

      await errorHandler.handleTerminalError(error, 'create');

      const callArgs = mockVscode.window.showErrorMessage.getCall(0).args;
      expect(callArgs).to.include('Retry');
    });

    it('should handle retry action', async () => {
      const retryCallback = sinon.spy();
      errorHandler.setRetryCallback(retryCallback);

      const error = new Error('Terminal creation failed');
      await errorHandler.handleTerminalError(error, 'create');

      // Simulate user clicking retry
      const callArgs = mockVscode.window.showErrorMessage.getCall(0).args;
      if (callArgs.includes('Retry')) {
        await errorHandler.handleRetryAction('create');
        expect(retryCallback).to.have.been.calledWith('create');
      }
    });
  });

  describe('error reporting', () => {
    it('should generate error report', () => {
      const error = new Error('Test error');
      const context = { action: 'create', terminalId: 'test-123' };

      const report = errorHandler.generateErrorReport(error, context);

      expect(report).to.include('Test error');
      expect(report).to.include('create');
      expect(report).to.include('test-123');
    });

    it('should include stack trace in debug mode', () => {
      errorHandler.setLogLevel('debug');
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n  at test.js:1:1';

      const report = errorHandler.generateErrorReport(error, {});

      expect(report).to.include('Error: Test error');
      expect(report).to.include('at test.js:1:1');
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const config = {
        enabled: false,
        showUserNotifications: false,
        logLevel: 'error',
      };

      errorHandler.updateConfig(config);

      expect(errorHandler.isEnabled).to.be.false;
      expect(errorHandler.showUserNotifications).to.be.false;
      expect(errorHandler.logLevel).to.equal('error');
    });

    it('should enable/disable error handling', () => {
      errorHandler.setEnabled(false);
      expect(errorHandler.isEnabled).to.be.false;

      errorHandler.setEnabled(true);
      expect(errorHandler.isEnabled).to.be.true;
    });

    it('should set log level', () => {
      errorHandler.setLogLevel('debug');
      expect(errorHandler.logLevel).to.equal('debug');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      errorHandler.cleanup();

      expect(errorHandler.isCleanedUp).to.be.true;
    });

    it('should handle cleanup when already cleaned', () => {
      errorHandler.cleanup();
      errorHandler.cleanup();

      expect(errorHandler.isCleanedUp).to.be.true;
    });
  });
});
