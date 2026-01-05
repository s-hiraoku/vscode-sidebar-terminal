
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebViewStateManager } from '../../../../services/WebViewStateManager';

const mocks = vi.hoisted(() => ({
  showInformationMessageMock: vi.fn(),
  executeCommandMock: vi.fn(),
  handleTerminalCreationErrorMock: vi.fn(),
}));

vi.mock('vscode', () => ({
  window: {
    showInformationMessage: mocks.showInformationMessageMock,
  },
  commands: {
    executeCommand: mocks.executeCommandMock,
  },
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockImplementation((key, def) => def),
    }),
  },
}));

// Mock utils
vi.mock('../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

vi.mock('../../../../utils/feedback', () => ({
  TerminalErrorHandler: {
    handleTerminalCreationError: mocks.handleTerminalCreationErrorMock,
  },
}));

vi.mock('../../../../utils/common', () => ({
  getTerminalConfig: vi.fn().mockReturnValue({}),
  normalizeTerminalInfo: vi.fn((t) => t),
}));

vi.mock('../../../../constants', () => ({
  TERMINAL_CONSTANTS: {
    COMMANDS: {
      INIT: 'init',
      TERMINAL_CREATED: 'terminalCreated',
    },
  },
}));

describe('WebViewStateManager', () => {
  let stateManager: WebViewStateManager;
  let mockTerminalManager: any;
  let mockSessionManager: any;
  let mockSendMessage: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Mock terminal manager
    mockTerminalManager = {
      getTerminals: vi.fn().mockReturnValue([]),
      getActiveTerminalId: vi.fn().mockReturnValue(null),
      createTerminal: vi.fn().mockReturnValue('new-terminal-id'),
      setActiveTerminal: vi.fn(),
      getCurrentState: vi.fn().mockReturnValue({
        terminals: [],
        activeTerminalId: null,
        terminalCount: 0,
      }),
    };

    // Mock session manager
    mockSessionManager = {
      getSessionInfo: vi.fn().mockReturnValue(null),
      restoreSession: vi.fn().mockResolvedValue({
        success: false,
        restoredCount: 0,
      }),
    };

    // Mock send message function
    mockSendMessage = vi.fn().mockResolvedValue(undefined);

    // Create service instance
    stateManager = new WebViewStateManager(
      mockTerminalManager,
      mockSessionManager,
      mockSendMessage
    );
  });

  afterEach(() => {
    stateManager.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Initialization Management', () => {
    it('should start in uninitialized state', () => {
      expect(stateManager.isInitialized()).toBe(false);
    });

    it('should initialize WebView successfully', async () => {
      mockTerminalManager.getTerminals.mockReturnValue([{ id: 't1', name: 'T1' }]);
      
      await stateManager.initializeWebView();

      expect(stateManager.isInitialized()).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'init'
      }));
    });

    it('should skip duplicate initialization', async () => {
      mockTerminalManager.getTerminals.mockReturnValue([{ id: 't1', name: 'T1' }]);
      
      await stateManager.initializeWebView();
      const calls = mockSendMessage.mock.calls.length;
      
      await stateManager.initializeWebView();
      
      expect(mockSendMessage.mock.calls.length).toBe(calls);
    });

    it('should reset initialized flag on failure', async () => {
      mockTerminalManager.getTerminals.mockImplementation(() => {
        throw new Error('Fail');
      });

      await expect(stateManager.initializeWebView()).rejects.toThrow('Fail');
      expect(stateManager.isInitialized()).toBe(false);
    });
  });

  describe('Session Restoration', () => {
    it('should trigger session restore if session info exists', async () => {
      mockSessionManager.getSessionInfo.mockReturnValue({
        exists: true,
        terminals: [{ id: 'restored' }]
      });
      mockSessionManager.restoreSession.mockResolvedValue({ success: true, restoredCount: 1 });

      await stateManager.initializeWebView();

      // Flush queued timers and microtasks
      await vi.runAllTimersAsync();
      
      expect(mockSessionManager.restoreSession).toHaveBeenCalledWith(true);
    });

    it('should schedule initial terminal creation if no session data', async () => {
      mockSessionManager.getSessionInfo.mockReturnValue(null);
      
      await stateManager.initializeWebView();
      
      // Advance timers to trigger setTimeout inside _scheduleInitialTerminalCreation
      await vi.advanceTimersByTimeAsync(200);
      
      expect(mockTerminalManager.createTerminal).toHaveBeenCalled();
    });

    it('should schedule initial terminal creation if restore fails', async () => {
      mockSessionManager.getSessionInfo.mockReturnValue({ exists: true, terminals: [{ id: 't1' }] });
      mockSessionManager.restoreSession.mockRejectedValue(new Error('Fail'));
      
      await stateManager.initializeWebView();

      // Process restore failure and scheduled terminal creation
      await vi.runAllTimersAsync();
      
      expect(mockTerminalManager.createTerminal).toHaveBeenCalled();
    });
  });

  describe('Terminal Management', () => {
    it('should ensure minimum terminals creates one if none exist', async () => {
      mockTerminalManager.getTerminals.mockReturnValue([]);
      
      await stateManager.ensureMinimumTerminals();
      
      expect(mockTerminalManager.createTerminal).toHaveBeenCalled();
      expect(mockTerminalManager.setActiveTerminal).toHaveBeenCalledWith('new-terminal-id');
    });

    it('should not create terminal if one exists', async () => {
      mockTerminalManager.getTerminals.mockReturnValue([{ id: 't1' }]);
      
      await stateManager.ensureMinimumTerminals();
      
      expect(mockTerminalManager.createTerminal).not.toHaveBeenCalled();
    });
  });

  describe('Visibility & Panel Location', () => {
    it('should request panel location detection when visible', async () => {
      await stateManager.handleVisibilityChange(true);
      
      await vi.advanceTimersByTimeAsync(500);
      
      expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'requestPanelLocationDetection'
      }));
    });

    it('should not request panel location when hidden', async () => {
      await stateManager.handleVisibilityChange(false);
      
      await vi.advanceTimersByTimeAsync(500);
      
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should execute fallback command if sending fails', async () => {
      // Setup sendMessage to throw
      const stateManagerFaulty = new WebViewStateManager(
        mockTerminalManager,
        mockSessionManager,
        () => Promise.reject(new Error('Fail'))
      );
      
      stateManagerFaulty.requestPanelLocationDetection();

      // Allow promise rejection handling to run
      await Promise.resolve();
      
      // Should call fallback executeCommand
      expect(mocks.executeCommandMock).toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );
    });
  });

  describe('Disposal', () => {
    it('should clear state on dispose', async () => {
      await stateManager.initializeWebView();
      expect(stateManager.isInitialized()).toBe(true);
      
      stateManager.dispose();
      expect(stateManager.isInitialized()).toBe(false);
    });
  });
});
