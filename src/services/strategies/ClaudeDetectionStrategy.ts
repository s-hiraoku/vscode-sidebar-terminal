/**
 * Claude Code Detection Strategy
 *
 * Implements agent-specific detection logic for Claude Code CLI.
 * Handles input command detection and output pattern recognition.
 */

import { AgentDetectionStrategy, AgentDetectionResult } from './AgentDetectionStrategy';
import { CliAgentPatternDetector } from '../CliAgentPatternDetector';

export class ClaudeDetectionStrategy implements AgentDetectionStrategy {
  readonly agentType = 'claude' as const;
  private patternDetector = new CliAgentPatternDetector();

  detectFromInput(input: string): AgentDetectionResult {
    const line = input.toLowerCase();

    // Simple detection - basic claude commands
    if (line.startsWith('claude ') || line === 'claude') {
      return {
        isDetected: true,
        confidence: 1.0,
        detectedLine: input,
      };
    }

    return { isDetected: false, confidence: 0 };
  }

  detectFromOutput(output: string): boolean {
    if (!output || typeof output !== 'string') {
      return false;
    }

    // Simple and direct detection - only 'Welcome to Claude Code!'
    return output.includes('Welcome to Claude Code!');
  }

  isAgentActivity(output: string): boolean {
    if (!output || typeof output !== 'string') {
      return false;
    }

    const lowerLine = output.toLowerCase();
    return (
      lowerLine.includes('claude') ||
      lowerLine.includes('anthropic') ||
      output.length > 50
    );
  }
}
