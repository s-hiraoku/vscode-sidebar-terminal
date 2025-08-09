/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { CliAgentDetectionService } from '../../../services/CliAgentDetectionService';
import { CliAgentStateManager } from '../../../services/CliAgentStateManager';
import { setupTestEnvironment } from '../../shared/TestSetup';

describe('CLI Agent Termination Fix - Regression Prevention', () => {
  let sandbox: sinon.SinonSandbox;
  let service: CliAgentDetectionService;
  let stateManager: CliAgentStateManager;
  let statusChangeEvents: any[] = [];

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    setupTestEnvironment();
    
    service = new CliAgentDetectionService();
    stateManager = service.stateManager;
    
    // Track all status change events
    statusChangeEvents = [];
    stateManager.onStatusChange((event) => {
      statusChangeEvents.push({...event});
    });
  });

  afterEach(() => {
    service.dispose();
    sandbox.restore();
  });

  describe('Status transitions to none on termination', () => {
    it('should emit status:none with type:null when connected agent terminates', () => {
      const terminalId = 'test-terminal-1';
      
      // Start with a connected Claude agent
      service.detectFromInput(terminalId, 'claude code "test"');
      
      // Verify agent is connected
      const initialState = service.getAgentState(terminalId);
      expect(initialState.status).to.equal('connected');
      expect(initialState.agentType).to.equal('claude');
      
      // Clear previous events
      statusChangeEvents = [];
      
      // Simulate agent termination with explicit message
      const terminationResult = service.detectTermination(terminalId, 'Session ended. Goodbye!');
      
      // Verify termination was detected
      expect(terminationResult.isTerminated).to.be.true;
      expect(terminationResult.reason).to.include('explicit termination');
      
      // Verify final state is 'none'
      const finalState = service.getAgentState(terminalId);
      expect(finalState.status).to.equal('none');
      expect(finalState.agentType).to.be.null;
      
      // Verify status change event was emitted with type:null
      expect(statusChangeEvents).to.have.lengthOf(1);
      const event = statusChangeEvents[0];
      expect(event.terminalId).to.equal(terminalId);
      expect(event.status).to.equal('none');
      expect(event.type).to.be.null; // Critical fix: type must be null for 'none' status
    });

    it('should emit status:none with type:null when disconnected agent terminates', () => {
      const terminal1 = 'test-terminal-1';
      const terminal2 = 'test-terminal-2';
      
      // Start with Claude in terminal1
      service.detectFromInput(terminal1, 'claude code "test"');
      
      // Start Gemini in terminal2 (Claude moves to disconnected)
      service.detectFromInput(terminal2, 'gemini code "hello"');
      
      // Verify terminal1 is disconnected
      const disconnectedState = service.getAgentState(terminal1);
      expect(disconnectedState.status).to.equal('disconnected');
      
      // Clear previous events
      statusChangeEvents = [];
      
      // Simulate termination of disconnected agent
      const terminationResult = service.detectTermination(terminal1, 'agent powering down');
      
      // Verify termination was detected
      expect(terminationResult.isTerminated).to.be.true;
      
      // Verify final state is 'none'
      const finalState = service.getAgentState(terminal1);
      expect(finalState.status).to.equal('none');
      expect(finalState.agentType).to.be.null;
      
      // Verify status change event
      expect(statusChangeEvents).to.have.lengthOf(1);
      const event = statusChangeEvents[0];
      expect(event.terminalId).to.equal(terminal1);
      expect(event.status).to.equal('none');
      expect(event.type).to.be.null; // Critical fix: type must be null for 'none' status
    });

    it('should handle shell prompt detection for termination', () => {
      const terminalId = 'test-terminal-1';
      
      // Start with a connected Gemini agent
      service.detectFromOutput(terminalId, 'Welcome to Gemini CLI v1.2.3');
      
      // Verify agent is connected
      const initialState = service.getAgentState(terminalId);
      expect(initialState.status).to.equal('connected');
      expect(initialState.agentType).to.equal('gemini');
      
      // Clear previous events
      statusChangeEvents = [];
      
      // Simulate shell prompt return after agent exit
      const terminationResult = service.detectTermination(terminalId, 'user@macbook:~/workspace$ ');
      
      // Verify termination was detected
      expect(terminationResult.isTerminated).to.be.true;
      expect(terminationResult.reason).to.include('Shell prompt');
      
      // Verify status transition to 'none'
      const finalState = service.getAgentState(terminalId);
      expect(finalState.status).to.equal('none');
      expect(finalState.agentType).to.be.null;
      
      // Verify event
      expect(statusChangeEvents).to.have.lengthOf(1);
      expect(statusChangeEvents[0].status).to.equal('none');
      expect(statusChangeEvents[0].type).to.be.null;
    });

    it('should not detect termination on AI output that looks like shell prompt', () => {
      const terminalId = 'test-terminal-1';
      
      // Start with a connected Claude agent
      service.detectFromInput(terminalId, 'claude code "test"');
      
      // Try various AI outputs that might look like prompts but aren't
      const aiOutputs = [
        'Claude assistant here to help you>',
        'I am Claude, your AI assistant$',
        'Gemini: Ready to help#',
        'Here is an example command: user@host$ ls -la'
      ];
      
      for (const output of aiOutputs) {
        const result = service.detectTermination(terminalId, output);
        
        // Should NOT detect termination for AI output
        expect(result.isTerminated).to.be.false;
        
        // Agent should remain connected
        const state = service.getAgentState(terminalId);
        expect(state.status).to.equal('connected');
      }
    });

    it('should handle process crash indicators', () => {
      const terminalId = 'test-terminal-1';
      
      // Start with a connected agent
      service.detectFromInput(terminalId, 'claude code "test"');
      
      // Clear events
      statusChangeEvents = [];
      
      // Simulate process crash
      const crashResult = service.detectTermination(terminalId, 'Segmentation fault (core dumped)');
      
      // Verify crash was detected as termination
      expect(crashResult.isTerminated).to.be.true;
      expect(crashResult.reason).to.include('crash');
      
      // Verify transition to 'none'
      const finalState = service.getAgentState(terminalId);
      expect(finalState.status).to.equal('none');
      expect(finalState.agentType).to.be.null;
      
      // Verify event
      expect(statusChangeEvents).to.have.lengthOf(1);
      expect(statusChangeEvents[0].status).to.equal('none');
      expect(statusChangeEvents[0].type).to.be.null;
    });

    it('should auto-promote disconnected agent when connected agent terminates', () => {
      const terminal1 = 'test-terminal-1';
      const terminal2 = 'test-terminal-2';
      
      // Setup: Claude in terminal1, Gemini in terminal2
      service.detectFromInput(terminal1, 'claude code "test"');
      service.detectFromInput(terminal2, 'gemini code "hello"');
      
      // Terminal2 should be connected, terminal1 disconnected
      expect(service.getAgentState(terminal2).status).to.equal('connected');
      expect(service.getAgentState(terminal1).status).to.equal('disconnected');
      
      // Clear events
      statusChangeEvents = [];
      
      // Terminate the connected agent (terminal2)
      service.detectTermination(terminal2, 'Session ended');
      
      // Verify terminal2 transitioned to 'none'
      expect(service.getAgentState(terminal2).status).to.equal('none');
      
      // Verify terminal1 was auto-promoted to connected
      expect(service.getAgentState(terminal1).status).to.equal('connected');
      
      // Should have 2 events: terminal2 -> none, terminal1 -> connected
      expect(statusChangeEvents).to.have.lengthOf(2);
      
      // First event: terminal2 termination
      expect(statusChangeEvents[0].terminalId).to.equal(terminal2);
      expect(statusChangeEvents[0].status).to.equal('none');
      expect(statusChangeEvents[0].type).to.be.null;
      
      // Second event: terminal1 promotion
      expect(statusChangeEvents[1].terminalId).to.equal(terminal1);
      expect(statusChangeEvents[1].status).to.equal('connected');
      expect(statusChangeEvents[1].type).to.equal('claude');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle termination detection for non-existent terminal', () => {
      const result = service.detectTermination('non-existent', 'exit');
      
      // Should return non-terminated result
      expect(result.isTerminated).to.be.false;
      expect(result.reason).to.include('No termination');
    });

    it('should handle multiple rapid termination calls', () => {
      const terminalId = 'test-terminal-1';
      
      // Start with connected agent
      service.detectFromInput(terminalId, 'claude code "test"');
      
      // Multiple termination attempts
      const result1 = service.detectTermination(terminalId, 'exit');
      const result2 = service.detectTermination(terminalId, 'goodbye');
      const result3 = service.detectTermination(terminalId, 'Session ended');
      
      // First should succeed
      expect(result1.isTerminated).to.be.true;
      
      // Subsequent calls should not detect termination (already terminated)
      expect(result2.isTerminated).to.be.false;
      expect(result3.isTerminated).to.be.false;
      
      // State should remain 'none'
      expect(service.getAgentState(terminalId).status).to.equal('none');
    });

    it('should not interfere with normal terminal operations when no agent is running', () => {
      const terminalId = 'test-terminal-1';
      
      // No agent started - terminal in 'none' state
      expect(service.getAgentState(terminalId).status).to.equal('none');
      
      // Shell prompt in normal terminal (no agent)
      const result = service.detectTermination(terminalId, 'user@host:~$ ');
      
      // Should not detect termination (nothing to terminate)
      expect(result.isTerminated).to.be.false;
      
      // Status remains 'none'
      expect(service.getAgentState(terminalId).status).to.equal('none');
      
      // No events should be emitted
      expect(statusChangeEvents).to.have.lengthOf(0);
    });

    it('should handle terminal removal vs agent termination correctly', () => {
      const terminalId = 'test-terminal-1';
      
      // Start with connected agent
      service.detectFromInput(terminalId, 'claude code "test"');
      
      // Clear events
      statusChangeEvents = [];
      
      // Remove terminal completely (different from agent termination)
      service.handleTerminalRemoved(terminalId);
      
      // State should be cleared
      expect(service.getAgentState(terminalId).status).to.equal('none');
      expect(service.getAgentState(terminalId).agentType).to.be.null;
      
      // Should emit status change event
      expect(statusChangeEvents).to.have.lengthOf(1);
      expect(statusChangeEvents[0].status).to.equal('none');
      expect(statusChangeEvents[0].type).to.be.null;
    });
  });
});