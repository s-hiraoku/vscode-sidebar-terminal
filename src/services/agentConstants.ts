import type { AgentType } from '../types/shared';

export const NOTIFICATION_TITLE = 'Sidebar Terminal';

export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  claude: 'Claude',
  copilot: 'GitHub Copilot',
  gemini: 'Gemini',
  codex: 'Codex',
  opencode: 'OpenCode',
};

export function getAgentDisplayName(agentType: AgentType | string | null | undefined): string {
  if (!agentType) {
    return 'CLI Agent';
  }
  return AGENT_DISPLAY_NAMES[agentType] ?? 'CLI Agent';
}

export type WaitingType = 'input' | 'approval' | 'idle';

export function getWaitingTypeLabel(waitingType?: WaitingType): string {
  switch (waitingType) {
    case 'approval':
      return 'waiting for approval';
    case 'idle':
      return 'idle (no output)';
    default:
      return 'waiting for input';
  }
}
