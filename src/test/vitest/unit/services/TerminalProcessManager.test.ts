
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalProcessManager } from '../../../../services/TerminalProcessManager';
import { TerminalInstance } from '../../../../types/shared';

// Mock TerminalInstance
const createMockTerminal = (id: string, ptyMock?: any): TerminalInstance => ({
  id,
  name: `Terminal ${id}`,
  number: 1,
  pty: ptyMock,
  ptyProcess: ptyMock,
  createdAt: new Date(),
  cwd: '/tmp',
  isActive: true,
  xtermReady: true,
  processState: 0,
});

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

describe('TerminalProcessManager', () => {
  let manager: TerminalProcessManager;
  let mockPty: any;
  let terminal: TerminalInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new TerminalProcessManager();
    mockPty = {
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      pid: 12345,
    };
    terminal = createMockTerminal('term-1', mockPty);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('writeToPty', () => {
    it('should write data to pty successfully', () => {
      const result = manager.writeToPty(terminal, 'test data');
      
      expect(result.success).toBe(true);
      expect(mockPty.write).toHaveBeenCalledWith('test data');
    });

    it('should fail if pty is not ready', () => {
      terminal.ptyProcess = undefined;
      terminal.pty = undefined;
      
      const result = manager.writeToPty(terminal, 'test');
      
      expect(result.success).toBe(false);
      expect(result.reason).toContain('PTY not ready');
    });

    it('should fail if pty write throws', () => {
      mockPty.write.mockImplementation(() => { throw new Error('Write error'); });
      
      const result = manager.writeToPty(terminal, 'test');
      
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Write error');
    });

    it('should fail if pty process is killed', () => {
      mockPty.killed = true;
      const result = manager.writeToPty(terminal, 'test');
      
      expect(result.success).toBe(false);
      expect(result.reason).toContain('PTY instance missing write method or process killed');
    });
  });

  describe('resizePty', () => {
    it('should resize pty successfully', () => {
      const result = manager.resizePty(terminal, 80, 24);
      
      expect(result.success).toBe(true);
      expect(mockPty.resize).toHaveBeenCalledWith(80, 24);
    });

    it('should validate dimensions (too small)', () => {
      const result = manager.resizePty(terminal, 0, 24);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Invalid dimensions');
    });

    it('should validate dimensions (too large)', () => {
      const result = manager.resizePty(terminal, 600, 24);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Dimensions too large');
    });

    it('should fail if pty missing resize method', () => {
      mockPty.resize = undefined;
      const result = manager.resizePty(terminal, 80, 24);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('missing resize method');
    });

    it('should fail if pty throws during resize', () => {
      mockPty.resize.mockImplementation(() => { throw new Error('Resize error'); });
      const result = manager.resizePty(terminal, 80, 24);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Resize error');
    });
  });

  describe('killPty', () => {
    it('should kill pty successfully', () => {
      const result = manager.killPty(terminal);
      expect(result.success).toBe(true);
      expect(mockPty.kill).toHaveBeenCalled();
    });

    it('should fail if no pty instance', () => {
      terminal.ptyProcess = undefined;
      terminal.pty = undefined;
      const result = manager.killPty(terminal);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('No PTY instance');
    });

    it('should fail if pty missing kill method', () => {
      mockPty.kill = undefined;
      const result = manager.killPty(terminal);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('missing kill method');
    });

    it('should fail if kill throws', () => {
      mockPty.kill.mockImplementation(() => { throw new Error('Kill error'); });
      const result = manager.killPty(terminal);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Kill error');
    });
  });

  describe('isPtyAlive', () => {
    it('should return true for active pty', () => {
      expect(manager.isPtyAlive(terminal)).toBe(true);
    });

    it('should return false if pty missing', () => {
      terminal.ptyProcess = undefined;
      terminal.pty = undefined;
      expect(manager.isPtyAlive(terminal)).toBe(false);
    });

    it('should return false if killed property is true', () => {
      mockPty.killed = true;
      expect(manager.isPtyAlive(terminal)).toBe(false);
    });

    it('should return false if pid is invalid', () => {
      mockPty.pid = 0;
      expect(manager.isPtyAlive(terminal)).toBe(false);
    });
  });

  describe('retryWrite', () => {
    it('should succeed immediately if first write works', async () => {
      const result = await manager.retryWrite(terminal, 'test');
      expect(result.success).toBe(true);
      expect(mockPty.write).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed', async () => {
      vi.useFakeTimers();
      mockPty.write
        .mockImplementationOnce(() => { throw new Error('Fail 1'); })
        .mockImplementationOnce(() => {}); // Success

      const promise = manager.retryWrite(terminal, 'test');
      
      // Advance timers to trigger retry
      await vi.advanceTimersByTimeAsync(1000);
      
      const result = await promise;
      expect(result.success).toBe(true);
      expect(mockPty.write).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      vi.useFakeTimers();
      mockPty.write.mockImplementation(() => { throw new Error('Fail'); });

      const promise = manager.retryWrite(terminal, 'test', 2);
      
      await vi.advanceTimersByTimeAsync(2000);
      
      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.reason).toContain('after 2 attempts');
      expect(mockPty.write).toHaveBeenCalledTimes(2);
    });
  });

  describe('attemptRecovery', () => {
    it('should recover using alternative pty reference', () => {
      // Simulate ptyProcess broken but pty works
      const brokenPty = { write: () => { throw new Error('Broken'); } };
      const workingPty = { write: vi.fn(), pid: 123 };
      
      terminal.ptyProcess = brokenPty;
      terminal.pty = workingPty;

      const result = manager.attemptRecovery(terminal);
      
      expect(result.success).toBe(true);
      expect(workingPty.write).toHaveBeenCalledWith('');
      // Should fix reference
      expect(terminal.ptyProcess).toBeUndefined();
    });

    it('should fail if all alternatives fail', () => {
      terminal.ptyProcess = { write: () => { throw new Error('Fail 1'); } };
      terminal.pty = { write: () => { throw new Error('Fail 2'); } };

      const result = manager.attemptRecovery(terminal);
      
      expect(result.success).toBe(false);
      expect(result.reason).toContain('All recovery attempts failed');
    });
  });
});
