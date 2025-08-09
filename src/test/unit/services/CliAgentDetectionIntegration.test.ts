/**
 * CLI Agent Detection Service Integration Tests
 *
 * 🎯 PURPOSE: Test realistic scenarios and prevent regressions in integrated workflows
 * 🚨 CRITICAL: These tests simulate actual user workflows and catch complex bugs
 *
 * Test Scenarios:
 * 1. Complete user workflows (startup → usage → termination)
 * 2. Multi-agent scenarios with switching
 * 3. Error recovery and resilience
 * 4. Performance under load
 * 5. Real terminal output simulation
 * 6. Bug reproduction and regression prevention
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';

import { CliAgentDetectionService } from '../../../services/CliAgentDetectionService';
import { ICliAgentDetectionService } from '../../../interfaces/CliAgentService';

describe('🌐 CLI Agent Detection Service Integration Tests', () => {
  let detectionService: ICliAgentDetectionService;
  let sandbox: sinon.SinonSandbox;

  // Event tracking for integration tests
  let allStatusChangeEvents: Array<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
    timestamp: number;
  }> = [];

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    allStatusChangeEvents = [];

    detectionService = new CliAgentDetectionService();

    // Track all events with timestamps
    detectionService.onCliAgentStatusChange((event) => {
      allStatusChangeEvents.push({
        ...event,
        timestamp: Date.now(),
      });
    });
  });

  afterEach(() => {
    detectionService.dispose();
    sandbox.restore();
    allStatusChangeEvents = [];
  });

  // =================== REAL WORKFLOW SIMULATION TESTS ===================

  describe('👤 Real User Workflow Simulations', () => {
    it('should handle complete Claude workflow: command input → startup → usage → exit', async () => {
      // PHASE 1: User types command
      let result = detectionService.detectFromInput('term1', 'claude\r');
      expect(result).to.not.be.null;
      if (result) {
        expect(result.agentType).to.equal('claude');
        expect(result.source).to.equal('input');
      }

      // PHASE 2: Claude starts up with real output
      const startupOutputs = [
        'Initializing Claude Code...',
        'Welcome to Claude Code!',
        "I'm Claude, an AI assistant created by Anthropic.",
        'Powered by Claude 3.5 Sonnet',
        '> Try "edit <filepath>" to edit files',
      ];

      startupOutputs.forEach((output) => {
        detectionService.detectFromOutput('term1', output);
      });

      // Verify connected state
      expect(detectionService.getAgentState('term1').status).to.equal('connected');

      // PHASE 3: Normal usage - Claude responds to user queries
      const usageOutputs = [
        "I'll help you with that task.",
        "Here's the code you requested:",
        'def example_function():',
        '    return "Hello, World!"',
        'This function demonstrates a simple example.',
        'Would you like me to explain how it works?',
      ];

      usageOutputs.forEach((output) => {
        detectionService.detectFromOutput('term1', output);
      });

      // Should remain connected during usage
      expect(detectionService.getAgentState('term1').status).to.equal('connected');

      // PHASE 4: User exits
      const exitResult = detectionService.detectTermination(
        'term1',
        '/exit\nuser@hostname:~/project$ '
      );
      expect(exitResult.isTerminated).to.be.true;

      // Simulate termination handling
      detectionService.handleTerminalRemoved('term1');

      // Final state should be none
      expect(detectionService.getAgentState('term1').status).to.equal('none');

      // Verify event sequence
      expect(allStatusChangeEvents.length).to.be.greaterThan(0);
      const finalEvent = allStatusChangeEvents[allStatusChangeEvents.length - 1];
      expect(finalEvent).to.not.be.undefined;
      if (!finalEvent) return; // Type guard
      expect(finalEvent.status).to.equal('none');
    });

    it('should handle complete Gemini workflow: startup → model loading → usage → termination', () => {
      // PHASE 1: Gemini startup sequence
      const geminiStartupSequence = [
        '$ gemini code',
        'Initializing Gemini CLI...',
        'Connecting to Google AI services...',
        'Loading gemini-1.5-pro model...',
        'Gemini CLI starting up...',
        'Welcome to Gemini Interactive!',
        'gemini> ready for input',
      ];

      geminiStartupSequence.forEach((output) => {
        if (output.startsWith('$ gemini')) {
          detectionService.detectFromInput('term1', output.replace('$ ', '') + '\r');
        } else {
          detectionService.detectFromOutput('term1', output);
        }
      });

      expect(detectionService.getAgentState('term1').status).to.equal('connected');
      expect(detectionService.getAgentState('term1').agentType).to.equal('gemini');

      // PHASE 2: Model interaction
      const geminiInteraction = [
        'Human: Write a Python function to calculate fibonacci',
        "Gemini: Here's a Python function to calculate Fibonacci numbers:",
        '',
        'def fibonacci(n):',
        '    if n <= 1:',
        '        return n',
        '    return fibonacci(n-1) + fibonacci(n-2)',
        '',
        'This function uses recursion to calculate the nth Fibonacci number.',
        'gemini> ready for next query',
      ];

      geminiInteraction.forEach((output) => {
        detectionService.detectFromOutput('term1', output);
      });

      // Should remain connected
      expect(detectionService.getAgentState('term1').status).to.equal('connected');

      // PHASE 3: Session end
      const terminationResult = detectionService.detectTermination(
        'term1',
        'quit\nGemini session ended.\nuser@hostname:~$ '
      );
      expect(terminationResult.isTerminated).to.be.true;
      expect(terminationResult.reason).to.equal('exit_command');

      detectionService.handleTerminalRemoved('term1');
      expect(detectionService.getAgentState('term1').status).to.equal('none');
    });

    it('should handle developer workflow: multiple terminals, agent switching, file operations', () => {
      // SCENARIO: Developer opens multiple terminals for different tasks

      // Terminal 1: Start Claude for code editing
      detectionService.detectFromInput('term1', 'claude\r');
      detectionService.detectFromOutput('term1', 'Welcome to Claude Code!');

      // Terminal 2: Start Gemini for documentation
      detectionService.detectFromInput('term2', 'gemini\r');
      detectionService.detectFromOutput('term2', 'Gemini CLI starting up...');

      // Verify states: Gemini connected (latest), Claude disconnected
      expect(detectionService.getAgentState('term1').status).to.equal('disconnected');
      expect(detectionService.getAgentState('term2').status).to.equal('connected');

      // Developer switches back to Claude using toggle
      const switchResult = detectionService.switchAgentConnection('term1');
      expect(switchResult.success).to.be.true;
      expect(detectionService.getAgentState('term1').status).to.equal('connected');
      expect(detectionService.getAgentState('term2').status).to.equal('disconnected');

      // Claude performs file operations
      const fileOperations = [
        "I'll help you edit the file.",
        'Reading /home/user/project/main.py...',
        'File analysis complete.',
        'Applying requested changes...',
        'File updated successfully.',
      ];

      fileOperations.forEach((output) => {
        detectionService.detectFromOutput('term1', output);
      });

      expect(detectionService.getAgentState('term1').status).to.equal('connected');

      // Clean shutdown
      detectionService.detectTermination('term1', '/exit');
      detectionService.handleTerminalRemoved('term1');

      // Gemini should be auto-promoted
      expect(detectionService.getAgentState('term2').status).to.equal('connected');

      // Final cleanup
      detectionService.handleTerminalRemoved('term2');
      expect(detectionService.getAgentState('term2').status).to.equal('none');
    });
  });

  // =================== COMPLEX MULTI-AGENT SCENARIOS ===================

  describe('🤝 Multi-Agent Complex Scenarios', () => {
    it('should handle rapid agent switching without state corruption', () => {
      // Simulate rapid switching between multiple agents
      const agents = [
        { id: 'term1', type: 'claude', startupMsg: 'Welcome to Claude Code!' },
        { id: 'term2', type: 'gemini', startupMsg: 'Gemini CLI starting up...' },
        { id: 'term3', type: 'claude', startupMsg: 'Claude assistant ready' },
        { id: 'term4', type: 'gemini', startupMsg: 'gemini-pro initialized' },
      ];

      // Rapid sequential startup
      agents.forEach(({ id, type, startupMsg }) => {
        detectionService.detectFromOutput(id, startupMsg);

        // Verify state consistency after each operation
        const state = detectionService.getAgentState(id);
        if (detectionService.getConnectedAgent()?.terminalId === id) {
          expect(state.status).to.equal('connected');
          expect(state.agentType).to.equal(type);
        }
      });

      // Final state verification
      const connectedAgent = detectionService.getConnectedAgent();
      expect(connectedAgent).to.not.be.null;
      expect(connectedAgent!.terminalId).to.equal('term4'); // Last started
      expect(connectedAgent!.agentType).to.equal('gemini');

      // All others should be disconnected
      ['term1', 'term2', 'term3'].forEach((termId) => {
        expect(detectionService.getAgentState(termId).status).to.equal('disconnected');
      });
    });

    it('should handle cascading terminations and promotions', () => {
      // Setup: 4 agents with different start times
      const clock = sinon.useFakeTimers();

      detectionService.detectFromOutput('term1', 'Welcome to Claude Code!'); // T=0
      clock.tick(1000);
      detectionService.detectFromOutput('term2', 'Gemini CLI starting up...'); // T=1000, term1 disconnected
      clock.tick(1000);
      detectionService.detectFromOutput('term3', 'Claude assistant ready'); // T=2000, term2 disconnected
      clock.tick(1000);
      detectionService.detectFromOutput('term4', 'gemini-pro initialized'); // T=3000, term3 disconnected

      // State: term4 connected, others disconnected in chronological order
      expect(detectionService.getConnectedAgent()?.terminalId).to.equal('term4');
      expect(detectionService.getDisconnectedAgents().size).to.equal(3);

      // Remove connected agent → should promote term3 (most recent disconnected)
      detectionService.handleTerminalRemoved('term4');
      expect(detectionService.getConnectedAgent()?.terminalId).to.equal('term3');

      // Remove newly connected agent → should promote term2
      detectionService.handleTerminalRemoved('term3');
      expect(detectionService.getConnectedAgent()?.terminalId).to.equal('term2');

      // Remove again → should promote term1 (oldest but last remaining)
      detectionService.handleTerminalRemoved('term2');
      expect(detectionService.getConnectedAgent()?.terminalId).to.equal('term1');

      // Remove last agent → no agents left
      detectionService.handleTerminalRemoved('term1');
      expect(detectionService.getConnectedAgent()).to.be.null;

      clock.restore();
    });

    it('should maintain state consistency during concurrent operations', () => {
      // Simulate concurrent operations that could cause race conditions
      const operations = [
        () => detectionService.detectFromOutput('term1', 'Welcome to Claude Code!'),
        () => detectionService.detectFromOutput('term2', 'Gemini CLI starting up...'),
        () => detectionService.switchAgentConnection('term1'),
        () => detectionService.detectFromOutput('term3', 'Claude assistant ready'),
        () => detectionService.detectTermination('term2', 'exit'),
        () => detectionService.handleTerminalRemoved('term3'),
        () => detectionService.detectFromOutput('term4', 'gemini-pro initialized'),
      ];

      // Execute all operations rapidly
      operations.forEach((op) => op());

      // Verify final state consistency
      const connectedAgent = detectionService.getConnectedAgent();
      const disconnectedAgents = detectionService.getDisconnectedAgents();

      // Basic consistency checks
      if (connectedAgent) {
        expect(connectedAgent.terminalId).to.not.be.undefined;
        expect(disconnectedAgents.has(connectedAgent.terminalId)).to.be.false;
        expect(detectionService.getAgentState(connectedAgent.terminalId).status).to.equal(
          'connected'
        );
      }

      // All disconnected agents should have proper state
      for (const [termId] of disconnectedAgents) {
        expect(detectionService.getAgentState(termId).status).to.equal('disconnected');
      }

      // Event count should be reasonable
      expect(allStatusChangeEvents.length).to.be.greaterThan(0);
      expect(allStatusChangeEvents.length).to.be.lessThan(20);
    });
  });

  // =================== BUG REPRODUCTION AND REGRESSION TESTS ===================

  describe('🐛 Bug Reproduction and Regression Prevention', () => {
    it('🚨 BUG REPRODUCTION: Agent status becomes "none" during normal operation', () => {
      // This test reproduces the specific issue reported by the user

      // ARRANGE: Start Claude agent normally
      detectionService.detectFromInput('term1', 'claude\r');
      detectionService.detectFromOutput('term1', 'Welcome to Claude Code!');

      // Verify initial connected state
      expect(detectionService.getAgentState('term1').status).to.equal('connected');
      expect(detectionService.getAgentState('term1').agentType).to.equal('claude');

      allStatusChangeEvents = []; // Clear events to focus on the bug

      // ACT: Send normal Claude operation outputs that might trigger false termination
      const normalClaudeOutputs = [
        // Code generation responses
        'I can help you with that task.',
        'Here is the Python function you requested:',
        '',
        'def calculate_fibonacci(n):',
        '    if n <= 1:',
        '        return n',
        '    return fibonacci(n-1) + fibonacci(n-2)',
        '',
        'This function uses recursion to calculate Fibonacci numbers.',
        'Would you like me to add error handling or optimize it further?',

        // File operation responses
        "I'll analyze the file structure for you.",
        'Reading the contents of main.py...',
        'File analysis complete. Here are my findings:',
        '- The function on line 15 could be optimized',
        '- Consider adding type hints for better readability',

        // Problem-solving responses
        'Let me break down this problem step by step:',
        '1. First, we need to understand the requirements',
        '2. Then, we can design the solution architecture',
        '3. Finally, we implement and test the code',

        // Interactive responses
        'Great question! Let me explain how this works.',
        'The key difference between these approaches is...',
        "To summarize what we've covered so far:",

        // Code review responses
        "I've reviewed your code and found a few improvements:",
        'Overall, the logic is sound, but here are some suggestions:',
        'The implementation looks good. Nice work!',
      ];

      // Process each output and verify agent remains connected
      normalClaudeOutputs.forEach((output, index) => {
        detectionService.detectFromOutput('term1', output);

        const currentState = detectionService.getAgentState('term1');
        expect(currentState.status).to.equal(
          'connected',
          `BUG DETECTED: Agent became "${currentState.status}" after output #${index + 1}: "${output}"`
        );
        expect(currentState.agentType).to.equal(
          'claude',
          `BUG DETECTED: Agent type changed to "${currentState.type}" after output #${index + 1}`
        );
      });

      // ASSERT: Agent should still be connected after all normal operations
      const finalState = detectionService.getAgentState('term1');
      expect(finalState.status).to.equal(
        'connected',
        'CRITICAL BUG: Agent status became "none" during normal operation'
      );
      expect(finalState.agentType).to.equal('claude');

      // Should have NO additional status change events during normal operation
      expect(allStatusChangeEvents).to.have.length(
        0,
        'BUG DETECTED: Unexpected status change events fired during normal Claude operation'
      );
    });

    it('🚨 FLICKERING BUG REGRESSION TEST: Should not cause connected/disconnected flickering', () => {
      // This test verifies the fix for the flickering issue described in CLAUDE.md

      // ARRANGE: Start Claude
      detectionService.detectFromOutput('term1', 'Welcome to Claude Code!');
      expect(allStatusChangeEvents).to.have.length(1);
      if (allStatusChangeEvents.length > 0) {
        expect(allStatusChangeEvents[0]?.status).to.equal('connected');
      }

      // Clear events to monitor flickering
      allStatusChangeEvents = [];

      // ACT: Send outputs that previously caused flickering
      const potentialFlickerTriggers = [
        // Code examples with shell-like symbols
        'def shell_command():\n    return "result$"',
        'echo "Price: $19.99"',
        'git status # shows current state',
        'ls -la > output.txt',

        // Documentation with command references
        'To run this command, use: python script.py',
        'The shell prompt will show: user@hostname:~$',
        'Exit codes: 0=success, 1=error',

        // Code comments and examples
        '// This is a comment with $ symbol',
        '/* Multi-line comment with # symbol */',
        'const price = "$100";',
        'SELECT * FROM users WHERE id = 123;',

        // Log-like output
        '[INFO] Processing request...',
        '[DEBUG] Connection status: OK',
        '[ERROR] Validation failed',

        // Mixed content
        'The function returns: {"status": "ok", "code": 200}',
        'User input: "What is 2+2?" → Answer: 4',
        'Command output:\nHello World\nProcess completed.',
      ];

      potentialFlickerTriggers.forEach((output) => {
        detectionService.detectFromOutput('term1', output);
      });

      // ASSERT: No flickering should occur
      const finalState = detectionService.getAgentState('term1');
      expect(finalState.status).to.equal('connected');
      expect(finalState.agentType).to.equal('claude');

      // Critical: NO status change events should be fired
      expect(allStatusChangeEvents).to.have.length(
        0,
        'REGRESSION BUG: Flickering detected - unexpected status change events'
      );

      // Verify stability by checking connected agent
      const connectedAgent = detectionService.getConnectedAgent();
      expect(connectedAgent).to.not.be.null;
      expect(connectedAgent).to.not.be.undefined;
      if (!connectedAgent) return; // Type guard
      expect(connectedAgent.terminalId).to.equal('term1');
      expect(connectedAgent.agentType).to.equal('claude');
    });

    it('🚨 DISCONNECTED AGENT PROMOTION BUG: Should block invalid promotions', () => {
      // This test verifies the fix for inappropriate promotion of disconnected agents

      // ARRANGE: Setup scenario with disconnected agent
      detectionService.detectFromOutput('term1', 'Welcome to Claude Code!');
      detectionService.detectFromOutput('term2', 'Gemini CLI starting up...');

      // term1 is now disconnected, term2 is connected
      expect(detectionService.getAgentState('term1').status).to.equal('disconnected');
      expect(detectionService.getAgentState('term2').status).to.equal('connected');

      allStatusChangeEvents = []; // Clear events

      // ACT: Try to trigger reconnection of disconnected agent via output re-processing
      // This simulates the scenario where old startup output gets reprocessed
      const result = detectionService.detectFromOutput('term1', 'Welcome to Claude Code!');

      // ASSERT: Should be blocked
      expect(result).to.be.null;
      expect(detectionService.getAgentState('term1').status).to.equal('disconnected');
      expect(detectionService.getAgentState('term2').status).to.equal('connected');

      // No events should be fired
      expect(allStatusChangeEvents).to.have.length(0);
    });
  });

  // =================== REAL TERMINAL OUTPUT SIMULATION ===================

  describe('📺 Real Terminal Output Simulation', () => {
    it('should handle real Claude Code session with ANSI escape sequences', () => {
      const realClaudeSession = [
        // Initial startup with colors
        '\x1b[36mInitializing Claude Code...\x1b[0m',
        '\x1b[1;32mWelcome to Claude Code!\x1b[0m',
        '\x1b[33m> Try "edit <filepath>" to edit files\x1b[0m',
        '',
        // User interaction with formatting
        '\x1b[1mHuman:\x1b[0m Can you help me write a Python function?',
        '',
        "\x1b[1;34mClaude:\x1b[0m I'd be happy to help you write a Python function!",
        'What specific functionality are you looking for?',
        '',
        '\x1b[1mHuman:\x1b[0m A function to validate email addresses',
        '',
        "\x1b[1;34mClaude:\x1b[0m Here's a Python function to validate email addresses:",
        '',
        '\x1b[36m```python\x1b[0m',
        'import re',
        '',
        'def is_valid_email(email):',
        "    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'",
        '    return re.match(pattern, email) is not None',
        '\x1b[36m```\x1b[0m',
        '',
        'This function uses a regular expression to validate email format.',
        'Would you like me to add additional validation features?',
      ];

      realClaudeSession.forEach((line) => {
        detectionService.detectFromOutput('term1', line);
      });

      // Should be detected as connected despite ANSI codes
      const state = detectionService.getAgentState('term1');
      expect(state.status).to.equal('connected');
      expect(state.agentType).to.equal('claude');

      // Should remain stable throughout interaction
      expect(allStatusChangeEvents.length).to.equal(1); // Only the initial connected event
    });

    it('should handle real Gemini session with complex model switching', () => {
      const realGeminiSession = [
        // Startup sequence
        '$ gemini code',
        'Initializing Gemini CLI...',
        '\x1b[32m✓\x1b[0m Connected to Google AI services',
        '\x1b[33m⚡\x1b[0m Loading gemini-1.5-pro-latest...',
        '\x1b[32m✓\x1b[0m Model loaded successfully',
        '',
        '\x1b[1;36m🤖 Gemini Interactive Code Assistant\x1b[0m',
        '\x1b[90mType /help for commands, /exit to quit\x1b[0m',
        '',
        'gemini> Ready for your coding questions!',
        '',
        // User interaction
        'Human: Create a React component for a todo list',
        '',
        "Gemini: I'll create a React todo list component for you:",
        '',
        '```jsx',
        "import React, { useState } from 'react';",
        '',
        'const TodoList = () => {',
        '  const [todos, setTodos] = useState([]);',
        "  const [inputValue, setInputValue] = useState('');",
        '',
        '  const addTodo = () => {',
        '    if (inputValue.trim()) {',
        '      setTodos([...todos, {',
        '        id: Date.now(),',
        '        text: inputValue,',
        '        completed: false',
        '      }]);',
        "      setInputValue('');",
        '    }',
        '  };',
        '',
        '  return (',
        '    <div className="todo-list">',
        '      <input',
        '        value={inputValue}',
        '        onChange={(e) => setInputValue(e.target.value)}',
        '        placeholder="Add a todo..."',
        '      />',
        '      <button onClick={addTodo}>Add</button>',
        '      <ul>',
        '        {todos.map(todo => (',
        '          <li key={todo.id}>{todo.text}</li>',
        '        ))}',
        '      </ul>',
        '    </div>',
        '  );',
        '};',
        '',
        'export default TodoList;',
        '```',
        '',
        'This component provides basic todo functionality with add capability.',
        'gemini> Ready for your next question!',
      ];

      realGeminiSession.forEach((line) => {
        if (line.startsWith('$ gemini')) {
          detectionService.detectFromInput('term1', 'gemini code\r');
        } else {
          detectionService.detectFromOutput('term1', line);
        }
      });

      // Should be detected and remain connected
      const state = detectionService.getAgentState('term1');
      expect(state.status).to.equal('connected');
      expect(state.agentType).to.equal('gemini');

      // Should be stable throughout the session
      expect(allStatusChangeEvents.length).to.be.greaterThanOrEqual(1);
      if (allStatusChangeEvents.length > 0) {
        expect(allStatusChangeEvents[0]?.status).to.equal('connected');
      }
    });

    it('should handle session termination with real shell return', () => {
      // Start agent
      detectionService.detectFromOutput('term1', 'Welcome to Claude Code!');
      expect(detectionService.getAgentState('term1').status).to.equal('connected');

      // Real termination sequence
      const terminationSequence = [
        // User exits
        'Human: /exit',
        '',
        'Claude: Goodbye! Thanks for using Claude Code.',
        'Session ended.',
        '',
        // Real shell prompt returns with ANSI
        '\x1b[32muser@macbook-pro\x1b[0m:\x1b[34m~/development/project\x1b[0m$ ',
      ];

      terminationSequence.forEach((line) => {
        detectionService.detectFromOutput('term1', line);
      });

      // Manual termination detection (normally handled by TerminalManager)
      const lastLine = terminationSequence[terminationSequence.length - 1];
      const terminationResult = detectionService.detectTermination('term1', lastLine || '');

      expect(terminationResult.isTerminated).to.be.true;
      expect(terminationResult.reason).to.equal('shell_prompt');

      // Clean up
      detectionService.handleTerminalRemoved('term1');
      expect(detectionService.getAgentState('term1').status).to.equal('none');
    });
  });

  // =================== PERFORMANCE AND STRESS TESTS ===================

  describe('⚡ Performance and Stress Tests', () => {
    it('should handle high-frequency output without performance degradation', () => {
      // Start agent
      detectionService.detectFromOutput('term1', 'Welcome to Claude Code!');

      const startTime = Date.now();

      // Simulate high-frequency output (like during code generation)
      for (let i = 0; i < 1000; i++) {
        detectionService.detectFromOutput('term1', `Line ${i}: This is sample output from Claude.`);
      }

      const endTime = Date.now();

      // Should complete quickly and maintain state
      expect(endTime - startTime).to.be.lessThan(1000); // Less than 1 second
      expect(detectionService.getAgentState('term1').status).to.equal('connected');

      // Should not generate excessive events (debouncing should work)
      expect(allStatusChangeEvents.length).to.be.lessThan(10);
    });

    it('should handle many concurrent agents without memory issues', () => {
      const agentCount = 50;
      const startTime = Date.now();

      // Create many agents rapidly
      for (let i = 0; i < agentCount; i++) {
        const termId = `term${i}`;
        const agentType = i % 2 === 0 ? 'claude' : 'gemini';
        const startupMsg =
          agentType === 'claude' ? 'Welcome to Claude Code!' : 'Gemini CLI starting up...';

        detectionService.detectFromOutput(termId, startupMsg);
      }

      const endTime = Date.now();

      // Should handle many agents efficiently
      expect(endTime - startTime).to.be.lessThan(2000); // Less than 2 seconds

      // Only one should be connected, others disconnected
      const connectedAgent = detectionService.getConnectedAgent();
      expect(connectedAgent).to.not.be.null;
      expect(connectedAgent).to.not.be.undefined;
      expect(detectionService.getDisconnectedAgents().size).to.equal(agentCount - 1);

      // Clean up
      for (let i = 0; i < agentCount; i++) {
        detectionService.handleTerminalRemoved(`term${i}`);
      }

      // Should clean up properly
      expect(detectionService.getConnectedAgent()).to.be.null;
      expect(detectionService.getDisconnectedAgents().size).to.equal(0);
    });

    it('should maintain accuracy under stress conditions', () => {
      // Stress test: rapid operations with mixed legitimate and noise data
      const stressOperations = [
        () => detectionService.detectFromOutput('term1', 'Welcome to Claude Code!'),
        () => detectionService.detectFromOutput('term1', 'random noise output'),
        () => detectionService.detectFromOutput('term2', 'Gemini CLI starting up...'),
        () => detectionService.detectFromOutput('term2', 'more random output'),
        () => detectionService.switchAgentConnection('term1'),
        () => detectionService.detectFromOutput('term3', 'another random line'),
        () => detectionService.detectFromOutput('term3', 'Claude assistant ready'),
        () => detectionService.detectTermination('term1', 'user@host:~$ '),
        () => detectionService.detectFromOutput('term4', 'noise'),
        () => detectionService.detectFromOutput('term4', 'gemini-pro initialized'),
      ];

      // Execute rapidly multiple times
      for (let round = 0; round < 10; round++) {
        stressOperations.forEach((op) => op());
      }

      // Should maintain consistent state
      const connectedAgent = detectionService.getConnectedAgent();
      expect(connectedAgent).to.not.be.null;
      expect(connectedAgent).to.not.be.undefined;

      if (connectedAgent) {
        const connectedState = detectionService.getAgentState(connectedAgent.terminalId);
        expect(connectedState.status).to.equal('connected');
        expect(['claude', 'gemini']).to.include(connectedState.type!);
      }

      // Disconnected agents should be consistent
      const disconnectedAgents = detectionService.getDisconnectedAgents();
      for (const [termId, agentInfo] of disconnectedAgents) {
        const state = detectionService.getAgentState(termId);
        expect(state.status).to.equal('disconnected');
        expect(state.agentType).to.equal(agentInfo.agentType);
      }
    });
  });
});
