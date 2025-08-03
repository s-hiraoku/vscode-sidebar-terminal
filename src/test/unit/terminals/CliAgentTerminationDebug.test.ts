/**
 * CLI Agent Termination Debug Test
 * Debug test to identify why agents don't become DISCONNECTED when terminated
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../../shared/TestSetup';
import { TerminalManager } from '../../../terminals/TerminalManager';

describe('CLI Agent Termination Debug', () => {
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

  describe('Agent Termination Detection Debug', () => {
    it('should detect CLI Agent termination correctly', () => {
      const terminalId = terminalManager.createTerminal();

      // Start Claude Code
      (terminalManager as any)._detectCliAgentOptimized(terminalId, 'Welcome to Claude Code!');

      // Verify agent is CONNECTED
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminalId);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');

      // Test shell prompt detection directly first
      const shellPromptOutput = 'user@macbook:~/workspace$ ';
      const promptDetected = (terminalManager as any)._detectShellPromptReturn(
        shellPromptOutput.trim()
      );
      expect(promptDetected).to.be.true; // Shell prompt detection should work

      // Test termination detection directly
      const terminationDetected = (terminalManager as any)._detectCliAgentTermination(
        terminalId,
        shellPromptOutput.trim()
      );
      expect(terminationDetected).to.be.true; // Termination detection should work

      // Now should be terminated
      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._connectedAgentType).to.be.null;
    });

    it('should auto-promote DISCONNECTED agent when CONNECTED terminates', () => {
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();

      // Start Claude in terminal1 (will be CONNECTED)
      (terminalManager as any)._setCurrentAgent(terminal1, 'claude');

      // Start Gemini in terminal2 (should become DISCONNECTED because terminal1 is already CONNECTED)
      (terminalManager as any)._setCurrentAgent(terminal2, 'gemini');

      // Verify initial state - terminal2 should be CONNECTED (latest)
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal2);
      expect((terminalManager as any)._connectedAgentType).to.equal('gemini');

      // Verify terminal1 should be DISCONNECTED (previous)
      expect((terminalManager as any)._disconnectedAgents.has(terminal1)).to.be.true;
      const disconnectedAgent = (terminalManager as any)._disconnectedAgents.get(terminal1);
      expect(disconnectedAgent.type).to.equal('claude');

      // Terminate the CONNECTED agent (terminal2)
      const terminationDetected = (terminalManager as any)._detectCliAgentTermination(
        terminal2,
        'user@macbook:~/workspace$ '
      );
      expect(terminationDetected).to.be.true;

      // Should auto-promote terminal1 from DISCONNECTED to CONNECTED
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');
      expect((terminalManager as any)._disconnectedAgents.has(terminal1)).to.be.false;
    });

    it('should handle shell prompt detection with various formats', () => {
      const terminalId = terminalManager.createTerminal();

      // Start agent
      (terminalManager as any)._detectCliAgentOptimized(terminalId, 'Welcome to Claude Code!');
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminalId);

      // Test various shell prompt formats
      const shellPrompts = [
        'user@hostname:~/path$ ',
        'user@hostname ~/path % ',
        '$ ',
        '% ',
        '# ',
        '❯ ',
        '➜ user ',
        'PS C:\\> ',
      ];

      shellPrompts.forEach((prompt, index) => {
        // Reset state for each test
        if (index > 0) {
          (terminalManager as any)._detectCliAgentOptimized(terminalId, 'Welcome to Claude Code!');
        }

        console.log(`🔍 [DEBUG] Testing shell prompt: "${prompt}"`);

        (terminalManager as any)._detectCliAgentOptimized(terminalId, prompt);

        expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
        expect((terminalManager as any)._connectedAgentType).to.be.null;
      });
    });

    it('should test startup detection patterns directly', () => {
      const terminalId = terminalManager.createTerminal();

      // Test Claude startup detection
      const claudeResult = (terminalManager as any)._detectClaudeCodeStartup(
        'Welcome to Claude Code!'
      );
      expect(claudeResult).to.be.true;

      // Test Gemini startup detection
      const geminiResult = (terminalManager as any)._detectGeminiCliStartup('Gemini CLI activated');
      expect(geminiResult).to.be.true;

      // Test shell prompt detection method directly
      const testPrompts = [
        'user@macbook:~/workspace$ ',
        'user@hostname ~/path % ',
        '$ ',
        '% ',
        '# ',
        '❯ ',
        '➜ user ',
      ];

      testPrompts.forEach((prompt) => {
        const result = (terminalManager as any)._detectShellPromptReturn(prompt.trim());
        expect(result).to.be.true;
      });
    });

    it('should keep other agents as DISCONNECTED when CONNECTED terminal terminates', () => {
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();
      const terminal3 = terminalManager.createTerminal();

      // Start agents in three terminals
      // Terminal 1: Claude (should become DISCONNECTED)
      (terminalManager as any)._setCurrentAgent(terminal1, 'claude');

      // Terminal 2: Gemini (should become DISCONNECTED when terminal3 starts)
      (terminalManager as any)._setCurrentAgent(terminal2, 'gemini');

      // Terminal 3: Claude (should become CONNECTED - latest)
      (terminalManager as any)._setCurrentAgent(terminal3, 'claude');

      // Verify initial state: terminal3 is CONNECTED, others are DISCONNECTED
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal3);
      expect((terminalManager as any)._disconnectedAgents.has(terminal1)).to.be.true;
      expect((terminalManager as any)._disconnectedAgents.has(terminal2)).to.be.true;

      console.log(`🔍 [DEBUG] Initial state:
        CONNECTED: ${(terminalManager as any)._connectedAgentTerminalId}
        DISCONNECTED count: ${(terminalManager as any)._disconnectedAgents.size}
        DISCONNECTED terminals: ${String(Array.from((terminalManager as any)._disconnectedAgents.keys()))}`);

      // Set up spy to track all status change events
      const statusChangeSpy = sinon.spy();
      terminalManager.onCliAgentStatusChange(statusChangeSpy);

      // Terminate the CONNECTED terminal (terminal3)
      (terminalManager as any)._detectCliAgentTermination(terminal3, 'user@macbook:~/workspace$ ');

      // Verify what happened:
      // 1. Terminal3 should be terminated (none)
      // 2. One of the DISCONNECTED should be promoted to CONNECTED
      // 3. The other DISCONNECTED should remain DISCONNECTED (not none!)

      const connectedId = (terminalManager as any)._connectedAgentTerminalId;
      const disconnectedCount = (terminalManager as any)._disconnectedAgents.size;

      console.log(`🔍 [DEBUG] After termination:
        CONNECTED: ${connectedId}
        DISCONNECTED count: ${disconnectedCount}
        DISCONNECTED terminals: ${String(Array.from((terminalManager as any)._disconnectedAgents.keys()))}
        Status change events: ${statusChangeSpy.callCount}`);

      // Log all status change events
      statusChangeSpy.getCalls().forEach((call, index) => {
        const event = call.args[0];
        console.log(
          `📡 [DEBUG] Status Event ${index + 1}: Terminal ${event.terminalId} -> ${event.status} (${event.type})`
        );
      });

      // Expected behavior:
      // - One terminal should be CONNECTED (auto-promoted)
      // - One terminal should be DISCONNECTED (remaining agent)
      // - Terminal3 should be none (terminated)

      expect(connectedId).to.be.oneOf([terminal1, terminal2]); // One should be promoted
      expect(disconnectedCount).to.equal(1); // One should remain DISCONNECTED

      // The key assertion: the non-promoted terminal should still be tracked as DISCONNECTED
      const promotedTerminal = connectedId;
      const nonPromotedTerminal = promotedTerminal === terminal1 ? terminal2 : terminal1;

      expect((terminalManager as any)._disconnectedAgents.has(nonPromotedTerminal)).to.be.true;
      expect((terminalManager as any)._disconnectedAgents.has(promotedTerminal)).to.be.false;
      expect((terminalManager as any)._disconnectedAgents.has(terminal3)).to.be.false;
    });
  });
});
