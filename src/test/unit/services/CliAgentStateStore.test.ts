/**
 * CLI Agent State Store Unit Tests
 *
 * 🎯 PURPOSE: Test centralized state management with Observer pattern
 * 🚨 CRITICAL: Ensures state consistency and proper notifications
 *
 * Focus Areas:
 * 1. State transitions (none → connected → disconnected)
 * 2. Observer pattern notifications
 * 3. Connected agent management
 * 4. Disconnected agent tracking
 * 5. Agent promotion logic
 * 6. Force reconnect and error clearing
 * 7. Concurrent state changes
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';

import { CliAgentStateStore, StateChangeEvent } from '../../../services/CliAgentStateStore';

describe('🔍 CLI Agent State Store Unit Tests', () => {
  let store: CliAgentStateStore;

  beforeEach(() => {
    store = new CliAgentStateStore();
  });

  afterEach(() => {
    store.dispose();
  });

  // =================== BASIC STATE MANAGEMENT TESTS ===================

  describe('📊 Basic State Management', () => {
    it('should initialize with no connected agent', () => {
      expect(store.getConnectedAgentTerminalId()).to.be.null;
      expect(store.getConnectedAgentType()).to.be.null;
    });

    it('should set agent as connected', () => {
      store.setConnectedAgent('terminal-1', 'claude', 'Terminal 1');

      expect(store.getConnectedAgentTerminalId()).to.equal('terminal-1');
      expect(store.getConnectedAgentType()).to.equal('claude');
      expect(store.isAgentConnected('terminal-1')).to.be.true;
    });

    it('should get agent state', () => {
      store.setConnectedAgent('terminal-1', 'claude');

      const state = store.getAgentState('terminal-1');

      expect(state).to.not.be.null;
      expect(state!.terminalId).to.equal('terminal-1');
      expect(state!.status).to.equal('connected');
      expect(state!.agentType).to.equal('claude');
    });

    it('should return null for non-existent terminal', () => {
      const state = store.getAgentState('non-existent');

      expect(state).to.be.null;
    });
  });

  // =================== STATE TRANSITION TESTS ===================

  describe('🔄 State Transitions', () => {
    it('should transition from none to connected', () => {
      const events: StateChangeEvent[] = [];
      store.subscribe(event => events.push(event));

      store.setConnectedAgent('terminal-1', 'claude');

      expect(events).to.have.lengthOf(1);
      expect(events[0].terminalId).to.equal('terminal-1');
      expect(events[0].status).to.equal('connected');
      expect(events[0].type).to.equal('claude');
    });

    it('should transition from connected to disconnected', () => {
      const events: StateChangeEvent[] = [];

      store.setConnectedAgent('terminal-1', 'claude');
      store.subscribe(event => events.push(event));

      // Set a new connected agent - previous should become disconnected
      store.setConnectedAgent('terminal-2', 'gemini');

      expect(events).to.have.lengthOf(2);
      expect(events[0].terminalId).to.equal('terminal-2');
      expect(events[0].status).to.equal('connected');
      expect(events[1].terminalId).to.equal('terminal-1');
      expect(events[1].status).to.equal('disconnected');
    });

    it('should transition from connected to none', () => {
      const events: StateChangeEvent[] = [];

      store.setConnectedAgent('terminal-1', 'claude');
      store.subscribe(event => events.push(event));

      store.setAgentTerminated('terminal-1');

      expect(events).to.have.lengthOf(1);
      expect(events[0].terminalId).to.equal('terminal-1');
      expect(events[0].status).to.equal('none');
      expect(events[0].type).to.be.null;
    });

    it('should transition from disconnected to none', () => {
      const events: StateChangeEvent[] = [];

      // Create a disconnected agent
      store.setConnectedAgent('terminal-1', 'claude');
      store.setConnectedAgent('terminal-2', 'gemini'); // terminal-1 becomes disconnected

      store.subscribe(event => events.push(event));

      // Terminate disconnected agent
      store.setAgentTerminated('terminal-1');

      expect(events).to.have.lengthOf(1);
      expect(events[0].terminalId).to.equal('terminal-1');
      expect(events[0].status).to.equal('none');
    });
  });

  // =================== OBSERVER PATTERN TESTS ===================

  describe('👀 Observer Pattern', () => {
    it('should notify observers of state changes', () => {
      let notified = false;
      let receivedEvent: StateChangeEvent | null = null;

      store.subscribe(event => {
        notified = true;
        receivedEvent = event;
      });

      store.setConnectedAgent('terminal-1', 'claude');

      expect(notified).to.be.true;
      expect(receivedEvent).to.not.be.null;
      expect(receivedEvent!.terminalId).to.equal('terminal-1');
    });

    it('should support multiple observers', () => {
      const events1: StateChangeEvent[] = [];
      const events2: StateChangeEvent[] = [];

      store.subscribe(event => events1.push(event));
      store.subscribe(event => events2.push(event));

      store.setConnectedAgent('terminal-1', 'claude');

      expect(events1).to.have.lengthOf(1);
      expect(events2).to.have.lengthOf(1);
    });

    it('should allow observer disposal', () => {
      const events: StateChangeEvent[] = [];
      const subscription = store.subscribe(event => events.push(event));

      store.setConnectedAgent('terminal-1', 'claude');
      expect(events).to.have.lengthOf(1);

      subscription.dispose();

      store.setConnectedAgent('terminal-2', 'gemini');
      expect(events).to.have.lengthOf(1); // No new events after disposal
    });

    it('should handle observer errors gracefully', () => {
      store.subscribe(() => {
        throw new Error('Observer error');
      });

      // Should not throw even if observer throws
      expect(() => store.setConnectedAgent('terminal-1', 'claude')).to.not.throw();
    });
  });

  // =================== CONNECTED AGENT MANAGEMENT TESTS ===================

  describe('🔗 Connected Agent Management', () => {
    it('should only have one connected agent at a time', () => {
      store.setConnectedAgent('terminal-1', 'claude');
      store.setConnectedAgent('terminal-2', 'gemini');

      expect(store.getConnectedAgentTerminalId()).to.equal('terminal-2');
      expect(store.getConnectedAgentType()).to.equal('gemini');
      expect(store.isAgentConnected('terminal-1')).to.be.false;
      expect(store.isAgentConnected('terminal-2')).to.be.true;
    });

    it('should prevent duplicate state changes', () => {
      const events: StateChangeEvent[] = [];
      store.subscribe(event => events.push(event));

      store.setConnectedAgent('terminal-1', 'claude');
      store.setConnectedAgent('terminal-1', 'claude'); // Duplicate

      expect(events).to.have.lengthOf(1); // Only one event
    });

    it('should block promotion during grace period', (done) => {
      const events: StateChangeEvent[] = [];
      store.subscribe(event => events.push(event));

      // Set connected, then disconnect
      store.setConnectedAgent('terminal-1', 'claude');
      store.setConnectedAgent('terminal-2', 'gemini'); // terminal-1 becomes disconnected

      // Try to reconnect terminal-1 immediately (should be blocked)
      store.setConnectedAgent('terminal-1', 'claude');

      // terminal-1 should still be disconnected (not promoted)
      expect(store.getConnectedAgentTerminalId()).to.equal('terminal-2');

      // Wait for grace period to pass (>2 seconds)
      setTimeout(() => {
        store.setConnectedAgent('terminal-1', 'claude');
        expect(store.getConnectedAgentTerminalId()).to.equal('terminal-1');
        done();
      }, 2100);
    }).timeout(5000);
  });

  // =================== DISCONNECTED AGENT TRACKING TESTS ===================

  describe('📝 Disconnected Agent Tracking', () => {
    it('should track disconnected agents', () => {
      store.setConnectedAgent('terminal-1', 'claude');
      store.setConnectedAgent('terminal-2', 'gemini'); // terminal-1 becomes disconnected

      const disconnected = store.getDisconnectedAgents();

      expect(disconnected.size).to.equal(1);
      expect(disconnected.has('terminal-1')).to.be.true;
      expect(disconnected.get('terminal-1')!.type).to.equal('claude');
    });

    it('should remove from disconnected when terminated', () => {
      store.setConnectedAgent('terminal-1', 'claude');
      store.setConnectedAgent('terminal-2', 'gemini'); // terminal-1 becomes disconnected

      store.setAgentTerminated('terminal-1');

      const disconnected = store.getDisconnectedAgents();
      expect(disconnected.size).to.equal(0);
    });

    it('should remove from disconnected when reconnected', () => {
      store.setConnectedAgent('terminal-1', 'claude');
      store.setConnectedAgent('terminal-2', 'gemini'); // terminal-1 becomes disconnected

      // Force reconnect (bypasses grace period)
      store.forceReconnectAgent('terminal-1', 'claude');

      const disconnected = store.getDisconnectedAgents();
      expect(disconnected.size).to.equal(1);
      expect(disconnected.has('terminal-1')).to.be.false;
      expect(disconnected.has('terminal-2')).to.be.true; // terminal-2 is now disconnected
    });
  });

  // =================== AGENT PROMOTION TESTS ===================

  describe('🚀 Agent Promotion', () => {
    it('should promote latest disconnected agent when connected terminates', () => {
      const events: StateChangeEvent[] = [];
      store.subscribe(event => events.push(event));

      // Create multiple disconnected agents
      store.setConnectedAgent('terminal-1', 'claude');
      store.setConnectedAgent('terminal-2', 'gemini'); // terminal-1 disconnected
      store.setConnectedAgent('terminal-3', 'codex'); // terminal-2 disconnected

      events.length = 0; // Clear events

      // Terminate connected agent
      store.setAgentTerminated('terminal-3');

      // terminal-2 should be promoted (most recent disconnected)
      expect(store.getConnectedAgentTerminalId()).to.equal('terminal-2');
      expect(store.getConnectedAgentType()).to.equal('gemini');

      // Check events: termination + promotion
      expect(events.length).to.be.greaterThan(1);
    });

    it('should not promote when no disconnected agents exist', () => {
      store.setConnectedAgent('terminal-1', 'claude');
      store.setAgentTerminated('terminal-1');

      expect(store.getConnectedAgentTerminalId()).to.be.null;
      expect(store.getConnectedAgentType()).to.be.null;
    });
  });

  // =================== FORCE RECONNECT TESTS ===================

  describe('🔄 Force Reconnect', () => {
    it('should force reconnect bypassing grace period', () => {
      store.setConnectedAgent('terminal-1', 'claude');
      store.setConnectedAgent('terminal-2', 'gemini'); // terminal-1 disconnected

      // Force reconnect immediately (bypasses grace period)
      const success = store.forceReconnectAgent('terminal-1', 'claude');

      expect(success).to.be.true;
      expect(store.getConnectedAgentTerminalId()).to.equal('terminal-1');
    });

    it('should emit event on force reconnect', () => {
      const events: StateChangeEvent[] = [];
      store.subscribe(event => events.push(event));

      store.setConnectedAgent('terminal-1', 'claude');
      events.length = 0;

      store.forceReconnectAgent('terminal-2', 'gemini');

      expect(events).to.have.lengthOf(2); // disconnect terminal-1, connect terminal-2
    });
  });

  // =================== ERROR CLEARING TESTS ===================

  describe('🧹 Error Clearing', () => {
    it('should clear detection error for connected agent', () => {
      store.setConnectedAgent('terminal-1', 'claude');

      const success = store.clearDetectionError('terminal-1');

      expect(success).to.be.true;
      expect(store.getConnectedAgentTerminalId()).to.be.null;
      expect(store.getAgentState('terminal-1')!.status).to.equal('none');
    });

    it('should clear detection error for disconnected agent', () => {
      store.setConnectedAgent('terminal-1', 'claude');
      store.setConnectedAgent('terminal-2', 'gemini'); // terminal-1 disconnected

      const success = store.clearDetectionError('terminal-1');

      expect(success).to.be.true;
      expect(store.getDisconnectedAgents().has('terminal-1')).to.be.false;
    });

    it('should return false when no state to clear', () => {
      const success = store.clearDetectionError('non-existent');

      expect(success).to.be.false;
    });
  });

  // =================== TERMINAL REMOVAL TESTS ===================

  describe('🗑️ Terminal Removal', () => {
    it('should remove terminal completely', () => {
      store.setConnectedAgent('terminal-1', 'claude');

      store.removeTerminalCompletely('terminal-1');

      expect(store.getAgentState('terminal-1')).to.be.null;
      expect(store.getConnectedAgentTerminalId()).to.be.null;
    });

    it('should emit event on terminal removal', () => {
      const events: StateChangeEvent[] = [];

      store.setConnectedAgent('terminal-1', 'claude');
      store.subscribe(event => events.push(event));

      store.removeTerminalCompletely('terminal-1');

      expect(events).to.have.lengthOf(1);
      expect(events[0].status).to.equal('none');
    });
  });

  // =================== STATE STATISTICS TESTS ===================

  describe('📊 State Statistics', () => {
    it('should provide accurate state statistics', () => {
      store.setConnectedAgent('terminal-1', 'claude');
      store.setConnectedAgent('terminal-2', 'gemini'); // terminal-1 disconnected
      store.setConnectedAgent('terminal-3', 'codex'); // terminal-2 disconnected

      const stats = store.getStateStats();

      expect(stats.totalAgents).to.equal(3);
      expect(stats.connectedAgents).to.equal(1);
      expect(stats.disconnectedAgents).to.equal(2);
      expect(stats.currentConnectedId).to.equal('terminal-3');
      expect(stats.agentTypes).to.include.members(['claude', 'gemini', 'codex']);
    });

    it('should return zero stats when no agents', () => {
      const stats = store.getStateStats();

      expect(stats.totalAgents).to.equal(0);
      expect(stats.connectedAgents).to.equal(0);
      expect(stats.disconnectedAgents).to.equal(0);
      expect(stats.currentConnectedId).to.be.null;
      expect(stats.agentTypes).to.have.lengthOf(0);
    });
  });

  // =================== ALL STATES RETRIEVAL TESTS ===================

  describe('📋 All States Retrieval', () => {
    it('should return all agent states', () => {
      store.setConnectedAgent('terminal-1', 'claude');
      store.setConnectedAgent('terminal-2', 'gemini');

      const allStates = store.getAllAgentStates();

      expect(allStates.size).to.be.greaterThan(0);
      expect(allStates.has('terminal-1')).to.be.true;
      expect(allStates.has('terminal-2')).to.be.true;
    });

    it('should return empty map when no states', () => {
      const allStates = store.getAllAgentStates();

      expect(allStates.size).to.equal(0);
    });
  });

  // =================== CLEAR ALL STATE TESTS ===================

  describe('🧹 Clear All State', () => {
    it('should clear all state', () => {
      store.setConnectedAgent('terminal-1', 'claude');
      store.setConnectedAgent('terminal-2', 'gemini');

      store.clearAllState();

      expect(store.getConnectedAgentTerminalId()).to.be.null;
      expect(store.getConnectedAgentType()).to.be.null;
      expect(store.getDisconnectedAgents().size).to.equal(0);
      expect(store.getAllAgentStates().size).to.equal(0);
    });
  });

  // =================== DISPOSE TESTS ===================

  describe('🧹 Dispose', () => {
    it('should clear all state on dispose', () => {
      store.setConnectedAgent('terminal-1', 'claude');

      store.dispose();

      expect(store.getConnectedAgentTerminalId()).to.be.null;
      expect(store.getAllAgentStates().size).to.equal(0);
    });

    it('should not notify observers after dispose', () => {
      const events: StateChangeEvent[] = [];
      store.subscribe(event => events.push(event));

      store.dispose();

      // Try to set agent (should not notify)
      store.setConnectedAgent('terminal-1', 'claude');

      expect(events).to.have.lengthOf(0);
    });
  });
});
