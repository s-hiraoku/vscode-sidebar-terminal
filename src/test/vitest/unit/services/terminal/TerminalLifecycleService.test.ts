import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock common utility FIRST
vi.mock('../../../../../utils/common', () => ({
  getTerminalConfig: vi.fn(() => ({ maxTerminals: 5 })),
  getShellForPlatform: vi.fn(() => '/bin/bash'),
  getWorkingDirectory: vi.fn(async () => '/test/cwd'),
  generateTerminalId: vi.fn(() => 'term-123'),
  generateTerminalName: vi.fn(() => 'Terminal 1'),
  ActiveTerminalManager: class {
    setActive = vi.fn();
    getActive = vi.fn();
    clearActive = vi.fn();
    hasActive = vi.fn();
    isActive = vi.fn();
  },
}));

import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import { TerminalLifecycleService } from '../../../../../services/terminal/TerminalLifecycleService';

// Mock other dependencies
vi.mock('@homebridge/node-pty-prebuilt-multiarch', () => ({
  spawn: vi.fn(),
}));

vi.mock('../../../../../utils/logger');

describe('TerminalLifecycleService', () => {
  let service: TerminalLifecycleService;
  let mockPtyProcess: any;

  beforeEach(() => {
    vi.resetAllMocks();
    
    mockPtyProcess = {
      pid: 1234,
      onData: vi.fn(),
      onExit: vi.fn(),
      kill: vi.fn(),
      resize: vi.fn(),
      write: vi.fn(),
    };

    vi.mocked(pty.spawn).mockReturnValue(mockPtyProcess);
    
    service = new TerminalLifecycleService();
  });

  afterEach(() => {
    service.dispose();
  });

  describe('createTerminal', () => {
    it('should create a terminal instance successfully', async () => {
      const result = await service.createTerminal();
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('term-123');
        expect(result.value.pid).toBe(1234);
        expect(pty.spawn).toHaveBeenCalled();
      }
    });

    it('should respect custom options', async () => {
      const options = {
        shell: '/bin/zsh',
        shellArgs: ['-i'],
        cwd: '/custom/dir',
        terminalName: 'My Term'
      };
      
      const result = await service.createTerminal(options);
      
      expect(result.success).toBe(true);
      expect(pty.spawn).toHaveBeenCalledWith(
        '/bin/zsh',
        ['-i'],
        expect.objectContaining({ cwd: '/custom/dir' })
      );
    });

    it('should prevent duplicate creation of same ID', async () => {
      // Since it's async, we can try to call it twice in parallel.
      const p1 = service.createTerminal();
      const p2 = service.createTerminal();
      
      const [r1, r2] = await Promise.all([p1, p2]);
      
      expect(r1.success || r2.success).toBe(true);
      if (!r1.success || !r2.success) {
        const failure = !r1.success ? r1 : r2;
        // @ts-ignore
        expect(failure.error.code).toBe('TERMINAL_ALREADY_EXISTS');
      }
    });
  });

  describe('disposeTerminal', () => {
    it('should kill pty process', async () => {
      const term = {
        id: 't1',
        pty: mockPtyProcess,
      } as any;

      await service.disposeTerminal(term);
      
      expect(mockPtyProcess.kill).toHaveBeenCalled();
    });
  });

  describe('resizeTerminal', () => {
    it('should call pty.resize', () => {
      const term = { id: 't1', pty: mockPtyProcess } as any;
      service.resizeTerminal(term, 100, 30);
      expect(mockPtyProcess.resize).toHaveBeenCalledWith(100, 30);
    });
  });

  describe('sendInputToTerminal', () => {
    it('should call pty.write', () => {
      const term = { id: 't1', pty: mockPtyProcess } as any;
      service.sendInputToTerminal(term, 'hello');
      expect(mockPtyProcess.write).toHaveBeenCalledWith('hello');
    });
  });
});