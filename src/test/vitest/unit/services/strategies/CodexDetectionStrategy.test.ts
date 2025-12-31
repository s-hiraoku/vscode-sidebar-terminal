import { describe, it, expect, beforeEach } from 'vitest';
import { CodexDetectionStrategy } from '../../../../../services/strategies/CodexDetectionStrategy';

describe('CodexDetectionStrategy', () => {
  let strategy: CodexDetectionStrategy;

  beforeEach(() => {
    strategy = new CodexDetectionStrategy();
  });

  describe('detectFromInput', () => {
    it('should detect codex command', () => {
      const result = strategy.detectFromInput('codex');
      expect(result.isDetected).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should detect codex command with args', () => {
      const result = strategy.detectFromInput('codex explain');
      expect(result.isDetected).toBe(true);
    });
  });

  describe('detectFromOutput', () => {
    it('should detect startup pattern', () => {
      expect(strategy.detectFromOutput('OpenAI Codex')).toBe(true);
    });
  });

  describe('isAgentActivity', () => {
    it('should detect keywords', () => {
      expect(strategy.isAgentActivity('openai response')).toBe(true);
    });
  });
});
