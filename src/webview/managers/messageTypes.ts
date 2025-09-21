import type { TerminalInteractionEvent } from '../../types/common';

export interface MessageCommand {
  command: string;
  cliAgentStatus?: {
    activeTerminalName: string | null;
    status: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
    terminalId?: string;
  };
  [key: string]: unknown;
}

export interface TerminalInteractionEventEmitter {
  (
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data: unknown
  ): void;
}
