// Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CliAgentWebViewService } from '../../../../../services/webview/CliAgentWebViewService';
import { IMessageHandlerContext } from '../../../../../services/webview/interfaces';

describe('CliAgentWebViewService', () => {
  let service: CliAgentWebViewService;
  let mockContext: IMessageHandlerContext;

  beforeEach(() => {
    service = new CliAgentWebViewService();

    // Create mock context
    mockContext = {
      extensionContext: {
        subscriptions: [],
      } as any,
      terminalManager: {
        getConnectedAgentTerminalId: vi.fn().mockReturnValue('terminal-1'),
        getConnectedAgentType: vi.fn().mockReturnValue('claude'),
        getDisconnectedAgents: vi
          .fn()
          .mockReturnValue(new Map([['terminal-2', { type: 'gemini', lastSeen: Date.now() }]])),
        getTerminals: vi.fn().mockReturnValue([
          { id: 'terminal-1', name: 'Terminal 1' },
          { id: 'terminal-2', name: 'Terminal 2' },
          { id: 'terminal-3', name: 'Terminal 3' },
        ]),
        onCliAgentStatusChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        switchAiAgentConnection: vi.fn().mockReturnValue({
          success: true,
          newStatus: 'connected',
          agentType: 'claude',
        }),
      } as any,
      webview: undefined,
      sendMessage: vi.fn().mockResolvedValue(undefined),
      terminalIdMapping: new Map(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize successfully', () => {
      const cliAgentService = new CliAgentWebViewService();
      expect(cliAgentService).toBeInstanceOf(CliAgentWebViewService);
    });
  });

  describe('sendStatusUpdate', () => {
    it('should send status update message', () => {
      service.sendStatusUpdate('Terminal 1', 'connected', 'claude', mockContext);

      expect(mockContext.sendMessage).toHaveBeenCalledWith({
        command: 'cliAgentStatusUpdate',
        cliAgentStatus: {
          activeTerminalName: 'Terminal 1',
          status: 'connected',
          agentType: 'claude',
        },
      });
    });

    it('should send status update with null values', () => {
      service.sendStatusUpdate(null, 'none', null, mockContext);

      expect(mockContext.sendMessage).toHaveBeenCalledWith({
        command: 'cliAgentStatusUpdate',
        cliAgentStatus: {
          activeTerminalName: null,
          status: 'none',
          agentType: null,
        },
      });
    });

    it('should handle sendMessage errors gracefully', async () => {
      (mockContext.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Send message error'));

      // Should not throw
      service.sendStatusUpdate('Terminal 1', 'connected', 'claude', mockContext);

      // Give some time for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('should handle all status types', () => {
      const statuses: ('connected' | 'disconnected' | 'none')[] = [
        'connected',
        'disconnected',
        'none',
      ];

      statuses.forEach((status) => {
        service.sendStatusUpdate('Terminal 1', status, 'claude', mockContext);

        expect(mockContext.sendMessage).toHaveBeenCalledWith({
          command: 'cliAgentStatusUpdate',
          cliAgentStatus: {
            activeTerminalName: 'Terminal 1',
            status,
            agentType: 'claude',
          },
        });
      });
    });
  });

  describe('sendFullStateSync', () => {
    it('should send full state sync with all terminals', () => {
      service.sendFullStateSync(mockContext);

      expect(mockContext.sendMessage).toHaveBeenCalledWith({
        command: 'cliAgentFullStateSync',
        terminalStates: {
          'terminal-1': {
            status: 'connected',
            agentType: 'claude',
            terminalName: 'Terminal 1',
          },
          'terminal-2': {
            status: 'disconnected',
            agentType: 'gemini',
            terminalName: 'Terminal 2',
          },
          'terminal-3': {
            status: 'none',
            agentType: null,
            terminalName: 'Terminal 3',
          },
        },
      });
    });

    it('should handle empty terminal list', () => {
      (mockContext.terminalManager.getTerminals as ReturnType<typeof vi.fn>).mockReturnValue([]);

      service.sendFullStateSync(mockContext);

      expect(mockContext.sendMessage).toHaveBeenCalledWith({
        command: 'cliAgentFullStateSync',
        terminalStates: {},
      });
    });

    it('should handle no connected agent', () => {
      (mockContext.terminalManager.getConnectedAgentTerminalId as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (mockContext.terminalManager.getConnectedAgentType as ReturnType<typeof vi.fn>).mockReturnValue(null);

      service.sendFullStateSync(mockContext);

      expect(mockContext.sendMessage).toHaveBeenCalledWith({
        command: 'cliAgentFullStateSync',
        terminalStates: {
          'terminal-1': {
            status: 'none',
            agentType: null,
            terminalName: 'Terminal 1',
          },
          'terminal-2': {
            status: 'disconnected',
            agentType: 'gemini',
            terminalName: 'Terminal 2',
          },
          'terminal-3': {
            status: 'none',
            agentType: null,
            terminalName: 'Terminal 3',
          },
        },
      });
    });

    it('should handle sendMessage errors gracefully', async () => {
      (mockContext.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Send message error'));

      // Should not throw
      service.sendFullStateSync(mockContext);

      // Give some time for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  describe('setupListeners', () => {
    it('should set up CLI Agent status change listeners', () => {
      const disposables = service.setupListeners(mockContext);

      expect(mockContext.terminalManager.onCliAgentStatusChange).toHaveBeenCalled();
      expect(Array.isArray(disposables)).toBe(true);
      expect(disposables.length).toBeGreaterThan(0);
    });

    it('should add disposables to extension context', () => {
      service.setupListeners(mockContext);

      expect(mockContext.extensionContext.subscriptions.length).toBeGreaterThan(0);
    });

    it('should handle listener setup errors gracefully', () => {
      (mockContext.terminalManager.onCliAgentStatusChange as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Listener setup error');
      });

      const disposables = service.setupListeners(mockContext);

      expect(Array.isArray(disposables)).toBe(true);
      expect(disposables).toEqual([]);
    });
  });

  describe('clearListeners', () => {
    it('should clear all listeners', () => {
      const mockDisposable = { dispose: vi.fn() };
      (mockContext.terminalManager.onCliAgentStatusChange as ReturnType<typeof vi.fn>).mockReturnValue(
        mockDisposable
      );

      // Set up listeners
      service.setupListeners(mockContext);

      // Clear listeners
      service.clearListeners();

      expect(mockDisposable.dispose).toHaveBeenCalled();
    });

    it('should handle dispose errors gracefully', () => {
      const mockDisposable = {
        dispose: vi.fn().mockImplementation(() => {
          throw new Error('Dispose error');
        }),
      };
      (mockContext.terminalManager.onCliAgentStatusChange as ReturnType<typeof vi.fn>).mockReturnValue(
        mockDisposable
      );

      // Set up listeners
      service.setupListeners(mockContext);

      // Clear listeners should not throw
      service.clearListeners();
    });
  });

  describe('handleSwitchAiAgent', () => {
    it('should handle successful AI agent switch', async () => {
      await service.handleSwitchAiAgent('terminal-1', 'connect', mockContext);

      expect(mockContext.terminalManager.switchAiAgentConnection).toHaveBeenCalledWith(
        'terminal-1'
      );
      expect(mockContext.sendMessage).toHaveBeenCalledWith({
        command: 'switchAiAgentResponse',
        terminalId: 'terminal-1',
        success: true,
        newStatus: 'connected',
        agentType: 'claude',
      });
    });

    it('should handle failed AI agent switch', async () => {
      (mockContext.terminalManager.switchAiAgentConnection as ReturnType<typeof vi.fn>).mockReturnValue({
        success: false,
        reason: 'No agent available',
        newStatus: 'none',
      });

      await service.handleSwitchAiAgent('terminal-1', 'connect', mockContext);

      expect(mockContext.sendMessage).toHaveBeenCalledWith({
        command: 'switchAiAgentResponse',
        terminalId: 'terminal-1',
        success: false,
        reason: 'No agent available',
        newStatus: 'none',
      });
    });

    it('should handle switchAiAgentConnection errors', async () => {
      (mockContext.terminalManager.switchAiAgentConnection as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Switch error');
      });

      await service.handleSwitchAiAgent('terminal-1', 'connect', mockContext);

      expect(mockContext.sendMessage).toHaveBeenCalledWith({
        command: 'switchAiAgentResponse',
        terminalId: 'terminal-1',
        success: false,
        reason: 'Internal error occurred',
      });
    });
  });

  describe('getDebugInfo', () => {
    it('should return debug information', () => {
      const debugInfo = service.getDebugInfo(mockContext);

      expect(debugInfo).toBeTypeOf('object');
      expect(debugInfo).toHaveProperty('connectedAgent');
      expect(debugInfo).toHaveProperty('disconnectedAgents');
      expect(debugInfo).toHaveProperty('activeListeners');
      expect(debugInfo).toHaveProperty('timestamp');
    });

    it('should include connected agent info', () => {
      const debugInfo = service.getDebugInfo(mockContext);

      expect((debugInfo as any).connectedAgent).toEqual({
        id: 'terminal-1',
        type: 'claude',
      });
    });

    it('should include disconnected agents info', () => {
      const debugInfo = service.getDebugInfo(mockContext);

      expect(Array.isArray((debugInfo as any).disconnectedAgents)).toBe(true);
      expect((debugInfo as any).disconnectedAgents).toHaveLength(1);
    });

    it('should handle errors gracefully', () => {
      (mockContext.terminalManager.getConnectedAgentTerminalId as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Debug error');
      });

      const debugInfo = service.getDebugInfo(mockContext);

      expect(debugInfo).toHaveProperty('error');
      expect(debugInfo).toHaveProperty('timestamp');
    });
  });

  describe('dispose', () => {
    it('should dispose all resources', () => {
      const clearListenersSpy = vi.spyOn(service, 'clearListeners');

      service.dispose();

      expect(clearListenersSpy).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent full state sync calls', () => {
      for (let i = 0; i < 5; i++) {
        service.sendFullStateSync(mockContext);
      }

      expect(mockContext.sendMessage).toHaveBeenCalled();
    });
  });
});
