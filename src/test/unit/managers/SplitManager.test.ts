/**
 * SplitManager unit tests
 */
/* eslint-disable */
// @ts-nocheck
import * as sinon from 'sinon';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';

use(sinonChai);
import { JSDOM } from 'jsdom';
import { SplitManager, TerminalInstance } from '../../../webview/managers/SplitManager';

// Mock setup for this test file
const setupTestEnvironment = (): void => {
  // Mock globals that might be needed
  if (typeof (global as any).vscode === 'undefined') {
    (global as any).vscode = {
      workspace: {
        getConfiguration: () => ({ get: () => undefined }),
      },
    };
  }
};

describe('SplitManager', () => {
  let dom: JSDOM;
  let document: Document;
  let sandbox: sinon.SinonSandbox;
  let splitManager: SplitManager;

  beforeEach(() => {
    // Test environment setup
    setupTestEnvironment();

    // Mock console before JSDOM creation
    (global as Record<string, unknown>).console = {
      log: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    };

    // JSDOM環境をセットアップ
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="terminal-body" style="height: 500px;">
            <div id="primary-terminal"></div>
          </div>
        </body>
      </html>
    `);
    document = dom.window.document;

    // グローバルに設定
    (global as Record<string, unknown>).document = document;
    (global as Record<string, unknown>).window = dom.window;
    (global as Record<string, unknown>).HTMLElement = dom.window.HTMLElement;

    sandbox = sinon.createSandbox();
    splitManager = new SplitManager();
  });

  afterEach(() => {
    sandbox.restore();

    // クリーンアップ
    delete (global as Record<string, unknown>).document;
    delete (global as Record<string, unknown>).window;
    delete (global as Record<string, unknown>).HTMLElement;
    delete (global as Record<string, unknown>).console;
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(splitManager.isSplitMode).to.be.false;
      expect(splitManager.getTerminals().size).to.equal(0);
      expect(splitManager.getSplitTerminals().size).to.equal(0);
      expect(splitManager.getTerminalContainers().size).to.equal(0);
    });
  });

  describe('calculateSplitLayout', () => {
    it('should return canSplit: false when terminal body not found', () => {
      // Remove terminal body
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.remove();

      const result = splitManager.calculateSplitLayout();

      expect(result.canSplit).to.be.false;
      expect(result.terminalHeight).to.equal(0);
      expect(result.reason).to.equal('Terminal body not found');
    });

    it('should calculate split layout for single terminal', () => {
      const result = splitManager.calculateSplitLayout();

      expect(result.canSplit).to.be.true;
      expect(result.terminalHeight).to.equal(250); // 500px / 2 terminals
    });

    it('should return canSplit: false when exceeding max split count', () => {
      // Add 5 terminals to reach the limit
      for (let i = 0; i < 5; i++) {
        const mockTerminal = {
          terminal: {} as any,
          fitAddon: {} as any,
          name: `Terminal ${i}`,
        };
        splitManager.setTerminal(`terminal-${i}`, mockTerminal);
      }

      const result = splitManager.calculateSplitLayout();

      expect(result.canSplit).to.be.false;
      expect(result.reason).to.include('Maximum of 5 terminals reached');
    });

    it('should return canSplit: false when terminal height would be too small', () => {
      // Set small terminal body height
      const terminalBody = document.getElementById('terminal-body');
      if (terminalBody) {
        terminalBody.style.height = '80px';
      }

      // Add 3 terminals to force small height calculation
      for (let i = 0; i < 3; i++) {
        const mockTerminal = {
          terminal: {} as any,
          fitAddon: {} as any,
          name: `Terminal ${i}`,
        };
        splitManager.setTerminal(`terminal-${i}`, mockTerminal);
      }

      const result = splitManager.calculateSplitLayout();

      expect(result.canSplit).to.be.false;
      expect(result.reason).to.include('Terminal height would be too small');
    });
  });

  describe('calculateTerminalHeightPercentage', () => {
    it('should return 100% for single terminal', () => {
      const result = splitManager.calculateTerminalHeightPercentage();
      expect(result).to.equal('100%');
    });

    it('should calculate percentage for multiple terminals', () => {
      // Add 2 terminals
      for (let i = 0; i < 2; i++) {
        const mockTerminal = {
          terminal: {} as any,
          fitAddon: {} as any,
          name: `Terminal ${i}`,
        };
        splitManager.setTerminal(`terminal-${i}`, mockTerminal);
      }

      const result = splitManager.calculateTerminalHeightPercentage();
      expect(result).to.equal('50%');
    });

    it('should calculate percentage for 4 terminals', () => {
      // Add 4 terminals
      for (let i = 0; i < 4; i++) {
        const mockTerminal = {
          terminal: {} as any,
          fitAddon: {} as any,
          name: `Terminal ${i}`,
        };
        splitManager.setTerminal(`terminal-${i}`, mockTerminal);
      }

      const result = splitManager.calculateTerminalHeightPercentage();
      expect(result).to.equal('25%');
    });
  });

  describe('calculateTerminalHeightPixels', () => {
    it('should return fallback height when terminal body not found', () => {
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.remove();

      const result = splitManager.calculateTerminalHeightPixels();
      expect(result).to.equal(100);
    });

    it('should calculate height based on terminal body and container count', () => {
      // Add 2 terminal containers
      const container1 = document.createElement('div');
      const container2 = document.createElement('div');
      splitManager.setTerminalContainer('terminal-1', container1);
      splitManager.setTerminalContainer('terminal-2', container2);

      const result = splitManager.calculateTerminalHeightPixels();
      expect(result).to.equal(250); // 500px / 2 containers
    });

    it('should handle no terminal containers gracefully', () => {
      const result = splitManager.calculateTerminalHeightPixels();
      expect(result).to.equal(500); // 500px / 1 (minimum)
    });
  });

  describe('initializeMultiSplitLayout', () => {
    it('should set up flex column layout for terminal body', () => {
      splitManager.initializeMultiSplitLayout();

      const terminalBody = document.getElementById('terminal-body');
      expect(terminalBody?.style.display).to.equal('flex');
      expect(terminalBody?.style.flexDirection).to.equal('column');
      expect(splitManager.isSplitMode).to.be.true;
    });

    it('should adjust existing primary terminal for split layout', () => {
      const primaryTerminal = document.getElementById('primary-terminal');
      expect(primaryTerminal).to.not.be.null;

      splitManager.initializeMultiSplitLayout();

      expect(primaryTerminal?.style.display).to.equal('flex');
      expect(primaryTerminal?.style.flexDirection).to.equal('column');
    });

    it('should handle missing terminal body gracefully', () => {
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.remove();

      // Should not throw
      expect(() => splitManager.initializeMultiSplitLayout()).to.not.throw();
    });
  });

  describe('createSplitTerminalContainer', () => {
    it('should create container with correct structure', () => {
      const container = splitManager.createSplitTerminalContainer('test-id', 'Test Terminal', 200);

      expect(container.id).to.equal('split-terminal-test-id');
      expect(container.className).to.equal('split-terminal-container');
      expect(container.style.height).to.equal('200px');

      const terminalArea = container.querySelector('#split-terminal-area-test-id');
      expect(terminalArea).to.not.be.null;
    });

    it('should apply correct styling to container', () => {
      const container = splitManager.createSplitTerminalContainer('test-id', 'Test Terminal', 150);

      expect(container.style.background).to.include('#000');
      expect(container.style.display).to.equal('flex');
      expect(container.style.flexDirection).to.equal('column');
      expect(container.style.overflow).to.equal('hidden');
    });
  });

  describe('prepareSplitMode', () => {
    it('should set split mode and direction', () => {
      splitManager.prepareSplitMode('vertical');

      expect(splitManager.isSplitMode).to.be.true;
      expect(splitManager.getIsSplitMode()).to.be.true;
    });

    it('should initialize multi-split layout for first split', () => {
      const initializeSpy = sinon.spy(splitManager, 'initializeMultiSplitLayout');

      splitManager.prepareSplitMode('vertical');

      expect(initializeSpy).to.have.been.calledOnce;
    });

    it('should not reinitialize layout for subsequent splits', () => {
      // Add a split terminal to simulate existing splits
      const mockContainer = document.createElement('div');
      splitManager.getSplitTerminals().set('existing', mockContainer);

      const initializeSpy = sinon.spy(splitManager, 'initializeMultiSplitLayout');

      splitManager.prepareSplitMode('vertical');

      expect(initializeSpy).to.not.have.been.called;
    });
  });

  describe('addToSplitDOM', () => {
    it('should add container to terminal body', () => {
      const container = document.createElement('div');
      container.id = 'test-container';

      splitManager.addToSplitDOM(container);

      const terminalBody = document.getElementById('terminal-body');
      expect(terminalBody?.contains(container)).to.be.true;
    });

    it('should add splitter when adding second terminal', () => {
      // Add first split terminal
      const firstContainer = document.createElement('div');
      splitManager.getSplitTerminals().set('first', firstContainer);

      const secondContainer = document.createElement('div');
      secondContainer.id = 'second-container';

      splitManager.addToSplitDOM(secondContainer);

      const terminalBody = document.getElementById('terminal-body');
      const splitters = terminalBody?.querySelectorAll('.split-resizer');
      expect(splitters?.length).to.be.greaterThan(0);
    });

    it('should handle missing terminal body gracefully', () => {
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.remove();

      const container = document.createElement('div');

      // Should not throw
      expect(() => splitManager.addToSplitDOM(container)).to.not.throw();
    });
  });

  describe('redistributeSplitTerminals', () => {
    it('should resize existing primary terminal', () => {
      const primaryTerminal = document.getElementById('primary-terminal');
      const mockTerminal = {} as any;
      const mockFitAddon = { fit: sinon.stub() };

      splitManager.redistributeSplitTerminals(150, mockTerminal, mockFitAddon);

      expect(primaryTerminal?.style.height).to.equal('150px');
    });

    it('should resize all split terminals', () => {
      // Add split terminals
      const container1 = document.createElement('div');
      const container2 = document.createElement('div');

      splitManager.getSplitTerminals().set('terminal-1', container1);
      splitManager.getSplitTerminals().set('terminal-2', container2);

      // Add terminal instances with fit addons
      const mockFitAddon1 = { fit: sinon.stub() };
      const mockFitAddon2 = { fit: sinon.stub() };

      splitManager.setTerminal('terminal-1', {
        terminal: {} as any,
        fitAddon: mockFitAddon1,
        name: 'Terminal 1',
      });
      splitManager.setTerminal('terminal-2', {
        terminal: {} as any,
        fitAddon: mockFitAddon2,
        name: 'Terminal 2',
      });

      splitManager.redistributeSplitTerminals(180);

      expect(container1.style.height).to.equal('180px');
      expect(container2.style.height).to.equal('180px');
    });
  });

  describe('splitTerminal', () => {
    it('should handle vertical split', () => {
      const addTerminalSpy = sinon.spy(splitManager as any, 'addTerminalToMultiSplit');

      splitManager.splitTerminal('vertical');

      expect(addTerminalSpy).to.have.been.calledOnce;
    });

    it('should log message for horizontal split (not implemented)', () => {
      const consoleSpy = (global as any).console.log;

      splitManager.splitTerminal('horizontal');

      expect(consoleSpy).to.have.been.called;
    });
  });

  describe('showSplitLimitWarning', () => {
    it('should log warning and show notification', () => {
      const consoleWarnSpy = (global as any).console.warn;

      splitManager.showSplitLimitWarning('Test reason');

      expect(consoleWarnSpy).to.have.been.calledWith(
        '⚠️ [WEBVIEW] Split limit reached:',
        'Test reason'
      );
    });
  });

  describe('terminal management', () => {
    it('should add and retrieve terminals', () => {
      const mockTerminal: TerminalInstance = {
        terminal: {} as any,
        fitAddon: {} as any,
        name: 'Test Terminal',
      };

      splitManager.setTerminal('test-id', mockTerminal);

      const retrieved = splitManager.getTerminals().get('test-id');
      expect(retrieved).to.equal(mockTerminal);
    });

    it('should add and retrieve terminal containers', () => {
      const mockContainer = document.createElement('div');

      splitManager.setTerminalContainer('test-id', mockContainer);

      const retrieved = splitManager.getTerminalContainers().get('test-id');
      expect(retrieved).to.equal(mockContainer);
    });
  });

  describe('addTerminalToSplit', () => {
    it('should add terminal when split is possible', () => {
      const addToSplitDOMSpy = sinon.spy(splitManager, 'addToSplitDOM');

      splitManager.addTerminalToSplit('test-id', 'Test Terminal');

      expect(addToSplitDOMSpy).to.have.been.calledOnce;
      expect(splitManager.getSplitTerminals().has('test-id')).to.be.true;
    });

    it('should not add terminal when split is not possible', () => {
      // Force split calculation to fail by removing terminal body
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.remove();

      const consoleErrorSpy = (global as any).console.error;

      splitManager.addTerminalToSplit('test-id', 'Test Terminal');

      expect(consoleErrorSpy).to.have.been.called;
    });
  });

  describe('addNewTerminalToSplit', () => {
    it('should add new terminal when split is possible', () => {
      const moveTerminalSpy = sinon.spy(splitManager as any, 'moveTerminalToSplitLayout');

      splitManager.addNewTerminalToSplit('test-id', 'Test Terminal');

      expect(moveTerminalSpy).to.have.been.calledWith('test-id', 'Test Terminal');
    });

    it('should not add terminal when split limit reached', () => {
      // Force split to fail
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.remove();

      const consoleErrorSpy = (global as any).console.error;

      splitManager.addNewTerminalToSplit('test-id', 'Test Terminal');

      expect(consoleErrorSpy).to.have.been.called;
    });
  });
});
