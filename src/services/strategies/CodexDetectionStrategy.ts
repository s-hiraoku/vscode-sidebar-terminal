/**
 * OpenAI Codex CLI Detection Strategy
 *
 * Implements agent-specific detection logic for OpenAI Codex CLI.
 * Handles input command detection and output pattern recognition.
 */

import { AgentDetectionStrategy, AgentDetectionResult } from './AgentDetectionStrategy';

export class CodexDetectionStrategy implements AgentDetectionStrategy {
  readonly agentType = 'codex' as const;

  detectFromInput(input: string): AgentDetectionResult {
    const line = input.toLowerCase();

    // Simple detection - basic codex commands
    if (line.startsWith('codex ') || line === 'codex') {
      return {
        isDetected: true,
        confidence: 1.0,
        detectedLine: input
      };
    }

    return { isDetected: false, confidence: 0 };
  }

  detectFromOutput(output: string): boolean {
    if (!output || typeof output !== 'string') {
      return false;
    }

    // Simple and direct detection - only 'OpenAI Codex'
    return output.includes('OpenAI Codex');
  }

  isAgentActivity(output: string): boolean {
    if (!output || typeof output !== 'string') {
      return false;
    }

    const lowerLine = output.toLowerCase();
    return (
      lowerLine.includes('codex') ||
      lowerLine.includes('openai') ||
      output.length > 50
    );
  }

}