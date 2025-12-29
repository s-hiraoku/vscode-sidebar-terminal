import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import { TerminalSpawner, TerminalSpawnRequest } from '../../../../terminals/TerminalSpawner';
import { TERMINAL_CONSTANTS } from '../../../../constants';

// Mock dependencies
vi.mock('fs', () => ({
  statSync: vi.fn(),
  accessSync: vi.fn(),
  constants: {
    R_OK: 4,
    X_OK: 1,
  },
}));

vi.mock('@homebridge/node-pty-prebuilt-multiarch', () => ({
  spawn: vi.fn(),
}));

vi.mock('../../../../utils/logger');

describe('TerminalSpawner', () => {
  let spawner: TerminalSpawner;
  let mockPtyProcess: any;

  const defaultRequest: TerminalSpawnRequest = {
    terminalId: 'test-term',
    shell: '/bin/bash',
    shellArgs: ['-l'],
    cwd: '/users/test',
    env: { TEST_VAR: 'value' },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    spawner = new TerminalSpawner();

    mockPtyProcess = {
      pid: 12345,
      onData: vi.fn(),
      onExit: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
    };

    // Default mocks
    vi.mocked(pty.spawn).mockReturnValue(mockPtyProcess);
    
    // Mock fs.statSync and accessSync to simulate valid directories by default
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => true,
    } as any);
    vi.mocked(fs.accessSync).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('spawnTerminal', () => {
    it('should spawn a terminal with provided configuration', () => {
      const result = spawner.spawnTerminal(defaultRequest);

      expect(pty.spawn).toHaveBeenCalledWith(
        defaultRequest.shell,
        defaultRequest.shellArgs,
        expect.objectContaining({
          cwd: defaultRequest.cwd,
          cols: TERMINAL_CONSTANTS.DEFAULT_COLS,
          rows: TERMINAL_CONSTANTS.DEFAULT_ROWS,
          name: 'xterm-256color',
        })
      );
      expect(result.ptyProcess).toBe(mockPtyProcess);
    });

    it('should build environment variables correctly', () => {
      spawner.spawnTerminal(defaultRequest);

      const spawnCall = vi.mocked(pty.spawn).mock.calls[0];
      const env = spawnCall[2].env;

      expect(env).toMatchObject({
        TEST_VAR: 'value',
        LANG: 'en_US.UTF-8',
        FORCE_COLOR: '1',
      });
    });

    it('should try fallback shells if primary shell fails', () => {
      // First call throws error
      vi.mocked(pty.spawn).mockImplementationOnce(() => {
        throw new Error('Shell not found');
      });
      // Second call returns process
      vi.mocked(pty.spawn).mockReturnValueOnce(mockPtyProcess);

      const request = { ...defaultRequest, shell: '/invalid/shell' };
      const result = spawner.spawnTerminal(request);

      expect(pty.spawn).toHaveBeenCalledTimes(2);
      expect(vi.mocked(pty.spawn).mock.calls[0][0]).toBe('/invalid/shell');
      // Should fall back to one of the default shells (zsh, bash, sh)
      expect(['/bin/zsh', '/bin/bash', '/bin/sh']).toContain(vi.mocked(pty.spawn).mock.calls[1][0]);
      expect(result.ptyProcess).toBe(mockPtyProcess);
    });

    it('should skip inaccessible directories', () => {
      // Mock fs.statSync to fail for the requested cwd
      vi.mocked(fs.statSync).mockImplementation((path) => {
        if (path === defaultRequest.cwd) {
          throw new Error('Not found');
        }
        return { isDirectory: () => true } as any;
      });

      // It should try other candidates like home or tmp
      const home = '/users/home';
      const env = { ...defaultRequest.env, HOME: home };
      
      spawner.spawnTerminal({ ...defaultRequest, env });

      expect(pty.spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cwd: expect.not.stringMatching(defaultRequest.cwd),
        })
      );
    });

    it('should fallback to home directory if requested cwd is invalid', () => {
      vi.mocked(fs.statSync).mockImplementation((path) => {
        if (path === defaultRequest.cwd) {
          throw new Error('Invalid');
        }
        return { isDirectory: () => true } as any;
      });

      const home = '/users/home';
      spawner.spawnTerminal({ ...defaultRequest, env: { HOME: home } });

      expect(pty.spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cwd: home,
        })
      );
    });

    it('should throw error if all attempts fail', () => {
      vi.mocked(pty.spawn).mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      expect(() => spawner.spawnTerminal(defaultRequest)).toThrow('Spawn failed');
    });

    it('should filter duplicate shells in candidates', () => {
      // Mock process.cwd to match defaultRequest.cwd so we only have 1 candidate CWD
      const originalCwd = process.cwd;
      // @ts-ignore
      process.cwd = vi.fn().mockReturnValue(defaultRequest.cwd);

      // If requested shell is same as fallback, shouldn't try twice
      const request = { ...defaultRequest, shell: '/bin/bash' }; // bash is also a fallback
      
      vi.mocked(pty.spawn).mockImplementation(() => {
        throw new Error('Fail');
      });

      try {
        spawner.spawnTerminal(request);
      } catch (e) {
        // Ignore error
      }

      const calls = vi.mocked(pty.spawn).mock.calls;
      const shellsTried = calls.map(c => c[0]);
      const bashCount = shellsTried.filter(s => s === '/bin/bash').length;
      expect(bashCount).toBe(1);

      // Restore
      process.cwd = originalCwd;
    });

    it('should include process.cwd in candidates if valid', () => {
      const originalCwd = process.cwd;
      const mockCwd = '/process/cwd';
      
      // @ts-ignore
      process.cwd = vi.fn().mockReturnValue(mockCwd);

      // Make requested cwd invalid
      vi.mocked(fs.statSync).mockImplementation((path) => {
        if (path === defaultRequest.cwd) {
          throw new Error('Invalid');
        }
        if (path === mockCwd) {
          return { isDirectory: () => true } as any;
        }
        return { isDirectory: () => true } as any;
      });

      spawner.spawnTerminal(defaultRequest);

      expect(pty.spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cwd: mockCwd,
        })
      );

      // Restore
      process.cwd = originalCwd;
    });
  });
});
