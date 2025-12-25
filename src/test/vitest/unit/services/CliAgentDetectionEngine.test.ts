/**
 * CLI Agent Detection Engine Unit Tests
 *
 * 🎯 PURPOSE: Test unified detection logic for CLI agents
 * 🚨 CRITICAL: Ensures accurate and fast detection (<500ms)
 *
 * Focus Areas:
 * 1. Input command detection
 * 2. Output startup detection
 * 3. Termination detection with validation
 * 4. Cache behavior and performance
 * 5. AI activity tracking
 * 6. Edge cases and error handling
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { CliAgentDetectionEngine } from '../../../../services/CliAgentDetectionEngine';

describe('🔍 CLI Agent Detection Engine Unit Tests', () => {
  let engine: CliAgentDetectionEngine;

  beforeEach(() => {
    engine = new CliAgentDetectionEngine();
  });

  // =================== INPUT DETECTION TESTS ===================

  describe('⌨️ Input Detection', () => {
    describe('Claude input detection', () => {
      it('should detect "claude" command', () => {
        const result = engine.detectFromInput('terminal-1', 'claude');

        expect(result.isDetected).toBe(true);
        expect(result.agentType).toBe('claude');
        expect(result.confidence).toBe(1.0);
        expect(result.source).toBe('input');
      });

      it('should detect "claude" with arguments', () => {
        const result = engine.detectFromInput('terminal-1', 'claude help');

        expect(result.isDetected).toBe(true);
        expect(result.agentType).toBe('claude');
      });

      it('should be case-insensitive', () => {
        const result = engine.detectFromInput('terminal-1', 'CLAUDE');

        expect(result.isDetected).toBe(true);
        expect(result.agentType).toBe('claude');
      });
    });

    describe('Gemini input detection', () => {
      it('should detect "gemini" command', () => {
        const result = engine.detectFromInput('terminal-1', 'gemini');

        expect(result.isDetected).toBe(true);
        expect(result.agentType).toBe('gemini');
        expect(result.confidence).toBe(1.0);
      });

      it('should detect "gemini" with arguments', () => {
        const result = engine.detectFromInput('terminal-1', 'gemini --help');

        expect(result.isDetected).toBe(true);
        expect(result.agentType).toBe('gemini');
      });
    });

    describe('Codex input detection', () => {
      it('should detect "codex" command', () => {
        const result = engine.detectFromInput('terminal-1', 'codex');

        expect(result.isDetected).toBe(true);
        expect(result.agentType).toBe('codex');
      });
    });

    describe('Copilot input detection', () => {
      it('should detect "copilot" command', () => {
        const result = engine.detectFromInput('terminal-1', 'copilot');

        expect(result.isDetected).toBe(true);
        expect(result.agentType).toBe('copilot');
      });

      it('should detect "gh copilot" command', () => {
        const result = engine.detectFromInput('terminal-1', 'gh copilot');

        expect(result.isDetected).toBe(true);
        expect(result.agentType).toBe('copilot');
      });
    });

    describe('Non-agent input', () => {
      it('should not detect non-agent commands', () => {
        const commands = ['ls', 'git status', 'npm install', 'echo hello'];

        commands.forEach((command) => {
          const result = engine.detectFromInput('terminal-1', command);
          expect(result.isDetected).toBe(false);
          expect(result.agentType).toBeNull();
        });
      });

      it('should handle empty input', () => {
        const result = engine.detectFromInput('terminal-1', '');

        expect(result.isDetected).toBe(false);
        expect(result.reason).toContain('Empty');
      });

      it('should handle whitespace-only input', () => {
        const result = engine.detectFromInput('terminal-1', '   ');

        expect(result.isDetected).toBe(false);
      });
    });
  });

  // =================== OUTPUT DETECTION TESTS ===================

  describe('📤 Output Detection', () => {
    describe('Claude output detection', () => {
      it('should detect Claude startup message', () => {
        const result = engine.detectFromOutput('terminal-1', 'Welcome to Claude Code!');

        expect(result.isDetected).toBe(true);
        expect(result.agentType).toBe('claude');
        expect(result.confidence).toBe(0.9);
        expect(result.source).toBe('output');
      });

      it('should detect Claude Code pattern', () => {
        const result = engine.detectFromOutput('terminal-1', 'Claude Code starting...');

        // Wait, 'Claude Code starting...' was NOT in the registry in previous check?
        // Let's check if it passes. If not, I'll update it.
        // It was in the test, but maybe not in registry?
        // Registry: "Welcome to Claude Code!"
        // Regex: /Claude\s+Code/
        // So 'Claude Code starting...' should match regex!
        
        expect(result.isDetected).toBe(true);
        expect(result.agentType).toBe('claude');
      });
    });

    describe('Gemini output detection', () => {
      it('should detect Gemini startup message', () => {
        const result = engine.detectFromOutput('terminal-1', 'Welcome to Gemini');

        expect(result.isDetected).toBe(true);
        expect(result.agentType).toBe('gemini');
      });

      it('should detect Gemini CLI patterns', () => {
        const patterns = ['Gemini CLI started', 'Google Gemini is ready', 'Using gemini-1.5-pro'];

        patterns.forEach((pattern) => {
          const result = engine.detectFromOutput('terminal-1', pattern);
          expect(result.isDetected).toBe(true);
          expect(result.agentType).toBe('gemini');
        });
      });
    });

    describe('Codex output detection', () => {
      it('should detect Codex startup message', () => {
        const result = engine.detectFromOutput('terminal-1', 'OpenAI Codex');

        expect(result.isDetected).toBe(true);
        expect(result.agentType).toBe('codex');
      });
    });

    describe('Copilot output detection', () => {
      it('should detect Copilot startup message', () => {
        const result = engine.detectFromOutput('terminal-1', 'Welcome to GitHub Copilot CLI');

        expect(result.isDetected).toBe(true);
        expect(result.agentType).toBe('copilot');
      });
    });

    describe('Multi-line output', () => {
      it('should detect agent in multi-line output', () => {
        const output = `
          Some initial output
          Welcome to Claude Code!
          Ready to assist
        `;

        const result = engine.detectFromOutput('terminal-1', output);

        expect(result.isDetected).toBe(true);
        expect(result.agentType).toBe('claude');
      });
    });

    describe('Non-agent output', () => {
      it('should not detect non-agent output', () => {
        const outputs = ['user@host:~$', 'npm install complete', 'Hello world', 'ls -la output'];

        outputs.forEach((output) => {
          const result = engine.detectFromOutput('terminal-1', output);
          expect(result.isDetected).toBe(false);
          expect(result.agentType).toBeNull();
        });
      });
    });
  });

  // =================== TERMINATION DETECTION TESTS ===================

  describe('🛑 Termination Detection', () => {
    describe('Explicit termination patterns', () => {
      it('should detect "session ended"', () => {
        const result = engine.detectTermination('terminal-1', 'session ended');

        expect(result.isTerminated).toBe(true);
        expect(result.confidence).toBe(1.0);
        expect(result.reason).toContain('Explicit');
      });

      it('should detect agent-specific termination', () => {
        const patterns = ['goodbye claude', 'exiting gemini', 'claude session ended'];

        patterns.forEach((pattern) => {
          const result = engine.detectTermination('terminal-1', pattern);
          expect(result.isTerminated).toBe(true);
        });
      });

      it('should detect simple exit commands', () => {
        const commands = ['exit', 'quit', 'goodbye', 'bye'];

        commands.forEach((command) => {
          const result = engine.detectTermination('terminal-1', command);
          expect(result.isTerminated).toBe(true);
        });
      });
    });

    describe('Shell prompt detection', () => {
      it('should detect standard bash prompts', () => {
        const prompts = ['user@host:~$', 'user@host:/path$', '$', '%'];

        prompts.forEach((prompt) => {
          const result = engine.detectTermination('terminal-1', prompt);
          expect(result.isTerminated).toBe(true);
        });
      });

      it('should detect PowerShell prompts', () => {
        const result = engine.detectTermination('terminal-1', 'PS C:\\Users\\test>');

        expect(result.isTerminated).toBe(true);
      });

      it('should detect Oh My Zsh prompts', () => {
        const result = engine.detectTermination('terminal-1', '➜  ~');

        expect(result.isTerminated).toBe(true);
      });
    });

    describe('Process completion', () => {
      it('should detect process completion indicators', () => {
        const indicators = ['[done]', 'finished', 'completed'];

        indicators.forEach((indicator) => {
          const result = engine.detectTermination('terminal-1', indicator);
          expect(result.isTerminated).toBe(true);
        });
      });
    });

    describe('Multi-line termination', () => {
      it('should detect termination in multi-line output', () => {
        const output = `
          Some output
          Processing...
          user@host:~$
        `;

        const result = engine.detectTermination('terminal-1', output);

        expect(result.isTerminated).toBe(true);
      });

      it('should return highest confidence termination', () => {
        const output = `
          maybe done?
          session ended
        `;

        const result = engine.detectTermination('terminal-1', output);

        expect(result.isTerminated).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.8);
      });
    });

    describe('Non-termination output', () => {
      it('should not detect normal output as termination', () => {
        const outputs = ['Hello world', 'Processing request...', 'Thinking...'];

        outputs.forEach((output) => {
          const result = engine.detectTermination('terminal-1', output);
          expect(result.isTerminated).toBe(false);
        });
      });
    });
  });

  // =================== CACHE BEHAVIOR TESTS ===================

  describe('💾 Cache Behavior', () => {
    it('should cache input detection results', () => {
      const input = 'claude help';

      // First call - fresh detection
      const result1 = engine.detectFromInput('terminal-1', input);
      expect(result1.isDetected).toBe(true);

      // Second call - should use cache (same result)
      const result2 = engine.detectFromInput('terminal-1', input);
      expect(result2.isDetected).toBe(true);
      expect(result2.agentType).toBe(result1.agentType);
    });

    it('should differentiate cache by terminal ID', () => {
      const input = 'claude';

      const result1 = engine.detectFromInput('terminal-1', input);
      const result2 = engine.detectFromInput('terminal-2', input);

      expect(result1.isDetected).toBe(true);
      expect(result2.isDetected).toBe(true);
    });

    it('should clear terminal-specific cache', () => {
      engine.detectFromInput('terminal-1', 'claude');

      expect(() => engine.clearTerminalCache('terminal-1')).not.toThrow();
    });
  });

  // =================== PERFORMANCE TESTS ===================

  describe('⚡ Performance', () => {
    it('should detect from input in <1ms', () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        engine.detectFromInput('terminal-1', 'claude');
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // 100 iterations in <100ms = <1ms per iteration
    });

    it('should detect from output in <10ms', () => {
      const start = Date.now();

      for (let i = 0; i < 10; i++) {
        engine.detectFromOutput('terminal-1', 'Welcome to Claude Code!');
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // 10 iterations in <100ms = <10ms per iteration
    });

    it('should handle large multi-line output efficiently', () => {
      const largeOutput = Array(100).fill('Some line of output').join('\n');

      const start = Date.now();
      engine.detectFromOutput('terminal-1', largeOutput);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100); // <100ms for 100 lines
    });
  });

  // =================== ERROR HANDLING TESTS ===================

  describe('🔒 Error Handling', () => {
    it('should handle null terminal ID gracefully', () => {
      expect(() => engine.detectFromInput('', 'claude')).not.toThrow();
    });

    it('should handle special characters in input', () => {
      const specialInput = '!@#$%^&*()[]{}|\\;:",.<>?/~`';

      expect(() => engine.detectFromInput('terminal-1', specialInput)).not.toThrow();
    });

    it('should handle very long input', () => {
      const longInput = 'claude ' + 'a'.repeat(10000);

      expect(() => engine.detectFromInput('terminal-1', longInput)).not.toThrow();
    });

    it('should handle ANSI escape sequences in output', () => {
      const ansiOutput = '\x1b[31mWelcome to Claude Code!\x1b[0m';
      const result = engine.detectFromOutput('terminal-1', ansiOutput);

      expect(result.isDetected).toBe(true);
      expect(result.agentType).toBe('claude');
    });

    it('should handle malformed UTF-8', () => {
      const malformedInput = 'claude \uFFFD\uFFFD';

      expect(() => engine.detectFromInput('terminal-1', malformedInput)).not.toThrow();
    });
  });

  // =================== PATTERN REGISTRY INTEGRATION TESTS ===================

  describe('🔗 Pattern Registry Integration', () => {
    it('should provide access to pattern registry', () => {
      const registry = engine.getPatternRegistry();

      expect(registry).toBeDefined();
      expect(registry.getAllAgentTypes()).toEqual(expect.arrayContaining([
        'claude',
        'gemini',
        'codex',
        'copilot',
      ]));
    });

    it('should use registry patterns for detection', () => {
      const registry = engine.getPatternRegistry();
      const claudePatterns = registry.getAgentPatterns('claude');

      expect(claudePatterns).toBeDefined();

      // Test that engine uses these patterns
      const result = engine.detectFromInput('terminal-1', 'claude');
      expect(result.isDetected).toBe(true);
    });
  });
});
