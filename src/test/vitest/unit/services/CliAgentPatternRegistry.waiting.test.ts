import { describe, it, expect, beforeEach } from 'vitest';
import { CliAgentPatternRegistry } from '../../../../services/CliAgentPatternRegistry';

describe('CliAgentPatternRegistry - Waiting Patterns', () => {
  let registry: CliAgentPatternRegistry;

  beforeEach(() => {
    registry = new CliAgentPatternRegistry();
  });

  describe('matchWaitingPattern', () => {
    describe('Claude Code waiting patterns', () => {
      it('should detect Claude Code input prompt (❯)', () => {
        const result = registry.matchWaitingPattern('claude', '❯');
        expect(result).not.toBeNull();
        expect(result!.waitingType).toBe('input');
      });

      it('should detect Claude Code tool approval prompt (Allow once/always)', () => {
        const result = registry.matchWaitingPattern('claude', 'Allow once?');
        expect(result).not.toBeNull();
        expect(result!.waitingType).toBe('approval');
      });

      it('should detect Claude Code Y/n prompt', () => {
        const result = registry.matchWaitingPattern('claude', 'Do you want to proceed? (Y/n)');
        expect(result).not.toBeNull();
        expect(result!.waitingType).toBe('approval');
      });

      it('should detect Claude Code y/N prompt', () => {
        const result = registry.matchWaitingPattern('claude', 'Continue? (y/N)');
        expect(result).not.toBeNull();
        expect(result!.waitingType).toBe('approval');
      });

      it('should not match normal Claude Code output', () => {
        const result = registry.matchWaitingPattern('claude', 'Reading file src/index.ts...');
        expect(result).toBeNull();
      });
    });

    describe('Gemini CLI waiting patterns', () => {
      it('should detect Gemini CLI input prompt (gemini >)', () => {
        const result = registry.matchWaitingPattern('gemini', 'gemini >');
        expect(result).not.toBeNull();
        expect(result!.waitingType).toBe('input');
      });

      it('should detect Gemini CLI approval prompt', () => {
        const result = registry.matchWaitingPattern('gemini', 'Do you approve this action?');
        expect(result).not.toBeNull();
        expect(result!.waitingType).toBe('approval');
      });

      it('should not match normal Gemini output', () => {
        const result = registry.matchWaitingPattern('gemini', 'Generating response...');
        expect(result).toBeNull();
      });
    });

    describe('GitHub Copilot waiting patterns', () => {
      it('should detect Copilot input prompt', () => {
        const result = registry.matchWaitingPattern('copilot', 'copilot >');
        expect(result).not.toBeNull();
        expect(result!.waitingType).toBe('input');
      });
    });

    describe('Codex CLI waiting patterns', () => {
      it('should detect Codex input prompt', () => {
        const result = registry.matchWaitingPattern('codex', 'codex >');
        expect(result).not.toBeNull();
        expect(result!.waitingType).toBe('input');
      });
    });

    describe('OpenCode waiting patterns', () => {
      it('should detect OpenCode input prompt', () => {
        const result = registry.matchWaitingPattern('opencode', 'opencode >');
        expect(result).not.toBeNull();
        expect(result!.waitingType).toBe('input');
      });
    });

    describe('edge cases', () => {
      it('should return null for unknown agent type', () => {
        const result = registry.matchWaitingPattern('unknown' as any, '❯');
        expect(result).toBeNull();
      });

      it('should return null for empty output', () => {
        const result = registry.matchWaitingPattern('claude', '');
        expect(result).toBeNull();
      });

      it('should handle ANSI-cleaned output', () => {
        const result = registry.matchWaitingPattern('claude', '❯ ');
        expect(result).not.toBeNull();
        expect(result!.waitingType).toBe('input');
      });
    });
  });

  describe('getWaitingPatterns', () => {
    it('should return waiting patterns for claude', () => {
      const patterns = registry.getWaitingPatterns('claude');
      expect(patterns).toBeDefined();
      expect(patterns!.inputPromptRegexPatterns).toBeDefined();
      expect(patterns!.inputPromptRegexPatterns!.length).toBeGreaterThan(0);
    });

    it('should return waiting patterns for gemini', () => {
      const patterns = registry.getWaitingPatterns('gemini');
      expect(patterns).toBeDefined();
    });

    it('should return undefined for unknown agent', () => {
      const patterns = registry.getWaitingPatterns('unknown' as any);
      expect(patterns).toBeUndefined();
    });
  });
});
