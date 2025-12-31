import { describe, it, expect, beforeEach } from 'vitest';
import { CopilotDetectionStrategy } from '../../../../../services/strategies/CopilotDetectionStrategy';

describe('CopilotDetectionStrategy', () => {
  let strategy: CopilotDetectionStrategy;

  beforeEach(() => {
    strategy = new CopilotDetectionStrategy();
  });

  describe('detectFromInput', () => {
    it('should detect copilot command', () => {
      const result = strategy.detectFromInput('copilot');
      expect(result.isDetected).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should detect gh copilot command', () => {
      const result = strategy.detectFromInput('gh copilot explain');
      expect(result.isDetected).toBe(true);
    });
  });

  describe('detectFromOutput', () => {
    it('should detect startup pattern', () => {
      expect(strategy.detectFromOutput('Welcome to GitHub Copilot CLI')).toBe(true);
    });
  });

  describe('isAgentActivity', () => {
    it('should detect keywords', () => {
      expect(strategy.isAgentActivity('github copilot')).toBe(true);
    });
  });
});
