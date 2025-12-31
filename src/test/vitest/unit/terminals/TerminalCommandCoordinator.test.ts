/**
 * TerminalCommandCoordinator Unit Tests
 *
 * Tests for the consolidated coordinator that combines:
 * - TerminalStateCoordinator: State management and synchronization
 * - TerminalIOCoordinator: Input/output operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalCommandCoordinator } from '../../../../terminals/TerminalCommandCoordinator';
import type { TerminalInstance } from '../../../../types/shared';

// Mock vscode module
vi.mock('vscode', () => ({
  default: {},
  EventEmitter: vi.fn().mockImplementation(() => ({
    fire: vi.fn(),
    event: vi.fn(),
    dispose: vi.fn(),
  })),
}));

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

// Mock common utilities
vi.mock('../../../../utils/common', () => ({
  getTerminalConfig: vi.fn().mockReturnValue({ maxTerminals: 5 }),
  ActiveTerminalManager: vi.fn().mockImplementation(() => ({
    getActive: vi.fn(),
    setActive: vi.fn(),
    hasActive: vi.fn(),
    isActive: vi.fn(),
    clearActive: vi.fn(),
  })),
  getFirstValue: vi.fn(),
  showErrorMessage: vi.fn(),
}));

describe('TerminalCommandCoordinator', () => {
  let coordinator: TerminalCommandCoordinator;
  let mockTerminals: Map<string, TerminalInstance>;
  let mockActiveTerminalManager: any;
  let mockStateUpdateEmitter: any;
  let mockTerminalFocusEmitter: any;
  let mockTerminalNumberManager: any;
  let mockCliAgentService: any;

  const createMockTerminal = (id: string, name: string, isActive = false): TerminalInstance => ({
    id,
    name,
    number: parseInt(id.replace('terminal-', '')),
    isActive,
    pty: {
      write: vi.fn(),
      resize: vi.fn(),
    },
    ptyProcess: null,
    createdAt: new Date(),
    cwd: '/home/user',
  } as unknown as TerminalInstance);

  beforeEach(() => {
    vi.clearAllMocks();

    mockTerminals = new Map();

    mockActiveTerminalManager = {
      getActive: vi.fn(),
      setActive: vi.fn(),
      hasActive: vi.fn(),
      isActive: vi.fn(),
      clearActive: vi.fn(),
    };

    mockStateUpdateEmitter = {
      fire: vi.fn(),
      event: vi.fn(),
      dispose: vi.fn(),
    };

    mockTerminalFocusEmitter = {
      fire: vi.fn(),
      event: vi.fn(),
      dispose: vi.fn(),
    };

    mockTerminalNumberManager = {
      getAvailableSlots: vi.fn().mockReturnValue([1, 2, 3, 4, 5]),
    };

    mockCliAgentService = {
      detectFromInput: vi.fn(),
      detectFromOutput: vi.fn(),
    };

    coordinator = new TerminalCommandCoordinator(
      mockTerminals,
      mockActiveTerminalManager,
      mockStateUpdateEmitter,
      mockTerminalFocusEmitter,
      mockTerminalNumberManager,
      mockCliAgentService
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // STATE MANAGEMENT TESTS
  // ==========================================

  describe('State Management', () => {
    describe('getCurrentState', () => {
      it('should return empty state when no terminals exist', () => {
        mockActiveTerminalManager.getActive.mockReturnValue(null);

        const state = coordinator.getCurrentState();

        expect(state.terminals).toEqual([]);
        expect(state.activeTerminalId).toBeNull();
        expect(state.availableSlots).toEqual([1, 2, 3, 4, 5]);
      });

      it('should return state with terminals', () => {
        const terminal1 = createMockTerminal('terminal-1', 'Terminal 1', true);
        const terminal2 = createMockTerminal('terminal-2', 'Terminal 2', false);
        mockTerminals.set('terminal-1', terminal1);
        mockTerminals.set('terminal-2', terminal2);
        mockActiveTerminalManager.getActive.mockReturnValue('terminal-1');

        const state = coordinator.getCurrentState();

        expect(state.terminals).toHaveLength(2);
        expect(state.activeTerminalId).toBe('terminal-1');
      });
    });

    describe('hasActiveTerminal', () => {
      it('should return true when active terminal exists', () => {
        mockActiveTerminalManager.hasActive.mockReturnValue(true);

        expect(coordinator.hasActiveTerminal()).toBe(true);
      });

      it('should return false when no active terminal', () => {
        mockActiveTerminalManager.hasActive.mockReturnValue(false);

        expect(coordinator.hasActiveTerminal()).toBe(false);
      });
    });

    describe('getActiveTerminalId', () => {
      it('should return active terminal ID', () => {
        mockActiveTerminalManager.getActive.mockReturnValue('terminal-1');

        expect(coordinator.getActiveTerminalId()).toBe('terminal-1');
      });

      it('should return undefined when no active terminal', () => {
        mockActiveTerminalManager.getActive.mockReturnValue(undefined);

        expect(coordinator.getActiveTerminalId()).toBeUndefined();
      });
    });

    describe('setActiveTerminal', () => {
      it('should set terminal as active', () => {
        const terminal = createMockTerminal('terminal-1', 'Terminal 1');
        mockTerminals.set('terminal-1', terminal);

        coordinator.setActiveTerminal('terminal-1');

        expect(terminal.isActive).toBe(true);
        expect(mockActiveTerminalManager.setActive).toHaveBeenCalledWith('terminal-1');
      });

      it('should deactivate other terminals when setting active', () => {
        const terminal1 = createMockTerminal('terminal-1', 'Terminal 1', true);
        const terminal2 = createMockTerminal('terminal-2', 'Terminal 2', false);
        mockTerminals.set('terminal-1', terminal1);
        mockTerminals.set('terminal-2', terminal2);

        coordinator.setActiveTerminal('terminal-2');

        expect(terminal1.isActive).toBe(false);
        expect(terminal2.isActive).toBe(true);
      });

      it('should not set active if terminal does not exist', () => {
        coordinator.setActiveTerminal('non-existent');

        expect(mockActiveTerminalManager.setActive).not.toHaveBeenCalled();
      });
    });

    describe('focusTerminal', () => {
      it('should fire focus event for existing terminal', () => {
        const terminal = createMockTerminal('terminal-1', 'Terminal 1');
        mockTerminals.set('terminal-1', terminal);

        coordinator.focusTerminal('terminal-1');

        expect(mockTerminalFocusEmitter.fire).toHaveBeenCalledWith('terminal-1');
      });

      it('should not fire event for non-existent terminal', () => {
        coordinator.focusTerminal('non-existent');

        expect(mockTerminalFocusEmitter.fire).not.toHaveBeenCalled();
      });
    });

    describe('notifyStateUpdate', () => {
      it('should fire state update event', () => {
        mockActiveTerminalManager.getActive.mockReturnValue(null);

        coordinator.notifyStateUpdate();

        expect(mockStateUpdateEmitter.fire).toHaveBeenCalled();
      });
    });

    describe('reorderTerminals', () => {
      it('should reorder terminals according to provided order', () => {
        const terminal1 = createMockTerminal('terminal-1', 'Terminal 1');
        const terminal2 = createMockTerminal('terminal-2', 'Terminal 2');
        const terminal3 = createMockTerminal('terminal-3', 'Terminal 3');
        mockTerminals.set('terminal-1', terminal1);
        mockTerminals.set('terminal-2', terminal2);
        mockTerminals.set('terminal-3', terminal3);
        mockActiveTerminalManager.getActive.mockReturnValue(null);

        coordinator.reorderTerminals(['terminal-3', 'terminal-1', 'terminal-2']);

        const keys = Array.from(mockTerminals.keys());
        expect(keys).toEqual(['terminal-3', 'terminal-1', 'terminal-2']);
      });

      it('should not modify order if order array is empty', () => {
        const terminal1 = createMockTerminal('terminal-1', 'Terminal 1');
        mockTerminals.set('terminal-1', terminal1);

        coordinator.reorderTerminals([]);

        expect(mockStateUpdateEmitter.fire).not.toHaveBeenCalled();
      });
    });

    describe('updateTerminalCwd', () => {
      it('should update terminal cwd', () => {
        const terminal = createMockTerminal('terminal-1', 'Terminal 1');
        mockTerminals.set('terminal-1', terminal);

        coordinator.updateTerminalCwd('terminal-1', '/new/path');

        expect(terminal.cwd).toBe('/new/path');
      });

      it('should do nothing for non-existent terminal', () => {
        coordinator.updateTerminalCwd('non-existent', '/new/path');
        // Should not throw
      });
    });

    describe('updateActiveTerminalAfterRemoval', () => {
      it('should clear active if removed terminal was active and no terminals remain', () => {
        mockActiveTerminalManager.isActive.mockReturnValue(true);

        coordinator.updateActiveTerminalAfterRemoval('terminal-1');

        expect(mockActiveTerminalManager.clearActive).toHaveBeenCalled();
      });
    });
  });

  // ==========================================
  // I/O OPERATIONS TESTS
  // ==========================================

  describe('I/O Operations', () => {
    describe('sendInput', () => {
      it('should send input to specified terminal', () => {
        const terminal = createMockTerminal('terminal-1', 'Terminal 1');
        mockTerminals.set('terminal-1', terminal);

        coordinator.sendInput('test input', 'terminal-1');

        expect(mockCliAgentService.detectFromInput).toHaveBeenCalledWith('terminal-1', 'test input');
      });

      it('should send input to active terminal when no terminal ID provided', () => {
        const terminal = createMockTerminal('terminal-1', 'Terminal 1');
        mockTerminals.set('terminal-1', terminal);
        mockActiveTerminalManager.getActive.mockReturnValue('terminal-1');

        coordinator.sendInput('test input');

        expect(mockCliAgentService.detectFromInput).toHaveBeenCalledWith('terminal-1', 'test input');
      });

      it('should not send input when no active terminal and no ID provided', () => {
        mockActiveTerminalManager.getActive.mockReturnValue(undefined);

        coordinator.sendInput('test input');

        expect(mockCliAgentService.detectFromInput).not.toHaveBeenCalled();
      });
    });

    describe('resize', () => {
      it('should resize specified terminal', () => {
        const terminal = createMockTerminal('terminal-1', 'Terminal 1');
        mockTerminals.set('terminal-1', terminal);

        coordinator.resize(80, 24, 'terminal-1');

        expect(terminal.pty?.resize).toHaveBeenCalledWith(80, 24);
      });

      it('should resize active terminal when no ID provided', () => {
        const terminal = createMockTerminal('terminal-1', 'Terminal 1');
        mockTerminals.set('terminal-1', terminal);
        mockActiveTerminalManager.getActive.mockReturnValue('terminal-1');

        coordinator.resize(80, 24);

        expect(terminal.pty?.resize).toHaveBeenCalledWith(80, 24);
      });
    });

    describe('getTerminalInfo', () => {
      it('should return terminal info for existing terminal', () => {
        const terminal = createMockTerminal('terminal-1', 'Terminal 1', true);
        mockTerminals.set('terminal-1', terminal);

        const info = coordinator.getTerminalInfo('terminal-1');

        expect(info).toEqual({
          id: 'terminal-1',
          name: 'Terminal 1',
          isActive: true,
        });
      });

      it('should return undefined for non-existent terminal', () => {
        const info = coordinator.getTerminalInfo('non-existent');

        expect(info).toBeUndefined();
      });
    });

    describe('writeToTerminal', () => {
      it('should write data to terminal', () => {
        const terminal = createMockTerminal('terminal-1', 'Terminal 1');
        mockTerminals.set('terminal-1', terminal);

        const result = coordinator.writeToTerminal('terminal-1', 'test data');

        expect(result).toBe(true);
        expect(terminal.pty?.write).toHaveBeenCalledWith('test data');
      });

      it('should return false for non-existent terminal', () => {
        const result = coordinator.writeToTerminal('non-existent', 'test data');

        expect(result).toBe(false);
      });
    });

    describe('resizeTerminal', () => {
      it('should resize terminal and return true', () => {
        const terminal = createMockTerminal('terminal-1', 'Terminal 1');
        mockTerminals.set('terminal-1', terminal);

        const result = coordinator.resizeTerminal('terminal-1', 80, 24);

        expect(result).toBe(true);
      });

      it('should return true even for non-existent terminal (no-op)', () => {
        // Current implementation returns true as resize() doesn't throw
        // when terminal is not found - it just logs a warning
        const result = coordinator.resizeTerminal('non-existent', 80, 24);

        expect(result).toBe(true);
      });
    });
  });
});
