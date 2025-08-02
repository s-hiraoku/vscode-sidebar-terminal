import { expect } from 'chai';
import * as sinon from 'sinon';
import { TerminalManager } from '../../../terminals/TerminalManager';
import { TERMINAL_CONSTANTS } from '../../../constants';

describe('CLI Agent Termination Detection', () => {
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

  describe('Shell Prompt Pattern Detection', () => {
    const validPromptPatterns = [
      // Standard bash/zsh prompts
      'user@hostname:~/path$',
      'user@hostname:~/path$  ',
      'user@hostname:~/workspace/project$',
      'root@server:/home#',

      // Oh-My-Zsh themes
      '➜ myproject',
      '➜  workspace',

      // Starship prompt
      '❯',
      '❯ ',
      '❯   ',

      // PowerShell
      'PS C:\\Users\\User>',
      'PS /home/user>',

      // Fish shell
      'user workspace>',
      'user ~/Documents/projects>',

      // Simple prompts
      '$',
      '$ ',
      '#',
      '# ',
      '>',
      '> ',

      // More comprehensive patterns
      'user@macbook:~/dev$',
      'user@macbook ~/workspace$',
      'macbook: ~/projects$',
      'john ~/coding%',

      // Zsh/Oh-My-Zsh variants
      '▶ myproject',
      '⚡ workspace',
      '╭─user@hostname',
      '┌─user@hostname',

      // Python/conda environments
      '(venv) user@hostname:~/project$',
      '(myenv) user@hostname:~/dev#',

      // Generic patterns
      'anything$',
      'user%',
      'system#',
      'prompt>',
    ];

    const invalidPromptPatterns = [
      // Claude Code output
      'Claude Code may read files in this folder. Reading',
      'Welcome to Claude Code!',
      '> Try "edit <filepath>',
      'I am Claude',

      // Gemini CLI output
      'Gemini CLI update available! 0.1.14 → 0.1.15',
      'Gemini connected and ready',
      'Using Gemini model',

      // Regular command output
      'Processing file...',
      'Error: Command not found',
      'Installing dependencies',
      'File saved successfully',
      'npm install completed',

      // Empty or minimal strings
      '',
      ' ',
      'a',
      'ab',
    ];

    it('should detect valid shell prompt patterns', () => {
      const terminalId = terminalManager.createTerminal();

      // Start CLI Agent first
      (terminalManager as any)._setCurrentAgent(terminalId, 'claude');

      validPromptPatterns.forEach((prompt) => {
        // Reset state for each test
        (terminalManager as any)._connectedAgentTerminalId = terminalId;
        (terminalManager as any)._connectedAgentType = 'claude';

        // Test termination detection
        const result = (terminalManager as any)._detectCliAgentTermination(terminalId, prompt);

        expect(result).to.be.true;

        // Verify agent was terminated
        expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      });
    });

    it('should NOT detect invalid shell prompt patterns', () => {
      const terminalId = terminalManager.createTerminal();

      invalidPromptPatterns.forEach((output) => {
        // Reset state for each test
        (terminalManager as any)._connectedAgentTerminalId = terminalId;
        (terminalManager as any)._connectedAgentType = 'claude';

        // Test termination detection
        const result = (terminalManager as any)._detectCliAgentTermination(terminalId, output);

        expect(result).to.be.false;

        // Verify agent is still connected
        expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminalId);
      });
    });
  });

  describe('User Exit Command Detection', () => {
    const validExitCommands = ['/exit', '/quit', 'exit', 'quit'];

    const invalidExitCommands = [
      'help',
      'ls',
      'cd',
      'exit123', // partial match
      'myexit', // partial match
      '/help',
      '/list',
    ];

    it('should detect valid exit commands', () => {
      const terminalId = terminalManager.createTerminal();

      validExitCommands.forEach((command) => {
        // Reset state for each test
        (terminalManager as any)._connectedAgentTerminalId = terminalId;
        (terminalManager as any)._connectedAgentType = 'claude';

        // Test termination detection
        const result = (terminalManager as any)._detectCliAgentTermination(terminalId, command);

        expect(result).to.be.true;

        // Verify agent was terminated
        expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      });
    });

    it('should NOT detect invalid exit commands', () => {
      const terminalId = terminalManager.createTerminal();

      invalidExitCommands.forEach((command) => {
        // Reset state for each test
        (terminalManager as any)._connectedAgentTerminalId = terminalId;
        (terminalManager as any)._connectedAgentType = 'claude';

        // Test termination detection
        const result = (terminalManager as any)._detectCliAgentTermination(terminalId, command);

        expect(result).to.be.false;

        // Verify agent is still connected
        expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminalId);
      });
    });
  });

  describe('Termination Detection Integration', () => {
    it('should handle shell prompt detection from terminal output', () => {
      const terminalId = terminalManager.createTerminal();

      // Start CLI Agent
      (terminalManager as any)._setCurrentAgent(terminalId, 'claude');

      // Verify agent is connected
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminalId);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');

      // Simulate terminal output with shell prompt
      const promptOutput = 'user@hostname:~/project$';
      (terminalManager as any)._detectCliAgent(terminalId, promptOutput);

      // Verify agent was terminated
      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._connectedAgentType).to.be.null;
    });

    it('should handle exit command detection from terminal output', () => {
      const terminalId = terminalManager.createTerminal();

      // Start CLI Agent
      (terminalManager as any)._setCurrentAgent(terminalId, 'gemini');

      // Verify agent is connected
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminalId);
      expect((terminalManager as any)._connectedAgentType).to.equal('gemini');

      // Simulate terminal output with exit command
      const exitOutput = 'exit';
      (terminalManager as any)._detectCliAgent(terminalId, exitOutput);

      // Verify agent was terminated
      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._connectedAgentType).to.be.null;
    });

    it('should only detect termination for currently connected terminal', () => {
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();

      // Start CLI Agent in terminal1
      (terminalManager as any)._setCurrentAgent(terminal1, 'claude');

      // Try to trigger termination from terminal2 (should not work)
      const result = (terminalManager as any)._detectCliAgentTermination(
        terminal2,
        'user@hostname:~/project$'
      );

      // Termination should not be detected since terminal2 is not connected
      expect(result).to.be.false;

      // Agent should still be connected in terminal1
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');
    });

    it('should fire status change event when agent terminates', () => {
      const terminalId = terminalManager.createTerminal();
      const statusChangeSpy = sinon.spy();

      // Listen for status changes
      terminalManager.onCliAgentStatusChange(statusChangeSpy);

      // Start CLI Agent
      (terminalManager as any)._setCurrentAgent(terminalId, 'claude');

      // Clear previous calls
      statusChangeSpy.resetHistory();

      // Trigger termination
      (terminalManager as any)._detectCliAgentTermination(terminalId, 'user@hostname:~/project$');

      // Verify status change event was fired
      expect(statusChangeSpy.calledOnce).to.be.true;
      expect(statusChangeSpy.firstCall.args[0]).to.deep.include({
        terminalId,
        status: 'none',
        type: null,
      });
    });
  });

  describe('Regression Tests for Termination Bug', () => {
    it('should terminate CLI Agent when shell prompt appears after agent session', () => {
      const terminalId = terminalManager.createTerminal();

      // Simulate starting Claude Code
      (terminalManager as any)._detectCliAgentFromInput(terminalId, 'claude-code "test command"\r');

      // Verify agent is connected
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminalId);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');

      // Simulate CLI Agent session ending with shell prompt
      const shellPromptOutput = `
        Thank you for using Claude Code!
        
        user@macbook:~/workspace$
      `;

      (terminalManager as any)._detectCliAgent(terminalId, shellPromptOutput);

      // Verify agent was terminated when shell prompt appeared
      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._connectedAgentType).to.be.null;
    });

    it('should NOT terminate CLI Agent on exit command without actual termination (SPECIFICATION COMPLIANT)', () => {
      const terminalId = terminalManager.createTerminal();

      // Simulate starting Gemini CLI
      (terminalManager as any)._detectCliAgentFromInput(terminalId, 'gemini code "hello world"\r');

      // Verify agent is connected
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminalId);
      expect((terminalManager as any)._connectedAgentType).to.equal('gemini');

      // Simulate user typing exit command
      (terminalManager as any)._detectCliAgentFromInput(terminalId, '/exit\r');

      // 🚨 SPECIFICATION REQUIREMENT: Status should NOT change on exit command alone
      // CLI Agent status must only change when agent ACTUALLY terminates, not on user input

      // Wait for any potential timeout (should not change status)
      const clock = sandbox.useFakeTimers();
      clock.tick(5000); // 5 seconds - longer than any timeout

      // Verify agent status remains CONNECTED (specification compliant)
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminalId);
      expect((terminalManager as any)._connectedAgentType).to.equal('gemini');

      // Now simulate actual CLI Agent termination via shell prompt return
      // Use a simple, clear shell prompt that will definitely match the detection pattern
      const shellPromptOutput = 'user@macbook:~/workspace$ ';

      (terminalManager as any)._detectCliAgent(terminalId, shellPromptOutput);

      // Verify agent was terminated when shell prompt appeared (actual termination)
      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._connectedAgentType).to.be.null;

      clock.restore();
    });

    it('should maintain connected state when non-prompt output is received', () => {
      const terminalId = terminalManager.createTerminal();

      // Start CLI Agent
      (terminalManager as any)._setCurrentAgent(terminalId, 'claude');

      // Simulate various non-prompt outputs
      const nonPromptOutputs = [
        'Processing your request...',
        'Here is the code you requested:',
        'Error: File not found',
        'Claude Code is thinking...',
        '```python\nprint("hello")\n```',
        'Your file has been saved.',
      ];

      nonPromptOutputs.forEach((output) => {
        (terminalManager as any)._detectCliAgent(terminalId, output);

        // Agent should still be connected
        expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminalId);
        expect((terminalManager as any)._connectedAgentType).to.equal('claude');
      });
    });
  });
});
