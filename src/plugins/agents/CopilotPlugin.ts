/**
 * GitHub Copilot Agent Plugin
 *
 * Detects GitHub Copilot CLI agent activity in terminals.
 */

import { BaseAgentPlugin } from './BaseAgentPlugin';

export class CopilotPlugin extends BaseAgentPlugin {
  constructor() {
    super({
      id: 'copilot-agent',
      name: 'Copilot Agent Plugin',
      version: '1.0.0',
      description: 'Detects GitHub Copilot CLI agent',
      author: 'Sidebar Terminal',
    });
  }

  protected getDetectionPatterns(): RegExp[] {
    return [
      /Welcome\s+to\s+GitHub\s+Copilot\s+CLI/i,
      /GitHub\s+Copilot/i,
    ];
  }

  protected getCommandPrefixes(): string[] {
    return ['copilot ', 'copilot', 'gh copilot '];
  }

  protected getActivityKeywords(): string[] {
    return ['copilot', 'github'];
  }

  getAgentType(): string {
    return 'copilot';
  }
}
