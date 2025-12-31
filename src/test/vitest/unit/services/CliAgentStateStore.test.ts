import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CliAgentStateStore } from '../../../../services/CliAgentStateStore';
import * as vscode from 'vscode';

// Mock dependencies
vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

// Mock vscode.EventEmitter
const mockEventEmitter = {
  fire: vi.fn(),
  event: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('vscode', () => ({
  EventEmitter: class {
    fire = mockEventEmitter.fire;
    event = mockEventEmitter.event;
    dispose = mockEventEmitter.dispose;
  },
}));

describe('CliAgentStateStore', () => {
  let store: CliAgentStateStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new CliAgentStateStore();
  });

  describe('setConnectedAgent', () => {
    it('should set connected agent and notify observers', () => {
      const observer = vi.fn();
      store.subscribe(observer);

      store.setConnectedAgent('term-1', 'gemini', 'Terminal 1');

      expect(store.isAgentConnected('term-1')).toBe(true);
      expect(store.getConnectedAgentTerminalId()).toBe('term-1');
      expect(store.getConnectedAgentType()).toBe('gemini');
      
      const expectedEvent = {
        terminalId: 'term-1',
        status: 'connected',
        type: 'gemini',
        terminalName: 'Terminal 1',
      };
      expect(observer).toHaveBeenCalledWith(expectedEvent);
      expect(mockEventEmitter.fire).toHaveBeenCalledWith(expectedEvent);
    });

    it('should move previous agent to disconnected', () => {
      store.setConnectedAgent('term-1', 'gemini');
      store.setConnectedAgent('term-2', 'claude');

      expect(store.isAgentConnected('term-2')).toBe(true);
      expect(store.isAgentConnected('term-1')).toBe(false);
      
      const disconnected = store.getDisconnectedAgents();
      expect(disconnected.has('term-1')).toBe(true);
      expect(disconnected.get('term-1')?.type).toBe('gemini');
    });

    it('should block promotion if within grace period', () => {
      vi.useFakeTimers();
      
      // Setup disconnected agent
      store.setConnectedAgent('term-1', 'gemini');
      store.setConnectedAgent('term-2', 'claude'); // term-1 becomes disconnected
      
      // Attempt to reconnect term-1 immediately
      store.setConnectedAgent('term-1', 'gemini');
      
      // Should still be term-2 connected
      expect(store.getConnectedAgentTerminalId()).toBe('term-2');
      
      vi.useRealTimers();
    });
  });

  describe('setAgentTerminated', () => {
    it('should terminate connected agent and promote disconnected', () => {
      store.setConnectedAgent('term-1', 'gemini');
      store.setConnectedAgent('term-2', 'claude'); // term-1 disconnected
      
      store.setAgentTerminated('term-2');
      
      expect(store.getConnectedAgentTerminalId()).toBe('term-1'); // promoted
      expect(store.getAgentState('term-2')?.status).toBe('none');
    });
  });

  describe('removeTerminalCompletely', () => {
    it('should remove state and promote disconnected', () => {
      store.setConnectedAgent('term-1', 'gemini');
      store.setConnectedAgent('term-2', 'claude'); // term-1 disconnected
      
      store.removeTerminalCompletely('term-2');
      
      expect(store.getAgentState('term-2')).toBeNull();
      expect(store.getConnectedAgentTerminalId()).toBe('term-1'); // promoted
    });
  });

  describe('forceReconnectAgent', () => {
    it('should bypass grace period', () => {
      store.setConnectedAgent('term-1', 'gemini');
      store.setConnectedAgent('term-2', 'claude'); // term-1 disconnected
      
      store.forceReconnectAgent('term-1', 'gemini');
      
      expect(store.getConnectedAgentTerminalId()).toBe('term-1');
    });
  });

  describe('clearDetectionError', () => {
    it('should reset terminal state to none', () => {
      store.setConnectedAgent('term-1', 'gemini');
      store.clearDetectionError('term-1');
      
      expect(store.getConnectedAgentTerminalId()).toBeNull();
      expect(store.getAgentState('term-1')?.status).toBe('none');
    });
  });

  describe('subscribe', () => {
    it('should return disposable', () => {
      const observer = vi.fn();
      const disposable = store.subscribe(observer);
      
      store.setConnectedAgent('term-1', 'gemini');
      expect(observer).toHaveBeenCalled();
      
      observer.mockClear();
      disposable.dispose();
      
      store.setConnectedAgent('term-2', 'claude');
      expect(observer).not.toHaveBeenCalled();
    });
  });

  describe('getStateStats', () => {
    it('should return correct counts', () => {
      store.setConnectedAgent('term-1', 'gemini');
      store.setConnectedAgent('term-2', 'claude'); // 1 connected (term-2), 1 disconnected (term-1)
      
      const stats = store.getStateStats();
      expect(stats.totalAgents).toBe(2);
      expect(stats.connectedAgents).toBe(1);
      expect(stats.disconnectedAgents).toBe(1);
      expect(stats.agentTypes).toContain('gemini');
      expect(stats.agentTypes).toContain('claude');
    });
  });
});
