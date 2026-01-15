import { describe, it, expect, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { TerminalManager } from '../../../../terminals/TerminalManager';
import { ICliAgentDetectionService } from '../../../../interfaces/CliAgentService';

const createMockCliAgentService = (
  connectedAgent: { terminalId: string; type: string } | null
): ICliAgentDetectionService => {
  const statusEmitter = new vscode.EventEmitter<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }>();

  return {
    detectFromInput: vi.fn().mockReturnValue(null),
    detectFromOutput: vi.fn().mockReturnValue(null),
    detectTermination: vi.fn().mockReturnValue({
      isTerminated: false,
      confidence: 0,
      reason: '',
    }),
    getAgentState: vi.fn().mockReturnValue({ status: 'none', agentType: null }),
    getConnectedAgent: vi.fn().mockReturnValue(connectedAgent),
    getDisconnectedAgents: vi.fn().mockReturnValue(new Map()),
    switchAgentConnection: vi.fn().mockReturnValue({
      success: false,
      newStatus: 'none',
      agentType: null,
    }),
    onCliAgentStatusChange: statusEmitter.event,
    handleTerminalRemoved: vi.fn(),
    dispose: vi.fn(() => statusEmitter.dispose()),
    startHeartbeat: vi.fn(),
    refreshAgentState: vi.fn().mockReturnValue(true),
    forceReconnectAgent: vi.fn().mockReturnValue(false),
    clearDetectionError: vi.fn().mockReturnValue(false),
    setAgentConnected: vi.fn(),
  };
};

describe('TerminalManager - getConnectedAgentType', () => {
  let terminalManager: TerminalManager | null = null;

  afterEach(() => {
    terminalManager?.dispose();
    terminalManager = null;
  });

  it('returns null when no agent is connected', () => {
    const mockService = createMockCliAgentService(null);
    terminalManager = new TerminalManager(mockService);

    expect(terminalManager.getConnectedAgentType()).toBeNull();
  });

  it('returns copilot when a copilot agent is connected', () => {
    const mockService = createMockCliAgentService({ terminalId: 'term-1', type: 'copilot' });
    terminalManager = new TerminalManager(mockService);

    expect(terminalManager.getConnectedAgentType()).toBe('copilot');
  });

  it('returns null for unknown agent types', () => {
    const mockService = createMockCliAgentService({ terminalId: 'term-1', type: 'mystery' });
    terminalManager = new TerminalManager(mockService);

    expect(terminalManager.getConnectedAgentType()).toBeNull();
  });
});
