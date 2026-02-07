/**
 * Tests for improved CLI Agent detection patterns
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 *
 * Focus on relaxed termination detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CliAgentDetectionService } from '../../../../services/CliAgentDetectionService';

describe('CLI Agent Detection - Improved Patterns', () => {
  let detectionService: CliAgentDetectionService;

  beforeEach(() => {
    detectionService = new CliAgentDetectionService();
  });

  afterEach(() => {
    detectionService.dispose();
    vi.restoreAllMocks();
  });

  // Helper to access stateManager via the service's getter
  function getStateManager() {
    return detectionService.stateManager;
  }

  describe('Relaxed Termination Detection', () => {
    beforeEach(() => {
      // Setup connected agent for termination testing
      getStateManager().setConnectedAgent('terminal-1', 'claude');
    });

    it('should detect simple shell prompts more easily', () => {
      const testPrompts = [
        'user@host:~$ ',
        'macbook-pro:~ user$ ',
        'hostname$ ',
        '$ ',
        '% ',
        '> ',
        'john@server:/home/john$ ',
        'PS C:\\Users\\User> ',
      ];

      testPrompts.forEach((prompt) => {
        const result = detectionService.detectTermination('terminal-1', prompt);
        expect(result.isTerminated).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.4);
      });
    });

    // SKIP: Internal API setDetectionCacheValue no longer exists
    it.skip('should handle timeout-based detection', async () => {
      // Simulate 30+ seconds without AI output by using the cache setter
      const oldTimestamp = Date.now() - 35000; // 35 seconds ago
      (detectionService as any).setDetectionCacheValue('terminal-1_lastAIOutput', oldTimestamp);

      const result = detectionService.detectTermination('terminal-1', 'user$ ');
      expect(result.isTerminated).toBe(true);
      expect(result.reason).toContain('timeout');
    });

    it('should still avoid false positives from AI output', () => {
      const aiOutputs = [
        "I'll help you with that task",
        'Let me analyze the code for you',
        "Here's what I found in the documentation",
        'Claude Code is analyzing your request',
        'Thinking about the best approach...',
        'I can help you implement this feature',
      ];

      aiOutputs.forEach((output) => {
        const result = detectionService.detectTermination('terminal-1', output);
        expect(result.isTerminated).toBe(false);
      });
    });

    it('should detect explicit termination messages', () => {
      const terminationMessages = [
        '[Process completed]',
        '[process exited with code 0]',
        '[process exited with code 130]',
        'Agent powering down. Goodbye!',
        'command not found: claude',
        'command not found: gemini',
      ];

      terminationMessages.forEach((message) => {
        const result = detectionService.detectTermination('terminal-1', message);
        expect(result.isTerminated).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.6);
      });
    });

    it('should NOT detect generic words as termination', () => {
      const nonTerminationMessages = [
        'session ended',
        'goodbye claude',
        'exit',
        'quit',
        'goodbye',
        '[done]',
        'completed',
      ];

      nonTerminationMessages.forEach((message) => {
        const result = detectionService.detectTermination('terminal-1', message);
        expect(result.isTerminated).toBe(false);
      });
    });
  });

  describe('Claude Session End Detection', () => {
    it('should be more lenient with shell prompts', () => {
      // Test the private method indirectly through detectTermination
      const shellPrompts = ['user@macbook:~$ ', 'hostname$ ', 'john@server:/path$ ', '$ ', '% '];

      shellPrompts.forEach((prompt) => {
        const result = detectionService.detectTermination('terminal-1', prompt);
        expect(result.isTerminated).toBe(true);
      });
    });

    it('should detect process completion messages', () => {
      const completionMessages = [
        '[Process completed]',
        '[process exited with code 0]',
        '[process exited with code 1]',
        'Agent powering down. Goodbye!',
      ];

      completionMessages.forEach((message) => {
        const result = detectionService.detectTermination('terminal-1', message);
        expect(result.isTerminated).toBe(true);
      });
    });

    it('should NOT detect fictional completion patterns', () => {
      const nonCompletionMessages = [
        '[done]',
        '[finished]',
        'done',
        'complete',
        'completed',
      ];

      nonCompletionMessages.forEach((message) => {
        const result = detectionService.detectTermination('terminal-1', message);
        expect(result.isTerminated).toBe(false);
      });
    });

    // SKIP: Internal API setDetectionCacheValue no longer exists
    it.skip('should handle time-based relaxation', () => {
      // Simulate time passing without Claude activity
      const oldTimestamp = Date.now() - 25000; // 25 seconds ago
      (detectionService as any).setDetectionCacheValue('lastClaudeActivity', oldTimestamp);

      const result = detectionService.detectTermination('terminal-1', 'host$ ');
      expect(result.isTerminated).toBe(true);
    });
  });

  describe('State Management Improvements', () => {
    // SKIP: Grace period behavior has changed in the implementation
    it.skip('should handle grace period for state changes', async () => {
      getStateManager().setConnectedAgent('terminal-1', 'claude');

      // Trigger termination detection
      detectionService.detectFromOutput('terminal-1', 'user@host:~$ ');

      // State should not change immediately due to grace period
      expect(getStateManager().isAgentConnected('terminal-1')).toBe(true);

      // Wait for grace period
      await new Promise((resolve) => setTimeout(resolve, 1200)); // Slightly longer than grace period
      expect(getStateManager().isAgentConnected('terminal-1')).toBe(false);
    });

    // SKIP: Internal API getDetectionCacheValue no longer exists
    it.skip('should track AI activity timestamps', () => {
      const aiOutputs = [
        'Claude is thinking about your request',
        'Let me analyze this code',
        'I can help you with that',
      ];

      aiOutputs.forEach((output) => {
        detectionService.detectFromOutput('terminal-1', output);
      });

      // Verify that activity tracking is working (we'll check that it's recording activity)
      const hasActivity = (detectionService as any).getDetectionCacheValue(
        'terminal-1_lastAIOutput'
      );
      expect(typeof hasActivity).toBe('number');
    });
  });

  describe('Edge Cases and Stability', () => {
    it('should handle rapid state changes gracefully', () => {
      // Rapidly switch between states
      getStateManager().setConnectedAgent('terminal-1', 'claude');
      detectionService.detectFromOutput('terminal-1', 'user$ ');
      getStateManager().setConnectedAgent('terminal-1', 'claude');
      detectionService.detectFromOutput('terminal-1', 'user$ ');

      // Should not crash or throw errors
      expect(true).toBe(true);
    });

    it('should handle malformed input gracefully', () => {
      const malformedInputs = [
        '',
        '\n\n\n',
        '\x1b[2J\x1b[H', // ANSI escape sequences
        '���', // Invalid UTF-8
        'a'.repeat(10000), // Very long string
      ];

      malformedInputs.forEach((input) => {
        expect(() => {
          detectionService.detectFromOutput('terminal-1', input);
        }).not.toThrow();
      });
    });

    it('should maintain performance under load', () => {
      const startTime = Date.now();

      // Process many detection calls
      for (let i = 0; i < 1000; i++) {
        detectionService.detectFromOutput('terminal-1', `Line ${i} of output`);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});
