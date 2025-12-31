/**
 * CliAgentUIService Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CliAgentUIService, CliAgentUIServiceDeps } from '../../../../../webview/services/CliAgentUIService';

describe('CliAgentUIService', () => {
  let service: CliAgentUIService;
  let mockDeps: CliAgentUIServiceDeps;
  let mockCliAgentStateManager: any;
  let mockUIManager: any;
  let mockTerminalInstances: Map<string, any>;

  beforeEach(() => {
    mockTerminalInstances = new Map([
      ['terminal-1', { name: 'Terminal 1' }],
      ['terminal-2', { name: 'Terminal 2' }],
    ]);

    mockCliAgentStateManager = {
      setAgentState: vi.fn(),
      getAgentState: vi.fn().mockReturnValue({ status: 'none', agentType: null }),
      setAgentConnected: vi.fn(),
      setAgentDisconnected: vi.fn(),
      removeTerminalState: vi.fn(),
      detectAgentActivity: vi.fn().mockReturnValue(null),
      getAgentStats: vi.fn().mockReturnValue({ total: 0, connected: 0 }),
    };

    mockUIManager = {
      updateCliAgentStatusByTerminalId: vi.fn(),
    };

    mockDeps = {
      cliAgentStateManager: mockCliAgentStateManager,
      uiManager: mockUIManager,
      getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
      getAllTerminalInstances: vi.fn().mockReturnValue(mockTerminalInstances),
    };

    service = new CliAgentUIService(mockDeps);
  });

  describe('updateClaudeStatus', () => {
    it('should update status by terminal name', () => {
      service.updateClaudeStatus('Terminal 2', 'connected', 'claude');

      expect(mockCliAgentStateManager.setAgentState).toHaveBeenCalledWith('terminal-2', {
        status: 'connected',
        terminalName: 'Terminal 2',
        agentType: 'claude',
      });
      expect(mockUIManager.updateCliAgentStatusByTerminalId).toHaveBeenCalledWith(
        'terminal-2',
        'connected',
        'claude'
      );
    });

    it('should use active terminal when name is null', () => {
      service.updateClaudeStatus(null, 'connected', 'claude');

      expect(mockCliAgentStateManager.setAgentState).toHaveBeenCalledWith('terminal-1', {
        status: 'connected',
        terminalName: 'Terminal terminal-1',
        agentType: 'claude',
      });
    });

    it('should fallback to active terminal when name not found', () => {
      service.updateClaudeStatus('Non-existent Terminal', 'connected', 'claude');

      expect(mockCliAgentStateManager.setAgentState).toHaveBeenCalledWith('terminal-1', {
        status: 'connected',
        terminalName: 'Non-existent Terminal',
        agentType: 'claude',
      });
    });
  });

  describe('updateCliAgentStatus', () => {
    it('should update status by terminal ID', () => {
      service.updateCliAgentStatus('terminal-2', 'connected', 'copilot');

      expect(mockCliAgentStateManager.setAgentState).toHaveBeenCalledWith('terminal-2', {
        status: 'connected',
        terminalName: 'Terminal terminal-2',
        agentType: 'copilot',
      });
      expect(mockUIManager.updateCliAgentStatusByTerminalId).toHaveBeenCalledWith(
        'terminal-2',
        'connected',
        'copilot'
      );
    });

    it('should handle disconnection', () => {
      service.updateCliAgentStatus('terminal-1', 'disconnected', null);

      expect(mockCliAgentStateManager.setAgentState).toHaveBeenCalledWith('terminal-1', {
        status: 'disconnected',
        terminalName: 'Terminal terminal-1',
        agentType: null,
      });
    });
  });

  describe('getAgentState', () => {
    it('should return agent state for terminal', () => {
      mockCliAgentStateManager.getAgentState.mockReturnValue({
        status: 'connected',
        agentType: 'claude',
      });

      const state = service.getAgentState('terminal-1');

      expect(state).toEqual({ status: 'connected', agentType: 'claude' });
      expect(mockCliAgentStateManager.getAgentState).toHaveBeenCalledWith('terminal-1');
    });
  });

  describe('setAgentConnected', () => {
    it('should delegate to state manager', () => {
      service.setAgentConnected('terminal-1', 'claude', 'Terminal 1');

      expect(mockCliAgentStateManager.setAgentConnected).toHaveBeenCalledWith(
        'terminal-1',
        'claude',
        'Terminal 1'
      );
    });
  });

  describe('setAgentDisconnected', () => {
    it('should delegate to state manager', () => {
      service.setAgentDisconnected('terminal-1');

      expect(mockCliAgentStateManager.setAgentDisconnected).toHaveBeenCalledWith('terminal-1');
    });
  });

  describe('removeTerminalState', () => {
    it('should delegate to state manager', () => {
      service.removeTerminalState('terminal-1');

      expect(mockCliAgentStateManager.removeTerminalState).toHaveBeenCalledWith('terminal-1');
    });
  });

  describe('detectAgentActivity', () => {
    it('should delegate to state manager', () => {
      service.detectAgentActivity('test data', 'terminal-1');

      expect(mockCliAgentStateManager.detectAgentActivity).toHaveBeenCalledWith(
        'test data',
        'terminal-1'
      );
    });
  });

  describe('getAgentStats', () => {
    it('should delegate to state manager', () => {
      const stats = service.getAgentStats();

      expect(mockCliAgentStateManager.getAgentStats).toHaveBeenCalled();
      expect(stats).toEqual({ total: 0, connected: 0 });
    });
  });
});
