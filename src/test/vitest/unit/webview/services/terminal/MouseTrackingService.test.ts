/**
 * MouseTrackingService Unit Tests
 *
 * Tests mouse tracking detection and scroll behavior toggling
 * for terminal apps like zellij, vim, tmux that use mouse modes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MouseTrackingService, SendInputCallback } from '../../../../../../webview/services/terminal/MouseTrackingService';

// Mock logger
vi.mock('../../../../../../webview/utils/ManagerLogger', () => ({
  terminalLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

/**
 * Create a mock Terminal with parser.registerCsiHandler
 */
function createMockTerminal() {
  const handlers: Map<string, (params: number[]) => boolean> = new Map();

  // Create mock screen element
  const screenElement = document.createElement('div');
  screenElement.className = 'xterm-screen';

  // Create mock terminal element containing screen
  const terminalElement = document.createElement('div');
  terminalElement.className = 'terminal xterm';
  terminalElement.appendChild(screenElement);

  // Mock dimensions (JSDOM doesn't render, so clientWidth/Height are 0)
  Object.defineProperty(terminalElement, 'clientWidth', { value: 720, configurable: true });
  Object.defineProperty(terminalElement, 'clientHeight', { value: 408, configurable: true });

  // Mock getBoundingClientRect for screen element
  screenElement.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 720,
    bottom: 408,
    width: 720,
    height: 408,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

  // Create a mock element object with explicit dimensions
  // (JSDOM element properties may not work reliably)
  const mockElement = {
    clientWidth: 720,
    clientHeight: 408,
    querySelector: (selector: string) => selector === '.xterm-screen' ? screenElement : null,
    appendChild: terminalElement.appendChild.bind(terminalElement),
  };

  return {
    element: mockElement as unknown as HTMLElement,
    cols: 80,
    rows: 24,
    parser: {
      registerCsiHandler: vi.fn((identifier: { prefix?: string; final: string }, handler: (params: number[]) => boolean) => {
        // Store with prefix for proper identification
        const key = `${identifier.prefix || ''}${identifier.final}`;
        handlers.set(key, handler);
        return {
          dispose: vi.fn(),
        };
      }),
    },
    // Helper to simulate CSI sequences (private mode with ? prefix)
    _simulateCsi: (final: string, params: number[]) => {
      const handler = handlers.get(`?${final}`);
      if (handler) {
        handler(params);
      }
    },
  };
}

describe('MouseTrackingService', () => {
  let service: MouseTrackingService;
  let mockTerminal: ReturnType<typeof createMockTerminal>;
  let viewport: HTMLDivElement;
  let mockSendInput: SendInputCallback;

  beforeEach(() => {
    service = new MouseTrackingService();
    mockTerminal = createMockTerminal();
    viewport = document.createElement('div');
    viewport.className = 'xterm-viewport';
    viewport.style.overflow = 'auto'; // Initial state from TerminalScrollbarService
    mockSendInput = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.dispose();
  });

  describe('setup', () => {
    it('should register CSI handlers for DECSET and DECRST', () => {
      service.setup(mockTerminal as any, 't1', viewport, mockSendInput);

      // Should register handlers for '?h' (DECSET) and '?l' (DECRST)
      expect(mockTerminal.parser.registerCsiHandler).toHaveBeenCalledTimes(2);
      expect(mockTerminal.parser.registerCsiHandler).toHaveBeenCalledWith(
        { prefix: '?', final: 'h' },
        expect.any(Function)
      );
      expect(mockTerminal.parser.registerCsiHandler).toHaveBeenCalledWith(
        { prefix: '?', final: 'l' },
        expect.any(Function)
      );
    });

    it('should warn if setup called twice for same terminal', async () => {
      const { terminalLogger } = vi.mocked(await import('../../../../../../webview/utils/ManagerLogger'));

      service.setup(mockTerminal as any, 't1', viewport, mockSendInput);
      service.setup(mockTerminal as any, 't1', viewport, mockSendInput);

      expect(terminalLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Already setup for terminal: t1')
      );
    });
  });

  describe('mouse tracking mode detection', () => {
    beforeEach(() => {
      service.setup(mockTerminal as any, 't1', viewport, mockSendInput);
    });

    it('should disable native scroll when mouse mode 1000 enabled (DECSET)', () => {
      expect(viewport.style.overflow).toBe('auto');

      // Simulate CSI ? 1000 h (X10 mouse reporting)
      mockTerminal._simulateCsi('h', [1000]);

      expect(viewport.style.overflow).toBe('hidden');
      expect(service.isMouseTrackingActive('t1')).toBe(true);
    });

    it('should disable native scroll when mouse mode 1002 enabled', () => {
      mockTerminal._simulateCsi('h', [1002]);

      expect(viewport.style.overflow).toBe('hidden');
      expect(service.getActiveModes('t1')).toContain(1002);
    });

    it('should disable native scroll when mouse mode 1003 enabled', () => {
      mockTerminal._simulateCsi('h', [1003]);

      expect(viewport.style.overflow).toBe('hidden');
      expect(service.getActiveModes('t1')).toContain(1003);
    });

    it('should disable native scroll when mouse mode 1006 enabled (SGR)', () => {
      mockTerminal._simulateCsi('h', [1006]);

      expect(viewport.style.overflow).toBe('hidden');
      expect(service.getActiveModes('t1')).toContain(1006);
    });

    it('should restore native scroll when mouse mode disabled (DECRST)', () => {
      // Enable mouse mode
      mockTerminal._simulateCsi('h', [1000]);
      expect(viewport.style.overflow).toBe('hidden');

      // Disable mouse mode
      mockTerminal._simulateCsi('l', [1000]);

      expect(viewport.style.overflow).toBe('auto');
      expect(service.isMouseTrackingActive('t1')).toBe(false);
    });

    it('should handle multiple mouse modes simultaneously', () => {
      // Apps like zellij enable multiple modes at once
      mockTerminal._simulateCsi('h', [1000]);
      mockTerminal._simulateCsi('h', [1002]);
      mockTerminal._simulateCsi('h', [1006]);

      expect(viewport.style.overflow).toBe('hidden');
      expect(service.getActiveModes('t1')).toEqual(expect.arrayContaining([1000, 1002, 1006]));

      // Disable one mode - should still be hidden
      mockTerminal._simulateCsi('l', [1000]);
      expect(viewport.style.overflow).toBe('hidden');
      expect(service.isMouseTrackingActive('t1')).toBe(true);

      // Disable remaining modes
      mockTerminal._simulateCsi('l', [1002]);
      mockTerminal._simulateCsi('l', [1006]);

      expect(viewport.style.overflow).toBe('auto');
      expect(service.isMouseTrackingActive('t1')).toBe(false);
    });

    it('should ignore non-mouse-tracking modes', () => {
      // Mode 25 is cursor visibility, not mouse tracking
      mockTerminal._simulateCsi('h', [25]);

      expect(viewport.style.overflow).toBe('auto');
      expect(service.isMouseTrackingActive('t1')).toBe(false);
    });
  });

  describe('wheel event handling', () => {
    beforeEach(() => {
      service.setup(mockTerminal as any, 't1', viewport, mockSendInput);
      // Enable mouse mode to activate wheel handler
      mockTerminal._simulateCsi('h', [1006]);
    });

    it('should send SGR escape sequence on wheel down', () => {
      const screenElement = mockTerminal.element.querySelector('.xterm-screen')!;

      // Simulate wheel event (happy-dom doesn't populate clientX/Y from constructor)
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(wheelEvent, 'clientX', { value: 50 });
      Object.defineProperty(wheelEvent, 'clientY', { value: 50 });
      screenElement.dispatchEvent(wheelEvent);

      // Should call sendInput with SGR wheel down sequence (button 65)
      expect(mockSendInput).toHaveBeenCalled();
      const call = (mockSendInput as any).mock.calls[0];
      expect(call[0]).toBe('t1');
      expect(call[1]).toMatch(/\x1b\[<65;\d+;\d+M/);
    });

    it('should send SGR escape sequence on wheel up', () => {
      const screenElement = mockTerminal.element.querySelector('.xterm-screen')!;

      // Simulate wheel event (happy-dom doesn't populate clientX/Y from constructor)
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(wheelEvent, 'clientX', { value: 50 });
      Object.defineProperty(wheelEvent, 'clientY', { value: 50 });
      screenElement.dispatchEvent(wheelEvent);

      // Should call sendInput with SGR wheel up sequence (button 64)
      expect(mockSendInput).toHaveBeenCalled();
      const call = (mockSendInput as any).mock.calls[0];
      expect(call[0]).toBe('t1');
      expect(call[1]).toMatch(/\x1b\[<64;\d+;\d+M/);
    });
  });

  describe('cleanup', () => {
    it('should dispose handlers and restore scroll on cleanup', () => {
      service.setup(mockTerminal as any, 't1', viewport, mockSendInput);

      // Enable mouse mode
      mockTerminal._simulateCsi('h', [1000]);
      expect(viewport.style.overflow).toBe('hidden');

      // Cleanup
      service.cleanup('t1');

      // Scroll should be restored
      expect(viewport.style.overflow).toBe('auto');
      expect(service.isMouseTrackingActive('t1')).toBe(false);
    });

    it('should handle cleanup for non-existent terminal gracefully', () => {
      // Should not throw
      expect(() => service.cleanup('nonexistent')).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should cleanup all terminals on dispose', () => {
      const viewport2 = document.createElement('div');
      viewport2.style.overflow = 'auto';
      const mockTerminal2 = createMockTerminal();

      service.setup(mockTerminal as any, 't1', viewport, mockSendInput);
      service.setup(mockTerminal2 as any, 't2', viewport2, mockSendInput);

      // Enable mouse modes
      mockTerminal._simulateCsi('h', [1000]);
      mockTerminal2._simulateCsi('h', [1003]);

      expect(viewport.style.overflow).toBe('hidden');
      expect(viewport2.style.overflow).toBe('hidden');

      // Dispose service
      service.dispose();

      // Both should be restored
      expect(viewport.style.overflow).toBe('auto');
      expect(viewport2.style.overflow).toBe('auto');
    });
  });

  describe('getActiveModes', () => {
    it('should return empty array for unknown terminal', () => {
      expect(service.getActiveModes('unknown')).toEqual([]);
    });

    it('should return active modes for known terminal', () => {
      service.setup(mockTerminal as any, 't1', viewport, mockSendInput);
      mockTerminal._simulateCsi('h', [1000]);
      mockTerminal._simulateCsi('h', [1006]);

      const modes = service.getActiveModes('t1');
      expect(modes).toHaveLength(2);
      expect(modes).toContain(1000);
      expect(modes).toContain(1006);
    });
  });
});
