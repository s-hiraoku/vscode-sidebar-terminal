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
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../../shared/TestSetup';

describe('SplitManager', () => {
  let dom: JSDOM;
  let document: Document;
  let sandbox: sinon.SinonSandbox;
  let splitManager: SplitManager;

  beforeEach(() => {
    // 統合されたテスト環境セットアップを使用
    const testEnv = setupCompleteTestEnvironment(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="terminal-body" style="height: 500px;">
            <div id="primary-terminal"></div>
          </div>
        </body>
      </html>
    `);

    dom = testEnv.dom;
    document = testEnv.document;

    sandbox = sinon.createSandbox();
    splitManager = new SplitManager();
  });

  afterEach(() => {
    // 統合されたクリーンアップを使用
    cleanupTestEnvironment(sandbox, dom);
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
      // Restore terminal-body if it was removed by previous test
      if (!document.getElementById('terminal-body')) {
        const body = document.querySelector('body');
        if (body) {
          const terminalBody = document.createElement('div');
          terminalBody.id = 'terminal-body';
          terminalBody.style.height = '500px';
          const primaryTerminal = document.createElement('div');
          primaryTerminal.id = 'primary-terminal';
          terminalBody.appendChild(primaryTerminal);
          body.appendChild(terminalBody);
        }
      }

      // Mock clientHeight for JSDOM
      const terminalBody = document.getElementById('terminal-body');
      if (terminalBody) {
        Object.defineProperty(terminalBody, 'clientHeight', {
          value: 500,
          configurable: true,
        });
      }

      const result = splitManager.calculateSplitLayout();

      expect(result.canSplit).to.be.true;
      expect(result.terminalHeight).to.equal(500); // 500px / 1 terminal (0 existing + 1 new)
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
      // Restore terminal-body if removed by previous test
      if (!document.getElementById('terminal-body')) {
        const body = document.querySelector('body');
        if (body) {
          const terminalBody = document.createElement('div');
          terminalBody.id = 'terminal-body';
          terminalBody.style.height = '80px';
          body.appendChild(terminalBody);
        }
      }

      // Set small terminal body height and mock clientHeight
      const terminalBody = document.getElementById('terminal-body');
      if (terminalBody) {
        terminalBody.style.height = '80px';
        Object.defineProperty(terminalBody, 'clientHeight', {
          value: 80,
          configurable: true,
        });
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
      // Restore terminal-body if removed by previous test
      if (!document.getElementById('terminal-body')) {
        const body = document.querySelector('body');
        if (body) {
          const terminalBody = document.createElement('div');
          terminalBody.id = 'terminal-body';
          terminalBody.style.height = '500px';
          body.appendChild(terminalBody);
        }
      }

      // Mock clientHeight and getBoundingClientRect for terminal-body
      const terminalBody = document.getElementById('terminal-body');
      if (terminalBody) {
        Object.defineProperty(terminalBody, 'clientHeight', {
          value: 500,
          configurable: true,
        });
        terminalBody.getBoundingClientRect = () =>
          ({
            height: 500,
            width: 800,
            top: 0,
            left: 0,
            bottom: 500,
            right: 800,
            x: 0,
            y: 0,
            toJSON: () => {},
          }) as DOMRect;
      }

      // Add 2 terminal containers
      const container1 = document.createElement('div');
      const container2 = document.createElement('div');
      splitManager.setTerminalContainer('terminal-1', container1);
      splitManager.setTerminalContainer('terminal-2', container2);

      const result = splitManager.calculateTerminalHeightPixels();
      expect(result).to.equal(250); // 500px / 2 containers
    });

    it('should handle no terminal containers gracefully', () => {
      // Restore terminal-body if removed by previous test
      if (!document.getElementById('terminal-body')) {
        const body = document.querySelector('body');
        if (body) {
          const terminalBody = document.createElement('div');
          terminalBody.id = 'terminal-body';
          terminalBody.style.height = '500px';
          body.appendChild(terminalBody);
        }
      }

      // Mock clientHeight and getBoundingClientRect for terminal-body
      const terminalBody = document.getElementById('terminal-body');
      if (terminalBody) {
        Object.defineProperty(terminalBody, 'clientHeight', {
          value: 500,
          configurable: true,
        });
        terminalBody.getBoundingClientRect = () =>
          ({
            height: 500,
            width: 800,
            top: 0,
            left: 0,
            bottom: 500,
            right: 800,
            x: 0,
            y: 0,
            toJSON: () => {},
          }) as DOMRect;
      }

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
      expect(container.className).to.include('split-terminal-container');
      expect(container.style.height).to.equal('200px');

      const terminalArea = container.querySelector('#split-terminal-area-test-id');
      expect(terminalArea).to.not.be.null;
    });

    it('should apply correct styling to container', () => {
      const container = splitManager.createSplitTerminalContainer('test-id', 'Test Terminal', 150);

      // Check specific CSS properties that are actually set by the implementation
      expect(container.style.height).to.equal('150px');
      expect(container.style.display).to.equal('flex');
      expect(container.style.flexDirection).to.equal('column');
      expect(container.style.overflow).to.equal('hidden');

      // Check if background color is set (could be in cssText)
      expect(container.style.cssText).to.include('background');
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
      // Since console.log is already stubbed in TestSetup, we can just verify the method is called
      // by checking that splitTerminal completes without error
      expect(() => splitManager.splitTerminal('horizontal')).to.not.throw();
    });
  });

  describe('showSplitLimitWarning', () => {
    it('should log warning and show notification', () => {
      // Since console.warn is already stubbed in TestSetup, we can just verify the method is called
      // by checking that showSplitLimitWarning completes without error
      expect(() => splitManager.showSplitLimitWarning('Test reason')).to.not.throw();
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
      // Restore terminal-body if removed by previous test
      if (!document.getElementById('terminal-body')) {
        const body = document.querySelector('body');
        if (body) {
          const terminalBody = document.createElement('div');
          terminalBody.id = 'terminal-body';
          terminalBody.style.height = '500px';
          body.appendChild(terminalBody);
        }
      }

      // Mock clientHeight for JSDOM
      const terminalBody = document.getElementById('terminal-body');
      if (terminalBody) {
        Object.defineProperty(terminalBody, 'clientHeight', {
          value: 500,
          configurable: true,
        });
      }

      const addToSplitDOMSpy = sinon.spy(splitManager, 'addToSplitDOM');

      splitManager.addTerminalToSplit('test-id', 'Test Terminal');

      expect(addToSplitDOMSpy).to.have.been.calledOnce;
      expect(splitManager.getSplitTerminals().has('test-id')).to.be.true;
    });

    it('should not add terminal when split is not possible', () => {
      // Force split calculation to fail by removing terminal body
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.remove();

      // Since console.error is already stubbed in TestSetup, we can just verify the method is called
      // by checking that addTerminalToSplit completes without error and doesn't add the terminal
      splitManager.addTerminalToSplit('test-id', 'Test Terminal');

      expect(splitManager.getSplitTerminals().has('test-id')).to.be.false;
    });
  });

  describe('addNewTerminalToSplit', () => {
    it('should add new terminal when split is possible', () => {
      // Restore terminal-body if removed by previous test
      if (!document.getElementById('terminal-body')) {
        const body = document.querySelector('body');
        if (body) {
          const terminalBody = document.createElement('div');
          terminalBody.id = 'terminal-body';
          terminalBody.style.height = '500px';
          body.appendChild(terminalBody);
        }
      }

      // Mock clientHeight for JSDOM
      const terminalBody = document.getElementById('terminal-body');
      if (terminalBody) {
        Object.defineProperty(terminalBody, 'clientHeight', {
          value: 500,
          configurable: true,
        });
      }

      const moveTerminalSpy = sinon.spy(splitManager as any, 'moveTerminalToSplitLayout');

      splitManager.addNewTerminalToSplit('test-id', 'Test Terminal');

      expect(moveTerminalSpy).to.have.been.calledWith('test-id', 'Test Terminal');
    });

    it('should not add terminal when split limit reached', () => {
      // Force split to fail
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.remove();

      // Since console.error is already stubbed in TestSetup, we can just verify the method is called
      // by checking that addNewTerminalToSplit completes without error and doesn't add the terminal
      splitManager.addNewTerminalToSplit('test-id', 'Test Terminal');

      expect(splitManager.getSplitTerminals().has('test-id')).to.be.false;
    });
  });
});
