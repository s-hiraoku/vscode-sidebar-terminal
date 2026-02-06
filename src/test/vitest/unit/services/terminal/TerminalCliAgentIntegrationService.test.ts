// Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalCliAgentIntegrationService } from '../../../../../services/terminal/TerminalCliAgentIntegrationService';
import { ICliAgentDetectionService } from '../../../../../interfaces/CliAgentService';

describe('TerminalCliAgentIntegrationService', () => {
  let service: TerminalCliAgentIntegrationService;
  let mockCliAgentService: {
    startHeartbeat: ReturnType<typeof vi.fn>;
    onCliAgentStatusChange: any;
    getAgentState: ReturnType<typeof vi.fn>;
    getConnectedAgent: ReturnType<typeof vi.fn>;
    refreshAgentState: ReturnType<typeof vi.fn>;
    detectFromOutput: ReturnType<typeof vi.fn>;
    detectFromInput: ReturnType<typeof vi.fn>;
    getDisconnectedAgents: ReturnType<typeof vi.fn>;
    switchAgentConnection: ReturnType<typeof vi.fn>;
    handleTerminalRemoved: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    detectTermination: ReturnType<typeof vi.fn>;
    forceReconnectAgent: ReturnType<typeof vi.fn>;
    clearDetectionError: ReturnType<typeof vi.fn>;
    setAgentConnected: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create mock CLI Agent service
    mockCliAgentService = {
      startHeartbeat: vi.fn(),
      onCliAgentStatusChange: {} as any,
      getAgentState: vi.fn(),
      getConnectedAgent: vi.fn(),
      refreshAgentState: vi.fn(),
      detectFromOutput: vi.fn(),
      detectFromInput: vi.fn(),
      getDisconnectedAgents: vi.fn(),
      switchAgentConnection: vi.fn(),
      handleTerminalRemoved: vi.fn(),
      dispose: vi.fn(),
      detectTermination: vi.fn(),
      forceReconnectAgent: vi.fn(),
      clearDetectionError: vi.fn(),
      setAgentConnected: vi.fn(),
    };

    service = new TerminalCliAgentIntegrationService(mockCliAgentService as unknown as ICliAgentDetectionService);
  });

  afterEach(() => {
    service.dispose();
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with provided CLI agent service', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with default CLI agent service', () => {
      const defaultService = new TerminalCliAgentIntegrationService();
      expect(defaultService).toBeDefined();
      defaultService.dispose();
    });
  });

  describe('startHeartbeat', () => {
    it('should start CLI Agent heartbeat', () => {
      service.startHeartbeat();

      expect(mockCliAgentService.startHeartbeat).toHaveBeenCalledOnce();
    });
  });

  describe('isCliAgentConnected', () => {
    it('should return true when agent is connected', () => {
      mockCliAgentService.getAgentState.mockReturnValue({ status: 'connected', agentType: 'claude' });

      const result = service.isCliAgentConnected('terminal1');

      expect(result).toBe(true);
      expect(mockCliAgentService.getAgentState).toHaveBeenCalledWith('terminal1');
    });

    it('should return false when agent is disconnected', () => {
      mockCliAgentService.getAgentState.mockReturnValue({ status: 'disconnected', agentType: 'claude' });

      const result = service.isCliAgentConnected('terminal1');

      expect(result).toBe(false);
    });

    it('should return false when agent is none', () => {
      mockCliAgentService.getAgentState.mockReturnValue({ status: 'none', agentType: null });

      const result = service.isCliAgentConnected('terminal1');

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getAgentState.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = service.isCliAgentConnected('terminal1');

      expect(result).toBe(false);
    });
  });

  describe('isCliAgentRunning', () => {
    it('should return true when agent is connected', () => {
      mockCliAgentService.getAgentState.mockReturnValue({ status: 'connected', agentType: 'claude' });

      const result = service.isCliAgentRunning('terminal1');

      expect(result).toBe(true);
    });

    it('should return true when agent is disconnected but running', () => {
      mockCliAgentService.getAgentState.mockReturnValue({ status: 'disconnected', agentType: 'claude' });

      const result = service.isCliAgentRunning('terminal1');

      expect(result).toBe(true);
    });

    it('should return false when agent is none', () => {
      mockCliAgentService.getAgentState.mockReturnValue({ status: 'none', agentType: null });

      const result = service.isCliAgentRunning('terminal1');

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getAgentState.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = service.isCliAgentRunning('terminal1');

      expect(result).toBe(false);
    });
  });

  describe('getCurrentGloballyActiveAgent', () => {
    it('should return active agent info', () => {
      const agentInfo = { terminalId: 'terminal1', type: 'claude' };
      mockCliAgentService.getConnectedAgent.mockReturnValue(agentInfo);

      const result = service.getCurrentGloballyActiveAgent();

      expect(result).toEqual(agentInfo);
    });

    it('should return null when no agent is connected', () => {
      mockCliAgentService.getConnectedAgent.mockReturnValue(null);

      const result = service.getCurrentGloballyActiveAgent();

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getConnectedAgent.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = service.getCurrentGloballyActiveAgent();

      expect(result).toBeNull();
    });
  });

  describe('refreshCliAgentState', () => {
    it('should refresh CLI Agent state successfully', () => {
      mockCliAgentService.refreshAgentState.mockReturnValue(true);

      const result = service.refreshCliAgentState();

      expect(result).toBe(true);
      expect(mockCliAgentService.refreshAgentState).toHaveBeenCalledOnce();
    });

    it('should handle refresh failure', () => {
      mockCliAgentService.refreshAgentState.mockReturnValue(false);

      const result = service.refreshCliAgentState();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.refreshAgentState.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = service.refreshCliAgentState();

      expect(result).toBe(false);
    });
  });

  describe('handleTerminalOutputForCliAgent', () => {
    it('should detect from output', () => {
      service.handleTerminalOutputForCliAgent('terminal1', 'output data');

      expect(mockCliAgentService.detectFromOutput).toHaveBeenCalledWith('terminal1', 'output data');
    });

    it('should handle detection errors gracefully', () => {
      mockCliAgentService.detectFromOutput.mockImplementation(() => {
        throw new Error('Detection error');
      });

      // Should not throw
      service.handleTerminalOutputForCliAgent('terminal1', 'output data');
    });
  });

  describe('handleTerminalInputForCliAgent', () => {
    it('should detect from input', () => {
      service.handleTerminalInputForCliAgent('terminal1', 'input data');

      expect(mockCliAgentService.detectFromInput).toHaveBeenCalledWith('terminal1', 'input data');
    });

    it('should handle detection errors gracefully', () => {
      mockCliAgentService.detectFromInput.mockImplementation(() => {
        throw new Error('Detection error');
      });

      // Should not throw
      service.handleTerminalInputForCliAgent('terminal1', 'input data');
    });
  });

  describe('getAgentType', () => {
    it('should return agent type', () => {
      mockCliAgentService.getAgentState.mockReturnValue({ status: 'connected', agentType: 'claude' });

      const result = service.getAgentType('terminal1');

      expect(result).toBe('claude');
    });

    it('should return null when no agent', () => {
      mockCliAgentService.getAgentState.mockReturnValue({ status: 'none', agentType: null });

      const result = service.getAgentType('terminal1');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getAgentState.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = service.getAgentType('terminal1');

      expect(result).toBeNull();
    });
  });

  describe('getConnectedAgents', () => {
    it('should return connected agents', () => {
      const connectedAgent = { terminalId: 'terminal1', type: 'claude' };
      mockCliAgentService.getConnectedAgent.mockReturnValue(connectedAgent);

      const result = service.getConnectedAgents();

      expect(result.length).toBe(1);
      expect(result[0]?.terminalId).toBe('terminal1');
      expect(result[0]?.agentInfo.type).toBe('claude');
    });

    it('should return empty array when no agents connected', () => {
      mockCliAgentService.getConnectedAgent.mockReturnValue(null);

      const result = service.getConnectedAgents();

      expect(result.length).toBe(0);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getConnectedAgent.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = service.getConnectedAgents();

      expect(result.length).toBe(0);
    });
  });

  describe('getDisconnectedAgents', () => {
    it('should return disconnected agents map', () => {
      const disconnectedMap = new Map([
        [
          'terminal1',
          { type: 'claude' as const, startTime: new Date(), terminalName: 'Terminal 1' },
        ],
      ]);
      mockCliAgentService.getDisconnectedAgents.mockReturnValue(disconnectedMap);

      const result = service.getDisconnectedAgents();

      expect(result.size).toBe(1);
      expect(result.has('terminal1')).toBe(true);
    });

    it('should preserve copilot and opencode in disconnected agents', () => {
      const disconnectedMap = new Map([
        [
          'terminal-copilot',
          { type: 'copilot' as const, startTime: new Date(), terminalName: 'Terminal Copilot' },
        ],
        [
          'terminal-opencode',
          { type: 'opencode' as const, startTime: new Date(), terminalName: 'Terminal OpenCode' },
        ],
      ]);
      mockCliAgentService.getDisconnectedAgents.mockReturnValue(disconnectedMap);

      const result = service.getDisconnectedAgents();

      expect(result.get('terminal-copilot')?.type).toBe('copilot');
      expect(result.get('terminal-opencode')?.type).toBe('opencode');
    });

    it('should return empty map when no disconnected agents', () => {
      mockCliAgentService.getDisconnectedAgents.mockReturnValue(new Map());

      const result = service.getDisconnectedAgents();

      expect(result.size).toBe(0);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getDisconnectedAgents.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = service.getDisconnectedAgents();

      expect(result.size).toBe(0);
    });
  });

  describe('getConnectedAgentTerminalId', () => {
    it('should return connected agent terminal ID', () => {
      const connectedAgent = { terminalId: 'terminal1', type: 'claude' };
      mockCliAgentService.getConnectedAgent.mockReturnValue(connectedAgent);

      const result = service.getConnectedAgentTerminalId();

      expect(result).toBe('terminal1');
    });

    it('should return null when no agent connected', () => {
      mockCliAgentService.getConnectedAgent.mockReturnValue(null);

      const result = service.getConnectedAgentTerminalId();

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getConnectedAgent.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = service.getConnectedAgentTerminalId();

      expect(result).toBeNull();
    });
  });

  describe('getConnectedAgentType', () => {
    it('should return connected agent type', () => {
      const connectedAgent = { terminalId: 'terminal1', type: 'gemini' };
      mockCliAgentService.getConnectedAgent.mockReturnValue(connectedAgent);

      const result = service.getConnectedAgentType();

      expect(result).toBe('gemini');
    });

    it('should return null when no agent connected', () => {
      mockCliAgentService.getConnectedAgent.mockReturnValue(null);

      const result = service.getConnectedAgentType();

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getConnectedAgent.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = service.getConnectedAgentType();

      expect(result).toBeNull();
    });

    it('should return copilot and opencode types', () => {
      mockCliAgentService.getConnectedAgent.mockReturnValue({
        terminalId: 'terminal1',
        type: 'copilot',
      });
      expect(service.getConnectedAgentType()).toBe('copilot');

      mockCliAgentService.getConnectedAgent.mockReturnValue({
        terminalId: 'terminal2',
        type: 'opencode',
      });
      expect(service.getConnectedAgentType()).toBe('opencode');
    });
  });

  describe('handleTerminalRemoved', () => {
    it('should handle terminal removal', () => {
      service.handleTerminalRemoved('terminal1');

      expect(mockCliAgentService.handleTerminalRemoved).toHaveBeenCalledWith('terminal1');
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.handleTerminalRemoved.mockImplementation(() => {
        throw new Error('Test error');
      });

      // Should not throw
      service.handleTerminalRemoved('terminal1');
    });
  });

  describe('switchAiAgentConnection', () => {
    it('should switch connection successfully', () => {
      const switchResult = {
        success: true,
        newStatus: 'connected' as const,
        agentType: 'claude' as const,
      };
      mockCliAgentService.switchAgentConnection.mockReturnValue(switchResult);

      const result = service.switchAiAgentConnection('terminal1');

      expect(result).toEqual(switchResult);
      expect(mockCliAgentService.switchAgentConnection).toHaveBeenCalledWith('terminal1');
    });

    it('should handle switch failure', () => {
      const switchResult = {
        success: false,
        reason: 'Test failure',
        newStatus: 'none' as const,
        agentType: null,
      };
      mockCliAgentService.switchAgentConnection.mockReturnValue(switchResult);

      const result = service.switchAiAgentConnection('terminal1');

      expect(result).toEqual(switchResult);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.switchAgentConnection.mockImplementation(() => {
        throw new Error('Switch error');
      });

      const result = service.switchAiAgentConnection('terminal1');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Switch failed');
      expect(result.newStatus).toBe('none');
      expect(result.agentType).toBeNull();
    });
  });

  describe('dispose', () => {
    it('should dispose CLI Agent service', () => {
      service.dispose();

      expect(mockCliAgentService.dispose).toHaveBeenCalledOnce();
    });

    it('should handle disposal errors gracefully', () => {
      mockCliAgentService.dispose.mockImplementation(() => {
        throw new Error('Dispose error');
      });

      // Should not throw
      service.dispose();
    });
  });

  describe('Event Emitter Integration', () => {
    it('should expose onCliAgentStatusChange event', () => {
      const eventEmitter = service.onCliAgentStatusChange;

      expect(eventEmitter).toBe(mockCliAgentService.onCliAgentStatusChange);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete CLI Agent lifecycle', () => {
      // Start heartbeat
      service.startHeartbeat();
      expect(mockCliAgentService.startHeartbeat).toHaveBeenCalledOnce();

      // Detect from input
      service.handleTerminalInputForCliAgent('terminal1', 'claude-code "test"');
      expect(mockCliAgentService.detectFromInput).toHaveBeenCalled();

      // Check connection status
      mockCliAgentService.getAgentState.mockReturnValue({ status: 'connected', agentType: 'claude' });
      expect(service.isCliAgentConnected('terminal1')).toBe(true);

      // Handle terminal removal
      service.handleTerminalRemoved('terminal1');
      expect(mockCliAgentService.handleTerminalRemoved).toHaveBeenCalledWith('terminal1');

      // Dispose
      service.dispose();
      expect(mockCliAgentService.dispose).toHaveBeenCalledOnce();
    });

    it('should handle error scenarios throughout lifecycle', () => {
      // Make all methods throw errors
      Object.keys(mockCliAgentService).forEach((key) => {
        try {
          const method = mockCliAgentService[key as keyof typeof mockCliAgentService];
          if (method && typeof method === 'function' && 'mockImplementation' in method) {
            (method as ReturnType<typeof vi.fn>).mockImplementation(() => {
              throw new Error('Test error');
            });
          }
        } catch (_e) {
          // Ignore errors when setting up error scenarios
        }
      });

      // All operations should handle errors gracefully
      service.startHeartbeat();
      expect(service.isCliAgentConnected('terminal1')).toBe(false);
      expect(service.isCliAgentRunning('terminal1')).toBe(false);
      expect(service.getCurrentGloballyActiveAgent()).toBeNull();
      expect(service.refreshCliAgentState()).toBe(false);
      service.handleTerminalOutputForCliAgent('terminal1', 'data');
      service.handleTerminalInputForCliAgent('terminal1', 'data');
      expect(service.getAgentType('terminal1')).toBeNull();
      expect(service.getConnectedAgents().length).toBe(0);
      expect(service.getDisconnectedAgents().size).toBe(0);
      expect(service.getConnectedAgentTerminalId()).toBeNull();
      expect(service.getConnectedAgentType()).toBeNull();
      service.handleTerminalRemoved('terminal1');

      const switchResult = service.switchAiAgentConnection('terminal1');
      expect(switchResult.success).toBe(false);

      service.dispose();
    });
  });
});
