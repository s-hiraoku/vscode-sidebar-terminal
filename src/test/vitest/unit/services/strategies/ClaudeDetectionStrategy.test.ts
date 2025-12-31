import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeDetectionStrategy } from '../../../../../services/strategies/ClaudeDetectionStrategy';

describe('ClaudeDetectionStrategy', () => {
  let strategy: ClaudeDetectionStrategy;

  beforeEach(() => {
    strategy = new ClaudeDetectionStrategy();
  });

  describe('detectFromInput', () => {
    it('should detect claude command', () => {
      const result = strategy.detectFromInput('claude');
      expect(result.isDetected).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should detect claude command with arguments', () => {
      const result = strategy.detectFromInput('claude start');
      expect(result.isDetected).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should ignore unrelated commands', () => {
      const result = strategy.detectFromInput('git status');
      expect(result.isDetected).toBe(false);
    });
  });

  describe('detectFromOutput', () => {
    it('should detect regex patterns (Claude Code)', () => {
      expect(strategy.detectFromOutput('Welcome to Claude Code')).toBe(true);
    });

    it('should ignore output without patterns', () => {
      expect(strategy.detectFromOutput('Hello world')).toBe(false);
    });
  });

  describe('isAgentActivity', () => {
    it('should detect keywords', () => {
      expect(strategy.isAgentActivity('Thinking... claude is working')).toBe(true);
      expect(strategy.isAgentActivity('Anthropic API')).toBe(true);
    });

    it('should detect long output', () => {
      expect(strategy.isAgentActivity('a'.repeat(60))).toBe(true);
    });
  });
});
