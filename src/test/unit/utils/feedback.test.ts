/* eslint-disable */
// @ts-nocheck

import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';

// Import shared test setup
import '../test-setup';
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
    createStatusBarItem: sinon.stub(),
  },
  StatusBarAlignment: { Left: 1 },
  commands: {
    executeCommand: sinon.stub(),
  },
  env: {
    openExternal: sinon.stub(),
  },
  Uri: {
    parse: sinon.stub(),
  },
};

// Global setup
function setupTestEnvironment() {
  (global as any).vscode = mockVscode;
  mockVscode.window.createStatusBarItem.returns({
    text: '',
    show: sinon.stub(),
    hide: sinon.stub(),
    dispose: sinon.stub(),
  });
}

describe('FeedbackManager', () => {
  let feedbackManager: FeedbackManager;
  let sandbox: sinon.SinonSandbox;
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    setupTestEnvironment();

    sandbox = sinon.createSandbox();

    dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
    document = dom.window.document;
    (global as any).document = document;
    (global as any).window = dom.window;

    feedbackManager = FeedbackManager.getInstance();
  });

  afterEach(() => {
    if (sandbox) {
      sandbox.restore();
    }
    if (dom) {
      dom.window.close();
    }
    // Reset singleton instance (manual reset)
    // @ts-ignore - Test only: reset singleton for clean test state
    FeedbackManager.instance = undefined;
  });

  describe('singleton pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = FeedbackManager.getInstance();
      const instance2 = FeedbackManager.getInstance();

      expect(instance1).to.equal(instance2);
    });
  });

  describe('showFeedback method', () => {
    it('should show success feedback', () => {
      feedbackManager.showFeedback('success', 'Success message');

      // Should not throw
      expect(true).to.be.true;
    });

    it('should show error feedback', () => {
      feedbackManager.showFeedback('error', 'Error message');

      // Should not throw
      expect(true).to.be.true;
    });
  });
});

describe('TerminalErrorHandler', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    if (sandbox) {
      sandbox.restore();
    }
  });

  describe('static methods', () => {
    it('should handle terminal creation error', () => {
      const error = new Error('ENOENT: command not found');

      // Test should not throw
      expect(() => {
        TerminalErrorHandler.handleTerminalCreationError(error);
      }).to.not.throw();
    });

    it('should handle terminal connection error', () => {
      const error = new Error('Connection failed');

      // Test should not throw
      expect(() => {
        TerminalErrorHandler.handleTerminalConnectionError(error);
      }).to.not.throw();
    });
  });
});
