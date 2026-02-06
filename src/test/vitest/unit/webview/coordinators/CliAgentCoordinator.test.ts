/**
 * CliAgentCoordinator Tests
 *
 * Tests for CLI Agent management methods extracted from LightweightTerminalWebviewManager.
 * Covers: getCliAgentState, setCliAgentConnected, setCliAgentDisconnected,
 *         handleAiAgentToggle, updateClaudeStatus, updateCliAgentStatus
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CliAgentCoordinator,
  ICliAgentCoordinatorDependencies,
} from '../../../../../webview/coordinators/CliAgentCoordinator';

function createMockDeps(): ICliAgentCoordinatorDependencies {
  return {
    getAgentState: vi.fn().mockReturnValue(null),
    setAgentConnected: vi.fn(),
    setAgentDisconnected: vi.fn(),
    setAgentState: vi.fn(),
    removeTerminalState: vi.fn(),
    getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
    getAllTerminalInstances: vi.fn().mockReturnValue(new Map()),
    postMessageToExtension: vi.fn(),
    updateCliAgentStatusUI: vi.fn(),
  };
}

describe('CliAgentCoordinator', () => {
  let coordinator: CliAgentCoordinator;
  let deps: ICliAgentCoordinatorDependencies;

  beforeEach(() => {
    deps = createMockDeps();
    coordinator = new CliAgentCoordinator(deps);
  });

  describe('getCliAgentState', () => {
    it('should delegate to deps.getAgentState', () => {
      const mockState = { status: 'connected' as const, agentType: 'claude' };
      vi.mocked(deps.getAgentState).mockReturnValue(mockState);

      const result = coordinator.getCliAgentState('terminal-1');

      expect(deps.getAgentState).toHaveBeenCalledWith('terminal-1');
      expect(result).toBe(mockState);
    });
  });

  describe('setCliAgentConnected', () => {
    it('should delegate to deps.setAgentConnected', () => {
      coordinator.setCliAgentConnected('terminal-1', 'claude', 'My Terminal');

      expect(deps.setAgentConnected).toHaveBeenCalledWith('terminal-1', 'claude', 'My Terminal');
    });
  });

  describe('setCliAgentDisconnected', () => {
    it('should delegate to deps.setAgentDisconnected', () => {
      coordinator.setCliAgentDisconnected('terminal-1');

      expect(deps.setAgentDisconnected).toHaveBeenCalledWith('terminal-1');
    });
  });

  describe('handleAiAgentToggle', () => {
    it('should send force-reconnect when agent is already connected', () => {
      vi.mocked(deps.getAgentState).mockReturnValue({
        status: 'connected',
        agentType: 'claude',
      });

      coordinator.handleAiAgentToggle('terminal-1');

      expect(deps.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'switchAiAgent',
          terminalId: 'terminal-1',
          action: 'force-reconnect',
          forceReconnect: true,
          agentType: 'claude',
        })
      );
    });

    it('should send activate when agent is disconnected', () => {
      vi.mocked(deps.getAgentState).mockReturnValue({
        status: 'disconnected',
        agentType: null,
      });

      coordinator.handleAiAgentToggle('terminal-1');

      expect(deps.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'switchAiAgent',
          terminalId: 'terminal-1',
          action: 'activate',
        })
      );
    });

    it('should send activate when agent state is none', () => {
      vi.mocked(deps.getAgentState).mockReturnValue(null);

      coordinator.handleAiAgentToggle('terminal-1');

      expect(deps.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'switchAiAgent',
          terminalId: 'terminal-1',
          action: 'activate',
        })
      );
    });

    it('should fallback to activate on error', () => {
      vi.mocked(deps.getAgentState).mockImplementation(() => {
        throw new Error('State error');
      });

      coordinator.handleAiAgentToggle('terminal-1');

      expect(deps.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'switchAiAgent',
          terminalId: 'terminal-1',
          action: 'activate',
        })
      );
    });
  });

  describe('updateClaudeStatus', () => {
    it('should update state and UI for active terminal when name is null', () => {
      coordinator.updateClaudeStatus(null, 'connected', 'claude');

      expect(deps.setAgentState).toHaveBeenCalledWith('terminal-1', {
        status: 'connected',
        terminalName: 'Terminal terminal-1',
        agentType: 'claude',
      });
      expect(deps.updateCliAgentStatusUI).toHaveBeenCalledWith(
        'terminal-1',
        'connected',
        'claude'
      );
    });

    it('should find terminal by name and update', () => {
      const instances = new Map([
        ['terminal-1', { name: 'My Terminal' }],
        ['terminal-2', { name: 'Another Terminal' }],
      ]);
      vi.mocked(deps.getAllTerminalInstances).mockReturnValue(instances as any);

      coordinator.updateClaudeStatus('Another Terminal', 'connected', 'copilot');

      expect(deps.setAgentState).toHaveBeenCalledWith('terminal-2', {
        status: 'connected',
        terminalName: 'Another Terminal',
        agentType: 'copilot',
      });
      expect(deps.updateCliAgentStatusUI).toHaveBeenCalledWith(
        'terminal-2',
        'connected',
        'copilot'
      );
    });

    it('should not update if no active terminal and name not found', () => {
      vi.mocked(deps.getActiveTerminalId).mockReturnValue(null);
      vi.mocked(deps.getAllTerminalInstances).mockReturnValue(new Map());

      coordinator.updateClaudeStatus('Unknown Terminal', 'disconnected', null);

      expect(deps.setAgentState).not.toHaveBeenCalled();
      expect(deps.updateCliAgentStatusUI).not.toHaveBeenCalled();
    });
  });

  describe('updateCliAgentStatus', () => {
    it('should update state and UI for specified terminal', () => {
      coordinator.updateCliAgentStatus('terminal-2', 'connected', 'gemini');

      expect(deps.setAgentState).toHaveBeenCalledWith('terminal-2', {
        status: 'connected',
        agentType: 'gemini',
      });
      expect(deps.updateCliAgentStatusUI).toHaveBeenCalledWith(
        'terminal-2',
        'connected',
        'gemini'
      );
    });
  });
});
