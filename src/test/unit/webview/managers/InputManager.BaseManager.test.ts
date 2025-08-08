/**
 * InputManager BaseManager Integration Tests - Enhanced test suite using CommonTestHelpers
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { Terminal } from 'xterm';
import { InputManager } from '../../../../webview/managers/InputManager';
import { 
  createMockCoordinator, 
  setupManagerTest, 
  cleanupManagerTest, 
  TestPatterns,
  DOMTestUtils,
  AsyncTestUtils,
  PerformanceTestUtils
} from '../../../../webview/utils/CommonTestHelpers';

describe('InputManager BaseManager Integration', () => {
  let testSetup: ReturnType<typeof setupManagerTest<InputManager>>;

  beforeEach(() => {
    // Setup DOM environment for input tests
    DOMTestUtils.setupDOM();
    
    // Setup manager with BaseManager functionality
    testSetup = setupManagerTest(InputManager);
  });

  afterEach(() => {
    cleanupManagerTest(testSetup);
    DOMTestUtils.cleanupDOM();
  });

  describe('BaseManager Inheritance', () => {
    it('should properly initialize with BaseManager functionality', () => {
      const { manager } = testSetup;
      
      // Test BaseManager initialization
      TestPatterns.testManagerInitialization(manager, testSetup.coordinator);
      
      // InputManager should have BaseManager methods
      expect(manager).to.have.property('getStatus');
      expect(manager).to.have.property('log');
      expect(manager).to.have.property('dispose');
    });

    it('should use BaseManager logging for all operations', () => {
      const { manager } = testSetup;
      
      // Stub the BaseManager log method
      const logSpy = sinon.spy(manager, 'log');
      
      // Call operations that should use this.log()
      manager.setupIMEHandling();
      manager.setupAltKeyVisualFeedback();
      
      // Verify BaseManager log was called multiple times
      expect(logSpy.callCount).to.be.greaterThan(1);
      expect(logSpy.calledWith(sinon.match('[INPUT] Setting up IME'))).to.be.true;
      expect(logSpy.calledWith(sinon.match('[INPUT] Setting up Alt key'))).to.be.true;
    });

    it('should properly dispose with BaseManager cleanup', () => {
      const { manager } = testSetup;
      
      // Setup some event listeners first
      manager.setupIMEHandling();
      manager.setupAltKeyVisualFeedback();
      
      // Test manager disposal
      TestPatterns.testManagerDisposal(manager);
    });

    it('should handle input errors with BaseManager error recovery', () => {
      const { manager, coordinator } = testSetup;
      
      // Test error handling in terminal interaction
      TestPatterns.testErrorHandling(
        manager,
        () => {
          // Force an error condition by passing invalid data
          (manager as any).emitTerminalInteractionEvent(
            'invalid-type' as any,
            'invalid-terminal',
            null,
            coordinator
          );
        }
      );
    });
  });

  describe('Enhanced Input Handling', () => {
    it('should handle IME composition with BaseManager logging', () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Setup IME handling
      manager.setupIMEHandling();
      
      // Simulate composition events
      const compositionStart = new CompositionEvent('compositionstart', { data: 'test' });
      const compositionEnd = new CompositionEvent('compositionend', { data: 'test' });
      
      document.dispatchEvent(compositionStart);
      expect(manager.isIMEComposing()).to.be.true;
      
      document.dispatchEvent(compositionEnd);
      
      // Wait for composition end delay
      setTimeout(() => {
        expect(manager.isIMEComposing()).to.be.false;
        expect(logSpy.calledWith(sinon.match('IME composition'))).to.be.true;
      }, 20);
    });

    it('should handle Alt+Click with proper validation and logging', () => {
      const { manager, coordinator } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Setup Alt+Click handling
      manager.setupAltKeyVisualFeedback();
      
      // Test Alt+Click settings validation
      const settings = {
        altClickMovesCursor: true,
        multiCursorModifier: 'alt' as const
      };
      
      const isEnabled = manager.isVSCodeAltClickEnabled(settings);
      expect(isEnabled).to.be.true;
      expect(logSpy.calledWith(sinon.match('VS Code Alt+Click enabled: true'))).to.be.true;
      
      // Test settings update
      manager.updateAltClickSettings(settings);
      const state = manager.getAltClickState();
      expect(state.isVSCodeAltClickEnabled).to.be.true;
    });

    it('should handle keyboard shortcuts with coordinator integration', () => {
      const { manager, coordinator } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Setup keyboard shortcuts
      manager.setupKeyboardShortcuts(coordinator);
      
      // Simulate Ctrl+Tab shortcut
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        ctrlKey: true
      });
      
      document.dispatchEvent(keyEvent);
      
      // Should log the shortcut detection
      expect(logSpy.calledWith(sinon.match('Ctrl+Tab shortcut detected'))).to.be.true;
      
      // Should call coordinator methods
      expect(coordinator.getActiveTerminalId.called).to.be.true;
    });

    it('should manage agent interaction mode correctly', () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Test agent interaction mode (should always be disabled for VS Code standard)
      manager.setAgentInteractionMode(true);
      expect(manager.isAgentInteractionMode()).to.be.false;
      
      // Should log the VS Code standard behavior
      expect(logSpy.calledWith(sinon.match('always disabled'))).to.be.true;
    });
  });

  describe('Performance Optimization', () => {
    it('should debounce terminal interaction events', () => {
      const { manager, coordinator } = testSetup;
      
      // Test event debouncing
      TestPatterns.testPerformancePattern(
        () => {
          // Emit multiple focus events rapidly
          (manager as any).emitTerminalInteractionEvent(
            'focus',
            'test-terminal',
            undefined,
            coordinator
          );
        },
        5, // Emit 5 times
        1, // Should be debounced to 1 call
        coordinator.postMessageToExtension
      );
    });

    it('should handle high-frequency input events efficiently', async () => {
      const { manager, coordinator } = testSetup;
      
      // Performance test for rapid input handling
      const { duration } = PerformanceTestUtils.measureTime(() => {
        for (let i = 0; i < 100; i++) {
          const mockEvent = new KeyboardEvent('keydown', { key: 'a' });
          manager.handleSpecialKeys(mockEvent, 'test-terminal', coordinator);
        }
      });
      
      // Should handle 100 events quickly (< 50ms)
      expect(duration).to.be.lessThan(50);
    });

    it('should clear pending input events during IME composition', () => {
      const { manager } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Setup IME handling
      manager.setupIMEHandling();
      
      // Add some pending events (simulated)
      (manager as any).eventDebounceTimers.set('input-test', setTimeout(() => {}, 100));
      
      // Trigger composition start
      const compositionStart = new CompositionEvent('compositionstart');
      document.dispatchEvent(compositionStart);
      
      // Should clear pending input events
      expect(logSpy.calledWith(sinon.match('Cleared pending input event'))).to.be.true;
    });
  });

  describe('Terminal Integration', () => {
    it('should add click handlers to terminals properly', () => {
      const { manager, coordinator } = testSetup;
      
      // Create mock terminal and container
      const mockTerminal = {} as Terminal;
      const container = DOMTestUtils.createMockTerminal('test-terminal');
      const logSpy = sinon.spy(manager, 'log');
      
      // Add click handler
      manager.addXtermClickHandler(mockTerminal, 'test-terminal', container, coordinator);
      
      // Should log the handler addition
      expect(logSpy.calledWith(sinon.match('Adding click handler'))).to.be.true;
      
      // Simulate regular click
      const clickEvent = new MouseEvent('click', { altKey: false });
      container.dispatchEvent(clickEvent);
      
      // Should call coordinator methods
      expect(coordinator.setActiveTerminalId.calledWith('test-terminal')).to.be.true;
    });

    it('should handle special key combinations correctly', () => {
      const { manager, coordinator } = testSetup;
      const logSpy = sinon.spy(manager, 'log');
      
      // Mock terminal with selection
      const mockTerminal = {
        terminal: {
          hasSelection: sinon.stub().returns(false)
        }
      };
      coordinator.getTerminalInstance.returns(mockTerminal as any);
      
      // Test Ctrl+C interrupt
      const ctrlCEvent = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true
      });
      
      const handled = manager.handleSpecialKeys(ctrlCEvent, 'test-terminal', coordinator);
      expect(handled).to.be.true;
      expect(logSpy.calledWith(sinon.match('Ctrl+C interrupt'))).to.be.true;
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should properly manage event listeners without memory leaks', () => {
      const { manager } = testSetup;
      
      // Test memory usage patterns
      PerformanceTestUtils.testMemoryUsage(() => {
        const tempManager = new InputManager();
        tempManager.setupIMEHandling();
        tempManager.setupAltKeyVisualFeedback();
        return tempManager;
      }, 20);
      
      // Original manager should still be functional
      expect(manager.getAltClickState()).to.be.an('object');
    });

    it('should dispose all event listeners properly', () => {
      const { manager } = testSetup;
      
      // Setup various event listeners
      manager.setupIMEHandling();
      manager.setupAltKeyVisualFeedback();
      manager.setupKeyboardShortcuts(testSetup.coordinator);
      
      // Spy on removeEventListener to verify cleanup
      const removeEventListenerSpy = sinon.spy(document, 'removeEventListener');
      
      // Dispose
      manager.dispose();
      
      // Should remove multiple event listeners
      expect(removeEventListenerSpy.callCount).to.be.greaterThan(0);
      
      // State should be reset
      expect(manager.isIMEComposing()).to.be.false;
      expect(manager.isAgentInteractionMode()).to.be.false;
      
      removeEventListenerSpy.restore();
    });
  });

  describe('Integration with NotificationManager', () => {
    it('should integrate with notification manager for Alt+Click feedback', () => {
      const { manager } = testSetup;
      
      // Create mock notification manager
      const mockNotificationManager = {
        showAltClickFeedback: sinon.stub()
      };
      
      manager.setNotificationManager(mockNotificationManager as any);
      
      // Setup Alt+Click
      manager.updateAltClickSettings({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt'
      });
      
      // Create container and simulate Alt+Click
      const container = DOMTestUtils.createMockTerminal('test-terminal');
      manager.addXtermClickHandler({} as Terminal, 'test-terminal', container, testSetup.coordinator);
      
      const altClickEvent = new MouseEvent('click', {
        altKey: true,
        clientX: 100,
        clientY: 200
      });
      
      container.dispatchEvent(altClickEvent);
      
      // Should call notification manager
      expect(mockNotificationManager.showAltClickFeedback.calledWith(100, 200)).to.be.true;
    });
  });
});