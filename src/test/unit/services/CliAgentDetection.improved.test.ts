/**
 * Tests for improved CLI Agent detection patterns
 * Focus on relaxed termination detection
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { CliAgentDetectionService } from '../../../services/CliAgentDetectionService';
import { CliAgentStateManager } from '../../../services/CliAgentStateManager';

describe('CLI Agent Detection - Improved Patterns', () => {
  let sandbox: sinon.SinonSandbox;
  let detectionService: CliAgentDetectionService;
  let stateManager: CliAgentStateManager;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock dependencies
    stateManager = new CliAgentStateManager();
    detectionService = new CliAgentDetectionService();

    // Set the state manager for testing
    (detectionService as any).stateManager = stateManager;
  });

  afterEach(() => {
    detectionService.dispose();
    sandbox.restore();
  });

  describe('Relaxed Termination Detection', () => {
    beforeEach(() => {
      // Setup connected agent for termination testing
      stateManager.setConnectedAgent('terminal-1', 'claude');
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
        'PS C:\\Users\\User> '
      ];

      testPrompts.forEach(prompt => {
        const result = detectionService.detectTermination('terminal-1', prompt);
        expect(result.isTerminated).to.be.true;
        expect(result.confidence).to.be.greaterThan(0.4);
      });
    });

    it('should handle timeout-based detection', async () => {
      // Simulate 30+ seconds without AI output by using the cache setter
      const oldTimestamp = Date.now() - 35000; // 35 seconds ago
      (detectionService as any).setDetectionCacheValue('terminal-1_lastAIOutput', oldTimestamp);

      const result = detectionService.detectTermination('terminal-1', 'user$ ');
      expect(result.isTerminated).to.be.true;
      expect(result.reason).to.include('timeout');
    });

    it('should still avoid false positives from AI output', () => {
      const aiOutputs = [
        "I'll help you with that task",
        "Let me analyze the code for you",
        "Here's what I found in the documentation",
        "Claude Code is analyzing your request",
        "Thinking about the best approach...",
        "I can help you implement this feature"
      ];

      aiOutputs.forEach(output => {
        const result = detectionService.detectTermination('terminal-1', output);
        expect(result.isTerminated).to.be.false;
      });
    });

    it('should detect explicit termination messages', () => {
      const terminationMessages = [
        'session ended',
        'goodbye claude',
        'exit',
        'quit',
        'goodbye',
        'process exited with code 0',
        '[done]',
        'completed'
      ];

      terminationMessages.forEach(message => {
        const result = detectionService.detectTermination('terminal-1', message);
        expect(result.isTerminated).to.be.true;
        expect(result.confidence).to.be.greaterThan(0.6);
      });
    });
  });

  describe('Claude Session End Detection', () => {
    it('should be more lenient with shell prompts', () => {
      // Test the private method indirectly through detectTermination
      const shellPrompts = [
        'user@macbook:~$ ',
        'hostname$ ',
        'john@server:/path$ ',
        '$ ',
        '% '
      ];

      shellPrompts.forEach(prompt => {
        const result = detectionService.detectTermination('terminal-1', prompt);
        expect(result.isTerminated).to.be.true;
      });
    });

    it('should detect process completion messages', () => {
      const completionMessages = [
        '[done]',
        '[finished]',
        'done',
        'complete',
        'completed',
        'process exited with code 0'
      ];

      completionMessages.forEach(message => {
        const result = detectionService.detectTermination('terminal-1', message);
        expect(result.isTerminated).to.be.true;
      });
    });

    it('should handle time-based relaxation', () => {
      // Simulate time passing without Claude activity
      const oldTimestamp = Date.now() - 25000; // 25 seconds ago
      (detectionService as any).setDetectionCacheValue('lastClaudeActivity', oldTimestamp);

      const result = detectionService.detectTermination('terminal-1', 'host$ ');
      expect(result.isTerminated).to.be.true;
    });
  });

  describe('State Management Improvements', () => {
    it('should handle grace period for state changes', (done) => {
      stateManager.setConnectedAgent('terminal-1', 'claude');

      // Trigger termination detection
      detectionService.detectFromOutput('terminal-1', 'user@host:~$ ');

      // State should not change immediately due to grace period
      expect(stateManager.isAgentConnected('terminal-1')).to.be.true;

      // Wait for grace period
      setTimeout(() => {
        expect(stateManager.isAgentConnected('terminal-1')).to.be.false;
        done();
      }, 1200); // Slightly longer than grace period
    });

    it('should track AI activity timestamps', () => {
      const aiOutputs = [
        "Claude is thinking about your request",
        "Let me analyze this code",
        "I can help you with that"
      ];

      aiOutputs.forEach(output => {
        detectionService.detectFromOutput('terminal-1', output);
      });

      // Verify that activity tracking is working (we'll check that it's recording activity)
      const hasActivity = (detectionService as any).getDetectionCacheValue('terminal-1_lastAIOutput');
      expect(hasActivity).to.be.a('number');
    });
  });

  describe('Edge Cases and Stability', () => {
    it('should handle rapid state changes gracefully', () => {
      // Rapidly switch between states
      stateManager.setConnectedAgent('terminal-1', 'claude');
      detectionService.detectFromOutput('terminal-1', 'user$ ');
      stateManager.setConnectedAgent('terminal-1', 'claude');
      detectionService.detectFromOutput('terminal-1', 'user$ ');

      // Should not crash or throw errors
      expect(true).to.be.true;
    });

    it('should handle malformed input gracefully', () => {
      const malformedInputs = [
        '',
        '\n\n\n',
        '\x1b[2J\x1b[H', // ANSI escape sequences
        '���', // Invalid UTF-8
        'a'.repeat(10000) // Very long string
      ];

      malformedInputs.forEach(input => {
        expect(() => {
          detectionService.detectFromOutput('terminal-1', input);
        }).to.not.throw();
      });
    });

    it('should maintain performance under load', () => {
      const startTime = Date.now();

      // Process many detection calls
      for (let i = 0; i < 1000; i++) {
        detectionService.detectFromOutput('terminal-1', `Line ${i} of output`);
      }

      const duration = Date.now() - startTime;
      expect(duration).to.be.lessThan(1000); // Should complete in under 1 second
    });
  });
});