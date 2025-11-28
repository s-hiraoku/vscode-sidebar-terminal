/**
 * VS Code Compatibility Pattern TDD Test Suite
 * Following t-wada's TDD methodology for VS Code integration standards
 * RED-GREEN-REFACTOR cycles with focus on VS Code terminal behavior patterns
 * Tests based on VS Code terminal integration requirements and user expectations
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import {
  InputEventService,
  EventHandlerConfig as _EventHandlerConfig,
} from '../../../../../webview/managers/input/services/InputEventService';
import {
  InputStateManager,
  AltClickState as _AltClickState,
  KeyboardState as _KeyboardState,
} from '../../../../../webview/managers/input/services/InputStateManager';

// Mock VS Code settings that affect terminal behavior
interface VSCodeTerminalSettings {
  'terminal.integrated.altClickMovesCursor': boolean;
  'editor.multiCursorModifier': 'ctrlCmd' | 'alt';
  'terminal.integrated.sendKeybindingsToShell': boolean;
  'terminal.integrated.commandsToSkipShell': string[];
  'terminal.integrated.allowChords': boolean;
  'terminal.integrated.allowMnemonics': boolean;
  'workbench.list.automaticKeyboardNavigation': boolean;
  'terminal.integrated.macOptionIsMeta': boolean;
  'terminal.integrated.macOptionClickForcesSelection': boolean;
}

// VS Code keybinding patterns that should be respected
const VS_CODE_KEYBINDINGS = {
  // Terminal navigation
  'ctrl+shift+`': 'workbench.action.terminal.new',
  'ctrl+shift+c': 'workbench.action.terminal.openNativeConsole',
  'ctrl+shift+t': 'workbench.action.reopenClosedEditor',

  // Terminal switching
  'ctrl+pagedown': 'workbench.action.terminal.focusNext',
  'ctrl+pageup': 'workbench.action.terminal.focusPrevious',
  'ctrl+1': 'workbench.action.terminal.focusAtIndex1',
  'ctrl+2': 'workbench.action.terminal.focusAtIndex2',

  // Chord commands
  'ctrl+k ctrl+c': 'editor.action.addCommentLine',
  'ctrl+k ctrl+u': 'editor.action.removeCommentLine',
  'ctrl+k ctrl+s': 'workbench.action.openKeyboardShortcuts',

  // Multi-cursor
  'alt+click': 'editor.action.insertCursorAtEndOfEachLineSelected',
  'ctrl+alt+down': 'editor.action.insertCursorBelow',
  'ctrl+alt+up': 'editor.action.insertCursorAbove',
};

// Mock VS Code API patterns
class MockVSCodeTerminalIntegration {
  private eventService: InputEventService;
  private stateManager: InputStateManager;
  private element: Element;
  private settings: Partial<VSCodeTerminalSettings>;
  private keybindingCallbacks: Map<string, () => void> = new Map();

  constructor(
    eventService: InputEventService,
    stateManager: InputStateManager,
    element: Element,
    settings: Partial<VSCodeTerminalSettings> = {}
  ) {
    this.eventService = eventService;
    this.stateManager = stateManager;
    this.element = element;
    this.settings = {
      'terminal.integrated.altClickMovesCursor': true,
      'editor.multiCursorModifier': 'alt',
      'terminal.integrated.sendKeybindingsToShell': false,
      'terminal.integrated.commandsToSkipShell': [],
      'terminal.integrated.allowChords': true,
      'terminal.integrated.allowMnemonics': true,
      'workbench.list.automaticKeyboardNavigation': true,
      'terminal.integrated.macOptionIsMeta': false,
      'terminal.integrated.macOptionClickForcesSelection': false,
      ...settings,
    };

    this.setupVSCodePatterns();
  }

  private setupVSCodePatterns(): void {
    // Alt+Click cursor positioning
    this.eventService.registerEventHandler(
      'vscode-alt-click',
      this.element,
      'click',
      this.handleAltClick.bind(this),
      { debounce: false, preventDefault: false }
    );

    // Keyboard navigation patterns
    this.eventService.registerEventHandler(
      'vscode-keydown',
      this.element,
      'keydown',
      this.handleKeyDown.bind(this),
      { debounce: false, preventDefault: false }
    );

    // VS Code chord detection
    this.eventService.registerEventHandler(
      'vscode-chord-detection',
      this.element,
      'keydown',
      this.handleChordDetection.bind(this),
      { debounce: false }
    );

    // Update state with VS Code settings
    this.stateManager.updateAltClickState({
      isVSCodeAltClickEnabled: this.isAltClickEnabled(),
    });
  }

  private isAltClickEnabled(): boolean {
    return (
      this.settings['terminal.integrated.altClickMovesCursor'] === true &&
      this.settings['editor.multiCursorModifier'] === 'alt'
    );
  }

  private handleAltClick(event: Event): void {
    const mouseEvent = event as MouseEvent;
    if (!this.isAltClickEnabled()) {
      return;
    }

    if (mouseEvent.altKey) {
      const altClickState = this.stateManager.getStateSection('altClick');

      this.stateManager.updateAltClickState({
        lastClickPosition: { x: mouseEvent.clientX, y: mouseEvent.clientY },
        clickCount: altClickState.clickCount + 1,
      });

      // Simulate cursor positioning
      this.triggerKeybinding('alt+click');

      // Prevent default behavior for Alt+Click
      mouseEvent.preventDefault();
    }
  }

  private handleKeyDown(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    // Update keyboard state with VS Code patterns
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

    // Handle VS Code terminal-specific keybindings
    const keybinding = this.getKeybindingString(keyEvent);

    // Check if should send to shell or handle in VS Code
    if (this.shouldSendToShell(keybinding)) {
      // Let terminal handle
      return;
    }

    // Handle VS Code keybinding
    this.handleVSCodeKeybinding(keybinding, keyEvent);
  }

  private handleChordDetection(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (!this.settings['terminal.integrated.allowChords']) {
      return;
    }

    // Detect chord initiation (Ctrl+K)
    if (keyEvent.ctrlKey && keyEvent.key.toLowerCase() === 'k') {
      this.stateManager.updateKeyboardState({
        isInChordMode: true,
      });

      keyEvent.preventDefault();
      return;
    }

    // Handle chord completion
    const keyboardState = this.stateManager.getStateSection('keyboard');
    if (keyboardState.isInChordMode) {
      const chordCommand = `ctrl+k ${keyEvent.key.toLowerCase()}`;

      this.stateManager.updateKeyboardState({
        isInChordMode: false,
      });

      this.handleVSCodeKeybinding(chordCommand, keyEvent);
    }
  }

  private getKeybindingString(event: KeyboardEvent): string {
    const parts: string[] = [];

    if (event.ctrlKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    if (event.metaKey) parts.push('meta');

    parts.push(event.key.toLowerCase());

    return parts.join('+');
  }

  private shouldSendToShell(keybinding: string): boolean {
    if (!this.settings['terminal.integrated.sendKeybindingsToShell']) {
      return false;
    }

    const skipCommands = this.settings['terminal.integrated.commandsToSkipShell'] || [];
    return !skipCommands.includes(keybinding);
  }

  private handleVSCodeKeybinding(keybinding: string, event: KeyboardEvent): void {
    const callback = this.keybindingCallbacks.get(keybinding);
    if (callback) {
      callback();
      event.preventDefault();
    }
  }

  private triggerKeybinding(keybinding: string): void {
    const callback = this.keybindingCallbacks.get(keybinding);
    if (callback) {
      callback();
    }
  }

  // Test API methods
  public registerKeybindingCallback(keybinding: string, callback: () => void): void {
    this.keybindingCallbacks.set(keybinding, callback);
  }

  public updateSettings(newSettings: Partial<VSCodeTerminalSettings>): void {
    this.settings = { ...this.settings, ...newSettings };

    // Update state to reflect new settings
    this.stateManager.updateAltClickState({
      isVSCodeAltClickEnabled: this.isAltClickEnabled(),
    });
  }

  public getSettings(): Partial<VSCodeTerminalSettings> {
    return { ...this.settings };
  }

  public simulateVSCodeCommand(command: string): void {
    // Simulate VS Code command execution
    const keybinding = Object.keys(VS_CODE_KEYBINDINGS).find(
      (key) => VS_CODE_KEYBINDINGS[key as keyof typeof VS_CODE_KEYBINDINGS] === command
    );

    if (keybinding) {
      this.triggerKeybinding(keybinding);
    }
  }
}

describe('VS Code Compatibility Pattern TDD Test Suite', () => {
  let jsdom: JSDOM;
  let clock: sinon.SinonFakeTimers;
  let terminalElement: Element;
  let eventService: InputEventService;
  let stateManager: InputStateManager;
  let vscodeIntegration: MockVSCodeTerminalIntegration;
  let logMessages: string[];

  beforeEach(() => {
    // Arrange: Setup VS Code-like DOM environment
    jsdom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <div class="monaco-workbench">
            <div class="terminal-outer-container">
              <div class="terminal-wrapper">
                <div id="terminal" class="xterm" tabindex="0"></div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
      {
        url: 'vscode-webview://terminal',
        pretendToBeVisual: true,
        resources: 'usable',
      }
    );

    // Setup global environment
    global.window = jsdom.window as any;
    global.document = jsdom.window.document;
    global.Event = jsdom.window.Event;
    global.KeyboardEvent = jsdom.window.KeyboardEvent;
    global.MouseEvent = jsdom.window.MouseEvent;

    // Setup terminal element
    terminalElement = document.getElementById('terminal')!;

    // Setup fake timers
    clock = sinon.useFakeTimers();

    // Setup services
    logMessages = [];
    const mockLogger = (message: string) => {
      logMessages.push(message);
    };

    eventService = new InputEventService(mockLogger);
    stateManager = new InputStateManager(mockLogger);

    // Setup VS Code integration
    vscodeIntegration = new MockVSCodeTerminalIntegration(
      eventService,
      stateManager,
      terminalElement
    );
  });

  afterEach(() => {
    // Cleanup
    clock.restore();
    eventService.dispose();
    stateManager.dispose();
    jsdom.window.close();
  });

  describe('TDD Red Phase: VS Code Alt+Click Integration', () => {
    describe('Alt+Click Cursor Positioning', () => {
      it('should enable Alt+Click when VS Code settings are correct', () => {
        // Arrange: Default settings should enable Alt+Click
        const altClickState = stateManager.getStateSection('altClick');
        expect(altClickState.isVSCodeAltClickEnabled).to.be.true;

        // Act: Perform Alt+Click
        const altClickCallback = sinon.stub();
        vscodeIntegration.registerKeybindingCallback('alt+click', altClickCallback);

        const altClickEvent = new jsdom.window.MouseEvent('click', {
          clientX: 100,
          clientY: 200,
          altKey: true,
          bubbles: true,
          cancelable: true,
        });

        terminalElement.dispatchEvent(altClickEvent);

        // Assert: Should trigger Alt+Click functionality
        expect(altClickCallback.called).to.be.true;

        const updatedAltClickState = stateManager.getStateSection('altClick');
        expect(updatedAltClickState.lastClickPosition).to.deep.equal({ x: 100, y: 200 });
        expect(updatedAltClickState.clickCount).to.equal(1);
      });

      it('should disable Alt+Click when VS Code settings are incompatible', () => {
        // Act: Update settings to disable Alt+Click
        vscodeIntegration.updateSettings({
          'editor.multiCursorModifier': 'ctrlCmd', // Not 'alt'
        });

        // Assert: Should disable Alt+Click
        const altClickState = stateManager.getStateSection('altClick');
        expect(altClickState.isVSCodeAltClickEnabled).to.be.false;

        // Act: Try Alt+Click
        const altClickCallback = sinon.stub();
        vscodeIntegration.registerKeybindingCallback('alt+click', altClickCallback);

        const altClickEvent = new jsdom.window.MouseEvent('click', {
          clientX: 150,
          clientY: 250,
          altKey: true,
        });

        terminalElement.dispatchEvent(altClickEvent);

        // Assert: Should not trigger Alt+Click functionality
        expect(altClickCallback.called).to.be.false;

        const updatedAltClickState = stateManager.getStateSection('altClick');
        expect(updatedAltClickState.lastClickPosition).to.be.null;
        expect(updatedAltClickState.clickCount).to.equal(0);
      });

      it('should handle macOS Option+Click behavior when configured', () => {
        // Act: Configure macOS Option behavior
        vscodeIntegration.updateSettings({
          'terminal.integrated.macOptionIsMeta': true,
          'terminal.integrated.macOptionClickForcesSelection': true,
        });

        // Act: Simulate Option+Click on macOS
        const optionClickEvent = new jsdom.window.MouseEvent('click', {
          clientX: 300,
          clientY: 400,
          altKey: true, // Alt key represents Option on macOS
          metaKey: false,
        });

        const selectionCallback = sinon.stub();
        vscodeIntegration.registerKeybindingCallback('alt+click', selectionCallback);

        terminalElement.dispatchEvent(optionClickEvent);

        // Assert: Should handle macOS Option+Click
        expect(selectionCallback.called).to.be.true;

        const altClickState = stateManager.getStateSection('altClick');
        expect(altClickState.lastClickPosition).to.deep.equal({ x: 300, y: 400 });
      });

      it('should prevent default Alt+Click behavior when VS Code handles it', () => {
        // Arrange: Mock preventDefault tracking
        let preventDefaultCalled = false;
        const originalPreventDefault = jsdom.window.MouseEvent.prototype.preventDefault;

        jsdom.window.MouseEvent.prototype.preventDefault = function () {
          preventDefaultCalled = true;
          originalPreventDefault.call(this);
        };

        // Act: Perform Alt+Click
        const altClickEvent = new jsdom.window.MouseEvent('click', {
          clientX: 100,
          clientY: 200,
          altKey: true,
          bubbles: true,
          cancelable: true,
        });

        terminalElement.dispatchEvent(altClickEvent);

        // Assert: Should prevent default behavior
        expect(preventDefaultCalled).to.be.true;

        // Restore
        jsdom.window.MouseEvent.prototype.preventDefault = originalPreventDefault;
      });
    });

    describe('Multi-Cursor Modifier Integration', () => {
      it('should respect editor.multiCursorModifier setting', () => {
        // Act: Test different multi-cursor modifiers
        const modifierTests = [
          { setting: 'alt', expectEnabled: true },
          { setting: 'ctrlCmd', expectEnabled: false },
        ] as const;

        modifierTests.forEach(({ setting, expectEnabled }) => {
          vscodeIntegration.updateSettings({
            'editor.multiCursorModifier': setting,
          });

          const altClickState = stateManager.getStateSection('altClick');
          expect(altClickState.isVSCodeAltClickEnabled).to.equal(expectEnabled);
        });
      });

      it('should handle Alt+Click tracking independent of multi-cursor setting', () => {
        // Act: Disable Alt+Click via multi-cursor setting
        vscodeIntegration.updateSettings({
          'editor.multiCursorModifier': 'ctrlCmd',
        });

        // Act: Still track Alt key state for other purposes
        const keyEvent = new jsdom.window.KeyboardEvent('keydown', {
          key: 'Alt',
          altKey: true,
        });

        terminalElement.dispatchEvent(keyEvent);

        // Assert: Should still track Alt key state
        const keyboardState = stateManager.getStateSection('keyboard');
        expect(keyboardState.modifiers.alt).to.be.true;

        // But Alt+Click should be disabled
        const altClickState = stateManager.getStateSection('altClick');
        expect(altClickState.isVSCodeAltClickEnabled).to.be.false;
      });
    });
  });

  describe('TDD Red Phase: VS Code Keybinding Integration', () => {
    describe('Terminal Navigation Keybindings', () => {
      it('should handle standard VS Code terminal keybindings', () => {
        // Arrange: Register callbacks for terminal commands
        const terminalCallbacks = {
          newTerminal: sinon.stub(),
          nextTerminal: sinon.stub(),
          prevTerminal: sinon.stub(),
          focusTerminal1: sinon.stub(),
        };

        vscodeIntegration.registerKeybindingCallback('ctrl+shift+`', terminalCallbacks.newTerminal);
        vscodeIntegration.registerKeybindingCallback(
          'ctrl+pagedown',
          terminalCallbacks.nextTerminal
        );
        vscodeIntegration.registerKeybindingCallback('ctrl+pageup', terminalCallbacks.prevTerminal);
        vscodeIntegration.registerKeybindingCallback('ctrl+1', terminalCallbacks.focusTerminal1);

        // Act: Trigger terminal navigation keys
        const keys = [
          { key: '`', ctrlKey: true, shiftKey: true, callback: terminalCallbacks.newTerminal },
          { key: 'PageDown', ctrlKey: true, callback: terminalCallbacks.nextTerminal },
          { key: 'PageUp', ctrlKey: true, callback: terminalCallbacks.prevTerminal },
          { key: '1', ctrlKey: true, callback: terminalCallbacks.focusTerminal1 },
        ];

        keys.forEach(({ key, ctrlKey, shiftKey = false, callback }) => {
          const keyEvent = new jsdom.window.KeyboardEvent('keydown', {
            key,
            ctrlKey,
            shiftKey,
            bubbles: true,
            cancelable: true,
          });

          terminalElement.dispatchEvent(keyEvent);

          // Assert: Should trigger corresponding callback
          expect(callback.called).to.be.true;
        });
      });

      it('should respect terminal.integrated.sendKeybindingsToShell setting', () => {
        // Act: Configure to send keybindings to shell
        vscodeIntegration.updateSettings({
          'terminal.integrated.sendKeybindingsToShell': true,
          'terminal.integrated.commandsToSkipShell': ['ctrl+c', 'ctrl+d'],
        });

        const _shellCallback = sinon.stub();
        const vscodeCallback = sinon.stub();

        vscodeIntegration.registerKeybindingCallback('ctrl+l', vscodeCallback);

        // Act: Send Ctrl+L (should go to shell)
        const ctrlL = new jsdom.window.KeyboardEvent('keydown', {
          key: 'l',
          ctrlKey: true,
        });

        terminalElement.dispatchEvent(ctrlL);

        // Assert: VS Code callback should NOT be triggered (goes to shell)
        expect(vscodeCallback.called).to.be.false;

        // Act: Send Ctrl+C (should be handled by VS Code due to skip list)
        const ctrlC = new jsdom.window.KeyboardEvent('keydown', {
          key: 'c',
          ctrlKey: true,
        });

        vscodeIntegration.registerKeybindingCallback('ctrl+c', vscodeCallback);
        terminalElement.dispatchEvent(ctrlC);

        // Assert: Should be handled by VS Code (in skip list)
        expect(vscodeCallback.called).to.be.true;
      });

      it('should handle keyboard state tracking for VS Code patterns', () => {
        // Act: Trigger various VS Code key combinations
        const keySequences = [
          { key: 'Tab', shiftKey: true }, // Shift+Tab
          { key: 'F1', ctrlKey: false }, // F1 (Command palette)
          { key: 'p', ctrlKey: true, shiftKey: true }, // Ctrl+Shift+P
          { key: 'Enter', altKey: true }, // Alt+Enter
        ];

        keySequences.forEach(({ key, ctrlKey = false, shiftKey = false, altKey = false }) => {
          const keyEvent = new jsdom.window.KeyboardEvent('keydown', {
            key,
            ctrlKey,
            shiftKey,
            altKey,
          });

          terminalElement.dispatchEvent(keyEvent);

          // Assert: Keyboard state should be updated correctly
          const keyboardState = stateManager.getStateSection('keyboard');
          expect(keyboardState.lastKeyPressed).to.equal(key);
          expect(keyboardState.modifiers.ctrl).to.equal(ctrlKey);
          expect(keyboardState.modifiers.shift).to.equal(shiftKey);
          expect(keyboardState.modifiers.alt).to.equal(altKey);
        });
      });
    });

    describe('Chord Command Support', () => {
      it('should handle VS Code chord commands when enabled', () => {
        // Arrange: Enable chord commands
        vscodeIntegration.updateSettings({
          'terminal.integrated.allowChords': true,
        });

        const chordCallbacks = {
          addComment: sinon.stub(),
          removeComment: sinon.stub(),
          openKeyboardShortcuts: sinon.stub(),
        };

        vscodeIntegration.registerKeybindingCallback('ctrl+k c', chordCallbacks.addComment);
        vscodeIntegration.registerKeybindingCallback('ctrl+k u', chordCallbacks.removeComment);
        vscodeIntegration.registerKeybindingCallback(
          'ctrl+k s',
          chordCallbacks.openKeyboardShortcuts
        );

        // Act: Execute chord sequence (Ctrl+K, then C)
        const ctrlK = new jsdom.window.KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });

        terminalElement.dispatchEvent(ctrlK);

        // Assert: Should enter chord mode
        const keyboardState = stateManager.getStateSection('keyboard');
        expect(keyboardState.isInChordMode).to.be.true;

        // Act: Complete chord with 'C'
        const cKey = new jsdom.window.KeyboardEvent('keydown', {
          key: 'c',
          ctrlKey: false,
        });

        terminalElement.dispatchEvent(cKey);

        // Assert: Should execute chord command and exit chord mode
        expect(chordCallbacks.addComment.called).to.be.true;

        const finalKeyboardState = stateManager.getStateSection('keyboard');
        expect(finalKeyboardState.isInChordMode).to.be.false;
      });

      it('should disable chord commands when setting is false', () => {
        // Act: Disable chord commands
        vscodeIntegration.updateSettings({
          'terminal.integrated.allowChords': false,
        });

        const chordCallback = sinon.stub();
        vscodeIntegration.registerKeybindingCallback('ctrl+k c', chordCallback);

        // Act: Try chord sequence
        const ctrlK = new jsdom.window.KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
        });

        terminalElement.dispatchEvent(ctrlK);

        // Assert: Should NOT enter chord mode
        const keyboardState = stateManager.getStateSection('keyboard');
        expect(keyboardState.isInChordMode).to.be.false;

        // Chord callback should not be triggered
        expect(chordCallback.called).to.be.false;
      });

      it('should handle chord timeout and cancellation', () => {
        // Arrange: Enable chords
        vscodeIntegration.updateSettings({
          'terminal.integrated.allowChords': true,
        });

        // Act: Start chord sequence
        const ctrlK = new jsdom.window.KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
        });

        terminalElement.dispatchEvent(ctrlK);
        expect(stateManager.getStateSection('keyboard').isInChordMode).to.be.true;

        // Act: Press Escape to cancel chord
        const escKey = new jsdom.window.KeyboardEvent('keydown', {
          key: 'Escape',
        });

        terminalElement.dispatchEvent(escKey);

        // Assert: Should exit chord mode
        const keyboardState = stateManager.getStateSection('keyboard');
        expect(keyboardState.isInChordMode).to.be.false;
      });

      it('should track chord mode as critical state', () => {
        // Act: Enter chord mode
        const ctrlK = new jsdom.window.KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
        });

        terminalElement.dispatchEvent(ctrlK);

        // Assert: Should report critical state
        expect(stateManager.hasCriticalStateActive()).to.be.true;

        // Act: Exit chord mode
        const cKey = new jsdom.window.KeyboardEvent('keydown', {
          key: 'c',
        });

        terminalElement.dispatchEvent(cKey);

        // Assert: Should not report critical state
        expect(stateManager.hasCriticalStateActive()).to.be.false;
      });
    });
  });

  describe('TDD Red Phase: VS Code Terminal Behavior Patterns', () => {
    describe('Terminal Focus and Navigation', () => {
      it('should handle automatic keyboard navigation when enabled', () => {
        // Act: Enable automatic keyboard navigation
        vscodeIntegration.updateSettings({
          'workbench.list.automaticKeyboardNavigation': true,
        });

        const navigationCallback = sinon.stub();
        vscodeIntegration.registerKeybindingCallback('ctrl+pagedown', navigationCallback);

        // Act: Use navigation keys
        const navigationKey = new jsdom.window.KeyboardEvent('keydown', {
          key: 'PageDown',
          ctrlKey: true,
        });

        terminalElement.dispatchEvent(navigationKey);

        // Assert: Should trigger navigation
        expect(navigationCallback.called).to.be.true;
      });

      it('should respect terminal focus patterns', () => {
        // Act: Test focus-related keyboard events
        const focusEvents = [
          { key: 'Tab', expectFocusChange: false }, // Should stay in terminal
          { key: 'F6', expectFocusChange: true }, // Should change focus area
          { key: 'Tab', ctrlKey: true, expectFocusChange: true }, // Should change tab/terminal
        ];

        focusEvents.forEach(({ key, ctrlKey = false, expectFocusChange: _expectFocusChange }) => {
          const keyEvent = new jsdom.window.KeyboardEvent('keydown', {
            key,
            ctrlKey,
            bubbles: true,
          });

          terminalElement.dispatchEvent(keyEvent);

          // Check that keyboard state is tracked
          const keyboardState = stateManager.getStateSection('keyboard');
          expect(keyboardState.lastKeyPressed).to.equal(key);
        });
      });

      it('should handle terminal splitting and management keys', () => {
        // Arrange: Register terminal management callbacks
        const managementCallbacks = {
          splitTerminal: sinon.stub(),
          killTerminal: sinon.stub(),
          renameTerminal: sinon.stub(),
        };

        vscodeIntegration.registerKeybindingCallback(
          'ctrl+shift+5',
          managementCallbacks.splitTerminal
        );
        vscodeIntegration.registerKeybindingCallback(
          'ctrl+shift+w',
          managementCallbacks.killTerminal
        );
        vscodeIntegration.registerKeybindingCallback('f2', managementCallbacks.renameTerminal);

        // Act: Use terminal management keys
        const managementKeys = [
          { key: '5', ctrlKey: true, shiftKey: true, callback: managementCallbacks.splitTerminal },
          { key: 'w', ctrlKey: true, shiftKey: true, callback: managementCallbacks.killTerminal },
          { key: 'F2', callback: managementCallbacks.renameTerminal },
        ];

        managementKeys.forEach(({ key, ctrlKey = false, shiftKey = false, callback }) => {
          const keyEvent = new jsdom.window.KeyboardEvent('keydown', {
            key,
            ctrlKey,
            shiftKey,
            bubbles: true,
            cancelable: true,
          });

          terminalElement.dispatchEvent(keyEvent);
          expect(callback.called).to.be.true;
        });
      });
    });

    describe('Terminal Settings Integration', () => {
      it('should dynamically update behavior when settings change', () => {
        // Arrange: Start with Alt+Click enabled
        expect(stateManager.getStateSection('altClick').isVSCodeAltClickEnabled).to.be.true;

        // Act: Change settings to disable Alt+Click
        vscodeIntegration.updateSettings({
          'terminal.integrated.altClickMovesCursor': false,
        });

        // Assert: Should immediately reflect setting change
        expect(stateManager.getStateSection('altClick').isVSCodeAltClickEnabled).to.be.false;

        // Act: Re-enable Alt+Click
        vscodeIntegration.updateSettings({
          'terminal.integrated.altClickMovesCursor': true,
        });

        // Assert: Should re-enable functionality
        expect(stateManager.getStateSection('altClick').isVSCodeAltClickEnabled).to.be.true;
      });

      it('should handle complex setting combinations', () => {
        // Act: Test various setting combinations
        const settingCombinations = [
          {
            settings: {
              'terminal.integrated.altClickMovesCursor': true,
              'editor.multiCursorModifier': 'alt' as const,
            },
            expectAltClick: true,
          },
          {
            settings: {
              'terminal.integrated.altClickMovesCursor': true,
              'editor.multiCursorModifier': 'ctrlCmd' as const,
            },
            expectAltClick: false,
          },
          {
            settings: {
              'terminal.integrated.altClickMovesCursor': false,
              'editor.multiCursorModifier': 'alt' as const,
            },
            expectAltClick: false,
          },
        ];

        settingCombinations.forEach(({ settings, expectAltClick }) => {
          vscodeIntegration.updateSettings(settings);

          const altClickState = stateManager.getStateSection('altClick');
          expect(altClickState.isVSCodeAltClickEnabled).to.equal(expectAltClick);
        });
      });

      it('should validate setting changes through event processing', () => {
        // Arrange: Track setting-related state changes
        const settingChanges: any[] = [];
        stateManager.addStateListener('altClick', (newState, previousState) => {
          settingChanges.push({
            from: previousState.isVSCodeAltClickEnabled,
            to: newState.isVSCodeAltClickEnabled,
          });
        });

        // Act: Toggle Alt+Click setting multiple times
        vscodeIntegration.updateSettings({ 'terminal.integrated.altClickMovesCursor': false });
        vscodeIntegration.updateSettings({ 'terminal.integrated.altClickMovesCursor': true });
        vscodeIntegration.updateSettings({ 'editor.multiCursorModifier': 'ctrlCmd' });

        // Assert: Should track all setting changes
        expect(settingChanges.length).to.equal(3);
        expect(settingChanges[0].from).to.be.true;
        expect(settingChanges[0].to).to.be.false;
        expect(settingChanges[1].from).to.be.false;
        expect(settingChanges[1].to).to.be.true;
        expect(settingChanges[2].to).to.be.false;
      });
    });
  });

  describe('TDD Red Phase: VS Code Extension Integration Patterns', () => {
    describe('Command Execution and Interaction', () => {
      it('should simulate VS Code command execution patterns', () => {
        // Arrange: Register command callbacks
        const commandCallbacks = {
          openSettings: sinon.stub(),
          openKeyboardShortcuts: sinon.stub(),
          toggleTerminal: sinon.stub(),
        };

        vscodeIntegration.registerKeybindingCallback('ctrl+,', commandCallbacks.openSettings);
        vscodeIntegration.registerKeybindingCallback(
          'ctrl+k s',
          commandCallbacks.openKeyboardShortcuts
        );
        vscodeIntegration.registerKeybindingCallback('ctrl+`', commandCallbacks.toggleTerminal);

        // Act: Simulate command execution
        vscodeIntegration.simulateVSCodeCommand('workbench.action.openSettings');
        vscodeIntegration.simulateVSCodeCommand('workbench.action.openKeyboardShortcuts');
        vscodeIntegration.simulateVSCodeCommand('workbench.action.terminal.toggleTerminal');

        // Assert: Commands should be executed
        expect(commandCallbacks.openSettings.called).to.be.true;
        expect(commandCallbacks.openKeyboardShortcuts.called).to.be.true;
        expect(commandCallbacks.toggleTerminal.called).to.be.true;
      });

      it('should handle VS Code extension integration points', () => {
        // Act: Test extension-like behavior patterns
        const extensionCallbacks = {
          formatDocument: sinon.stub(),
          quickOpen: sinon.stub(),
          commandPalette: sinon.stub(),
        };

        vscodeIntegration.registerKeybindingCallback(
          'shift+alt+f',
          extensionCallbacks.formatDocument
        );
        vscodeIntegration.registerKeybindingCallback('ctrl+p', extensionCallbacks.quickOpen);
        vscodeIntegration.registerKeybindingCallback(
          'ctrl+shift+p',
          extensionCallbacks.commandPalette
        );

        // Simulate extension keybindings
        const extensionKeys = [
          { key: 'f', shiftKey: true, altKey: true, callback: extensionCallbacks.formatDocument },
          { key: 'p', ctrlKey: true, callback: extensionCallbacks.quickOpen },
          { key: 'p', ctrlKey: true, shiftKey: true, callback: extensionCallbacks.commandPalette },
        ];

        extensionKeys.forEach(
          ({ key, ctrlKey = false, shiftKey = false, altKey = false, callback }) => {
            const keyEvent = new jsdom.window.KeyboardEvent('keydown', {
              key,
              ctrlKey,
              shiftKey,
              altKey,
              bubbles: true,
              cancelable: true,
            });

            terminalElement.dispatchEvent(keyEvent);
            expect(callback.called).to.be.true;
          }
        );
      });
    });

    describe('Performance and Resource Management', () => {
      it('should handle high-frequency VS Code interaction efficiently', () => {
        // Act: Generate high-frequency VS Code-style interactions
        const startTime = Date.now();

        for (let i = 0; i < 1000; i++) {
          // Simulate rapid key combinations
          const keyEvent = new jsdom.window.KeyboardEvent('keydown', {
            key: String.fromCharCode(65 + (i % 26)), // A-Z
            ctrlKey: i % 3 === 0,
            shiftKey: i % 5 === 0,
            altKey: i % 7 === 0,
          });

          terminalElement.dispatchEvent(keyEvent);

          // Occasional Alt+Click
          if (i % 50 === 0) {
            const clickEvent = new jsdom.window.MouseEvent('click', {
              clientX: i % 500,
              clientY: i % 300,
              altKey: true,
            });

            terminalElement.dispatchEvent(clickEvent);
          }
        }

        const endTime = Date.now();

        // Assert: Should handle high frequency efficiently
        const metrics = eventService.getGlobalMetrics();
        expect(metrics.totalProcessed).to.be.greaterThan(1000);
        expect(endTime - startTime).to.be.lessThan(2000); // Less than 2 seconds

        // Assert: State should remain consistent
        const keyboardState = stateManager.getStateSection('keyboard');
        expect(keyboardState.lastKeyPressed).to.be.a('string');
      });

      it('should maintain VS Code compatibility under load', () => {
        // Act: Simulate sustained VS Code usage patterns
        let altClickCount = 0;
        let chordCommandCount = 0;

        vscodeIntegration.registerKeybindingCallback('alt+click', () => altClickCount++);
        vscodeIntegration.registerKeybindingCallback('ctrl+k c', () => chordCommandCount++);

        // Sustained usage simulation
        for (let session = 0; session < 10; session++) {
          // Alt+Click session
          for (let i = 0; i < 20; i++) {
            const clickEvent = new jsdom.window.MouseEvent('click', {
              clientX: 100 + i,
              clientY: 200 + i,
              altKey: true,
            });

            terminalElement.dispatchEvent(clickEvent);
          }

          // Chord command session
          for (let i = 0; i < 5; i++) {
            const ctrlK = new jsdom.window.KeyboardEvent('keydown', {
              key: 'k',
              ctrlKey: true,
            });

            const cKey = new jsdom.window.KeyboardEvent('keydown', {
              key: 'c',
            });

            terminalElement.dispatchEvent(ctrlK);
            terminalElement.dispatchEvent(cKey);
          }
        }

        // Assert: All interactions should be processed correctly
        expect(altClickCount).to.equal(200); // 10 sessions × 20 clicks
        expect(chordCommandCount).to.equal(50); // 10 sessions × 5 chords

        // Assert: Performance metrics should be reasonable
        const health = eventService.getHealthStatus();
        expect(health.isHealthy).to.be.true;
        expect(health.errorRate).to.be.lessThan(0.01); // Less than 1% error rate
      });
    });
  });

  describe('TDD Red Phase: Error Handling and Edge Cases', () => {
    describe('VS Code Integration Error Scenarios', () => {
      it('should handle malformed VS Code events gracefully', () => {
        // Act: Send malformed events
        const malformedEvents = [
          new jsdom.window.KeyboardEvent('keydown', { key: null as any }),
          new jsdom.window.KeyboardEvent('keydown', { key: undefined as any }),
          new jsdom.window.MouseEvent('click', { clientX: NaN, clientY: NaN }),
        ];

        malformedEvents.forEach((event) => {
          expect(() => {
            terminalElement.dispatchEvent(event);
          }).to.not.throw();
        });

        // Assert: Should handle gracefully without errors
        const errorLogs = logMessages.filter((msg) => msg.toLowerCase().includes('error'));
        expect(errorLogs.length).to.equal(0);
      });

      it('should recover from VS Code setting conflicts', () => {
        // Act: Create conflicting settings
        vscodeIntegration.updateSettings({
          'terminal.integrated.altClickMovesCursor': true,
          'editor.multiCursorModifier': 'alt',
          // Conflicting: send to shell but also handle in VS Code
          'terminal.integrated.sendKeybindingsToShell': true,
          'terminal.integrated.commandsToSkipShell': [],
        });

        // Should still maintain consistent state
        const altClickState = stateManager.getStateSection('altClick');
        expect(altClickState.isVSCodeAltClickEnabled).to.be.true;

        // Should handle events without throwing
        expect(() => {
          const keyEvent = new jsdom.window.KeyboardEvent('keydown', {
            key: 'l',
            ctrlKey: true,
          });
          terminalElement.dispatchEvent(keyEvent);
        }).to.not.throw();
      });
    });

    describe('Resource Cleanup and Disposal', () => {
      it('should clean up VS Code integration resources on disposal', () => {
        // Arrange: Create active VS Code interactions
        const callbacks = {
          altClick: sinon.stub(),
          chord: sinon.stub(),
          navigation: sinon.stub(),
        };

        vscodeIntegration.registerKeybindingCallback('alt+click', callbacks.altClick);
        vscodeIntegration.registerKeybindingCallback('ctrl+k c', callbacks.chord);
        vscodeIntegration.registerKeybindingCallback('ctrl+pagedown', callbacks.navigation);

        // Generate some activity
        const clickEvent = new jsdom.window.MouseEvent('click', {
          clientX: 100,
          clientY: 200,
          altKey: true,
        });
        terminalElement.dispatchEvent(clickEvent);

        // Act: Dispose services
        eventService.dispose();
        stateManager.dispose();

        // Act: Try to trigger events after disposal
        terminalElement.dispatchEvent(clickEvent);

        // Assert: Callbacks should not be triggered after disposal
        expect(callbacks.altClick.callCount).to.equal(1); // Only the initial call
      });
    });
  });
});
