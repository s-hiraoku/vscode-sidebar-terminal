/**
 * TerminalLifecycleCoordinator Unit Tests
 *
 * Tests for terminal lifecycle management including:
 * - Active terminal management
 * - Terminal instance access
 * - Terminal resize handling
 * - Data writing with auto-scroll
 * - Container initialization
 * - Resource disposal
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('../../../../../webview/services/TerminalCreationService', () => {
  return {
    TerminalCreationService: class MockTerminalCreationService {
      createTerminal = vi.fn().mockResolvedValue({});
      removeTerminal = vi.fn().mockResolvedValue(true);
      switchToTerminal = vi.fn().mockResolvedValue(true);
    },
  };
});

vi.mock('../../../../../webview/utils/ResizeManager', () => ({
  ResizeManager: {
    debounceResize: vi.fn((_key: string, callback: () => void) => {
      callback();
    }),
    unobserveResize: vi.fn(),
    clearResize: vi.fn(),
  },
}));

vi.mock('../../../../../webview/utils/EventHandlerRegistry', () => {
  return {
    EventHandlerRegistry: class MockEventHandlerRegistry {
      dispose = vi.fn();
    },
  };
});

vi.mock('../../../../../webview/utils/ManagerLogger', () => ({
  terminalLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../../webview/utils/DOMUtils', () => ({
  DOMUtils: {
    resetXtermInlineStyles: vi.fn(),
  },
}));

// Import after mocks are set up
import { TerminalLifecycleCoordinator } from '../../../../../webview/managers/TerminalLifecycleCoordinator';
import type { TerminalInstance } from '../../../../../webview/interfaces/ManagerInterfaces';

describe('TerminalLifecycleCoordinator', () => {
  let coordinator: TerminalLifecycleCoordinator;
  let mockTerminals: Map<string, TerminalInstance>;
  let mockContainers: Map<string, HTMLElement>;

  beforeEach(() => {
    vi.useFakeTimers();

    // Setup mock terminal and container maps
    mockTerminals = new Map();
    mockContainers = new Map();

    // Create mock SplitManager
    const mockSplitManager = {
      getTerminals: vi.fn(() => mockTerminals),
      getTerminalContainers: vi.fn(() => mockContainers),
    };

    // Create mock coordinator
    const mockCoordinator = {
      postMessageToExtension: vi.fn(),
    };

    coordinator = new TerminalLifecycleCoordinator(
      mockSplitManager as any,
      mockCoordinator as any
    );
  });

  afterEach(() => {
    if (coordinator) {
      coordinator.dispose();
    }
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('getActiveTerminalId', () => {
    it('should return null initially', () => {
      expect(coordinator.getActiveTerminalId()).toBeNull();
    });

    it('should return set terminal ID', () => {
      coordinator.activeTerminalId = 'terminal-1';
      expect(coordinator.getActiveTerminalId()).toBe('terminal-1');
    });
  });

  describe('setActiveTerminalId', () => {
    it('should set active terminal ID', () => {
      coordinator.setActiveTerminalId('terminal-1');
      expect(coordinator.activeTerminalId).toBe('terminal-1');
    });

    it('should set to null', () => {
      coordinator.setActiveTerminalId('terminal-1');
      coordinator.setActiveTerminalId(null);
      expect(coordinator.activeTerminalId).toBeNull();
    });

    it('should attempt to focus terminal when setting active', () => {
      const mockTextarea = document.createElement('textarea');
      const mockTerminal = {
        textarea: mockTextarea,
        focus: vi.fn(),
      };

      mockTerminals.set('terminal-1', {
        terminal: mockTerminal as any,
        fitAddon: {} as any,
        container: document.createElement('div'),
        name: 'Terminal 1',
        number: 1,
      });

      coordinator.setActiveTerminalId('terminal-1');
      vi.advanceTimersByTime(10);

      expect(mockTerminal.focus).toHaveBeenCalled();
    });

    it('should skip focus if textarea already focused', () => {
      const mockTextarea = document.createElement('textarea');
      document.body.appendChild(mockTextarea);
      mockTextarea.focus();

      const mockTerminal = {
        textarea: mockTextarea,
        focus: vi.fn(),
      };

      mockTerminals.set('terminal-1', {
        terminal: mockTerminal as any,
        fitAddon: {} as any,
        container: document.createElement('div'),
        name: 'Terminal 1',
        number: 1,
      });

      coordinator.setActiveTerminalId('terminal-1');
      vi.advanceTimersByTime(10);

      expect(mockTerminal.focus).not.toHaveBeenCalled();
    });
  });

  describe('getTerminalInstance', () => {
    it('should return undefined for non-existent terminal', () => {
      expect(coordinator.getTerminalInstance('terminal-999')).toBeUndefined();
    });

    it('should return terminal instance', () => {
      const instance: TerminalInstance = {
        terminal: {} as any,
        fitAddon: {} as any,
        container: document.createElement('div'),
        name: 'Terminal 1',
        number: 1,
      };
      mockTerminals.set('terminal-1', instance);

      expect(coordinator.getTerminalInstance('terminal-1')).toBe(instance);
    });
  });

  describe('getAllTerminalInstances', () => {
    it('should return empty map initially', () => {
      expect(coordinator.getAllTerminalInstances().size).toBe(0);
    });

    it('should return all terminal instances', () => {
      mockTerminals.set('terminal-1', {} as any);
      mockTerminals.set('terminal-2', {} as any);

      expect(coordinator.getAllTerminalInstances().size).toBe(2);
    });
  });

  describe('getAllTerminalContainers', () => {
    it('should return containers map', () => {
      mockContainers.set('terminal-1', document.createElement('div'));
      expect(coordinator.getAllTerminalContainers().size).toBe(1);
    });
  });

  describe('getTerminalElement', () => {
    it('should return undefined for non-existent terminal', () => {
      expect(coordinator.getTerminalElement('terminal-999')).toBeUndefined();
    });

    it('should return container element', () => {
      const container = document.createElement('div');
      mockTerminals.set('terminal-1', {
        terminal: {} as any,
        fitAddon: {} as any,
        container,
        name: 'Terminal 1',
        number: 1,
      });

      expect(coordinator.getTerminalElement('terminal-1')).toBe(container);
    });
  });

  describe('createTerminal', () => {
    it('should delegate to TerminalCreationService', async () => {
      const result = await coordinator.createTerminal('terminal-1', 'Terminal 1');
      expect(result).toBeTruthy();
    });
  });

  describe('removeTerminal', () => {
    it('should delegate to TerminalCreationService', async () => {
      const result = await coordinator.removeTerminal('terminal-1');
      expect(result).toBe(true);
    });
  });

  describe('switchToTerminal', () => {
    it('should delegate to TerminalCreationService', async () => {
      const result = await coordinator.switchToTerminal('terminal-1');
      expect(result).toBe(true);
    });
  });

  describe('writeToTerminal', () => {
    it('should return false when no active terminal', () => {
      const result = coordinator.writeToTerminal('test data');
      expect(result).toBe(false);
    });

    it('should return false when terminal not found', () => {
      coordinator.activeTerminalId = 'terminal-999';
      const result = coordinator.writeToTerminal('test data');
      expect(result).toBe(false);
    });

    it('should write to active terminal', () => {
      const mockWrite = vi.fn((data: string, callback: () => void) => {
        callback();
      });
      const mockTerminal = {
        write: mockWrite,
        buffer: {
          active: {
            baseY: 100,
            viewportY: 100,
          },
        },
        scrollToBottom: vi.fn(),
      };

      mockTerminals.set('terminal-1', {
        terminal: mockTerminal as any,
        fitAddon: {} as any,
        container: document.createElement('div'),
        name: 'Terminal 1',
        number: 1,
      });

      coordinator.activeTerminalId = 'terminal-1';
      const result = coordinator.writeToTerminal('test data');

      expect(result).toBe(true);
      expect(mockWrite).toHaveBeenCalledWith('test data', expect.any(Function));
    });

    it('should write to specific terminal by ID', () => {
      const mockWrite = vi.fn();
      mockTerminals.set('terminal-2', {
        terminal: { write: mockWrite, buffer: { active: { baseY: 0, viewportY: 0 } } } as any,
        fitAddon: {} as any,
        container: document.createElement('div'),
        name: 'Terminal 2',
        number: 2,
      });

      const result = coordinator.writeToTerminal('test data', 'terminal-2');
      expect(result).toBe(true);
      expect(mockWrite).toHaveBeenCalledWith('test data', expect.any(Function));
    });

    it('should auto-scroll when at bottom', () => {
      const mockScrollToBottom = vi.fn();
      const mockWrite = vi.fn((data: string, callback: () => void) => {
        callback();
      });

      mockTerminals.set('terminal-1', {
        terminal: {
          write: mockWrite,
          buffer: {
            active: {
              baseY: 100,
              viewportY: 100, // At bottom
            },
          },
          scrollToBottom: mockScrollToBottom,
        } as any,
        fitAddon: {} as any,
        container: document.createElement('div'),
        name: 'Terminal 1',
        number: 1,
      });

      coordinator.activeTerminalId = 'terminal-1';
      coordinator.writeToTerminal('test data');

      expect(mockScrollToBottom).toHaveBeenCalled();
    });

    it('should not auto-scroll when not at bottom', () => {
      const mockScrollToBottom = vi.fn();
      const mockWrite = vi.fn((data: string, callback: () => void) => {
        callback();
      });

      mockTerminals.set('terminal-1', {
        terminal: {
          write: mockWrite,
          buffer: {
            active: {
              baseY: 100,
              viewportY: 50, // Not at bottom (difference > 1)
            },
          },
          scrollToBottom: mockScrollToBottom,
        } as any,
        fitAddon: {} as any,
        container: document.createElement('div'),
        name: 'Terminal 1',
        number: 1,
      });

      coordinator.activeTerminalId = 'terminal-1';
      coordinator.writeToTerminal('test data');

      expect(mockScrollToBottom).not.toHaveBeenCalled();
    });
  });

  describe('initializeSimpleTerminal', () => {
    afterEach(() => {
      const body = document.getElementById('terminal-body');
      if (body && body.parentNode) {
        body.parentNode.removeChild(body);
      }
    });

    it('should initialize terminal body container', () => {
      const container = document.createElement('div');
      container.id = 'terminal-body';
      document.body.appendChild(container);

      coordinator.initializeSimpleTerminal();

      expect(container.className).toBe('terminal-body-container');
      expect(container.style.display).toBe('flex');
    });

    it('should create terminals-wrapper if not exists', () => {
      const container = document.createElement('div');
      container.id = 'terminal-body';
      document.body.appendChild(container);

      coordinator.initializeSimpleTerminal();

      const wrapper = document.getElementById('terminals-wrapper');
      expect(wrapper).not.toBeNull();
      expect(wrapper?.style.display).toBe('flex');
    });

    it('should not create duplicate terminals-wrapper', () => {
      const container = document.createElement('div');
      container.id = 'terminal-body';
      document.body.appendChild(container);

      const existingWrapper = document.createElement('div');
      existingWrapper.id = 'terminals-wrapper';
      container.appendChild(existingWrapper);

      coordinator.initializeSimpleTerminal();

      const wrappers = document.querySelectorAll('#terminals-wrapper');
      expect(wrappers.length).toBe(1);
    });

    it('should handle missing container gracefully', () => {
      // No container in DOM
      expect(() => coordinator.initializeSimpleTerminal()).not.toThrow();
    });
  });

  describe('resizeAllTerminals', () => {
    it('should resize all terminals', async () => {
      const mockFit = vi.fn();
      mockTerminals.set('terminal-1', {
        terminal: { cols: 80, rows: 24 } as any,
        fitAddon: { fit: mockFit } as any,
        container: document.createElement('div'),
        name: 'Terminal 1',
        number: 1,
      });

      coordinator.resizeAllTerminals();

      // Fast-forward for requestAnimationFrame
      vi.advanceTimersByTime(100);

      expect(mockFit).toHaveBeenCalled();
    });
  });

  describe('getTerminalStats', () => {
    it('should return correct stats with no terminals', () => {
      const stats = coordinator.getTerminalStats();

      expect(stats.totalTerminals).toBe(0);
      expect(stats.activeTerminalId).toBeNull();
      expect(stats.terminalIds).toEqual([]);
    });

    it('should return correct stats with terminals', () => {
      mockTerminals.set('terminal-1', {} as any);
      mockTerminals.set('terminal-2', {} as any);
      coordinator.activeTerminalId = 'terminal-1';

      const stats = coordinator.getTerminalStats();

      expect(stats.totalTerminals).toBe(2);
      expect(stats.activeTerminalId).toBe('terminal-1');
      expect(stats.terminalIds).toContain('terminal-1');
      expect(stats.terminalIds).toContain('terminal-2');
    });
  });

  describe('dispose', () => {
    it('should reset all instance variables', () => {
      coordinator.activeTerminalId = 'terminal-1';
      coordinator.terminal = {} as any;
      coordinator.fitAddon = {} as any;
      coordinator.terminalContainer = document.createElement('div');

      coordinator.dispose();

      expect(coordinator.activeTerminalId).toBeNull();
      expect(coordinator.terminal).toBeNull();
      expect(coordinator.fitAddon).toBeNull();
      expect(coordinator.terminalContainer).toBeNull();
    });

    it('should cleanup resize observers for all terminals', async () => {
      const { ResizeManager } = await import('../../../../../webview/utils/ResizeManager');

      mockTerminals.set('terminal-1', {} as any);
      mockTerminals.set('terminal-2', {} as any);

      coordinator.dispose();

      expect(ResizeManager.unobserveResize).toHaveBeenCalledWith('terminal-1');
      expect(ResizeManager.unobserveResize).toHaveBeenCalledWith('terminal-2');
    });
  });
});
