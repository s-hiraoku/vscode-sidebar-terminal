/**
 * CLI Agent State Manager Unit Tests
 *
 * 🎯 PURPOSE: Test state management logic in isolation
 * 🚨 CRITICAL: These tests prevent bugs in the core state management system
 *
 * Focus Areas:
 * 1. State transitions and consistency
 * 2. Event emission accuracy
 * 3. Promotion and demotion logic
 * 4. Edge cases in state management
 * 5. Memory cleanup and resource management
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';

import { CliAgentStateManager } from '../../../services/CliAgentDetectionService';
import { ICliAgentStateManager } from '../../../interfaces/CliAgentService';

describe('🏗️ CLI Agent State Manager Unit Tests', () => {
  let stateManager: ICliAgentStateManager;
  let sandbox: sinon.SinonSandbox;

  // Event tracking
  let statusChangeEvents: Array<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }> = [];

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    statusChangeEvents = [];

    stateManager = new CliAgentStateManager();

    // Track all status change events
    stateManager.onStatusChange((event) => {
      statusChangeEvents.push(event);
    });
  });

  afterEach(() => {
    stateManager.dispose();
    sandbox.restore();
    statusChangeEvents = [];
  });

  // =================== BASIC STATE MANAGEMENT TESTS ===================

  describe('🔧 Basic State Management', () => {
    it('should start with empty state', () => {
      // ASSERT: Initial state
      expect(stateManager.getConnectedAgentTerminalId()).to.be.null;
      expect(stateManager.getConnectedAgentType()).to.be.null;
      expect(stateManager.getDisconnectedAgents().size).to.equal(0);
      expect(stateManager.isAgentConnected('any-terminal')).to.be.false;
    });

    it('should set connected agent correctly', () => {
      // ACT
      stateManager.setConnectedAgent('term1', 'claude', 'Terminal 1');

      // ASSERT
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term1');
      expect(stateManager.getConnectedAgentType()).to.equal('claude');
      expect(stateManager.isAgentConnected('term1')).to.be.true;
      expect(stateManager.isAgentConnected('term2')).to.be.false;

      // Check event
      expect(statusChangeEvents).to.have.length(1);
      expect(statusChangeEvents[0]).to.deep.include({
        terminalId: 'term1',
        status: 'connected',
        type: 'claude',
        terminalName: 'Terminal 1',
      });
    });

    it('should handle Gemini agent connection', () => {
      // ACT
      stateManager.setConnectedAgent('term2', 'gemini');

      // ASSERT
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term2');
      expect(stateManager.getConnectedAgentType()).to.equal('gemini');
      expect(stateManager.isAgentConnected('term2')).to.be.true;

      // Check event
      expect(statusChangeEvents[0]).to.deep.include({
        terminalId: 'term2',
        status: 'connected',
        type: 'gemini',
      });
    });

    it('should prevent duplicate connection for same terminal', () => {
      // ARRANGE: Connect agent first
      stateManager.setConnectedAgent('term1', 'claude');
      expect(statusChangeEvents).to.have.length(1);

      // ACT: Try to connect same agent again
      stateManager.setConnectedAgent('term1', 'claude');

      // ASSERT: Should not create duplicate events
      expect(statusChangeEvents).to.have.length(1);
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term1');
    });
  });

  // =================== AGENT SWITCHING TESTS ===================

  describe('🔄 Agent Switching Logic', () => {
    it('should move previous connected agent to disconnected when new agent connects', () => {
      // ARRANGE: Connect first agent
      stateManager.setConnectedAgent('term1', 'claude', 'Terminal 1');
      expect(statusChangeEvents).to.have.length(1);

      // ACT: Connect second agent
      stateManager.setConnectedAgent('term2', 'gemini', 'Terminal 2');

      // ASSERT: Term1 disconnected, Term2 connected
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term2');
      expect(stateManager.getConnectedAgentType()).to.equal('gemini');
      expect(stateManager.isAgentConnected('term1')).to.be.false;
      expect(stateManager.isAgentConnected('term2')).to.be.true;

      // Check disconnected agents map
      const disconnectedAgents = stateManager.getDisconnectedAgents();
      expect(disconnectedAgents.size).to.equal(1);
      expect(disconnectedAgents.has('term1')).to.be.true;
      const term1Info = disconnectedAgents.get('term1');
      expect(term1Info).to.not.be.undefined;
      if (term1Info) {
        expect(term1Info.type).to.equal('claude');
      }

      // Check events sequence
      expect(statusChangeEvents).to.have.length(3);
      expect(statusChangeEvents[0]).to.deep.include({
        terminalId: 'term1',
        status: 'connected',
        type: 'claude',
      });
      expect(statusChangeEvents[1]).to.deep.include({
        terminalId: 'term1',
        status: 'disconnected',
        type: 'claude',
      });
      expect(statusChangeEvents[2]).to.deep.include({
        terminalId: 'term2',
        status: 'connected',
        type: 'gemini',
      });
    });

    it('should handle multiple agent connections correctly', () => {
      // ACT: Connect 3 agents in sequence
      stateManager.setConnectedAgent('term1', 'claude', 'Terminal 1');
      stateManager.setConnectedAgent('term2', 'gemini', 'Terminal 2');
      stateManager.setConnectedAgent('term3', 'claude', 'Terminal 3');

      // ASSERT: Only term3 connected, term1 and term2 disconnected
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term3');
      expect(stateManager.getConnectedAgentType()).to.equal('claude');

      const disconnectedAgents = stateManager.getDisconnectedAgents();
      expect(disconnectedAgents.size).to.equal(2);
      expect(disconnectedAgents.has('term1')).to.be.true;
      expect(disconnectedAgents.has('term2')).to.be.true;
      expect(disconnectedAgents.get('term1')?.type).to.equal('claude');
      expect(disconnectedAgents.get('term2')?.type).to.equal('gemini');

      // Check event count: 3 connected + 2 disconnected = 5 events
      expect(statusChangeEvents).to.have.length(5);
    });

    it('🚨 CRITICAL: should block promotion of disconnected agents via output re-processing', () => {
      // ARRANGE: Setup disconnected agent scenario
      stateManager.setConnectedAgent('term1', 'claude');
      stateManager.setConnectedAgent('term2', 'gemini'); // term1 becomes disconnected

      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term2');
      expect(stateManager.getDisconnectedAgents().has('term1')).to.be.true;

      // Clear events to focus on the blocked operation
      statusChangeEvents = [];

      // ACT: Try to reconnect disconnected agent (simulating output re-processing)
      stateManager.setConnectedAgent('term1', 'claude');

      // ASSERT: Should be blocked - no state change should occur
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term2'); // Still term2
      expect(stateManager.getConnectedAgentType()).to.equal('gemini'); // Still gemini
      expect(stateManager.getDisconnectedAgents().has('term1')).to.be.true; // term1 still disconnected

      // No events should be fired
      expect(statusChangeEvents).to.have.length(0);
    });
  });

  // =================== AGENT PROMOTION TESTS ===================

  describe('🚀 Agent Promotion Logic', () => {
    it('should promote disconnected agent to connected via explicit user action', () => {
      // ARRANGE: Setup scenario with disconnected agent
      stateManager.setConnectedAgent('term1', 'claude');
      stateManager.setConnectedAgent('term2', 'gemini'); // term1 becomes disconnected

      expect(stateManager.getDisconnectedAgents().has('term1')).to.be.true;
      statusChangeEvents = []; // Clear events

      // ACT: Legitimate promotion (user toggle button)
      stateManager.promoteDisconnectedAgentToConnected('term1');

      // ASSERT: term1 now connected, term2 disconnected
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term1');
      expect(stateManager.getConnectedAgentType()).to.equal('claude');
      expect(stateManager.isAgentConnected('term1')).to.be.true;
      expect(stateManager.isAgentConnected('term2')).to.be.false;

      // Check disconnected agents
      const disconnectedAgents = stateManager.getDisconnectedAgents();
      expect(disconnectedAgents.has('term1')).to.be.false; // No longer disconnected
      expect(disconnectedAgents.has('term2')).to.be.true; // Now disconnected

      // Check events
      expect(statusChangeEvents).to.have.length(2);
      expect(statusChangeEvents[0]).to.deep.include({
        terminalId: 'term2',
        status: 'disconnected',
        type: 'gemini',
      });
      expect(statusChangeEvents[1]).to.deep.include({
        terminalId: 'term1',
        status: 'connected',
        type: 'claude',
      });
    });

    it('should handle promotion of non-existent disconnected agent', () => {
      // ARRANGE: Setup with no disconnected agents
      stateManager.setConnectedAgent('term1', 'claude');

      // ACT: Try to promote non-existent disconnected agent
      stateManager.promoteDisconnectedAgentToConnected('term2');

      // ASSERT: No state change should occur
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term1');
      expect(stateManager.getDisconnectedAgents().size).to.equal(0);
    });

    it('should auto-promote latest disconnected agent when connected agent terminates', () => {
      // ARRANGE: Setup multiple disconnected agents with different start times
      stateManager.setConnectedAgent('term1', 'claude');

      // Wait a bit to ensure different timestamps
      const clock = sinon.useFakeTimers();

      stateManager.setConnectedAgent('term2', 'gemini'); // term1 disconnected at time T
      clock.tick(100);
      stateManager.setConnectedAgent('term3', 'claude'); // term2 disconnected at time T+100

      // term3 is connected, term1 and term2 are disconnected
      expect(stateManager.getDisconnectedAgents().size).to.equal(2);
      statusChangeEvents = [];

      // ACT: Terminate connected agent (term3)
      stateManager.setAgentTerminated('term3');

      // ASSERT: Most recent disconnected agent (term2) should be promoted
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term2');
      expect(stateManager.getConnectedAgentType()).to.equal('gemini');
      expect(stateManager.getDisconnectedAgents().size).to.equal(1); // Only term1 remains disconnected

      // Check events: none event for term3, connected event for term2
      expect(statusChangeEvents).to.have.length(2);
      if (statusChangeEvents.length > 0) {
        expect(statusChangeEvents[0]?.status).to.equal('none');
      }
      expect(statusChangeEvents[1]).to.deep.include({
        terminalId: 'term2',
        status: 'connected',
        type: 'gemini',
      });

      clock.restore();
    });
  });

  // =================== AGENT TERMINATION TESTS ===================

  describe('🔚 Agent Termination Logic', () => {
    it('should handle connected agent termination', () => {
      // ARRANGE: Setup connected agent
      stateManager.setConnectedAgent('term1', 'claude', 'Terminal 1');
      expect(stateManager.isAgentConnected('term1')).to.be.true;
      statusChangeEvents = [];

      // ACT: Terminate connected agent
      stateManager.setAgentTerminated('term1');

      // ASSERT: Agent should be removed from connected state
      expect(stateManager.getConnectedAgentTerminalId()).to.be.null;
      expect(stateManager.getConnectedAgentType()).to.be.null;
      expect(stateManager.isAgentConnected('term1')).to.be.false;

      // Check event
      expect(statusChangeEvents).to.have.length(1);
      expect(statusChangeEvents[0]).to.deep.include({
        terminalId: 'term1',
        status: 'none',
        type: 'claude',
      });
    });

    it('should NOT terminate disconnected agents via setAgentTerminated (they are still running)', () => {
      // ARRANGE: Setup disconnected agent
      stateManager.setConnectedAgent('term1', 'claude');
      stateManager.setConnectedAgent('term2', 'gemini'); // term1 becomes disconnected

      expect(stateManager.getDisconnectedAgents().has('term1')).to.be.true;
      statusChangeEvents = [];

      // ACT: Attempt to terminate disconnected agent
      stateManager.setAgentTerminated('term1');

      // ASSERT: Disconnected agent should REMAIN in disconnected state (not terminated)
      expect(stateManager.getDisconnectedAgents().has('term1')).to.be.true; // 🔧 FIX: Should remain disconnected
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term2'); // term2 still connected

      // Check NO status change event is fired (disconnected agents are not terminated)
      expect(statusChangeEvents).to.have.length(0); // 🔧 FIX: No event should be fired
    });

    it('should only terminate disconnected agents via removeTerminalCompletely (actual terminal deletion)', () => {
      // ARRANGE: Setup disconnected agent
      stateManager.setConnectedAgent('term1', 'claude');
      stateManager.setConnectedAgent('term2', 'gemini'); // term1 becomes disconnected

      expect(stateManager.getDisconnectedAgents().has('term1')).to.be.true;
      statusChangeEvents = [];

      // ACT: Remove terminal completely (actual terminal deletion)
      stateManager.removeTerminalCompletely('term1');

      // ASSERT: Agent should be removed from disconnected state
      expect(stateManager.getDisconnectedAgents().has('term1')).to.be.false;
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term2'); // term2 still connected

      // Check event is fired for terminal removal
      expect(statusChangeEvents).to.have.length(1);
      expect(statusChangeEvents[0]).to.deep.include({
        terminalId: 'term1',
        status: 'none',
        type: null, // Type is null for terminal removal
      });
    });

    it('should handle mixed connected and disconnected agent termination correctly', () => {
      // ARRANGE: Setup multiple agents
      stateManager.setConnectedAgent('term1', 'claude');
      stateManager.setConnectedAgent('term2', 'gemini'); // term1 becomes disconnected
      stateManager.setConnectedAgent('term3', 'claude'); // term2 becomes disconnected

      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term3');
      expect(stateManager.getDisconnectedAgents().size).to.equal(2);
      statusChangeEvents = [];

      // ACT: Terminate connected agent (should work normally)
      stateManager.setAgentTerminated('term3');

      // ASSERT: Connected agent terminated, disconnected agents remain
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term2'); // Latest disconnected promoted
      expect(stateManager.getDisconnectedAgents().size).to.equal(1); // Only term1 remains disconnected
      expect(stateManager.getDisconnectedAgents().has('term1')).to.be.true;

      // Check status change event for connected agent termination
      expect(statusChangeEvents).to.have.length(1);
      expect(statusChangeEvents[0]).to.deep.include({
        terminalId: 'term3',
        status: 'none',
        type: 'claude',
      });
    });

    it('should handle termination of non-existent agent', () => {
      // ARRANGE: Setup with no agents
      expect(stateManager.getConnectedAgentTerminalId()).to.be.null;

      // ACT: Try to terminate non-existent agent
      stateManager.setAgentTerminated('term1');

      // ASSERT: No state change or events
      expect(stateManager.getConnectedAgentTerminalId()).to.be.null;
      expect(statusChangeEvents).to.have.length(0);
    });

    it('should auto-promote when connected agent terminates with disconnected agents available', () => {
      // ARRANGE: Setup connected agent with disconnected agent available
      stateManager.setConnectedAgent('term1', 'claude');
      stateManager.setConnectedAgent('term2', 'gemini'); // term1 disconnected

      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term2');
      expect(stateManager.getDisconnectedAgents().has('term1')).to.be.true;
      statusChangeEvents = [];

      // ACT: Terminate connected agent
      stateManager.setAgentTerminated('term2');

      // ASSERT: Disconnected agent should be auto-promoted
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term1');
      expect(stateManager.getConnectedAgentType()).to.equal('claude');
      expect(stateManager.getDisconnectedAgents().size).to.equal(0);

      // Events: none for term2, connected for term1
      expect(statusChangeEvents).to.have.length(2);
      expect(statusChangeEvents[0]).to.deep.include({
        terminalId: 'term2',
        status: 'none',
        type: 'gemini',
      });
      expect(statusChangeEvents[1]).to.deep.include({
        terminalId: 'term1',
        status: 'connected',
        type: 'claude',
      });
    });
  });

  // =================== TERMINAL REMOVAL TESTS ===================

  describe('🗑️ Terminal Removal Logic', () => {
    it('should handle complete terminal removal for connected agent', () => {
      // ARRANGE: Setup connected agent
      stateManager.setConnectedAgent('term1', 'claude', 'Terminal 1');
      statusChangeEvents = [];

      // ACT: Remove terminal completely
      stateManager.removeTerminalCompletely('term1');

      // ASSERT: All state cleaned up
      expect(stateManager.getConnectedAgentTerminalId()).to.be.null;
      expect(stateManager.getConnectedAgentType()).to.be.null;
      expect(stateManager.isAgentConnected('term1')).to.be.false;

      // Check event
      expect(statusChangeEvents).to.have.length(1);
      expect(statusChangeEvents[0]).to.deep.include({
        terminalId: 'term1',
        status: 'none',
        type: null,
      });
    });

    it('should handle complete terminal removal for disconnected agent', () => {
      // ARRANGE: Setup disconnected agent
      stateManager.setConnectedAgent('term1', 'claude');
      stateManager.setConnectedAgent('term2', 'gemini'); // term1 disconnected
      statusChangeEvents = [];

      // ACT: Remove disconnected terminal
      stateManager.removeTerminalCompletely('term1');

      // ASSERT: Disconnected agent removed, connected agent unchanged
      expect(stateManager.getDisconnectedAgents().has('term1')).to.be.false;
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term2');

      // Check event
      expect(statusChangeEvents).to.have.length(1);
      expect(statusChangeEvents[0]).to.deep.include({
        terminalId: 'term1',
        status: 'none',
        type: null,
      });
    });

    it('should auto-promote when connected terminal is removed with disconnected agents available', () => {
      // ARRANGE: Setup connected agent with disconnected agent
      stateManager.setConnectedAgent('term1', 'claude');
      stateManager.setConnectedAgent('term2', 'gemini'); // term1 disconnected
      statusChangeEvents = [];

      // ACT: Remove connected terminal
      stateManager.removeTerminalCompletely('term2');

      // ASSERT: Disconnected agent promoted
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term1');
      expect(stateManager.getConnectedAgentType()).to.equal('claude');
      expect(stateManager.getDisconnectedAgents().size).to.equal(0);

      // Events: none for term2, connected for term1
      expect(statusChangeEvents).to.have.length(2);
    });

    it('should handle removal of non-existent terminal', () => {
      // ARRANGE: Setup with one agent
      stateManager.setConnectedAgent('term1', 'claude');
      statusChangeEvents = [];

      // ACT: Try to remove non-existent terminal
      stateManager.removeTerminalCompletely('term2');

      // ASSERT: No state change
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term1');
      expect(statusChangeEvents).to.have.length(0);
    });
  });

  // =================== STATE CONSISTENCY TESTS ===================

  describe('🔐 State Consistency Tests', () => {
    it('should maintain consistent state across all operations', () => {
      // This test simulates a complex sequence of operations

      // PHASE 1: Multiple connections
      stateManager.setConnectedAgent('term1', 'claude');
      stateManager.setConnectedAgent('term2', 'gemini');
      stateManager.setConnectedAgent('term3', 'claude');

      // Verify state: term3 connected, term1 and term2 disconnected
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term3');
      expect(stateManager.getDisconnectedAgents().size).to.equal(2);

      // PHASE 2: Promotion
      stateManager.promoteDisconnectedAgentToConnected('term1');

      // Verify state: term1 connected, term2 and term3 disconnected
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term1');
      expect(stateManager.getDisconnectedAgents().size).to.equal(2);

      // PHASE 3: Termination
      stateManager.setAgentTerminated('term1');

      // Verify state: auto-promotion should occur
      expect(stateManager.getConnectedAgentTerminalId()).to.not.be.null;
      expect(stateManager.getDisconnectedAgents().size).to.equal(1);

      // PHASE 4: Complete removal
      const connectedId = stateManager.getConnectedAgentTerminalId();
      stateManager.removeTerminalCompletely(connectedId!);

      // Verify final state: last agent should be promoted
      expect(stateManager.getConnectedAgentTerminalId()).to.not.be.null;
      expect(stateManager.getDisconnectedAgents().size).to.equal(0);
    });

    it('should handle rapid concurrent operations without state corruption', () => {
      // Simulate rapid operations that could cause race conditions
      const operations = [
        () => stateManager.setConnectedAgent('term1', 'claude'),
        () => stateManager.setConnectedAgent('term2', 'gemini'),
        () => stateManager.promoteDisconnectedAgentToConnected('term1'),
        () => stateManager.setConnectedAgent('term3', 'claude'),
        () => stateManager.setAgentTerminated('term3'),
        () => stateManager.removeTerminalCompletely('term2'),
      ];

      // Execute all operations
      operations.forEach((op) => op());

      // ASSERT: State should be consistent (no corruption)
      const connectedId = stateManager.getConnectedAgentTerminalId();
      const disconnectedAgents = stateManager.getDisconnectedAgents();

      // Basic consistency checks
      if (connectedId) {
        expect(disconnectedAgents.has(connectedId)).to.be.false; // Connected agent not in disconnected map
      }

      // Event count should be reasonable (not excessive due to bugs)
      expect(statusChangeEvents.length).to.be.lessThan(20); // Should be around 10-12 events

      // All terminal IDs in events should be valid
      statusChangeEvents.forEach((event) => {
        expect(event.terminalId).to.match(/^term[123]$/);
        expect(['connected', 'disconnected', 'none']).to.include(event.status);
      });
    });
  });

  // =================== MEMORY AND RESOURCE TESTS ===================

  describe('🧠 Memory and Resource Management', () => {
    it('should clear all state properly', () => {
      // ARRANGE: Setup complex state
      stateManager.setConnectedAgent('term1', 'claude');
      stateManager.setConnectedAgent('term2', 'gemini');
      stateManager.setConnectedAgent('term3', 'claude');

      expect(stateManager.getDisconnectedAgents().size).to.equal(2);

      // ACT: Clear all state
      stateManager.clearAllState();

      // ASSERT: Everything should be cleared
      expect(stateManager.getConnectedAgentTerminalId()).to.be.null;
      expect(stateManager.getConnectedAgentType()).to.be.null;
      expect(stateManager.getDisconnectedAgents().size).to.equal(0);
      expect(stateManager.isAgentConnected('term1')).to.be.false;
    });

    it('should dispose resources properly', () => {
      // ARRANGE: Setup state and event listener
      stateManager.setConnectedAgent('term1', 'claude');
      let eventReceived = false;

      const _subscription = stateManager.onStatusChange(() => {
        eventReceived = true;
      });

      // ACT: Dispose
      stateManager.dispose();

      // Try to trigger event after disposal
      try {
        stateManager.setConnectedAgent('term2', 'gemini');
      } catch (error) {
        // Expected if disposed properly
      }

      // ASSERT: State should be cleared and events should not fire
      expect(stateManager.getConnectedAgentTerminalId()).to.be.null;
      expect(eventReceived).to.be.false;
    });

    it('should handle heartbeat validation without side effects', () => {
      // ARRANGE: Setup connected agent
      stateManager.setConnectedAgent('term1', 'claude');
      const initialState = {
        connectedId: stateManager.getConnectedAgentTerminalId(),
        connectedType: stateManager.getConnectedAgentType(),
        disconnectedCount: stateManager.getDisconnectedAgents().size,
      };
      statusChangeEvents = [];

      // ACT: Validate state (heartbeat)
      stateManager.validateConnectedAgentState();

      // ASSERT: No state changes should occur
      expect(stateManager.getConnectedAgentTerminalId()).to.equal(initialState.connectedId);
      expect(stateManager.getConnectedAgentType()).to.equal(initialState.connectedType);
      expect(stateManager.getDisconnectedAgents().size).to.equal(initialState.disconnectedCount);
      expect(statusChangeEvents).to.have.length(0);
    });

    it('should handle state refresh correctly', () => {
      // ARRANGE: Setup with disconnected agents
      stateManager.setConnectedAgent('term1', 'claude');
      stateManager.setConnectedAgent('term2', 'gemini');

      // Term1 is now disconnected, term2 connected
      expect(stateManager.getDisconnectedAgents().size).to.equal(1);

      // ACT: Refresh state
      const refreshResult = stateManager.refreshConnectedAgentState();

      // ASSERT: Should return true (connected agent exists)
      expect(refreshResult).to.be.true;
    });
  });

  // =================== EDGE CASE TESTS ===================

  describe('⚠️ Edge Case Tests', () => {
    it('should handle same terminal connecting with different agent types', () => {
      // ARRANGE: Connect Claude to term1
      stateManager.setConnectedAgent('term1', 'claude');
      expect(stateManager.getConnectedAgentType()).to.equal('claude');

      // ACT: Connect Gemini to same terminal (should overwrite)
      stateManager.setConnectedAgent('term1', 'gemini');

      // ASSERT: Should update agent type
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term1');
      expect(stateManager.getConnectedAgentType()).to.equal('gemini');
    });

    it('should handle promotion chain with multiple disconnected agents', () => {
      const clock = sinon.useFakeTimers();

      // ARRANGE: Create chain of disconnected agents with different timestamps
      stateManager.setConnectedAgent('term1', 'claude'); // T=0
      clock.tick(100);
      stateManager.setConnectedAgent('term2', 'gemini'); // T=100, term1 disconnected
      clock.tick(100);
      stateManager.setConnectedAgent('term3', 'claude'); // T=200, term2 disconnected
      clock.tick(100);
      stateManager.setConnectedAgent('term4', 'gemini'); // T=300, term3 disconnected

      // term4 connected, term1/term2/term3 disconnected
      expect(stateManager.getDisconnectedAgents().size).to.equal(3);

      // ACT: Remove connected agent, should promote most recent (term3)
      stateManager.removeTerminalCompletely('term4');

      // ASSERT: term3 should be promoted (most recent disconnected)
      expect(stateManager.getConnectedAgentTerminalId()).to.equal('term3');
      expect(stateManager.getConnectedAgentType()).to.equal('claude');
      expect(stateManager.getDisconnectedAgents().size).to.equal(2);

      clock.restore();
    });

    it('should maintain disconnected agent metadata correctly', () => {
      // ARRANGE: Setup disconnected agent with metadata
      stateManager.setConnectedAgent('term1', 'claude', 'My Terminal');
      stateManager.setConnectedAgent('term2', 'gemini');

      // ACT: Check disconnected agent metadata
      const disconnectedAgents = stateManager.getDisconnectedAgents();
      const term1Info = disconnectedAgents.get('term1');

      // ASSERT: Metadata should be preserved
      expect(term1Info).to.not.be.undefined;
      expect(term1Info?.type).to.equal('claude');
      expect(term1Info?.terminalName).to.equal('My Terminal');
      expect(term1Info?.startTime).to.be.an.instanceof(Date);
    });
  });
});
