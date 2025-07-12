/* eslint-disable */
// @ts-nocheck

import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { Logger } from '../../../utils/logger';

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
      DEBUG: '',
    },
  };
}

describe('Logger', () => {
  let sandbox: sinon.SinonSandbox;
  let dom: JSDOM;
  let document: Document;
  let consoleLogStub: sinon.SinonStub;
  let consoleWarnStub: sinon.SinonStub;
  let consoleErrorStub: sinon.SinonStub;

  beforeEach(() => {
    setupTestEnvironment();

    // Mock console before JSDOM creation
    consoleLogStub = sinon.stub();
    consoleWarnStub = sinon.stub();
    consoleErrorStub = sinon.stub();

    (global as Record<string, unknown>).console = {
      log: consoleLogStub,
      warn: consoleWarnStub,
      error: consoleErrorStub,
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
  });

  afterEach(() => {
    if (sandbox) {
      sandbox.restore();
    }
    if (dom) {
      dom.window.close();
    }
  });

  describe('Logger class', () => {
    it('should initialize with default log level', () => {
      const logger = new Logger();

      expect(logger).to.be.an('object');
      expect(logger.level).to.equal('info');
    });

    it('should initialize with custom log level', () => {
      const logger = new Logger('debug');

      expect(logger.level).to.equal('debug');
    });

    it('should set log level', () => {
      const logger = new Logger();

      logger.setLevel('error');

      expect(logger.level).to.equal('error');
    });

    it('should handle invalid log level', () => {
      const logger = new Logger();

      logger.setLevel('invalid');

      expect(logger.level).to.equal('info'); // Should default to info
    });
  });

  describe('debug method', () => {
    it('should log debug message when level is debug', () => {
      const logger = new Logger('debug');

      logger.debug('test debug message');

      expect(consoleLogStub).to.have.been.calledWith('[DEBUG]', 'test debug message');
    });

    it('should not log debug message when level is info', () => {
      const logger = new Logger('info');

      logger.debug('test debug message');

      expect(consoleLogStub).to.not.have.been.called;
    });

    it('should log debug message with multiple arguments', () => {
      const logger = new Logger('debug');

      logger.debug('message', { key: 'value' }, 123);

      expect(consoleLogStub).to.have.been.calledWith('[DEBUG]', 'message', { key: 'value' }, 123);
    });
  });

  describe('info method', () => {
    it('should log info message when level is debug', () => {
      const logger = new Logger('debug');

      logger.info('test info message');

      expect(consoleLogStub).to.have.been.calledWith('[INFO]', 'test info message');
    });

    it('should log info message when level is info', () => {
      const logger = new Logger('info');

      logger.info('test info message');

      expect(consoleLogStub).to.have.been.calledWith('[INFO]', 'test info message');
    });

    it('should not log info message when level is warn', () => {
      const logger = new Logger('warn');

      logger.info('test info message');

      expect(consoleLogStub).to.not.have.been.called;
    });
  });

  describe('warn method', () => {
    it('should log warn message when level is debug', () => {
      const logger = new Logger('debug');

      logger.warn('test warn message');

      expect(consoleWarnStub).to.have.been.calledWith('[WARN]', 'test warn message');
    });

    it('should log warn message when level is warn', () => {
      const logger = new Logger('warn');

      logger.warn('test warn message');

      expect(consoleWarnStub).to.have.been.calledWith('[WARN]', 'test warn message');
    });

    it('should not log warn message when level is error', () => {
      const logger = new Logger('error');

      logger.warn('test warn message');

      expect(consoleWarnStub).to.not.have.been.called;
    });
  });

  describe('error method', () => {
    it('should log error message at any level', () => {
      const logger = new Logger('error');

      logger.error('test error message');

      expect(consoleErrorStub).to.have.been.calledWith('[ERROR]', 'test error message');
    });

    it('should log error message with Error object', () => {
      const logger = new Logger('error');
      const error = new Error('test error');

      logger.error('error occurred', error);

      expect(consoleErrorStub).to.have.been.calledWith('[ERROR]', 'error occurred', error);
    });

    it('should log error message even with debug level', () => {
      const logger = new Logger('debug');

      logger.error('test error message');

      expect(consoleErrorStub).to.have.been.calledWith('[ERROR]', 'test error message');
    });
  });

  describe('safeStringify method', () => {
    it('should stringify simple object', () => {
      const logger = new Logger();
      const obj = { name: 'test', value: 123 };

      const result = logger.safeStringify(obj);

      expect(result).to.equal('{"name":"test","value":123}');
    });

    it('should handle circular references', () => {
      const logger = new Logger();
      const obj: any = { name: 'test' };
      obj.self = obj;

      const result = logger.safeStringify(obj);

      expect(result).to.be.a('string');
      expect(result).to.include('name');
    });

    it('should handle null and undefined', () => {
      const logger = new Logger();

      expect(logger.safeStringify(null)).to.equal('null');
      expect(logger.safeStringify(undefined)).to.equal('undefined');
    });

    it('should handle primitive values', () => {
      const logger = new Logger();

      expect(logger.safeStringify('string')).to.equal('"string"');
      expect(logger.safeStringify(123)).to.equal('123');
      expect(logger.safeStringify(true)).to.equal('true');
    });
  });

  describe('convenience methods', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger('debug');
    });

    it('should provide terminal convenience method', () => {
      const terminalLogger = logger.terminal();

      expect(terminalLogger).to.be.a('function');

      terminalLogger('test message');

      expect(consoleLogStub).to.have.been.calledWith('[TERMINAL]', 'test message');
    });

    it('should provide webview convenience method', () => {
      const webviewLogger = logger.webview();

      expect(webviewLogger).to.be.a('function');

      webviewLogger('test message');

      expect(consoleLogStub).to.have.been.calledWith('[WEBVIEW]', 'test message');
    });

    it('should provide provider convenience method', () => {
      const providerLogger = logger.provider();

      expect(providerLogger).to.be.a('function');

      providerLogger('test message');

      expect(consoleLogStub).to.have.been.calledWith('[PROVIDER]', 'test message');
    });

    it('should provide extension convenience method', () => {
      const extensionLogger = logger.extension();

      expect(extensionLogger).to.be.a('function');

      extensionLogger('test message');

      expect(consoleLogStub).to.have.been.calledWith('[EXTENSION]', 'test message');
    });
  });

  describe('log level hierarchy', () => {
    it('should respect log level hierarchy for debug', () => {
      const logger = new Logger('debug');

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleLogStub).to.have.been.calledWith('[DEBUG]', 'debug message');
      expect(consoleLogStub).to.have.been.calledWith('[INFO]', 'info message');
      expect(consoleWarnStub).to.have.been.calledWith('[WARN]', 'warn message');
      expect(consoleErrorStub).to.have.been.calledWith('[ERROR]', 'error message');
    });

    it('should respect log level hierarchy for info', () => {
      const logger = new Logger('info');

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleLogStub).to.not.have.been.calledWith('[DEBUG]', 'debug message');
      expect(consoleLogStub).to.have.been.calledWith('[INFO]', 'info message');
      expect(consoleWarnStub).to.have.been.calledWith('[WARN]', 'warn message');
      expect(consoleErrorStub).to.have.been.calledWith('[ERROR]', 'error message');
    });

    it('should respect log level hierarchy for warn', () => {
      const logger = new Logger('warn');

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleLogStub).to.not.have.been.calledWith('[DEBUG]', 'debug message');
      expect(consoleLogStub).to.not.have.been.calledWith('[INFO]', 'info message');
      expect(consoleWarnStub).to.have.been.calledWith('[WARN]', 'warn message');
      expect(consoleErrorStub).to.have.been.calledWith('[ERROR]', 'error message');
    });

    it('should respect log level hierarchy for error', () => {
      const logger = new Logger('error');

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleLogStub).to.not.have.been.calledWith('[DEBUG]', 'debug message');
      expect(consoleLogStub).to.not.have.been.calledWith('[INFO]', 'info message');
      expect(consoleWarnStub).to.not.have.been.calledWith('[WARN]', 'warn message');
      expect(consoleErrorStub).to.have.been.calledWith('[ERROR]', 'error message');
    });
  });

  describe('environment detection', () => {
    it('should detect test environment', () => {
      (global as any).process.env.NODE_ENV = 'test';

      const logger = new Logger();

      expect(logger.isTestEnvironment()).to.be.true;
    });

    it('should detect development environment', () => {
      (global as any).process.env.NODE_ENV = 'development';

      const logger = new Logger();

      expect(logger.isTestEnvironment()).to.be.false;
    });

    it('should handle debug environment variable', () => {
      (global as any).process.env.DEBUG = 'sidebarTerminal:*';

      const logger = new Logger();

      expect(logger.isDebugEnabled()).to.be.true;
    });

    it('should handle no debug environment variable', () => {
      (global as any).process.env.DEBUG = '';

      const logger = new Logger();

      expect(logger.isDebugEnabled()).to.be.false;
    });
  });

  describe('singleton pattern', () => {
    it('should provide singleton instance', () => {
      const logger1 = Logger.getInstance();
      const logger2 = Logger.getInstance();

      expect(logger1).to.equal(logger2);
    });

    it('should maintain singleton state', () => {
      const logger1 = Logger.getInstance();
      logger1.setLevel('debug');

      const logger2 = Logger.getInstance();

      expect(logger2.level).to.equal('debug');
    });
  });
});
