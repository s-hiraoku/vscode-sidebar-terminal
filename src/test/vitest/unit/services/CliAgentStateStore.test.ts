import { describe, it, expect } from 'vitest';
import { CliAgentStateStore } from '../../../../services/CliAgentStateStore';

describe('CliAgentStateStore', () => {
  describe('forceReconnectAgent', () => {
    it('should move the previous CONNECTED agent to DISCONNECTED when forcing reconnect in another terminal', () => {
      const store = new CliAgentStateStore();

      const events: Array<{ terminalId: string; status: string; type: string | null }> = [];
      store.subscribe((e) => events.push({ terminalId: e.terminalId, status: e.status, type: e.type }));

      store.setConnectedAgent('t1', 'claude', 'Terminal 1');
      expect(store.getConnectedAgentTerminalId()).toBe('t1');

      store.forceReconnectAgent('t2', 'gemini', 'Terminal 2');

      expect(store.getConnectedAgentTerminalId()).toBe('t2');
      expect(store.getConnectedAgentType()).toBe('gemini');

      // Regression: previously t1 became 'none' even though the agent is still running.
      expect(store.getAgentState('t1')?.status).toBe('disconnected');
      expect(store.getAgentState('t1')?.agentType).toBe('claude');
      expect(store.getDisconnectedAgents().get('t1')?.type).toBe('claude');

      expect(store.getAgentState('t2')?.status).toBe('connected');
      expect(store.getAgentState('t2')?.agentType).toBe('gemini');

      // Ensure observers learn about both state changes.
      const disconnected = events.find((e) => e.terminalId === 't1' && e.status === 'disconnected');
      const connected = events.find((e) => e.terminalId === 't2' && e.status === 'connected');
      expect(disconnected).toBeTruthy();
      expect(connected).toBeTruthy();
    });
  });
});

