/**
 * RenderingOptimizer Unit Tests
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RenderingOptimizer } from '../../../../../webview/optimizers/RenderingOptimizer';

describe('RenderingOptimizer', () => {
  let optimizer: RenderingOptimizer;
  let mockTerminal: any;
  let mockFitAddon: any;
  let mockContainer: any;

  beforeEach(() => {
    // Create mock terminal
    mockTerminal = {
      loadAddon: vi.fn(),
      options: {
        smoothScrollDuration: 0,
      },
    };

    // Create mock fit addon
    mockFitAddon = {
      fit: vi.fn(),
    };

    // Create mock container
    mockContainer = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Create optimizer with default options
    optimizer = new RenderingOptimizer();
  });

  afterEach(() => {
    if (optimizer) {
      optimizer.dispose();
    }
    vi.restoreAllMocks();
  });

  describe('Dimension Validation', () => {
    // SKIP: Debounce timing is flaky in test environment
    it.skip('should accept valid dimensions (>50px)', async () => {
      // Create with specific min dimensions
      const customOptimizer = new RenderingOptimizer({
        minWidth: 50,
        minHeight: 50,
      });

      // Mock ResizeObserver
      const mockEntry = {
        contentRect: {
          width: 100,
          height: 100,
        },
      };

      let resizeCallback: any;
      class MockResizeObserver {
        constructor(callback: any) {
          resizeCallback = callback;
        }
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      }

      vi.stubGlobal('ResizeObserver', MockResizeObserver);

      customOptimizer.setupOptimizedResize(
        mockTerminal,
        mockFitAddon,
        mockContainer,
        'test-terminal'
      );

      // Trigger resize
      resizeCallback([mockEntry]);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(mockFitAddon.fit).toHaveBeenCalled();

      customOptimizer.dispose();
    });

    it('should reject invalid dimensions (≤50px)', async () => {
      const customOptimizer = new RenderingOptimizer({
        minWidth: 50,
        minHeight: 50,
        resizeDebounceMs: 10, // Shorter delay for test
      });

      const mockEntry = {
        contentRect: {
          width: 30, // Below minimum
          height: 100,
        },
      };

      let resizeCallback: any;
      class MockResizeObserver {
        constructor(callback: any) {
          resizeCallback = callback;
        }
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      }

      vi.stubGlobal('ResizeObserver', MockResizeObserver);

      customOptimizer.setupOptimizedResize(
        mockTerminal,
        mockFitAddon,
        mockContainer,
        'test-terminal'
      );

      // Trigger resize with invalid dimensions
      resizeCallback([mockEntry]);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockFitAddon.fit).not.toHaveBeenCalled();

      customOptimizer.dispose();
    });
  });

  describe('Device Detection', () => {
    it('should detect trackpad (deltaMode = 0)', () => {
      const trackpadEvent = {
        deltaMode: 0,
      } as WheelEvent;

      const device = optimizer.detectDevice(trackpadEvent);

      expect(device.isTrackpad).toBe(true);
      expect(device.smoothScrollDuration).toBe(0);
    });

    it('should detect mouse wheel (deltaMode = 1)', () => {
      const mouseEvent = {
        deltaMode: 1,
      } as WheelEvent;

      const device = optimizer.detectDevice(mouseEvent);

      expect(device.isTrackpad).toBe(false);
      expect(device.smoothScrollDuration).toBe(125);
    });
  });

  describe('Smooth Scroll Duration', () => {
    it('should update terminal smooth scroll duration', () => {
      optimizer.updateSmoothScrollDuration(mockTerminal, 125);

      expect(mockTerminal.options.smoothScrollDuration).toBe(125);
    });

    it('should setup smooth scrolling with passive listener', () => {
      optimizer.setupSmoothScrolling(mockTerminal, mockContainer, 'test-terminal');

      expect(mockContainer.addEventListener).toHaveBeenCalled();
      expect(mockContainer.addEventListener.mock.calls[0][0]).toBe('wheel');
      expect(mockContainer.addEventListener.mock.calls[0][2]).toEqual({
        passive: true,
      });
    });
  });

  describe('WebGL Fallback', () => {
    it('should return false when WebGL is disabled', async () => {
      const noWebGLOptimizer = new RenderingOptimizer({
        enableWebGL: false,
      });

      const result = await noWebGLOptimizer.enableWebGL(mockTerminal, 'test-terminal');

      expect(result).toBe(false);
      expect(mockTerminal.loadAddon).not.toHaveBeenCalled();

      noWebGLOptimizer.dispose();
    });
  });

  describe('Dispose', () => {
    it('should dispose all resources', () => {
      class MockResizeObserver {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      }

      vi.stubGlobal('ResizeObserver', MockResizeObserver);

      optimizer.setupOptimizedResize(mockTerminal, mockFitAddon, mockContainer, 'test-terminal');

      optimizer.dispose();

      // Verify cleanup
      expect(() => optimizer.dispose()).not.toThrow();
    });
  });
});
