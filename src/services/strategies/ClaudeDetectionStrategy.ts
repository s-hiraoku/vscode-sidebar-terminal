/**
 * Claude Code Detection Strategy
 *
 * Implements agent-specific detection logic for Claude Code CLI.
 * Handles input command detection and output pattern recognition.
 */

import { AgentDetectionStrategy, AgentDetectionResult } from './AgentDetectionStrategy';

export class ClaudeDetectionStrategy implements AgentDetectionStrategy {
  readonly agentType = 'claude' as const;

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

    // Detection for Claude Code startup message
    return /Claude\s+Code/.test(output);
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
