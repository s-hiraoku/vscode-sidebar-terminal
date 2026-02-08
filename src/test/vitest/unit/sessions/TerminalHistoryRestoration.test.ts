// Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
/**
 * TDD Test Suite for Terminal History Restoration
 *
 * User Issue: "terminalに以前の履歴が表示されなく、新規の状態で復元されます"
 * (Terminals restore in new state without previous history)
 *
 * This test suite follows TDD methodology:
 * RED -> GREEN -> REFACTOR
 */

import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockImplementation((section) => ({
      get: vi.fn().mockImplementation((key, defaultValue) => {
        if (section === 'secondaryTerminal') {
          if (key === 'enablePersistentSessions') return true;
          if (key === 'persistentSessionScrollback') return 1000;
          if (key === 'persistentSessionStorageLimit') return 20;
          if (key === 'persistentSessionExpiryDays') return 7;
        }
        return defaultValue;
      }),
    })),
  },
  Disposable: class {
    dispose() {}
  },
}));

describe('Terminal History Restoration', () => {
  let mockContext: any;

  beforeEach(() => {
    // Mock VS Code context
    mockContext = {
      globalState: {
        get: vi.fn(),
        update: vi.fn().mockResolvedValue(undefined),
        keys: vi.fn().mockReturnValue([]),
      },
      workspaceState: {
        get: vi.fn(),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('RED Phase - Failing Tests (Expected Behavior)', () => {
    it('should fail: message flow for session restoration should be established', async () => {
      // 1. Arrange
      const mockTerminalManager = {
        getTerminals: vi.fn().mockReturnValue([]),
        createTerminal: vi.fn().mockReturnValue('term-1'),
        setActiveTerminal: vi.fn(),
        reorderTerminals: vi.fn(),
        renameTerminal: vi.fn().mockReturnValue(true),
        updateTerminalHeader: vi.fn().mockReturnValue(true),
      } as any;

      const mockSidebarProvider = {
        sendMessageToWebview: vi.fn().mockResolvedValue(undefined),
      };

      // Import the service dynamically to allow mocking dependencies if needed
      // but here we inject mocks via constructor
      const { ExtensionPersistenceService } = await import(
        '../../../../services/persistence/ExtensionPersistenceService'
      );

      const service = new ExtensionPersistenceService(
        mockContext,
        mockTerminalManager,
        mockSidebarProvider
      );

      // Setup session data in mock storage
      const sessionData = {
        version: '4.0.0',
        timestamp: Date.now(),
        terminals: [
          {
            id: 'term-original-1',
            name: 'Terminal 1',
            number: 1,
            cwd: '/test/cwd',
            isActive: true,
          },
        ],
        scrollbackData: {
          'term-original-1': ['line 1', 'line 2'],
        },
      };

      mockContext.globalState.get.mockReturnValue(sessionData);
      // Also mock workspaceState as that's what the service actually uses
      mockContext.workspaceState = {
        get: vi.fn().mockReturnValue(sessionData),
        update: vi.fn().mockResolvedValue(undefined),
      };

      // 2. Act
      const result = await service.restoreSession();

      // 3. Assert
      expect(result.success).toBe(true);
      expect(mockTerminalManager.createTerminal).toHaveBeenCalledTimes(1);
      
      // Verify message sent to WebView
      expect(mockSidebarProvider.sendMessageToWebview).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'restoreTerminalSessions',
          terminals: expect.arrayContaining([
            expect.objectContaining({
              terminalId: 'term-1',
              // The service maps original ID to new ID, but scrollback should be from original
              scrollbackData: ['line 1', 'line 2'],
            }),
          ]),
        })
      );
    });

    it('should fail: terminal serialization should capture actual content', async () => {
      // 1. Arrange
      const mockTerminalManager = {
        getTerminals: vi.fn().mockReturnValue([
          { id: 'term-1', name: 'Terminal 1', cwd: '/cwd', number: 1 }
        ]),
        getActiveTerminalId: vi.fn().mockReturnValue('term-1'),
      } as any;

      const mockSidebarProvider = {
        sendMessageToWebview: vi.fn().mockResolvedValue(undefined),
      };

      const { ExtensionPersistenceService } = await import(
        '../../../../services/persistence/ExtensionPersistenceService'
      );

      const service = new ExtensionPersistenceService(
        mockContext,
        mockTerminalManager,
        mockSidebarProvider
      );

      // Simulate the WebView responding to the extraction request
      // We need to spy on sendMessageToWebview to trigger the response
      mockSidebarProvider.sendMessageToWebview.mockImplementation(async (msg: any) => {
        if (msg.command === 'extractScrollbackData') {
          // Simulate async response from WebView
          setTimeout(() => {
            service.handleScrollbackDataCollected({
              terminalId: msg.terminalId,
              requestId: msg.requestId,
              scrollbackData: ['restored line 1', 'restored line 2'],
            });
          }, 10);
        }
      });

      // 2. Act
      const result = await service.saveCurrentSession();

      // 3. Assert
      expect(result.success).toBe(true);
      expect(mockSidebarProvider.sendMessageToWebview).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'extractScrollbackData',
          terminalId: 'term-1',
        })
      );

      // Verify data saved to storage
      expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
        'terminal-session-unified',
        expect.objectContaining({
          terminals: expect.arrayContaining([
            expect.objectContaining({ id: 'term-1', name: 'Terminal 1' }),
          ]),
          scrollbackData: expect.objectContaining({
            'term-1': ['restored line 1', 'restored line 2'],
          }),
        })
      );
    });

    it('should fail: session data should be saved to Extension storage', async () => {
      // Setup
      const mockTerminalManager = {
        getTerminals: vi.fn().mockReturnValue([{ id: 't1', name: 'T1', number: 1 }]),
        getActiveTerminalId: vi.fn().mockReturnValue('t1'),
      } as any;
      const mockSidebarProvider = { sendMessageToWebview: vi.fn() };
      const { ExtensionPersistenceService } = await import('../../../../services/persistence/ExtensionPersistenceService');
      const service = new ExtensionPersistenceService(mockContext, mockTerminalManager, mockSidebarProvider);

      // Act
      service.handleScrollbackDataCollected({ terminalId: 't1', requestId: 'any', scrollbackData: ['data'] });
      await service.saveCurrentSession({ preferCache: true });

      // Assert
      expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
        'terminal-session-unified',
        expect.objectContaining({ scrollbackData: expect.objectContaining({ t1: ['data'] }) })
      );
    });

    it('should fail: session data should be retrieved and sent to WebView', async () => {
      // Already covered by established message flow test, but adding explicit check for clarity
      const sessionData = {
        version: '4.0.0',
        timestamp: Date.now(),
        terminals: [{ id: 'orig-1', name: 'T1', number: 1, cwd: '/tmp', isActive: true }],
        scrollbackData: { 'orig-1': ['history'] },
      };
      mockContext.workspaceState.get.mockReturnValue(sessionData);
      
      const mockTerminalManager = {
        getTerminals: vi.fn().mockReturnValue([]),
        createTerminal: vi.fn().mockReturnValue('new-1'),
        setActiveTerminal: vi.fn(),
        reorderTerminals: vi.fn(),
        renameTerminal: vi.fn().mockReturnValue(true),
        updateTerminalHeader: vi.fn().mockReturnValue(true),
      } as any;
      const mockSidebarProvider = { sendMessageToWebview: vi.fn() };
      const { ExtensionPersistenceService } = await import('../../../../services/persistence/ExtensionPersistenceService');
      const service = new ExtensionPersistenceService(mockContext, mockTerminalManager, mockSidebarProvider);

      await service.restoreSession();

      expect(mockSidebarProvider.sendMessageToWebview).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'restoreTerminalSessions',
          terminals: expect.arrayContaining([
            expect.objectContaining({ terminalId: 'new-1', scrollbackData: ['history'] })
          ])
        })
      );
    });

    it('should fail: async terminal readiness should trigger scrollback restoration', async () => {
      // Test handling of handleTerminalReady
      const sessionData = {
        version: '4.0.0',
        timestamp: Date.now(),
        terminals: [{ id: 'orig-1', name: 'T1', number: 1, cwd: '/tmp', isActive: true }],
        scrollbackData: { 'orig-1': ['history'] },
      };
      mockContext.workspaceState.get.mockReturnValue(sessionData);

      const mockTerminalManager = {
        getTerminals: vi.fn().mockReturnValue([]),
        createTerminal: vi.fn().mockReturnValue('new-1'),
        setActiveTerminal: vi.fn(),
        reorderTerminals: vi.fn(),
        renameTerminal: vi.fn().mockReturnValue(true),
        updateTerminalHeader: vi.fn().mockReturnValue(true),
      } as any;
      const mockSidebarProvider = { sendMessageToWebview: vi.fn() };
      const { ExtensionPersistenceService } = await import('../../../../services/persistence/ExtensionPersistenceService');
      const service = new ExtensionPersistenceService(mockContext, mockTerminalManager, mockSidebarProvider);

      // Act: start restore
      const restorePromise = service.restoreSession();
      
      // Simulate terminal readiness from WebView
      service.handleTerminalReady('new-1');
      
      await restorePromise;

      // Verify restoration message was eventually sent
      expect(mockSidebarProvider.sendMessageToWebview).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'restoreTerminalSessions' })
      );
    });
  });

  describe('Real User Scenario Tests (Should Fail Initially)', () => {
    it('should fail: CLI Agent commands should be preserved across VS Code restarts', async () => {
      // 1. Arrange - Initial State
      const _mockStorage = new Map<string, any>();
      
      // Mock Context for First Session (Save)
      const context1 = {
        globalState: { get: vi.fn(), update: vi.fn(), keys: vi.fn().mockReturnValue([]) },
        workspaceState: {
          get: vi.fn().mockImplementation((k) => _mockStorage.get(k)),
          update: vi.fn().mockImplementation((k, v) => { _mockStorage.set(k, v); return Promise.resolve(); }),
        },
      } as any;

      const terminalManager1 = {
        getTerminals: vi.fn().mockReturnValue([
          { id: 'term-1', name: 'Terminal 1', cwd: '/cwd', number: 1, isActive: true }
        ]),
        getActiveTerminalId: vi.fn().mockReturnValue('term-1'),
      } as any;

      const sidebarProvider1 = {
        sendMessageToWebview: vi.fn().mockImplementation(async (msg: any) => {
          if (msg.command === 'extractScrollbackData') {
             // Simulate WebView response
             setTimeout(() => {
                service1.handleScrollbackDataCollected({
                  terminalId: msg.terminalId,
                  requestId: msg.requestId,
                  scrollbackData: ['cmd: ls', 'file1.txt file2.txt'],
                });
             }, 5);
          }
        }),
      };

      const { ExtensionPersistenceService } = await import(
        '../../../../services/persistence/ExtensionPersistenceService'
      );

      const service1 = new ExtensionPersistenceService(context1, terminalManager1, sidebarProvider1);

      // 2. Act - Save Session
      const saveResult = await service1.saveCurrentSession();
      expect(saveResult.success).toBe(true);
      
      // Simulate VS Code Restart (Dispose service1, create service2)
      service1.dispose();

      // Mock Context for Second Session (Restore)
      const context2 = {
        globalState: { get: vi.fn(), update: vi.fn(), keys: vi.fn().mockReturnValue([]) },
        workspaceState: {
          get: vi.fn().mockImplementation((k) => _mockStorage.get(k)),
          update: vi.fn().mockImplementation((k, v) => { _mockStorage.set(k, v); return Promise.resolve(); }),
        },
      } as any;

      const terminalManager2 = {
        getTerminals: vi.fn().mockReturnValue([]), // Empty initially
        createTerminal: vi.fn().mockReturnValue('term-new-1'),
        setActiveTerminal: vi.fn(),
        reorderTerminals: vi.fn(),
        renameTerminal: vi.fn().mockReturnValue(true),
        updateTerminalHeader: vi.fn().mockReturnValue(true),
        getTerminal: vi.fn(),
        // We need a way to track if createTerminal was called
      } as any;

      const sidebarProvider2 = {
        sendMessageToWebview: vi.fn().mockResolvedValue(undefined),
      };

      const service2 = new ExtensionPersistenceService(context2, terminalManager2, sidebarProvider2);

      // 3. Act - Restore Session
      const restoreResult = await service2.restoreSession();

      // 4. Assert
      expect(restoreResult.success).toBe(true);
      expect(terminalManager2.createTerminal).toHaveBeenCalled();
      
      // Verify restoration message
      expect(sidebarProvider2.sendMessageToWebview).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'restoreTerminalSessions',
          terminals: expect.arrayContaining([
            expect.objectContaining({
              terminalId: 'term-new-1',
              scrollbackData: ['cmd: ls', 'file1.txt file2.txt'],
            }),
          ]),
        })
      );
    });

    it('should fail: multiple terminals should all restore with history', async () => {
      // 1. Arrange - Setup multiple terminals in session
      const sessionData = {
        version: '4.0.0',
        timestamp: Date.now(),
        terminals: [
          { id: 't1-orig', name: 'Term 1', number: 1, cwd: '/cwd1', isActive: false },
          { id: 't2-orig', name: 'Term 2', number: 2, cwd: '/cwd2', isActive: true },
        ],
        scrollbackData: {
          't1-orig': ['line 1-1', 'line 1-2'],
          't2-orig': ['line 2-1', 'line 2-2'],
        },
      };

      mockContext.workspaceState = {
        get: vi.fn().mockReturnValue(sessionData),
        update: vi.fn().mockResolvedValue(undefined),
      };

      const mockTerminalManager = {
        getTerminals: vi.fn().mockReturnValue([]),
        createTerminal: vi.fn()
          .mockReturnValueOnce('t1-new')
          .mockReturnValueOnce('t2-new'),
        setActiveTerminal: vi.fn(),
        reorderTerminals: vi.fn(),
        renameTerminal: vi.fn().mockReturnValue(true),
        updateTerminalHeader: vi.fn().mockReturnValue(true),
      } as any;

      const mockSidebarProvider = {
        sendMessageToWebview: vi.fn().mockResolvedValue(undefined),
      };

      const { ExtensionPersistenceService } = await import(
        '../../../../services/persistence/ExtensionPersistenceService'
      );

      const service = new ExtensionPersistenceService(
        mockContext,
        mockTerminalManager,
        mockSidebarProvider
      );

      // 2. Act
      const result = await service.restoreSession();

      // 3. Assert
      expect(result.success).toBe(true);
      expect(result.restoredCount).toBe(2);
      expect(mockTerminalManager.createTerminal).toHaveBeenCalledTimes(2);
      
      // Verify active terminal set correctly (Term 2 was active)
      expect(mockTerminalManager.setActiveTerminal).toHaveBeenCalledWith('t2-new');

      // Verify scrollback restoration message contains both terminals
      expect(mockSidebarProvider.sendMessageToWebview).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'restoreTerminalSessions',
          terminals: expect.arrayContaining([
            expect.objectContaining({
              terminalId: 't1-new',
              scrollbackData: ['line 1-1', 'line 1-2'],
            }),
            expect.objectContaining({
              terminalId: 't2-new',
              scrollbackData: ['line 2-1', 'line 2-2'],
            }),
          ]),
        })
      );
    });
  });
});