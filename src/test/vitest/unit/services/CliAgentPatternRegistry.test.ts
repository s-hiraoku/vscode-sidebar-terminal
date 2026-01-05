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
    });

    it('should provide shell prompt patterns', () => {
      const patterns = registry.getShellPromptPatterns();
      expect(patterns.standard.length).toBeGreaterThan(0);
      expect(patterns.explicitTermination.length).toBeGreaterThan(0);
    });
  });
});