import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CliAgentTerminationDetector } from '../../../../services/CliAgentTerminationDetector';
import { LRUCache } from '../../../../utils/LRUCache';
import { CliAgentPatternDetector } from '../../../../services/CliAgentPatternDetector';

// Mock dependencies
const mockCleanAnsiEscapeSequences = vi.fn((s) => s.trim());
const mockDetectShellPrompt = vi.fn().mockReturnValue(false);

vi.mock('../../../../services/CliAgentPatternDetector', () => {
  return {
    CliAgentPatternDetector: class {
      cleanAnsiEscapeSequences = mockCleanAnsiEscapeSequences;
      detectShellPrompt = mockDetectShellPrompt;
      dispose = vi.fn();
    },
  };
});

vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

describe('CliAgentTerminationDetector', () => {
  let detector: CliAgentTerminationDetector;
  let mockCache: LRUCache<string, any>;

  beforeEach(() => {
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
    } as any;

    // Reset mocks
    vi.clearAllMocks();
    mockCleanAnsiEscapeSequences.mockImplementation((s) => s.trim());
    mockDetectShellPrompt.mockReturnValue(false);

    detector = new CliAgentTerminationDetector(mockCache);
  });

  describe('detectStrictTermination', () => {
    it('should detect explicit termination messages', () => {
      const result = detector.detectStrictTermination('term-1', 'session ended');
      expect(result.isTerminated).toBe(true);
      expect(result.reason).toContain('Very explicit termination message');
      expect(result.confidence).toBe(1.0);
    });

    it('should detect process crash', () => {
      const result = detector.detectStrictTermination('term-1', 'segmentation fault');
      expect(result.isTerminated).toBe(true);
      expect(result.reason).toContain('Process crash');
      expect(result.confidence).toBe(0.95);
    });

    it('should detect relaxed shell prompt', () => {
      mockDetectShellPrompt.mockReturnValue(true);
      
      const line = 'user@host:~$ ';
      
      const result = detector.detectStrictTermination('term-1', line);
      expect(result.isTerminated).toBe(true);
      expect(result.reason).toContain('Shell prompt detected (relaxed mode)');
    });

    it('should ignore shell prompt if it looks like AI output', () => {
      mockDetectShellPrompt.mockReturnValue(true);
      
      // Ensure we don't hit time-based relaxation in detectClaudeSessionEnd
      // Set lastClaudeActivity to NOW so it's not "relaxed"
      mockCache.get.mockImplementation((key) => {
          if (key === 'lastClaudeActivity') return { timestamp: Date.now() };
          return undefined;
      });

      // "i am claude" is in the exclusion list
      const result = detector.detectStrictTermination('term-1', 'user@host:~$ i am claude');
      expect(result.isTerminated).toBe(false);
    });

    it('should detect Claude session end via private method logic', () => {
      // detectClaudeSessionEnd checks for explicit termination too, e.g. "goodbye claude"
      // But "goodbye claude" is also caught by hasVeryExplicitTerminationMessage which runs first.
      
      // Let's try a pattern that is ONLY in detectClaudeSessionEnd or reachable if previous checks fail.
      // detectClaudeSessionEnd is checked after patternDetector.detectShellPrompt block.
      
      // "cleaning up" is in hasSessionEndIndicator inside detectClaudeSessionEnd
      const result = detector.detectStrictTermination('term-1', 'cleaning up session');
      expect(result.isTerminated).toBe(true);
      expect(result.reason).toContain('Claude session termination');
    });
  });

  describe('validateTerminationSignal', () => {
    it('should validate high confidence signals', () => {
      const result = detector.validateTerminationSignal('term-1', 'line', {
        isTerminated: true,
        confidence: 0.95,
        detectedLine: 'line',
        reason: 'test'
      });
      expect(result).toBe(true);
    });

    it('should validate if obvious shell prompt', () => {
      const result = detector.validateTerminationSignal('term-1', 'user@host:~$ ', {
        isTerminated: true,
        confidence: 0.5,
        detectedLine: 'user@host:~$ ',
        reason: 'test'
      });
      expect(result).toBe(true);
    });

    it('should require higher confidence if recent AI activity', () => {
      // Mock recent activity
      mockCache.get.mockImplementation((key) => {
        if (key === 'term-1_lastAIOutput') return { timestamp: Date.now() - 1000 };
        return undefined;
      });
      
      const resultLowConf = detector.validateTerminationSignal('term-1', 'line', {
        isTerminated: true,
        confidence: 0.7,
        detectedLine: 'line',
        reason: 'test'
      });
      expect(resultLowConf).toBe(false);

      const resultHighConf = detector.validateTerminationSignal('term-1', 'line', {
        isTerminated: true,
        confidence: 0.85,
        detectedLine: 'line',
        reason: 'test'
      });
      expect(resultHighConf).toBe(true);
    });

    it('should validate medium confidence if enough time passed since AI activity', () => {
      // Mock old activity (11 seconds ago, so > 10s threshold)
      mockCache.get.mockImplementation((key) => {
        if (key === 'term-1_lastAIOutput') return { timestamp: Date.now() - 11000 };
        return undefined;
      });
      
      const result = detector.validateTerminationSignal('term-1', 'line', {
        isTerminated: true,
        confidence: 0.6,
        detectedLine: 'line',
        reason: 'test'
      });
      expect(result).toBe(true);
    });

    it('should fail validation for low confidence without other factors', () => {
      mockCache.get.mockReturnValue(undefined); // No AI activity record means Date.now() - 0 is huge time diff, so time check passes?
      // Wait: timeSinceLastAIOutput = Date.now() - (lastAIOutputEntry?.timestamp || 0);
      // If undefined, timestamp is 0. Date.now() - 0 is huge.
      // So timeSinceLastAIOutput >= 5000 is true.
      // But we need confidence >= 0.6.
      
      // Let's test with confidence 0.5 (low)
      const result = detector.validateTerminationSignal('term-1', 'line', {
        isTerminated: true,
        confidence: 0.5,
        detectedLine: 'line',
        reason: 'test'
      });
      expect(result).toBe(false);
    });
  });
});
