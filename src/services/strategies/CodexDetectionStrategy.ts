/**
 * OpenAI Codex CLI Detection Strategy
 *
 * Implements agent-specific detection logic for OpenAI Codex CLI.
 * Extends BaseDetectionStrategy to inherit common validation logic.
 */

import { BaseDetectionStrategy } from './BaseDetectionStrategy';

export class CodexDetectionStrategy extends BaseDetectionStrategy {
  readonly agentType = 'codex' as const;

  protected getCommandPrefixes(): string[] {
    return ['codex ', 'codex'];
  }

  protected getStartupPatterns(): string[] {
    return ['OpenAI Codex'];
  }

  protected getActivityKeywords(): string[] {
    return ['codex', 'openai'];
  }
}
