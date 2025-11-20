/**
 * InputManager Test Suite - Comprehensive input handling validation
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { InputManager } from '../../../../webview/managers/InputManager';
import { IManagerCoordinator } from '../../../../webview/interfaces/ManagerInterfaces';

describe('InputManager', () => {
  let inputManager: InputManager;
  let mockCoordinator: sinon.SinonStubbedInstance<IManagerCoordinator>;
  let jsdom: JSDOM;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    // Setup JSDOM environment
    jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable',
    });

    // Set up global DOM
    global.window = jsdom.window as any;
    global.document = jsdom.window.document;
    global.Event = jsdom.window.Event;
    global.CompositionEvent = jsdom.window.CompositionEvent;
    global.KeyboardEvent = jsdom.window.KeyboardEvent;
    global.MouseEvent = jsdom.window.MouseEvent;

    // Setup fake timers for precise control over debouncing
    clock = sinon.useFakeTimers();

    // Create mock coordinator
    mockCoordinator = {
      getActiveTerminalId: sinon.stub().returns('terminal-1'),
      setActiveTerminalId: sinon.stub(),
      postMessageToExtension: sinon.stub(),
      getMessageManager: sinon.stub().returns(null),
      getTerminalInstance: sinon.stub().returns({
        terminal: {
          hasSelection: sinon.stub().returns(false),
        },
      }),
    } as any;

    inputManager = new InputManager(mockCoordinator);
  });

  afterEach(() => {
    clock.restore();
    inputManager.dispose();
    jsdom.window.close();
  });

  describe('IME Composition Handling', () => {
    it('should properly handle composition start event', () => {
      inputManager.setupIMEHandling();

      expect(inputManager.isIMEComposing()).to.be.false;

      // Simulate composition start
      const compositionEvent = new jsdom.window.CompositionEvent('compositionstart', {
        data: 'test',
      });
      document.dispatchEvent(compositionEvent);

      expect(inputManager.isIMEComposing()).to.be.true;
    });

    it('should handle composition update without changing state', () => {
      inputManager.setupIMEHandling();

      // Start composition
      document.dispatchEvent(new jsdom.window.CompositionEvent('compositionstart', { data: 't' }));
      expect(inputManager.isIMEComposing()).to.be.true;

      // Update composition
      document.dispatchEvent(
        new jsdom.window.CompositionEvent('compositionupdate', { data: 'te' })
      );
      expect(inputManager.isIMEComposing()).to.be.true;
    });

    it('should properly handle composition end with delay', () => {
      inputManager.setupIMEHandling();

      // Start composition
      document.dispatchEvent(
        new jsdom.window.CompositionEvent('compositionstart', { data: 'test' })
      );
      expect(inputManager.isIMEComposing()).to.be.true;

      // End composition
      document.dispatchEvent(new jsdom.window.CompositionEvent('compositionend', { data: 'test' }));

      // Should still be composing immediately after end event
      expect(inputManager.isIMEComposing()).to.be.true;

      // After 10ms delay, should be false
      clock.tick(10);
      expect(inputManager.isIMEComposing()).to.be.false;
    });

    it('should ignore keyboard shortcuts during IME composition', () => {
      inputManager.setupIMEHandling();
      inputManager.setupKeyboardShortcuts(mockCoordinator);

      // Start composition
      document.dispatchEvent(
        new jsdom.window.CompositionEvent('compositionstart', { data: 'test' })
      );

      // Try to trigger Ctrl+Tab shortcut during composition
      const keyEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'Tab',
        ctrlKey: true,
      });
      document.dispatchEvent(keyEvent);

      // Should not have triggered terminal switch
      expect(mockCoordinator.postMessageToExtension.called).to.be.false;
    });
  });

  describe('Input Delay Optimization', () => {
    it('should debounce focus events with reduced delay (50ms)', () => {
      const testTerminalId = 'terminal-1';

      // Emit multiple focus events quickly
      (inputManager as any).emitTerminalInteractionEvent(
        'focus',
        testTerminalId,
        undefined,
        mockCoordinator
      );
      (inputManager as any).emitTerminalInteractionEvent(
        'focus',
        testTerminalId,
        undefined,
        mockCoordinator
      );
      (inputManager as any).emitTerminalInteractionEvent(
        'focus',
        testTerminalId,
        undefined,
        mockCoordinator
      );

      // Should not have sent any messages yet
      expect(mockCoordinator.postMessageToExtension.callCount).to.equal(0);

      // Advance time by 49ms - still no messages
      clock.tick(49);
      expect(mockCoordinator.postMessageToExtension.callCount).to.equal(0);

      // Advance to 50ms - should send one message (debounced)
      clock.tick(1);
      expect(mockCoordinator.postMessageToExtension.callCount).to.equal(1);

      const lastCall = mockCoordinator.postMessageToExtension.getCall(0);
      expect(lastCall.args[0]).to.deep.include({
        command: 'terminalInteraction',
        type: 'focus',
        terminalId: testTerminalId,
      });
    });

    it('should emit non-focus events immediately', () => {
      const testTerminalId = 'terminal-1';

      // Emit alt-click event (should be immediate)
      (inputManager as any).emitTerminalInteractionEvent(
        'alt-click',
        testTerminalId,
        { x: 100, y: 200 },
        mockCoordinator
      );

      // Should send message immediately without debouncing
      expect(mockCoordinator.postMessageToExtension.callCount).to.equal(1);

      const call = mockCoordinator.postMessageToExtension.getCall(0);
      expect(call.args[0]).to.deep.include({
        command: 'terminalInteraction',
        type: 'alt-click',
        terminalId: testTerminalId,
      });
    });
  });

  describe('Input Buffering', () => {
    it('should batch sequential input when message manager is unavailable', () => {
      const queueInputData = (inputManager as any).queueInputData.bind(inputManager);

      queueInputData('terminal-1', 'a', false);
      queueInputData('terminal-1', 'b', false);

      expect(mockCoordinator.postMessageToExtension.callCount).to.equal(0);
      clock.runAll();

      expect(mockCoordinator.postMessageToExtension.callCount).to.equal(1);
      const payload = mockCoordinator.postMessageToExtension.getCall(0).args[0];
      expect(payload.data).to.equal('ab');
    });

    it('should prefer message manager queue when available', () => {
      const sendInputStub = sinon.stub();
      (mockCoordinator.getMessageManager as sinon.SinonStub).returns({
        sendInput: sendInputStub,
      });

      const queueInputData = (inputManager as any).queueInputData.bind(inputManager);
      queueInputData('terminal-1', 'x', false);
      queueInputData('terminal-1', 'y', false);

      clock.runAll();

      expect(sendInputStub.calledOnce).to.be.true;
      expect(sendInputStub.getCall(0).args).to.deep.equal(['xy', 'terminal-1']);
      expect(mockCoordinator.postMessageToExtension.called).to.be.false;
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle events when IME listener setup fails', () => {
      // Mock document.addEventListener to throw error
      const originalAddEventListener = document.addEventListener;
      document.addEventListener = sinon.stub().throws(new Error('Setup failed'));

      // Should not throw
      expect(() => inputManager.setupIMEHandling()).to.not.throw();

      // Restore original
      document.addEventListener = originalAddEventListener;
    });

    it('should gracefully handle missing coordinator in event emission', () => {
      const nullCoordinator = null as any;

      // Should not throw when coordinator is null
      expect(() => {
        (inputManager as any).emitTerminalInteractionEvent(
          'focus',
          'terminal-1',
          undefined,
          nullCoordinator
        );
      }).to.not.throw();
    });

    it('should clear pending input events during IME start', () => {
      inputManager.setupIMEHandling();

      // Add some debounced events
      const eventDebounceTimers = (inputManager as any).eventDebounceTimers as Map<string, number>;
      const fakeTimer = setTimeout(() => {}, 100);
      eventDebounceTimers.set('input-test', fakeTimer as any);
      eventDebounceTimers.set('keydown-test', fakeTimer as any);
      eventDebounceTimers.set('other-test', fakeTimer as any);

      expect(eventDebounceTimers.size).to.equal(3);

      // Start IME composition (should clear input-related timers)
      document.dispatchEvent(
        new jsdom.window.CompositionEvent('compositionstart', { data: 'test' })
      );

      // Should have cleared input and keydown timers, but kept other-test
      expect(eventDebounceTimers.size).to.equal(1);
      expect(eventDebounceTimers.has('other-test')).to.be.true;
    });
  });

  describe('Alt+Click Functionality', () => {
    it('should properly handle VS Code Alt+Click settings', () => {
      const settings = {
        altClickMovesCursor: true,
        multiCursorModifier: 'alt' as const,
      };

      expect(inputManager.isVSCodeAltClickEnabled(settings)).to.be.true;

      // Update settings
      inputManager.updateAltClickSettings(settings);

      const altClickState = inputManager.getAltClickState();
      expect(altClickState.isVSCodeAltClickEnabled).to.be.true;
    });

    it('should disable Alt+Click when settings do not match', () => {
      const settings = {
        altClickMovesCursor: true,
        multiCursorModifier: 'ctrl' as const, // Different modifier
      };

      expect(inputManager.isVSCodeAltClickEnabled(settings)).to.be.false;

      inputManager.updateAltClickSettings(settings);

      const altClickState = inputManager.getAltClickState();
      expect(altClickState.isVSCodeAltClickEnabled).to.be.false;
    });
  });

  describe('Special Key Handling', () => {
    it('should handle Ctrl+C with terminal selection correctly', () => {
      mockCoordinator.getTerminalInstance.returns({
        id: 'terminal-1',
        name: 'Terminal 1',
        terminal: {
          hasSelection: sinon.stub().returns(true),
        } as any,
        fitAddon: {} as any,
        container: document.createElement('div'),
      } as any);

      const event = new jsdom.window.KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
      });

      const handled = inputManager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      // Should not be handled (let browser copy)
      expect(handled).to.be.false;
    });

    it('should handle Ctrl+C without selection as interrupt', () => {
      mockCoordinator.getTerminalInstance.returns({
        id: 'terminal-1',
        name: 'Terminal 1',
        terminal: {
          hasSelection: sinon.stub().returns(false),
        } as any,
        fitAddon: {} as any,
        container: document.createElement('div'),
      } as any);

      const event = new jsdom.window.KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
      });

      const handled = inputManager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      // Should be handled as interrupt
      expect(handled).to.be.true;
      expect(mockCoordinator.postMessageToExtension.called).to.be.true;
    });

    it('should ignore special keys during IME composition', () => {
      inputManager.setupIMEHandling();

      // Start composition
      document.dispatchEvent(
        new jsdom.window.CompositionEvent('compositionstart', { data: 'test' })
      );

      const event = new jsdom.window.KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
      });

      const handled = inputManager.handleSpecialKeys(event, 'terminal-1', mockCoordinator);

      // Should not be handled during composition
      expect(handled).to.be.false;
      expect(mockCoordinator.postMessageToExtension.called).to.be.false;
    });
  });

  describe('High-Speed Typing Test', () => {
    it('should handle rapid input events without loss', () => {
      const inputEvents: string[] = [];
      mockCoordinator.postMessageToExtension = sinon.stub().callsFake((message) => {
        const msg = message as any;
        if (msg.command === 'terminalInteraction' && msg.type === 'input') {
          inputEvents.push(msg.data);
        }
      }) as any;

      // Simulate rapid typing (each character as separate event)
      const testString = 'Hello World! This is a test of rapid typing.';
      for (const char of testString) {
        (inputManager as any).emitTerminalInteractionEvent(
          'input',
          'terminal-1',
          char,
          mockCoordinator
        );
      }

      // All characters should be captured
      expect(inputEvents.length).to.equal(testString.length);
      expect(inputEvents.join('')).to.equal(testString);
    });
  });

  describe('Memory Management', () => {
    it('should properly cleanup all event listeners on dispose', () => {
      inputManager.setupIMEHandling();
      inputManager.setupAltKeyVisualFeedback();
      inputManager.setupKeyboardShortcuts(mockCoordinator);

      // Add some debounced events
      (inputManager as any).emitTerminalInteractionEvent(
        'focus',
        'terminal-1',
        undefined,
        mockCoordinator
      );

      const eventDebounceTimers = (inputManager as any).eventDebounceTimers as Map<string, number>;
      expect(eventDebounceTimers.size).to.be.greaterThan(0);

      // Dispose should clear everything
      inputManager.dispose();

      // Check internal state is reset
      expect(inputManager.isIMEComposing()).to.be.false;
      expect(inputManager.isAgentInteractionMode()).to.be.false;

      const altClickState = inputManager.getAltClickState();
      expect(altClickState.isVSCodeAltClickEnabled).to.be.false;
      expect(altClickState.isAltKeyPressed).to.be.false;
    });
  });
});
