import { describe, it, expect, beforeEach } from 'vitest';
import { CliAgentPatternRegistry } from '../../../../services/CliAgentPatternRegistry';

describe('CliAgentPatternRegistry', () => {
  let registry: CliAgentPatternRegistry;

  beforeEach(() => {
    registry = new CliAgentPatternRegistry();
  });

  describe('matchCommandInput', () => {
    it('should match claude commands', () => {
      expect(registry.matchCommandInput('claude')).toBe('claude');
      expect(registry.matchCommandInput('claude code')).toBe('claude');
    });

    it('should match gemini commands', () => {
      expect(registry.matchCommandInput('gemini')).toBe('gemini');
      expect(registry.matchCommandInput('gemini help')).toBe('gemini');
    });

    it('should match codex/opencode/coplanilot commands', () => {
      expect(registry.matchCommandInput('codex')).toBe('codex');
      expect(registry.matchCommandInput('opencode')).toBe('opencode');
      expect(registry.matchCommandInput('gh copilot suggest')).toBe('copilot');
    });

    it('should match wrapper commands and env-prefixed commands', () => {
      expect(registry.matchCommandInput('FOO=1 codex --help')).toBe('codex');
      expect(registry.matchCommandInput('npx @openai/codex@latest')).toBe('codex');
      expect(registry.matchCommandInput('pnpm dlx @google/gemini-cli')).toBe('gemini');
      expect(registry.matchCommandInput('yarn dlx @anthropic-ai/claude-code')).toBe('claude');
      expect(registry.matchCommandInput('bunx opencode')).toBe('opencode');
    });

    it('should return null for normal shell commands', () => {
      expect(registry.matchCommandInput('ls -la')).toBeNull();
      expect(registry.matchCommandInput('cat file.txt')).toBeNull();
    });
  });

  describe('matchStartupOutput', () => {
    it('should match Claude startup messages', () => {
      expect(registry.matchStartupOutput('Welcome to Claude Code!')).toBe('claude');
      expect(registry.matchStartupOutput('Running Claude Code v1.0')).toBe('claude');
    });

    it('should match Gemini startup messages', () => {
      expect(registry.matchStartupOutput('Welcome to Gemini')).toBe('gemini');
      expect(registry.matchStartupOutput('Gemini model initialized')).toBe('gemini');
    });

    it('should not match plain agent command text as startup output', () => {
      expect(registry.matchStartupOutput('opencode')).toBeNull();
      expect(registry.matchStartupOutput('copilot')).toBeNull();
    });
  });

  describe('isAgentActivity', () => {
    it('should detect activity by known agent keywords', () => {
      expect(registry.isAgentActivity('Claude is thinking about the fix')).toBe(true);
      expect(registry.isAgentActivity('Gemini generated a response')).toBe(true);
    });

    it('should not treat generic long text as agent activity', () => {
      expect(
        registry.isAgentActivity(
          'This output is very long but does not include any known agent keywords and should not count as agent activity'
        )
      ).toBe(false);
    });
  });

  describe('isShellPrompt', () => {
    it('should match standard bash/zsh prompts', () => {
      expect(registry.isShellPrompt('user@host:~$ ')).toBe(true);
      expect(registry.isShellPrompt('user@host /path % ')).toBe(true);
    });

    it('should match modern prompt symbols', () => {
      expect(registry.isShellPrompt('❯ ')).toBe(true);
      expect(registry.isShellPrompt('➜ ~ ')).toBe(true);
    });

    it('should match powerline/starship style prompts', () => {
      expect(registry.isShellPrompt('❯ [main] ')).toBe(true);
      expect(registry.isShellPrompt('➜ myproject git:(main) ✗ ')).toBe(true);
    });

    it('should return false for long output lines', () => {
      expect(registry.isShellPrompt('This is a very long line that clearly is not a prompt even if it has $ in it')).toBe(false);
    });
  });

  describe('isTerminationPattern', () => {
    it('should match explicit goodbye messages', () => {
      expect(registry.isTerminationPattern('Goodbye!')).toBe(true);
      expect(registry.isTerminationPattern('session ended')).toBe(true);
    });

    it('should match crash indicators', () => {
      expect(registry.isTerminationPattern('segmentation fault')).toBe(true);
      expect(registry.isTerminationPattern('FATAL ERROR: out of memory')).toBe(true);
    });

    it('should match agent-specific patterns', () => {
      expect(registry.isTerminationPattern('goodbye claude', 'claude')).toBe(true);
      expect(registry.isTerminationPattern('exiting gemini', 'gemini')).toBe(true);
    });
  });

  describe('cleanAnsiEscapeSequences', () => {
    it('should strip colors and formatting', () => {
      const raw = '\x1b[32mGreen\x1b[0m and \x1b[1mBold\x1b[0m';
      expect(registry.cleanAnsiEscapeSequences(raw)).toBe('Green and Bold');
    });

    it('should remove carriage returns and control chars', () => {
      const raw = 'line1\r\nline2\x07';
      expect(registry.cleanAnsiEscapeSequences(raw)).toBe('line1line2');
    });

    it('should handle complex OSC sequences', () => {
      const raw = '\x1b]0;terminal title\x07Prompt$ ';
      expect(registry.cleanAnsiEscapeSequences(raw)).toBe('Prompt$');
    });
  });

  describe('Registry Access', () => {
    it('should provide all registered agent types', () => {
      const types = registry.getAllAgentTypes();
      expect(types).toContain('claude');
      expect(types).toContain('gemini');
      expect(types).toContain('codex');
      expect(types).toContain('copilot');
      expect(types).toContain('opencode');
    });

    it('should provide shell prompt patterns', () => {
      const patterns = registry.getShellPromptPatterns();
      expect(patterns.standard.length).toBeGreaterThan(0);
      expect(patterns.explicitTermination.length).toBeGreaterThan(0);
    });
  });
});
