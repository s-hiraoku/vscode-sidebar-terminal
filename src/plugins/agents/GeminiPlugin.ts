/**
 * Google Gemini Agent Plugin
 *
 * Detects Google Gemini CLI agent activity in terminals.
 */

import { BaseAgentPlugin } from './BaseAgentPlugin';

export class GeminiPlugin extends BaseAgentPlugin {
  constructor() {
    super({
      id: 'gemini-agent',
      name: 'Gemini Agent Plugin',
      version: '1.0.0',
      description: 'Detects Google Gemini CLI agent',
      author: 'Sidebar Terminal',
    });
  }

  protected getDetectionPatterns(): RegExp[] {
    return [
      // ASCII art patterns
      /███\s+█████████\s+██████████\s+██████\s+██████\s+█████\s+██████\s+█████\s+█████/,
      /░░░███\s+███░░░░░███░░███░░░░░█░░██████\s+██████\s+░░███\s+░░██████\s+░░███\s+░░███/,
      // Gemini-specific patterns
      /\bgemini\s+(is|here)\b/i,
      /\bgoogle\s+ai\b/i,
      /\bbard\s+(response|answer)\b/i,
      /gemini\s+code/i,
      /gemini\s+chat/i,
    ];
  }

  protected getCommandPrefixes(): string[] {
    return ['gemini ', 'gemini'];
  }

  protected getActivityKeywords(): string[] {
    return ['gemini', 'bard', 'google ai'];
  }

  getAgentType(): string {
    return 'gemini';
  }
}
