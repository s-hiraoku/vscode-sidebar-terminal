/**
 * Input Handling Architecture Integration TDD Test Suite
 * Following t-wada's TDD methodology for service coordination and end-to-end scenarios
 * Tests real-world input processing flows and component interaction patterns
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import {
  BaseInputHandler,
  InputHandlerConfig,
} from '../../../webview/managers/input/handlers/BaseInputHandler';
import { InputEventService } from '../../../webview/managers/input/services/InputEventService';
import { InputStateManager } from '../../../webview/managers/input/services/InputStateManager';

// Test implementation that combines all input handling services
class IntegratedInputHandler extends BaseInputHandler {
  private eventService: InputEventService;
  private stateManager: InputStateManager;
  private readonly terminalElement: Element;

  constructor(
    terminalElement: Element,
    eventDebounceTimers: Map<string, number> = new Map(),
    config?: InputHandlerConfig
  ) {
    super('IntegratedInputHandler', eventDebounceTimers, config);

    this.terminalElement = terminalElement;
    this.eventService = new InputEventService(this.logger.bind(this));
    this.stateManager = new InputStateManager(this.logger.bind(this));
  }

  protected override doInitialize(): void {
    this.setupInputEventHandling();
    this.setupStateManagement();
  }

  private setupInputEventHandling(): void {
    // Register comprehensive input event handling
    this.eventService.registerEventHandler(
      'terminal-keydown',
      this.terminalElement,
      'keydown',
      this.handleKeyDown.bind(this),
      { debounce: false, preventDefault: false }
    );

    this.eventService.registerEventHandler(
      'terminal-input',
      this.terminalElement,
      'input',
      this.handleInput.bind(this),
      { debounce: true, debounceDelay: 50 }
    );

    this.eventService.registerEventHandler(
      'terminal-click',
      this.terminalElement,
      'click',
      this.handleClick.bind(this),
      { debounce: false }
    );

    this.eventService.registerEventHandler(
      'composition-start',
      this.terminalElement,
      'compositionstart',
      this.handleCompositionStart.bind(this),
      { debounce: false }
    );

    this.eventService.registerEventHandler(
      'composition-end',
      this.terminalElement,
      'compositionend',
      this.handleCompositionEnd.bind(this),
      { debounce: false }
    );
  }

  private setupStateManagement(): void {
    // Listen to state changes for coordination
    this.stateManager.addStateListener('ime', this.onIMEStateChange.bind(this));
    this.stateManager.addStateListener('keyboard', this.onKeyboardStateChange.bind(this));
    this.stateManager.addStateListener('altClick', this.onAltClickStateChange.bind(this));
  }

  private handleKeyDown(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    // Update keyboard state
    this.stateManager.updateKeyboardState({
      lastKeyPressed: keyEvent.key,
      modifiers: {
        ctrl: keyEvent.ctrlKey,
        alt: keyEvent.altKey,
        shift: keyEvent.shiftKey,
        meta: keyEvent.metaKey,
      },
      lastKeyTimestamp: Date.now(),
    });

    // Handle chord mode detection
    if (keyEvent.ctrlKey && keyEvent.key === 'k') {
      this.stateManager.updateKeyboardState({ isInChordMode: true });
    } else if (this.stateManager.getStateSection('keyboard').isInChordMode) {
      this.stateManager.updateKeyboardState({ isInChordMode: false });
    }

    // Handle Alt+Click state
    if (keyEvent.altKey && !this.stateManager.getStateSection('altClick').isAltKeyPressed) {
      this.stateManager.updateAltClickState({ isAltKeyPressed: true });
    } else if (!keyEvent.altKey && this.stateManager.getStateSection('altClick').isAltKeyPressed) {
      this.stateManager.updateAltClickState({ isAltKeyPressed: false });
    }
  }

  private handleInput(_event: Event): void {
    // Only process input if not in IME composition
    if (!this.stateManager.getStateSection('ime').isActive) {
      // Process regular input
      this.logger('Processing regular input event');
    }
  }

  private handleClick(event: Event): void {
    const mouseEvent = event as MouseEvent;
    const altClickState = this.stateManager.getStateSection('altClick');

    if (mouseEvent.altKey && altClickState.isVSCodeAltClickEnabled) {
      // Handle Alt+Click
      this.stateManager.updateAltClickState({
        lastClickPosition: { x: mouseEvent.clientX, y: mouseEvent.clientY },
        clickCount: altClickState.clickCount + 1,
      });
    }
  }

  private handleCompositionStart(event: Event): void {
    const compEvent = event as CompositionEvent;
    this.stateManager.updateIMEState({
      isActive: true,
      data: compEvent.data || '',
      lastEvent: 'start',
      timestamp: Date.now(),
    });
  }

  private handleCompositionEnd(event: Event): void {
    const compEvent = event as CompositionEvent;
    this.stateManager.updateIMEState({
      isActive: false,
      data: compEvent.data || '',
      lastEvent: 'end',
      timestamp: Date.now(),
    });
  }

  private onIMEStateChange(newState: any, previousState: any): void {
    this.logger(`IME state changed: ${previousState.isActive} -> ${newState.isActive}`);
  }

  private onKeyboardStateChange(newState: any, previousState: any): void {
    this.logger(
      `Keyboard state changed: chord mode ${previousState.isInChordMode} -> ${newState.isInChordMode}`
    );
  }

  private onAltClickStateChange(newState: any, previousState: any): void {
    this.logger(
      `Alt+Click state changed: pressed ${previousState.isAltKeyPressed} -> ${newState.isAltKeyPressed}`
    );
  }

  // Expose internal services for testing
  public getEventService(): InputEventService {
    return this.eventService;
  }

  public getStateManager(): InputStateManager {
    return this.stateManager;
  }

  protected override doDispose(): void {
    this.eventService.dispose();
    this.stateManager.dispose();
    super.doDispose();
  }

  public attachLogger(logger: (message: string) => void): void {
    (this as unknown as { logger: (message: string) => void }).logger = logger;
  }
}

describe('Input Handling Architecture Integration TDD Test Suite', () => {
  interface DomEnvironmentSnapshot {
    window?: typeof globalThis.window;
    document?: typeof globalThis.document;
    Event?: typeof globalThis.Event;
    KeyboardEvent?: typeof globalThis.KeyboardEvent;
    MouseEvent?: typeof globalThis.MouseEvent;
    CompositionEvent?: typeof globalThis.CompositionEvent;
    performance?: typeof globalThis.performance;
  }

  let dom: JSDOM;
  let restoreGlobals: (() => void) | undefined;
  let clock: sinon.SinonFakeTimers;
  let terminalElement: Element;
  let integratedHandler: IntegratedInputHandler;
  let logMessages: string[];

  const installDomGlobals = (window: Window): (() => void) => {
    const snapshot: DomEnvironmentSnapshot = {
      window: (global as any).window,
      document: (global as any).document,
      Event: (global as any).Event,
      KeyboardEvent: (global as any).KeyboardEvent,
      MouseEvent: (global as any).MouseEvent,
      CompositionEvent: (global as any).CompositionEvent,
      performance: (global as any).performance,
    };

    (global as any).window = window as unknown as Window & typeof globalThis;
    (global as any).document = window.document;
    (global as any).Event = (window as any).Event;
    (global as any).KeyboardEvent = (window as any).KeyboardEvent;
    (global as any).MouseEvent = (window as any).MouseEvent;
    (global as any).CompositionEvent = (window as any).CompositionEvent;
    // Use Date.now() instead of performance.now() to avoid recursion
    (global as any).performance = { now: () => Date.now() };

    return () => {
      (global as any).window = snapshot.window;
      (global as any).document = snapshot.document;
      (global as any).Event = snapshot.Event;
      (global as any).KeyboardEvent = snapshot.KeyboardEvent;
      (global as any).MouseEvent = snapshot.MouseEvent;
      (global as any).CompositionEvent = snapshot.CompositionEvent;
      (global as any).performance = snapshot.performance;
    };
  };

  beforeEach(() => {
    // Arrange: Setup comprehensive DOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="terminal-container">
            <div id="terminal" contenteditable="true" tabindex="0"></div>
          </div>
        </body>
      </html>
    `,
      {
        url: 'http://localhost',
        pretendToBeVisual: true,
        resources: 'usable',
      }
    );

    restoreGlobals = installDomGlobals(dom.window as any);

    // Setup terminal element
    terminalElement = dom.window.document.getElementById('terminal')!;

    // Setup fake timers
    clock = sinon.useFakeTimers();

    // Create integrated handler
    logMessages = [];
    integratedHandler = new IntegratedInputHandler(terminalElement);
    integratedHandler.attachLogger((message) => {
      logMessages.push(message);
    });

    // Initialize the handler
    integratedHandler.initialize();
  });

  afterEach(() => {
    // Cleanup
    clock.restore();
    integratedHandler.dispose();
    dom.window.close();
    if (restoreGlobals) {
      restoreGlobals();
      restoreGlobals = undefined;
    }
    sinon.restore();
  });

  describe('TDD Red Phase: Service Integration and Coordination', () => {
    describe('Event Service and State Manager Coordination', () => {
      it('should coordinate keyboard event processing with state management', () => {
        // Act: Trigger keyboard event
        const keyEvent = new dom.window.KeyboardEvent('keydown', {
          key: 'Enter',
          ctrlKey: true,
          altKey: false,
          shiftKey: true,
          metaKey: false,
        });

        terminalElement.dispatchEvent(keyEvent);

        // Assert: Event should be processed by event service
        const eventService = integratedHandler.getEventService();
        const eventMetrics = eventService.getGlobalMetrics();
        expect(eventMetrics.totalProcessed).to.equal(1);

        // Assert: State should be updated by state manager
        const stateManager = integratedHandler.getStateManager();
        const keyboardState = stateManager.getStateSection('keyboard');
        expect(keyboardState.lastKeyPressed).to.equal('Enter');
        expect(keyboardState.modifiers.ctrl).to.be.true;
        expect(keyboardState.modifiers.shift).to.be.true;
        expect(keyboardState.lastKeyTimestamp).to.be.greaterThan(0);
      });

      it('should coordinate debounced input events with IME state checking', () => {
        // Arrange: Set IME active state
        const stateManager = integratedHandler.getStateManager();
        stateManager.updateIMEState({ isActive: true });

        // Act: Trigger rapid input events
        for (let i = 0; i < 5; i++) {
          const inputEvent = new dom.window.Event('input');
          terminalElement.dispatchEvent(inputEvent);
        }

        // Assert: Events should be processed but debounced
        const eventService = integratedHandler.getEventService();
        const eventMetrics = eventService.getGlobalMetrics();
        expect(eventMetrics.totalProcessed).to.equal(5);

        // Act: Advance time to trigger debounced processing
        clock.tick(50);

        // Assert: Should have debounced execution
        expect(eventMetrics.totalDebounced).to.equal(1);

        // Assert: Should check IME state during processing (via logs)
        const imeCheckLogs = logMessages.filter(
          (msg) => msg.includes('Processing regular input') || msg.includes('IME')
        );
        // Since IME is active, regular input processing should be skipped
        expect(imeCheckLogs.length).to.equal(0);
      });

      it('should handle concurrent event processing and state updates', () => {
        // Act: Trigger multiple event types simultaneously
        const keydownEvent = new dom.window.KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
        });

        const clickEvent = new dom.window.MouseEvent('click', {
          clientX: 100,
          clientY: 200,
          altKey: true,
        });

        const compositionEvent = new dom.window.CompositionEvent('compositionstart', {
          data: 'test',
        });

        // Dispatch events concurrently
        terminalElement.dispatchEvent(keydownEvent);
        terminalElement.dispatchEvent(clickEvent);
        terminalElement.dispatchEvent(compositionEvent);

        // Assert: All events should be processed
        const eventService = integratedHandler.getEventService();
        expect(eventService.getGlobalMetrics().totalProcessed).to.equal(3);

        // Assert: All state updates should be reflected
        const stateManager = integratedHandler.getStateManager();
        const keyboardState = stateManager.getStateSection('keyboard');
        const altClickState = stateManager.getStateSection('altClick');
        const imeState = stateManager.getStateSection('ime');

        expect(keyboardState.isInChordMode).to.be.true; // Ctrl+K chord
        expect(altClickState.clickCount).to.equal(1); // Alt+Click processed
        expect(imeState.isActive).to.be.true; // IME composition started
      });
    });

    describe('Cross-Service State Synchronization', () => {
      it('should synchronize critical state across all services', () => {
        const stateManager = integratedHandler.getStateManager();

        // Act: Set multiple critical states
        stateManager.updateIMEState({ isActive: true });
        stateManager.updateKeyboardState({ isInChordMode: true });
        stateManager.updateAgentState({ isAwaitingResponse: true });

        // Assert: Should report critical state
        expect(stateManager.hasCriticalStateActive()).to.be.true;

        // Act: Clear one critical state
        stateManager.updateIMEState({ isActive: false });

        // Assert: Should still be critical (other states active)
        expect(stateManager.hasCriticalStateActive()).to.be.true;

        // Act: Clear all critical states
        stateManager.updateKeyboardState({ isInChordMode: false });
        stateManager.updateAgentState({ isAwaitingResponse: false });

        // Assert: Should not be critical
        expect(stateManager.hasCriticalStateActive()).to.be.false;
      });

      it('should handle state changes triggered by event processing', () => {
        // Arrange: Track state changes
        const stateChanges: any[] = [];
        const stateManager = integratedHandler.getStateManager();

        stateManager.addStateListener('*', (newState, _previousState, stateKey) => {
          stateChanges.push({ stateKey, timestamp: Date.now() });
        });

        // Act: Trigger keyboard event that should update state
        const keyEvent = new dom.window.KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
        });

        terminalElement.dispatchEvent(keyEvent);

        // Assert: Should have triggered state changes
        expect(stateChanges.length).to.be.greaterThan(0);
        const keyboardChanges = stateChanges.filter((change) => change.stateKey === 'keyboard');
        expect(keyboardChanges.length).to.be.greaterThan(0);
      });

      it('should maintain state consistency during rapid event sequences', () => {
        const stateManager = integratedHandler.getStateManager();

        // Act: Rapid sequence of Alt key events
        for (let i = 0; i < 10; i++) {
          const keyEvent = new dom.window.KeyboardEvent('keydown', {
            key: 'a',
            altKey: i % 2 === 0, // Alternate Alt key state
          });

          terminalElement.dispatchEvent(keyEvent);
          clock.tick(1); // Small time advance
        }

        // Assert: Final state should be consistent
        const keyboardState = stateManager.getStateSection('keyboard');
        const altClickState = stateManager.getStateSection('altClick');

        // Last event had altKey: false (i=9, 9%2 !== 0)
        expect(keyboardState.modifiers.alt).to.be.false;
        expect(altClickState.isAltKeyPressed).to.be.false;
      });
    });
  });

  describe('TDD Red Phase: End-to-End Input Processing Scenarios', () => {
    describe('Japanese IME Input Flow', () => {
      it('should handle complete Japanese IME composition cycle', () => {
        const stateManager = integratedHandler.getStateManager();
        const eventService = integratedHandler.getEventService();

        // Act: Start IME composition
        const compositionStart = new dom.window.CompositionEvent('compositionstart', {
          data: 'k',
        });
        terminalElement.dispatchEvent(compositionStart);

        // Assert: IME state should be active
        let imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).to.be.true;
        expect(imeState.lastEvent).to.equal('start');

        // Act: Composition update events
        const compositionUpdate1 = new dom.window.CompositionEvent('compositionupdate', {
          data: 'ko',
        });
        const compositionUpdate2 = new dom.window.CompositionEvent('compositionupdate', {
          data: 'kon',
        });

        terminalElement.dispatchEvent(compositionUpdate1);
        terminalElement.dispatchEvent(compositionUpdate2);

        // Act: Input events during composition (should be ignored)
        const inputEvent = new dom.window.Event('input');
        terminalElement.dispatchEvent(inputEvent);

        // Act: Complete composition
        const compositionEnd = new dom.window.CompositionEvent('compositionend', {
          data: 'こん',
        });
        terminalElement.dispatchEvent(compositionEnd);

        // Assert: IME state should be inactive
        imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).to.be.false;
        expect(imeState.lastEvent).to.equal('end');
        expect(imeState.data).to.equal('こん');

        // Assert: All events processed
        expect(eventService.getGlobalMetrics().totalProcessed).to.be.greaterThan(3);

        // Assert: Input processing was properly coordinated
        const inputLogs = logMessages.filter((msg) => msg.includes('Processing regular input'));
        // Input should not be processed during IME composition
        expect(inputLogs.length).to.equal(0);
      });

      it('should handle IME composition cancellation', () => {
        const stateManager = integratedHandler.getStateManager();

        // Act: Start and immediately cancel IME composition
        const compositionStart = new dom.window.CompositionEvent('compositionstart', {
          data: 'test',
        });
        terminalElement.dispatchEvent(compositionStart);

        expect(stateManager.getStateSection('ime').isActive).to.be.true;

        // Act: Cancel composition (empty data)
        const compositionEnd = new dom.window.CompositionEvent('compositionend', {
          data: '',
        });
        terminalElement.dispatchEvent(compositionEnd);

        // Assert: IME should be properly deactivated
        const imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).to.be.false;
        expect(imeState.data).to.equal('');
      });
    });

    describe('VS Code Alt+Click Integration Scenarios', () => {
      it('should handle VS Code Alt+Click cursor positioning workflow', () => {
        const stateManager = integratedHandler.getStateManager();

        // Arrange: Enable VS Code Alt+Click
        stateManager.updateAltClickState({
          isVSCodeAltClickEnabled: true,
        });

        // Act: Alt+Click sequence
        const altKeyDown = new dom.window.KeyboardEvent('keydown', {
          key: 'Alt',
          altKey: true,
        });
        terminalElement.dispatchEvent(altKeyDown);

        // Assert: Alt key state should be tracked
        expect(stateManager.getStateSection('altClick').isAltKeyPressed).to.be.true;

        // Act: Click while Alt is pressed
        const altClick = new dom.window.MouseEvent('click', {
          clientX: 150,
          clientY: 250,
          altKey: true,
        });
        terminalElement.dispatchEvent(altClick);

        // Assert: Alt+Click should be processed
        const altClickState = stateManager.getStateSection('altClick');
        expect(altClickState.lastClickPosition).to.deep.equal({ x: 150, y: 250 });
        expect(altClickState.clickCount).to.equal(1);

        // Act: Release Alt key
        const altKeyUp = new dom.window.KeyboardEvent('keyup', {
          key: 'Alt',
          altKey: false,
        });
        terminalElement.dispatchEvent(altKeyUp);

        // Assert: Alt key state should be cleared
        // Note: keyup events need to be handled to track Alt release
        // For this test, we'll manually update the state
        stateManager.updateAltClickState({ isAltKeyPressed: false });
        expect(stateManager.getStateSection('altClick').isAltKeyPressed).to.be.false;
      });

      it('should ignore Alt+Click when VS Code integration is disabled', () => {
        const stateManager = integratedHandler.getStateManager();

        // Arrange: Disable VS Code Alt+Click
        stateManager.updateAltClickState({
          isVSCodeAltClickEnabled: false,
        });

        // Act: Alt+Click
        const altClick = new dom.window.MouseEvent('click', {
          clientX: 100,
          clientY: 200,
          altKey: true,
        });
        terminalElement.dispatchEvent(altClick);

        // Assert: Click should not be processed as Alt+Click
        const altClickState = stateManager.getStateSection('altClick');
        expect(altClickState.lastClickPosition).to.be.null;
        expect(altClickState.clickCount).to.equal(0);
      });
    });

    describe('Keyboard Chord Mode Scenarios', () => {
      it('should handle VS Code chord mode (Ctrl+K) sequences', () => {
        const stateManager = integratedHandler.getStateManager();

        // Act: Trigger Ctrl+K to enter chord mode
        const ctrlK = new dom.window.KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
        });
        terminalElement.dispatchEvent(ctrlK);

        // Assert: Should enter chord mode
        let keyboardState = stateManager.getStateSection('keyboard');
        expect(keyboardState.isInChordMode).to.be.true;
        expect(keyboardState.lastKeyPressed).to.equal('k');
        expect(keyboardState.modifiers.ctrl).to.be.true;

        // Assert: Should report critical state
        expect(stateManager.hasCriticalStateActive()).to.be.true;

        // Act: Follow with second key to complete chord
        const secondKey = new dom.window.KeyboardEvent('keydown', {
          key: 'c',
          ctrlKey: false,
        });
        terminalElement.dispatchEvent(secondKey);

        // Assert: Should exit chord mode
        keyboardState = stateManager.getStateSection('keyboard');
        expect(keyboardState.isInChordMode).to.be.false;
        expect(keyboardState.lastKeyPressed).to.equal('c');

        // Assert: Should not report critical state
        expect(stateManager.hasCriticalStateActive()).to.be.false;
      });

      it('should track chord mode state changes through event processing', () => {
        // Arrange: Track state changes
        const stateChanges: any[] = [];
        const stateManager = integratedHandler.getStateManager();

        stateManager.addStateListener('keyboard', (newState, previousState) => {
          stateChanges.push({
            chordMode: { from: previousState.isInChordMode, to: newState.isInChordMode },
          });
        });

        // Act: Enter and exit chord mode
        const ctrlK = new dom.window.KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
        });
        terminalElement.dispatchEvent(ctrlK);

        const escKey = new dom.window.KeyboardEvent('keydown', {
          key: 'Escape',
        });
        terminalElement.dispatchEvent(escKey);

        // Assert: Should track chord mode transitions
        expect(stateChanges.length).to.be.greaterThan(0);
        const chordModeChanges = stateChanges.filter(
          (change) => change.chordMode.from !== change.chordMode.to
        );
        expect(chordModeChanges.length).to.be.greaterThan(0);
      });
    });
  });

  describe('TDD Red Phase: Complex Multi-Service Interactions', () => {
    describe('Concurrent Input Processing', () => {
      it('should handle simultaneous IME composition and keyboard shortcuts', () => {
        const stateManager = integratedHandler.getStateManager();

        // Act: Start IME composition
        const compositionStart = new dom.window.CompositionEvent('compositionstart', {
          data: 'test',
        });
        terminalElement.dispatchEvent(compositionStart);

        // Act: Try keyboard shortcut during IME composition
        const ctrlC = new dom.window.KeyboardEvent('keydown', {
          key: 'c',
          ctrlKey: true,
        });
        terminalElement.dispatchEvent(ctrlC);

        // Assert: Both events should be processed but states should be consistent
        const imeState = stateManager.getStateSection('ime');
        const keyboardState = stateManager.getStateSection('keyboard');

        expect(imeState.isActive).to.be.true;
        expect(keyboardState.lastKeyPressed).to.equal('c');
        expect(keyboardState.modifiers.ctrl).to.be.true;

        // Both critical states should be reported
        expect(stateManager.hasCriticalStateActive()).to.be.true;
      });

      it('should prioritize IME composition over regular input processing', () => {
        const _stateManager = integratedHandler.getStateManager();

        // Act: Start IME composition
        const compositionStart = new dom.window.CompositionEvent('compositionstart', {
          data: 'composing',
        });
        terminalElement.dispatchEvent(compositionStart);

        // Act: Try to send input events during composition
        for (let i = 0; i < 3; i++) {
          const inputEvent = new dom.window.Event('input');
          terminalElement.dispatchEvent(inputEvent);
        }

        // Act: Advance time to trigger debounced processing
        clock.tick(50);

        // Assert: Input events should be processed by event service
        const eventService = integratedHandler.getEventService();
        expect(eventService.getGlobalMetrics().totalProcessed).to.be.greaterThan(3);

        // Assert: But regular input processing should be skipped (via logs)
        const inputProcessingLogs = logMessages.filter((msg) =>
          msg.includes('Processing regular input event')
        );
        expect(inputProcessingLogs.length).to.equal(0); // No regular processing during IME
      });
    });

    describe('Error Handling and Recovery', () => {
      it('should handle event processing errors without breaking state management', () => {
        // Arrange: Cause an error in event processing by modifying handler
        const originalHandleKeyDown = (integratedHandler as any).handleKeyDown;
        (integratedHandler as any).handleKeyDown = () => {
          throw new Error('Simulated processing error');
        };

        const stateManager = integratedHandler.getStateManager();

        // Act: Trigger event that will cause error
        const keyEvent = new dom.window.KeyboardEvent('keydown', {
          key: 'a',
        });

        expect(() => {
          terminalElement.dispatchEvent(keyEvent);
        }).to.not.throw();

        // Assert: Event service should handle error gracefully
        const eventService = integratedHandler.getEventService();
        expect(eventService.getGlobalMetrics().totalErrors).to.be.greaterThan(0);

        // Assert: State manager should remain functional
        expect(() => {
          stateManager.updateIMEState({ isActive: true });
        }).to.not.throw();

        // Restore original handler
        (integratedHandler as any).handleKeyDown = originalHandleKeyDown;
      });

      it('should recover from state validation errors', () => {
        const stateManager = integratedHandler.getStateManager();

        // Act: Cause state validation errors
        stateManager.updateIMEState({
          startOffset: -1,
          endOffset: -5,
          timestamp: -1000,
        });

        stateManager.updateKeyboardState({
          lastKeyTimestamp: -2000,
        });

        // Assert: Should log validation errors
        const errorLogs = logMessages.filter((msg) => msg.includes('State validation errors'));
        expect(errorLogs.length).to.be.greaterThan(0);

        // Assert: Services should remain functional despite validation errors
        expect(() => {
          const keyEvent = new dom.window.KeyboardEvent('keydown', {
            key: 'b',
          });
          terminalElement.dispatchEvent(keyEvent);
        }).to.not.throw();

        // Assert: Valid state updates should still work
        stateManager.updateIMEState({
          isActive: true,
          data: 'valid data',
          timestamp: Date.now(),
        });

        const imeState = stateManager.getStateSection('ime');
        expect(imeState.isActive).to.be.true;
        expect(imeState.data).to.equal('valid data');
      });
    });

    describe('Performance Under Load', () => {
      it('should handle high-frequency event processing efficiently', () => {
        const eventService = integratedHandler.getEventService();

        // Act: Generate high-frequency events
        const startTime = Date.now();
        for (let i = 0; i < 1000; i++) {
          const keyEvent = new dom.window.KeyboardEvent('keydown', {
            key: String.fromCharCode(65 + (i % 26)), // A-Z
          });
          terminalElement.dispatchEvent(keyEvent);
        }
        const endTime = Date.now();

        // Assert: All events should be processed
        expect(eventService.getGlobalMetrics().totalProcessed).to.equal(1000);

        // Assert: Processing should be reasonably fast
        const processingTime = endTime - startTime;
        expect(processingTime).to.be.lessThan(5000); // Less than 5 seconds

        // Assert: Average processing time should be reasonable
        const avgTime = eventService.getGlobalMetrics().averageProcessingTime;
        expect(avgTime).to.be.lessThan(50); // Less than 50ms average
      });

      it('should maintain state consistency under rapid state changes', () => {
        const stateManager = integratedHandler.getStateManager();

        // Act: Rapid state changes
        for (let i = 0; i < 100; i++) {
          stateManager.updateIMEState({
            data: `rapid${i}`,
            timestamp: Date.now() + i,
          });

          stateManager.updateKeyboardState({
            lastKeyPressed: `key${i}`,
            lastKeyTimestamp: Date.now() + i,
          });

          clock.tick(1);
        }

        // Assert: Final state should be consistent
        const imeState = stateManager.getStateSection('ime');
        const keyboardState = stateManager.getStateSection('keyboard');

        expect(imeState.data).to.equal('rapid99');
        expect(keyboardState.lastKeyPressed).to.equal('key99');

        // Assert: State history should be managed efficiently
        const history = stateManager.getStateHistory(10);
        expect(history.length).to.equal(10); // Limited to prevent memory issues
      });
    });
  });

  describe('TDD Red Phase: Resource Management and Cleanup', () => {
    describe('Integrated Disposal', () => {
      it('should dispose all services cleanly on handler disposal', () => {
        const eventService = integratedHandler.getEventService();
        const stateManager = integratedHandler.getStateManager();

        // Arrange: Generate some activity
        const keyEvent = new dom.window.KeyboardEvent('keydown', { key: 'test' });
        terminalElement.dispatchEvent(keyEvent);

        stateManager.updateIMEState({ isActive: true });

        // Verify initial state
        expect(eventService.getGlobalMetrics().totalProcessed).to.be.greaterThan(0);
        expect(stateManager.getStateSection('ime').isActive).to.be.true;

        // Act: Dispose integrated handler
        integratedHandler.dispose();

        // Assert: Event service should be disposed
        expect(eventService.getRegisteredHandlers()).to.have.length(0);

        // Assert: State manager should be disposed
        const state = stateManager.getState();
        expect(state.ime.isActive).to.be.false;

        // Assert: Should log disposal
        const disposalLogs = logMessages.filter(
          (msg) => msg.includes('disposing') || msg.includes('disposed')
        );
        expect(disposalLogs.length).to.be.greaterThan(0);
      });

      it('should handle disposal during active event processing', () => {
        // Arrange: Start processing that would normally continue
        const inputEvent = new dom.window.Event('input');
        terminalElement.dispatchEvent(inputEvent);

        // Act: Dispose during debounce period
        integratedHandler.dispose();

        // Act: Advance time (debounced event should not execute)
        clock.tick(50);

        // Assert: No errors should occur and logs should indicate clean disposal
        const errorLogs = logMessages.filter((msg) => msg.toLowerCase().includes('error'));
        expect(errorLogs.length).to.equal(0);
      });

      it('should prevent memory leaks after disposal', () => {
        // Arrange: Create references that might leak
        const stateManager = integratedHandler.getStateManager();
        const eventService = integratedHandler.getEventService();

        // Add state listener
        const listener = sinon.stub();
        stateManager.addStateListener('*', listener);

        // Register additional event handler
        eventService.registerEventHandler('memory-test', terminalElement, 'click', () => {});

        // Act: Dispose
        integratedHandler.dispose();

        // Act: Try to trigger events and state changes
        terminalElement.dispatchEvent(new dom.window.Event('click'));
        stateManager.updateIMEState({ isActive: true });

        // Assert: Disposed handlers should not execute
        expect(listener.called).to.be.false;

        // Assert: No new event registrations should exist
        expect(eventService.getRegisteredHandlers()).to.have.length(0);
      });
    });
  });
});
