import { describe, it, expect, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { TerminalManager } from '../../../../terminals/TerminalManager';
import { ICliAgentDetectionService } from '../../../../interfaces/CliAgentService';

const createMockCliAgentService = (): ICliAgentDetectionService => {
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
    getConnectedAgent: vi.fn().mockReturnValue(null),
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

describe('TerminalManager - renameTerminal', () => {
  let terminalManager: TerminalManager | null = null;

  afterEach(() => {
    terminalManager?.dispose();
    terminalManager = null;
  });

  it('renames terminal and emits state update', () => {
    terminalManager = new TerminalManager(createMockCliAgentService());

    (terminalManager as any)._terminals.set('t1', {
      id: 't1',
      name: 'Old Name',
      isActive: true,
    });

    const states: any[] = [];
    const disposable = terminalManager.onStateUpdate((state) => states.push(state));

    const renamed = terminalManager.renameTerminal('t1', 'New Name');

    expect(renamed).toBe(true);
    expect((terminalManager as any)._terminals.get('t1').name).toBe('New Name');
    expect(states).toHaveLength(1);
    expect(states[0]?.terminals?.[0]?.name).toBe('New Name');

    disposable.dispose();
  });

  it('returns false when terminal does not exist', () => {
    terminalManager = new TerminalManager(createMockCliAgentService());

    const states: any[] = [];
    const disposable = terminalManager.onStateUpdate((state) => states.push(state));

    const renamed = terminalManager.renameTerminal('missing-terminal', 'New Name');

    expect(renamed).toBe(false);
    expect(states).toHaveLength(0);

    disposable.dispose();
  });

  it('updates terminal header name and indicator color together', () => {
    terminalManager = new TerminalManager(createMockCliAgentService());

    (terminalManager as any)._terminals.set('t1', {
      id: 't1',
      name: 'Old Name',
      isActive: true,
      indicatorColor: '#00FFFF',
    });

    const states: any[] = [];
    const disposable = terminalManager.onStateUpdate((state) => states.push(state));

    const updated = terminalManager.updateTerminalHeader('t1', {
      newName: 'New Name',
      indicatorColor: '#FF69B4',
    });

    expect(updated).toBe(true);
    expect((terminalManager as any)._terminals.get('t1').name).toBe('New Name');
    expect((terminalManager as any)._terminals.get('t1').indicatorColor).toBe('#FF69B4');
    expect(states).toHaveLength(1);
    expect(states[0]?.terminals?.[0]?.name).toBe('New Name');
    expect(states[0]?.terminals?.[0]?.indicatorColor).toBe('#FF69B4');

    disposable.dispose();
  });
});
