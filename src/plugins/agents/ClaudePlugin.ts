/**
 * Claude Agent Plugin
 *
 * Detects Claude Code CLI agent activity in terminals.
 */

import { BaseAgentPlugin } from './BaseAgentPlugin';

export class ClaudePlugin extends BaseAgentPlugin {
  constructor() {
    super({
      id: 'claude-agent',
      name: 'Claude Agent Plugin',
      version: '1.0.0',
      description: 'Detects Claude Code CLI agent',
      author: 'Sidebar Terminal',
    });
  }

  protected getDetectionPatterns(): RegExp[] {
    return [
      /Claude\s+Code/i,
      /Anthropic/i,
    ];
  }

  protected getCommandPrefixes(): string[] {
    return ['claude ', 'claude'];
  }

  protected getActivityKeywords(): string[] {
    return ['claude', 'anthropic', 'claude code'];
  }

  getAgentType(): string {
    return 'claude';
  }
}
