/**
 * CliAgentStateManager Unit Tests
 *
 * Tests for CLI Agent state management including:
 * - Agent state CRUD operations
 * - Agent activity detection
 * - Connection state management
 * - State synchronization
 * - Statistics and reporting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CliAgentStateManager,
  CliAgentState,
} from '../../../../../webview/managers/CliAgentStateManager';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

describe('CliAgentStateManager', () => {
  let manager: CliAgentStateManager;

  beforeEach(() => {
    manager = new CliAgentStateManager();
  });

  afterEach(() => {
    manager.dispose();
    vi.clearAllMocks();
  });

  describe('getAgentState', () => {
    it('should return null for unknown terminal', () => {
      expect(manager.getAgentState('unknown-terminal')).toBeNull();
    });

    it('should return state for known terminal', () => {
      manager.setAgentState('terminal-1', { status: 'connected', agentType: 'claude' });

      const state = manager.getAgentState('terminal-1');

      expect(state).not.toBeNull();
      expect(state?.status).toBe('connected');
      expect(state?.agentType).toBe('claude');
    });
  });

  describe('setAgentState', () => {
    it('should create new state with defaults', () => {
      manager.setAgentState('terminal-1', {});

      const state = manager.getAgentState('terminal-1');

      expect(state?.status).toBe('none');
      expect(state?.agentType).toBeNull();
      expect(state?.preserveScrollPosition).toBe(false);
      expect(state?.isDisplayingChoices).toBe(false);
    });

    it('should merge partial state with existing', () => {
      manager.setAgentState('terminal-1', { status: 'connected', agentType: 'claude' });
      manager.setAgentState('terminal-1', { preserveScrollPosition: true });

      const state = manager.getAgentState('terminal-1');

      expect(state?.status).toBe('connected');
      expect(state?.agentType).toBe('claude');
      expect(state?.preserveScrollPosition).toBe(true);
    });

    it('should update currentConnectedAgentId when status is connected', () => {
      manager.setAgentState('terminal-1', { status: 'connected' });

      expect(manager.getCurrentConnectedAgentId()).toBe('terminal-1');
    });

    it('should clear currentConnectedAgentId when disconnected', () => {
      manager.setAgentState('terminal-1', { status: 'connected' });
      manager.setAgentState('terminal-1', { status: 'disconnected' });

      expect(manager.getCurrentConnectedAgentId()).toBeNull();
    });

    it('should not clear currentConnectedAgentId for different terminal', () => {
      manager.setAgentState('terminal-1', { status: 'connected' });
      manager.setAgentState('terminal-2', { status: 'disconnected' });

      expect(manager.getCurrentConnectedAgentId()).toBe('terminal-1');
    });
  });

  describe('getCurrentConnectedAgentId', () => {
    it('should return null when no agent is connected', () => {
      expect(manager.getCurrentConnectedAgentId()).toBeNull();
    });

    it('should return the connected agent ID', () => {
      manager.setAgentState('terminal-1', { status: 'connected' });

      expect(manager.getCurrentConnectedAgentId()).toBe('terminal-1');
    });

    it('should update when a new agent connects', () => {
      manager.setAgentState('terminal-1', { status: 'connected' });
      manager.setAgentState('terminal-2', { status: 'connected' });

      expect(manager.getCurrentConnectedAgentId()).toBe('terminal-2');
    });
  });

  describe('getAllAgentStates', () => {
    it('should return empty map when no agents', () => {
      const states = manager.getAllAgentStates();

      expect(states.size).toBe(0);
    });

    it('should return copy of all states', () => {
      manager.setAgentState('terminal-1', { status: 'connected' });
      manager.setAgentState('terminal-2', { status: 'disconnected' });

      const states = manager.getAllAgentStates();

      expect(states.size).toBe(2);
      expect(states.get('terminal-1')?.status).toBe('connected');
      expect(states.get('terminal-2')?.status).toBe('disconnected');
    });

    it('should return a copy, not the original map', () => {
      manager.setAgentState('terminal-1', { status: 'connected' });

      const states1 = manager.getAllAgentStates();
      const states2 = manager.getAllAgentStates();

      expect(states1).not.toBe(states2);
    });
  });

  describe('detectAgentActivity', () => {
    it('should detect Claude Code output', () => {
      const result = manager.detectAgentActivity('Welcome to Claude Code!', 'terminal-1');

      expect(result.isAgentOutput).toBe(true);
      expect(result.agentType).toBe('claude');
    });

    it('should detect Gemini Code output (case insensitive)', () => {
      const result = manager.detectAgentActivity('Gemini Code Assistant', 'terminal-1');

      expect(result.isAgentOutput).toBe(true);
      expect(result.agentType).toBe('gemini');
    });

    it('should detect generic AI type but not as agent output', () => {
      // AGENT_TYPE_PATTERNS matches AI|Assistant|Agent for agentType detection
      // But AGENT_OUTPUT_PATTERNS doesn't include these generic patterns
      // So the text is categorized but not detected as "agent output"
      const result = manager.detectAgentActivity('AI Assistant is ready', 'terminal-1');

      // isAgentOutput is false because it doesn't match AGENT_OUTPUT_PATTERNS
      expect(result.isAgentOutput).toBe(false);
      // agentType is detected because it matches AGENT_TYPE_PATTERNS
      expect(result.agentType).toBe('generic');
    });

    it('should detect Thinking/Processing patterns', () => {
      const result = manager.detectAgentActivity('Thinking about your request...', 'terminal-1');

      expect(result.isAgentOutput).toBe(true);
    });

    it('should detect choice display patterns', () => {
      const result = manager.detectAgentActivity('Select an option:\n[1] Option A\n[2] Option B', 'terminal-1');

      expect(result.isAgentOutput).toBe(true);
      expect(result.isDisplayingChoices).toBe(true);
    });

    it('should return false for non-agent output', () => {
      const result = manager.detectAgentActivity('$ ls -la', 'terminal-1');

      expect(result.isAgentOutput).toBe(false);
      expect(result.agentType).toBeNull();
      expect(result.isDisplayingChoices).toBe(false);
    });

    it('should update terminal state when agent detected', () => {
      manager.detectAgentActivity('Claude Code starting...', 'terminal-1');

      const state = manager.getAgentState('terminal-1');

      expect(state?.status).toBe('connected');
      expect(state?.agentType).toBe('claude');
    });

    it('should handle errors gracefully', () => {
      // Even with unusual input, should not throw
      const result = manager.detectAgentActivity('', 'terminal-1');

      expect(result.isAgentOutput).toBe(false);
    });
  });

  describe('setAgentConnected', () => {
    it('should set connected state with agent type', () => {
      manager.setAgentConnected('terminal-1', 'claude');

      const state = manager.getAgentState('terminal-1');

      expect(state?.status).toBe('connected');
      expect(state?.agentType).toBe('claude');
      expect(state?.preserveScrollPosition).toBe(true);
    });

    it('should use custom terminal name if provided', () => {
      manager.setAgentConnected('terminal-1', 'claude', 'My Custom Terminal');

      const state = manager.getAgentState('terminal-1');

      expect(state?.terminalName).toBe('My Custom Terminal');
    });

    it('should use default terminal name if not provided', () => {
      manager.setAgentConnected('terminal-1', 'gemini');

      const state = manager.getAgentState('terminal-1');

      expect(state?.terminalName).toBe('Terminal terminal-1');
    });
  });

  describe('setAgentDisconnected', () => {
    it('should set disconnected state', () => {
      manager.setAgentConnected('terminal-1', 'claude');
      manager.setAgentDisconnected('terminal-1');

      const state = manager.getAgentState('terminal-1');

      expect(state?.status).toBe('disconnected');
      expect(state?.preserveScrollPosition).toBe(false);
      expect(state?.isDisplayingChoices).toBe(false);
    });

    it('should do nothing for unknown terminal', () => {
      // Should not throw
      expect(() => manager.setAgentDisconnected('unknown-terminal')).not.toThrow();
    });

    it('should preserve agent type after disconnect', () => {
      manager.setAgentConnected('terminal-1', 'claude');
      manager.setAgentDisconnected('terminal-1');

      const state = manager.getAgentState('terminal-1');

      expect(state?.agentType).toBe('claude');
    });
  });

  describe('clearAgentState', () => {
    it('should reset state to defaults', () => {
      manager.setAgentConnected('terminal-1', 'claude');
      manager.clearAgentState('terminal-1');

      const state = manager.getAgentState('terminal-1');

      expect(state?.status).toBe('none');
      expect(state?.agentType).toBeNull();
      expect(state?.preserveScrollPosition).toBe(false);
      expect(state?.isDisplayingChoices).toBe(false);
      expect(state?.lastChoiceDetected).toBeUndefined();
    });
  });

  describe('removeTerminalState', () => {
    it('should remove state completely', () => {
      manager.setAgentConnected('terminal-1', 'claude');
      manager.removeTerminalState('terminal-1');

      expect(manager.getAgentState('terminal-1')).toBeNull();
    });

    it('should clear currentConnectedAgentId if removing connected terminal', () => {
      manager.setAgentConnected('terminal-1', 'claude');
      manager.removeTerminalState('terminal-1');

      expect(manager.getCurrentConnectedAgentId()).toBeNull();
    });

    it('should not affect currentConnectedAgentId for other terminals', () => {
      manager.setAgentConnected('terminal-1', 'claude');
      manager.setAgentState('terminal-2', { status: 'disconnected' });
      manager.removeTerminalState('terminal-2');

      expect(manager.getCurrentConnectedAgentId()).toBe('terminal-1');
    });
  });

  describe('isAgentDisplayingChoices', () => {
    it('should return false for unknown terminal', () => {
      expect(manager.isAgentDisplayingChoices('unknown')).toBe(false);
    });

    it('should return true when displaying choices', () => {
      manager.setAgentState('terminal-1', { isDisplayingChoices: true });

      expect(manager.isAgentDisplayingChoices('terminal-1')).toBe(true);
    });

    it('should return false when not displaying choices', () => {
      manager.setAgentState('terminal-1', { isDisplayingChoices: false });

      expect(manager.isAgentDisplayingChoices('terminal-1')).toBe(false);
    });
  });

  describe('shouldPreserveScrollPosition', () => {
    it('should return false for unknown terminal', () => {
      expect(manager.shouldPreserveScrollPosition('unknown')).toBe(false);
    });

    it('should return true when preserveScrollPosition is true', () => {
      manager.setAgentState('terminal-1', { preserveScrollPosition: true });

      expect(manager.shouldPreserveScrollPosition('terminal-1')).toBe(true);
    });

    it('should return false when preserveScrollPosition is false', () => {
      manager.setAgentState('terminal-1', { preserveScrollPosition: false });

      expect(manager.shouldPreserveScrollPosition('terminal-1')).toBe(false);
    });
  });

  describe('getAgentStats', () => {
    it('should return zeros for empty manager', () => {
      const stats = manager.getAgentStats();

      expect(stats.totalAgents).toBe(0);
      expect(stats.connectedAgents).toBe(0);
      expect(stats.disconnectedAgents).toBe(0);
      expect(stats.currentConnectedId).toBeNull();
      expect(stats.agentTypes).toEqual([]);
    });

    it('should count agents correctly', () => {
      manager.setAgentConnected('terminal-1', 'claude');
      manager.setAgentConnected('terminal-2', 'gemini');
      manager.setAgentDisconnected('terminal-2');
      manager.setAgentState('terminal-3', { status: 'none' });

      const stats = manager.getAgentStats();

      expect(stats.totalAgents).toBe(3);
      expect(stats.connectedAgents).toBe(1);
      expect(stats.disconnectedAgents).toBe(1);
    });

    it('should list unique agent types', () => {
      manager.setAgentConnected('terminal-1', 'claude');
      manager.setAgentConnected('terminal-2', 'gemini');
      manager.setAgentConnected('terminal-3', 'claude');

      const stats = manager.getAgentStats();

      expect(stats.agentTypes).toContain('claude');
      expect(stats.agentTypes).toContain('gemini');
      expect(stats.agentTypes.length).toBe(2);
    });

    it('should return current connected ID', () => {
      manager.setAgentConnected('terminal-1', 'claude');

      const stats = manager.getAgentStats();

      expect(stats.currentConnectedId).toBe('terminal-1');
    });
  });

  describe('getStateForExtension', () => {
    it('should return null for unknown terminal', () => {
      expect(manager.getStateForExtension('unknown')).toBeNull();
    });

    it('should return extension-friendly state', () => {
      manager.setAgentConnected('terminal-1', 'claude', 'My Terminal');

      const state = manager.getStateForExtension('terminal-1');

      expect(state).toEqual({
        activeTerminalName: 'My Terminal',
        status: 'connected',
        agentType: 'claude',
        terminalId: 'terminal-1',
      });
    });
  });

  describe('getFullStateSync', () => {
    it('should return complete state snapshot', () => {
      manager.setAgentConnected('terminal-1', 'claude');
      manager.setAgentState('terminal-2', { status: 'disconnected', agentType: 'gemini' });

      const sync = manager.getFullStateSync();

      expect(sync.allAgents.size).toBe(2);
      expect(sync.currentConnectedId).toBe('terminal-1');
      expect(sync.timestamp).toBeGreaterThan(0);
    });

    it('should return a copy of the state', () => {
      manager.setAgentConnected('terminal-1', 'claude');

      const sync1 = manager.getFullStateSync();
      const sync2 = manager.getFullStateSync();

      expect(sync1.allAgents).not.toBe(sync2.allAgents);
    });
  });

  describe('applyFullStateSync', () => {
    it('should apply synced state', () => {
      const syncData = {
        allAgents: new Map<string, CliAgentState>([
          ['terminal-1', {
            status: 'connected' as const,
            terminalName: 'Terminal 1',
            agentType: 'claude',
            preserveScrollPosition: true,
            isDisplayingChoices: false,
          }],
          ['terminal-2', {
            status: 'disconnected' as const,
            terminalName: 'Terminal 2',
            agentType: 'gemini',
            preserveScrollPosition: false,
            isDisplayingChoices: false,
          }],
        ]),
        currentConnectedId: 'terminal-1',
      };

      manager.applyFullStateSync(syncData);

      expect(manager.getAllAgentStates().size).toBe(2);
      expect(manager.getCurrentConnectedAgentId()).toBe('terminal-1');
      expect(manager.getAgentState('terminal-1')?.agentType).toBe('claude');
    });

    it('should clear existing state before applying', () => {
      manager.setAgentConnected('terminal-old', 'old-agent');

      const syncData = {
        allAgents: new Map<string, CliAgentState>([
          ['terminal-new', {
            status: 'connected' as const,
            terminalName: 'Terminal New',
            agentType: 'new-agent',
            preserveScrollPosition: true,
            isDisplayingChoices: false,
          }],
        ]),
        currentConnectedId: 'terminal-new',
      };

      manager.applyFullStateSync(syncData);

      expect(manager.getAgentState('terminal-old')).toBeNull();
      expect(manager.getAgentState('terminal-new')).not.toBeNull();
    });
  });

  describe('dispose', () => {
    it('should clear all states', () => {
      manager.setAgentConnected('terminal-1', 'claude');
      manager.setAgentConnected('terminal-2', 'gemini');

      manager.dispose();

      expect(manager.getAllAgentStates().size).toBe(0);
      expect(manager.getCurrentConnectedAgentId()).toBeNull();
    });
  });

  describe('Agent Detection Patterns', () => {
    it('should detect Claude Code with proper capitalization', () => {
      const result = manager.detectAgentActivity('Claude Code is running', 'terminal-1');
      expect(result.agentType).toBe('claude');
    });

    it('should not detect "claude code" in lowercase', () => {
      const result = manager.detectAgentActivity('claude code is running', 'terminal-1');
      // Pattern requires "Claude Code" with capitals
      expect(result.agentType).not.toBe('claude');
    });

    it('should detect gemini code case-insensitively', () => {
      const result1 = manager.detectAgentActivity('GEMINI CODE', 'terminal-1');
      const result2 = manager.detectAgentActivity('gemini code', 'terminal-2');

      expect(result1.agentType).toBe('gemini');
      expect(result2.agentType).toBe('gemini');
    });

    it('should detect Analyzing pattern', () => {
      const result = manager.detectAgentActivity('Analyzing your code...', 'terminal-1');
      expect(result.isAgentOutput).toBe(true);
    });

    it('should detect Processing pattern', () => {
      const result = manager.detectAgentActivity('Processing request...', 'terminal-1');
      expect(result.isAgentOutput).toBe(true);
    });

    it('should detect Choice patterns with numbers', () => {
      const result = manager.detectAgentActivity('[1] First option\n[2] Second option', 'terminal-1');
      expect(result.isDisplayingChoices).toBe(true);
    });
  });
});
