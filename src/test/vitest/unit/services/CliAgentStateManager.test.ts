import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CliAgentStateManager } from '../../../../services/CliAgentStateManager';
import * as vscode from 'vscode';

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

vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

describe('CliAgentStateManager', () => {
  let manager: CliAgentStateManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new CliAgentStateManager();
  });

  describe('setConnectedAgent', () => {
    it('should set connected agent', () => {
      manager.setConnectedAgent('term-1', 'gemini');
      expect(manager.isAgentConnected('term-1')).toBe(true);
      expect(manager.getConnectedAgentType()).toBe('gemini');
      expect(mockEventEmitter.fire).toHaveBeenCalledWith({
        terminalId: 'term-1',
        status: 'connected',
        type: 'gemini',
        terminalName: undefined,
      });
    });

    it('should handle transition from one agent to another', () => {
      manager.setConnectedAgent('term-1', 'gemini');
      
      // Connect new agent
      manager.setConnectedAgent('term-2', 'claude');
      
      expect(manager.isAgentConnected('term-2')).toBe(true);
      expect(manager.getConnectedAgentType()).toBe('claude');
      
      // Previous agent should be moved to disconnected
      const disconnected = manager.getDisconnectedAgents();
      expect(disconnected.has('term-1')).toBe(true);
      expect(disconnected.get('term-1')?.type).toBe('gemini');
    });

    it('should skip if same agent connected', () => {
      manager.setConnectedAgent('term-1', 'gemini');
      mockEventEmitter.fire.mockClear();
      
      manager.setConnectedAgent('term-1', 'gemini');
      expect(mockEventEmitter.fire).not.toHaveBeenCalled();
    });
  });

  describe('setAgentTerminated', () => {
    it('should terminate connected agent', () => {
      manager.setConnectedAgent('term-1', 'gemini');
      manager.setAgentTerminated('term-1');
      
      expect(manager.isAgentConnected('term-1')).toBe(false);
      expect(mockEventEmitter.fire).toHaveBeenCalledWith({
        terminalId: 'term-1',
        status: 'none',
        type: null,
      });
    });

    it('should terminate disconnected agent', () => {
      manager.setConnectedAgent('term-1', 'gemini');
      manager.setConnectedAgent('term-2', 'claude'); // term-1 moves to disconnected
      
      manager.setAgentTerminated('term-1');
      const disconnected = manager.getDisconnectedAgents();
      expect(disconnected.has('term-1')).toBe(false);
    });

    it('should promote latest disconnected agent when connected agent terminates', () => {
      manager.setConnectedAgent('term-1', 'gemini');
      manager.setConnectedAgent('term-2', 'claude'); // term-1 moves to disconnected
      
      mockEventEmitter.fire.mockClear();
      
      // Terminate term-2
      manager.setAgentTerminated('term-2');
      
      // Should auto-promote term-1
      expect(manager.isAgentConnected('term-1')).toBe(true);
      expect(manager.getConnectedAgentType()).toBe('gemini');
    });
  });

  describe('promoteDisconnectedAgentToConnected', () => {
    it('should promote disconnected agent', () => {
      manager.setConnectedAgent('term-1', 'gemini');
      manager.setConnectedAgent('term-2', 'claude'); // term-1 moves to disconnected
      
      manager.promoteDisconnectedAgentToConnected('term-1');
      
      expect(manager.isAgentConnected('term-1')).toBe(true);
      const disconnected = manager.getDisconnectedAgents();
      expect(disconnected.has('term-2')).toBe(true); // term-2 moved to disconnected
    });

    it('should ignore if not disconnected', () => {
      manager.promoteDisconnectedAgentToConnected('term-1');
      expect(mockEventEmitter.fire).not.toHaveBeenCalled();
    });
  });

  describe('forceReconnectAgent', () => {
    it('should force reconnect agent', () => {
      manager.forceReconnectAgent('term-1', 'gemini');
      expect(manager.isAgentConnected('term-1')).toBe(true);
      expect(mockEventEmitter.fire).toHaveBeenCalledWith(expect.objectContaining({
        status: 'connected',
        type: 'gemini'
      }));
    });
  });

  describe('clearDetectionError', () => {
    it('should clear connected state', () => {
      manager.setConnectedAgent('term-1', 'gemini');
      manager.clearDetectionError('term-1');
      expect(manager.isAgentConnected('term-1')).toBe(false);
      expect(mockEventEmitter.fire).toHaveBeenCalledWith({
        terminalId: 'term-1',
        status: 'none',
        type: null
      });
    });

    it('should clear disconnected state', () => {
      manager.setConnectedAgent('term-1', 'gemini');
      manager.setConnectedAgent('term-2', 'claude');
      manager.clearDetectionError('term-1');
      const disconnected = manager.getDisconnectedAgents();
      expect(disconnected.has('term-1')).toBe(false);
    });
  });
});
