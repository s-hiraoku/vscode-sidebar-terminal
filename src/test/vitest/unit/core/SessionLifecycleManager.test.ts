import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionLifecycleManager, SessionLifecycleDeps } from '../../../../core/SessionLifecycleManager';
import * as vscode from 'vscode';

// Mock vscode
vi.mock('vscode', () => ({
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showTextDocument: vi.fn(),
  },
  workspace: {
    openTextDocument: vi.fn(),
  },
  ViewColumn: { Beside: 1 },
}));

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  extension: vi.fn(),
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SessionLifecycleManager', () => {
  let manager: SessionLifecycleManager;
  let mockDeps: SessionLifecycleDeps;
  let mockTerminalManager: any;
  let mockSidebarProvider: any;
  let mockPersistenceService: any;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockTerminalManager = {
      onTerminalCreated: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onTerminalRemoved: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      getTerminals: vi.fn().mockReturnValue([{ id: 'term-1', name: 'Terminal 1' }]),
      createTerminal: vi.fn(),
    };

    mockSidebarProvider = {
      _sendMessage: vi.fn().mockResolvedValue(undefined),
    };

    mockPersistenceService = {
      saveCurrentSession: vi.fn().mockResolvedValue({ success: true, terminalCount: 1 }),
      restoreSession: vi.fn().mockResolvedValue({ success: true, restoredCount: 1, skippedCount: 0 }),
      clearSession: vi.fn().mockResolvedValue(undefined),
      getSessionInfo: vi.fn().mockReturnValue({
        exists: true,
        terminals: [{ id: 'term-1', name: 'Terminal 1', cwd: '/test' }],
        scrollbackData: { 'term-1': ['line1'] }
      }),
    };

    mockContext = {
      subscriptions: [],
    };

    mockDeps = {
      getTerminalManager: () => mockTerminalManager,
      getSidebarProvider: () => mockSidebarProvider,
      getExtensionPersistenceService: () => mockPersistenceService,
      getExtensionContext: () => mockContext,
    };

    manager = new SessionLifecycleManager(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setupSessionAutoSave', () => {
    it('should setup auto save listeners', () => {
      manager.setupSessionAutoSave(mockContext);

      expect(mockTerminalManager.onTerminalCreated).toHaveBeenCalled();
      expect(mockTerminalManager.onTerminalRemoved).toHaveBeenCalled();
      expect(mockContext.subscriptions.length).toBeGreaterThan(0);
    });

    it('should save session immediately on terminal creation', () => {
      let createdCallback: any;
      mockTerminalManager.onTerminalCreated.mockImplementation((cb: any) => {
        createdCallback = cb;
        return { dispose: vi.fn() };
      });

      manager.setupSessionAutoSave(mockContext);
      createdCallback({ name: 'New Terminal' });

      expect(mockPersistenceService.saveCurrentSession).toHaveBeenCalled();
    });
  });

  describe('saveSessionOnExit', () => {
    it('should save current session', async () => {
      await manager.saveSessionOnExit();
      expect(mockPersistenceService.saveCurrentSession).toHaveBeenCalled();
    });

    it('should handle missing service gracefully', async () => {
      mockDeps.getExtensionPersistenceService = () => undefined;
      await manager.saveSessionOnExit();
      // Should not throw and log warning (mocked)
    });
  });

  describe('handleSaveSession', () => {
    beforeEach(() => {
      // Override setTimeout to resolve immediately for these async tests
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
        fn();
        return 0 as any;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should save session and show message', async () => {
      await manager.handleSaveSession();
      
      expect(mockPersistenceService.saveCurrentSession).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockPersistenceService.saveCurrentSession.mockResolvedValue({ success: false, error: 'Failed' });
      
      await manager.handleSaveSession();
      
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Failed'));
    });
  });

  describe('handleRestoreSession', () => {
    it('should restore session and show message', async () => {
      await manager.handleRestoreSession();
      
      expect(mockPersistenceService.restoreSession).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('should handle restore failures', async () => {
      mockPersistenceService.restoreSession.mockResolvedValue({ success: false, error: 'Restore Failed' });
      
      await manager.handleRestoreSession();
      
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Restore Failed'));
    });
  });

  describe('handleClearSession', () => {
    it('should clear session after confirmation', async () => {
      (vscode.window.showWarningMessage as any).mockResolvedValue('Clear Session');
      
      await manager.handleClearSession();
      
      expect(mockPersistenceService.clearSession).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('should abort if not confirmed', async () => {
      (vscode.window.showWarningMessage as any).mockResolvedValue('Cancel');
      
      await manager.handleClearSession();
      
      expect(mockPersistenceService.clearSession).not.toHaveBeenCalled();
    });
  });

  describe('createInitialTerminal', () => {
    it('should create terminal if none exist', () => {
      mockTerminalManager.getTerminals.mockReturnValue([]);
      
      manager.createInitialTerminal();
      
      expect(mockTerminalManager.createTerminal).toHaveBeenCalled();
    });

    it('should skip creation if terminals exist', () => {
      mockTerminalManager.getTerminals.mockReturnValue([{ id: 'term-1' }]);
      
      manager.createInitialTerminal();
      
      expect(mockTerminalManager.createTerminal).not.toHaveBeenCalled();
    });
  });

  describe('diagnoseSessionData', () => {
    it('should show diagnostic report', async () => {
      await manager.diagnoseSessionData();
      
      expect(mockPersistenceService.getSessionInfo).toHaveBeenCalled();
      expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
      expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });
  });
});
