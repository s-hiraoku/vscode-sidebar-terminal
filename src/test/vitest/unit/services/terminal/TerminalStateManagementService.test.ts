import { describe, it, expect, vi } from 'vitest';

// Mock common utility FIRST
vi.mock('../../../../../utils/common', () => ({
  getTerminalConfig: vi.fn(() => ({ maxTerminals: 5 })),
  ActiveTerminalManager: class {
    _active = undefined;
    getActive = vi.fn(function() { return this._active; });
    setActive = vi.fn(function(id) { this._active = id; });
    clearActive = vi.fn(function() { this._active = undefined; });
    hasActive = vi.fn(function() { return !!this._active; });
    isActive = vi.fn(function(id) { return this._active === id; });
  },
}));


import { TerminalStateManagementService } from '../../../../../services/terminal/TerminalStateManagementService';

// Mock VS Code
vi.mock('vscode', () => ({
  EventEmitter: class {
    fire = vi.fn();
    event = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock('../../../../../utils/logger');

/**
 * Mock terminal interface for testing
 */
interface MockTerminal {
  id: string;
  name: string;
  isActive: boolean;
}

describe('TerminalStateManagementService', () => {
  let service: TerminalStateManagementService;
  let mockTerminal: MockTerminal;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new TerminalStateManagementService();

    mockTerminal = {
      id: 'term-1',
      name: 'Terminal 1',
      isActive: false,
    };
  });

  afterEach(() => {
    service.dispose();
  });

  describe('addTerminal', () => {
    it('should add terminal to map and notify', () => {
      service.addTerminal(mockTerminal);
      
      expect(service.hasTerminal('term-1')).toBe(true);
      expect(service.getTerminal('term-1')).toBe(mockTerminal);
      expect(service.getTerminalCount()).toBe(1);
    });
  });

  describe('removeTerminal', () => {
    it('should remove terminal and notify', () => {
      service.addTerminal(mockTerminal);
      service.removeTerminal('term-1');
      
      expect(service.hasTerminal('term-1')).toBe(false);
      expect(service.getTerminalCount()).toBe(0);
    });
  });

  describe('active terminal management', () => {
    beforeEach(() => {
      service.addTerminal(mockTerminal);
      service.addTerminal({ ...mockTerminal, id: 'term-2', name: 'Terminal 2' });
    });

    it('should set active terminal', () => {
      const success = service.setActiveTerminal('term-2');
      
      expect(success).toBe(true);
      expect(service.getActiveTerminalId()).toBe('term-2');
      expect(service.getTerminal('term-2')?.isActive).toBe(true);
      expect(service.getTerminal('term-1')?.isActive).toBe(false);
    });

    it('should return false for non-existent terminal', () => {
      const success = service.setActiveTerminal('non-existent');
      expect(success).toBe(false);
    });

    it('should clear active terminal', () => {
      service.setActiveTerminal('term-1');
      service.clearActiveTerminal();
      
      expect(service.getActiveTerminalId()).toBeUndefined();
      expect(mockTerminal.isActive).toBe(false);
    });
  });

  describe('getCurrentState', () => {
    it('should return combined state', () => {
      service.addTerminal(mockTerminal);
      service.setActiveTerminal('term-1');
      
      const state = service.getCurrentState();
      expect(state.terminals.length).toBe(1);
      expect(state.activeTerminalId).toBe('term-1');
      expect(state.terminals[0].id).toBe('term-1');
    });
  });

  describe('validateDeletion', () => {
    it('should allow deletion if multiple terminals exist', () => {
      service.addTerminal(mockTerminal);
      service.addTerminal({ id: 't2', name: 'T2' } as any);
      
      const result = service.validateDeletion('term-1');
      expect(result.canDelete).toBe(true);
    });

    it('should block deletion if only one terminal exists', () => {
      service.addTerminal(mockTerminal);
      
      const result = service.validateDeletion('term-1');
      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('at least 1 terminal');
    });
  });
});
