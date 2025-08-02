/**
 * CLI Agent Auto-Promotion Test Suite
 * Based on cli-agent-status-specification.md scenarios
 * Tests realistic user workflows and specification compliance
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../../shared/TestSetup';
import { TerminalManager } from '../../../terminals/TerminalManager';

describe('CLI Agent Auto-Promotion - Specification Compliance', () => {
  let sandbox: sinon.SinonSandbox;
  let terminalManager: TerminalManager;
  let dom: any;
  let consoleMocks: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Setup complete test environment
    const testEnv = setupCompleteTestEnvironment();
    dom = testEnv.dom;
    consoleMocks = testEnv.consoleMocks;

    // Create TerminalManager instance
    terminalManager = new TerminalManager();
  });

  afterEach(() => {
    if (terminalManager) {
      terminalManager.dispose();
    }
    cleanupTestEnvironment(sandbox, dom);
  });

  /**
   * Specification Scenario 1: Single Terminal
   * 1. Start Terminal 1 → Status: NONE
   * 2. Start CLI Agent in Terminal 1 → Status: CONNECTED
   * 3. Stop CLI Agent in Terminal 1 → Status: NONE
   */
  describe('Scenario 1: Single Terminal Lifecycle', () => {
    it('should handle single terminal CLI agent lifecycle correctly', () => {
      // Arrange
      const terminalId = terminalManager.createTerminal();

      // Act 1: Start CLI Agent (NONE → CONNECTED)
      (terminalManager as any)._setCurrentAgent(terminalId, 'claude');

      // Assert 1: Terminal should be CONNECTED
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminalId);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(0);

      // Act 2: Stop CLI Agent (CONNECTED → NONE)
      (terminalManager as any)._setAgentTerminated(terminalId);

      // Assert 2: No agents should be active
      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._connectedAgentType).to.be.null;
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(0);
    });
  });

  /**
   * Specification Scenario 2: Multiple Terminals
   * 1. Start Terminal 1 with CLI Agent → T1: CONNECTED
   * 2. Start Terminal 2 with CLI Agent → T1: DISCONNECTED, T2: CONNECTED
   * 3. Start Terminal 3 with CLI Agent → T1: DISCONNECTED, T2: DISCONNECTED, T3: CONNECTED
   * 4. Stop CLI Agent in Terminal 3 → T1: DISCONNECTED, T2: CONNECTED, T3: NONE
   * 5. Stop CLI Agent in Terminal 2 → T1: CONNECTED, T2: NONE, T3: NONE
   */
  describe('Scenario 2: Multiple Terminals with Latest Takes Priority', () => {
    it('should implement complete multiple terminal scenario from specification', async () => {
      // Create terminals
      const terminal1Id = terminalManager.createTerminal();
      const terminal2Id = terminalManager.createTerminal();
      const terminal3Id = terminalManager.createTerminal();

      // Step 1: Start Terminal 1 with CLI Agent → T1: CONNECTED
      (terminalManager as any)._setCurrentAgent(terminal1Id, 'claude');
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1Id);
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(0);

      // Step 2: Start Terminal 2 with CLI Agent → T1: DISCONNECTED, T2: CONNECTED
      await new Promise((resolve) => setTimeout(resolve, 10)); // Timing difference
      (terminalManager as any)._setCurrentAgent(terminal2Id, 'gemini');
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal2Id);
      expect((terminalManager as any)._connectedAgentType).to.equal('gemini');
      expect((terminalManager as any)._disconnectedAgents.has(terminal1Id)).to.be.true;
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(1);

      // Step 3: Start Terminal 3 with CLI Agent → T1: DISCONNECTED, T2: DISCONNECTED, T3: CONNECTED
      await new Promise((resolve) => setTimeout(resolve, 10)); // Timing difference
      (terminalManager as any)._setCurrentAgent(terminal3Id, 'claude');
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal3Id);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');
      expect((terminalManager as any)._disconnectedAgents.has(terminal1Id)).to.be.true;
      expect((terminalManager as any)._disconnectedAgents.has(terminal2Id)).to.be.true;
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(2);

      // Step 4: Stop CLI Agent in Terminal 3 → T2: CONNECTED (most recent DISCONNECTED), T1: DISCONNECTED, T3: NONE
      (terminalManager as any)._setAgentTerminated(terminal3Id);
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal2Id);
      expect((terminalManager as any)._connectedAgentType).to.equal('gemini');
      expect((terminalManager as any)._disconnectedAgents.has(terminal1Id)).to.be.true;
      expect((terminalManager as any)._disconnectedAgents.has(terminal2Id)).to.be.false; // Promoted to CONNECTED
      expect((terminalManager as any)._disconnectedAgents.has(terminal3Id)).to.be.false; // Terminated
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(1);

      // Step 5: Stop CLI Agent in Terminal 2 → T1: CONNECTED, T2: NONE, T3: NONE
      (terminalManager as any)._setAgentTerminated(terminal2Id);
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1Id);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(0);
    });
  });

  /**
   * Specification Scenario 3: Automatic Promotion
   * 1. Terminal 1 with CLI Agent: CONNECTED
   * 2. Terminal 2 with CLI Agent: DISCONNECTED
   * 3. Terminal 3 with CLI Agent: DISCONNECTED
   * 4. Stop Terminal 1's CLI Agent → Terminal 3 (most recent) automatically becomes CONNECTED
   */
  describe('Scenario 3: Automatic Promotion with Priority', () => {
    it('should promote most recent DISCONNECTED agent when CONNECTED terminates', async () => {
      // Create terminals
      const terminal1Id = terminalManager.createTerminal();
      const terminal2Id = terminalManager.createTerminal();
      const terminal3Id = terminalManager.createTerminal();

      // Step 1: Terminal 1 with CLI Agent: CONNECTED
      (terminalManager as any)._setCurrentAgent(terminal1Id, 'claude');

      // Step 2: Terminal 2 with CLI Agent: DISCONNECTED (T1 → DISCONNECTED, T2 → CONNECTED)
      await new Promise((resolve) => setTimeout(resolve, 10));
      (terminalManager as any)._setCurrentAgent(terminal2Id, 'gemini');

      // Step 3: Terminal 3 with CLI Agent: DISCONNECTED (T1,T2 → DISCONNECTED, T3 → CONNECTED)
      await new Promise((resolve) => setTimeout(resolve, 10));
      (terminalManager as any)._setCurrentAgent(terminal3Id, 'claude');

      // Now we have: T3: CONNECTED, T2: DISCONNECTED (recent), T1: DISCONNECTED (older)
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal3Id);
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(2);

      // Step 4: Stop Terminal 3's CLI Agent → Terminal 2 (most recent DISCONNECTED) should become CONNECTED
      (terminalManager as any)._setAgentTerminated(terminal3Id);

      // Assert: Terminal 2 should be promoted (it was the most recent DISCONNECTED)
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal2Id);
      expect((terminalManager as any)._connectedAgentType).to.equal('gemini');
      expect((terminalManager as any)._disconnectedAgents.has(terminal1Id)).to.be.true; // Still DISCONNECTED
      expect((terminalManager as any)._disconnectedAgents.has(terminal2Id)).to.be.false; // Promoted
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(1);
    });
  });

  /**
   * Specification Key Invariants Testing
   */
  describe('Key Invariants Compliance', () => {
    it('should maintain "Single CONNECTED Rule" - at most ONE terminal can have CONNECTED status', () => {
      const terminal1Id = terminalManager.createTerminal();
      const terminal2Id = terminalManager.createTerminal();
      const terminal3Id = terminalManager.createTerminal();

      // Start multiple agents
      (terminalManager as any)._setCurrentAgent(terminal1Id, 'claude');
      (terminalManager as any)._setCurrentAgent(terminal2Id, 'gemini');
      (terminalManager as any)._setCurrentAgent(terminal3Id, 'claude');

      // Only terminal3 should be CONNECTED
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal3Id);

      // Others should be DISCONNECTED
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(2);
      expect((terminalManager as any)._disconnectedAgents.has(terminal1Id)).to.be.true;
      expect((terminalManager as any)._disconnectedAgents.has(terminal2Id)).to.be.true;
    });

    it('should enforce "No All-DISCONNECTED State" - impossible to have all terminals DISCONNECTED', () => {
      const terminal1Id = terminalManager.createTerminal();
      const terminal2Id = terminalManager.createTerminal();

      // Set up two CLI agents
      (terminalManager as any)._setCurrentAgent(terminal1Id, 'claude');
      (terminalManager as any)._setCurrentAgent(terminal2Id, 'gemini');

      // Now: T1: DISCONNECTED, T2: CONNECTED
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal2Id);
      expect((terminalManager as any)._disconnectedAgents.has(terminal1Id)).to.be.true;

      // Terminate CONNECTED agent
      (terminalManager as any)._setAgentTerminated(terminal2Id);

      // T1 should automatically be promoted to CONNECTED (no all-DISCONNECTED state)
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1Id);
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(0);
    });

    it('should implement "Latest Takes Priority" rule correctly', () => {
      const terminal1Id = terminalManager.createTerminal();
      const terminal2Id = terminalManager.createTerminal();
      const terminal3Id = terminalManager.createTerminal();

      // Start agents in sequence (Latest Takes Priority)
      (terminalManager as any)._setCurrentAgent(terminal1Id, 'claude');
      (terminalManager as any)._setCurrentAgent(terminal2Id, 'gemini');
      (terminalManager as any)._setCurrentAgent(terminal3Id, 'claude');

      // Latest (terminal3) should be CONNECTED
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal3Id);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');
    });
  });

  /**
   * Real User Workflow Testing
   */
  describe('Real User Workflow Scenarios', () => {
    it('should handle user workflow: start Claude, then Gemini, terminate Gemini', async () => {
      // User starts Claude in terminal 1
      const terminal1Id = terminalManager.createTerminal();
      (terminalManager as any)._setCurrentAgent(terminal1Id, 'claude');

      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1Id);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');

      // User starts Gemini in terminal 2 (Claude becomes DISCONNECTED)
      await new Promise((resolve) => setTimeout(resolve, 10));
      const terminal2Id = terminalManager.createTerminal();
      (terminalManager as any)._setCurrentAgent(terminal2Id, 'gemini');

      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal2Id);
      expect((terminalManager as any)._connectedAgentType).to.equal('gemini');
      expect((terminalManager as any)._disconnectedAgents.has(terminal1Id)).to.be.true;

      // User terminates Gemini (Claude should automatically become CONNECTED)
      (terminalManager as any)._setAgentTerminated(terminal2Id);

      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1Id);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(0);
    });

    it('should handle user workflow: multiple agents, terminate oldest DISCONNECTED', async () => {
      // User starts 3 CLI agents
      const terminal1Id = terminalManager.createTerminal();
      const terminal2Id = terminalManager.createTerminal();
      const terminal3Id = terminalManager.createTerminal();

      (terminalManager as any)._setCurrentAgent(terminal1Id, 'claude');
      await new Promise((resolve) => setTimeout(resolve, 10));
      (terminalManager as any)._setCurrentAgent(terminal2Id, 'gemini');
      await new Promise((resolve) => setTimeout(resolve, 10));
      (terminalManager as any)._setCurrentAgent(terminal3Id, 'claude');

      // Current state: T3: CONNECTED, T2: DISCONNECTED (recent), T1: DISCONNECTED (oldest)
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal3Id);
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(2);

      // User terminates oldest DISCONNECTED agent (T1)
      (terminalManager as any)._setAgentTerminated(terminal1Id);

      // Should not affect CONNECTED status
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal3Id);
      expect((terminalManager as any)._disconnectedAgents.has(terminal1Id)).to.be.false; // Removed
      expect((terminalManager as any)._disconnectedAgents.has(terminal2Id)).to.be.true; // Still DISCONNECTED
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(1);
    });
  });

  /**
   * Edge Cases and Error Handling
   */
  describe('Edge Cases', () => {
    it('should handle termination of non-existent agent gracefully', () => {
      expect(() => {
        (terminalManager as any)._setAgentTerminated('non-existent-terminal');
      }).to.not.throw();

      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(0);
    });

    it('should handle rapid agent creation and termination', () => {
      const terminalIds = [];

      // Create and start multiple agents rapidly
      for (let i = 0; i < 3; i++) {
        const terminalId = terminalManager.createTerminal();
        terminalIds.push(terminalId);
        (terminalManager as any)._setCurrentAgent(terminalId, i % 2 === 0 ? 'claude' : 'gemini');
      }

      // Last terminal should be CONNECTED
      const lastTerminalId = terminalIds[terminalIds.length - 1];
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(lastTerminalId);
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(terminalIds.length - 1);
    });

    it('should handle same agent type restarting in same terminal', () => {
      const terminalId = terminalManager.createTerminal();

      // Start Claude
      (terminalManager as any)._setCurrentAgent(terminalId, 'claude');
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminalId);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');

      // Restart same Claude in same terminal (should be no-op)
      (terminalManager as any)._setCurrentAgent(terminalId, 'claude');
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminalId);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(0);
    });
  });

  /**
   * Message Routing Compliance
   * Testing that status correctly reflects message routing capability
   */
  describe('Message Routing Compliance', () => {
    it('should maintain accurate routing state during agent transitions', () => {
      const terminal1Id = terminalManager.createTerminal();
      const terminal2Id = terminalManager.createTerminal();

      // Set up message routing scenario
      (terminalManager as any)._setCurrentAgent(terminal1Id, 'claude');
      (terminalManager as any)._setCurrentAgent(terminal2Id, 'gemini');

      // CONNECTED terminal should be primary message destination
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal2Id);

      // DISCONNECTED terminal should be secondary destination
      expect((terminalManager as any)._disconnectedAgents.has(terminal1Id)).to.be.true;

      // Terminate CONNECTED agent - routing should automatically switch
      (terminalManager as any)._setAgentTerminated(terminal2Id);

      // Previous DISCONNECTED should become new message destination
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1Id);
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(0);
    });
  });
});
