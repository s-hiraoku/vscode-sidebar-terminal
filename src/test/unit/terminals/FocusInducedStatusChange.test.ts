/**
 * Test to verify that terminal focus events do NOT trigger CLI Agent status changes
 * 
 * This test reproduces the bug where DISCONNECTED terminals become CONNECTED when focused
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { TerminalManager } from '../../../terminals/TerminalManager';

describe('Focus-Induced CLI Agent Status Change Bug Tests', () => {
  let terminalManager: TerminalManager;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    terminalManager = new TerminalManager();
  });

  afterEach(() => {
    terminalManager.dispose();
    sandbox.restore();
  });

  describe('Focus Events Should NOT Change CLI Agent Status', () => {
    it('should NOT trigger CLI Agent status changes when terminal is focused', () => {
      // Create a terminal
      const terminal1 = terminalManager.createTerminal();

      // Mock CLI Agent status events
      const statusChangeSpy = sinon.spy();
      terminalManager.onCliAgentStatusChange(statusChangeSpy);

      // Focus terminal - this should NOT trigger any CLI Agent status changes
      terminalManager.focusTerminal(terminal1);

      // Verify that NO status change events were fired due to focus
      expect(statusChangeSpy.callCount).to.equal(0);
    });

    it('should NOT trigger CLI Agent status changes when setActiveTerminal is called', () => {
      // Create a terminal
      const terminal1 = terminalManager.createTerminal();

      // Mock CLI Agent status events
      const statusChangeSpy = sinon.spy();
      terminalManager.onCliAgentStatusChange(statusChangeSpy);

      // Set terminal as active - this should NOT trigger any CLI Agent status changes
      terminalManager.setActiveTerminal(terminal1);

      // Verify that NO status change events were fired due to setActiveTerminal
      expect(statusChangeSpy.callCount).to.equal(0);
    });

    it('should NOT trigger status changes from multiple focus operations', () => {
      // Create multiple terminals
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();
      const terminal3 = terminalManager.createTerminal();

      // Mock CLI Agent status events
      const statusChangeSpy = sinon.spy();
      terminalManager.onCliAgentStatusChange(statusChangeSpy);

      // Perform multiple focus operations
      terminalManager.focusTerminal(terminal1);
      terminalManager.focusTerminal(terminal2);
      terminalManager.focusTerminal(terminal3);
      terminalManager.setActiveTerminal(terminal1);
      terminalManager.setActiveTerminal(terminal2);

      // Verify that NO status change events were fired from any focus operations
      expect(statusChangeSpy.callCount).to.equal(0);
    });
  });

  describe('Specification Compliance Verification', () => {
    it('should only fire status change events for actual CLI Agent lifecycle changes', () => {
      const terminal1 = terminalManager.createTerminal();
      
      // Mock CLI Agent status events
      const statusChangeSpy = sinon.spy();
      terminalManager.onCliAgentStatusChange(statusChangeSpy);

      // Operations that should NOT trigger status changes
      terminalManager.focusTerminal(terminal1);
      terminalManager.setActiveTerminal(terminal1);
      terminalManager.resize(80, 24, terminal1);
      
      // Verify no status changes from non-agent operations
      expect(statusChangeSpy.callCount).to.equal(0);
    });
  });

  describe('User Scenario Bug Reproduction', () => {
    it('should NOT change DISCONNECTED terminal to CONNECTED when focused', () => {
      // 🔍 This test reproduces the exact user bug scenario:
      // - Two terminals: one CONNECTED, one DISCONNECTED
      // - Focus on DISCONNECTED terminal 
      // - DISCONNECTED should NOT become CONNECTED
      
      // Create two terminals
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();
      
      // Mock CLI Agent status events
      const statusChangeSpy = sinon.spy();
      terminalManager.onCliAgentStatusChange(statusChangeSpy);
      
      // Setup: terminal1 CONNECTED, terminal2 DISCONNECTED
      (terminalManager as any)._connectedAgentTerminalId = terminal1;
      (terminalManager as any)._connectedAgentType = 'claude';
      (terminalManager as any)._disconnectedAgents.set(terminal2, {
        terminalId: terminal2,
        type: 'gemini',
        disconnectedAt: Date.now()
      });
      
      // Clear spy history from setup
      statusChangeSpy.resetHistory();
      
      // 🎯 USER ACTION: Focus on the DISCONNECTED terminal
      terminalManager.focusTerminal(terminal2);
      
      // 🚨 BUG CHECK: DISCONNECTED terminal should remain DISCONNECTED
      // The bug is that this becomes CONNECTED, which violates the specification
      
      // Verify: NO status change events should be fired from focus
      expect(statusChangeSpy.callCount).to.equal(0, 
        'Focus events should NOT trigger CLI Agent status changes');
      
      // Verify: terminal1 should still be CONNECTED
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1,
        'Original CONNECTED terminal should remain CONNECTED');
      
      // Verify: terminal2 should still be DISCONNECTED  
      expect((terminalManager as any)._disconnectedAgents.has(terminal2)).to.be.true;
      expect((terminalManager as any)._connectedAgentTerminalId).to.not.equal(terminal2,
        'DISCONNECTED terminal should NOT become CONNECTED when focused');
    });

    it('should NOT auto-promote DISCONNECTED agent when focused after time delay', () => {
      // 🔍 This test checks the "after a certain time" aspect mentioned by the user
      
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();
      
      // Mock time and status events
      const clock = sandbox.useFakeTimers();
      const statusChangeSpy = sinon.spy();
      terminalManager.onCliAgentStatusChange(statusChangeSpy);
      
      // Setup: terminal1 CONNECTED, terminal2 DISCONNECTED
      (terminalManager as any)._connectedAgentTerminalId = terminal1;
      (terminalManager as any)._connectedAgentType = 'claude';
      (terminalManager as any)._disconnectedAgents.set(terminal2, {
        terminalId: terminal2,
        type: 'gemini',
        disconnectedAt: Date.now()
      });
      
      // Clear spy history
      statusChangeSpy.resetHistory();
      
      // Focus on DISCONNECTED terminal
      terminalManager.focusTerminal(terminal2);
      
      // Advance time (simulate "after a certain time")
      clock.tick(5000); // 5 seconds later
      
      // Verify: Still no status changes should occur
      expect(statusChangeSpy.callCount).to.equal(0,
        'Time delay after focus should NOT trigger CLI Agent status changes');
      
      // Verify: States should remain unchanged
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1);
      expect((terminalManager as any)._disconnectedAgents.has(terminal2)).to.be.true;
      
      clock.restore();
    });

    it('should maintain correct CLI Agent states during multiple focus operations', () => {
      // 🔍 Test multiple focus operations don't accumulate unwanted state changes
      
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();
      const terminal3 = terminalManager.createTerminal();
      
      const statusChangeSpy = sinon.spy();
      terminalManager.onCliAgentStatusChange(statusChangeSpy);
      
      // Setup: terminal1 CONNECTED, terminal2 DISCONNECTED, terminal3 NONE
      (terminalManager as any)._connectedAgentTerminalId = terminal1;
      (terminalManager as any)._connectedAgentType = 'claude';
      (terminalManager as any)._disconnectedAgents.set(terminal2, {
        terminalId: terminal2,
        type: 'gemini',
        disconnectedAt: Date.now()
      });
      
      statusChangeSpy.resetHistory();
      
      // Multiple focus operations
      terminalManager.focusTerminal(terminal2); // DISCONNECTED → focus
      terminalManager.focusTerminal(terminal3); // NONE → focus
      terminalManager.focusTerminal(terminal1); // CONNECTED → focus
      terminalManager.focusTerminal(terminal2); // DISCONNECTED → focus again
      
      // Verify: No status changes from any focus operations
      expect(statusChangeSpy.callCount).to.equal(0,
        'Multiple focus operations should NOT trigger CLI Agent status changes');
      
      // Verify: All states remain unchanged
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1,
        'CONNECTED terminal should remain CONNECTED');
      expect((terminalManager as any)._disconnectedAgents.has(terminal2)).to.be.true;
      expect((terminalManager as any)._disconnectedAgents.has(terminal3)).to.be.false;
    });
  });

  describe('Critical Bug Fix Verification', () => {
    it('should NOT promote DISCONNECTED agent to CONNECTED when old CLI Agent output is re-processed', () => {
      // 🔍 This test verifies the critical fix for the focus-induced status change bug
      // The bug was: DISCONNECTED agents became CONNECTED when old output was re-processed during buffer flushes
      
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();
      
      const statusChangeSpy = sinon.spy();
      terminalManager.onCliAgentStatusChange(statusChangeSpy);
      
      // Setup: terminal1 CONNECTED, terminal2 DISCONNECTED
      (terminalManager as any)._connectedAgentTerminalId = terminal1;
      (terminalManager as any)._connectedAgentType = 'claude';
      (terminalManager as any)._disconnectedAgents.set(terminal2, {
        terminalId: terminal2,
        type: 'claude',
        disconnectedAt: Date.now()
      });
      
      statusChangeSpy.resetHistory();
      
      // 🚨 CRITICAL TEST: Simulate old CLI Agent output being re-processed in DISCONNECTED terminal
      // This simulates what happens when focus triggers buffer flush and old Claude output is re-detected
      const oldClaudeOutput = 'Welcome to Claude Code! How can I help you today?';
      
      // Call the detection method directly on the DISCONNECTED terminal
      (terminalManager as any)._detectCliAgent(terminal2, oldClaudeOutput);
      
      // 🎯 VERIFICATION: DISCONNECTED terminal should remain DISCONNECTED
      // Before the fix, this would incorrectly promote terminal2 to CONNECTED
      
      // Verify: NO status change events should be fired
      expect(statusChangeSpy.callCount).to.equal(0, 
        'Re-processing old CLI Agent output should NOT trigger status changes');
      
      // Verify: terminal1 should still be CONNECTED
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1,
        'Original CONNECTED terminal should remain CONNECTED');
      
      // Verify: terminal2 should still be DISCONNECTED  
      expect((terminalManager as any)._disconnectedAgents.has(terminal2)).to.be.true;
      expect((terminalManager as any)._connectedAgentTerminalId).to.not.equal(terminal2,
        'DISCONNECTED terminal should NOT be promoted to CONNECTED from old output');
    });

    it('should still allow legitimate CLI Agent startup detection in terminals without existing agents', () => {
      // 🔍 This test verifies that the fix doesn't break legitimate CLI Agent detection
      
      const terminal1 = terminalManager.createTerminal();
      
      const statusChangeSpy = sinon.spy();
      terminalManager.onCliAgentStatusChange(statusChangeSpy);
      
      // Terminal has no existing CLI Agent (neither CONNECTED nor DISCONNECTED)
      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._disconnectedAgents.has(terminal1)).to.be.false;
      
      statusChangeSpy.resetHistory();
      
      // Simulate legitimate new CLI Agent startup output
      const newClaudeOutput = 'Welcome to Claude Code! How can I help you today?';
      
      // Call the detection method
      (terminalManager as any)._detectCliAgent(terminal1, newClaudeOutput);
      
      // 🎯 VERIFICATION: Should detect and set as CONNECTED (legitimate case)
      
      // Verify: Status change event should be fired
      expect(statusChangeSpy.callCount).to.equal(1, 
        'Legitimate CLI Agent startup should trigger status change');
      
      // Verify: terminal should become CONNECTED
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1,
        'New CLI Agent should be set as CONNECTED');
      
      // Verify: Status should be 'connected'
      expect(statusChangeSpy.firstCall.args[0]).to.deep.include({
        terminalId: terminal1,
        status: 'connected',
        type: 'claude',
      });
    });
  });
});