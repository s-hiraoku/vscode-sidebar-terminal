import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiDetectionStrategy } from '../../../../../services/strategies/GeminiDetectionStrategy';

describe('GeminiDetectionStrategy', () => {
  let strategy: GeminiDetectionStrategy;

  beforeEach(() => {
    strategy = new GeminiDetectionStrategy();
  });

  describe('detectFromInput', () => {
    it('should detect gemini command', () => {
      const result = strategy.detectFromInput('gemini');
      expect(result.isDetected).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should detect gemini chat/code with high confidence', () => {
      // Direct command starts with 'gemini ' -> 1.0
      expect(strategy.detectFromInput('gemini chat').confidence).toBe(1.0);
      
      // Path execution might triggers specific rules if not caught by 'gemini ' prefix
      expect(strategy.detectFromInput('/bin/gemini code').confidence).toBe(0.95);
    });

    it('should detect gemini subcommands', () => {
      expect(strategy.detectFromInput('gemini generate').confidence).toBe(1.0);
    });

    it('should detect help flag', () => {
      expect(strategy.detectFromInput('gemini --help').confidence).toBe(1.0);
      
      // Without prefix but with flag
      expect(strategy.detectFromInput('/usr/bin/gemini --help').confidence).toBe(0.9);
    });

    it('should return false for unknown commands', () => {
      expect(strategy.detectFromInput('ls -la').isDetected).toBe(false);
    });
  });

  describe('detectFromOutput', () => {
    it('should detect ASCII art pattern', () => {
      const asciiArt = `
███ █████████ ██████████ ██████ ██████ █████ ██████ █████ █████
`;
      // The strategy strips ANSI codes and trims, so this simple string might match if the logic is robust
      // The implementation uses specific regexes for lines.
      // Let's copy a line from the implementation to be sure.
      const line1 = '███ █████████ ██████████ ██████ ██████ █████ ██████ █████ █████';
      expect(strategy.detectFromOutput(line1)).toBe(true);
    });

    it('should detect indentation pattern', () => {
      const indentationPattern = `
███
  ░░░███
    ░░░███
      ░░░███
`;
      expect(strategy.detectFromOutput(indentationPattern)).toBe(true);
    });

    it('should ignore random text', () => {
      expect(strategy.detectFromOutput('Hello world')).toBe(false);
    });
  });

  describe('isAgentActivity', () => {
    it('should detect keywords', () => {
      expect(strategy.isAgentActivity('Gemini is thinking')).toBe(true);
      expect(strategy.isAgentActivity('Google AI response')).toBe(true);
      expect(strategy.isAgentActivity('Bard says...')).toBe(true);
    });

    it('should detect gemini specific patterns', () => {
      expect(strategy.isAgentActivity('gemini is here')).toBe(true);
    });

    it('should detect long output', () => {
      expect(strategy.isAgentActivity('a'.repeat(60))).toBe(true);
    });
  });
});
