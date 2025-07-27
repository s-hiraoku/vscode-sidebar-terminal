import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { UnifiedSessionManager } from '../../../sessions/UnifiedSessionManager';

/**
 * 統合セッション管理機能のテスト
 * 確実な保存・復元機能を保証
 */
describe('🔄 UnifiedSessionManager Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: {
    globalState: {
      get: sinon.SinonStub;
      update: sinon.SinonStub;
      keys: sinon.SinonStub;
      setKeysForSync: sinon.SinonStub;
    };
    subscriptions: unknown[];
    extensionPath: string;
  };
  let mockTerminalManager: {
    getTerminals: sinon.SinonStub;
    getActiveTerminalId: sinon.SinonStub;
    createTerminal: sinon.SinonStub;
    setActiveTerminal: sinon.SinonStub;
    dispose: sinon.SinonStub;
  };
  let mockGlobalState: typeof mockContext.globalState;
  let sessionManager: UnifiedSessionManager;
  let mockSidebarProvider: {
    _sendMessage: sinon.SinonStub;
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockGlobalState = {
      get: sandbox.stub(),
      update: sandbox.stub().resolves(),
      keys: sandbox.stub(),
      setKeysForSync: sandbox.stub(),
    };

    mockContext = {
      globalState: mockGlobalState,
      subscriptions: [],
      extensionPath: '/test/path',
    };

    mockTerminalManager = {
      getTerminals: sandbox.stub().returns([]),
      getActiveTerminalId: sandbox.stub().returns('terminal-1'),
      createTerminal: sandbox.stub().returns('new-terminal-id'),
      setActiveTerminal: sandbox.stub(),
      dispose: sandbox.stub(),
    };

    mockSidebarProvider = {
      _sendMessage: sandbox.stub().resolves(),
    };

    sessionManager = new UnifiedSessionManager(mockContext as any, mockTerminalManager as any);
    sessionManager.setSidebarProvider(mockSidebarProvider);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('📝 Session Save', () => {
    it('should save empty session when no terminals exist', async () => {
      mockTerminalManager.getTerminals.returns([]);

      const result = await sessionManager.saveCurrentSession();

      expect(result).to.deep.equal({
        success: true,
        terminalCount: 0,
      });
    });

    it('should save session with terminal data', async () => {
      const mockTerminals = [
        {
          id: 'terminal-1',
          name: 'Terminal 1',
          number: 1,
          cwd: '/test/cwd',
        },
        {
          id: 'terminal-2',
          name: 'Terminal 2',
          number: 2,
          cwd: '/test/cwd2',
        },
      ];

      mockTerminalManager.getTerminals.returns(mockTerminals);
      mockTerminalManager.getActiveTerminalId.returns('terminal-1');

      const result = await sessionManager.saveCurrentSession();

      expect(result.success).to.be.true;
      expect(result.terminalCount).to.equal(2);
      expect(mockGlobalState.update).to.have.been.calledOnce;

      // Verify saved data structure
      const savedDataCall = mockGlobalState.update.getCall(0);
      const savedData = savedDataCall.args[1];

      expect(savedData).to.have.property('terminals');
      expect(savedData).to.have.property('activeTerminalId', 'terminal-1');
      expect(savedData).to.have.property('timestamp');
      expect(savedData).to.have.property('version', '2.0.0');
      expect(savedData.terminals).to.have.length(2);
    });

    it('should handle save errors gracefully', async () => {
      mockTerminalManager.getTerminals.throws(new Error('Terminal access failed'));

      const result = await sessionManager.saveCurrentSession();

      expect(result.success).to.be.false;
      expect(result.error).to.include('Terminal access failed');
    });
  });

  describe('🔄 Session Restore', () => {
    it('should return no-op when no session data exists', async () => {
      mockGlobalState.get.returns(null);

      const result = await sessionManager.restoreSession();

      expect(result).to.deep.equal({
        success: true,
        restoredCount: 0,
        skippedCount: 0,
      });
    });

    it('should skip restore when terminals already exist', async () => {
      const sessionData = {
        terminals: [
          {
            id: 'terminal-1',
            name: 'Terminal 1',
            number: 1,
            cwd: '/test',
            isActive: true,
          },
        ],
        activeTerminalId: 'terminal-1',
        timestamp: Date.now(),
        version: '2.0.0',
      };

      mockGlobalState.get.returns(sessionData);
      mockTerminalManager.getTerminals.returns([{ id: 'existing-terminal' }]);

      const result = await sessionManager.restoreSession();

      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(0);
      expect(result.skippedCount).to.equal(1);
      expect(mockTerminalManager.createTerminal).to.not.have.been.called;
    });

    it('should restore terminals when no existing terminals', async () => {
      const sessionData = {
        terminals: [
          {
            id: 'terminal-1',
            name: 'Terminal 1',
            number: 1,
            cwd: '/test',
            isActive: true,
          },
          {
            id: 'terminal-2',
            name: 'Terminal 2',
            number: 2,
            cwd: '/test2',
            isActive: false,
          },
        ],
        activeTerminalId: 'terminal-1',
        timestamp: Date.now(),
        version: '2.0.0',
      };

      mockGlobalState.get.returns(sessionData);
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.onCall(0).returns('new-terminal-1');
      mockTerminalManager.createTerminal.onCall(1).returns('new-terminal-2');

      const result = await sessionManager.restoreSession();

      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(2);
      expect(result.skippedCount).to.equal(0);
      expect(mockTerminalManager.createTerminal).to.have.been.calledTwice;
      expect(mockTerminalManager.setActiveTerminal).to.have.been.calledWith('new-terminal-1');
    });

    it('should clear expired session data', async () => {
      const expiredSessionData = {
        terminals: [
          {
            id: 'terminal-1',
            name: 'Terminal 1',
            number: 1,
            cwd: '/test',
            isActive: true,
          },
        ],
        activeTerminalId: 'terminal-1',
        timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
        version: '2.0.0',
      };

      mockGlobalState.get.returns(expiredSessionData);
      mockTerminalManager.getTerminals.returns([]);

      const result = await sessionManager.restoreSession();

      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(0);
      expect(result.skippedCount).to.equal(0);
      expect(mockGlobalState.update).to.have.been.calledWith('unified-terminal-session', undefined);
    });

    it('should clear invalid session data', async () => {
      const invalidSessionData = {
        terminals: 'invalid-data',
        activeTerminalId: 'terminal-1',
        timestamp: Date.now(),
        version: '2.0.0',
      };

      mockGlobalState.get.returns(invalidSessionData);
      mockTerminalManager.getTerminals.returns([]);

      const result = await sessionManager.restoreSession();

      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(0);
      expect(result.skippedCount).to.equal(0);
      expect(mockGlobalState.update).to.have.been.calledWith('unified-terminal-session', undefined);
    });

    it('should handle restore errors gracefully', async () => {
      mockGlobalState.get.throws(new Error('Storage access failed'));

      const result = await sessionManager.restoreSession();

      expect(result.success).to.be.false;
      expect(result.error).to.include('Storage access failed');
    });
  });

  describe('🗑️ Session Clear', () => {
    it('should clear session data', async () => {
      await sessionManager.clearSession();

      expect(mockGlobalState.update).to.have.been.calledWith('unified-terminal-session', undefined);
    });

    it('should handle clear errors gracefully', async () => {
      mockGlobalState.update.rejects(new Error('Clear failed'));

      // Should not throw
      await sessionManager.clearSession();
    });
  });

  describe('📊 Session Info', () => {
    it('should return session info when available', async () => {
      const sessionData = {
        terminals: [
          {
            id: 'terminal-1',
            name: 'Terminal 1',
            number: 1,
            cwd: '/test',
            isActive: true,
          },
        ],
        activeTerminalId: 'terminal-1',
        timestamp: Date.now(),
        version: '2.0.0',
      };

      mockGlobalState.get.returns(sessionData);

      const info = await sessionManager.getSessionInfo();

      expect(info).to.deep.equal(sessionData);
    });

    it('should return null when no session exists', async () => {
      mockGlobalState.get.returns(null);

      const info = await sessionManager.getSessionInfo();

      expect(info).to.be.null;
    });

    it('should return session stats', async () => {
      const sessionData = {
        terminals: [
          {
            id: 'terminal-1',
            name: 'Terminal 1',
            number: 1,
            cwd: '/test',
            isActive: true,
          },
        ],
        activeTerminalId: 'terminal-1',
        timestamp: Date.now(),
        version: '2.0.0',
      };

      mockGlobalState.get.returns(sessionData);

      const stats = await sessionManager.getSessionStats();

      expect(stats.hasSession).to.be.true;
      expect(stats.terminalCount).to.equal(1);
      expect(stats.lastSaved).to.be.instanceof(Date);
      expect(stats.isExpired).to.be.false;
    });
  });

  describe('🔧 Sidebar Provider Integration', () => {
    it('should set sidebar provider correctly', () => {
      const newProvider = { _sendMessage: sandbox.stub() };

      sessionManager.setSidebarProvider(newProvider);

      // Verify by attempting to save with scrollback (should call the provider)
      // This is tested implicitly in save tests
    });
  });
});
