/**
 * CLI Agent Pattern Detector Unit Tests
 *
 * 🎯 PURPOSE: Test pattern detection accuracy and prevent false positives/negatives
 * 🚨 CRITICAL: These tests ensure detection patterns work correctly in isolation
 *
 * Focus Areas:
 * 1. Claude startup pattern detection
 * 2. Gemini startup pattern detection
 * 3. Shell prompt termination detection
 * 4. ANSI escape sequence cleaning
 * 5. False positive prevention
 * 6. Edge cases in pattern matching
 */

import { describe, it, beforeEach } from 'mocha';
// import { expect } from 'chai';

import { CliAgentPatternDetector } from '../../../services/CliAgentDetectionService';
import { ICliAgentPatternDetector } from '../../../interfaces/CliAgentService';

describe('🔍 CLI Agent Pattern Detector Unit Tests', () => {
  let patternDetector: ICliAgentPatternDetector;

  beforeEach(() => {
    patternDetector = new CliAgentPatternDetector();
  });

  // =================== CLAUDE STARTUP DETECTION TESTS ===================

  describe('🤖 Claude Startup Pattern Detection', () => {
    const validClaudePatterns = [
      // Welcome messages
      'Welcome to Claude Code!',
      '> Try "edit <filepath>" to edit files',
      "I'm Claude, an AI assistant created by Anthropic.",
      'I am Claude',
      'Powered by Claude',
      'CLI tool for Claude',

      // Startup indicators
      'claude starting up',
      'claude initializing',
      'claude ready to assist',
      'claude code starting',
      'claude code launched',
      'claude code welcome',

      // Model patterns
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307',
      'claude 3 sonnet',
      'claude 3',
      'claude-3',

      // Status patterns
      'claude activated',
      'claude connected',
      'claude ready',
      'claude started',
      'claude available',
      'claude launched',
      'claude initialized',

      // Company patterns
      'anthropic claude',
      'anthropic assistant',

      // Startup context patterns
      'claude sonnet ready',
      'claude opus initialized',
      'claude haiku starting',
    ];

    const invalidClaudePatterns = [
      // Permission messages (should be excluded)
      'Claude may read and analyze files',
      'claude may read files in your project',

      // Documentation references (should be excluded)
      'Documentation is available at https://claude.ai',
      'documentation is available at claude.anthropic.com',

      // Configuration paths (should be excluded)
      'Configuration files are located in ~/.claude',
      'configuration files are located at /home/user/.claude',

      // Code comments and examples
      '// Using Claude AI for this function',
      '/* Claude-generated code */',
      'const claudeResponse = await fetch();',
      'This code was written with Claude assistance',

      // Error messages
      'Error: Claude connection failed',
      'Claude API key not found',
      'Failed to initialize Claude',

      // Installation/update messages
      'Installing claude-cli package...',
      'Updating claude to latest version',
      'claude-cli@1.2.3 installed successfully',

      // Generic mentions
      'claude is mentioned in the documentation',
      'see claude.md for more details',
      'claude.txt contains the config',

      // Non-startup contexts
      'claude generated this response',
      'ask claude about this feature',
      'claude suggests the following',
    ];

    validClaudePatterns.forEach((pattern, index) => {
      it(`should detect valid Claude pattern #${index + 1}: "${pattern}"`, () => {
        const result = patternDetector.detectClaudeStartup(pattern);
        expect(result).to.be.true;
      });
    });

    invalidClaudePatterns.forEach((pattern, index) => {
      it(`should NOT detect invalid Claude pattern #${index + 1}: "${pattern}"`, () => {
        const result = patternDetector.detectClaudeStartup(pattern);
        expect(result).to.be.false;
      });
    });

    it('should handle case insensitive detection', () => {
      const patterns = ['WELCOME TO CLAUDE CODE!', 'Claude Ready', 'CLAUDE STARTED', 'i am claude'];

      patterns.forEach((pattern) => {
        expect(patternDetector.detectClaudeStartup(pattern)).to.be.true;
      });
    });

    it('should handle patterns with extra whitespace', () => {
      const patterns = [
        '  Welcome to Claude Code!  ',
        '\t\tClaude ready\t\t',
        '\n\nI am Claude\n\n',
      ];

      patterns.forEach((pattern) => {
        expect(patternDetector.detectClaudeStartup(pattern)).to.be.true;
      });
    });
  });

  // =================== GEMINI STARTUP DETECTION TESTS ===================

  describe('💎 Gemini Startup Pattern Detection', () => {
    const validGeminiPatterns = [
      // Welcome and startup messages
      'Welcome to Gemini CLI!',
      'Gemini CLI starting up...',
      'gemini cli starting',
      'gemini cli launched',
      'gemini cli ready',

      // Model patterns
      'gemini-2.5-pro',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-pro',
      'gemini flash',
      'gemini-exp-1206',
      'gemini experimental',
      'gemini-thinking',

      // File patterns
      'gemini.md',
      'tips for getting started',

      // Company/service patterns
      'Google AI',
      'google generative ai',
      'gemini api',
      'ai studio',
      'vertex ai',
      'Google AI Gemini initialized',

      // Prompt patterns
      'gemini>',
      'gemini $',
      'gemini #',
      'gemini:',

      // Banner patterns
      '███ gemini ███',
      '**** Gemini CLI ****',
      '==== Gemini Ready ====',

      // Command patterns
      'gemini --help',
      'gemini chat',
      'gemini code',
      'gemini repl',
      'gemini interactive',
      'gemini code interactive mode',

      // Status patterns
      'gemini activated',
      'gemini connected ready',
      'gemini started',
      'gemini initialized',
      'gemini launching',
      'gemini loading',

      // Authentication patterns
      'gemini authenticated',
      'gemini login successful',

      // Direct execution patterns
      'gemini ',
      'gemini>',
      '> gemini',
      '$ gemini',

      // Context patterns
      'using gemini',
      'model: gemini-pro',
      'connecting to gemini',
      'gemini model loaded',
      'gemini session started',
    ];

    const invalidGeminiPatterns = [
      // Update notifications (should be excluded)
      'Update available: gemini-cli v2.1.0',
      'update available: gemini version 1.2.3',

      // Version availability (should be excluded)
      'New version is available!',
      'version 2.0 available!',

      // Model availability announcements (should be excluded)
      'New Gemini model is available for testing',
      'new model is available: gemini-2.0',

      // Installation messages
      'Installing gemini dependencies...',
      'npm install gemini-cli',
      'downloading gemini package',

      // Error messages
      'Error: Gemini API key not found',
      'Failed to connect to Gemini',
      'Gemini authentication failed',

      // Code comments
      '// This uses Gemini for processing',
      '/* Gemini integration */',
      'const geminiClient = new GeminiAPI();',

      // Documentation references
      'See gemini.md for configuration',
      'gemini documentation available online',

      // Generic mentions
      'gemini is a powerful model',
      'ask gemini about this topic',
      'gemini can help with coding',
    ];

    validGeminiPatterns.forEach((pattern, index) => {
      it(`should detect valid Gemini pattern #${index + 1}: "${pattern}"`, () => {
        const result = patternDetector.detectGeminiStartup(pattern);
        expect(result).to.be.true;
      });
    });

    invalidGeminiPatterns.forEach((pattern, index) => {
      it(`should NOT detect invalid Gemini pattern #${index + 1}: "${pattern}"`, () => {
        const result = patternDetector.detectGeminiStartup(pattern);
        expect(result).to.be.false;
      });
    });

    it('should handle case insensitive detection', () => {
      const patterns = [
        'GEMINI CLI STARTING',
        'Gemini Ready',
        'GEMINI-PRO MODEL',
        'google ai gemini',
      ];

      patterns.forEach((pattern) => {
        expect(patternDetector.detectGeminiStartup(pattern)).to.be.true;
      });
    });

    it('should handle Gemini with startup context requirements', () => {
      // These should be detected only with proper context
      const contextualPatterns = [
        { text: 'gemini cli starting up', expected: true },
        { text: 'gemini ready for commands', expected: true },
        { text: 'google gemini initialized', expected: true },
        { text: 'gemini activated successfully', expected: true },
        { text: 'gemini connected ready', expected: true },

        // These should NOT be detected without proper startup context
        { text: 'gemini said hello', expected: false },
        { text: 'using gemini for this task', expected: false },
        { text: 'gemini response received', expected: false },
      ];

      contextualPatterns.forEach(({ text, expected }) => {
        const result = patternDetector.detectGeminiStartup(text);
        expect(result).to.equal(
          expected,
          `Pattern "${text}" should ${expected ? '' : 'NOT '}be detected`
        );
      });
    });
  });

  // =================== SHELL PROMPT DETECTION TESTS ===================

  describe('🐚 Shell Prompt Detection Tests', () => {
    const validShellPrompts = [
      // Standard bash/zsh prompts with username@hostname
      'user@hostname:~/project$',
      'john@macbook-pro:~/code$',
      'dev@ubuntu:~/workspace%',
      'admin@server:/opt/app#',

      // Oh My Zsh themes with symbols
      '➜ myproject',
      '➜ myproject git:(main) ✗',
      '▶ workspace',
      '⚡ current-dir',

      // Starship prompt variations
      '❯',
      '❯ ready for input',

      // Simple shell prompts
      '$',
      '%',
      '#',
      '>',
      '$ ',
      '% ',
      '# ',
      '> ',

      // PowerShell patterns
      'PS C:\\Users\\Developer>',
      'PS /home/user>',

      // Fish shell patterns
      'user ~/project>',
      'developer /opt/workspace>',

      // Box drawing character prompts
      '╭─user@hostname',
      '┌─dev@server',

      // Python/conda environment prompts
      '(venv) user@server:~/app$',
      '(myenv) developer@local:~/code%',
      '(base) admin@system:/root#',

      // More flexible patterns
      'workspace: ~/project$',
      'myuser ~/documents%',
      'root@docker-container:/#',

      // Terminal session indicators
      'Last login: Tue Jan 2 10:30:45 on ttys000',
      'Session ended.',
      'logout completed',

      // Generic prompt patterns
      'prompt$',
      'shell%',
      'terminal#',
      'cmd>',
      'bash>',
    ];

    const invalidShellPrompts = [
      // Code examples containing shell-like characters
      'function process() { return data$ }',
      'let result = query("SELECT * FROM table$");',
      'echo "This line ends with $"',
      'const price = "$19.99"',

      // Mathematical expressions
      '2 + 2 = 4$',
      'x = y + z$',

      // Comments and documentation
      '// This function costs $100',
      '/* Price: $50 */',
      'Documentation says: use # for comments',

      // URLs and references
      'https://example.com/path$',
      'mailto:user@domain.com',
      'Visit site.com/page#section',

      // Code output that's not shell prompts
      'Debug: Processing item#1',
      'Status: Complete [100%]',
      'Result: Success!',

      // Log messages
      '[INFO] Process started',
      '[ERROR] Connection failed',
      'LOG: Operation completed',

      // JSON/XML that might contain symbols
      '{"status": "ok", "code": 200}',
      '<element attribute="value">',

      // Regular text with incidental symbols
      'The temperature is 25°C',
      'Meeting at 3:30 PM',
      'Version 1.2.3-beta',
    ];

    validShellPrompts.forEach((prompt, index) => {
      it(`should detect valid shell prompt #${index + 1}: "${prompt}"`, () => {
        const result = patternDetector.detectShellPrompt(prompt);
        expect(result).to.be.true;
      });
    });

    invalidShellPrompts.forEach((line, index) => {
      it(`should NOT detect invalid shell prompt #${index + 1}: "${line}"`, () => {
        const result = patternDetector.detectShellPrompt(line);
        expect(result).to.be.false;
      });
    });

    it('should handle shell prompts with ANSI escape sequences', () => {
      const ansiPrompts = [
        '\x1b[32muser@hostname:~/project$\x1b[0m',
        '\x1b[1;34m➜\x1b[0m myproject',
        '\x1b[31m$\x1b[0m ',
      ];

      ansiPrompts.forEach((prompt) => {
        // Should work after cleaning ANSI sequences
        const cleaned = patternDetector.cleanAnsiEscapeSequences(prompt);
        const result = patternDetector.detectShellPrompt(cleaned);
        expect(result).to.be.true;
      });
    });

    it('should handle edge cases in shell prompt detection', () => {
      const edgeCases = [
        { prompt: '', expected: false }, // Empty string
        { prompt: '   ', expected: false }, // Whitespace only
        { prompt: '\n\r\n', expected: false }, // Newlines only
        { prompt: '$$$$', expected: false }, // Multiple symbols without context
        { prompt: 'user@', expected: false }, // Incomplete prompt
        { prompt: '@hostname:$', expected: false }, // Missing username
      ];

      edgeCases.forEach(({ prompt, expected }) => {
        const result = patternDetector.detectShellPrompt(prompt);
        expect(result).to.equal(expected);
      });
    });
  });

  // =================== ANSI ESCAPE SEQUENCE CLEANING TESTS ===================

  describe('🎨 ANSI Escape Sequence Cleaning Tests', () => {
    const ansiTestCases = [
      {
        input: '\x1b[32mGreen text\x1b[0m',
        expected: 'Green text',
        description: 'basic color codes',
      },
      {
        input: '\x1b[1;31mBold red\x1b[0m',
        expected: 'Bold red',
        description: 'bold color codes',
      },
      {
        input: '\x1b[2J\x1b[HClear screen',
        expected: 'Clear screen',
        description: 'clear screen sequences',
      },
      {
        input: '\x1b]0;Window Title\x07Content',
        expected: 'Content',
        description: 'OSC sequences (window title)',
      },
      {
        input: 'Line 1\rLine 2',
        expected: 'Line 1Line 2',
        description: 'carriage return removal',
      },
      {
        input: '\x1b?25hShow cursor\x1b?25lHide cursor',
        expected: 'Show cursorHide cursor',
        description: 'private mode sequences',
      },
      {
        input: '\x1b=Keypad app\x1b>Keypad normal',
        expected: 'Keypad appKeypad normal',
        description: 'keypad mode sequences',
      },
      {
        input: 'Text\x00\x01\x02\x1f\x7fwith control chars',
        expected: 'Textwith control chars',
        description: 'control character removal',
      },
      {
        input: '\x1b[38;5;208mOrange text\x1b[0m',
        expected: 'Orange text',
        description: '256-color mode',
      },
      {
        input: '\x1b[38;2;255;128;0mTruecolor\x1b[0m',
        expected: 'Truecolor',
        description: '24-bit color mode',
      },
    ];

    ansiTestCases.forEach(({ input, expected, description }, index) => {
      it(`should clean ANSI sequences #${index + 1}: ${description}`, () => {
        const result = patternDetector.cleanAnsiEscapeSequences(input);
        expect(result).to.equal(expected);
      });
    });

    it('should handle complex real-world terminal output', () => {
      const complexOutput =
        '\x1b[32m➜\x1b[0m  \x1b[1;34mproject\x1b[0m \x1b[1;31mgit:(\x1b[31mmain\x1b[1;31m)\x1b[0m \x1b[33m✗\x1b[0m ';
      const result = patternDetector.cleanAnsiEscapeSequences(complexOutput);

      // Should remove all ANSI codes and leave readable text
      expect(result).to.not.include('\x1b');
      expect(result).to.include('project');
      expect(result).to.include('git');
    });

    it('should preserve regular text without ANSI codes', () => {
      const plainText = 'Welcome to Claude Code!';
      const result = patternDetector.cleanAnsiEscapeSequences(plainText);
      expect(result).to.equal(plainText);
    });

    it('should handle empty and whitespace input', () => {
      expect(patternDetector.cleanAnsiEscapeSequences('')).to.equal('');
      expect(patternDetector.cleanAnsiEscapeSequences('   ')).to.equal('');
      expect(patternDetector.cleanAnsiEscapeSequences('\t\n\r')).to.equal('');
    });
  });

  // =================== PATTERN INTERACTION TESTS ===================

  describe('🔄 Pattern Interaction Tests', () => {
    it('should correctly identify startup patterns after ANSI cleaning', () => {
      const ansiStartupMessages = [
        {
          input: '\x1b[32mWelcome to Claude Code!\x1b[0m',
          detector: 'claude',
        },
        {
          input: '\x1b[1;34mGemini CLI starting up...\x1b[0m',
          detector: 'gemini',
        },
        {
          input: '\x1b[38;5;208m➜\x1b[0m  gemini-pro ready',
          detector: 'gemini',
        },
      ];

      ansiStartupMessages.forEach(({ input, detector }) => {
        const cleaned = patternDetector.cleanAnsiEscapeSequences(input);

        if (detector === 'claude') {
          expect(patternDetector.detectClaudeStartup(cleaned)).to.be.true;
          expect(patternDetector.detectGeminiStartup(cleaned)).to.be.false;
        } else {
          expect(patternDetector.detectGeminiStartup(cleaned)).to.be.true;
          expect(patternDetector.detectClaudeStartup(cleaned)).to.be.false;
        }
      });
    });

    it('should not confuse agent patterns with shell prompts', () => {
      const agentOutputs = [
        'Welcome to Claude Code!',
        'Gemini CLI ready',
        'I am Claude, ready to help',
        'gemini-pro model loaded',
      ];

      agentOutputs.forEach((output) => {
        // Should be detected as agent startup, not shell prompt
        const isShellPrompt = patternDetector.detectShellPrompt(output);
        expect(isShellPrompt).to.be.false;

        // Should be detected as agent startup
        const isClaudeStartup = patternDetector.detectClaudeStartup(output);
        const isGeminiStartup = patternDetector.detectGeminiStartup(output);
        expect(isClaudeStartup || isGeminiStartup).to.be.true;
      });
    });

    it('should not confuse shell prompts with agent patterns', () => {
      const shellPrompts = [
        'user@hostname:~/project$',
        '➜ myproject',
        '$',
        'PS C:\\Users\\Developer>',
      ];

      shellPrompts.forEach((prompt) => {
        // Should be detected as shell prompt
        expect(patternDetector.detectShellPrompt(prompt)).to.be.true;

        // Should NOT be detected as agent startup
        expect(patternDetector.detectClaudeStartup(prompt)).to.be.false;
        expect(patternDetector.detectGeminiStartup(prompt)).to.be.false;
      });
    });
  });

  // =================== PERFORMANCE TESTS ===================

  describe('⚡ Performance Tests', () => {
    it('should handle large input efficiently', () => {
      const largeInput = 'Welcome to Claude Code! ' + 'x'.repeat(10000);

      // Should not throw and should complete reasonably quickly
      const startTime = Date.now();
      const result = patternDetector.detectClaudeStartup(largeInput);
      const endTime = Date.now();

      expect(result).to.be.true;
      expect(endTime - startTime).to.be.lessThan(100); // Should complete in < 100ms
    });

    it('should handle many ANSI escape sequences efficiently', () => {
      // Create input with many ANSI sequences
      let inputWithManyAnsi = '';
      for (let i = 0; i < 1000; i++) {
        inputWithManyAnsi += `\x1b[${i % 256}mChar${i}\x1b[0m`;
      }

      const startTime = Date.now();
      const cleaned = patternDetector.cleanAnsiEscapeSequences(inputWithManyAnsi);
      const endTime = Date.now();

      expect(cleaned).to.not.include('\x1b');
      expect(endTime - startTime).to.be.lessThan(200); // Should complete in < 200ms
    });

    it('should handle regex patterns efficiently with edge cases', () => {
      const edgeCaseInputs = [
        '$'.repeat(1000), // Many dollar signs
        '#'.repeat(1000), // Many hash symbols
        'claude '.repeat(500), // Many "claude" repetitions
        'gemini '.repeat(500), // Many "gemini" repetitions
      ];

      edgeCaseInputs.forEach((input) => {
        const startTime = Date.now();

        // Test all detectors
        patternDetector.detectClaudeStartup(input);
        patternDetector.detectGeminiStartup(input);
        patternDetector.detectShellPrompt(input);

        const endTime = Date.now();
        expect(endTime - startTime).to.be.lessThan(50); // Should be fast
      });
    });
  });

  // =================== REGRESSION TESTS ===================

  describe('🛡️ Regression Tests (Previously Fixed Issues)', () => {
    it('should exclude Claude permission messages (fixed in v0.1.55)', () => {
      const permissionMessages = [
        'Claude may read and analyze files in your project',
        'claude may read files to understand context',
        'Claude may read your project files',
      ];

      permissionMessages.forEach((message) => {
        expect(patternDetector.detectClaudeStartup(message)).to.be.false;
      });
    });

    it('should exclude Gemini update notifications (fixed in v0.1.55)', () => {
      const updateMessages = [
        'Update available: gemini-cli v2.1.0',
        'New version is available! gemini 2.0',
        'New Gemini model is available for testing',
      ];

      updateMessages.forEach((message) => {
        expect(patternDetector.detectGeminiStartup(message)).to.be.false;
      });
    });

    it('should handle broad shell prompt patterns carefully', () => {
      // These were causing false positives in earlier versions
      const ambiguousLines = [
        'Here is some code with $ in it',
        'Price: $19.99 for the item',
        'Command output: Success!',
        'git status # shows working tree',
      ];

      ambiguousLines.forEach((line) => {
        const isShellPrompt = patternDetector.detectShellPrompt(line);
        // These specific lines should NOT be detected as shell prompts
        expect(isShellPrompt).to.be.false;
      });
    });
  });
});
