/**
 * GitHub Copilot CLI Detection Strategy
 *
 * Implements agent-specific detection logic for GitHub Copilot CLI.
 * Extends BaseDetectionStrategy to inherit common validation logic.
 */

import { BaseDetectionStrategy } from './BaseDetectionStrategy';

export class CopilotDetectionStrategy extends BaseDetectionStrategy {
  readonly agentType = 'copilot' as const;

  protected getCommandPrefixes(): string[] {
    return ['copilot ', 'copilot', 'gh copilot '];
  }

  protected getStartupPatterns(): string[] {
    return ['Welcome to GitHub Copilot CLI'];
  }

  protected getActivityKeywords(): string[] {
    return ['copilot', 'github'];
  }
}