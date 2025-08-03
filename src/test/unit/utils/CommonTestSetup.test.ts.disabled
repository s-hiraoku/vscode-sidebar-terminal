/**
 * CommonTestSetup Test Suite
 * Tests the shared test utilities and setup functions
 */

import { expect } from 'chai';
import sinon from 'sinon';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  createMockVSCode,
  createCLIAgentMockData,
  createMockTerminalManager,
  TestEnvironment,
} from '../../../utils/CommonTestSetup';

describe('CommonTestSetup', () => {
  let testEnv: TestEnvironment;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    if (testEnv) {
      cleanupTestEnvironment(testEnv);
    }
    sandbox.restore();
  });

  describe('setupTestEnvironment', () => {
    it('should create basic test environment', () => {
      testEnv = setupTestEnvironment();

      expect(testEnv).to.have.property('dom');
      expect(testEnv).to.have.property('mockVscode');
      expect(testEnv).to.have.property('sandbox');
      expect(testEnv).to.have.property('clock').that.is.null;
    });

    it('should create test environment with clock', () => {
      testEnv = setupTestEnvironment({ withClock: true });

      expect(testEnv.clock).to.not.be.null;
      expect(testEnv.clock).to.have.property('tick');
      expect(testEnv.clock).to.have.property('restore');
    });

    it('should create test environment with notification container', () => {
      testEnv = setupTestEnvironment({ withNotificationContainer: true });

      const notificationContainer =
        testEnv.dom.window.document.getElementById('notification-container');
      expect(notificationContainer).to.not.be.null;
    });

    it('should setup DOM environment correctly', () => {
      testEnv = setupTestEnvironment();

      // Check that DOM globals are available
      expect(global.document).to.not.be.undefined;
      expect(global.window).to.not.be.undefined;
      expect(global.HTMLElement).to.not.be.undefined;

      // Check basic DOM functionality
      const element = testEnv.dom.window.document.createElement('div');
      expect(element.tagName).to.equal('DIV');
    });

    it('should setup VS Code mocks correctly', () => {
      testEnv = setupTestEnvironment();

      expect(testEnv.mockVscode).to.have.property('workspace');
      expect(testEnv.mockVscode).to.have.property('window');
      expect(testEnv.mockVscode).to.have.property('commands');
      expect(testEnv.mockVscode).to.have.property('env');

      // Check that mocks are functional
      expect(typeof testEnv.mockVscode.workspace.getConfiguration).to.equal('function');
      expect(typeof testEnv.mockVscode.window.showInformationMessage).to.equal('function');
    });

    it('should setup process mocks correctly', () => {
      testEnv = setupTestEnvironment();

      // Process should be available in global scope
      expect(global.process).to.not.be.undefined;
      expect(global.process.platform).to.be.a('string');
      expect(global.process.env).to.be.an('object');
    });
  });

  describe('cleanupTestEnvironment', () => {
    it('should cleanup environment properly', () => {
      testEnv = setupTestEnvironment({ withClock: true });

      // Verify environment exists
      expect(testEnv.dom).to.not.be.null;
      expect(testEnv.clock).to.not.be.null;
      expect(global.document).to.not.be.undefined;

      cleanupTestEnvironment(testEnv);

      // Verify cleanup
      expect(global.document).to.be.undefined;
      expect(global.window).to.be.undefined;
      expect(global.HTMLElement).to.be.undefined;
    });

    it('should handle cleanup of environment without clock', () => {
      testEnv = setupTestEnvironment();
      expect(testEnv.clock).to.be.null;

      // Should not throw when cleaning up without clock
      cleanupTestEnvironment(testEnv);
    });

    it('should restore sinon sandbox during cleanup', () => {
      testEnv = setupTestEnvironment();
      const restoreSpy = sandbox.spy(testEnv.sandbox, 'restore');

      cleanupTestEnvironment(testEnv);

      expect(restoreSpy.calledOnce).to.be.true;
    });
  });

  describe('createMockVSCode', () => {
    it('should create complete VS Code mock', () => {
      const mockVscode = createMockVSCode();

      // Check all required properties exist
      expect(mockVscode).to.have.property('workspace');
      expect(mockVscode).to.have.property('window');
      expect(mockVscode).to.have.property('commands');
      expect(mockVscode).to.have.property('env');
      expect(mockVscode).to.have.property('Uri');
      expect(mockVscode).to.have.property('Range');
      expect(mockVscode).to.have.property('Position');

      // Check workspace mock
      expect(mockVscode.workspace).to.have.property('getConfiguration');
      expect(mockVscode.workspace).to.have.property('getWorkspaceFolder');

      // Check window mock
      expect(mockVscode.window).to.have.property('showInformationMessage');
      expect(mockVscode.window).to.have.property('showErrorMessage');
      expect(mockVscode.window).to.have.property('activeTextEditor');

      // Check commands mock
      expect(mockVscode.commands).to.have.property('registerCommand');
      expect(mockVscode.commands).to.have.property('executeCommand');

      // Check env mock
      expect(mockVscode.env).to.have.property('clipboard');
    });

    it('should create functional configuration mock', () => {
      const mockVscode = createMockVSCode();
      const config = mockVscode.workspace.getConfiguration('test');

      expect(config).to.have.property('get');
      expect(config).to.have.property('update');
      expect(config).to.have.property('has');

      // Test configuration functionality
      config.update('testKey', 'testValue');
      expect(config.get('testKey')).to.equal('testValue');
      expect(config.has('testKey')).to.be.true;
      expect(config.has('nonexistentKey')).to.be.false;
    });

    it('should support workspace folder resolution', () => {
      const mockVscode = createMockVSCode();

      const mockUri = { scheme: 'file', fsPath: '/test/workspace' };
      const workspaceFolder = mockVscode.workspace.getWorkspaceFolder(mockUri);

      expect(workspaceFolder).to.have.property('uri');
      expect(workspaceFolder).to.have.property('name');
      expect(workspaceFolder).to.have.property('index');
    });
  });

  describe('createCLIAgentMockData', () => {
    it('should create CLI Agent mock data', () => {
      const mockData = createCLIAgentMockData();

      expect(mockData).to.have.property('commands');
      expect(mockData).to.have.property('outputs');
      expect(mockData).to.have.property('completionMessages');

      // Check Claude commands
      expect(mockData.commands.claude).to.be.an('array');
      expect(mockData.commands.claude.length).to.be.greaterThan(0);
      expect(mockData.commands.claude[0]).to.include('claude-code');

      // Check Gemini commands
      expect(mockData.commands.gemini).to.be.an('array');
      expect(mockData.commands.gemini.length).to.be.greaterThan(0);
      expect(mockData.commands.gemini[0]).to.include('gemini code');

      // Check outputs
      expect(mockData.outputs.analysis).to.be.an('array');
      expect(mockData.outputs.implementation).to.be.an('array');
      expect(mockData.outputs.completion).to.be.an('array');

      // Check completion messages
      expect(mockData.completionMessages).to.be.an('array');
      expect(mockData.completionMessages.length).to.be.greaterThan(0);
    });

    it('should provide realistic CLI Agent command patterns', () => {
      const mockData = createCLIAgentMockData();

      // Test Claude command patterns
      const claudeCommand = mockData.commands.claude[0];
      expect(claudeCommand).to.match(/claude-code\s+"/);

      // Test Gemini command patterns
      const geminiCommand = mockData.commands.gemini[0];
      expect(geminiCommand).to.match(/gemini\s+code\s+"/);
    });

    it('should provide varied output scenarios', () => {
      const mockData = createCLIAgentMockData();

      // Check that we have different types of outputs
      expect(mockData.outputs.analysis.length).to.be.greaterThan(0);
      expect(mockData.outputs.implementation.length).to.be.greaterThan(0);
      expect(mockData.outputs.completion.length).to.be.greaterThan(0);

      // Check that outputs are strings
      mockData.outputs.analysis.forEach((output) => {
        expect(output).to.be.a('string');
        expect(output.length).to.be.greaterThan(0);
      });
    });
  });

  describe('createMockTerminalManager', () => {
    it('should create mock terminal manager', () => {
      const mockTerminalManager = createMockTerminalManager();

      // Check all required methods exist
      expect(mockTerminalManager).to.have.property('createTerminal');
      expect(mockTerminalManager).to.have.property('killTerminal');
      expect(mockTerminalManager).to.have.property('deleteTerminal');
      expect(mockTerminalManager).to.have.property('getActiveTerminal');
      expect(mockTerminalManager).to.have.property('getAllTerminals');
      expect(mockTerminalManager).to.have.property('focusTerminal');
      expect(mockTerminalManager).to.have.property('sendData');
      expect(mockTerminalManager).to.have.property('dispose');

      // Check CLI Agent specific methods
      expect(mockTerminalManager).to.have.property('getTerminalById');
      expect(mockTerminalManager).to.have.property('isTerminalActive');
      expect(mockTerminalManager).to.have.property('getTerminalCount');
    });

    it('should provide realistic terminal mock behavior', () => {
      const mockTerminalManager = createMockTerminalManager();

      // Test terminal creation
      const createResult = mockTerminalManager.createTerminal();
      expect(createResult).to.have.property('success', true);
      expect(createResult).to.have.property('terminal');

      // Test terminal retrieval
      const activeTerminal = mockTerminalManager.getActiveTerminal();
      expect(activeTerminal).to.have.property('id');
      expect(activeTerminal).to.have.property('name');

      // Test terminal count
      const count = mockTerminalManager.getTerminalCount();
      expect(count).to.be.a('number');
      expect(count).to.be.greaterThan(0);
    });

    it('should support terminal state queries', () => {
      const mockTerminalManager = createMockTerminalManager();

      // Test terminal active state
      const isActive = mockTerminalManager.isTerminalActive(1);
      expect(isActive).to.be.a('boolean');

      // Test get all terminals
      const allTerminals = mockTerminalManager.getAllTerminals();
      expect(allTerminals).to.be.an('array');
      expect(allTerminals.length).to.be.greaterThan(0);

      // Each terminal should have required properties
      allTerminals.forEach((terminal) => {
        expect(terminal).to.have.property('id');
        expect(terminal).to.have.property('name');
        expect(terminal).to.have.property('isActive');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work together for complete test setup', () => {
      testEnv = setupTestEnvironment({
        withClock: true,
        withNotificationContainer: true,
      });

      const mockTerminalManager = createMockTerminalManager();
      const cliAgentData = createCLIAgentMockData();

      // Should be able to use all components together
      expect(testEnv.dom.window.document.getElementById('notification-container')).to.not.be.null;
      expect(testEnv.clock).to.not.be.null;
      expect(mockTerminalManager.getTerminalCount()).to.be.greaterThan(0);
      expect(cliAgentData.commands.claude.length).to.be.greaterThan(0);

      // Test clock functionality
      let timeoutCalled = false;
      setTimeout(() => {
        timeoutCalled = true;
      }, 1000);

      testEnv.clock!.tick(1000);
      expect(timeoutCalled).to.be.true;
    });

    it('should handle cleanup of complex test environments', () => {
      testEnv = setupTestEnvironment({
        withClock: true,
        withNotificationContainer: true,
      });

      // Add some DOM elements
      const testElement = testEnv.dom.window.document.createElement('div');
      testElement.id = 'test-element';
      testEnv.dom.window.document.body.appendChild(testElement);

      // Cleanup should handle everything
      cleanupTestEnvironment(testEnv);

      expect(global.document).to.be.undefined;
      expect(global.window).to.be.undefined;
    });
  });
});
