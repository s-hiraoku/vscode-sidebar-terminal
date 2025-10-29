/**
 * OpenAI Codex Agent Plugin
 *
 * Detects OpenAI Codex CLI agent activity in terminals.
 */

import { BaseAgentPlugin } from './BaseAgentPlugin';

export class CodexPlugin extends BaseAgentPlugin {
  constructor() {
    super({
      id: 'codex-agent',
      name: 'Codex Agent Plugin',
      version: '1.0.0',
      description: 'Detects OpenAI Codex CLI agent',
      author: 'Sidebar Terminal',
    });
  }

  protected getDetectionPatterns(): RegExp[] {
    return [
      /OpenAI\s+Codex/i,
      /Codex\s+CLI/i,
    ];
  }

  protected getCommandPrefixes(): string[] {
    return ['codex ', 'codex'];
  }

  protected getActivityKeywords(): string[] {
    return ['codex', 'openai'];
  }

  getAgentType(): string {
    return 'codex';
  }
}
