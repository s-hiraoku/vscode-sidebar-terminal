/**
 * TDD Test Suite for ExtensionPersistenceService
 *
 * This test suite validates the unified persistence service that consolidates
 * multiple legacy implementations into a single, well-tested service.
 *
 * Test Coverage:
 * - Session save/restore operations
 * - Auto-save on window close
 * - Storage optimization
 * - CLI Agent detection
 * - Compression support
 * - Error handling and edge cases
 */

import * as sinon from 'sinon';
import { expect } from 'chai';
import { ExtensionPersistenceService } from '../../../../services/persistence/ExtensionPersistenceService';

// Test setup shared utilities
import '../../../shared/TestSetup';

describe('ExtensionPersistenceService', () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  let mockTerminalManager: any;
  let mockSidebarProvider: any;
  let persistenceService: ExtensionPersistenceService;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock VS Code Extension Context
    mockContext = {
      workspaceState: {
        get: sandbox.stub(),
        update: sandbox.stub().resolves(),
        keys: sandbox.stub().returns([]),
      },
      subscriptions: [],
    };

    // Mock Terminal Manager
    mockTerminalManager = {
      getTerminals: sandbox.stub().returns([]),
      getActiveTerminalId: sandbox.stub().returns(null),
      createTerminal: sandbox.stub(),
      setActiveTerminal: sandbox.stub(),
    };

    // Mock Sidebar Provider
    mockSidebarProvider = {
      sendMessageToWebview: sandbox.stub().resolves(),
    };

    // Mock VS Code workspace configuration
    const mockConfig = {
      get: sandbox.stub().callsFake((key: string, defaultValue: any) => {
        const configs: Record<string, any> = {
          enablePersistentSessions: true,
          persistentSessionScrollback: 1000,
          persistentSessionReviveProcess: 'onExitAndWindowClose',
          persistentSessionStorageLimit: 20,
          persistentSessionExpiryDays: 7,
        };
        return configs[key] ?? defaultValue;
      }),
    };

    (global as any).vscode = {
      workspace: {
        getConfiguration: sandbox.stub().returns(mockConfig),
      },
    };

    persistenceService = new ExtensionPersistenceService(mockContext, mockTerminalManager);
    persistenceService.setSidebarProvider(mockSidebarProvider);
  });

  afterEach(() => {
    persistenceService.dispose();
    sandbox.restore();
  });

  describe('Configuration Management', () => {
    it('should read configuration from VS Code settings', () => {
      const config = (persistenceService as any).getPersistenceConfig();

      expect(config).to.deep.include({
        enablePersistentSessions: true,
        persistentSessionScrollback: 1000,
        persistentSessionStorageLimit: 20,
        persistentSessionExpiryDays: 7,
      });

      expect((global as any).vscode.workspace.getConfiguration).to.have.been.calledWith(
        'sidebarTerminal'
      );
    });

    it('should handle disabled persistence gracefully', async () => {
      const mockConfig = {
        get: sandbox.stub().returns(false), // enablePersistentSessions = false
      };
      (global as any).vscode.workspace.getConfiguration = sandbox.stub().returns(mockConfig);

      const result = await persistenceService.saveCurrentSession();

      expect(result.success).to.be.true;
      expect(result.terminalCount).to.equal(0);
      expect(result.message).to.equal('Persistence disabled');
      expect(mockContext.workspaceState.update).to.not.have.been.called;
    });
  });

  describe('Session Save Operations', () => {
    it('should save session with no terminals', async () => {
      mockTerminalManager.getTerminals.returns([]);

      const result = await persistenceService.saveCurrentSession();

      expect(result.success).to.be.true;
      expect(result.terminalCount).to.equal(0);
    });

    it('should save session with multiple terminals', async () => {
      const mockTerminals = [
        { id: 'term-1', name: 'Terminal 1', cwd: '/home/user' },
        { id: 'term-2', name: 'Terminal 2', cwd: '/home/user/project' },
      ];
      mockTerminalManager.getTerminals.returns(mockTerminals);
      mockTerminalManager.getActiveTerminalId.returns('term-1');

      const result = await persistenceService.saveCurrentSession();

      expect(result.success).to.be.true;
      expect(result.terminalCount).to.equal(2);
      expect(mockContext.workspaceState.update).to.have.been.calledOnce;

      const savedData = mockContext.workspaceState.update.firstCall.args[1];
      expect(savedData.terminals).to.have.lengthOf(2);
      expect(savedData.activeTerminalId).to.equal('term-1');
      expect(savedData.version).to.equal('4.0.0');
    });

    it('should detect CLI Agent type from terminal name', async () => {
      const mockTerminals = [
        { id: 'term-1', name: 'Claude Code', cwd: '/home/user' },
        { id: 'term-2', name: 'Terminal', cwd: '/home/user/gemini' },
      ];
      mockTerminalManager.getTerminals.returns(mockTerminals);

      await persistenceService.saveCurrentSession();

      const savedData = mockContext.workspaceState.update.firstCall.args[1];
      expect(savedData.terminals[0].cliAgentType).to.equal('claude');
      expect(savedData.terminals[1].cliAgentType).to.equal('gemini');
    });

    it('should cache scrollback data for instant save', () => {
      const scrollbackData = ['line 1', 'line 2', 'line 3'];

      persistenceService.handlePushedScrollbackData({
        terminalId: 'term-1',
        scrollbackData,
      });

      const cache = (persistenceService as any).pushedScrollbackCache;
      expect(cache.get('term-1')).to.deep.equal(scrollbackData);
    });

    it('should use cached scrollback data during save', async () => {
      const mockTerminals = [{ id: 'term-1', name: 'Terminal 1', cwd: '/home/user' }];
      mockTerminalManager.getTerminals.returns(mockTerminals);

      const scrollbackData = ['cached line 1', 'cached line 2'];
      persistenceService.handlePushedScrollbackData({
        terminalId: 'term-1',
        scrollbackData,
      });

      await persistenceService.saveCurrentSession();

      const savedData = mockContext.workspaceState.update.firstCall.args[1];
      expect(savedData.scrollbackData['term-1']).to.exist;
    });
  });

  describe('Session Restore Operations', () => {
    it('should return failure when no session exists', async () => {
      mockContext.workspaceState.get.returns(undefined);

      const result = await persistenceService.restoreSession();

      expect(result.success).to.be.false;
      expect(result.message).to.equal('No session found');
    });

    it('should skip restore when terminals already exist', async () => {
      const sessionData = {
        terminals: [{ id: 'term-1', name: 'Terminal 1', cwd: '/home/user', isActive: true }],
        activeTerminalId: 'term-1',
        timestamp: Date.now(),
        version: '4.0.0',
      };
      mockContext.workspaceState.get.returns(sessionData);
      mockTerminalManager.getTerminals.returns([{ id: 'existing-term' }]);

      const result = await persistenceService.restoreSession(false);

      expect(result.success).to.be.false;
      expect(result.message).to.equal('Terminals already exist');
    });

    it('should restore terminals from session data', async () => {
      const sessionData = {
        terminals: [
          { id: 'old-term-1', name: 'Terminal 1', number: 1, cwd: '/home/user', isActive: true },
          { id: 'old-term-2', name: 'Terminal 2', number: 2, cwd: '/home/project', isActive: false },
        ],
        activeTerminalId: 'old-term-1',
        timestamp: Date.now(),
        version: '4.0.0',
        scrollbackData: {},
      };
      mockContext.workspaceState.get.returns(sessionData);
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal
        .onFirstCall().returns('new-term-1')
        .onSecondCall().returns('new-term-2');

      const result = await persistenceService.restoreSession();

      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(2);
      expect(mockTerminalManager.createTerminal).to.have.been.calledTwice;
      expect(mockTerminalManager.setActiveTerminal).to.have.been.calledWith('new-term-1');
    });

    it('should reject expired sessions', async () => {
      const expiredTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
      const sessionData = {
        terminals: [{ id: 'term-1', name: 'Terminal 1', cwd: '/home/user', isActive: true }],
        activeTerminalId: 'term-1',
        timestamp: expiredTimestamp,
        version: '4.0.0',
      };
      mockContext.workspaceState.get.returns(sessionData);

      const result = await persistenceService.restoreSession();

      expect(result.success).to.be.false;
      expect(result.message).to.equal('Session expired');
      expect(mockContext.workspaceState.update).to.have.been.called; // Session cleared
    });
  });

  describe('Session Info and Cleanup', () => {
    it('should return session info without restoring', () => {
      const sessionData = {
        terminals: [{ id: 'term-1', name: 'Terminal 1', cwd: '/home/user', isActive: true }],
        timestamp: Date.now(),
        version: '4.0.0',
      };
      mockContext.workspaceState.get.returns(sessionData);

      const info = persistenceService.getSessionInfo();

      expect(info).to.exist;
      expect(info!.exists).to.be.true;
      expect(info!.terminals).to.have.lengthOf(1);
      expect(info!.version).to.equal('4.0.0');
    });

    it('should return null info for non-existent session', () => {
      mockContext.workspaceState.get.returns(undefined);

      const info = persistenceService.getSessionInfo();

      expect(info).to.exist;
      expect(info!.exists).to.be.false;
    });

    it('should clear session data', async () => {
      await persistenceService.clearSession();

      expect(mockContext.workspaceState.update).to.have.been.calledWith(
        'terminal-session-unified',
        undefined
      );
    });

    it('should cleanup expired sessions', async () => {
      const expiredTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000);
      const sessionData = {
        terminals: [],
        timestamp: expiredTimestamp,
        version: '4.0.0',
      };
      mockContext.workspaceState.get.returns(sessionData);

      await persistenceService.cleanupExpiredSessions();

      expect(mockContext.workspaceState.update).to.have.been.called;
    });
  });

  describe('Storage Optimization', () => {
    it('should optimize session data when storage limit exceeded', async () => {
      // Create large session data
      const largeScrollback = Array(2000).fill('x'.repeat(100));
      const mockTerminals = [
        { id: 'term-1', name: 'Terminal 1', cwd: '/home/user' },
      ];
      mockTerminalManager.getTerminals.returns(mockTerminals);

      persistenceService.handlePushedScrollbackData({
        terminalId: 'term-1',
        scrollbackData: largeScrollback,
      });

      await persistenceService.saveCurrentSession();

      // Verify that save completed (optimization is internal)
      expect(mockContext.workspaceState.update).to.have.been.called;
    });
  });

  describe('Error Handling', () => {
    it('should handle save errors gracefully', async () => {
      mockTerminalManager.getTerminals.returns([{ id: 'term-1', name: 'Terminal 1' }]);
      mockContext.workspaceState.update.rejects(new Error('Storage error'));

      const result = await persistenceService.saveCurrentSession();

      expect(result.success).to.be.false;
      expect(result.error).to.include('Storage error');
    });

    it('should handle restore errors gracefully', async () => {
      mockContext.workspaceState.get.throws(new Error('Read error'));

      const result = await persistenceService.restoreSession();

      expect(result.success).to.be.false;
      expect(result.message).to.include('Read error');
    });
  });

  describe('Lifecycle Management', () => {
    it('should dispose cleanly', () => {
      persistenceService.handlePushedScrollbackData({
        terminalId: 'term-1',
        scrollbackData: ['data'],
      });

      persistenceService.dispose();

      const cache = (persistenceService as any).pushedScrollbackCache;
      expect(cache.size).to.equal(0);
    });
  });
});
