/**
 * SessionRestoreManager Unit Tests
 *
 * Tests for terminal session restoration including:
 * - Restoration state management
 * - Duplicate restoration prevention
 * - Scrollback data restoration
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SessionRestoreManager,
  type SessionData,
  type ISessionRestoreCallbacks,
} from '../../../../../webview/managers/SessionRestoreManager';
import type { TerminalInstance } from '../../../../../webview/interfaces/ManagerInterfaces';
import type { Terminal } from '@xterm/xterm';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

// Mock TerminalCreationService
vi.mock('../../../../../webview/services/TerminalCreationService', () => ({
  TerminalCreationService: {
    isTerminalRestoring: vi.fn().mockReturnValue(false),
    markTerminalRestoring: vi.fn(),
    markTerminalRestored: vi.fn(),
  },
}));

// Helper to create mock terminal
function createMockTerminal(): Terminal {
  return {
    clear: vi.fn(),
    writeln: vi.fn(),
    focus: vi.fn(),
    dispose: vi.fn(),
  } as unknown as Terminal;
}

// Helper to create mock terminal instance
function createMockTerminalInstance(terminal?: Terminal): TerminalInstance {
  return {
    terminal: terminal ?? createMockTerminal(),
    fitAddon: null,
    container: document.createElement('div'),
  } as TerminalInstance;
}

// Helper to create mock callbacks
function createMockCallbacks(overrides: Partial<ISessionRestoreCallbacks> = {}): ISessionRestoreCallbacks {
  return {
    getTerminalInstance: vi.fn().mockReturnValue(undefined),
    createTerminal: vi.fn().mockResolvedValue(createMockTerminal()),
    getActiveTerminalId: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

describe('SessionRestoreManager', () => {
  let manager: SessionRestoreManager;
  let mockCallbacks: ISessionRestoreCallbacks;
  let TerminalCreationService: any;

  beforeEach(async () => {
    vi.useFakeTimers();

    const terminalCreationModule = await import('../../../../../webview/services/TerminalCreationService');
    TerminalCreationService = terminalCreationModule.TerminalCreationService;

    vi.mocked(TerminalCreationService.isTerminalRestoring).mockReturnValue(false);
    vi.mocked(TerminalCreationService.markTerminalRestoring).mockClear();
    vi.mocked(TerminalCreationService.markTerminalRestored).mockClear();

    mockCallbacks = createMockCallbacks();
    manager = new SessionRestoreManager(mockCallbacks);
  });

  afterEach(() => {
    manager.dispose();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Constructor', () => {
    it('should create instance with callbacks', () => {
      expect(manager).toBeDefined();
    });

    it('should start with isRestoringSession as false', () => {
      expect(manager.isRestoringSession()).toBe(false);
    });
  });

  describe('isRestoringSession / setRestoringSession', () => {
    it('should return false initially', () => {
      expect(manager.isRestoringSession()).toBe(false);
    });

    it('should set restoring session flag to true', () => {
      manager.setRestoringSession(true);

      expect(manager.isRestoringSession()).toBe(true);
    });

    it('should set restoring session flag to false', () => {
      manager.setRestoringSession(true);
      manager.setRestoringSession(false);

      expect(manager.isRestoringSession()).toBe(false);
    });
  });

  describe('isTerminalRestored', () => {
    it('should return false for non-restored terminal', () => {
      expect(manager.isTerminalRestored('terminal-1')).toBe(false);
    });

    it('should return true after terminal is restored', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
        scrollbackData: ['line1', 'line2'],
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      await restorePromise;

      expect(manager.isTerminalRestored('terminal-1')).toBe(true);
    });

    it('should return true if TerminalCreationService reports terminal as restoring', () => {
      vi.mocked(TerminalCreationService.isTerminalRestoring).mockReturnValue(true);

      expect(manager.isTerminalRestored('terminal-1')).toBe(true);
    });
  });

  describe('restoreSession', () => {
    it('should skip restoration for already restored terminal', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
      };

      // First restore
      const firstRestorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      await firstRestorePromise;

      // Second restore attempt
      const result = await manager.restoreSession(sessionData);

      expect(result.success).toBe(true);
      expect(result.reason).toBe('already_restored');
      expect(result.linesRestored).toBe(0);
    });

    it('should skip restoration if TerminalCreationService reports as restoring', async () => {
      vi.mocked(TerminalCreationService.isTerminalRestoring).mockReturnValue(true);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
      };

      const result = await manager.restoreSession(sessionData);

      expect(result.success).toBe(true);
      expect(result.reason).toBe('already_restored');
    });

    it('should create terminal if it does not exist', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);

      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn()
          .mockReturnValueOnce(undefined) // First call: terminal doesn't exist
          .mockReturnValue(mockInstance), // After creation: terminal exists
        createTerminal: vi.fn().mockResolvedValue(mockTerminal),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'New Terminal',
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      await restorePromise;

      expect(mockCallbacks.createTerminal).toHaveBeenCalledWith('terminal-1', 'New Terminal');
    });

    it('should fail if terminal creation fails', async () => {
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(undefined),
        createTerminal: vi.fn().mockResolvedValue(null),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      const result = await restorePromise;

      expect(result.success).toBe(false);
      expect(result.reason).toBe('terminal_creation_failed');
    });

    it('should fail if terminal instance not available after creation', async () => {
      const mockTerminal = createMockTerminal();

      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(undefined), // Always undefined
        createTerminal: vi.fn().mockResolvedValue(mockTerminal),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      const result = await restorePromise;

      expect(result.success).toBe(false);
      expect(result.reason).toBe('terminal_not_available');
    });

    it('should restore scrollback data', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
        scrollbackData: ['line1', 'line2', 'line3'],
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      const result = await restorePromise;

      expect(result.success).toBe(true);
      expect(result.linesRestored).toBe(3);
      expect(mockTerminal.clear).toHaveBeenCalled();
      expect(mockTerminal.writeln).toHaveBeenCalledTimes(3);
    });

    it('should skip empty lines in scrollback data', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
        scrollbackData: ['line1', '   ', 'line3', ''],
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      const result = await restorePromise;

      expect(result.linesRestored).toBe(2); // Only non-empty lines
    });

    it('should restore session restore message', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
        sessionRestoreMessage: '--- Session Restored ---',
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      await restorePromise;

      expect(mockTerminal.writeln).toHaveBeenCalledWith('--- Session Restored ---');
    });

    it('should not clear terminal if no scrollback data', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
        scrollbackData: [],
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      await restorePromise;

      expect(mockTerminal.clear).not.toHaveBeenCalled();
    });

    it('should focus terminal if it is the active one', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
        getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      await restorePromise;

      expect(mockTerminal.focus).toHaveBeenCalled();
    });

    it('should not focus terminal if it is not the active one', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
        getActiveTerminalId: vi.fn().mockReturnValue('terminal-2'),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      await restorePromise;

      expect(mockTerminal.focus).not.toHaveBeenCalled();
    });

    it('should mark terminal as restoring during restore', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      await restorePromise;

      expect(TerminalCreationService.markTerminalRestoring).toHaveBeenCalledWith('terminal-1');
    });

    it('should mark terminal as restored after restore', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      await restorePromise;

      expect(TerminalCreationService.markTerminalRestored).toHaveBeenCalledWith('terminal-1');
    });

    it('should handle errors gracefully', async () => {
      const mockTerminal = createMockTerminal();
      vi.mocked(mockTerminal.clear).mockImplementation(() => {
        throw new Error('Clear failed');
      });
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
        scrollbackData: ['line1'],
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      const result = await restorePromise;

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Clear failed');
      expect(TerminalCreationService.markTerminalRestored).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      const mockTerminal = createMockTerminal();
      vi.mocked(mockTerminal.clear).mockImplementation(() => {
        throw 'String error';
      });
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
        scrollbackData: ['line1'],
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      const result = await restorePromise;

      expect(result.success).toBe(false);
      expect(result.reason).toBe('unknown_error');
    });
  });

  describe('clearRestorationState', () => {
    it('should clear restoration state for terminal', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      // First restore
      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
      };
      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      await restorePromise;

      expect(manager.isTerminalRestored('terminal-1')).toBe(true);

      // Clear state
      manager.clearRestorationState('terminal-1');

      // Now should not be considered restored (unless TerminalCreationService says so)
      vi.mocked(TerminalCreationService.isTerminalRestoring).mockReturnValue(false);
      expect(manager.isTerminalRestored('terminal-1')).toBe(false);
    });

    it('should handle clearing non-existent terminal state', () => {
      expect(() => manager.clearRestorationState('non-existent')).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should clear all processed requests', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      // Restore a terminal
      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
      };
      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      await restorePromise;

      expect(manager.isTerminalRestored('terminal-1')).toBe(true);

      // Dispose
      manager.dispose();

      // After dispose, terminal should not be in processed set
      // Note: TerminalCreationService might still report it as restoring
      vi.mocked(TerminalCreationService.isTerminalRestoring).mockReturnValue(false);
      expect(manager.isTerminalRestored('terminal-1')).toBe(false);
    });

    it('should reset isRestoringSession flag', () => {
      manager.setRestoringSession(true);
      expect(manager.isRestoringSession()).toBe(true);

      manager.dispose();

      expect(manager.isRestoringSession()).toBe(false);
    });
  });

  describe('Concurrent Restoration Prevention', () => {
    it('should prevent concurrent restoration of same terminal', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
        scrollbackData: ['line1'],
      };

      // Start first restoration
      const firstRestore = manager.restoreSession(sessionData);

      // Mark as restoring after first call
      vi.mocked(TerminalCreationService.isTerminalRestoring).mockReturnValue(true);

      // Attempt second restoration immediately
      const secondRestore = manager.restoreSession(sessionData);

      await vi.advanceTimersByTimeAsync(200);
      const [firstResult, secondResult] = await Promise.all([firstRestore, secondRestore]);

      // First should succeed, second should be skipped
      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(true);
      expect(secondResult.reason).toBe('already_restored');
    });
  });

  describe('Edge Cases', () => {
    it('should handle terminal instance with null terminal', async () => {
      const mockInstance = {
        terminal: null,
        fitAddon: null,
        container: document.createElement('div'),
      } as unknown as TerminalInstance;
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      const result = await restorePromise;

      expect(result.success).toBe(false);
      expect(result.reason).toBe('terminal_not_available');
    });

    it('should handle undefined scrollbackData', async () => {
      const mockTerminal = createMockTerminal();
      const mockInstance = createMockTerminalInstance(mockTerminal);
      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Test Terminal',
        scrollbackData: undefined,
      };

      const restorePromise = manager.restoreSession(sessionData);
      await vi.advanceTimersByTimeAsync(200);
      const result = await restorePromise;

      expect(result.success).toBe(true);
      expect(result.linesRestored).toBe(0);
      expect(mockTerminal.clear).not.toHaveBeenCalled();
    });

    it('should handle multiple terminals independently', async () => {
      const mockTerminal1 = createMockTerminal();
      const mockTerminal2 = createMockTerminal();
      const mockInstance1 = createMockTerminalInstance(mockTerminal1);
      const mockInstance2 = createMockTerminalInstance(mockTerminal2);

      mockCallbacks = createMockCallbacks({
        getTerminalInstance: vi.fn().mockImplementation((id: string) => {
          if (id === 'terminal-1') return mockInstance1;
          if (id === 'terminal-2') return mockInstance2;
          return undefined;
        }),
      });
      manager = new SessionRestoreManager(mockCallbacks);

      const sessionData1: SessionData = {
        terminalId: 'terminal-1',
        terminalName: 'Terminal 1',
        scrollbackData: ['line1'],
      };
      const sessionData2: SessionData = {
        terminalId: 'terminal-2',
        terminalName: 'Terminal 2',
        scrollbackData: ['line2'],
      };

      const restore1Promise = manager.restoreSession(sessionData1);
      const restore2Promise = manager.restoreSession(sessionData2);

      await vi.advanceTimersByTimeAsync(200);
      const [result1, result2] = await Promise.all([restore1Promise, restore2Promise]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(mockTerminal1.writeln).toHaveBeenCalledWith('line1');
      expect(mockTerminal2.writeln).toHaveBeenCalledWith('line2');
    });
  });
});
