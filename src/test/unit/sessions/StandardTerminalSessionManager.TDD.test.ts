/**
 * TDD Test Suite for StandardTerminalSessionManager following t-wada methodology
 *
 * This test suite implements rigorous Test-Driven Development practices:
 * 1. RED: Write failing tests that specify behavior precisely
 * 2. GREEN: Implement minimal code to make tests pass
 * 3. REFACTOR: Improve code quality while keeping tests green
 *
 * Focus Areas:
 * - Session persistence with scrollback data
 * - Terminal restoration async operations
 * - WebView communication error handling
 * - Configuration-driven behavior
 * - Memory and resource management
 */

import * as sinon from 'sinon';
import { expect } from 'chai';
import { StandardTerminalSessionManager } from '../../../sessions/StandardTerminalSessionManager';

// Test setup shared utilities
import '../../shared/TestSetup';

describe('StandardTerminalSessionManager - TDD Complete Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  let mockTerminalManager: any;
  let mockSidebarProvider: any;
  let sessionManager: StandardTerminalSessionManager;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock VS Code Extension Context
    mockContext = {
      globalState: {
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
      deleteTerminal: sandbox.stub(),
      setActiveTerminal: sandbox.stub(),
    };

    // Mock Sidebar Provider
    mockSidebarProvider = {
      _sendMessage: sandbox.stub().resolves(),
      sendMessageToWebview: sandbox.stub().resolves(),
    };

    // Mock VS Code workspace configuration
    const mockConfig = {
      get: sandbox.stub().callsFake((key: string, defaultValue: any) => {
        const configs: Record<string, any> = {
          enablePersistentSessions: true,
          persistentSessionScrollback: 100,
          persistentSessionReviveProcess: 'onExitAndWindowClose',
        };
        return configs[key] ?? defaultValue;
      }),
    };

    (global as any).vscode = {
      workspace: {
        getConfiguration: sandbox.stub().returns(mockConfig),
      },
    };

    sessionManager = new StandardTerminalSessionManager(mockContext, mockTerminalManager);
    sessionManager.setSidebarProvider(mockSidebarProvider);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('RED Phase: Configuration Management (Behavior Specification)', () => {
    it('should respect VS Code terminal persistence configuration', () => {
      // RED: Test that configuration is read correctly
      const config = (sessionManager as any).getTerminalPersistenceConfig();

      expect(config).to.deep.equal({
        enablePersistentSessions: true,
        persistentSessionScrollback: 100,
        persistentSessionReviveProcess: 'onExitAndWindowClose',
      });

      // Verify correct configuration namespace is used
      expect((global as any).vscode.workspace.getConfiguration).to.have.been.calledWith('secondaryTerminal');
    });

    it('should handle disabled persistence gracefully', async () => {
      // RED: When persistence is disabled, save should succeed but do nothing
      const mockConfig = {
        get: sandbox.stub().callsFake((key: string, defaultValue: any) => {
          if (key === 'enablePersistentSessions') return false;
          return defaultValue;
        }),
      };
      (global as any).vscode.workspace.getConfiguration = sandbox.stub().returns(mockConfig);

      const result = await sessionManager.saveCurrentSession();

      expect(result).to.deep.equal({
        success: true,
        terminalCount: 0,
      });
      expect(mockContext.globalState.update).not.to.have.been.called;
    });
  });

  describe('GREEN Phase: Session Save Operations (Core Functionality)', () => {
    it('should save basic terminal information to VS Code globalState', async () => {
      // GREEN: Test successful save operation
      const mockTerminals = [
        {
          id: 'term-1',
          name: 'Terminal 1',
          number: 1,
          cwd: '/project/path',
        },
        {
          id: 'term-2',
          name: 'Terminal 2',
          number: 2,
          cwd: '/another/path',
        },
      ];

      mockTerminalManager.getTerminals.returns(mockTerminals);
      mockTerminalManager.getActiveTerminalId.returns('term-1');

      // Mock scrollback data response
      const mockScrollbackData = {
        'term-1': 'echo "Hello World"\\r\\nHello World\\r\\n$ ',
        'term-2': 'git status\\r\\nOn branch main\\r\\n$ ',
      };

      // Set up Promise-based scrollback response
      const scrollbackPromise = Promise.resolve(mockScrollbackData);
      sandbox.stub(sessionManager as any, 'requestScrollbackDataFromWebView').returns(scrollbackPromise);

      const result = await sessionManager.saveCurrentSession();

      expect(result.success).to.be.true;
      expect(result.terminalCount).to.equal(2);

      // Verify globalState was updated with correct structure
      expect(mockContext.globalState.update).to.have.been.calledWith(
        'standard-terminal-session-v3',
        sinon.match({
          terminals: sinon.match.array,
          activeTerminalId: 'term-1',
          timestamp: sinon.match.number,
          version: '3.0.0',
          scrollbackData: mockScrollbackData,
        })
      );
    });

    it('should handle empty terminal list gracefully', async () => {
      // GREEN: No terminals should still succeed
      mockTerminalManager.getTerminals.returns([]);

      const result = await sessionManager.saveCurrentSession();

      expect(result).to.deep.equal({
        success: true,
        terminalCount: 0,
      });
    });

    it('should handle scrollback data request timeout with fallback', async () => {
      // GREEN: Test timeout handling in scrollback requests
      const mockTerminals = [
        { id: 'term-1', name: 'Terminal 1', number: 1, cwd: '/test' },
      ];

      mockTerminalManager.getTerminals.returns(mockTerminals);

      // Mock timeout scenario
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve({}), 100);
      });
      sandbox.stub(sessionManager as any, 'requestScrollbackDataFromWebView').returns(timeoutPromise);

      const result = await sessionManager.saveCurrentSession();

      expect(result.success).to.be.true;
      expect(result.terminalCount).to.equal(1);
    });
  });

  describe('GREEN Phase: Session Restoration (Critical Path)', () => {
    it('should restore terminals with complete scrollback data', async () => {
      // GREEN: Test full restoration cycle
      const savedSessionData = {
        terminals: [
          {
            id: 'original-term-1',
            name: 'Terminal 1',
            number: 1,
            cwd: '/project',
            isActive: true,
          },
          {
            id: 'original-term-2',
            name: 'Terminal 2',
            number: 2,
            cwd: '/other',
            isActive: false,
          },
        ],
        activeTerminalId: 'original-term-1',
        timestamp: Date.now(),
        version: '3.0.0',
        scrollbackData: {
          'original-term-1': 'claude-code "implement feature"\\r\\nImplementing...\\r\\n$ ',
          'original-term-2': 'npm test\\r\\nTests passed\\r\\n$ ',
        },
      };

      mockContext.globalState.get
        .withArgs('standard-terminal-session-v3')
        .returns(savedSessionData);

      // Mock terminal creation
      mockTerminalManager.createTerminal
        .onFirstCall().returns('new-term-1')
        .onSecondCall().returns('new-term-2');

      // Mock restoration request
      sandbox.stub(sessionManager as any, 'requestScrollbackRestoration').resolves();

      const result = await sessionManager.restoreSession();

      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(2);
      expect(result.skippedCount).to.equal(0);

      // Verify terminals were created
      expect(mockTerminalManager.createTerminal).to.have.been.calledTwice;
      expect(mockTerminalManager.setActiveTerminal).to.have.been.calledWith('new-term-1');
    });

    it('should handle existing terminals with force restore', async () => {
      // GREEN: Test force restore functionality
      const existingTerminals = [
        { id: 'existing-1', name: 'Existing Terminal' },
      ];
      const savedSessionData = {
        terminals: [
          { id: 'saved-1', name: 'Saved Terminal', number: 1, cwd: '/test', isActive: true },
        ],
        activeTerminalId: 'saved-1',
        timestamp: Date.now(),
        version: '3.0.0',
        scrollbackData: {},
      };

      mockTerminalManager.getTerminals.returns(existingTerminals);
      mockContext.globalState.get.returns(savedSessionData);
      mockTerminalManager.deleteTerminal.resolves({ success: true });
      mockTerminalManager.createTerminal.returns('new-term-1');

      const result = await sessionManager.restoreSession(true);

      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(1);

      // Verify existing terminal was deleted
      expect(mockTerminalManager.deleteTerminal).to.have.been.calledWith(
        'existing-1',
        { force: true }
      );
    });

    it('should skip restoration when terminals already exist (without force)', async () => {
      // GREEN: Test skip logic for existing terminals
      const existingTerminals = [
        { id: 'existing-1', name: 'Existing Terminal' },
      ];
      const savedSessionData = {
        terminals: [
          { id: 'saved-1', name: 'Saved Terminal', number: 1, cwd: '/test', isActive: true },
        ],
        timestamp: Date.now(),
        version: '3.0.0',
      };

      mockTerminalManager.getTerminals.returns(existingTerminals);
      mockContext.globalState.get.returns(savedSessionData);

      const result = await sessionManager.restoreSession(false);

      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(0);
      expect(result.skippedCount).to.equal(1);

      // Verify no terminals were created or deleted
      expect(mockTerminalManager.createTerminal).not.to.have.been.called;
      expect(mockTerminalManager.deleteTerminal).not.to.have.been.called;
    });
  });

  describe('REFACTOR Phase: Session Expiration and Data Management', () => {
    it('should clear expired sessions automatically', async () => {
      // REFACTOR: Test session expiration logic
      const expiredSessionData = {
        terminals: [{ id: 'old-term', name: 'Old Terminal', number: 1, cwd: '/old', isActive: true }],
        timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days ago
        version: '3.0.0',
      };

      mockContext.globalState.get.returns(expiredSessionData);

      const result = await sessionManager.restoreSession();

      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(0);

      // Verify session was cleared
      expect(mockContext.globalState.update).to.have.been.calledWith(
        'standard-terminal-session-v3',
        undefined
      );
    });

    it('should provide accurate session statistics', () => {
      // REFACTOR: Test session stats functionality
      const sessionData = {
        terminals: [
          { id: 'term-1', name: 'Terminal 1', number: 1, cwd: '/test', isActive: true },
          { id: 'term-2', name: 'Terminal 2', number: 2, cwd: '/test2', isActive: false },
        ],
        timestamp: Date.now() - (1000 * 60 * 60), // 1 hour ago
        version: '3.0.0',
      };

      mockContext.globalState.get.returns({ exists: true, ...sessionData });

      const stats = sessionManager.getSessionStats();

      expect(stats.hasSession).to.be.true;
      expect(stats.terminalCount).to.equal(2);
      expect(stats.lastSaved).to.be.instanceOf(Date);
      expect(stats.isExpired).to.be.false;
      expect(stats.configEnabled).to.be.true;
    });

    it('should handle session stats when no session exists', () => {
      // REFACTOR: Test edge case handling
      mockContext.globalState.get.returns(null);

      const stats = sessionManager.getSessionStats();

      expect(stats.hasSession).to.be.false;
      expect(stats.terminalCount).to.equal(0);
      expect(stats.lastSaved).to.be.null;
      expect(stats.isExpired).to.be.false;
      expect(stats.configEnabled).to.be.true;
    });
  });

  describe('REFACTOR Phase: WebView Communication Resilience', () => {
    it('should handle WebView unavailability gracefully', async () => {
      // REFACTOR: Test communication error handling
      sessionManager.setSidebarProvider(null as any);

      const mockTerminals = [
        { id: 'term-1', name: 'Terminal 1', number: 1, cwd: '/test' },
      ];
      mockTerminalManager.getTerminals.returns(mockTerminals);

      const result = await sessionManager.saveCurrentSession();

      expect(result.success).to.be.true;
      expect(result.terminalCount).to.equal(1);
    });

    it('should handle serialization response properly', () => {
      // REFACTOR: Test response handling mechanism
      const testData = {
        'term-1': 'serialized-content-1',
        'term-2': 'serialized-content-2',
      };

      // Set up pending request simulation
      (sessionManager as any)._pendingScrollbackRequest = {
        requestId: 'test-request',
        handler: sandbox.stub(),
        timestamp: Date.now(),
      };

      sessionManager.handleSerializationResponse(testData);

      // Verify handler was called
      expect((sessionManager as any)._pendingScrollbackRequest.handler).to.have.been.calledWith(testData);
      expect((sessionManager as any)._pendingScrollbackRequest).to.be.undefined;
    });

    it('should send terminal restore info to WebView correctly', async () => {
      // REFACTOR: Test WebView communication patterns
      const sessionData = {
        terminals: [
          { id: 'term-1', name: 'Terminal 1', number: 1, cwd: '/test', isActive: true },
        ],
        activeTerminalId: 'term-1',
        version: '3.0.0',
        config: { scrollbackLines: 100, reviveProcess: 'onExitAndWindowClose' },
      };

      mockContext.globalState.get.returns(sessionData);

      await sessionManager.sendTerminalRestoreInfoToWebView();

      expect(mockSidebarProvider.sendMessageToWebview).to.have.been.calledWith(
        sinon.match({
          command: 'terminalRestoreInfo',
          terminals: sessionData.terminals,
          activeTerminalId: sessionData.activeTerminalId,
          config: sessionData.config,
          timestamp: sinon.match.number,
        })
      );
    });
  });

  describe('Error Handling and Edge Cases (Regression Prevention)', () => {
    it('should handle save operation failures gracefully', async () => {
      // Test error recovery
      mockTerminalManager.getTerminals.throws(new Error('Terminal access failed'));

      const result = await sessionManager.saveCurrentSession();

      expect(result.success).to.be.false;
      expect(result.terminalCount).to.equal(0);
      expect(result.error).to.include('Terminal access failed');
    });

    it('should handle restore operation failures gracefully', async () => {
      // Test restore error recovery
      mockContext.globalState.get.throws(new Error('Storage access failed'));

      const result = await sessionManager.restoreSession();

      expect(result.success).to.be.false;
      expect(result.restoredCount).to.equal(0);
      expect(result.error).to.include('Storage access failed');
    });

    it('should handle clear session failures gracefully', async () => {
      // Test clear operation error handling
      mockContext.globalState.update.rejects(new Error('Storage update failed'));

      await sessionManager.clearSession();
      // Should not throw, just log error
    });

    it('should handle terminal creation failures during restore', async () => {
      // Test partial restoration scenarios
      const sessionData = {
        terminals: [
          { id: 'term-1', name: 'Terminal 1', number: 1, cwd: '/test', isActive: true },
          { id: 'term-2', name: 'Terminal 2', number: 2, cwd: '/test2', isActive: false },
        ],
        activeTerminalId: 'term-1',
        timestamp: Date.now(),
        version: '3.0.0',
        scrollbackData: {},
      };

      mockContext.globalState.get.returns(sessionData);
      mockTerminalManager.createTerminal
        .onFirstCall().returns('new-term-1')
        .onSecondCall().returns(null); // Simulate creation failure

      const result = await sessionManager.restoreSession();

      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(1); // Only one terminal restored
      expect(result.skippedCount).to.equal(1); // One failed to restore
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large scrollback data efficiently', async () => {
      // Test performance with large data sets
      const largeScrollbackData = {
        'term-1': 'x'.repeat(10000), // 10KB of data
        'term-2': 'y'.repeat(20000), // 20KB of data
      };

      const mockTerminals = [
        { id: 'term-1', name: 'Terminal 1', number: 1, cwd: '/test' },
        { id: 'term-2', name: 'Terminal 2', number: 2, cwd: '/test2' },
      ];

      mockTerminalManager.getTerminals.returns(mockTerminals);
      sandbox.stub(sessionManager as any, 'requestScrollbackDataFromWebView').resolves(largeScrollbackData);

      const startTime = Date.now();
      const result = await sessionManager.saveCurrentSession();
      const duration = Date.now() - startTime;

      expect(result.success).to.be.true;
      expect(duration).to.be.lessThan(1000); // Should complete within 1 second
    });

    it('should cleanup pending requests properly', () => {
      // Test memory leak prevention
      const testData = { 'term-1': 'content' };

      // Set up multiple pending requests
      (sessionManager as any)._pendingScrollbackRequest = {
        requestId: 'old-request',
        handler: sandbox.stub(),
        timestamp: Date.now() - 5000,
      };

      sessionManager.handleSerializationResponse(testData);

      // Verify cleanup
      expect((sessionManager as any)._pendingScrollbackRequest).to.be.undefined;
    });
  });
});