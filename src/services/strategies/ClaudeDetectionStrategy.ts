/**
 * Claude Code Detection Strategy
 *
 * Implements agent-specific detection logic for Claude Code CLI.
 * Extends BaseDetectionStrategy to inherit common validation logic.
 */

import { BaseDetectionStrategy } from './BaseDetectionStrategy';

export class ClaudeDetectionStrategy extends BaseDetectionStrategy {
  readonly agentType = 'claude' as const;

  protected getCommandPrefixes(): string[] {
    return ['claude ', 'claude'];
  }

  protected getStartupPatterns(): string[] {
    return []; // Using regex instead
  }

  protected override getStartupRegexPatterns(): RegExp[] {
    return [/Claude\s*Code/i];
  }

  protected getActivityKeywords(): string[] {
    return ['claude', 'anthropic'];
  }
}
