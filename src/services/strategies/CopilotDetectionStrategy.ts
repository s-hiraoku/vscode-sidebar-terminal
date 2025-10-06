/**
 * GitHub Copilot CLI Detection Strategy
 *
 * Implements agent-specific detection logic for GitHub Copilot CLI.
 * Handles input command detection and output pattern recognition.
 */

import { AgentDetectionStrategy, AgentDetectionResult } from './AgentDetectionStrategy';

export class CopilotDetectionStrategy implements AgentDetectionStrategy {
  readonly agentType = 'copilot' as const;

  detectFromInput(input: string): AgentDetectionResult {
    const line = input.toLowerCase();

    // Simple detection - basic copilot commands
    if (line.startsWith('copilot ') || line === 'copilot' || line.startsWith('gh copilot ')) {
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

    // Simple and direct detection - only 'Welcome to GitHub Copilot CLI'
    return output.includes('Welcome to GitHub Copilot CLI');
  }

  isAgentActivity(output: string): boolean {
    if (!output || typeof output !== 'string') {
      return false;
    }

    const lowerLine = output.toLowerCase();
    return (
      lowerLine.includes('copilot') ||
      lowerLine.includes('github') ||
      output.length > 50
    );
  }
}