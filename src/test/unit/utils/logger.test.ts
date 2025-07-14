/* eslint-disable */
// @ts-nocheck

import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { logger, LogLevel } from '../../../utils/logger';

// Import shared test setup
import '../test-setup';

describe('Logger', () => {
  let sandbox: sinon.SinonSandbox;
  let dom: JSDOM;
  let document: Document;
  let consoleLogStub: sinon.SinonStub;
  let consoleWarnStub: sinon.SinonStub;
  let consoleErrorStub: sinon.SinonStub;

  beforeEach(() => {
    // Mock console before JSDOM creation
    consoleLogStub = sinon.stub();
    consoleWarnStub = sinon.stub();
    consoleErrorStub = sinon.stub();

    (global as Record<string, unknown>).console = {
      log: consoleLogStub,
      warn: consoleWarnStub,
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

    sandbox = sinon.createSandbox();

    // Mock DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable',
    });

    document = dom.window.document;
    (global as Record<string, unknown>).window = dom.window;
    (global as Record<string, unknown>).document = document;

    // Reset logger to default state
    logger.setLevel(LogLevel.DEBUG);
  });

  afterEach(() => {
    sandbox.restore();
    dom.window.close();
  });

  describe('setLevel method', () => {
    it('should set log level', () => {
      logger.setLevel(LogLevel.ERROR);
      // Test that the level was set by checking logging behavior
      logger.debug('debug message');
      expect(consoleLogStub).not.to.have.been.called;
    });
  });

  describe('debug method', () => {
    it('should log debug message when level is debug', () => {
      logger.setLevel(LogLevel.DEBUG);

      logger.debug('test debug message');

      expect(consoleLogStub).to.have.been.calledWith('[DEBUG]', 'test debug message');
    });

    it('should not log debug message when level is info', () => {
      logger.setLevel(LogLevel.INFO);

      logger.debug('test debug message');

      expect(consoleLogStub).not.to.have.been.called;
    });
  });

  describe('info method', () => {
    it('should log info message when level is info', () => {
      logger.setLevel(LogLevel.INFO);

      logger.info('test info message');

      expect(consoleLogStub).to.have.been.calledWith('[INFO]', 'test info message');
    });

    it('should not log info message when level is warn', () => {
      logger.setLevel(LogLevel.WARN);

      logger.info('test info message');

      expect(consoleLogStub).not.to.have.been.called;
    });
  });

  describe('warn method', () => {
    it('should log warn message when level is warn', () => {
      logger.setLevel(LogLevel.WARN);

      logger.warn('test warn message');

      expect(consoleWarnStub).to.have.been.calledWith('[WARN]', 'test warn message');
    });

    it('should not log warn message when level is error', () => {
      logger.setLevel(LogLevel.ERROR);

      logger.warn('test warn message');

      expect(consoleWarnStub).not.to.have.been.called;
    });
  });

  describe('error method', () => {
    it('should log error message when level is error', () => {
      logger.setLevel(LogLevel.ERROR);

      logger.error('test error message');

      expect(consoleErrorStub).to.have.been.calledWith('[ERROR]', 'test error message');
    });

    it('should not log error message when level is none', () => {
      logger.setLevel(LogLevel.NONE);

      logger.error('test error message');

      expect(consoleErrorStub).not.to.have.been.called;
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      logger.setLevel(LogLevel.DEBUG);
    });

    it('should log terminal message', () => {
      logger.terminal('terminal test');

      expect(consoleLogStub).to.have.been.calledWith('[DEBUG]', '🔌 [TERMINAL]', 'terminal test');
    });

    it('should log webview message', () => {
      logger.webview('webview test');

      expect(consoleLogStub).to.have.been.calledWith('[DEBUG]', '🌐 [WEBVIEW]', 'webview test');
    });

    it('should log provider message', () => {
      logger.provider('provider test');

      expect(consoleLogStub).to.have.been.calledWith('[DEBUG]', '📡 [PROVIDER]', 'provider test');
    });

    it('should log extension message', () => {
      logger.extension('extension test');

      expect(consoleLogStub).to.have.been.calledWith('[DEBUG]', '🔧 [EXTENSION]', 'extension test');
    });

    it('should log performance message', () => {
      logger.performance('performance test');

      expect(consoleLogStub).to.have.been.calledWith('[DEBUG]', '⚡ [PERF]', 'performance test');
    });
  });

  describe('object logging', () => {
    beforeEach(() => {
      logger.setLevel(LogLevel.DEBUG);
    });

    it('should safely stringify objects', () => {
      const testObj = { key: 'value', nested: { prop: 'test' } };

      logger.debug('object test', testObj);

      expect(consoleLogStub).to.have.been.calledWith(
        '[DEBUG]',
        'object test',
        JSON.stringify(testObj, null, 2)
      );
    });

    it('should handle circular references', () => {
      const circularObj: any = { prop: 'value' };
      circularObj.self = circularObj;

      logger.debug('circular test', circularObj);

      expect(consoleLogStub).to.have.been.calledWith(
        '[DEBUG]',
        'circular test',
        '[Complex Object]'
      );
    });

    it('should handle primitives', () => {
      logger.debug('string', 'test', 'number', 123, 'boolean', true, 'null', null);

      expect(consoleLogStub).to.have.been.calledWith(
        '[DEBUG]',
        'string',
        'test',
        'number',
        123,
        'boolean',
        true,
        'null',
        'null'
      );
    });
  });
});
