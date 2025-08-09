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
      statusChangeEvents.push({ ...event });
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

      // Simulate agent termination via processOutputDetection (real flow)
      service.detectFromOutput(terminalId, 'Session ended. Goodbye!');

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

      // Simulate termination of disconnected agent via processOutputDetection
      service.detectFromOutput(terminal1, 'agent powering down');

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

      // Simulate shell prompt return after agent exit via processOutputDetection
      service.detectFromOutput(terminalId, 'user@macbook:~/workspace$ ');

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
        'Here is an example command: user@host$ ls -la',
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

      // Simulate process crash via processOutputDetection
      service.detectFromOutput(terminalId, 'Segmentation fault (core dumped)');

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

      // Terminate the connected agent (terminal2) via processOutputDetection
      service.detectFromOutput(terminal2, 'Session ended');

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
      expect(result.reason).to.include('No agent exists');
    });

    it('should handle multiple rapid termination calls', () => {
      const terminalId = 'test-terminal-1';

      // Start with connected agent
      service.detectFromInput(terminalId, 'claude code "test"');

      // Multiple termination attempts via processOutputDetection
      service.detectFromOutput(terminalId, 'Session ended');

      // After first termination, agent should be 'none'
      expect(service.getAgentState(terminalId).status).to.equal('none');

      // Subsequent termination attempts should not affect the 'none' state
      service.detectFromOutput(terminalId, 'goodbye');
      service.detectFromOutput(terminalId, 'Session ended');

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

  describe('AI Agent Exclusive Processing', () => {
    let service: CliAgentDetectionService;
    let statusChangeEvents: Array<{ terminalId: string; status: string; type: string | null }>;

    beforeEach(() => {
      service = new CliAgentDetectionService();
      statusChangeEvents = [];

      // Register the event listener - VS Code Event pattern
      service.onCliAgentStatusChange((event: any) => {
        statusChangeEvents.push(event);
      });
    });

    it('should move previous connected agent to disconnected when new agent starts (normal behavior)', () => {
      const terminal1 = 'term1';
      const terminal2 = 'term2';

      statusChangeEvents.length = 0;

      // Set initial connected agent via state manager
      const stateManager = (service as any).stateManager;

      stateManager.setConnectedAgent(terminal1, 'claude', 'Terminal 1');

      // Verify initial state
      expect(service.getAgentState(terminal1).status).to.equal('connected');
      expect(statusChangeEvents).to.have.lengthOf(1);
      expect(statusChangeEvents[0]?.status).to.equal('connected');

      statusChangeEvents.length = 0;

      // Set another agent as connected when no disconnected agents exist
      stateManager.setConnectedAgent(terminal2, 'gemini', 'Terminal 2');

      // Should have 2 events: new one -> connected, previous connected -> disconnected (normal behavior)
      expect(statusChangeEvents).to.have.lengthOf(2);

      // First event: new terminal connected
      expect(statusChangeEvents[0]?.terminalId).to.equal(terminal2);
      expect(statusChangeEvents[0]?.status).to.equal('connected');
      expect(statusChangeEvents[0]?.type).to.equal('gemini');

      // Second event: previous connected set to 'disconnected' (normal behavior)
      expect(statusChangeEvents[1]?.terminalId).to.equal(terminal1);
      expect(statusChangeEvents[1]?.status).to.equal('disconnected');
      expect(statusChangeEvents[1]?.type).to.equal('claude');

      // Final state verification
      expect(service.getAgentState(terminal1).status).to.equal('disconnected');
      expect(service.getAgentState(terminal2).status).to.equal('connected');
    });

    it('should handle multiple terminal transitions correctly', () => {
      const terminal1 = 'term1';
      const terminal2 = 'term2';
      const terminal3 = 'term3';

      statusChangeEvents.length = 0;

      // Set initial connected agent via state manager
      const stateManager = (service as any).stateManager;
      stateManager.setConnectedAgent(terminal1, 'claude', 'Terminal 1');

      // Connect terminal2, which will move terminal1 to disconnected
      stateManager.setConnectedAgent(terminal2, 'gemini', 'Terminal 2');
      // Now: terminal1 is disconnected, terminal2 is connected

      statusChangeEvents.length = 0;

      // Connect terminal3 - terminal2 should move to disconnected
      stateManager.setConnectedAgent(terminal3, 'gemini', 'Terminal 3');

      // Should have 2 events: new one -> connected, previous connected -> disconnected
      expect(statusChangeEvents).to.have.lengthOf(2);

      // First event: new terminal connected
      expect(statusChangeEvents[0]?.terminalId).to.equal(terminal3);
      expect(statusChangeEvents[0]?.status).to.equal('connected');
      expect(statusChangeEvents[0]?.type).to.equal('gemini');

      // Second event: previous connected moved to disconnected
      expect(statusChangeEvents[1]?.terminalId).to.equal(terminal2);
      expect(statusChangeEvents[1]?.status).to.equal('disconnected');
      expect(statusChangeEvents[1]?.type).to.equal('gemini');

      // Final state verification - now we have 2 disconnected agents and 1 connected
      expect(service.getAgentState(terminal1).status).to.equal('disconnected');
      expect(service.getAgentState(terminal2).status).to.equal('disconnected');
      expect(service.getAgentState(terminal3).status).to.equal('connected');
    });

    it('should handle promotion with normal behavior correctly', () => {
      const terminal1 = 'term1';
      const terminal2 = 'term2';

      statusChangeEvents.length = 0;

      // Set initial connected agent via state manager
      const stateManager = (service as any).stateManager;
      stateManager.setConnectedAgent(terminal1, 'claude', 'Terminal 1');

      // Connect terminal2, which will move terminal1 to disconnected (normal behavior)
      stateManager.setConnectedAgent(terminal2, 'gemini', 'Terminal 2');
      // Now terminal1 is disconnected, terminal2 is connected

      statusChangeEvents.length = 0;

      // Promote the disconnected agent (terminal1) - only 1 disconnected agent exists
      stateManager.promoteDisconnectedAgentToConnected(terminal1);

      // Should have 2 events: promoted one (terminal1) -> connected, previous connected (terminal2) -> disconnected
      expect(statusChangeEvents).to.have.lengthOf(2);

      // First event: promoted agent becomes connected
      expect(statusChangeEvents[0]?.terminalId).to.equal(terminal1);
      expect(statusChangeEvents[0]?.status).to.equal('connected');
      expect(statusChangeEvents[0]?.type).to.equal('claude');

      // Second event: previous connected (terminal2) should be moved to disconnected (normal behavior)
      expect(statusChangeEvents[1]?.terminalId).to.equal(terminal2);
      expect(statusChangeEvents[1]?.status).to.equal('disconnected');
      expect(statusChangeEvents[1]?.type).to.equal('gemini');

      // Final state verification
      expect(service.getAgentState(terminal2).status).to.equal('disconnected');
      expect(service.getAgentState(terminal1).status).to.equal('connected');
    });
  });

  describe('Claude Silent Exit Detection', () => {
    it('should detect Claude silent exit via shell prompt return', () => {
      const terminalId = 'claude-test';

      // Start Claude agent
      service.detectFromInput(terminalId, 'claude code "help"');
      expect(service.getAgentState(terminalId).status).to.equal('connected');

      statusChangeEvents.length = 0;

      // Claude exits silently, shell prompt returns
      service.detectFromOutput(terminalId, 'user@macbook:~/workspace$ ');

      // Should detect termination
      expect(service.getAgentState(terminalId).status).to.equal('none');
      expect(statusChangeEvents.some((e) => e.status === 'none')).to.be.true;
    });

    it('should detect Claude silent exit via process status indicators', () => {
      const terminalId = 'claude-test';

      service.detectFromInput(terminalId, 'claude code "test"');
      statusChangeEvents.length = 0;

      // Process completion indicators
      service.detectFromOutput(terminalId, '[process completed]');

      expect(service.getAgentState(terminalId).status).to.equal('none');
    });

    it('should detect Claude silent exit via exit codes', () => {
      const terminalId = 'claude-test';

      // Setup: Detect Claude agent from input
      console.log('🔍 TEST: Detecting Claude from input...');
      service.detectFromInput(terminalId, 'claude code "brief task"');
      const stateAfterInput = service.getAgentState(terminalId);
      console.log('🔍 TEST: State after input:', stateAfterInput.status);
      statusChangeEvents.length = 0;

      // Action: Send exit code
      console.log('🔍 TEST: Sending exit code "0"...');
      service.detectFromOutput(terminalId, '0');
      const stateAfterOutput = service.getAgentState(terminalId);
      console.log('🔍 TEST: State after output:', stateAfterOutput.status);

      expect(service.getAgentState(terminalId).status).to.equal('none');
    });

    it('should detect various Claude silent exit patterns', () => {
      const silentExitPatterns = [
        'user@host:~$ ',
        '[process completed]',
        '[done]',
        '[finished]',
        '0',
        '1',
        'exit',
        '[1]',
        '[2]',
        'admin@macbook workspace % ',
        '❯ ',
        '$ ',
      ];

      silentExitPatterns.forEach((pattern, index) => {
        const terminalId = `claude-test-${index}`;

        // Start Claude agent
        service.detectFromInput(terminalId, 'claude code "test"');
        expect(service.getAgentState(terminalId).status).to.equal('connected');

        statusChangeEvents.length = 0;

        // Test silent exit pattern
        service.detectFromOutput(terminalId, pattern);

        // Should detect termination
        const finalState = service.getAgentState(terminalId).status;
        expect(finalState, `Pattern "${pattern}" should terminate Claude agent`).to.equal('none');
      });
    });

    it('should not detect false positives in normal Claude output', () => {
      const terminalId = 'claude-test';

      service.detectFromInput(terminalId, 'claude code "help"');
      statusChangeEvents.length = 0;

      // Normal Claude responses should not trigger termination
      service.detectFromOutput(terminalId, 'I can help you with that task.');
      service.detectFromOutput(terminalId, 'Here are the files I found:');
      service.detectFromOutput(terminalId, 'Let me analyze this code for you.');
      service.detectFromOutput(terminalId, 'Based on your requirements, I suggest...');

      // Should remain connected
      expect(service.getAgentState(terminalId).status).to.equal('connected');
      expect(statusChangeEvents.every((e) => e.status !== 'none')).to.be.true;
    });
  });

  describe('Claude Improved Termination Detection (False Positive Prevention)', () => {
    it('should detect legitimate shell prompt patterns', () => {
      // Test various valid shell prompt patterns

      const validPrompts = [
        'john@macbook:~$ ',
        'user@ubuntu:/home/user$ ',
        'dev@server $ ',
        '$ ',
        '% ', // zsh
      ];

      validPrompts.forEach((prompt) => {
        const testTerminalId = `claude-test-${Math.random()}`;

        service.detectFromInput(testTerminalId, 'claude code "test"');
        statusChangeEvents.length = 0;

        service.detectFromOutput(testTerminalId, prompt);

        expect(service.getAgentState(testTerminalId).status).to.equal(
          'none',
          `Valid shell prompt "${prompt}" should terminate Claude agent`
        );
      });
    });

    it('should NOT detect false positives from user input', () => {
      const terminalId = 'claude-test';

      service.detectFromInput(terminalId, 'claude code "test task"');
      statusChangeEvents.length = 0;

      // Common false positives that should NOT trigger termination
      const falsePositives = [
        'exit', // User typing "exit" command
        '0', // User typing a number
        '1', // User typing a number
        'exit code 0', // Normal command output
        'The task is done', // Contains "done" but with task context
        '+', // Just a plus sign
        '-', // Just a minus sign
        '[finished] my work', // Process completion with context
      ];

      falsePositives.forEach((input) => {
        service.detectFromOutput(terminalId, input);
        expect(service.getAgentState(terminalId).status).to.equal(
          'connected',
          `False positive "${input}" should NOT terminate agent`
        );
      });
    });

    it('should detect explicit Claude termination messages', () => {
      const terminalId = 'claude-test';

      service.detectFromInput(terminalId, 'claude code "simple query"');
      statusChangeEvents.length = 0;

      // Explicit termination messages should work
      service.detectFromOutput(terminalId, 'Session ended. Goodbye!');

      expect(service.getAgentState(terminalId).status).to.equal('none');
    });

    it('should detect contextual process completion without false positives', () => {
      const terminalId1 = 'claude-test-1';
      const terminalId2 = 'claude-test-2';

      // Test 1: Simple [done] should work
      service.detectFromInput(terminalId1, 'claude code "test1"');
      service.detectFromOutput(terminalId1, '[done]');
      expect(service.getAgentState(terminalId1).status).to.equal('none');

      // Test 2: [done] with task context should NOT work (false positive prevention)
      service.detectFromInput(terminalId2, 'claude code "test2"');
      service.detectFromOutput(
        terminalId2,
        'The task [done] successfully completed with all requirements met'
      );
      expect(service.getAgentState(terminalId2).status).to.equal('connected');
    });

    it('should not detect incomplete or malformed shell prompts', () => {
      const terminalId = 'claude-test';

      service.detectFromInput(terminalId, 'claude code "test"');
      statusChangeEvents.length = 0;

      const invalidPrompts = [
        'user@host:', // Incomplete
        'some text $ more', // $ in middle of sentence
        '$$$ money here', // Multiple $ but not a shell prompt
        'price: $50 today', // $ in price context
        '@host $', // Missing user part
      ];

      invalidPrompts.forEach((prompt) => {
        service.detectFromOutput(terminalId, prompt);
        expect(service.getAgentState(terminalId).status).to.equal(
          'connected',
          `Invalid prompt "${prompt}" should NOT terminate agent`
        );
      });
    });
  });
});
