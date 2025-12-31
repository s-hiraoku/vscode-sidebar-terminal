import { describe, it, expect, beforeEach } from 'vitest';
import { BaseDetectionStrategy } from '../../../../../services/strategies/BaseDetectionStrategy';

class TestDetectionStrategy extends BaseDetectionStrategy {
  readonly agentType = 'claude'; // Arbitrary choice for testing

  protected getCommandPrefixes(): string[] {
    return ['test-agent ', 'test-agent'];
  }

  protected getStartupPatterns(): string[] {
    return ['Welcome to Test Agent'];
  }

  protected getActivityKeywords(): string[] {
    return ['test-keyword'];
  }

  // Helper to expose protected methods for testing
  public testValidateInput(input: string): boolean {
    return this.validateInput(input);
  }

  public testValidateOutput(output: string): boolean {
    return this.validateOutput(output);
  }
}

describe('BaseDetectionStrategy', () => {
  let strategy: TestDetectionStrategy;

  beforeEach(() => {
    strategy = new TestDetectionStrategy();
  });

  describe('detectFromInput', () => {
    it('should detect valid command prefixes', () => {
      const result = strategy.detectFromInput('test-agent start');
      expect(result.isDetected).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.detectedLine).toBe('test-agent start');
    });

    it('should detect exact command matches', () => {
      const result = strategy.detectFromInput('test-agent');
      expect(result.isDetected).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should be case insensitive', () => {
      const result = strategy.detectFromInput('TEST-AGENT start');
      expect(result.isDetected).toBe(true);
    });

    it('should return not detected for invalid input', () => {
      const result = strategy.detectFromInput('other-command');
      expect(result.isDetected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should handle null/undefined/non-string input gracefully', () => {
      expect(strategy.detectFromInput(null as any).isDetected).toBe(false);
      expect(strategy.detectFromInput(undefined as any).isDetected).toBe(false);
      expect(strategy.detectFromInput(123 as any).isDetected).toBe(false);
    });
  });

  describe('detectFromOutput', () => {
    it('should detect startup patterns', () => {
      expect(strategy.detectFromOutput('Welcome to Test Agent v1.0')).toBe(true);
    });

    it('should return false for non-matching output', () => {
      expect(strategy.detectFromOutput('Some other output')).toBe(false);
    });

    it('should handle null/undefined/non-string output gracefully', () => {
      expect(strategy.detectFromOutput(null as any)).toBe(false);
      expect(strategy.detectFromOutput(undefined as any)).toBe(false);
      expect(strategy.detectFromOutput(123 as any)).toBe(false);
    });
  });

  describe('isAgentActivity', () => {
    it('should detect activity keywords', () => {
      expect(strategy.isAgentActivity('This contains test-keyword')).toBe(true);
    });

    it('should detect long output as activity', () => {
      const longOutput = 'a'.repeat(51);
      expect(strategy.isAgentActivity(longOutput)).toBe(true);
    });

    it('should return false for short, non-matching output', () => {
      expect(strategy.isAgentActivity('short output')).toBe(false);
    });

    it('should be case insensitive for keywords', () => {
      expect(strategy.isAgentActivity('THIS CONTAINS TEST-KEYWORD')).toBe(true);
    });

    it('should handle null/undefined/non-string output gracefully', () => {
      expect(strategy.isAgentActivity(null as any)).toBe(false);
      expect(strategy.isAgentActivity(undefined as any)).toBe(false);
      expect(strategy.isAgentActivity(123 as any)).toBe(false);
    });
  });

  describe('Validation Helpers', () => {
    it('validateInput should verify string type', () => {
      expect(strategy.testValidateInput('valid')).toBe(true);
      expect(strategy.testValidateInput('')).toBe(true);
      expect(strategy.testValidateInput(null as any)).toBe(false);
      expect(strategy.testValidateInput(undefined as any)).toBe(false);
      expect(strategy.testValidateInput(123 as any)).toBe(false);
    });

    it('validateOutput should verify string type', () => {
      expect(strategy.testValidateOutput('valid')).toBe(true);
      expect(strategy.testValidateOutput('')).toBe(true);
      expect(strategy.testValidateOutput(null as any)).toBe(false);
      expect(strategy.testValidateOutput(undefined as any)).toBe(false);
      expect(strategy.testValidateOutput(123 as any)).toBe(false);
    });
  });
});
