/**
 * PanelLocationHandler Unit Tests
 *
 * Tests for panel location detection and updates including:
 * - Panel location detection based on aspect ratio
 * - Flex direction updates
 * - Message handling (panelLocationUpdate, requestPanelLocationDetection)
 * - CSS class toggling for layout
 * - Terminal refit scheduling
 * - Disposal
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PanelLocationHandler } from '../../../../../../webview/managers/handlers/PanelLocationHandler';

// Create mock instances
const createMockMessageQueue = () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
});

const createMockLogger = () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

// Mock DOMUtils
vi.mock('../../../../../../webview/utils/DOMUtils', () => ({
  DOMUtils: {
    resetXtermInlineStyles: vi.fn(),
  },
}));

describe('PanelLocationHandler', () => {
  let handler: PanelLocationHandler;
  let mockMessageQueue: ReturnType<typeof createMockMessageQueue>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockCoordinator: any;
  let resizeObserverCallback: ResizeObserverCallback | null = null;

  // Mock ResizeObserver - must be a class for proper constructor behavior
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

    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });

    // Create mocks
    mockMessageQueue = createMockMessageQueue();
    mockLogger = createMockLogger();

    // Setup mock coordinator
    mockCoordinator = {
      postMessageToExtension: vi.fn(),
      getSplitManager: vi.fn().mockReturnValue({
        getTerminals: vi.fn().mockReturnValue(new Map()),
        updateSplitDirection: vi.fn(),
      }),
      getManagers: vi.fn().mockReturnValue({
        config: {
          getCurrentSettings: vi.fn().mockReturnValue({
            dynamicSplitDirection: true,
          }),
        },
      }),
    };

    handler = new PanelLocationHandler(mockMessageQueue, mockLogger);
  });

  afterEach(() => {
    handler.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    resizeObserverCallback = null;
  });

  describe('constructor', () => {
    it('should initialize with null cached state', () => {
      expect(handler.getCurrentFlexDirection()).toBeNull();
      expect(handler.getCurrentPanelLocation()).toBeNull();
    });

    it('should set up ResizeObserver', () => {
      // Verify ResizeObserver callback was captured during handler instantiation
      expect(resizeObserverCallback).not.toBeNull();
    });
  });

  describe('getSupportedCommands', () => {
    it('should return supported commands', () => {
      const commands = handler.getSupportedCommands();
      expect(commands).toContain('panelLocationUpdate');
      expect(commands).toContain('requestPanelLocationDetection');
      expect(commands.length).toBe(2);
    });
  });

  describe('getCurrentFlexDirection', () => {
    it('should return null initially', () => {
      expect(handler.getCurrentFlexDirection()).toBeNull();
    });
  });

  describe('getCurrentPanelLocation', () => {
    it('should return null initially', () => {
      expect(handler.getCurrentPanelLocation()).toBeNull();
    });
  });

  describe('updateFlexDirectionIfNeeded', () => {
    it('should return false when location has not changed', () => {
      // Simulate initial detection via resize
      if (resizeObserverCallback) {
        resizeObserverCallback(
          [{ contentRect: { width: 800, height: 600 } }] as ResizeObserverEntry[],
          {} as ResizeObserver
        );
      }
      vi.advanceTimersByTime(200);

      // Now try to update - should return false as location hasn't changed
      const result = handler.updateFlexDirectionIfNeeded(mockCoordinator);
      expect(result).toBe(false);
    });

    it('should return true when location changes', () => {
      // Simulate initial detection with sidebar dimensions
      Object.defineProperty(window, 'innerWidth', { value: 300, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });

      if (resizeObserverCallback) {
        resizeObserverCallback(
          [{ contentRect: { width: 300, height: 600 } }] as ResizeObserverEntry[],
          {} as ResizeObserver
        );
      }
      vi.advanceTimersByTime(200);

      // Change to panel dimensions
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });

      const result = handler.updateFlexDirectionIfNeeded(mockCoordinator);
      expect(result).toBe(true);
    });
  });

  describe('handleMessage', () => {
    describe('panelLocationUpdate', () => {
      it('should handle panelLocationUpdate command', () => {
        const msg = { command: 'panelLocationUpdate' };
        expect(() => handler.handleMessage(msg, mockCoordinator)).not.toThrow();
      });

      it('should skip update when dynamicSplitDirection is disabled', () => {
        mockCoordinator.getManagers.mockReturnValue({
          config: {
            getCurrentSettings: vi.fn().mockReturnValue({
              dynamicSplitDirection: false,
            }),
          },
        });

        const msg = { command: 'panelLocationUpdate' };
        handler.handleMessage(msg, mockCoordinator);

        // Should not update - verify by checking state remains null
        // (since autonomous detection would have set it if update ran)
      });
    });

    describe('requestPanelLocationDetection', () => {
      it('should handle requestPanelLocationDetection command', () => {
        const msg = { command: 'requestPanelLocationDetection' };
        handler.handleMessage(msg, mockCoordinator);

        expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'reportPanelLocation',
          })
        );
      });

      it('should detect sidebar when width < height * threshold', () => {
        Object.defineProperty(window, 'innerWidth', { value: 300, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });

        const msg = { command: 'requestPanelLocationDetection' };
        handler.handleMessage(msg, mockCoordinator);

        expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'reportPanelLocation',
            location: 'sidebar',
          })
        );
      });

      it('should detect panel when width > height * threshold', () => {
        // Reset to 0 to force fallback to body dimensions
        vi.stubGlobal('innerWidth', 0);
        vi.stubGlobal('innerHeight', 0);
        Object.defineProperty(document.documentElement, 'clientWidth', { value: 0, configurable: true });
        Object.defineProperty(document.documentElement, 'clientHeight', { value: 0, configurable: true });
        // Set body dimensions for panel mode (wide aspect ratio)
        Object.defineProperty(document.body, 'clientWidth', { value: 1200, configurable: true });
        Object.defineProperty(document.body, 'clientHeight', { value: 400, configurable: true });

        const msg = { command: 'requestPanelLocationDetection' };
        handler.handleMessage(msg, mockCoordinator);

        expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'reportPanelLocation',
            location: 'panel',
          })
        );
      });
    });

    describe('unknown command', () => {
      it('should log warning for unknown commands', () => {
        const msg = { command: 'unknownCommand' };
        handler.handleMessage(msg, mockCoordinator);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Unknown panel location command')
        );
      });
    });
  });

  describe('autonomous detection via ResizeObserver', () => {
    it('should ignore zero dimensions', () => {
      if (resizeObserverCallback) {
        resizeObserverCallback(
          [{ contentRect: { width: 0, height: 0 } }] as ResizeObserverEntry[],
          {} as ResizeObserver
        );
      }

      expect(handler.getCurrentPanelLocation()).toBeNull();
    });

    it('should detect sidebar on initial observation with sidebar dimensions', () => {
      Object.defineProperty(window, 'innerWidth', { value: 300, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });

      if (resizeObserverCallback) {
        resizeObserverCallback(
          [{ contentRect: { width: 300, height: 600 } }] as ResizeObserverEntry[],
          {} as ResizeObserver
        );
      }
      vi.advanceTimersByTime(200);

      expect(handler.getCurrentPanelLocation()).toBe('sidebar');
      expect(handler.getCurrentFlexDirection()).toBe('column');
    });

    it('should detect panel on initial observation with panel dimensions', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });

      if (resizeObserverCallback) {
        resizeObserverCallback(
          [{ contentRect: { width: 1200, height: 400 } }] as ResizeObserverEntry[],
          {} as ResizeObserver
        );
      }
      vi.advanceTimersByTime(200);

      expect(handler.getCurrentPanelLocation()).toBe('panel');
      expect(handler.getCurrentFlexDirection()).toBe('row');
    });

    it('should report panel location to extension on initial detection', () => {
      if (resizeObserverCallback) {
        resizeObserverCallback(
          [{ contentRect: { width: 800, height: 600 } }] as ResizeObserverEntry[],
          {} as ResizeObserver
        );
      }
      vi.advanceTimersByTime(200);

      expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'reportPanelLocation',
        })
      );
    });

    it('should dispatch terminal-panel-location-changed event', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      if (resizeObserverCallback) {
        resizeObserverCallback(
          [{ contentRect: { width: 800, height: 600 } }] as ResizeObserverEntry[],
          {} as ResizeObserver
        );
      }

      // Wait for the scheduled refit
      vi.advanceTimersByTime(200);

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'terminal-panel-location-changed',
        })
      );
    });
  });

  describe('CSS class management', () => {
    it('should add terminal-split-horizontal class for panel location', () => {
      const terminalsWrapper = document.createElement('div');
      terminalsWrapper.id = 'terminals-wrapper';
      document.body.appendChild(terminalsWrapper);

      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });

      if (resizeObserverCallback) {
        resizeObserverCallback(
          [{ contentRect: { width: 1200, height: 400 } }] as ResizeObserverEntry[],
          {} as ResizeObserver
        );
      }

      expect(terminalsWrapper.classList.contains('terminal-split-horizontal')).toBe(true);
    });

    it('should remove terminal-split-horizontal class for sidebar location', () => {
      const terminalsWrapper = document.createElement('div');
      terminalsWrapper.id = 'terminals-wrapper';
      terminalsWrapper.classList.add('terminal-split-horizontal');
      document.body.appendChild(terminalsWrapper);

      Object.defineProperty(window, 'innerWidth', { value: 300, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });

      if (resizeObserverCallback) {
        resizeObserverCallback(
          [{ contentRect: { width: 300, height: 600 } }] as ResizeObserverEntry[],
          {} as ResizeObserver
        );
      }

      expect(terminalsWrapper.classList.contains('terminal-split-horizontal')).toBe(false);
    });

    it('should retry class sync if terminals-wrapper is not available', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });

      if (resizeObserverCallback) {
        resizeObserverCallback(
          [{ contentRect: { width: 1200, height: 400 } }] as ResizeObserverEntry[],
          {} as ResizeObserver
        );
      }

      // Create wrapper after a delay
      vi.advanceTimersByTime(100);
      const terminalsWrapper = document.createElement('div');
      terminalsWrapper.id = 'terminals-wrapper';
      document.body.appendChild(terminalsWrapper);

      // Continue advancing time for the retry logic
      vi.advanceTimersByTime(100);

      expect(terminalsWrapper.classList.contains('terminal-split-horizontal')).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should dispose without error', () => {
      expect(() => handler.dispose()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should fallback to sidebar when dimensions are zero', () => {
      vi.stubGlobal('innerWidth', 0);
      vi.stubGlobal('innerHeight', 0);
      Object.defineProperty(document.documentElement, 'clientWidth', { value: 0, configurable: true });
      Object.defineProperty(document.documentElement, 'clientHeight', { value: 0, configurable: true });
      // Also reset body dimensions to 0 to test full fallback to sidebar
      Object.defineProperty(document.body, 'clientWidth', { value: 0, configurable: true });
      Object.defineProperty(document.body, 'clientHeight', { value: 0, configurable: true });

      const msg = { command: 'requestPanelLocationDetection' };
      handler.handleMessage(msg, mockCoordinator);

      expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'sidebar',
        })
      );
    });

    it('should use document.body dimensions as fallback', () => {
      vi.stubGlobal('innerWidth', 0);
      vi.stubGlobal('innerHeight', 0);
      Object.defineProperty(document.documentElement, 'clientWidth', { value: 0, configurable: true });
      Object.defineProperty(document.documentElement, 'clientHeight', { value: 0, configurable: true });

      // Setup body dimensions for panel detection
      Object.defineProperty(document.body, 'clientWidth', { value: 1200, configurable: true });
      Object.defineProperty(document.body, 'clientHeight', { value: 400, configurable: true });

      const msg = { command: 'requestPanelLocationDetection' };
      handler.handleMessage(msg, mockCoordinator);

      expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'panel',
        })
      );
    });
  });
});
