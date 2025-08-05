import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { InputManager } from '../../../../webview/managers/InputManager';
import { IManagerCoordinator } from '../../../../webview/interfaces/ManagerInterfaces';

describe('InputManager - Arrow Key Handling', () => {
  let dom: JSDOM;
  let inputManager: InputManager;
  let _mockCoordinator: sinon.SinonStubbedInstance<IManagerCoordinator>;
  let mockVsCodeApi: sinon.SinonStub;

  beforeEach(() => {
    // Setup DOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <div class="terminal-container active" data-terminal-id="terminal-1">
            <div class="terminal-content">
              <div class="xterm"></div>
            </div>
          </div>
        </body>
      </html>
    `,
      { url: 'http://localhost' }
    );

    global.window = dom.window as unknown as Window & typeof globalThis;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.Event = dom.window.Event;
    global.KeyboardEvent = dom.window.KeyboardEvent;

    // Mock VS Code API
    mockVsCodeApi = sinon.stub();
    (
      global.window as { acquireVsCodeApi?: () => { postMessage: sinon.SinonStub } }
    ).acquireVsCodeApi = () => ({
      postMessage: mockVsCodeApi,
    });

    // Create mock coordinator
    _mockCoordinator = {
      getActiveTerminalId: sinon.stub().returns('terminal-1') as (() => string | null) &
        sinon.SinonStub<[], string | null>,
      setActiveTerminalId: sinon.stub(),
      getTerminalInstance: sinon.stub(),
      getAllTerminalInstances: sinon.stub(),
      getAllTerminalContainers: sinon.stub(),
      getTerminalElement: sinon.stub(),
      postMessageToExtension: sinon.stub(),
      createTerminal: sinon.stub(),
      openSettings: sinon.stub(),
      applyFontSettings: sinon.stub(),
      closeTerminal: sinon.stub(),
      log: sinon.stub(),
      getManagers: sinon.stub(),
    } as unknown as sinon.SinonStubbedInstance<IManagerCoordinator>;

    inputManager = new InputManager();
  });

  afterEach(() => {
    inputManager.dispose();
    sinon.restore();
    dom.window.close();
  });

  describe('Arrow Key Mode Management', () => {
    it('should set arrow key mode correctly', () => {
      // Test setting choice mode
      inputManager.setAgentInteractionMode(true);
      expect(inputManager.isAgentInteractionMode()).to.equal(true);

      // Test setting normal mode
      inputManager.setAgentInteractionMode(false);
      expect(inputManager.isAgentInteractionMode()).to.equal(false);
    });

    it('should start with agent interaction mode disabled', () => {
      expect(inputManager.isAgentInteractionMode()).to.equal(false);
    });

    it('should setup arrow key handler when agent interaction mode is enabled', () => {
      const addEventListenerSpy = sinon.spy(document, 'addEventListener');

      inputManager.setAgentInteractionMode(true);

      expect(addEventListenerSpy.calledWith('keydown', sinon.match.func, true)).to.be.true;
    });
  });

  describe('Arrow Key Event Handling', () => {
    beforeEach(() => {
      inputManager.setAgentInteractionMode(true);
    });

    it('should intercept arrow keys in agent interaction mode', () => {
      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = sinon.spy(event, 'preventDefault');
      const stopPropagationSpy = sinon.spy(event, 'stopPropagation');

      // Dispatch the event
      document.dispatchEvent(event);

      expect(preventDefaultSpy.called).to.be.true;
      expect(stopPropagationSpy.called).to.be.true;
    });

    it('should send correct ANSI sequences for arrow keys', () => {
      const arrowKeyTests = [
        { key: 'ArrowUp', expected: '\x1b[A' },
        { key: 'ArrowDown', expected: '\x1b[B' },
        { key: 'ArrowRight', expected: '\x1b[C' },
        { key: 'ArrowLeft', expected: '\x1b[D' },
      ];

      arrowKeyTests.forEach(({ key, expected }) => {
        mockVsCodeApi.resetHistory();

        const event = new dom.window.KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
        });

        document.dispatchEvent(event);

        expect(mockVsCodeApi.calledOnce).to.be.true;
        expect(mockVsCodeApi.firstCall.args[0]).to.deep.include({
          command: 'input',
          data: expected,
          terminalId: 'terminal-1',
        });
      });
    });

    it('should not intercept non-arrow keys', () => {
      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = sinon.spy(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy.called).to.be.false;
      expect(mockVsCodeApi.called).to.be.false;
    });

    it('should ignore events when IME is composing', () => {
      // Simulate IME composition
      inputManager.setupIMEHandling();
      const compositionStartEvent = new dom.window.CompositionEvent('compositionstart');
      document.dispatchEvent(compositionStartEvent);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = sinon.spy(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy.called).to.be.false;
      expect(mockVsCodeApi.called).to.be.false;
    });

    it('should allow normal arrow key behavior in normal mode', () => {
      inputManager.setAgentInteractionMode(false);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = sinon.spy(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy.called).to.be.false;
      expect(mockVsCodeApi.called).to.be.false;
    });
  });

  describe('Cleanup and Disposal', () => {
    it('should remove arrow key listener on disposal', () => {
      const removeEventListenerSpy = sinon.spy(document, 'removeEventListener');

      inputManager.setAgentInteractionMode(true);
      inputManager.dispose();

      expect(removeEventListenerSpy.calledWith('keydown', sinon.match.func, true)).to.be.true;
    });

    it('should clear arrow key modes on disposal', () => {
      inputManager.setAgentInteractionMode(true);

      inputManager.dispose();

      expect(inputManager.isAgentInteractionMode()).to.equal(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing terminal container gracefully', () => {
      // Remove the terminal container
      const container = document.querySelector('.terminal-container');
      container?.remove();

      inputManager.setAgentInteractionMode(true);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = sinon.spy(event, 'preventDefault');

      // Should not throw an error
      expect(() => document.dispatchEvent(event)).to.not.throw();
      expect(preventDefaultSpy.called).to.be.false;
    });

    it('should handle missing terminal ID attribute gracefully', () => {
      const container = document.querySelector('.terminal-container');
      container?.removeAttribute('data-terminal-id');

      inputManager.setAgentInteractionMode(true);

      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = sinon.spy(event, 'preventDefault');

      expect(() => document.dispatchEvent(event)).to.not.throw();
      expect(preventDefaultSpy.called).to.be.false;
    });
  });
});
