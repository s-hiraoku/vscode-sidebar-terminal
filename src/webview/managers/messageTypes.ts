import type { TerminalInteractionEvent } from '../../types/common';
import {
  MessagePayload,
  TerminalMessageData
} from '../utils/TypedMessageHandling';

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

// Additional exports for test compatibility
export enum MessageType {
  TERMINAL = 'terminal',
  SESSION = 'session',
  CONFIG = 'config',
  STATUS = 'status',
  SYSTEM = 'system'
}

export interface ExtensionMessage {
  command: string;
  data?: MessagePayload;
  timestamp?: number;
}

export interface WebviewMessage {
  type: MessageType;
  command: string;
  payload?: MessagePayload;
}

export interface TerminalMessage extends TerminalMessageData {
  type: 'terminal';
}

export interface SystemMessage {
  type: 'system';
  command: string;
  data?: Record<string, unknown>;
}

// Re-exports for migration
export {
  MessagePayload,
  TerminalMessageData
} from '../utils/TypedMessageHandling';

// Define interfaces that were previously imported but unused
export interface SessionMessageData {
  [key: string]: unknown;
}

export interface ConfigurationMessageData {
  [key: string]: unknown;
}

export interface StatusMessageData {
  [key: string]: unknown;
}
