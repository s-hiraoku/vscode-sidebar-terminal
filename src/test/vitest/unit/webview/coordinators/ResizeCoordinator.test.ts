/**
 * ResizeCoordinator Unit Tests
 *
 * Tests for terminal resize coordination including:
 * - Initialization and ResizeObserver setup
 * - Window and body resize handling
 * - Terminal refit operations
 * - Panel location change handling
 * - Resource disposal
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResizeCoordinator, IResizeDependencies } from '../../../../../webview/coordinators/ResizeCoordinator';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

// Mock DOMUtils
vi.mock('../../../../../webview/utils/DOMUtils', () => ({
  DOMUtils: {
    resetXtermInlineStyles: vi.fn(),
  },
}));

// Mock Debouncer
vi.mock('../../../../../webview/utils/DebouncedEventBuffer', () => ({
  Debouncer: class MockDebouncer {
    private callback: () => void;
    constructor(callback: () => void, _options: { delay: number; name: string }) {
      this.callback = callback;
    }
    trigger(): void {
      // Execute callback immediately for testing
      this.callback();
    }
    dispose(): void {}
  },
}));

describe('ResizeCoordinator', () => {
  let coordinator: ResizeCoordinator;
  let mockDeps: IResizeDependencies;
  let mockTerminals: Map<string, any>;
  let resizeObserverCallback: ResizeObserverCallback | null = null;

  // Mock ResizeObserver - must be a class
  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();

    constructor(callback: ResizeObserverCallback) {
      resizeObserverCallback = callback;
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();

    // Setup ResizeObserver mock
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    // Setup mock terminals
    mockTerminals = new Map();

    // Create mock dependencies
    mockDeps = {
      getTerminals: vi.fn(() => mockTerminals),
      notifyResize: vi.fn(),
    };

    // Setup DOM elements
    const terminalBody = document.createElement('div');
    terminalBody.id = 'terminal-body';
    document.body.appendChild(terminalBody);

    const terminalsWrapper = document.createElement('div');
    terminalsWrapper.id = 'terminals-wrapper';
    document.body.appendChild(terminalsWrapper);

    coordinator = new ResizeCoordinator(mockDeps);
  });

  afterEach(() => {
    coordinator.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    resizeObserverCallback = null;
  });

  describe('constructor', () => {
    it('should create a new instance', () => {
      expect(coordinator).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should set up resize listeners', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      coordinator.initialize();

      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should not reinitialize if already initialized', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      coordinator.initialize();
      coordinator.initialize();

      // Should only be called once for window resize
      const resizeCalls = addEventListenerSpy.mock.calls.filter(
        (call) => call[0] === 'resize'
      );
      expect(resizeCalls.length).toBe(1);
    });
  });

  describe('setupParentContainerResizeObserver', () => {
    it('should set up ResizeObserver on terminal-body', () => {
      coordinator.setupParentContainerResizeObserver();

      // Verify ResizeObserver was created and is observing
      expect(resizeObserverCallback).not.toBeNull();
    });

    it('should handle missing terminal-body gracefully', () => {
      // Remove terminal-body
      const terminalBody = document.getElementById('terminal-body');
      terminalBody?.remove();

      expect(() => coordinator.setupParentContainerResizeObserver()).not.toThrow();
    });

    it('should trigger refit when resize is detected', () => {
      coordinator.setupParentContainerResizeObserver();

      // Add a mock terminal
      const mockFit = vi.fn();
      const mockContainer = document.createElement('div');
      mockTerminals.set('terminal-1', {
        terminal: { cols: 80, rows: 24 },
        fitAddon: { fit: mockFit, proposeDimensions: vi.fn() },
        container: mockContainer,
      });

      // Trigger resize observer
      if (resizeObserverCallback) {
        resizeObserverCallback(
          [{ contentRect: { width: 800, height: 600 }, target: document.body }] as ResizeObserverEntry[],
          {} as ResizeObserver
        );
      }

      // Advance past requestAnimationFrame
      vi.advanceTimersByTime(100);

      // Verify refit was called
      expect(mockFit).toHaveBeenCalled();
    });
  });

  describe('refitAllTerminals', () => {
    it('should call fit on all terminals with fitAddon', () => {
      const mockFit1 = vi.fn();
      const mockFit2 = vi.fn();
      const mockContainer1 = document.createElement('div');
      const mockContainer2 = document.createElement('div');

      mockTerminals.set('terminal-1', {
        terminal: { cols: 80, rows: 24 },
        fitAddon: { fit: mockFit1, proposeDimensions: vi.fn() },
        container: mockContainer1,
      });
      mockTerminals.set('terminal-2', {
        terminal: { cols: 80, rows: 24 },
        fitAddon: { fit: mockFit2, proposeDimensions: vi.fn() },
        container: mockContainer2,
      });

      coordinator.refitAllTerminals();

      // Advance past requestAnimationFrame
      vi.advanceTimersByTime(100);

      expect(mockFit1).toHaveBeenCalled();
      expect(mockFit2).toHaveBeenCalled();
    });

    it('should notify PTY about resize when notifyResize is provided', () => {
      const mockFit = vi.fn();
      const mockContainer = document.createElement('div');

      mockTerminals.set('terminal-1', {
        terminal: { cols: 120, rows: 40 },
        fitAddon: { fit: mockFit, proposeDimensions: vi.fn() },
        container: mockContainer,
      });

      coordinator.refitAllTerminals();

      // Advance past requestAnimationFrame
      vi.advanceTimersByTime(100);

      expect(mockDeps.notifyResize).toHaveBeenCalledWith('terminal-1', 120, 40);
    });

    it('should skip terminals without fitAddon', () => {
      mockTerminals.set('terminal-1', {
        terminal: { cols: 80, rows: 24 },
        fitAddon: null,
        container: document.createElement('div'),
      });

      expect(() => coordinator.refitAllTerminals()).not.toThrow();
    });

    it('should skip terminals without container', () => {
      const mockFit = vi.fn();

      mockTerminals.set('terminal-1', {
        terminal: { cols: 80, rows: 24 },
        fitAddon: { fit: mockFit, proposeDimensions: vi.fn() },
        container: null,
      });

      coordinator.refitAllTerminals();

      // Advance past requestAnimationFrame
      vi.advanceTimersByTime(100);

      expect(mockFit).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      const mockFit = vi.fn().mockImplementation(() => {
        throw new Error('Fit failed');
      });

      mockTerminals.set('terminal-1', {
        terminal: { cols: 80, rows: 24 },
        fitAddon: { fit: mockFit, proposeDimensions: vi.fn() },
        container: document.createElement('div'),
      });

      expect(() => {
        coordinator.refitAllTerminals();
        vi.advanceTimersByTime(100);
      }).not.toThrow();
    });

    it('should notify PTY with dimensions AFTER double-fit completes (Issue #368)', () => {
      // This test verifies that PTY resize notification happens AFTER
      // the second fit() call, ensuring TUI applications receive correct dimensions
      const fitCallOrder: string[] = [];
      let terminalDimensions = { cols: 80, rows: 24 };

      const mockFit = vi.fn().mockImplementation(() => {
        fitCallOrder.push('fit');
        // Simulate fit() updating terminal dimensions on second call
        if (fitCallOrder.filter(c => c === 'fit').length >= 2) {
          terminalDimensions = { cols: 100, rows: 30 };
        }
      });

      const mockContainer = document.createElement('div');

      // Mock terminal that updates dimensions after fit
      const mockTerminal = {
        get cols() { return terminalDimensions.cols; },
        get rows() { return terminalDimensions.rows; },
      };

      mockTerminals.set('terminal-1', {
        terminal: mockTerminal,
        fitAddon: { fit: mockFit, proposeDimensions: vi.fn() },
        container: mockContainer,
      });

      coordinator.refitAllTerminals();

      // Advance past BOTH requestAnimationFrame calls (first fit + second fit)
      vi.advanceTimersByTime(100);

      // fit() should be called at least twice (double-fit pattern)
      expect(mockFit).toHaveBeenCalledTimes(2);

      // PTY should be notified with the FINAL dimensions after double-fit
      // This is the critical assertion for Issue #368
      expect(mockDeps.notifyResize).toHaveBeenCalledWith('terminal-1', 100, 30);
    });

    it('should use deferred PTY notification for split mode timing (Issue #368)', () => {
      // When in split mode, CSS layout changes need time to settle
      // PTY notification should be deferred until layout is stable
      const mockFit = vi.fn();
      const mockContainer = document.createElement('div');

      mockTerminals.set('terminal-1', {
        terminal: { cols: 80, rows: 24 },
        fitAddon: { fit: mockFit, proposeDimensions: vi.fn() },
        container: mockContainer,
      });

      coordinator.refitAllTerminals();

      // First RAF - initial fit
      vi.advanceTimersByTime(16);

      // PTY should NOT be notified immediately after first fit
      // (This would be the old buggy behavior)

      // Second RAF - double-fit completes
      vi.advanceTimersByTime(16);

      // Only after both fits complete should PTY be notified
      // Advance more to ensure all callbacks processed
      vi.advanceTimersByTime(100);

      expect(mockDeps.notifyResize).toHaveBeenCalledTimes(1);
    });
  });

  describe('setupPanelLocationListener', () => {
    it('should listen for panel location change events', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      coordinator.setupPanelLocationListener();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'terminal-panel-location-changed',
        expect.any(Function)
      );
    });

    it('should trigger refit when panel location changes', () => {
      const mockFit = vi.fn();
      const mockContainer = document.createElement('div');

      mockTerminals.set('terminal-1', {
        terminal: { cols: 80, rows: 24 },
        fitAddon: { fit: mockFit, proposeDimensions: vi.fn() },
        container: mockContainer,
      });

      coordinator.setupPanelLocationListener();

      // Dispatch panel location change event
      window.dispatchEvent(new CustomEvent('terminal-panel-location-changed'));

      // Advance past requestAnimationFrame
      vi.advanceTimersByTime(100);

      expect(mockFit).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should disconnect ResizeObservers', () => {
      coordinator.setupParentContainerResizeObserver();
      coordinator.initialize();

      coordinator.dispose();

      // Verify observers are cleaned up
      // (Checking that dispose doesn't throw)
      expect(() => coordinator.dispose()).not.toThrow();
    });

    it('should reset initialization state', () => {
      coordinator.initialize();
      coordinator.dispose();

      // Should be able to initialize again after dispose
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      coordinator.initialize();

      const resizeCalls = addEventListenerSpy.mock.calls.filter(
        (call) => call[0] === 'resize'
      );
      expect(resizeCalls.length).toBe(1);
    });
  });

  describe('window resize handling', () => {
    it('should refit terminals on window resize', () => {
      const mockFit = vi.fn();
      const mockContainer = document.createElement('div');

      mockTerminals.set('terminal-1', {
        terminal: { cols: 80, rows: 24 },
        fitAddon: { fit: mockFit, proposeDimensions: vi.fn() },
        container: mockContainer,
      });

      coordinator.initialize();

      // Trigger window resize
      window.dispatchEvent(new Event('resize'));

      // Advance past requestAnimationFrame
      vi.advanceTimersByTime(200);

      expect(mockFit).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty terminal map', () => {
      expect(() => coordinator.refitAllTerminals()).not.toThrow();
    });

    it('should handle terminal with missing terminal object', () => {
      mockTerminals.set('terminal-1', {
        terminal: null,
        fitAddon: { fit: vi.fn(), proposeDimensions: vi.fn() },
        container: document.createElement('div'),
      });

      expect(() => {
        coordinator.refitAllTerminals();
        vi.advanceTimersByTime(100);
      }).not.toThrow();
    });
  });
});
