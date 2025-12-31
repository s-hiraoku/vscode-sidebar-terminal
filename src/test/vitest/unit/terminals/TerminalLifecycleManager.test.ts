
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalLifecycleManager } from '../../../../terminals/TerminalLifecycleManager';
import { TerminalInstance, ProcessState } from '../../../../types/shared';
import { ERROR_MESSAGES } from '../../../../constants';

// Mock vscode
vi.mock('vscode', () => ({
  default: {},
  EventEmitter: vi.fn().mockImplementation(() => ({
    fire: vi.fn(),
    event: vi.fn(),
    dispose: vi.fn(),
  })),
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' }, name: 'TestProject' }]
  }
}));

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

// Mock common utils
vi.mock('../../../../utils/common', () => ({
  getTerminalConfig: vi.fn().mockReturnValue({ maxTerminals: 5, shellArgs: [] }),
  getShellForPlatform: vi.fn().mockReturnValue('/bin/bash'),
  getWorkingDirectory: vi.fn().mockReturnValue('/home/user'),
  generateTerminalId: vi.fn().mockReturnValue('terminal-123'),
  generateTerminalName: vi.fn().mockReturnValue('Terminal 1'),
  showErrorMessage: vi.fn(),
  showWarningMessage: vi.fn(),
}));

describe('TerminalLifecycleManager', () => {
  let manager: TerminalLifecycleManager;
  let mockTerminals: Map<string, TerminalInstance>;
  let mockTerminalNumberManager: any;
  let mockProfileService: any;
  let mockTerminalSpawner: any;
  let mockCliAgentService: any;
  let mockTerminalCreatedEmitter: any;
  let mockTerminalRemovedEmitter: any;
  let mockExitEmitter: any;
  let mockSetupEventsCallback: any;
  let mockNotifyStateUpdateCallback: any;
  let mockCleanupTerminalDataCallback: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTerminals = new Map();
    
    mockTerminalNumberManager = {
      canCreate: vi.fn().mockReturnValue(true),
      findAvailableNumber: vi.fn().mockReturnValue(1),
    };

    mockProfileService = {
      resolveProfile: vi.fn().mockResolvedValue({
        profile: { path: '/bin/zsh', args: [], cwd: '/custom/cwd' },
        profileName: 'Default',
        source: 'default'
      }),
      getAvailableProfiles: vi.fn().mockResolvedValue({}),
      getDefaultProfile: vi.fn().mockReturnValue('Default')
    };

    mockTerminalSpawner = {
      spawnTerminal: vi.fn().mockReturnValue({
        ptyProcess: {
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(),
          on: vi.fn()
        }
      })
    };

    mockCliAgentService = {
      handleTerminalRemoved: vi.fn()
    };

    mockTerminalCreatedEmitter = { fire: vi.fn() };
    mockTerminalRemovedEmitter = { fire: vi.fn() };
    mockExitEmitter = { fire: vi.fn() };
    mockSetupEventsCallback = vi.fn();
    mockNotifyStateUpdateCallback = vi.fn();
    mockCleanupTerminalDataCallback = vi.fn();

    manager = new TerminalLifecycleManager(
      mockTerminals,
      mockTerminalNumberManager,
      mockProfileService,
      mockTerminalSpawner,
      mockCliAgentService,
      mockTerminalCreatedEmitter,
      mockTerminalRemovedEmitter,
      mockExitEmitter,
      mockSetupEventsCallback,
      mockNotifyStateUpdateCallback,
      mockCleanupTerminalDataCallback
    );
  });

  describe('createTerminal', () => {
    it('should successfully create a terminal', () => {
      const terminalId = manager.createTerminal();

      expect(terminalId).toBe('terminal-123');
      expect(mockTerminals.size).toBe(1);
      expect(mockTerminals.get('terminal-123')).toBeDefined();
      expect(mockTerminalSpawner.spawnTerminal).toHaveBeenCalled();
      expect(mockTerminalCreatedEmitter.fire).toHaveBeenCalled();
      expect(mockNotifyStateUpdateCallback).toHaveBeenCalled();
    });

    it('should fail if max terminals reached', () => {
      mockTerminalNumberManager.canCreate.mockReturnValue(false);
      // Add a dummy terminal to avoid "CRITICAL BUG: No terminals exist" failsafe
      mockTerminals.set('existing', {} as any);

      const terminalId = manager.createTerminal();

      expect(terminalId).toBe('');
      expect(mockTerminals.size).toBe(1); // Should remain 1
      expect(mockTerminalSpawner.spawnTerminal).not.toHaveBeenCalled();
    });

    it('should handle errors during creation', () => {
      mockTerminalSpawner.spawnTerminal.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      expect(() => manager.createTerminal()).toThrow('Spawn failed');
      expect(mockTerminals.size).toBe(0);
    });
  });

  describe('createTerminalWithProfile', () => {
    it('should create terminal using profile', async () => {
      const terminalId = await manager.createTerminalWithProfile('MyProfile');

      expect(terminalId).toBe('terminal-123');
      expect(mockProfileService.resolveProfile).toHaveBeenCalledWith('MyProfile');
      expect(mockTerminalSpawner.spawnTerminal).toHaveBeenCalledWith(expect.objectContaining({
        shell: '/bin/zsh',
        cwd: '/custom/cwd'
      }));
    });

    it('should fail if max terminals reached', async () => {
      mockTerminalNumberManager.canCreate.mockReturnValue(false);

      const terminalId = await manager.createTerminalWithProfile();

      expect(terminalId).toBe('');
      expect(mockTerminalSpawner.spawnTerminal).not.toHaveBeenCalled();
    });
  });

  describe('deleteTerminal', () => {
    it('should delete a terminal successfully', async () => {
      // Setup existing terminal
      const terminal: TerminalInstance = {
        id: 'term-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        ptyProcess: { kill: vi.fn() },
        createdAt: new Date()
      } as any;
      mockTerminals.set('term-1', terminal);
      
      // Need at least 2 terminals to delete one (unless force?)
      // The code says: if (this._terminals.size <= 1) return { canDelete: false ... }
      // So we need another terminal
      mockTerminals.set('term-2', { ...terminal, id: 'term-2' } as any);

      const result = await manager.deleteTerminal('term-1');

      expect(result.success).toBe(true);
      expect(terminal.ptyProcess?.kill).toHaveBeenCalled();
      // Note: Actual removal from map happens in onExit handler which is mocked/not triggered here
      // But performDeleteOperation calls kill() and returns success
    });

    it('should prevent deleting the last terminal', async () => {
      const terminal: TerminalInstance = {
        id: 'term-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date()
      } as any;
      mockTerminals.set('term-1', terminal);

      const result = await manager.deleteTerminal('term-1');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Must keep at least 1 terminal');
    });

    it('should fail if terminal not found', async () => {
      // Add one terminal so check passes
      mockTerminals.set('term-1', {} as any);
      mockTerminals.set('term-2', {} as any);

      const result = await manager.deleteTerminal('non-existent');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Terminal not found');
    });

    it('should force delete even if last terminal?', async () => {
      // The code in TerminalLifecycleManager.performDeleteOperation:
      // const validation = this.validateDeletion(terminalId);
      // if (!validation.canDelete) { ... return ... }
      // 
      // validateDeletion checks size <= 1.
      // 
      // So even with force=true, it seems it prevents deleting the last terminal?
      // Let's verify expectations.
      // "ALWAYS validate to enforce minimum 1 terminal rule" comment exists.
      
      const terminal: TerminalInstance = {
        id: 'term-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        ptyProcess: { kill: vi.fn() },
        createdAt: new Date()
      } as any;
      mockTerminals.set('term-1', terminal);

      const result = await manager.deleteTerminal('term-1', { force: true });

      expect(result.success).toBe(false); // Expect failure
    });
  });

  describe('canRemoveTerminal', () => {
    it('should return true if multiple terminals exist', () => {
      mockTerminals.set('t1', {} as any);
      mockTerminals.set('t2', {} as any);

      const result = manager.canRemoveTerminal('t1');
      expect(result.canRemove).toBe(true);
    });

    it('should return false if only one terminal exists', () => {
      mockTerminals.set('t1', {} as any);

      const result = manager.canRemoveTerminal('t1');
      expect(result.canRemove).toBe(false);
    });
  });

  describe('removeTerminal', () => {
    it('should kill process and call cleanup callback', () => {
      const killMock = vi.fn();
      const terminal: TerminalInstance = {
        id: 't1',
        ptyProcess: { kill: killMock }
      } as any;
      mockTerminals.set('t1', terminal);

      manager.removeTerminal('t1');

      expect(killMock).toHaveBeenCalled();
      expect(mockCleanupTerminalDataCallback).toHaveBeenCalledWith('t1');
    });
  });
});
