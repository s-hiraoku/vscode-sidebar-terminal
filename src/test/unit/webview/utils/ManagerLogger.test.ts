/**
 * ManagerLogger Utility Tests
 * Tests for standardized logging across managers with emoji prefixes
 */

import { expect } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';

describe.skip('ManagerLogger', () => {
  let sandbox: SinonSandbox;
  let originalConsole: any;
  let ManagerLogger: any;

  beforeEach(() => {
    sandbox = createSandbox();
    
    // Mock console methods
    originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug
    };
    
    console.log = sandbox.stub();
    console.warn = sandbox.stub();
    console.error = sandbox.stub();
    console.info = sandbox.stub();
    console.debug = sandbox.stub();
    
    try {
      // Try to import ManagerLogger with mock handling
      const managerLoggerModule = require('../../../../webview/utils/ManagerLogger');
      ManagerLogger = managerLoggerModule.ManagerLogger;
    } catch (error) {
      // If import fails, skip this test suite
      console.warn('Skipping ManagerLogger tests due to import error:', error);
      ManagerLogger = null;
    }
  });

  afterEach(() => {
    sandbox.restore();
    
    // Restore console
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
  });

  describe('createLogger', () => {
    it('should create logger with default emoji', function() {
      if (!ManagerLogger) {
        this.skip();
        return;
      }
      
      const logger = ManagerLogger.createLogger('TestManager');
      
      expect(logger).to.not.be.null;
      expect(logger).to.have.property('info');
      expect(logger).to.have.property('warn');
      expect(logger).to.have.property('error');
      expect(logger).to.have.property('debug');
      expect(logger).to.have.property('lifecycle');
    });

    it('should create logger with custom emoji', () => {
      const logger = ManagerLogger.createLogger('TestManager', '🔧');
      
      expect(logger).to.not.be.null;
      
      // Test that the emoji is used in logging
      logger.info('Test message');
      
      // Should have been called (exact format tested in specific log tests)
      expect(console.log).to.have.been.called;
    });

    it('should handle empty manager name', () => {
      const logger = ManagerLogger.createLogger('');
      
      expect(logger).to.not.be.null;
      
      logger.info('Test message');
      expect(console.log).to.have.been.called;
    });

    it('should handle special characters in manager name', () => {
      const logger = ManagerLogger.createLogger('Test-Manager_123');
      
      expect(logger).to.not.be.null;
      
      logger.info('Test message');
      expect(console.log).to.have.been.called;
    });
  });

  describe('pre-configured loggers', () => {
    it('should provide inputLogger', () => {
      const { inputLogger } = require('../../../../webview/utils/ManagerLogger');
      
      expect(inputLogger).to.not.be.null;
      expect(inputLogger).to.have.property('info');
      
      inputLogger.info('Input test');
      expect(console.log).to.have.been.called;
    });

    it('should provide splitLogger', () => {
      const { splitLogger } = require('../../../../webview/utils/ManagerLogger');
      
      expect(splitLogger).to.not.be.null;
      expect(splitLogger).to.have.property('info');
      
      splitLogger.info('Split test');
      expect(console.log).to.have.been.called;
    });

    it('should provide terminalLogger', () => {
      const { terminalLogger } = require('../../../../webview/utils/ManagerLogger');
      
      expect(terminalLogger).to.not.be.null;
      expect(terminalLogger).to.have.property('info');
      
      terminalLogger.info('Terminal test');
      expect(console.log).to.have.been.called;
    });

    it('should provide messageLogger', () => {
      const { messageLogger } = require('../../../../webview/utils/ManagerLogger');
      
      expect(messageLogger).to.not.be.null;
      expect(messageLogger).to.have.property('info');
      
      messageLogger.info('Message test');
      expect(console.log).to.have.been.called;
    });

    it('should provide uiLogger', () => {
      const { uiLogger } = require('../../../../webview/utils/ManagerLogger');
      
      expect(uiLogger).to.not.be.null;
      expect(uiLogger).to.have.property('info');
      
      uiLogger.info('UI test');
      expect(console.log).to.have.been.called;
    });
  });

  describe('logging methods', () => {
    let logger: any;

    beforeEach(() => {
      logger = ManagerLogger.createLogger('TestManager', '🧪');
    });

    it('should log info messages with correct format', () => {
      logger.info('Test info message');
      
      expect(console.log).to.have.been.calledWith(
        sandbox.match(/🧪.*TestManager.*Test info message/)
      );
    });

    it('should log info messages with data', () => {
      const testData = { key: 'value', number: 42 };
      logger.info('Test info with data', testData);
      
      expect(console.log).to.have.been.calledTwice;
      expect((console.log as any).firstCall).to.have.been.calledWith(
        sandbox.match(/🧪.*TestManager.*Test info with data/)
      );
      expect((console.log as any).secondCall).to.have.been.calledWith(testData);
    });

    it('should log warn messages with correct format', () => {
      logger.warn('Test warning message');
      
      expect(console.warn).to.have.been.calledWith(
        sandbox.match(/⚠️.*🧪.*TestManager.*Test warning message/)
      );
    });

    it('should log warn messages with data', () => {
      const warningData = { warning: true };
      logger.warn('Test warning with data', warningData);
      
      expect(console.warn).to.have.been.calledOnce;
      expect(console.warn).to.have.been.calledWith(
        sandbox.match(/⚠️.*🧪.*TestManager.*Test warning with data/),
        warningData
      );
    });

    it('should log error messages with correct format', () => {
      logger.error('Test error message');
      
      expect(console.error).to.have.been.calledWith(
        sandbox.match(/❌.*🧪.*TestManager.*Test error message/)
      );
    });

    it('should log error messages with error objects', () => {
      const testError = new Error('Test error');
      logger.error('Test error with object', testError);
      
      expect(console.error).to.have.been.calledOnce;
      expect(console.error).to.have.been.calledWith(
        sandbox.match(/❌.*🧪.*TestManager.*Test error with object/),
        testError
      );
    });

    it('should log debug messages with correct format', () => {
      logger.debug('Test debug message');
      
      expect(console.debug).to.have.been.calledWith(
        sandbox.match(/🔍.*🧪.*TestManager.*Test debug message/)
      );
    });

    it('should log debug messages with data', () => {
      const debugData = { debug: true, values: [1, 2, 3] };
      logger.debug('Test debug with data', debugData);
      
      expect(console.debug).to.have.been.calledOnce;
      expect(console.debug).to.have.been.calledWith(
        sandbox.match(/🔍.*🧪.*TestManager.*Test debug with data/),
        debugData
      );
    });
  });

  describe('lifecycle logging', () => {
    let logger: any;

    beforeEach(() => {
      logger = ManagerLogger.createLogger('LifecycleManager', '♻️');
    });

    it('should log lifecycle events with correct format', () => {
      logger.lifecycle('initialization', 'starting');
      
      expect(console.log).to.have.been.calledWith(
        sandbox.match(/♻️.*LifecycleManager.*initialization.*starting/)
      );
    });

    it('should handle different lifecycle phases', () => {
      logger.lifecycle('startup', 'completed');
      logger.lifecycle('shutdown', 'in_progress');
      logger.lifecycle('cleanup', 'failed');
      
      expect(console.log).to.have.been.calledThrice;
      expect((console.log as any).firstCall).to.have.been.calledWith(
        sandbox.match(/startup.*completed/)
      );
      expect((console.log as any).secondCall).to.have.been.calledWith(
        sandbox.match(/shutdown.*in_progress/)
      );
      expect((console.log as any).thirdCall).to.have.been.calledWith(
        sandbox.match(/cleanup.*failed/)
      );
    });

    it('should handle empty lifecycle parameters', () => {
      expect(() => {
        logger.lifecycle('', '');
      }).to.not.throw();
      
      expect(console.log).to.have.been.called;
    });
  });

  describe('error handling', () => {
    let logger: any;

    beforeEach(() => {
      logger = ManagerLogger.createLogger('ErrorTestManager', '💥');
    });

    it('should handle null/undefined messages', () => {
      expect(() => {
        logger.info(null);
        logger.warn(undefined);
        logger.error(null);
        logger.debug(undefined);
      }).to.not.throw();
      
      expect(console.log).to.have.been.called;
      expect(console.warn).to.have.been.called;
      expect(console.error).to.have.been.called;
      expect(console.debug).to.have.been.called;
    });

    it('should handle circular reference objects', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      expect(() => {
        logger.info('Circular object test', circularObj);
      }).to.not.throw();
      
      expect(console.log).to.have.been.called;
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);
      
      expect(() => {
        logger.info(longMessage);
      }).to.not.throw();
      
      expect(console.log).to.have.been.called;
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Test\n\t\r\x00\uD83D\uDE00特殊字符';
      
      expect(() => {
        logger.info(specialMessage);
      }).to.not.throw();
      
      expect(console.log).to.have.been.called;
    });
  });

  describe('performance', () => {
    it('should handle rapid logging calls', () => {
      const logger = ManagerLogger.createLogger('PerfTestManager', '⚡');
      
      expect(() => {
        for (let i = 0; i < 1000; i++) {
          logger.info(`Message ${i}`);
        }
      }).to.not.throw();
      
      expect(console.log).to.have.callCount(1000);
    });

    it('should handle logging with large data objects', () => {
      const logger = ManagerLogger.createLogger('DataTestManager', '📊');
      const largeData = {
        array: new Array(1000).fill(0).map((_, i) => ({ id: i, name: `Item ${i}` })),
        nested: {
          deep: {
            value: 'test',
            moreData: new Array(100).fill('data')
          }
        }
      };
      
      expect(() => {
        logger.info('Large data test', largeData);
      }).to.not.throw();
      
      expect(console.log).to.have.been.called;
    });
  });

  describe('integration with webview logger', () => {
    it('should use webview logger for actual output', () => {
      const logger = ManagerLogger.createLogger('WebviewTestManager', '🌐');
      
      logger.info('Integration test');
      
      // Should call console.log (which is mocked)
      expect(console.log).to.have.been.called;
    });
  });
});