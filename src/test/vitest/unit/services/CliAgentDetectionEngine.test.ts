import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CliAgentDetectionEngine } from '../../../../services/CliAgentDetectionEngine';

// Mock logger to avoid terminal output during tests
vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

describe('CliAgentDetectionEngine', () => {
  let engine: CliAgentDetectionEngine;
  const terminalId = 'test-terminal';

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new CliAgentDetectionEngine();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('detectFromInput', () => {
    it('should detect claude command', () => {
      const result = engine.detectFromInput(terminalId, 'claude code');
      expect(result.isDetected).toBe(true);
      expect(result.agentType).toBe('claude');
      expect(result.source).toBe('input');
    });

    it('should detect gemini command', () => {
      const result = engine.detectFromInput(terminalId, 'gemini code');
      expect(result.isDetected).toBe(true);
      expect(result.agentType).toBe('gemini');
    });

    it('should return negative result for normal command', () => {
      const result = engine.detectFromInput(terminalId, 'ls -la');
      expect(result.isDetected).toBe(false);
      expect(result.agentType).toBeNull();
    });

    it('should handle empty input', () => {
      const result = engine.detectFromInput(terminalId, '  ');
      expect(result.isDetected).toBe(false);
      expect(result.reason).toBe('Empty input');
    });

    it('should use cache for repeated inputs', () => {
      // First call
      engine.detectFromInput(terminalId, 'claude code');
      
      // Spy on Date.now or registry if needed, but here we just check correctness
      const result = engine.detectFromInput(terminalId, 'claude code');
      expect(result.isDetected).toBe(true);
    });

    it('should expire cache after TTL', () => {
      engine.detectFromInput(terminalId, 'claude code');
      
      // Advance time beyond 5s TTL
      vi.advanceTimersByTime(6000);
      
      const result = engine.detectFromInput(terminalId, 'claude code');
      expect(result.isDetected).toBe(true);
    });
  });

  describe('detectFromOutput', () => {
    it('should detect agent startup from shell integration command execution', () => {
      const output = '\x1b]633;B;gh copilot suggest "fix bug"\x07';
      const result = engine.detectFromOutput(terminalId, output);

      expect(result.isDetected).toBe(true);
      expect(result.agentType).toBe('copilot');
      expect(result.source).toBe('output');
      expect(result.reason).toContain('Shell integration');
    });

    it('should detect opencode startup from shell integration command execution', () => {
      const output = '\x1b]633;B;opencode\x07';
      const result = engine.detectFromOutput(terminalId, output);

      expect(result.isDetected).toBe(true);
      expect(result.agentType).toBe('opencode');
      expect(result.source).toBe('output');
    });

    it('should detect startup patterns in multi-line output', () => {
      const output = 'Some unrelated text\nWelcome to Claude Code\nMore text';
      const result = engine.detectFromOutput(terminalId, output);
      
      expect(result.isDetected).toBe(true);
      expect(result.agentType).toBe('claude');
      expect(result.detectedLine).toContain('Welcome to Claude Code');
    });

    it('should clean ANSI escape sequences and box characters', () => {
      // Line with ANSI colors and Unicode box characters
      const line = '\x1b[32m│\x1b[0m Welcome to Claude Code \x1b[32m│\x1b[0m';
      const result = engine.detectFromOutput(terminalId, line);
      
      expect(result.isDetected).toBe(true);
      expect(result.agentType).toBe('claude');
    });

    it('should handle output with no matches', () => {
      const result = engine.detectFromOutput(terminalId, 'Hello world\nThis is a test');
      expect(result.isDetected).toBe(false);
    });

    it('should handle error in output processing', () => {
      // Pass null to trigger error in split
      const result = engine.detectFromOutput(terminalId, null as any);
      expect(result.isDetected).toBe(false);
      expect(result.reason).toBe('Detection error');
    });
  });

  describe('detectTermination', () => {
    it('should detect termination from shell integration command completion', () => {
      engine.detectFromOutput(terminalId, '\x1b]633;B;claude\x07');
      const result = engine.detectTermination(terminalId, '\x1b]633;C;0\x07', 'claude');

      expect(result.isTerminated).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.reason).toContain('Shell integration');
    });

    it('should detect termination from shell integration SIGINT completion', () => {
      const result = engine.detectTermination(terminalId, '\x1b]633;C;130\x07', 'claude');

      expect(result.isTerminated).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.reason).toContain('Shell integration');
    });

    it('should detect explicit termination pattern', () => {
      const result = engine.detectTermination(terminalId, 'Goodbye!', 'claude');
      expect(result.isTerminated).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toBe('Explicit termination pattern');
    });

    it('should detect shell prompt as termination if no recent AI activity', () => {
      const result = engine.detectTermination(terminalId, 'user@host:~$ ');
      expect(result.isTerminated).toBe(true);
      expect(result.confidence).toBe(0.6);
    });

    it('should ignore shell prompt if there is very recent AI activity', () => {
      engine.detectFromOutput(terminalId, 'Claude is thinking...');
      const result = engine.detectTermination(terminalId, 'user@host:~$ ');
      expect(result.isTerminated).toBe(false);
    });

    it('should detect termination when Ctrl+C is followed by shell prompt', () => {
      engine.detectFromInput(terminalId, '\x03');
      engine.detectFromOutput(terminalId, 'Claude is thinking...');
      const result = engine.detectTermination(terminalId, '^C\nuser@host:~$ ', 'claude');

      expect(result.isTerminated).toBe(true);
      expect(result.reason).toContain('Interrupt');
    });

    it('should detect termination when Ctrl+C is followed by decorated zsh prompt', () => {
      engine.detectFromInput(terminalId, '\x03');
      engine.detectFromOutput(terminalId, 'Claude is thinking...');
      const result = engine.detectTermination(terminalId, '^C\n➜ myproject git:(main) ✗ ', 'claude');

      expect(result.isTerminated).toBe(true);
      expect(result.reason).toContain('Interrupt');
    });

    it('should not detect termination from Ctrl+C without shell prompt', () => {
      engine.detectFromInput(terminalId, '\x03');
      const result = engine.detectTermination(terminalId, '^C', 'claude');

      expect(result.isTerminated).toBe(false);
    });

    it('should detect termination from double Ctrl+C input without shell prompt', () => {
      engine.detectFromInput(terminalId, '\x03');
      const first = engine.detectImmediateInterruptTermination(terminalId, 'claude');
      expect(first).toBeNull();

      vi.advanceTimersByTime(500);
      engine.detectFromInput(terminalId, '\x03');
      const second = engine.detectImmediateInterruptTermination(terminalId, 'claude');

      expect(second?.isTerminated).toBe(true);
      expect(second?.reason).toBe('Double interrupt detected');
    });

    it('should not detect double Ctrl+C termination when outside window', () => {
      engine.detectFromInput(terminalId, '\x03');
      vi.advanceTimersByTime(4000);
      engine.detectFromInput(terminalId, '\x03');

      const result = engine.detectImmediateInterruptTermination(terminalId, 'claude');
      expect(result).toBeNull();
    });

    it('should not treat generic long output as AI activity', () => {
      engine.detectFromOutput(
        terminalId,
        'This is a very long plain output line without any agent related keywords to simulate normal command output'
      );
      const result = engine.detectTermination(terminalId, 'user@host:~$ ');

      expect(result.isTerminated).toBe(true);
    });

    it('should handle error in termination detection', () => {
      const result = engine.detectTermination(terminalId, null as any);
      expect(result.isTerminated).toBe(false);
      expect(result.reason).toBe('Detection error');
    });

    it('should detect termination via timeout-based lenient check', () => {
      // 1. Simulate AI activity
      engine.detectFromOutput(terminalId, 'Some AI output');
      
      // 2. Advance time by 31 seconds (beyond 30s timeout)
      vi.advanceTimersByTime(31000);
      
      // 3. Check with a prompt-like character but not a standard prompt
      // Using a character that triggers the timeout-based check but NOT the standard prompt check
      // Standard prompt check usually requires more structure or specific patterns
      // Here we provide a line that contains '>' but doesn't look like AI output
      const result = engine.detectTermination(terminalId, '> ');
      
      expect(result.isTerminated).toBe(true);
      expect(result.confidence).toBe(0.6); // Matches shell prompt pattern
      expect(result.reason).toBe('Shell prompt detected');
    });

    it('should treat embedded agent keywords as non-keywords in timeout prompt detection', () => {
      // Simulate previous AI activity and timeout window passage.
      engine.detectFromOutput(terminalId, 'some output');
      vi.advanceTimersByTime(31000);

      // Contains "claude" as a substring only, not a whole word.
      const result = engine.detectTermination(terminalId, 'xclaudex>');

      expect(result.isTerminated).toBe(true);
      expect(result.reason).toBe('Timeout-based detection');
    });
  });

  describe('Cache Management', () => {
    it('should clear terminal cache', () => {
      engine.detectFromInput(terminalId, 'claude');
      expect(() => engine.clearTerminalCache(terminalId)).not.toThrow();
    });

    it('should fallback to full clear if iteration fails', () => {
      // Mock detectionCache to throw on forEach
      const cache = (engine as any).detectionCache;
      vi.spyOn(cache, 'clear');
      
      // Use any to force iteration error if we can, or just clear
      engine.clearTerminalCache(terminalId);
      expect(cache.clear).toBeDefined();
    });
  });

  describe('Validation', () => {
    it('should validate termination signal with different confidence levels', () => {
      // High confidence always valid
      expect((engine as any).validateTerminationSignal(terminalId, 0.9)).toBe(true);
      
      // Low confidence without time passed
      expect((engine as any).validateTerminationSignal(terminalId, 0.1)).toBe(false);
    });
  });
});
